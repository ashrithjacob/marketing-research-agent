# How a stage-1 run works

What happens between pressing **Start run** in the cockpit and a packet appearing in
the right-hand column, followed by every HTTP endpoint the service exposes, with
input and output.

Read against the code on 2026-09-18. Response shapes were checked by calling the
running stack (`docker compose up`, `http://localhost:8080`); where a shape is
quoted, it came back from the live server.

**The same material as a browsable guide:**
<https://claude.ai/artifact/ASqgXr5hN7cjgBeqwZdbif> — the build and boot sequence,
one run end to end, the three per-node flows side by side, a collaborator diagram
and an endpoint explorer, each layer opening into the next. Built 2026-09-20 from
this file plus the code. This file stays the source of truth; when they disagree,
this one is right and the page needs rebuilding.

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

**Stage 1 is three nodes now.** Review mining became **stage 2** on 2026-09-21
(`STAGE_NODES` in `schema.ts`): stage 1 collects `product_data`, `competitors` and
`category_data`; stage 2 collects `review_mining`. A run covers one stage, its packet
carries `stage: 1` or `stage: 2`, and the validator rejects a packet holding another
stage's nodes — that is a separate run. Downstream the compartment is six stages:
1 raw material · 2 review mining · 3 product truth · 4 market truth · viability gate ·
5 customer truth · 6 synthesis.

**Stage 2 is gated.** `POST /runs` with `nodes: ["review_mining"]` returns **409**
unless a stage-1 run for the same brief has completed. Subjects are matched with
`briefKey()` — the site's host, else the product name reduced to letters and digits —
so a retyped product name still counts. The rail greys the stage-2 ▶ for the same
reason, before the click.

`App.tsx` opens `StartRun.tsx`. It asks for two things, **product** and **markets**,
and deliberately has no URL field: finding the product's site, reviews, competitors
and ad-library entries is the agent's job.

Markets are five checkboxes — **US, UK, Australia, New Zealand, Canada**
(`DEFAULT_MARKETS`) — all ticked when the modal opens, plus a free-text box for
anything else. The brief's `market` is the joined list, ticks first: a run started
with the defaults sends `"US, UK, Australia, New Zealand, Canada"`. Re-running one
node from the stage rail splits the shown run's market string back into ticks and
free text, so the re-run carries the same scope. Untick everything and leave the box
empty and `market` is `""`, which is the old unscoped behaviour.

From 2026-09-21 a named market is a **scope, not a hint**: `briefBlock()` follows it
with "research only these markets… a source from outside them is out of scope: do not
record it, and do not count it toward saturation", and tells the agent to gap a market
that yields nothing rather than substitute another. The cockpit shows the list in the
run-detail panel as **Markets**, beside Scope.

If `GET /api/research/config` reported `corpus_mounted: false`, the modal warns that
nothing will be archived. The button is disabled until the product is non-empty.

Submitting sends:

```http
POST /api/research/runs
{"brief": {"product": "Mullein", "market": "UK"}, "model": "", "nodes": []}
```

`nodes: []` is the whole of **stage 1**. The **▶** beside a node in the stage rail opens the
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
| `web_fetch` | Firecrawl `POST /v2/scrape` (markdown, main content) | header (`source_id`, url, title, `archived`) + the page text, cut at `MRA_FETCH_CHAR_LIMIT` (25 000; was 60 000 until a run's context reached 208k tokens) | body written to `/corpus/runs/<runId>/sources/<sha256>` |
| `amazon_find_product` | Apify `junglee/free-amazon-product-scraper` | asin, stars, `reviewsCount`, title, url — most-reviewed first | none |
| `amazon_reviews` | Apify `junglee/amazon-reviews-scraper`, one star band per call | header (`source_id`, totals, any `GAP:`) + numbered verbatim reviews with star, date, verified flag, and a locator printed as packet JSON (`{"kind": "url", "url": …}`, or a `note` when there is only a review id) | the review JSON archived like a fetch |
| `trustpilot_reviews` | Apify `memo23/trustpilot-scraper-ppe` | same shape as above | archived like a fetch |
| `validate_packet` | `packet.ts` `validate()` — the same function `settle()` runs | `VALID` + counts, or the numbered problems and `Checks used: N of 5` | on the first pass: the packet is written to the run row with `packet_source = "tool"` and `packet.ready` fires mid-run |

The three Apify tools exist **only when `APIFY_TOKEN` is set and the run covers
`review_mining`**; otherwise they are not offered at all. Without the token the
prompt tells the agent to gap `review_mining`; on a run that does not cover it they
are simply not needed, and withholding them keeps a product-data run from spending
on Apify. The one exception is `amazon_find_product` on its own: a run that covers
`competitors` gets it (still only with the token) as a discovery source — Amazon's
search lists competitors with their review counts — without the two review tools.

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

**The short path first.** If the agent validated a packet mid-run with
`validate_packet`, the run already has its deliverable: status `completed`, no
extraction, no re-validation. If the agent *also* errored or the stream died after
that, the run is still `completed` and an extra `run.ended_early {error}` event
records it — the artefact is valid even though the turn was not, and calling such a
run `failed` would be a lie about the packet. A Stop still wins over both.

Otherwise, when the agent goes idle:

0a. **Retry, up to three times** (`watch()`, `shouldRetry()`, `backoffMs()`): if the
   agent ended with an `errorMessage`, you did not press Stop, and pi-ai's
   `isRetryableAssistantError` calls it transient, the run waits and is prompted to
   carry on — the message says the last turn's connection dropped and that the tool
   results above still stand. Event `run.resumed` with `attempt` and `delay_ms`.
   `prompt()` clears `errorMessage` and keeps the transcript, so this continues
   rather than restarts.

   **Backoff is 2s, 4s, 8s with equal jitter** (half fixed, half random, capped at
   30s): full jitter can pick a few milliseconds and hammer a provider that just
   dropped the connection, and no jitter makes concurrent runs retry in lockstep.

   **Why bounded at three.** A retry re-sends the whole transcript, so on a long run
   it costs a full context of input tokens — the run below was carrying 93k. Three
   attempts ride out an upstream restart without turning an outage into a bill.

   **Why a deny-list, not a recognise-list.** The first cut asked pi-ai's
   `isRetryableAssistantError` what to retry, and it only retries wordings it
   knows. Two live runs died on two different strings: `terminated`, which it
   knows, and `Upstream error from Relace: The model stopped before completing the
   response`, which it does not — the second lost 140k tokens of research without a
   single retry. Providers and gateways word stream failures however they like, so
   `retryableError()` now retries **anything** except `TERMINAL_ERROR`: quota,
   billing, 401/403, context-length, invalid request, unknown model, content
   policy. The attempt budget caps what an unknown wording can cost; a lost run
   cannot be recovered. pi-agent-core has no retry of its own, which is why this
   lives here at all.

   Measured 2026-09-21: a HappyWags run lost five completed turns and 15 tool calls
   when the OpenRouter stream closed 98s into turn 6 — `stop_reason: "error"`,
   `error: "terminated"` (undici's word for a socket that went away), zero tokens
   recorded for that call, and OpenRouter still billed the run.

0b. **One nudge** (`watch()`, `lacksPacket()`): if the run holds no packet object
   at all, it gets one more turn with tools switched off, asking for the packet
   from what it already gathered. Event `run.nudged`. Two cases reach it:

   - it **ended cleanly** with no packet — a DeepSeek run at 208k input tokens
     wrote "let me write the JSON now" 56 times and then ended its turn without
     writing it;
   - it **died with the retry budget spent**, but had at least one tool result in
     the transcript. A run that fetched 30 pages is worth one tools-off ask before
     it is written off; a run whose provider never answered has nothing to salvage,
     so the tool result is the bar. If the ask fails too, the run settles `failed`
     with that error.

   A packet that exists but breaks the contract is *not* nudged. That is an
   `invalid` run, and asking again would hide the mistake. Never for a Stop.
1. `output` (all assistant text, in order), `usage` and `ended_at` are saved.
2. **Error or Stop:** if the agent reported an error → `failed`, or `cancelled` if
   you had pressed Stop. A stop with no error → `cancelled`.
3. **Extract** (`packet.ts`): every ```` ``` ```` block is collected by scanning
   lines, and **every balanced `{ … }` in the output** is collected too
   (`balancedObjects()`, which tracks strings and escapes so a brace inside a quote
   closes nothing). The **last** candidate that parses as JSON and has a `stage` key
   is the packet; the brace-derived ones are tried first. No such candidate →
   `invalid`.

   The brace pass exists because fences drift. Measured 2026-09-21 on a HappyWags
   run that cost $0.065 and 1.16M tokens: the model wrote a placeholder
   ```` ```json {...} ```` block, a stray ```` ``` ```` after "Now, finally,
   emitting.", and two abandoned attempts — eight fence lines, unbalanced. One stray
   fence inverts the pairing for everything after it, so the prose became block
   content and the real 47k-character packet (22 sources, 16 excerpts, 15 gaps) sat
   outside every block. The run was rejected with "found fenced blocks but none
   decoded to a stage packet object" while its packet was right there in `output`.
4. **Validate:** `stagePacketSchema` — every object `.strict()`, so a field that
   is not in the contract (a `summary`, a `finding`) fails the packet. A run that
   covers part of the stage then gets the scope rule (§2b). Then seven cross-object
   rules:
   - the packet's `brief.product` must echo the run's brief (containment,
     case-insensitive, on letters and digits only) — a packet about the worked
     example's product is rejected, because anchoring on the example is the quiet
     way a run "completes" having researched the wrong thing. A **site brief**
     (`brief.url`, no product) passes when the packet echoes the same host, or
     when the brand in the domain survives in the name it wrote —
     `thedropletco` against "Droplet (**The Droplet Co**) — …", which only matches
     once both sides are squashed to letters and digits. And `brief.product` in
     the packet may not itself be a url: the name is what the run was for;
   - every `source_id` cited by an excerpt, measurement, attribute or saturation
     point exists in `sources`;
   - an admitted `ad_library` source with no `first_seen` needs a `competitors` gap;
   - `review_mining` marked complete needs at least one 3★ excerpt;
   - `gaps` must not be empty;
   - every node marked complete, except `product_data`, needs a saturation curve —
     and `competitors` needs two, one with `class: "direct"` and one with
     `class: "indirect"` (§2c);
   - competitor rows obey the §2.2 test (§2c): `relation` is recomputed from the
     forms — **except where both are `other`**, the escape hatch for anything the
     supplement vocabulary does not cover, where the agent's label stands and
     `form_as_printed` is required on both sides as the evidence for it;
     `shared_actives` must be in both the row's actives and the reference product's, `competitor_reference` must exist once any competitor does, and
     `ad_source_ids` must point at `ad_library` sources.
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
- **Tools.** The Apify review tools are offered only if `review_mining` is covered;
  `amazon_find_product` alone also if `competitors` is. The system prompt describes
  exactly the tools offered.
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

### §2c — competitors: direct and indirect

`spec-stage-1.md` §2.2: a **direct** competitor shares an active ingredient with the
product and has the same form; an **indirect** one shares an active and has a
different form. A brand that solves the same problem with a *different* active is
neither — it becomes a gap ("same problem, different active"), because whether
another molecule is a substitute is a stage-2 judgement.

The packet carries this as two things (`schema.ts`):

- `competitor_reference` — the product being compared against, read off its own
  page: `name`, `form`, `form_as_printed`, `actives` (normalised names), `source_id`.
  A competitors-only run has no product-data attributes to lean on, so the node
  records the two facts the test needs itself.
- `competitors[]` — one strict row each: `name`, `brand`, `url`, `relation`,
  `form`, `form_as_printed`, `active_ingredients[]` (§2.1's shape: as printed,
  normalised, dose, unit, per, standardisation), `shared_actives`,
  `dose_per_serving`, `positioning_copy` (verbatim), `price`, `price_per_dose`,
  `source_id` (the page the row was read from), `ad_source_ids`.

`form` is one of a fixed vocabulary — `capsule`, `tablet`, `gummy`, `powder`,
`liquid`, `spray`, `tea`, `topical`, `other` — because the test is only mechanical
if "veg caps" and "capsules" are the same word; `form_as_printed` keeps the label's
own wording. The validator then **recomputes** each row's relation from the two
forms and rejects a label that disagrees, rejects a "shared" active that is not in
both the row's and the reference's actives, and requires two saturation curves
(`class: "direct"`, `class: "indirect"`) before the node may call itself complete —
one combined count would let a long direct list end the indirect search.

The agent finds competitors with `web_search` across forms ("<active> capsules",
"… spray", "… gummies", "… tea"), `amazon_find_product` where offered, and then
`web_fetch` of each competitor's own page — a search hit is not a competitor.

**Measured, 2026-09-18, brief "Mullein", market UK, competitors only.** Reference:
*Mullein Leaf, 120 capsules (New Leaf Products)*, capsule, `mullein leaf`.
5 direct (capsules) and 8 indirect (3 liquid drops, 1 spray, 3 teas, 1 gummy),
each with verbatim positioning copy and price; node honestly `incomplete` — both
curves were still adding brands on their last source. 12 LLM calls, 835k tokens
(486k of them cache reads), $0.028 billed by OpenRouter, 6.6 minutes, 28 tool calls
— plus one `amazon_find_product` call returning 5 results, ~$0.06 at Apify's listed
$0.012 a result (not read back: the call log covers OpenRouter only). Three
things it showed:

- **A category brief makes the reference arbitrary.** "Mullein" names an
  ingredient, not a product, so the agent picked one capsule product to measure
  against — and every direct/indirect label follows from that pick. Brief a
  specific product (brand, form) when the split matters.
- **`amazon_find_product` searches amazon.com**, so on a UK brief it surfaces US
  listings; the agent gapped this rather than recording them as UK competitors.
- **The system prompt used to list all five tools whatever the scope**, and the
  run gapped "amazon_reviews and trustpilot_reviews were not available" — noise
  from tools it was never meant to have. It now describes only the tools the run
  is given (`systemPrompt(nodes)`).

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
  With the five default markets this is right for the US and roughly right elsewhere,
  but a UK-only or AU-only run still gets amazon.com listings and prices. The brief
  tells the agent to use each market's own listing where a site serves several, so
  the honest record of the difference is a gap entry.
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
  **A url typed as the product is moved to `url`.** `normaliseBrief()`
  (`schema.ts`) runs on every POST: if `brief.product` looks like a url — a bare
  `example.com` or a full `https://…`, no spaces — it is moved into `brief.url`
  (adding `https://` if missing) and `product` is left **empty**. `product` is a
  name; a url never belongs in it. Either field satisfies the request, so
  `{"brief": {"url": "https://…"}}` is valid, and only a brief with neither is a
  `400`. `notes` is accepted and reaches the prompt. Empty `model` means `MRA_MODEL`. Empty
  `reject_kinds` means the defaults; a non-empty list **replaces** the defaults, and
  judgements then add to it. `nodes` picks what the run researches — any of
  `product_data`, `competitors`, `review_mining`, `category_data`; empty is the
  whole stage (§2b). Any key not listed here, or an unknown node, is a `400`.
- **Out:** `200` + `RunSummary` (status `running`), returned as soon as the agent
  is started, not when it finishes.
- **Errors:** `400` on a bad body (`"Unrecognized key(s) in object: 'colour'"`) or
  an empty brief (`"brief.product or brief.url is required"`); `502` when the model id is unknown
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
  | `run.nudged` | `{reason}` — the run ended without a packet and was asked once more |
  | `run.resumed` | `{error, attempt, delay_ms}` — the model stream dropped and the run was continued after a backoff |
  | `run.completed` | `{usage}` |
  | `run.billed` | `{billed: {total, turns, resolved}}` — after the terminal event |
  | `packet.checked` | `{valid, problems[]}` — one per `validate_packet` call; a failed check is the loop working, not an error |
  | `packet.ready` | `{sources, excerpts, gaps, via?}` — `via: "tool"` when it was validated mid-run, and then it arrives **before** the run ends |
  | `run.ended_early` | `{error}` — the run died after validating a packet; the packet stands |
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
