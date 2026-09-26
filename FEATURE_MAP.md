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

### The stage rail — left column (`StageRail.tsx`)

`Stages`, then one block per stage, each listing its nodes with a dot, a label,
a sparkline (`Curve`), and a **▶** button.

| Node | Label | Stage |
|---|---|---|
| `product_data` | Product data | 1 |
| `competitors` | Competitors | 1 |
| `category_data` | Category data | 1 |
| `review_mining` | Review mining | 2 |

**▶** runs that node on its own — `POST /api/research/runs` with a one-element
`nodes` array. It is disabled for stage 2 with the tooltip *"Stage 2 mines what
stage 1 found — run stage 1 for this brief first"*; that is the intended state,
not a broken button.

A stage header (**Stage 1 · Raw material**, **Stage 2 · Review mining**) opens
that stage's run for the same subject, via `onSelectRun`. The header of the
stage the shown run collects is not clickable. Stage 1 opens the run a stage-2
run mined from (`stageOneRunFor` in `run-view/rail.tsx`: the newest completed
stage-1 run for the subject that started before it). Stage 2 opens the live
stage-2 run, else the newest completed one, else the newest. The ▶ buttons
start runs; the headers only navigate.

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
| Competitors | direct/indirect groups, social-proof review-count chart, excerpts, gaps | `packet.competitors`, `measurements` |
| Category data | market-size/CAGR bar charts, every figure with its period, gaps | `measurements` with `node: 'category_data'` |
| Voice of customer | verbatim `review_mining` excerpts | `packet.excerpts` |

A run's view shows only its own packet. A stage-2 run shows Voice of customer
alone; its stage-1 tiles are one click away on the rail's stage-1 header.

Charts are hand-rolled SVG (`run-view/charts.tsx` `BarList`) — no chart
library. Stage-1 packet rows are grouped per node in `run-view/stage-one-tiles.tsx` (`byNode`); a
Source also carries a `node`, so source counts are per tile.

| Panel | Field | Source |
|---|---|---|
| runmeta | tokens | `usage.totalTokens` |
| runmeta | calculated cost | `usage.cost.total`, priced by `usage.pricing` |
| runmeta | billed cost | `usage.billed.total` — what OpenRouter actually charged |
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

- **Boxes** (`logs/timeline.tsx`): an `llm.call` event opens a *turn* box whose
  collapsed summary is what the agent did ("5 searches", "read 5 pages ·
  2 searches", "Thought, then answered") plus time, tokens and cost.
- **Progressive disclosure**: clicking a turn box expands to the reasoning
  trace, the per-tool rows with the URLs fetched (searches, page reads, packet
  checks), the model output, and the full LLM call (`logs/CallView.tsx` —
  prompt, answer, tokens, cost).
- **Milestones** (run started, packet checked/accepted/rejected, billed, run
  completed) are separate flat boxes with hollow dots; failures red,
  acceptance green.
- The grouping lives in `logs/steps.ts` (`buildSteps`): no correlation id
  upstream, so a `tool.completed` settles the oldest running row of that tool
  name — parallel same-tool calls settle in start order.

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
the agent failing to emit the fenced JSON block.

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
