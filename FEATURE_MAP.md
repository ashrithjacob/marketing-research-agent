# Feature map — what is on the screen, and what it calls

This file exists so that a screenshot with three question marks under it is
enough to act on. It maps every surface in the cockpit to the component that
renders it, the endpoint behind it, and what it looks like when that endpoint
is the thing that is broken.

It is deliberately about the **UI**. `workings.md` §3 documents the endpoints
themselves — request, response, and what each field means — and is the better
file once you know which endpoint you are asking about. This one gets you
there from "the page went blank".

Keep it true. A new page or button that is not here will be guessed at.

---

## Reaching it

| Where | URL | Auth |
|---|---|---|
| Live | https://marketing.vanis.ai | login, unless `MRA_APP_PASSWORD_HASH` is empty |
| Local | http://localhost:8080 after `mra up` | usually none — the hash is normally empty locally, which disables login entirely |

Two routes exist, both served by the same SPA (`app.ts` `mountFrontend` sends
`index.html` for anything that is not `/api/*`):

- `/` — the cockpit
- `/runs/:runId/logs` — the activity log for one run (`api.logsUrl`)

---

## URLs

Real URLs over one React app (`route.tsx`, the History API; no router library).
The server returns `index.html` for any path that is not a file or `api/`, so
every URL survives a reload, a bookmark and the back button.

| URL | Page |
|---|---|
| `/` | Products: one card per product (`ProductsPage.tsx`) |
| `/products/:productId` | That product's dashboard, on its default run |
| `/products/:productId/runs/:runId` | That product's dashboard, on that run |
| `/runs/:runId/logs` | The activity log (below) |

Anything else renders *No page here*; an unknown product id renders the same,
under a `no such product` banner.

## The cockpit shell (`App.tsx`)

**Header.** `research cockpit` (a link to `/`), then the active run's brief as a chip and a
clock chip, then the buttons: **Step in** (ghost), **Stop** (ghost, only while a
run is live), **Start run** (primary), a `user · workspace` chip (only when login
is on), **Sign out** (ghost). Signed in as the admin, each run row in a product
folder also names its workspace.

| Control | Calls | Broken looks like |
|---|---|---|
| Start run | opens the modal; no request yet | — |
| Stop | `POST /api/research/runs/:id/stop` | button does nothing, run stays `running` |
| Sign out | `POST /api/auth/logout` | stays logged in, or bounces to login and back |
| `user · workspace` chip | `GET /api/auth/session` | missing while logged in: the session answer lacks `workspace` |
| (on `/`) | `GET /api/research/products`, `GET /api/research/config` | `Loading products…` that never ends |
| (on a product) | `GET /api/research/products/:id` and `…/:id/runs` | `Loading product…` that never ends |

`Loading…` in a bare `.boot` div means `GET /api/auth/session` has not
answered — the server is down or the cookie is being rejected, not a UI bug.

### The start-run modal (`StartRun.tsx`)

Opened by **Start run**. Fields: a product box (`Product name, or the site's
URL`), a **Markets** fieldset of checkboxes, a free-text market box
(`Also / instead (e.g. Ireland, Germany)`), then **Cancel** / **Start run**.

Submitting calls `POST /api/research/runs` with `{brief, nodes}`.

> **A URL typed here is a URL.** The client detects it and fills `brief.url`,
> leaving `brief.product` for the agent to discover from the page. A URL that
> ends up in `brief.product` makes the agent search the web for the literal
> string `https://...`, and it comes back with a confidently wrong product —
> this is the bug behind "why does it always go for magnesium". If a run's
> packet names a product that is not yours, check `brief` first, before the
> prompt.

### Product truth's start (`ProductTruthStart.tsx`)

Opened by **Start stage 2 →** (rail or the Now panel's next-stage strip) or any
stage-2 ▶ — product truth always runs all four of its nodes. Fields: landed cost
per unit and its currency, MOQ, lead time in days, and **Add a price** rows
(label, amount, currency, units, subscription). Every field may stay blank: a
blank cost is written to the ledger as a gap (`agent/operator-inputs.ts`), and
the margins it would feed show `—` with "no landed unit cost was entered", never
an estimate. Submitting sends `POST /api/research/runs` with
`{brief, nodes: [the four], inputs}`. A 409 here means no completed stage 1 for
this brief.

### The review-mining go-ahead (`ReviewMiningPlan.tsx`)

Opened by **Start stage 3 →** or the review-mining ▶. It says *not ready* until
product truth has completed on the same stage-1 run. Lists what review mining can
mine (`plan.offered`, from `POST /review-mining/plan`) with checkboxes and the Apify
estimate. Each target shows its brand-site link and, under it
(`review-mining/ListingLine.tsx`), either its matched Amazon listing — stars, review
count, share of 3★, "bought in past month", best-seller rank, price, Amazon's
Choice, a link — or, for a target mined on Trustpilot, its Trustpilot score and
review count ("★ 4.4 · 12 Trustpilot reviews", "no Trustpilot reviews yet", or
why it could not be read) with a link to the page. A target
two others collided on shows why it is not mined on Amazon. **A target with no
matched listing and no domain of its own is not listed at all** (since 2026-09-30,
`spec-stage-2-pipeline.md` §3a). The listings are normally looked up when stage 1
completes; if they were not (an older run, or no token then), the first open runs
`POST /review-mining/listings`, about $0.01 per target. Approving starts the
review-mining pipeline, which calls no model.

### The stage rail — left column (`StageRail.tsx`)

`Stages`, then one block per stage, each listing its nodes with a dot, a label,
a sparkline (`Curve`), and a **▶** button.

| Node | Label | Stage |
|---|---|---|
| `product_data` | Product data | 1 |
| `competitors` | Competitors | 1 |
| `category_data` | Category data | 1 |
| `mechanism` | Mechanism | 2 |
| `dose_vs_study` | Dose vs study | 2 |
| `claim_limits` | Claim limits | 2 |
| `cogs_refills` | COGS & refills | 2 |
| `review_mining` | Review mining | 3 |

**▶** runs that node on its own — `POST /api/research/runs` with a one-element
`nodes` array — except in stage 2, where any ▶ opens product truth's start and
runs all four. A stage's ▶ is disabled until the stage before it is complete on
the same stage-1 run, with the tooltip *"Stage N builds on stage N−1 — complete
that first"*; that is the intended state, not a broken button. The labels, node
lists and `scopeLabel` live in `stages.ts`; the rail is `StageRail.tsx`.

A stage header (**Stage 1 · Raw material**, **Stage 2 · Product truth**,
**Stage 3 · Review mining**) opens
that stage's run for the same subject, via `onSelectRun`. The header of the
stage the shown run collects is not clickable. **Stages 2 and 3 belong to one
stage-1 run** (`subjectProgress` in `run-view/rail.tsx`): on a stage-1 run, their
state and headers count only runs whose `source_run_id` is that run —
the live one, else the newest completed, else the newest — so a new stage 1 shows
stage 2 as *ready*, with **Start stage 2 →**, even when an older stage 1 was
assessed and mined. Stage 3 shows *ready* only once stage 2 is complete on that
same stage-1 run. On a stage-2 or stage-3 run, the stage-1 header opens its
`source_run_id`. **A stage-2 or stage-3 run whose stage 1 has since been rerun**
(a completed stage-1 run newer than its `source_run_id`) shows its own stage as
*ready — stage 1 was rerun*. A product-truth run adds a warning above its tiles;
a review-mining run adds a banner naming both stage-1 dates with **Start stage
2 →** (product truth on the new stage 1 comes first;
`run-view/outdated-voice.tsx`), and folds its customer voice behind **Show the
older customer voice**: it mined competitors the current stage 1 no longer names.
*Superseded 2026-10-01:* any completed review-mining run of the product counted,
and its stage 1 was guessed by date (`stageOneRunFor`), so a new stage-1 run
showed another run's mining as its own. The ▶ buttons start runs; the headers
only navigate.

A node greyed with the tooltip `not in this run` was simply not in the run's
`nodes`. `—` where a sparkline should be means no curve data, which is normal
for a node that has not run.

### Products — `/` (`ProductsPage.tsx`) and the run list (`ProductRuns.tsx`)

Every run belongs to a stored product (`research_products`). A new run's brief
is reduced by `Briefs.key` and filed under the product with that key, created if
new: a typed name ignores case and punctuation (`vitamin D` = `vitamin_d` =
`VITAMIND`); a URL matches per page, and a URL typed into the product field counts
as that URL. Market is not part of the key, so Vitamin D US and UK share a product.

- **`/`** lists products, newest activity first: label, newest run's status, run
  count, review count (distinct reviews over all its runs). No dashboard here.
- **A product** opens on its `default_run_id`: the newest **completed** run of
  either stage, even when a newer run is running or failed; the newest run when none
  completed. The left column ends with `← All products` and every run of the
  product — completed, failed, cancelled, invalid, running — newest first. Each run
  row, and each stage header in the rail, is a link to that run's URL.

The rail's stage status and headers are computed from the product's runs, all of
them. `GET /api/research/runs` (newest 50, at most 200) still exists, but the
cockpit no longer lists from it.

`GET /api/research/products/:id/rows` returns every fact the product's runs found,
from the packet-row tables, each row tagged with its `run_id`.

### The run view — middle and right (`RunView.tsx`)

Two columns. The left rail carries the stage rail, the run meta, standing
judgements and the run list. The middle column is the insight dashboard: the
Now panel (with the **Activity log ↗** link), then tiles, then the sources
list. There is no right column any more.

The light "Minimalist Modern" theme lives entirely in `styles.css` tokens
(accent `#0052FF`, gradient to `#4D7CFF`; fonts Calistoga / Inter /
JetBrains Mono, loaded in `index.html`).

**Tiles** (`run-view/tile.tsx`, `tiles-data.tsx`, `tiles-market.tsx`). Each
tile shows headline figures collapsed and full values after a click, with that
node's gaps at the bottom of the expanded body (`TileGaps`) — not a single
generic gaps table:

| Tile | Shows | Where its data comes from |
|---|---|---|
| Product data (open by default) | attributes, SVG bars for numeric measurements, excerpts, gaps | packet rows with `node: 'product_data'` |
| Competitors | direct / indirect by form / indirect by active groups, one chip each, each competitor's page it was read off and its ads as citations (`run-view/cite.tsx`), each competitor's site link, the champion's actives it shares (none shown when it shares none), **for:** who its own page says it is for (`icp_as_printed`), and its Amazon listing or "not on Amazon — <why>" (`run-view/amazon-link.tsx`, also on the champion line), social-proof review-count chart, excerpts, gaps | `packet.competitors`, `measurements`, `listings` on `GET /runs/:id` (re-judged by today's matcher on each read) |
| Category data | market-size/CAGR bar charts, every figure with its period, gaps | `measurements` with `node: 'category_data'` |
| Ingredients (stage 2, `run-view/truth/IngredientsTile.tsx`) | one card per active: amount on the label (or "no amount stated"), pathway, time to effect, magnitude, a `carrier` badge on the actives the story rests on | `packet.actives`, `packet.mechanisms` |
| Dose vs study (stage 2) | active · ours per day · studied per day · ratio · class · form match · study; an unassessable row says why | `packet.doses`, computed by `extract/dose-bands.ts` |
| Claim limits (stage 2) | the guard ("not legal advice…"), then per market × Meta / Google Ads: disclaimers, evidence standard, permitted and forbidden claims side by side | `packet.claim_limits` |
| Economics (stage 2) | days of supply, each carrier's time to effect (red when the container runs out first), the churn flag, the operator's costs, the margin at every price | `packet.economics`, computed by `extract/product-economics.ts` |
| Customer voice (stage 3, `run-view/voice/`) | reviews cleaned (duplicates, under three words, off-product), issues ranked worst and best with quotes, product × issue grid, star spread — all filtered by source (all / Amazon / other sites) and group (all / your product / direct / indirect), or one product. Started by **Analyse reviews**; LLM calls only, no Apify | `GET`/`POST /runs/:id/review-analysis`, `agent/review-analysis/` |

A run's view shows only its own packet. A product-truth run shows its four
tiles; a review-mining run shows Customer voice alone; the stage-1 tiles are one
click away on the rail's stage-1 header. A stage-2 or stage-3 run whose stage 1
has since been rerun says so above its tiles.

Charts are hand-rolled SVG (`run-view/charts.tsx` `BarList`) — no chart
library. Stage-1 packet rows are grouped per node in `run-view/stage-one-tiles.tsx` (`byNode`); a
Source also carries a `node`, so source counts are per tile.

| Panel | Field | Source |
|---|---|---|
| runmeta | tokens | `usage.totalTokens` |
| fact rows | every product and category field, each competitor and each data gap is a closed row: name and a one-line preview; opened, the whole value — a bulleted list when the agent separated three or more items with " \| " — and the page it was read off. A source id the agent pasted into its text (`sha256:…`) is never shown: it becomes a numbered link [n] to that source's archived copy (`api/fact-text.ts`, `run-view/fact-value.tsx`) | the same packet fields |
| citations | every fact in a stage-1 tile (each field row, each competitor, its ads, the champion line) and stage 2 links the page it was read off, and **read** opens the archived copy the agent actually read; an ad-library search, which is not a web page, links its archived copy only (`run-view/cite.tsx`) | `packet.sources` by `source_id`; `GET /runs/:id/sources/:sourceId` for the archived copy |
| cost list (rail) | one block per agent and a `run` block: its total, then LLM, Apify, Parallel, Trendtrack and pages, each for the services its tools can spend in (`run-view/CostTable.tsx`) | `GET /api/research/runs/:id/costs`, read every 5s while live (`run-view/use-costs.ts`) |
| logs page, agent tab | that agent's row of the cost table | the same `/costs` |
| products page | one card per product | `GET /api/research/products` |
| run list | one row per run of the product | `GET /api/research/products/:id/runs` |

> **`Tokens —` is a wiring bug, not an empty run.** The server sends
> `usage.totalTokens`; a client that reads `usage.total_tokens` gets
> `undefined`, and because the field is optional `tsc` says nothing. This
> happened, it hid a 932k-token run, and it is now caught by the
> `client-server-field-parity` rule in `server/scripts/check-conventions.mjs`.

> **Billed cost lags by about four seconds.** OpenRouter's `/generation` 404s
> for a few seconds after a turn ends. A blank billed cost on a run that has
> just finished is the API, not the code. `workings.md` §2a.

A red `.error` block under a `failed` run shows `run.error`. A red block on an
`invalid` run is different and more useful: the agent finished and produced
something the schema refused — the message names the offending field. `invalid`
is kept distinct from `failed` on purpose.

Since 2026-10-01 an `invalid` run still shows its tiles. At settlement, every row
a check problem points at is retracted and turned into a gap
(`"<kind> <row id> retracted when the run settled: <problem>"`), so what passed is
kept. The run is `invalid` only when a problem belongs to no single row (an empty
gap list, a brief about the wrong product). It still stores the packet, and the
banner reads "Some checks failed" above the tiles. "Packet rejected" and the raw
output appear only when the ledger does not parse at all.

**Activity** (`.logs-link`, labelled "Activity ↗") opens `/runs/:id/logs` in a
new tab. The reasoning trace and the crawling lanes used to live on the
cockpit's middle column; they are only on the activity log now.

### Step in (`StepIn.tsx`)

`Step in` → a modal of preset corrections plus a free-text box
(`e.g. Ignore the UK market entirely — we can't ship there.`).

- While a run is **live**: `POST /api/research/runs/:id/steer`
- With **no** live run: `POST /api/research/judgements`, which applies to
  future runs

Same button, two endpoints. A correction that "did not take" is usually this:
it was saved as a standing judgement because the run had already settled.

---

## `/runs/:runId/logs` — the activity log (`LogsPage.tsx`)

Header `research cockpit · activity log`, the brief and `Stage N · <scope>` as
chips, a row of stat cards, then a **vertical timeline** — one box per agent
action, joined by a line, top to bottom.

- **Agent tabs** (`logs/AgentTabs.tsx`, `.agent-tabs`; model in `logs/agents.ts`):
  a stage-1 run has up to four agents working at once, so the timeline is split
  on each event's `agent_id` — one tab per agent that has started (`champion`,
  `product`, `competitors`, `category`) with its status mark (… running,
  ✓ complete, ◐ incomplete, ✗ failed, ■ cancelled) and tool count, plus a `run`
  tab of milestones: each agent's start and end, each `finish` check, the
  run's own events. Opens on the first agent. Hidden until an agent has started.
- **Turn cards** (`logs/TurnCard.tsx`, badge **MODEL**): each `llm.call` is
  one pass through the agent loop, in four numbered sections:
  1. **Sent to the model** — tokens in and cached, and each message new in this
     call, badged by who produced it: CODE (the instructions, or a message the
     code injected: retry, your Step in), MODEL (its previous answer),
     TOOL (a tool's result).
  2. **Model output** — first token, thinking length, tokens out; then
     *Thinking* (first line, expandable), *Said* (the text), *Asked to run*
     (each tool call with its arguments, in written order), what the stop
     reason means ("toolUse → the code ran 3 tools"), and **Raw JSON**: the
     assembled message exactly as stored.
  3. **Tools** (`logs/ToolLane.tsx`, badge CODE) — one row per tool call,
     numbered in the order the model wrote them, with a bar showing when it
     ran within the turn: bars that start together ran in parallel, and the
     next turn waits for the slowest. Expanding a row shows which tool call
     asked for it (turn, "call 1 of 3", id), its arguments, and exactly what
     went back to the model and in which turn's prompt. A failed tool shows
     what the model was told and **what it did next** (the first thought and
     tool calls of the turn that received the error).
     Each row also shows **Inside the tool** (`logs/InsideTool.tsx`): every
     function the call ran and every HTTP request it sent (`→` out, `←` back
     with status and time, red when 4xx/5xx or an error), timed from the call's
     start — the `inside` lines on `tool.completed` (`workings.md` §2e). Above
     them, a service line when the service reported more than a status, e.g.
     **Parallel · search — 10 results**. A search with failed parts is marked
     **DEGRADED** (amber), or **EMPTY** when nothing answered. Parallel reports
     one part; the multi-engine case was SearXNG's, removed 2026-10-01.
  4. **→ the results go into turn #N's prompt**, in the order asked for.

  At the bottom, *Full LLM call* is the previous view (`logs/CallView.tsx`):
  prompt and answer as sent. Its row shows **first token Ns**, and under the
  answer an **OpenRouter:** line gives time to the first token, the streaming
  after it, reasoning tokens and provider, read from `/generation` with the
  billed cost (`call.generation`, `workings.md` §2a). Both are blank for about
  four seconds after a call, and on calls from before 2026-09-27.
- **Milestones** (run started, packet checked/accepted/rejected, retry after a
  dropped stream — naming the backup model it moved to, billed, run completed) are flat boxes badged CODE, or YOU for
  a Step in; failures red, acceptance green.
- The grouping lives in `logs/steps.ts` (`buildSteps`); the joining of tool
  calls, executions and results lives in `logs/turn.ts` (`indexCalls`), keyed
  on `tool_call_id`. A run from before 2026-09-27 has no ids in its events, so
  a `tool.completed` settles the oldest running row of that tool name and the
  "asked for / returned" links are missing.

Data still comes from two streams: `GET /api/research/runs/:id/calls?after=<seq>`
polled incrementally by sequence number, and the SSE event stream
(`GET /api/research/runs/:id/events`) which feeds the timeline live.

**Download trace** (header, `.logs-back`, an `<a download>` to
`api.traceUrl` → `GET /api/research/runs/:id/trace`) saves the run's trace: a
plain-text file with one line per server function called and per outbound HTTP
request, each tagged with its source file (`workings.md` §2e). It works mid-run,
returning what has been written so far. A 404 (`no trace for this run`) means
the run started before traces existed, or its file was pruned after 30 days.
The same file from a terminal: `mra trace <id>`.

This page is the first place to look when a run "did nothing": an idle run with
no boxes is a start-up failure, while a run with forty calls and no packet is
the agent never calling `finish`, or a ledger that fails the contract: the
`finish` and `record_*` results say which.

---

## Login (`Login.tsx`)

Username and password over `POST /api/auth/login`.

> **A local login that succeeds and immediately bounces you back** is the
> cookie, not the password. `http://localhost` cannot set a `Secure` cookie and
> the browser drops it silently. `.env.example` sets `MRA_COOKIE_SECURE=false`
> for exactly this reason.

---

## When the page goes blank

In order, because this order has been wrong before:

1. **Is anything serving it?** `mra health local` / `mra health live`.
2. **Which request failed?** The network tab, or `mra logs`. A blank page after
   a route renders is nearly always a component throwing on a field the server
   did not send — see the parity rule above.
3. **Is the page fetching in a loop?** Count requests on an idle page (network
   tab). A callback App hands to `RunView` as `onChanged` is a dependency of the
   run's event-stream effect; if it is recreated on every render, the stream reopens
   and replays every render. That happened once: 143 run fetches and 56 streams in
   8 s, and the view showed the *previous* run because a late response for it
   landed last. `reload` in `App.tsx` is a `useCallback` for this reason, and
   `RunView` only shows a response whose id matches the run on screen.
4. **Is the thing you are looking at even deployed?** `mra deployed`. A healthy
   live site says the container is up, not that your change is on it. Only
   `deploy/vps/deploy.sh` puts it there, and the frontend ships as
   `frontend/dist` — a source change without a rebuilt `dist` deploys the old
   UI while the diff says otherwise.
