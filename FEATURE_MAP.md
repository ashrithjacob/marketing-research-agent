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

---

## URLs

Real URLs over one React app (`route.tsx`, the History API; no router library).
The server returns `index.html` for any path that is not a file or `api/`.

| URL | Page |
|---|---|
| `/` | The brand tiles (`HomePage.tsx`, below) |
| `/brands/:key` | One brand: its results and its chat (`BrandPage.tsx`, below); `key` is `site:<domain>` or `product:<name>`, URL-encoded |
| `/drafts/:draftId` | One draft (`DraftPage.tsx`, below) |
| `/runs/:runId/logs` | The activity log (below) |
| anything else | The brand tiles |

*Superseded 2026-10-15:* `/products…`, `/library`, `/plans/:id`, `/inbox` and
`/playbooks` are gone, with `ProductsPage`, `ProductRuns`, `RunView`, `StepIn`,
`StartPlan`, `PlanPage`, `PlanCard`, `PlanStageList`, `StopWhen`, `InboxPage`,
`LibraryPage`, `PlaybooksPage`, `AlwaysOnPanel`, `WatchPanel`, `FeedbackLog` and
`HeaderNav` (in git before this date). Owner's decision: the app is one page where
the owner chats; chat starts the work; only buttons and drafts are clickable. Their
endpoints still exist (`workings.md` §3), and `mra` still drives them.

## The pages (`App.tsx`, `HomePage.tsx`, `BrandPage.tsx`)

*Changed 2026-10-15, twice:* first one page with the chat beside the results;
then, the owner's decision, tiles per brand, each opening its own chat.

**Header.** `marketing agent` (a link to `/`), the **Always on** control
(`AlwaysOnSwitch.tsx`), a `user · workspace` chip (only when login is on), **Sign
out**. Always on is the workspace's, not one brand's: a switch, a `$ __ /day` cap
box, and today's billed spend (and how many tasks are running). The switch
cannot be turned on with no cap above zero; changing the cap while on saves when
the box is left. On, the operator's `create_task` may start product facts and
category numbers by itself, schedules run, and the watchers start (spec-always-on
§7.2–7.4); Apify spend still waits for an Approve card. `GET
/api/research/always-on` every 15 s, `POST /api/research/always-on` with
`{ on, daily_cap_usd }` (400 without a cap). `Loading…` in a bare `.boot` div means
`GET /api/auth/session` has not answered: the server is down or the cookie is
refused, not a UI bug.

**`/`: the brand tiles.** A brand is a website's domain, holding every page
researched on it, or a product named without a page (`Brands` in
`domain/brands.ts`). First the **new brand** tile: a box for a site or a product's
name and **Start**, which calls `POST /api/research/brands` (`{ text }`): it opens
that brand's chat with the text as the owner's first message and answers its
`key`; the page goes to `/brands/:key`. Then one tile per brand (`BrandTile.tsx`),
newest activity first: its graphic, its name, how many products (or *chat only*,
a chat with no research yet), the newest run's status chip. Below: the **Memory
folder**, **What the agent has learned** and **Drafts**, which belong to the
whole workspace.

| Control | Calls | Broken looks like |
|---|---|---|
| (the tiles) | `GET /api/research/brands`, every 5 s (`use-brands.ts`) | `Loading brands…` that never ends |
| Start | `POST /api/research/brands`; 400 when the box is empty | a red banner; the page stays |
| a tile | goes to `/brands/:key` | — |

**The picture** is looked for in the background the first time a tile is
listed (`BrandShelf`, `BrandPictureSearch`, `adapters/homepage-image.ts`), best
first: the site's homepage share image (`og:image`, `twitter:image`); the photo
of an Amazon listing already stored for one of its products; the share image of
up to three of the product's own pages a run read (`first_party` sources, the
product-facts pages first); the site's icon. It is stored in
`research_brand_images` with its kind, and looked for again a day later while it
is only an icon or nothing, since new research may have added pages. Measured
2026-10-15 on the local data: 14 of 20 brands got a picture (8 with the homepage
alone); 5 of the 6 without have neither an Amazon listing nor a page of their own
in their runs, and the sixth's site (sportsresearch.com) answers a plain request
with `429`. A missing or unloadable picture shows the name's first letter.
The picture is loaded straight from the brand's site (`referrerPolicy:
no-referrer`), so a site that refuses hotlinking shows the letter too.

**`/brands/:key`: one brand.** Left: **← All brands**, the brand's picture and
name, then, per product of the brand (named only when there are several), its
three stages as steps down a rail (`stage-tiles/`), each with a numbered bubble
(green when delivered, blue while running, red-ringed when failed, invalid or
cancelled, grey when never run). Each step is a row for the stage's newest
delivered stage run (else its newest of any status): its name, status chip and
date, then its figures as pills, written from the run's packet by
`api/stage-story.ts` (stage 1: sources, sites, facts, competitors, figures;
stage 2: sources, sites, actives, doses checked, markets, prices; stage 3:
sources, sites, quotes), gaps last in amber. The whole row is a button with a
`›`; a stage never run is a dashed row with **Run in chat**, which puts "Run
stage N … for <product>" in the chat box for the owner to send.

**`/brands/:key/products/:productId/stages/:n[/:tab]`: one stage**
(`StageView.tsx`), in the left pane, the chat staying on the right. A breadcrumb
(the brand, then *Stage n · name*, its status and when), the sentence of what it
kept ("60 sources from 26 sites: 26 own pages, 22 ad-library searches, 9
search-data pages."), the figures, then tabs, each its own URL: stage 1
**Product · Competitors · Category**, stage 2 **Ingredients · Doses · Claims ·
Economics**, stage 3 **Customer voice**, and for all **Sources (n)** (page, site,
kind; a source the checks refused reads *not used*) and **Gaps (n)** (section,
what was not found, what it would need). A section tab shows that section's tile
already open (`TilesOpen` in `run-view/tile.tsx`). `GET
/api/research/products/:id/runs`, then `GET /runs/:id` per stage.

Right: **the brand's chat**
(`ChatPanel.tsx`), one operator conversation per brand. "Research it", or one of
the brand's pages, makes the operator call `start_stage_one`
(`agent/operator/stage-one-tools.ts`), which drafts stage 1 as a plan and
approves it in one step. A task that would spend Apify money (the champion,
competitors) becomes an approval card instead; the tasks waiting on it start
when it ends. When a task ends, the chat of the brand its brief belongs to is
woken (a `[Signal]`) and says what it found. Under the conversation, the open
**cards** of this brand, and those of the whole workspace (lessons, drafts)
(`Cards.tsx`; the board's `card_brands` says which brand each is): a question
has an answer box, an approval **Approve** and **Reject**, a draft's card
**Read the draft →**.

| Control | Calls | Broken looks like |
|---|---|---|
| Send | `POST /api/research/chat` with `{ text, brand }` (also recorded as `said` feedback for the reviewer) | the line never appears: the stream, not the send, is down (dot grey) |
| Answer / Approve / Reject | `POST /api/research/cards/:id/answer`, `/approve`, `/reject` | card stays open; a red banner names why |
| (the lines, the cards, the dot) | `GET /api/research/workspace/stream?brand=<key>` (`use-workspace.ts`): whole `chat` and `board` snapshots | dot grey: reconnecting |

Only the conversation is shown: the owner's lines blue, the operator's grey. Code's
notes and the operator's tool calls stay in its transcript.

**Memory folder** (`MemoryFolder.tsx`, `use-library.ts`): **Add files** or drop
PDFs, `.md` or `.txt` playbooks; each row's status (or `page n of m` while a PDF
converts) and **Remove**. Every research task and every brand's operator read it
with `library_index` / `library_read`. `POST /api/research/library` (`202`; `415`
for any other file type, `413` over `MRA_LIBRARY_MAX_MB`), its SSE at
`/library/:id/events`, `DELETE /library/:id`. A `failed` row says why: a PDF with
no text layer, a file that is not UTF-8 text, or a restart mid-conversion.

**What the agent has learned** (`MemoryList.tsx`): brand memory, each entry
*learned* (an approved lesson) or *yours*, with **Edit** and **Delete**
(`/api/research/memory/:id`). It grows from the reviewer (spec-always-on §5):
what the owner says in any chat, answers, rejects or steers becomes a lesson card;
approved, every later task and operator reads it. It is the workspace's, not one
brand's.

**Drafts** (`/drafts/:id`, `DraftPage.tsx`): the draft section by section, **What
it cites**, the critic's verdicts; while it waits, **Edit** per section (**Save as
a new version**, `POST /drafts/:id/edit`), **Reject** and **Approve this draft**;
**The ad it became** (`DraftAds.tsx`). **Back to the chat** returns to `/`.

### The tiles (`run-view/`), in a stage's section tab

*Superseded 2026-10-15:* the run view (`RunView.tsx`: rail, Now panel, sources
list) is deleted, and so are `ProductPanels.tsx` and `ProductResults.tsx`; its
tiles are what a stage's section tab shows. What follows is
still true of the tiles.

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
| Competitors | direct / indirect by form / indirect by active groups, one chip each, each competitor's page it was read off and its ads as citations with the date each was first seen, or "* first seen not found" (`AdCites`, `run-view/cite.tsx`), each competitor's site link, the champion's actives it shares (none shown when it shares none), **for:** who its own page says it is for (`icp_as_printed`), and its Amazon listing or "not on Amazon — <why>" (`run-view/amazon-link.tsx`, also on the champion line), social-proof review-count chart, excerpts, gaps | `packet.competitors`, `measurements`, `listings` on `GET /runs/:id` (re-judged by today's matcher on each read) |
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
| stage rows and view | one row per stage per product; a stage's tabs | `GET /api/research/brands`, `GET /api/research/products/:id/runs`, `GET /api/research/runs/:id` |

> **`Tokens —` is a wiring bug, not an empty run.** The server sends
> `usage.totalTokens`; a client that reads `usage.total_tokens` gets
> `undefined`, and because the field is optional `tsc` says nothing. This
> happened, it hid a 932k-token run, and it is now caught by the
> `client-server-field-parity` rule in `server/scripts/check-conventions.mjs`.

> **Billed cost lags by about four seconds.** OpenRouter's `/generation` 404s
> for a few seconds after a turn ends. A blank billed cost on a run that has
> just finished is the API, not the code. `workings.md` §2a.

Since 2026-10-14 a run a circuit breaker stopped ends **`partial`**, an amber
chip reading *partly complete* (`spec-always-on.md` §3.2). Before, the same run
ended `completed`, so "everything found" and "half found" looked alike. Its
`run.error` names the breaker (`stopped early: 5 responses in a row added
nothing new`), each field it left open is a gap (`price: not found: …`), and the
activity log shows `<agent> agent stopped: <why> — gapped …`. For everything
downstream it counts as complete: the next stage's button, the rail, a
product's default run (`DELIVERED_STATUSES` in `api/runs.ts`, mirroring
`RunStatuses.delivered` on the server).

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

### Step in

*Superseded 2026-10-15:* deleted. Guidance to a running task is said in the chat;
the operator passes it on with `guide_task`.

---

## `/library`

*Superseded 2026-10-15:* the page is the **Memory folder** on the right of the
page (above). It now also takes `.md` and `.txt`, kept as they are.

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


## Start, review, chat

*Superseded 2026-10-15:* Start's form, the plan card with its toggles, Always on,
Watching, the playbook page and the feedback log are no longer on screen (see
URLs above). The chat starts the work, and the cards in the chat are the only
approvals. What the plan, cards and stream do on the server is unchanged.
