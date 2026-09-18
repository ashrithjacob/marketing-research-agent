# How a stage-1 run works

What happens between pressing **Start run** in the cockpit and a packet appearing in
the right-hand column, followed by every HTTP endpoint the service exposes, with
input and output.

Read against the code on 2026-09-18. Response shapes were checked by calling the
running stack (`docker compose up`, `http://localhost:8080`); where a shape is
quoted, it came back from the live server.

---

## 1. The shape of the thing

```
browser (React, frontend/src)
   │  fetch /api/...            SSE /api/research/runs/:id/events
   ▼
mra container — one Node process (server/src)
   ├─ app.ts        auth, routes, serves the built SPA
   ├─ api.ts        /api/research/*
   ├─ runner.ts     RunSupervisor: one pi-agent-core Agent per run, in-process
   ├─ costs.ts      OpenRouter live prices, and the billed cost read back per turn
   ├─ trace.ts      wraps the agent's streamFn: every LLM call, prompt and answer
   ├─ prompt.ts     brief + scope + rules + judgements  → the agent's instructions
   ├─ tools.ts      the only things the agent can do (below)
   ├─ apify.ts      Amazon / Trustpilot through Apify actors
   ├─ packet.ts     pull the JSON packet out of the output and validate it
   └─ store.ts      SQLite at /data/research.db  (volume mra_data)
        │
        ├──▶ OpenRouter            the model (MRA_MODEL); /models prices; /generation cost
        ├──▶ searxng:8080          web_search (container on the same network)
        ├──▶ api.firecrawl.dev     web_fetch
        ├──▶ Apify                 amazon_find_product, amazon_reviews, trustpilot_reviews
        └──▶ /corpus               every fetched body, content-addressed (volume corpus)
```

Host port `127.0.0.1:8080` maps to the container's `8000`.

---

## 2. What happens when you press Start run

### Step 1 — the modal

`App.tsx` opens `StartRun.tsx`. It asks for two things, **product** and **market**,
and deliberately has no URL field: finding the product's site, reviews, competitors
and ad-library entries is the agent's job.

If `GET /api/research/config` reported `corpus_mounted: false`, the modal warns that
nothing will be archived. The button is disabled until the product is non-empty.

Submitting sends:

```http
POST /api/research/runs
{"brief": {"product": "Mullein", "market": "UK"}, "model": "", "nodes": []}
```

`nodes: []` is the whole stage. The **▶** beside a node in the stage rail opens the
same modal for that node alone — `"nodes": ["product_data"]` — with the brief of the
run on screen filled in. See §2b for what changes when a run covers part of the stage.

### Step 2 — the request is checked

- `app.ts`: every `/api/research/*` request passes the session check. With
  `MRA_APP_PASSWORD_HASH` empty (the local default) auth is off and every request is
  user `MRA_APP_USER`.
- `api.ts`: the body is parsed with `runRequestSchema` (`schema.ts`). The schema is
  `.strict()`, so an unknown key is a 400. A blank product is a 400.

### Step 3 — `RunSupervisor.start()` (runner.ts)

All of this happens **before the HTTP response is sent**:

1. **Standing judgements** — the active ones are loaded from SQLite.
2. **Rejected source kinds** — `effectiveRejectKinds()`: the request's
   `reject_kinds` if given, else the defaults (`seo_listicle`, `review_roundup`,
   `ai_generated`), plus every kind any judgement rejects. Judgements only ever add.
3. **Run row** — written to `research_runs` with status `queued`, the brief, the
   model, the reject list, the judgement ids and the nodes it covers (`runNodes()`:
   stage order, no repeats, empty → all four).
4. **Model lookup** — `openrouter/<model>`, defaulting to `MRA_MODEL`. Unknown
   model → the row is set `failed`, a `run.failed` event is written, and the
   endpoint returns **502**. The row stays, so the runs list still shows the attempt.
   The model is then **priced**: `costs.price()` writes OpenRouter's current list
   rates onto its `cost`, so pi-ai's per-turn arithmetic uses them rather than the
   snapshot bundled in the package (see §2a).
5. **Instructions** — `prompt.ts` builds two things:
   - the **system prompt**: "you are the stage-1 researcher", the tool list, and
     what to do if the review tools are absent;
   - the **user turn**, in this order: the rules (gather, never conclude; the four
     nodes; done = saturation; admission; how source ids work; the gap list is
     required) → standing judgements → the brief (with a line telling the agent no
     URL was supplied and finding one is its job) → the output contract and a worked
     example packet, framed as shape only — its product is invented, and a packet
     about it is rejected (step 4).
6. **Agent** — a `pi-agent-core` `Agent` is created in this process with that
   system prompt, the model, session id `research-<runId>` and the tools from
   `createResearchTools()`. Its `streamFn` — the one function that sends a request
   to the model — is wrapped by `recordLlmCalls()` (`trace.ts`), so every call is
   logged exactly as sent and answered (§2b).
7. The row becomes `running`, a `run.started {model, nodes}` event is written, and
   `watch()` is started **without awaiting it**. The endpoint returns the run summary.

### Step 4 — the browser starts following

`App.tsx` closes the modal, reloads the run list and selects the new run.
`RunView.tsx` fetches `GET /runs/:id` and opens `GET /runs/:id/events?after=0`
(SSE). Every event with a kind starting `run.` or `packet.` makes it re-fetch the run,
which is how the status chip and counters change.

### Step 5 — the agent works (runner.ts `watch()`)

`agent.prompt(instructions)` runs the loop: model turn → tool calls → model turn →
… until the model stops calling tools. The tools are the agent's entire surface:

| Tool | Backed by | What it returns to the model | Side effect |
|---|---|---|---|
| `web_search` | SearXNG `GET /search?format=json` | numbered titles, urls, snippets (default 10, max 25) | none |
| `web_fetch` | Firecrawl `POST /v2/scrape` (markdown, main content) | header (`source_id`, url, title, `archived`) + the page text, cut at `MRA_FETCH_CHAR_LIMIT` (60 000) | body written to `/corpus/runs/<runId>/sources/<sha256>` |
| `amazon_find_product` | Apify `junglee/free-amazon-product-scraper` | asin, stars, `reviewsCount`, title, url — most-reviewed first | none |
| `amazon_reviews` | Apify `junglee/amazon-reviews-scraper`, one star band per call | header (`source_id`, totals, any `GAP:`) + numbered verbatim reviews with star, date, verified flag, locator | the review JSON archived like a fetch |
| `trustpilot_reviews` | Apify `memo23/trustpilot-scraper-ppe` | same shape as above | archived like a fetch |

The three Apify tools exist **only when `APIFY_TOKEN` is set and the run covers
`review_mining`**; otherwise they are not offered at all. Without the token the
prompt tells the agent to gap `review_mining`; on a run that does not cover it they
are simply not needed, and withholding them keeps a product-data run from spending
on Apify.

The `source_id` is `sha256:` + the hash of the exact bytes written to disk, so
`GET /runs/:id/sources/:sha` can re-hash the file later and say whether it still
matches. If the write fails (unwritable or missing volume), the tool still returns
the text, with `archived: false` and an instruction to record a gap.

A tool that throws (Firecrawl 4xx, SearXNG down, Apify 402) is handed back to the
model as an error result; the run carries on. Those are the red `ERROR` rows in the
lanes.

**Every agent event is persisted before it is shown.** `onAgentEvent` turns agent
events into cockpit events and `emit()` writes each one to `research_events`
*first*, then pushes it to any SSE subscriber:

| Agent event | Cockpit event | Payload |
|---|---|---|
| assistant text grows | `message.delta` | `{delta}` — only the new characters |
| assistant message ends, with thinking | `reasoning.available` | `{text}` |
| tool starts | `tool.started` | `{tool, preview, lane}` — preview is the query or url; lane is `search`/`fetch`/`other` |
| tool ends | `tool.completed` | `{tool, error, lane}` |

At each message end, the message's text is appended to the run's output and its token
usage is added to a running total (the last turn alone would understate cost by an
order of magnitude). Its `responseId` — OpenRouter's `gen-…` id — starts a billed-cost
lookup in the background, so by the end of the run only the last turn's is pending.

### Step 6 — the run is settled (runner.ts `settle()`)

When the agent goes idle:

1. `output` (all assistant text, in order), `usage` and `ended_at` are saved.
2. **Error or Stop:** if the agent reported an error → `failed`, or `cancelled` if
   you had pressed Stop. A stop with no error → `cancelled`.
3. **Extract** (`packet.ts`): every ```` ``` ```` block is collected by scanning
   lines; the **last** one that parses as JSON and has a `stage` key is the packet.
   No such block → `invalid`.
4. **Validate:** `stagePacketSchema` — every object `.strict()`, so a field that
   is not in the contract (a `summary`, a `finding`) fails the packet. A run that
   covers part of the stage then gets the scope rule (§2b). Then six cross-object
   rules:
   - the packet's `brief.product` must echo the run's brief (containment,
     case-insensitive) — a packet about the worked example's product is
     rejected, because anchoring on the example is the quiet way a run
     "completes" having researched the wrong thing;
   - every `source_id` cited by an excerpt, measurement, attribute or saturation
     point exists in `sources`;
   - an admitted `ad_library` source with no `first_seen` needs a `competitors` gap;
   - `review_mining` marked complete needs at least one 3★ excerpt;
   - `gaps` must not be empty;
   - every node marked complete, except `product_data`, needs a saturation curve.
5. **Invalid** → status `invalid` with the reason, event `packet.invalid`.
   **Valid** → status `completed`, packet stored, judgement `applied_count`s bumped,
   events `run.completed` then `packet.ready {sources, excerpts, gaps}`.
6. **Billed cost** — whatever the outcome (a failed or cancelled run was still
   charged), the per-turn lookups are awaited and summed into `usage.billed`, and a
   `run.billed` event is sent. This happens *after* the status is final, so a slow
   `/generation` never delays it; it can hold the SSE stream open up to ~30s.
7. Every SSE subscriber gets an end-of-stream, and the run leaves the in-memory
   live map.

### §2a — what a run costs, two ways

The cockpit shows both, because they answer different questions.

- **Calc. cost** (`usage.cost.total`) — pi-ai prices every turn from `model.cost` ×
  the turn's token counts, and `addUsage` sums them. Out of the box `model.cost` is a
  snapshot generated into the pi-ai package when it was published (0.85.1); its
  OpenRouter provider has no `fetchModels`, so it never refreshes. It had drifted:
  measured 2026-09-18 for `deepseek-v4-flash-0731`, the snapshot said
  $0.065/$0.18/$0.016 per M (input/output/cache read) and OpenRouter said
  $0.06/$0.12/$0.012 — the Mullein run's $0.0227 would be $0.0179 at live prices.
  So `OpenRouterCosts` fetches `GET /api/v1/models` at startup and every six hours
  and `start()` puts those rates on the run's model. A failed refresh keeps the last
  good prices. `usage.pricing` records which rates were used — `source` is
  `openrouter-live` or `pi-ai-snapshot` (the first fetch had not landed) — so an old
  run can be read against the prices that priced it. It is still an estimate: list
  price, not what the routed upstream charged.
- **Billed** (`usage.billed`) — what OpenRouter actually charged. OpenRouter puts it
  in the final stream chunk (`usage.cost`), but pi-ai's parser drops it and its
  `onResponse` hook sees headers only, so each turn's `gen-…` id is looked up on
  `GET /api/v1/generation?id=` (`total_cost`). Measured: that endpoint **404s for
  ~4s** after the stream ends, then answers; lookups retry 404s on a 1/2/3/5/8/10s
  schedule and give up after that. `{total, turns, resolved}` — `resolved < turns`
  means some turns' charges were never read and `total` is an undercount.
  No `OPENROUTER_API_KEY` → no lookups and no `billed` at all, not $0.

Neither includes Apify, which bills separately per event.

### §2b — per-node runs, and the LLM call log

**A run on one node** (or any subset) differs from a whole-stage run in four places,
all keyed off the run's `nodes`:

- **Prompt** (`prompt.ts`). Only the covered nodes' rules are included, under
  "This run's node". A `## Scope of this run` section says to research nothing
  else, and the system prompt's "work through the four nodes" becomes "this run
  covers only …". Run-level gaps are attached to the first covered node, not
  `category_data`. A whole-stage run's prompt is unchanged, byte for byte.
- **Tools.** The Apify review tools are offered only if `review_mining` is covered.
- **Validation** (`packet.ts`). Any source, excerpt, measurement, attribute,
  saturation curve, node or gap recorded against a node outside the scope fails the
  packet (`invalid`, naming the node and the count). So does a covered node with no
  `nodes[]` entry. The worked example shows all four nodes, so copying it is the
  mistake this catches. A whole-stage run is validated exactly as before.
- **Display.** The stage rail greys out the nodes a run did not cover, the run list
  labels a partial run, and the results column shows that run's packet as usual.

**The call log.** `recordLlmCalls()` wraps the agent's `streamFn` — the one place
that sees the exact context sent to the provider and the exact message returned,
error responses included. Each call becomes a `research_llm_calls` row: start/end
time, duration, model, stop reason, error, usage (tokens and calculated cost), the
`gen-…` id, and — once `/generation` answers — `billed_cost`.

Storage is **incremental**. The agent only appends to its context, and pi-agent-core's
default `convertToLlm` filters the transcript without copying it, so each row stores
only the messages new since the previous call (checked by object identity). The
system prompt and tool list are stored only on the call where they changed — in
practice the first. The full prompt of call N is therefore the latest system prompt
and tools at or before N, plus every call's `input` from the last `context_reset` up
to N; the logs page rebuilds it that way. A context that is not an extension of the
previous one is stored whole with `context_reset: true`. A tool result's `details`
and `usage` are dropped: they never reach the model. Measured on the first real
product-data run: call 1 stored 1 message (the instructions), call 2 stored 3 of 4,
call 3 stored 3 of 7.

Each stored call also emits a small `llm.call` event (numbers only, never the
prompt), which the cockpit's trace shows as one line and the logs page uses to know
there is a new call to fetch.

**The logs page** is `/runs/<id>/logs`, opened from **Logs ↗** on a run in a new
tab. It shows the run's totals (LLM calls, time taken, tokens, calculated and billed
cost, tool calls), then one row per call: expand it for the prompt (what is new, or
**Show full prompt**) and the answer (thinking, text, tool calls with arguments,
token counts, cost). It follows the event stream and fetches only calls it has not
got (`?after=<seq>`), then refetches everything once `run.billed` lands, because the
billed costs arrive on calls it already has.

### Step 7 — the screen fills in

The `packet.ready` event triggers a re-fetch of `GET /runs/:id`, which now carries the
packet. `RunView` renders sources, excerpts (voice of customer), measurements, gaps,
and the stage rail's node status from it. Counters in the runs list come from
`store.summary()`: `sources` counts admitted sources, `rejected` the rest.

### What the code does *not* do

Worth knowing, because the prompt or a spec can suggest otherwise:

- **Rejected kinds are not enforced.** The reject list is written into the prompt;
  nothing checks the packet against it. Whether a source is `admitted: false` is the
  model's decision, and a judgement's "applied N times" counts the model's own
  rejections of that kind.
- **Excerpts are not checked against the archived body.** A quote that does not
  occur in its source passes validation (`spec-stage-1.md` §13.1, rule 7).
- **A bot wall is not detected on `web_fetch`.** A short "verifying your connection"
  page is archived and cited like any other page (§13.1, rule 8). The Apify tools do
  detect their equivalent — an empty dataset or an error record becomes a `GAP:`.
- **`amazon_find_product` always searches amazon.com**, whatever the brief's market.
- **A restart kills a live run.** The agent lives in this process; `recover()` marks
  anything left `running`/`queued`/`stopping` as `failed` on startup.
- **Billing is lost for a run killed by a restart.** The lookups live in the
  process; `recover()` marks the run failed and it has no `usage.billed`.
- *Fixed 2026-09-18:* the cockpit's "Tokens" line was always "—". The server sends
  `usage` as `{input, output, cacheRead, totalTokens, cost: {...}}`; `RunView.tsx`
  read `usage.total_tokens`, and `api.ts` declared that field too (optional), so
  `tsc` could not catch it. Both now use pi-ai's field names, and the cockpit also
  shows the calculated and billed cost (§2a).

---

## 3. Endpoints

All bodies are JSON unless stated. Every error is `{"detail": "<message>"}` with a
4xx/5xx status.

### Auth — `app.ts`

#### `GET /api/auth/session`

- **In:** the `mra_session` cookie, if any.
- **Out:** `{"authenticated": bool, "user": string|null, "auth_required": bool}`.
  With auth disabled: `{"authenticated": true, "user": "ash", "auth_required": false}`.

#### `POST /api/auth/login`

- **In:** `{"username": string, "password": string}`.
- **Out:** `200 {"user": "<name>"}` and sets `mra_session` — an httpOnly, SameSite=Lax
  JWT valid for `MRA_SESSION_HOURS` (720), `Secure` unless `MRA_COOKIE_SECURE=false`.
  Wrong credentials, or auth disabled: `401 {"detail": "invalid credentials"}`.

#### `POST /api/auth/logout`

- **In:** nothing.
- **Out:** `{"ok": true}`, cookie cleared.

#### `GET /api/health`

- **In:** nothing; no auth.
- **Out:** `{"status": "ok"}`. The Docker healthcheck calls this.

### Research — `api.ts`, all behind the session check (`401 {"detail": "not authenticated"}`)

#### `GET /api/research/config`

What the start modal needs to warn you before you pay for a run.

- **In:** nothing.
- **Out:**
  ```json
  {"default_reject_kinds": ["seo_listicle","review_roundup","ai_generated"],
   "model": "deepseek/deepseek-v4-flash-0731",
   "corpus_path": "/corpus",
   "corpus_mounted": true,
   "review_mining": {"configured": true, "max_reviews": 10}}
  ```
  `corpus_mounted` only checks that the path is a directory. A mounted but
  **unwritable** volume still reports `true`, and every source then comes back
  `archived: false`. Check with `docker exec mra ls -ld /corpus` — it must be owned
  by `appuser`.

#### `GET /api/research/runs`

- **In:** optional `?limit=` (1–200, default 50).
- **Out:** `{"data": [RunSummary, ...]}`, newest first. A `RunSummary`:
  ```json
  {"id": "c46e55e4b8af4bd8b0c227175e6b55f9", "status": "completed", "stage": 1,
   "model": "deepseek/deepseek-v4-flash-0731",
   "brief": {"product": "Mullein", "url": "", "market": "UK", "notes": ""},
   "nodes": ["product_data", "competitors", "review_mining", "category_data"],
   "error": "", "created_at": "…", "updated_at": "…", "ended_at": "…",
   "usage": {"input": 100156, "output": 17315, "cacheRead": 814592, "cacheWrite": 0,
             "reasoning": 2, "totalTokens": 932063,
             "cost": {"input": 0.0065, "output": 0.0031, "cacheRead": 0.013,
                      "cacheWrite": 0, "total": 0.0227}},
   "counts": {"sources": 10, "rejected": 3, "excerpts": 12,
              "measurements": 15, "attributes": 13, "gaps": 8}}
  ```
  That is the real Mullein record, from before §2a. A run since then also carries
  `usage.pricing: {source, fetched_at, rates}` and, once the lookups finish,
  `usage.billed: {total, turns, resolved}`.
  `nodes` is always spelled out: a run from before per-node runs has `[]` in the
  database and is reported as all four, which is what it was.
  `status` is one of `queued`, `running`, `stopping`, `completed`, `invalid`,
  `failed`, `cancelled`. The last four are terminal.

#### `POST /api/research/runs` — start a run

- **In:**
  ```json
  {"brief": {"product": "Mullein", "market": "UK", "url": "", "notes": ""},
   "model": "",
   "reject_kinds": [],
   "nodes": []}
  ```
  Only `brief.product` is required. `url` and `notes` are accepted and reach the
  prompt, but the cockpit never sends them. Empty `model` means `MRA_MODEL`. Empty
  `reject_kinds` means the defaults; a non-empty list **replaces** the defaults, and
  judgements then add to it. `nodes` picks what the run researches — any of
  `product_data`, `competitors`, `review_mining`, `category_data`; empty is the
  whole stage (§2b). Any key not listed here, or an unknown node, is a `400`.
- **Out:** `200` + `RunSummary` (status `running`), returned as soon as the agent
  is started, not when it finishes.
- **Errors:** `400` on a bad body (`"Unrecognized key(s) in object: 'colour'"`) or
  blank product (`"brief.product is required"`); `502` when the model id is unknown
  — the run row exists and is `failed`.

#### `GET /api/research/runs/:runId`

- **In:** the run id.
- **Out:** `RunSummary` plus:
  - `packet` — the validated `StagePacket`, or `null` until `completed`. Shape in
    `schema.ts`: `contract_version, stage, run_id, brief, sources[], excerpts[],
    measurements[], attributes[], saturation[], nodes[], gaps[]`.
  - `output` — every assistant message's text, concatenated. The packet was parsed
    from this; on an `invalid` run it is where to look.
  - `reject_kinds` — the effective list this run was started with.
  - `live` — `true` while the agent is running in this process.
- **Errors:** `404 {"detail": "no such run"}`.

#### `GET /api/research/runs/:runId/events` — Server-Sent Events

- **In:** `?after=<event id>` (default 0). The cockpit always sends 0.
- **Out:** `text/event-stream`. The server subscribes to live events *first*, then
  replays every stored event with `id > after`, then streams live ones, dropping any
  it already replayed. A refresh or a second tab therefore sees the whole run.
  Frames:
  ```
  event: event
  data: {"id": 412, "kind": "tool.started", "payload": {...}, "created_at": "…"}

  event: keepalive        (every 20s of silence; empty data)

  event: end
  data: {"reason": "run finished"}     or "not live" for a run that already ended
  ```
  Event kinds and payloads:

  | kind | payload |
  |---|---|
  | `run.started` | `{model, nodes}` |
  | `llm.call` | `{seq, duration_ms, input_tokens, output_tokens, cache_read_tokens, cost, stop_reason, tool_calls, error}` — one per LLM call, never the prompt |
  | `message.delta` | `{delta}` |
  | `reasoning.available` | `{text}` |
  | `tool.started` | `{tool, preview, lane}` |
  | `tool.completed` | `{tool, error, lane}` |
  | `run.steered` | `{judgement_id, text}` |
  | `run.stopping` | `{}` |
  | `run.completed` | `{usage}` |
  | `run.billed` | `{billed: {total, turns, resolved}}` — after the terminal event |
  | `packet.ready` | `{sources, excerpts, gaps}` |
  | `packet.invalid` | `{error}` |
  | `run.failed` | `{error}` |
  | `run.cancelled` | `{}` or `{error}` |

  Caddy needs `flush_interval -1` in front of this or the frames arrive in one lump.
- **Errors:** `404` if the run does not exist.

#### `GET /api/research/runs/:runId/calls` — the LLM call log

- **In:** optional `?after=<seq>`: only calls after that one. The logs page uses it
  to fetch each call once while a run is live.
- **Out:**
  ```json
  {"run":   {…RunSummary, "live": true},
   "stats": {"llm_calls": 3, "llm_errors": 0,
             "tokens": {"input": 19273, "output": 866, "cache_read": 5376,
                        "cache_write": 0, "total": 25515},
             "cost": 0.00132,
             "billed": {"total": 0.00056388, "resolved": 2},
             "llm_time_ms": 7884, "wall_time_ms": 27476,
             "tool_calls": 6, "tool_errors": 0},
   "calls": [LlmCall, …]}
  ```
  (Numbers from the first real product-data run, three calls in.) `stats` always
  covers the whole run, whatever `after` says. `billed.resolved` counts calls whose
  charge has been read back; `wall_time_ms` runs to now while the run is live.
  An `LlmCall` is `{id, seq, started_at, ended_at, duration_ms, model, system_prompt,
  tools, context_reset, context_messages, input, output, stop_reason, error, usage,
  response_id, billed_cost}`. `input` holds only the messages new since the previous
  call, and `system_prompt`/`tools` are `null` where unchanged (§2b). `output` is the
  assistant message without its usage: `content` blocks (`text`, `thinking`,
  `toolCall` with `name` and `arguments`), `stopReason`, `responseId`,
  `errorMessage`.
  A run from before the log existed returns `calls: []`.
- **Errors:** `404` if the run does not exist.

#### `POST /api/research/runs/:runId/steer` — correct a live run

- **In:** a judgement: `{"kind": "source_rule", "text": "…", "rejects_kinds": ["forum"]}`.
  `kind` is one of `source_rule`, `weighting`, `avatar_rule`, `language_rule`,
  `custom` (default `custom`); `text` is required.
- **What happens:** the judgement is **saved first** — it applies to future runs even
  if this one has just ended — then injected into the live agent as a user message
  ("Standing judgement from the human supervising this run…"), and a `run.steered`
  event is written.
- **Out:** the saved `Judgement` (shape below).
- **Errors:** `400` blank text; `404` no such run; `409` the run is not live here,
  or has already finished (the judgement is still saved).

  The cockpit's **Step in** button calls this while a run is live, and
  `POST /judgements` otherwise.

#### `POST /api/research/runs/:runId/stop`

- **In:** nothing.
- **What happens:** status → `stopping`, `run.stopping` event, `agent.abort()`. The
  run settles as `cancelled` shortly after.
- **Out:** `{"ok": true}`.
- **Errors:** `404` no such run; `409` not live here, or already finished — a run
  stays in the live map for up to ~30s after it settles while its billing is read,
  and a Stop in that window used to overwrite `completed` with `stopping`.

#### `GET /api/research/runs/:runId/sources/:sha` — the archived body

- **In:** `:sha` is the bare 64-hex hash (the `source_id` without `sha256:`).
  Anything else is a `400` and never reaches the filesystem.
- **Out:** the file from `/corpus/runs/<runId>/sources/<sha>`, as
  `text/plain; charset=utf-8`, with:
  - `X-Corpus-Digest` — the file's sha256 now;
  - `X-Corpus-Digest-Matches` — `true` if that still equals the id;
  - `Content-Security-Policy: default-src 'none'` and `X-Content-Type-Options: nosniff`,
    so a scraped page can never run as a script on this origin.
- **Errors:** `404 {"detail": "not archived"}` when there is no file.

#### `GET /api/research/judgements`

- **In:** nothing.
- **Out:** `{"data": [Judgement, ...]}`, where a `Judgement` is
  `{"id", "kind", "text", "rejects_kinds": [...], "active": true, "applied_count": 0, "created_at"}`.

#### `POST /api/research/judgements`

- **In:** same body as `/steer`.
- **Out:** the saved `Judgement`. It applies from the next run on.
- **Errors:** `400` blank text.

#### `DELETE /api/research/judgements/:judgementId`

- **In:** the id.
- **Out:** `{"ok": true}` — a hard delete, and also `ok` for an id that did not exist.

### Everything else — `app.ts` `mountFrontend`

#### `GET /*`

- A real file under the built SPA (`/app/static`) is served with its content type.
- Anything under `api/` or `assets/` that did not match, or any path whose last
  segment has a dot, is a JSON `404` — never `index.html`, so a failed API call
  cannot come back as HTML with a 200.
- Everything else gets `index.html` with `Cache-Control: no-store`, so a browser
  never holds a shell pointing at assets from an older build. That includes
  `/runs/<id>/logs`: the SPA reads the path and renders the logs page (`App.tsx`).
