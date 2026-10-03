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
mra container — one Node process (server/src, layered — see CLAUDE.md)
   ├─ http/         App (auth, the SPA), ResearchApi (/api/research/*)
   ├─ agent/        RunSupervisor: up to four pi-agent-core Agents per stage-1 run, in-process
   │                LlmCallLog wraps the streamFn: every call, prompt and answer
   │                prompt/   brief + scope + rules + judgements → instructions
   │                tools/    the only things the agent can do (below)
   ├─ adapters/     OpenRouterPrices: live prices, billed cost read back per turn
   │                apify/     Amazon / Trustpilot through Apify actors
   │                sqlite/    SQLite at /data/research.db  (volume mra_data)
   ├─ extract/      pull the JSON packet out of the output and validate it
   ├─ domain/       the packet schema, the vocabulary, the ports
   └─ config/       Settings — the only reader of process.env
        │
        ├──▶ OpenRouter            the model (MRA_MODEL); /models prices; /generation cost
        ├──▶ api.firecrawl.dev     web_fetch
        ├──▶ api.parallel.ai       web_search, every stage; product truth's page reads (§2f)
        ├──▶ Apify                 amazon_find_product; the listing lookup after stage 1; review mining's pulls (stage 3)
        └──▶ /corpus               every fetched body, content-addressed (volume corpus)
```

Host port `127.0.0.1:8080` maps to the container's `8000`.

---

## 2. What happens when you press Start run

### Step 1 — the modal

**Three collecting stages** (`STAGE_NODES` in `domain/nodes.ts`): stage 1 collects
`product_data`, `competitors` and `category_data`; stage 2, product truth, collects
`mechanism`, `dose_vs_study`, `claim_limits` and `cogs_refills` (§2f); stage 3
collects `review_mining`. A run covers one stage, and the validator rejects a packet
holding another stage's nodes — that is a separate run. The compartment reads
1 raw material · 2 product truth · 3 review mining · market truth · viability gate ·
customer truth · synthesis. *Superseded 2026-10-01:* review mining was stage 2
(from 2026-09-21) and product truth an empty slot after it; it moved behind
product truth because the operator wants the product assessed before its
reviews are bought, and the stored rows were renumbered by a one-time data
migration (`adapters/sqlite/migrations.ts`). The `StageTwo*` classes were
renamed `ReviewMining*` at the same time — numbers in names are what made the
rename necessary.

**Later stages are gated.** `POST /runs` for stage 2 or 3 returns **409** unless a
stage-1 run for the same product has **completed**, and for review mining also
unless product truth has completed on that same stage-1 run
(`StageOneHandoff.hasCompleted`). *Fixed 2026-10-01:* the hand-off took the
newest stage-1 run with a packet whatever its status, which became wrong once
invalid runs kept their packet; it now takes only completed ones. Products are matched with
`Briefs.key` (`server/src/domain/brief.ts`): for a URL, the page — host without
`www.` plus path, lowercased, with scheme, port, trailing slash, `?query` and
`#fragment` ignored; else the product name reduced to lowercase letters and digits,
so `vitamin D`, `vitamin_d` and `VITAMIND` are one product. Each run is filed under
a stored product (`research_products`) when it is created; the hand-off looks the
product up by key and searches every run of it, not a recent page of runs. The rail greys the stage-2 ▶
for the same reason, before the click.

*Superseded 2026-09-26:* a URL used to match on the site's host alone, so every
product on one site shared a subject and a stage-2 run could mine another page's
stage-1 packet. It now matches per page, because the same key names the product
folders in the cockpit and one site can sell many products.

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

From 2026-09-28 the scope is checked, not only asked for. Each competitor carries a
`market`: the market of the page the agent read, copied as the brief names it.
`MarketCheck` (`extract/market-check.ts`) rejects the packet if a competitor has no
market or one the brief does not list, so an out-of-market competitor is an `invalid`
run rather than a judgement call. It compares against the run's own brief, not the
packet's copy of it. A brief with no market checks nothing.

If `GET /api/research/config` reported `corpus_mounted: false`, the modal warns that
nothing will be archived. The button is disabled until the product is non-empty.

Submitting sends:

```http
POST /api/research/runs
{"brief": {"product": "Mullein", "market": "UK"}, "nodes": []}
```

`nodes: []` is the whole of **stage 1**. The **▶** beside a node in the stage rail opens the
same modal for that node alone — `"nodes": ["product_data"]` — with the brief of the
run on screen filled in. See §2b for what changes when a run covers part of the stage.

### Step 2 — the request is checked

- `http/auth-gate.ts`: every `/api/research/*` request passes the session check, which
  resolves the cookie to a **principal** — account, workspace, admin or not — and
  leaves it on the request context. With `MRA_APP_PASSWORD_HASH` empty (the local
  default) auth is off and every request is `MRA_APP_USER` as an admin.
- `http/scope-guard.ts`: any `/runs/:runId…` or `/products/:productId…` path outside
  the principal's workspace is a 404 before a route sees it. The admin's scope is
  every workspace. A new run is created in the principal's workspace, and picks up
  only that workspace's judgements.
- `http/run-routes.ts`: the body is parsed with `runRequestSchema` (`domain/request.ts`). The schema is
  `.strict()`, so an unknown key is a 400. A blank product is a 400.

### Step 3 — `RunSupervisor.start()` → `RunLauncher.launch()` (`agent/run-launcher.ts`)

All of this happens **before the HTTP response is sent**:

1. **Standing judgements** — the active ones are loaded from SQLite.
2. **Rejected source kinds** — `effectiveRejectKinds()`: the request's
   `reject_kinds` if given, else the defaults (`seo_listicle`, `review_roundup`,
   `ai_generated`), plus every kind any judgement rejects. Judgements only ever add.
3. **Run row** — written to `research_runs` with status `queued`, the brief, the
   model, the reject list, the judgement ids and the nodes it covers (`runNodes()`:
   stage order, no repeats, empty → all four).
4. **Model lookup** — `openrouter/<MRA_MODEL>`. The model is set in `.env` and
   nowhere else: `Env.required("MRA_MODEL")` has no fallback, both compose files
   refuse to start without it, and a run request cannot name one (a `model` key is a
   `400`). *Superseded 2026-09-28:* a request's `model` used to override `MRA_MODEL`,
   and the code and compose files each carried `z-ai/glm-5.3-flash` as a default —
   three places a model could come from besides `.env`. Nothing sent a `model`
   (the cockpit always sent `""`), so it was removed rather than kept.

   **Backups** come from `MRA_BACKUP_MODELS` in `.env` — optional, comma-separated,
   in fallback order, no id twice. `ModelChain.resolve()` (`agent/model-chain.ts`)
   looks up the primary and every backup and prices each. They are used two ways:

   - **Before an answer starts** — every request carries OpenRouter's `models` field
     (the models after the one answering), added through pi-ai's `onPayload` hook
     (`ModelChain.withFallbacks`). OpenRouter tries them if the request is refused:
     rate limits, downtime, context length, moderation. It routes providers within
     each model as it always has; we set no provider preferences.
   - **After an answer has started** — OpenRouter cannot switch then, so our retry
     does: see step 0a.

   Any unknown id, primary or backup, → the row is set `failed`, a `run.failed` event is written, and the
   endpoint returns **502**. The row stays, so the runs list still shows the attempt.
   The model is then **priced**: `costs.price()` writes OpenRouter's current list
   rates onto its `cost`, so pi-ai's per-turn arithmetic uses them rather than the
   snapshot bundled in the package (see §2a).
5. **The plan** — `StageOnePlans.of(brief, nodes)` (`domain/stage-one-agents.ts`)
   decides which agents run. **Step 1** is the `champion` agent, alone: it runs
   unless the brief is a url *and* `competitors` is out of scope (then the product
   is the one the url sells, and there is nothing to rank). **Step 2** is one agent
   per node in scope — `product` (`product_data`), `competitors`, `category`
   (`category_data`) — all at once. Decided 2026-09-30, `workings_stage1.md`.
6. **`StageOneRun`** (`agent/stage-one-run.ts`) is created and started **without
   awaiting it**. The row becomes `running`, `run.started {model, nodes}` is
   written, and the endpoint returns the run summary. Each agent is built when its
   step starts, by `ResearchAgentFactory` (`agent/research-agent-factory.ts`) from
   its `RoleSpec` in `ROLES` (`domain/research-roles.ts`) — the same factory builds
   the stage-2 agents:
   - a `pi-agent-core` `Agent`, session id `research-<runId>-<agent>`, the run's
     model (step 4);
   - its **system prompt** (`PromptBuilder.system`): who it is, that four agents
     share one ledger, and only the tools it has — each research tool the
     `ToolRegistry` built brings its own prompt line, and a tool whose service is
     not configured is neither built nor listed. `category` has its own system
     prompt; the other three share one;
   - its **user turn** (`PromptBuilder.instructions`): the shared gathering rules
     with *its own* task in them → standing judgements → the brief → for a step-2
     agent, **the champion row as the ledger holds it** (or "no champion was looked
     up") → recording notes;
   - its tools (below), its `finish` check, and a `streamFn` wrapped by
     `LlmCallLog` under its `agent_id`, numbered by one `CallSequence` per run so
     `seq` stays unique across agents (§2b).

### Step 4 — the browser starts following### Step 4 — the browser starts following

`App.tsx` closes the modal, reloads the run list and selects the new run.
`RunView.tsx` fetches `GET /runs/:id` and opens `GET /runs/:id/events?after=0`
(SSE). Every event with a kind starting `run.` or `packet.` makes it re-fetch the run,
which is how the status chip and counters change.

### Step 5 — the agents work (`agent/stage-one-run.ts`, `agent/agent-driver.ts`)

`StageOneRun.start()` drives the champion to its end, then starts the step-2
agents together and waits for all of them (`Promise.all`). `AgentDriver.drive()`
runs one agent's loop — model turn → tool calls → model turn → … — emits
`agent.started` and `agent.ended {status}`, and retries a dropped stream (step 6,
0a) for that agent alone. An agent ends `complete` (its `finish` passed),
`incomplete`, `failed` (it errored) or `cancelled` (Stop). The run is settled once,
after the last one ends (step 6).

**The agents' tasks** (`agent/prompt/text/tasks.ts`). Each agent's user prompt is
its own task — the fields, where to look, how to work, when to stop — then a short
shared `## Sources` block (`text/sources.ts`: fetch before citing, the source kinds,
the rejected kinds), standing judgements, the brief, and for step 2 the champion.

| Agent | Records | Task | Done when |
|---|---|---|---|
| `champion` | source, reference, gap | genre brief: `amazon_find_product` with the genre, the most-reviewed listing is the champion and the next is the runner-up; read its page, `record_reference` with the ranking and `amazon_url`. Url brief: fetch the site, then `amazon_find_product` for its Amazon listing | `RoleDone`: a reference recorded (or gapped — its deliverable), then `ChampionContract`: citing a source it recorded, with an `icp`, and for a genre brief the ranking `ChampionCheck` demands (or a "champion ranking unavailable" gap) |
| `product` | source, attribute, node status, gap | the ten required fields of `PRODUCT_DELIVERABLE` (`domain/role-deliverables.ts`), one attribute each, from the product page, its Shopify `.json`, FAQ and policy pages; other facts may follow as attributes with their own key, never instead of the ten | `RoleDone`: every one of the ten recorded or gapped as "<key>: <why>" (`FieldsCheck`), and its rows pass the contract for `product_data` (`NodeContract`) |
| `competitors` | source, competitor, saturation, node status, gap | the direct/indirect search of §2c, measured against the champion row | `RoleDone`; `NodeContract` over its own rows **plus the champion's**; each competitor with `icp_as_printed` and `form_as_printed` (refused at write time without them), and each class's curve ending in three sources in a row adding nothing, or a gap "saturation: <class>: <why>" (`ListCheck`, `extract/list-check.ts`, from `COMPETITORS_DELIVERABLE`) |
| `category` | source, measurement, attribute, node status, gap | `search_volume` (rows for three or more years), `category_size: <segment>`, `seasonality`; two failed routes to a field and it is gapped; other category facts may follow, never instead of the three | `RoleDone`: all three recorded or gapped, the trend three distinct years (`FieldsCheck`), then `NodeContract` |

**The required fields are enforced, not only asked for.** They are declared once,
in each role's deliverable (`domain/role-deliverables.ts`), which renders the
task's field table (`DeliverableTable`) and is checked by `FieldsCheck`
(`extract/fields-check.ts`).
`finish` names every required field that has neither a row nor a gap starting with
its name, and the turn limit (below) gaps them if the agent runs out. Other keys
are kept: both agents try for their required fields first and may record other
facts after them (decided 2026-10-01; refusing them, decision 11, was reversed the
same day). `finish` names every field
that has neither a row nor a gap starting with its name.

**Each agent has a turn limit** (`maxTurns` on its `RoleSpec` in `ROLES`: champion
10, product 15, category 15, competitors 20 — one turn is one model reply; set by
the operator 2026-10-01). The
prompt states it. `TurnBudget` counts turns through pi-agent-core's own
`finishTurn` hook, which ends the agent loop after the last one. If the agent had
not passed `finish` by then, `LimitClose` first retracts every row of its own
that fails its `finish` check, recording a gap for each (`"saturation sat112
retracted at the 20-turn limit: <problem>"`), and repeats until none fails. Then it
records a gap for every field still open (`"<field>: not found within the 15-call
limit"`) and an incomplete status if none is left, and emits `agent.limit_reached
{agent_id, limit, gapped, retracted}`. A row can be retracted because each check
problem names the ledger row it is about (`CheckProblem.row`). A problem that
belongs to no single row still leaves the run `invalid`. Settlement runs the same
repair (`RowRepair`) over every agent's rows before deciding the status, and stores
the packet even when the run ends `invalid`. Why: `workings_stage1.md` decisions
17 and 18. The champion
is not closed this way: a missing champion cannot be gapped into existence. The
first limits (category 20, competitors 40) were set from run `4035e2b6`, where
product finished in 10 turns and category in 22.

**Superseded 2026-10-01: the shared rules and the open record.** Every agent used
to get the same long rules text (`rules.ts`, `recording.ts`, `node-rules.ts`,
deleted) with its task set inside it, and a fact with no field was "an attribute
with a key you name". Run `0dc7e23c` showed the cost: told that excerpts "are what
you're here for", the product agent recorded 61 excerpts and 31 measurements of
marketing copy on top of its ten fields, and its answers took 610 of its 628 s.
The category agent spent 18 of its 50 turns chasing a three-year trend through
Google Trends, which refused every route, before gapping it. No stage-1 agent
records excerpts now.

**Superseded 2026-09-30: `category_data` done by saturation.** A complete
`category_data` needed a saturation curve. `workings_stage1.md` makes it
field-filling like `product_data`; only `competitors`, the one open-ended node, is
done by saturation now (`CompletenessCheck`).

| Tool | Backed by | What it returns to the model | Side effect |
|---|---|---|---|
| `web_search` | Parallel `POST /v1/search` (SearXNG until 2026-10-01) | numbered titles, urls, and the passages Parallel read off each page (default 10, max 25); these choose what to fetch and are not citable in stage 1 | none |
| `web_fetch` | Firecrawl `POST /v2/scrape` (markdown, main content) | header (`source_id`, url, title, `archived`) + the page text, cut at `MRA_FETCH_CHAR_LIMIT` (25 000; was 60 000 until a run's context reached 208k tokens) | body written to `/corpus/runs/<runId>/sources/<sha256>` |
| `discover_competitors` (competitors agent only, once) | Parallel Task API `POST /v1/tasks/runs`, processor `MRA_DISCOVERY_PROCESSOR` (default `pro`, $0.10 a call), polled every 10 s until done (`MRA_DISCOVERY_TIMEOUT_SECONDS`, 900) | brands selling to the champion's `icp`, each with its page, form, market and who it says it is for: **candidates**, which the agent must `web_fetch` before recording | the answer written to the corpus; its `source_id` comes back |
| `ad_library_search` (product, competitors, category; only with `TRENDTRACK_API_KEY`) | Trendtrack `POST /v1/ads/query`: Meta ads by reach, `adCountries` = the markets the agent passes as ISO codes; one credit per ad (5 ads cost 5 credits, measured 2026-10-02) | the match count, then per ad: advertiser page, landing domain (which names the brand behind a persona page), first and last seen, countries, reach, copy | the search and every ad archived, each with its own `source_id` |
| `amazon_find_product` | Apify `junglee/free-amazon-product-scraper` | asin, stars, `reviewsCount`, title, url — most-reviewed first | none |
| `record_*` — the kinds its role may write, derived from what it must deliver (`RoleRecords.of`): the champion gets `record_source`, `record_reference`, `record_gap`; product `record_source`, `record_attribute`, `record_node_status`, `record_gap`; category those and `record_measurement`; competitors `record_source`, `record_competitor`, `record_saturation`, `record_node_status`, `record_gap` | the **run ledger** (`research_findings`, one SQLite row per finding, written at once, tagged with the writer's `agent_id`) | `RECORDED <row id>` (`src3`, `ex14`, …), `(replaces <id>)` when it supersedes the agent's *own* earlier row with the same key, or `NOT RECORDED — <problem>` | the row is checked against its section's zod schema and the agent's node *before* it is written (`extract/finding-check.ts`); a refused row writes nothing. The champion row belongs to every stage-1 run, so it is never out of scope |
| `retract` | the run ledger | `RETRACTED <id>`, or `NOT RETRACTED — <why>` | marks the row retracted with the reason; rows are never deleted. **Only the agent that wrote a row may retract it** |
| `read_ledger` | the run ledger | every agent's live rows, one line each as `<id> [<agent>] <kind>: <payload>`, filterable by `agent` and `kind`, the newest 60 | none |
| `wait_for` — step-2 agents only | the run ledger, polled every 15 s (`LEDGER_POLL_MS`) | `READY` with the rows once the named agent has recorded a row of that kind; `NOT AVAILABLE` if that agent has ended without one, the run is stopping, or 40 checks (10 min) pass — the cap that keeps two agents waiting on each other from waiting forever | none |
| `finish` | the agent's `RoleDone` (`agent/role-done.ts`, built by `RoleChecks`): what its deliverable still lacks (`DeliverableChecks.of`, `extract/deliverable-check.ts`), then its consistency check (`agent/done-check.ts`): `ChampionContract`, `NodeContract` — `PacketAssembly` then `PacketValidator` over the agent's own rows, scoped to its node — or, for stage 2, `TruthContract` | `FINISHED`, or `NOT FINISHED — N problems` numbered and `Checks used: N of 5`; past five checks (`FINISH_BUDGET`), `NOT CHECKED — … spent` with `terminate: true` | a `packet.checked {agent_id, valid, problems}` event; on a pass pi's `terminate: true` ends **that agent's** loop. Declared `executionMode: "sequential"`, so a `finish` sent in the same turn as records runs after them. *Superseded 2026-09-30:* a passing `finish` used to write the run's packet (`packet_source = "finish"`); with four agents no one agent holds the packet, so it is always built from the ledger at the end |

**These are stage 1's tools.** Stage 2 has no agent and no tools since 2026-09-30
(`spec-stage-2-pipeline.md`): `mine_reviews`, `amazon_reviews` and
`trustpilot_reviews` are retired, and their pull logic lives in `ReviewPuller`
(§2d). `amazon_find_product` is offered only to the `champion` and `competitors`
agents, and only with an Apify token.

**When a competitors run completes**, `RunWrapUp.lookUpListings` looks up the Amazon
listing of the champion and every competitor (`StageOneListings`, one search each,
about $0.01, charged to the run as a `research_charges` row with no agent), matches each with
`ListingMatch` (brand, one of its actives, and its form named in the title — a
liquid by its volume, a powder by its weight), stores the rows in
`research_target_listings`, and emits `packet.listings {total, matched}`. It runs
after the status is `completed`, never before: an Apify search can wait minutes.
`GET /runs/:id` serves the rows as `listings`, **re-judged by today's matcher on
every read** (`StageTwoListings.judged`), and the Competitors tile shows each
competitor's Amazon link or "not on Amazon".

**The model never writes the packet** (since 2026-09-29, `spec-context-subagents.md`
§4). Each tool's description carries one example item; `PacketAssembly` builds the
packet from the live ledger rows of every agent — `brief` is the run's own, and a site brief's
product name is the `product_data` attribute with key `name`, else the champion's
name. Code assigns the ids of excerpts, measurements and attributes. A kind with a
natural key — a source's id, a competitor's id, the one reference, one status per
node, one saturation curve per node and class, an attribute's node and key, a
measurement's node, metric and period — is replaced by a newer row with the
same key **from the same agent**; the older row is retracted, not deleted. Two
agents that record the same thing (both fetched one page) each keep their row, and
the packet carries it once, as last recorded (`PacketAssembly.payloads`).

**A page fetch falls back to Crawl4AI** when Firecrawl can read no page at all
(out of credits, key refused, or no key) and `CRAWL4AI_API_KEY` is set
(`adapters/fallback-fetcher.ts`, `adapters/crawl4ai.ts`; `../setup.md` §5a).

**Every outside call goes through one queue per service**, shared by every run in
the process (`adapters/service-queue.ts`, wrapped round the adapter behind its port
in `adapters/throttled.ts`, built once in `App`): Firecrawl 2
(`MRA_FIRECRAWL_CONCURRENCY`, the plan's `maxConcurrency` measured 2026-09-29),
Parallel 4 (`MRA_PARALLEL_CONCURRENCY`, search and extract share it), Apify 16 (`MRA_APIFY_CONCURRENCY`, now shared
across tools, runs and the stage-2 listing lookup). Each admitted call writes a
`ServiceQueue.admitted {service, waited_ms}` trace line.

The Apify review tools exist **only when `APIFY_TOKEN` is set and the run covers
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

A tool that throws (Firecrawl 4xx, Parallel 401/402, Apify 402) is handed back to the
model as an error result; the run carries on.

**Except a Firecrawl rate limit, which is waited out.** Firecrawl limits requests
per minute per API key. On a 429, `Firecrawl.scrape` reads how long it asks us to
wait — a `Retry-After` header, or the "retry after 11s" in its error text — waits
120% of that (`RateLimitWait`, `adapters/rate-limit-wait.ts`) and tries again, at
most twice, never past the fetch's own timeout, and stopping at once on Stop. A 429
that names no wait is reported as before. Why: run `94142db4` (2026-09-28) sent 7
page reads at once and two came back "Consumed (req/min): 11 / 12, Remaining: 0 …
retry after 11s"; each went to the model as a failed read, and re-reading costs the
model a whole turn rather than 13 seconds. Those are the red `ERROR` rows in the
lanes.

**Every agent event is persisted before it is shown.** `onAgentEvent` turns agent
events into cockpit events and `emit()` writes each one to `research_events`
*first*, then pushes it to any SSE subscriber:

| Agent event | Cockpit event | Payload |
|---|---|---|
| an agent starts / ends | `agent.started` / `agent.ended` | `{agent_id}` / `{agent_id, status, error?}` |
| assistant text grows | `message.delta` | `{agent_id, delta}` — only the new characters |
| assistant message ends, with thinking | `reasoning.available` | `{agent_id, text}` |
| tool starts | `tool.started` | `{agent_id, tool, tool_call_id, preview, lane}` — preview is the query or url; lane is `search`/`fetch`/`other` |
| tool ends | `tool.completed` | `{agent_id, tool, tool_call_id, error, lane, inside, service?}` — `tool_call_id` is the id on the model's `toolCall` block and on the `toolResult` that answers it, so the three can be joined; `inside` is every trace line the call wrote (§2e); `service` is what the outside service said beyond its HTTP status (below) |

Every agent event carries the `agent_id` of the agent it came from; the activity
log splits on it into one tab per agent (`frontend/src/logs/agents.ts`).

At each message end, the message's text is appended to the agent's output (the
run's `output` is each agent's, under a `[<agent>]` header) and its token
usage is added to a running total (the last turn alone would understate cost by an
order of magnitude). Its `responseId` — OpenRouter's `gen-…` id — starts a billed-cost
lookup in the background, so by the end of the run only the last turn's is pending.

### Step 6 — the run is settled (`agent/run-settlement.ts` `settle()`)

*Superseded 2026-09-30: the short path.* A passing `finish` used to settle the run
at once. Now each `finish` only ends its agent, and the run is settled when the
last agent has ended:

0a. **Retry, up to three times, per agent** (`AgentDriver.resumeDropped()`, `backoffMs()`): if the
   agent ended with an `errorMessage`, you did not press Stop, and pi-ai's
   `isRetryableAssistantError` calls it transient, the run waits and is prompted to
   carry on — the message says the last turn's connection dropped and that the tool
   results above still stand. Event `run.resumed` with `attempt` and `delay_ms`.
   **Each retry first moves to the next model in `MRA_BACKUP_MODELS`**
   (`ModelChain.failover`, which sets `agent.state.model`), and `run.resumed`
   carries `from` and `to`. Once the list is used up, the remaining retries stay on
   the last model. Why: on run `72c65135` (2026-09-27) GLM-5.3 Flash on Relace
   timed out four times running at the same step, so retrying the same model only
   repeated the failure. The failed turn is still redone from its start: pi-ai
   drops a failed answer before sending, so the backup never sees it (§2b).
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

0b. **Superseded 2026-09-29: the one nudge.** A run with no packet used to get one
   more turn, tools off, asking it to write the packet. It existed because the
   findings lived only in the model's context. They are in the ledger now, so there
   is nothing to ask for: the run is settled from what it recorded (step 3).
1. `output` (all assistant text, in order), `usage` and `ended_at` are saved.
2. **Stop:** `cancelled` (with the error, if there was one). **Error with an empty
   ledger** (no live row and no review pulled): `failed`.
3. **Settle from the ledger** (`settleFromLedger()`): **every agent's own
   `DoneCheck` runs again** on the final ledger, its problems prefixed with the
   agent (`category: gap list is empty; …`), and `PacketAssembly` builds the packet
   from every live row, which `PacketValidator` checks against the run's scope.
   The first is there because the second alone let a broken part through: a
   category agent that recorded no gap still settled `completed`, because the
   product agent's gaps made the packet's gap list non-empty (found by the test
   "settles invalid when one agent's part breaks the contract"). A pass is `completed` with `packet_source =
   "ledger"`; if the agent had also errored, `run.ended_early {error}` records it —
   the artefact is valid even though the turn was not. A failure is `invalid` with
   the problems, or `failed` if the agent had errored (a crash that left an
   unfinished ledger is a crash, not a contract failure). This is what run
   `8a02bed6` needed: four calls cut at ~304 s by GMICloud lost the reply that was
   to hold the packet, while everything it had found was already known.

   **Superseded 2026-09-29: extracting the packet from `output`.** `PacketExtractor`
   scanned fences and balanced braces for the last JSON object with a `stage` key
   (fences drift: a HappyWags run's stray fence hid a 47k-character packet outside
   every block). With no packet in the text, the extractor is deleted.
4. **Validate** (in `finish` and in step 3 alike): `stagePacketSchema` — every
   object `.strict()`. Per-row shape and scope were already checked when each row
   was written; what remains are the cross-object rules. A run that
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
   - `competitors` marked complete needs two saturation curves, one with
     `class: "direct"` and one with `class: "indirect"` (§2c). `product_data` and
     `category_data` are checklists and need none (since 2026-09-30);
   - competitor rows obey the §2.2 test (§2c): `relation` is recomputed from the
     forms — **except where both are `other`**, the escape hatch for anything the
     supplement vocabulary does not cover, where the agent's label stands and
     `form_as_printed` is required on both sides as the evidence for it;
     `shared_actives` must be picks from the champion's `actives`, copied word for
     word (`SharedActives`, checked when the row is recorded and again at `finish`
     and settlement); the competitor's own actives keep its page's wording and are
     not compared. *Superseded 2026-10-01:* `shared_actives` had to appear, after
     lowercasing, in both the row's actives and the reference's. On runs `c0f14d91`
     and `bb89e90a` the champion wrote "mullein leaf extract (wildcrafted mullein
     leaf)" and every competitor page "mullein leaf extract": one run ended `invalid`,
     the other passed only after the agent rewrote 30 competitors' actives into the
     champion's label. Which of the champion's actives a product contains is now the
     judgement of the agent that read its page; `competitor_reference` must exist once any competitor does, and
     `ad_source_ids` must point at `ad_library` sources.
5. **Invalid** → status `invalid` with the reason, event `packet.invalid`.
   **Valid** → status `completed`, packet stored, judgement `applied_count`s bumped,
   events `packet.ready {sources, excerpts, gaps, via}` and `run.completed`.
6. **Billed cost** — whatever the outcome (a failed or cancelled run was still
   charged), the per-turn lookups are awaited and summed into `usage.billed`, and a
   `run.billed` event is sent. This happens *after* the status is final, so a slow
   `/generation` never delays it; it can hold the SSE stream open up to ~30s.
7. Every SSE subscriber gets an end-of-stream, and the run leaves the in-memory
   live map.

### §2a — what a run costs

*Since 2026-10-03 the cockpit shows only billed and listed figures, per agent
(`GET /runs/:id/costs`, below); the calculated LLM cost is no longer stored on a
run or a call, nor shown. The first bullet is kept for the review analysis, which
still prices its own calls this way (`cost_usd`), and as the record of why it was
dropped: an estimate at list price, not what was charged.*

- **Calculated cost, research runs no longer** — pi-ai prices every turn from `model.cost` ×
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
- **Every other service, per agent** — each paid tool call writes one row to
  `research_charges` as it returns (`RunMeter`, `agent/run-meter.ts`), tagged with
  the agent whose tool made it, or `agent_id` null for code with no agent (the
  Amazon listing lookup after stage 1, review mining). The wrappers that write
  them are in `adapters/metered.ts`, built per agent by `ToolRegistry`; Apify's is
  `MeteredActorRunner`. `basis` says how the figure was arrived at: Apify
  **billed** (`usageUsd` per actor run); Parallel **listed** — it reports units
  (`usage: [{"name":"sku_search","count":1}]` on a search; a Task run reports
  only its processor), priced from `Settings.prices`; Trendtrack **credits**
  (`x-credits-used` header) valued per credit; a page **listed** under whichever
  reader served it (Crawl4AI $0, Firecrawl unpriced until measured, Parallel
  Extract its list price). `GET /runs/:id/costs` (`CostReports`,
  `extract/cost-reports.ts`) returns one row per agent with a column for each
  service its tools can spend in, a `run` row, and totals; the LLM column is the
  sum of the agent's billed calls, "billed N of M turns" while some are pending.
  The rail shows the table; each agent's tab on the logs page shows its row.
  Prices and their sources: `spec-research-agent-factory.md` §8.3.
- **Where a call's time went** — the same `/generation` record also carries
  `model` (the one that actually answered — not always the one asked for, once
  OpenRouter falls back), `latency` (time to the first token), `generation_time`,
  `native_tokens_reasoning` and `provider_name`. Since 2026-09-27 the lookup keeps them with the charge, as
  the call's `generation` (`OpenRouterGeneration`,
  `adapters/openrouter-generation.ts`). They cost no extra request. `generation_time` **includes**
  `latency`: on local run `b6f0d355` (2026-09-27) call 6 took 15.0s by our clock,
  `generation_time` 14.9s and `latency` 11.1s — 11.1s before the first token,
  then 3.8s streaming. So streaming time is `generation_ms − latency_ms`, which is
  what the logs page shows. On the Mullein run `5dbd1714` (glm-5.3-flash on
  Parasail) the first token took 0.9–2.6s, and the 252s packet-writing call was
  1.8s to the first token, then 250.3s streaming 37,199 tokens, 18,191 of them
  reasoning. OpenRouter routes each call separately: `b6f0d355`'s calls went to
  Relace and Together. OpenRouter counts reasoning tokens but does not time them, so
  the thinking-versus-writing split within a call is an estimate from the token
  shares.

Neither includes Apify, which bills separately per event.

### §2b — per-node runs, and the LLM call log

**A run on one node** (or any subset) differs from a whole-stage run in four places,
all keyed off the run's `nodes`:

- **Agents** (`StageOnePlans.of`). Only the covered nodes' agents start. The
  champion starts too unless the brief is a url and `competitors` is not covered —
  so `mra run "<url>" product_data` (or `category_data`) is the run that spends
  nothing on Apify. *Superseded 2026-09-30:* one agent covered every node in scope,
  and its prompt carried a `## Scope of this run` section. Each agent now has one
  node and is told only that node's task.
- **Tools.** `amazon_find_product` is offered to the `champion` and `competitors`
  agents only. The system prompt describes exactly the tools offered.
- **Validation** (`extract/`). Any source, excerpt, measurement, attribute,
  saturation curve, node or gap recorded against a node outside the scope fails the
  packet (`invalid`, naming the node and the count). So does a covered node with no
  `nodes[]` entry. The worked example shows all four nodes, so copying it is the
  mistake this catches. A whole-stage run is validated exactly as before.
- **Display.** The stage rail greys out the nodes a run did not cover, the run list
  labels a partial run, and the results column shows that run's packet as usual.

**The call log.** `LlmCallLog` wraps each agent's `streamFn` — the one place
that sees the context handed to pi-ai and the exact message returned, error
responses included. The context is recorded *before* pi-ai converts it for the
provider, and that conversion drops one kind of message: an assistant answer that
ended in `error` or `aborted` (`pi-ai/dist/api/transform-messages.js`, the skip
at "Skip errored/aborted assistant messages entirely"). So after a dropped stream,
the retry's logged input includes the failed answer, but the model never received
it. Measured on run `72c65135` (2026-09-27): call 16's input held call 15's
65,132-character failed answer, and call 16 rebuilt the same plan from scratch in
99,418 characters. The activity page marks such a message "dropped by pi-ai, not
sent to the model". Each call becomes a `research_llm_calls` row: the
`agent_id` that made it, `seq` numbered across the whole run by one `CallSequence`
(a per-agent count would give four calls `seq` 1), start/end time, duration, model, stop reason, error, usage (tokens; no dollar figure since 2026-10-03), the
`gen-…` id, and — once `/generation` answers — `billed_cost` and `generation`
(§2a: time to first token, generation time, reasoning tokens, provider). The logs
page shows the time to the first token on each row, and the rest on an
"OpenRouter:" line under the answer.

Storage is **incremental**, per agent. Each agent only appends to its own context, and pi-agent-core's
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
tab. Its cards follow the selected tab (`CallStats`, `stats.agents`): the run tab
shows the whole run, an agent's tab only that agent — its LLM calls, its time from
`agent.started` to `agent.ended`, the time its model was working, tokens,
OpenRouter's billed cost, every service's cost from `/costs` with the per-service
row under it, and its tool calls. The run tab's model time counts a minute once
however many agents had a call in flight then (until 2026-10-03 it summed every
call, so three agents side by side showed more model time than wall time); then **one tab per agent** plus a `run` tab of milestones
(`logs/agents.ts`), opened on the first agent; under the tab, one row per call: expand it for the prompt (what is new, or
**Show full prompt**) and the answer (thinking, text, tool calls with arguments,
token counts, cost). It follows the event stream and fetches only calls it has not
got (`?after=<seq>`), then refetches everything once `run.billed` lands, because the
billed costs arrive on calls it already has.

### §2c — competitors: direct and indirect

`spec-stage-1.md` §2.2, since 2026-10-01: a competitor is any product sold to the
champion's customer — its `icp`, the people and the problem its own page names —
in the brief's markets, whatever its actives. A **direct** one has the champion's
form; an **indirect** one has another. A baby diaper cream with zinc oxide is not a
competitor of an adult skin-fold cream with zinc oxide; a skin-fold soap with no
ingredient in common is. Before that day a competitor had to share an active, and
a brand with a different one was gapped as "same problem, different active".

Code checks what it can: the champion's `icp` and each competitor's
`icp_as_printed` are non-empty (`CompetitorIcp`, refused at `record_competitor`
and again at `finish`), `shared_actives` are picks from the champion's list
(possibly none), and `relation` agrees with the forms. Whether the two customers
match is the agent's call, with both quotes on the row.

The packet carries this as two things (`domain/packet.ts`):

- `competitor_reference` — the product being compared against, read off its own
  page: `name`, `form`, `form_as_printed`, `actives` (normalised names), `icp`, `source_id`.
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

### §2d — stage 3, review mining: a pipeline, and a review ledger no model copies from

Review mining was stage 2 until 2026-10-01 and is stage 3 since; the class
names below are the ones from before the rename (`StageTwoX` is now
`ReviewMiningX`, `StageTwoHandoff` is `StageOneHandoff`).

**Since 2026-09-30 review mining has no model** (`spec-stage-2-pipeline.md`).
`RunLauncher` hands a `review_mining` run to `ReviewMiningJob`, which first
records on the run the stage-1 run whose competitors it mines
(`research_runs.source_run_id`, from `StageTwoHandoff.forBrief`: the newest
completed stage-1 run for the brief). The review analysis and the run page read
that link (`StageTwoHandoff.forRun`); nothing re-derives it later, so a newer
stage-1 run never adopts older mining.

1. The stage-1 roster (`StageTwoRoster`) and its listings, re-judged
   (`StageTwoListings.ensure`, which looks up only what stage 1 did not).
2. `StageTwoOffer`: each target is mined on Amazon (five star bands) if it has a
   matched listing, else on Trustpilot if it has its own domain (`TrustpilotDomain`:
   a host carrying its brand; the champion's is the brief's host), else not at all.
   Two targets on one listing mine nothing from it, and both get a gap.
3. `ReviewPuller` runs the pulls through the shared Apify queue. A transient
   failure (a throw, or a run ending `FAILED`/`TIMED-OUT`/`ABORTED` with nothing)
   is retried once after 10 s (`MRA_APIFY_PULL_RETRIES`); an absent band is not;
   a 402 stops the pulls not yet started. A run still `RUNNING` when the 300 s wait
   ends is waited on again, not restarted (`ApifyActorRunner`). Stop keeps the
   pulls already done.
4. `ReviewFiling` archives each pull and files it in the `ReviewLedger` below;
   `StageTwoPacket` computes the packet (per-listing totals as measurements, the
   gaps, and `review_mining` `complete` when every mined target has a 3★ review);
   `StageTwoSettlement` validates it and ends the run with `packet_source =
   "pipeline"`. Stage 2 needs no saturation curve and may have no gaps.

The cockpit sees a `tool.started` / `tool.completed` pair per pull, as before.

**Superseded 2026-09-30: stage 2 as an agent.** Run `f1b67523`'s mining took
3 min 52 s; its last model call then reasoned for 2,233 s (332,947 reasoning
tokens) without output and was stopped. What follows is the review ledger, which
stays; its first measurement is from the agent era.

Measured on run `1d2ad3f2` (2026-09-25): `mine_reviews` returned 216 reviews as
text, and the model then spent **720s and 78,225 output tokens** (55,063 of them
reasoning) in one call retyping them into the packet. It kept 81 of the 216,
dropped 7 characters from one source hash, and wrote a `captured_at` a week before
the run happened. The packet still failed with 9 problems.

So the reviews never pass through the model at all:

1. Each pull is archived, then every review filed in the run's `ReviewLedger`
   (`agent/review-ledger.ts`; since 2026-09-30 by `ReviewFiling`). The
   ledger gives each pull a handle `pN`, and each review a ref `rN.M`,
   deduplicated on (platform, platform review id). The pulls run in
   parallel but are filed in the order they were asked for, so refs do not
   depend on network timing. A review the actor returns off the band requested
   is **kept under its own rating** (`adapters/apify/band-filing.ts`); only a
   band with nothing at its own rating becomes a gap.
2. The model sees counts per pull, handles and gaps, never review text. It
   records no review sources and no review excerpts; its measurements and
   saturation points cite pull handles.
3. `PacketValidator` (`extract/validator.ts`) takes the ledger snapshot. Before
   checking, `ReviewAssembly` (`extract/review-assembly.ts`) adds one source per
   pull and one excerpt per review, verbatim, and swaps handles for hashes.
   `finish` and the run's ending (`ReviewMiningRunAssembly`) use the same class, so they cannot disagree.
4. Reviews are stored **raw**: `axis` null, `themes` empty. Coding them, and
   screening reviews about a different product, belong to a later stage.
5. When the run ends, however it ends, `RunWatch` saves the ledger to SQLite:
   `research_reviews` (one row per real review across all runs) and
   `research_run_reviews` (which run pulled it, under which ref and pull). A
   process restart mid-run still loses that run's reviews, because nothing is
   written before the end.

**A wrong turn, recorded:** the first version kept three-axis coding and had the
model code every review through `read_reviews` / `code_reviews`, 40 per page. On
run `5aa4d71e` (12 listings × 5 bands + 11 Trustpilot merchants = 2,658 reviews)
that was about 67 sequential turns at an average of 28s each. Copying had gone,
but a serial per-review step had replaced it. Removed the same day.

### §2e — the run trace: watching the code instead of reading it

Every server function writes one line when it is called, and every outbound HTTP
request writes two: `→` when it leaves and `←` when the response headers come
back. The lines go to `/data/traces/<runId>.log`, one file per run; anything
outside a run (startup, the browser polling, the six-hourly price refresh) goes
to `process.log`. Download it with **Download trace** on the activity page, or
`mra trace <id>`.

A web search, from a real run on 2026-09-27 (lines cut at the right):

```
22:47:14.723 +00:07.936 [agent/tools/web-search-tool.ts] WebSearchTool.tool.execute params={max_results,query}
22:47:14.724 +00:07.937 [adapters/searxng.ts] Searxng.find query="Pure Encapsulations Magnesium Glycinate 90 capsules product page" maxResults=10
22:47:14.724 +00:07.937 [adapters/http.ts] Http.withTimeout url="http://searxng:8080/search?q=…&format=json" …
22:47:14.725 +00:07.938 [trace/wire-tap.ts] → GET searxng:8080/search?q=Pure+Encapsulations+…&format=json
```

Read each line as: clock time, time since the run started, the file (relative to
`server/src`), `Class.method`, then the arguments as `name=value`. Strings are cut
at 120 characters with the full length in brackets. A small flat object shows its
values (`{url:https://…}`); a larger one shows only its keys (`{method,headers,body}`);
an array shows its length (`[3]`); a class instance shows its class name. Any name
matching `key|token|secret|password|authorization|cookie` is written `***`, in fields
and in URL query strings alike.

**How it works.** `Trace` (`trace/trace.ts`) is static. It knows which run a
line belongs to from Node's `AsyncLocalStorage`: `RunLauncher.launch` wraps the
agent's assembly in `Trace.within(runId, …)`, and every promise, timer and tool
call started inside inherits that run. The first line of each run file is that
call's header: run id, product, url, model, nodes. The wire lines need no code at
the call sites. `trace/wire-tap.ts` subscribes to Node's own `diagnostics_channel`
events: undici's for `fetch` (OpenRouter through pi-ai, Firecrawl, SearXNG) and
`http.client.*` for the `http` module (Apify, whose client uses axios). The
response event fires in the socket's context, not the caller's, so the tap
captures the run context when the request starts and writes the `←` line inside
it.

**Lines inside a tool call carry its id.** `ResearchAgentFactory` wraps every tool
(`TracedTool`), so each call runs in its own nested scope,
`Trace.withinTool(toolCallId, …)`. Every line written inside it — the tool's own
functions, the adapter it calls, and the `→`/`←` lines of each HTTP request it
sends — is written as `… +00:07.936 <call_5e4b…> [adapters/searxng.ts] …`, and is
also kept (up to 300) and sent on that call's `tool.completed` event as `inside`.
That is what the activity page's *Inside the tool* shows. Keeping lines does not
depend on the trace file: a tool call collects them even where no sink is
installed. Two calls running at once keep theirs apart, because each request's
`←` line is written back in the context that sent it.

**What a service says beyond its status: `service`.** A request can come back
200 and still have partly failed. SearXNG is the case that prompted this: it
asks several search engines and answers 200 as long as one of them did, listing
the rest under `unresponsive_engines`. `Searxng.find` now returns that as a
`ServiceReport` (`domain/service-report.ts`): each engine that answered with its
result count, each that did not with SearXNG's reason, and an outcome — `ok`,
`degraded` (some failed), or `failed` (no results and at least one engine
failed). Measured on local run `424c91a9` (2026-09-27): every search was
`degraded` — Google CSE 20 results, Brave "too many requests", DuckDuckGo
"CAPTCHA". The report went to the page only; what the model read was unchanged,
so a `failed` search reached it as "No results" — which is how run `8e627d92`
(Healora, 2026-10-01) lost every competitor search and found its competitors on
Amazon alone. SearXNG was removed that day; search is Parallel, which throws
when it can answer nothing, so the model sees an error instead. Firecrawl and
Apify do not report yet. `Firecrawl.scrape` reads only the page title from Firecrawl's
metadata, so whether the site itself served the page is not checked (see "A bot
wall is not detected on `web_fetch`" below); what Firecrawl sends back for a
refused page has not been measured here.

**`×N` lines are counts, not calls.** Functions that run once per streamed chunk
of model output, or once per row in a loop, use `Trace.tick`. That is counted
rather than written, and the count is written as one line, e.g.
`AgentEventRecorder.record type=message_update ×412`, either before the next
ordinary line or once it is five seconds old. A long model turn therefore shows
as a `×N` line every five seconds. Before ticks, a 14-minute one-node run wrote
11,575 lines, 8,025 of them `AgentEventRecorder.record`.

**`ms` on a `←` line is time to headers, not to the end of the body.** For a
streamed model call the stream continues after that line. The turn really ends
at the next non-tick line.

**What it showed on its first real run.** Run `3e2751cc…` failed with only
`Connection error.` The trace's last 30 seconds:

```
23:00:24.833 +13:18.046 [trace/wire-tap.ts] ← POST openrouter.ai/api/v1/chat/completions status="error getaddrinfo EAI_AGAIN openrouter.ai" ms=5006
```

This line appears four times, 5 seconds apart. That is pi-ai's retry budget
spent on a DNS lookup that was failing inside the container, not a bug in the
run. The same file showed that the last successful model call's headers arrived
at `+04:27` and its chunks were still streaming at `+11:17`: one turn of
`z-ai/glm-5.3-flash` took about seven minutes.

**The rule that keeps it complete.** `tests/trace-coverage.ts` is run by the
architecture test. It requires every class method, constructor with a body,
accessor, arrow-function field, and object-literal method (such as each tool's
`execute`) to start with exactly one `Trace.line` or `Trace.tick`, naming itself
as `Class.method`. Nested object-literal methods are named after their owner, e.g.
`WebFetchTool.tool.execute`. Callbacks passed inline (`.map((r) => …)`) are not
covered, and neither are route handlers. `App.request` writes one line per HTTP
request in their place.

### §2f — stage 2, product truth: five agents, and code that does the arithmetic

Plan and decisions: `spec-stage-2-product-truth.md` (§10 is where the build
departs from the plan). A stage-2 request (any of `mechanism`, `dose_vs_study`,
`claim_limits`, `cogs_refills`; it always expands to all four) goes to
`RunLauncher`, which asks `StageOneHandoff.forBrief` for the newest **completed**
stage-1 run of the brief (409 at the route if there is none), records it as
`source_run_id`, and starts `ProductTruthRun`.

1. **The operator's inputs go into the ledger first** (`agent/operator-inputs.ts`,
   `agent_id: "operator"`): landed cost and currency, MOQ, lead time, as typed,
   a gap for each one left blank, and any prices added as `price_point` rows
   citing `"operator"`.
2. **Five agents on one ledger**, each started by `AgentTeam` once the agents in
   its `after` list have ended (`domain/product-truth-agents.ts`): `formula`
   (actives with amounts, and the regimen) → `mechanism` beside `dose_vs_study`
   → `claim_limits` after `dose_vs_study`, `cogs_refills` after `mechanism`. Each
   gets the stage-1 fact sheet in its prompt; the later ones also get the actives,
   and `claim_limits` gets the dose classes, computed when it is built
   (`agent/prompt/truth-builder.ts`). Their tools are Parallel-backed
   (`setup.md` §5c): `web_search` returns archived, citable excerpts.
3. **Rows are checked when written**: the row's schema, a recorded active or a
   brief's market for a pick, and the label's unit for a studied dose
   (`extract/row-picks.ts`).
4. **`finish` checks open items** (`extract/product-truth-coverage.ts`): each
   item is closed by its row or by a gap whose `missing` starts with the item's
   key, plus every row citing a recorded source. At the turn limit, every open
   item is gapped for the agent (`agent/truth-limit-close.ts`).
5. **Settlement** (`agent/product-truth-settlement.ts`) re-runs every agent's
   check, retracts rows citing nothing read into gaps (`RowRepair`), marks each
   node complete when every item of its agents is recorded or gapped, and builds
   the packet (`extract/product-truth-assembly.ts`). Code computes the dose class
   (`extract/dose-bands.ts`: ours per day = amount per serving × servings per
   day; ≥ 0.8 at dose, ≥ 0.5 partial, else under dose; blend, no amount, no study,
   no human study or unknown servings ⇒ unassessable, each with its reason),
   days of supply, the churn flag (a carrier active's time to effect longer than
   a container lasts), and margins (`extract/product-economics.ts`). The packet
   is stored whether the run completes or ends invalid.

**Measured on run `8d3842e0`** (local, 2026-10-01, Mullevia on stage-1 run
`c0f14d91`, markets US, UK, Australia, New Zealand, Canada, no operator inputs,
model `z-ai/glm-5.3-flash`): `completed`, all four nodes complete, in
**18 min 34 s** (11:24:15 → 11:42:49 UTC). 39 model turns: formula 7,
mechanism 11, dose_vs_study 2, claim_limits 11, cogs_refills 8, none at its
limit. 2.26M tokens; **billed $0.1611** by OpenRouter (39 of 39 turns resolved,
31 s after the run ended). Parallel: **22 searches and 49 extracts**, counted
from `ParallelApi.post` in the trace; no fallback to SearXNG or Crawl4AI. At
Parallel's listed $1–5 per 1,000 searches and $1 per 1,000 extracts, that is
about **$0.07–0.16**, under the spec's $0.35–0.70 estimate. What it found:
5 actives, all in a blend with no amount stated, so all 5 **unassessable**;
2 servings a day, servings per container gapped, so days of supply and the
churn flag are not assessable; mullein recorded as the carrier, with no time to
effect any source states; 10 of 10 market × platform claim limits; 15 prices
(1, 3 and 5 bottles in 5 currencies), with every margin gapped for want of a
landed cost; 39 sources, 17 gaps.

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
- **A restart kills a live run.** The agent lives in this process. On startup
  `recoverRunsKilledByRestart()` ends anything left `running`/`queued`/`stopping`
  through `RunEnd` (`agent/run-end.ts`): the ledger is assembled and the packet
  stored, then the run is marked `failed`, so a stage-1 or stage-2 run a deploy
  killed still shows what its agents recorded. A review-mining run's reviews are
  held in memory and are lost.
- **Billing is lost for a run killed by a restart.** The lookups live in the
  process; a run ended by `recoverRunsKilledByRestart()` has no `usage.billed`.
- *Fixed 2026-09-18:* the cockpit's "Tokens" line was always "—". The server sends
  `usage` as `{input, output, cacheRead, totalTokens, cost: {...}}`; `RunView.tsx`
  read `usage.total_tokens`, and `frontend/src/api.ts` declared that field too (optional), so
  `tsc` could not catch it. Both now use pi-ai's field names, and the cockpit also
  shows the billed cost (§2a).

---

## 3. Endpoints

All bodies are JSON unless stated. Every error is `{"detail": "<message>"}` with a
4xx/5xx status.

### Auth — `http/auth-gate.ts`

#### `GET /api/auth/session`

- **In:** the `mra_session` cookie, if any.
- **Out:** `{"authenticated": bool, "user": string|null, "workspace": string, "is_admin": bool, "auth_required": bool}`
  (`workspace` and `is_admin` only when authenticated).
  With auth disabled: `{"authenticated": true, "user": "ash", "workspace": "admin", "is_admin": true, "auth_required": false}`.

#### `POST /api/auth/login`

- **In:** `{"username": string, "password": string}`.
- **Out:** `200 {"user": "<name>"}` and sets `mra_session` — an httpOnly, SameSite=Lax
  JWT valid for `MRA_SESSION_HOURS` (720), `Secure` unless `MRA_COOKIE_SECURE=false`.
  The JWT holds the account id and its `token_version`; a request whose version no
  longer matches the account is unauthenticated.
  Wrong credentials or a disabled account: `401 {"detail": "invalid credentials"}`.
  Auth disabled: `400`. Five failures from one address (rightmost
  `X-Forwarded-For`) inside 15 minutes: `429` with `Retry-After`, whatever the password.

#### `POST /api/auth/logout`

- **In:** nothing.
- **Out:** `{"ok": true}`, cookie cleared, and the account's `token_version` bumped —
  every copy of that user's cookie, on every device, stops working.

#### `GET /api/health`

- **In:** nothing; no auth.
- **Out:** `{"status": "ok"}`. The Docker healthcheck calls this.

### Research — `http/research-api.ts`, all behind the session check (`401 {"detail": "not authenticated"}`)

Everything below is scoped to the caller's workspace: lists hold only its runs and
products (every workspace's, for the admin), a run or product outside it is `404`,
and `/judgements` is always the caller's own workspace's, the admin's included.

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
  That is the real Mullein record, from before §2a. A run since 2026-10-03 carries
  no `cost` and no `pricing` in `usage`, only token counts and, once the lookups
  finish, `usage.billed: {total, turns, resolved}`.
  `nodes` is always spelled out: a run from before per-node runs has `[]` in the
  database and is reported as all four, which is what it was.
  `status` is one of `queued`, `running`, `stopping`, `completed`, `invalid`,
  `failed`, `cancelled`. The last four are terminal.

#### `POST /api/research/runs` — start a run

- **In:**
  ```json
  {"brief": {"product": "Mullein", "market": "UK", "url": "", "notes": ""},
   "reject_kinds": [],
   "nodes": []}
  ```
  **A url typed as the product is moved to `url`.** `Briefs.normalise()`
  (`domain/brief.ts`) runs on every POST: if `brief.product` looks like a url — a bare
  `example.com` or a full `https://…`, no spaces — it is moved into `brief.url`
  (adding `https://` if missing) and `product` is left **empty**. `product` is a
  name; a url never belongs in it. Either field satisfies the request, so
  `{"brief": {"url": "https://…"}}` is valid, and only a brief with neither is a
  `400`. `notes` is accepted and reaches the prompt. There is no `model`: the model is
  `MRA_MODEL` from `.env`, and sending the key is a `400`. Empty
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
    `domain/packet.ts`: `contract_version, stage, run_id, brief, sources[], excerpts[],
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
  Delivery to a subscriber is best-effort: every event is written to SQLite
  *before* it is pushed, so a browser that throws or cannot keep up loses live
  frames, never events, and picks them up again on reconnect with `?after=`.
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
  | `tool.started` | `{tool, tool_call_id, preview, lane}` |
  | `tool.completed` | `{tool, tool_call_id, error, error_text?, lane, inside: [{at, file, name, fields}], service?: {service, outcome, parts}}` |
  | `run.steered` | `{judgement_id, text}` |
  | `run.stopping` | `{}` |
  | `run.nudged` | `{reason}` — runs before 2026-09-29 only: the run ended without a packet and was asked once more |
  | `run.resumed` | `{error, attempt, delay_ms, from?, to?}` — the model stream dropped and the run was continued after a backoff; `from`/`to` when it moved to the next backup model |
  | `run.completed` | `{usage}` |
  | `run.billed` | `{billed: {total, turns, resolved}}` — after the terminal event |
  | `packet.checked` | `{valid, problems[]}` — one per `finish` call; a failed check is the loop working, not an error |
  | `packet.ready` | `{sources, excerpts, gaps, via}` — `via: "finish"` when the agent's `finish` passed, `"ledger"` when the run was settled from its ledger on its behalf, `"pipeline"` for stage 2 |
  | `packet.listings` | `{total, matched}` or `{error}` — after a completed competitors run, the Amazon listing lookup (§2 Step 5) |
  | `run.ended_early` | `{error}` — the run died, but its ledger already made a valid packet; the packet stands |
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
  response_id, billed_cost, generation}`, where `generation` is `{cost, latency_ms,
  generation_ms, reasoning_tokens, provider}` or `null` until `/generation` answers
  (and on every call from before 2026-09-27). `input` holds only the messages new since the previous
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

#### `GET /api/research/runs/:runId/trace` — the run trace

- **Out:** `200 text/plain` with `Content-Disposition: attachment;
  filename="run-<id>-trace.log"`: the file described in §2e, as written so far,
  so it works mid-run. `404 {"detail": "no trace for this run"}` when there is no
  file (a run from before traces, or one pruned after `MRA_TRACE_KEEP_DAYS`).
  Scoped to the caller's workspace by `ScopeGuard`, like every `/runs/:runId/*` path.

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

### Everything else — `http/frontend.ts`'s `Frontend`

#### `GET /*`

- A real file under the built SPA (`/app/static`) is served with its content type.
- Anything under `api/` or `assets/` that did not match, or any path whose last
  segment has a dot, is a JSON `404` — never `index.html`, so a failed API call
  cannot come back as HTML with a 200.
- Everything else gets `index.html` with `Cache-Control: no-store`, so a browser
  never holds a shell pointing at assets from an older build. That includes
  `/runs/<id>/logs`: the SPA reads the path and renders the logs page (`App.tsx`).
