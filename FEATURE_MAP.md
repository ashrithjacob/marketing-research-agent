# Feature map: what is on the screen, and what it calls

This file exists so that a screenshot with three question marks under it is
enough to act on. It maps every surface of the cockpit to the component that
renders it and the endpoint behind it. `workings.md` explains what the run
behind the screen does.

Rewritten 2026-10-17 for the avatar rewrite (`docs/spec.md`). The brand tiles,
chat, plans, drafts, library and activity-log pages are gone; git history before
`b6f45cc` has their map.

Keep it true. A new page or button that is not here will be guessed at.

## Reaching it

| Where | URL | Auth |
|---|---|---|
| Live | https://marketing.vanis.ai | login, unless `MRA_APP_PASSWORD_HASH` is empty. Live still runs the old code (`setup.md` §5a, "Pending") |
| Local | http://localhost:8080 after `mra up` | usually none: the hash is normally empty locally, which disables login |

## URLs

One React app (`route.tsx`, the History API). The server returns `index.html`
for any path that is not a file or `api/`.

| URL | Page |
|---|---|
| `/` | New analysis and the list of analyses (`HomePage.tsx`) |
| `/runs/:runId` | One analysis (`run/RunPage.tsx`) |
| anything else | The home page |

## Home (`HomePage.tsx`)

| Surface | Component | Calls |
|---|---|---|
| New analysis form: product url or name, markets, optional competitors, brand constraints, price and offer | `NewAnalysis.tsx` | `GET /api/research/config` (markets), `POST /api/research/runs` |
| List of analyses, with status and cost | `HomePage.tsx` | `GET /api/research/runs` |

The form decides url or name by shape; the server refuses a url sent as a name
(422, shown in the red banner).

## One analysis (`run/RunPage.tsx`)

The page loads `GET /api/research/runs/:id` (the run, its product, its confirmed
competitors) and, while the run is not final, follows
`GET /api/research/runs/:id/events` (server-sent events). It reloads on
`stage.changed`, `run.resolved`, `run.ended` and `agent.ended` (`run/use-run.ts`).

| Surface | Component | Shows / calls |
|---|---|---|
| Header: title, markets, model, status, cost, Stop, Trace | `RunPage.tsx` | Stop: `POST /runs/:id/stop`. Trace: `GET /runs/:id/trace` (download) |
| Red banner under the header | `RunPage.tsx` | `run.error`: why the run ended `invalid` or `failed` |
| "Finding the product page…" | `RunPage.tsx` | status `resolving` |
| Confirm panel: product choice, competitor chips (× removes, Add adds), "Research this product and N competitors" | `run/ConfirmPanel.tsx` | status `awaiting_confirmation`; `POST /runs/:id/confirm`. Hovering a chip shows why the resolver proposed it |
| Seven stage cards | `run/StageTracker.tsx` | `run.stage_status` against `GET /config`'s stages. `Not built yet` is greyed; a card shows the stage's summary and error |
| Product brief: price, offer, ingredients, claims, each with a source link | `run/ProductBrief.tsx` | the `product` row, once stage 1's brief is accepted |
| Competitors: Direct / Indirect / Context only | `run/Competitors.tsx` | `competitors[].relationship`, decided by code; "Not profiled yet" lists the ones without one |
| Reviews: one row per product and source (count, average), click a row for its reviews, lowest ratings first | `run/Reviews.tsx` | `GET /runs/:id/reviews` (coverage, and `?competitor=<id>&limit=` for a page) |
| Competitor long-form statics: bucket filter, cards with image, signals, the reader's verdict and the full copy | `run/Ads.tsx` | `GET /runs/:id/ads` |
| Live activity | `run/Activity.tsx` | the last 30 events: tool calls, agents starting and ending, reviews collected per product, stage changes |

## What failures look like

| On screen | Cause | Where to look |
|---|---|---|
| Status `Refused` and a banner naming a submit problem | An agent's submit was refused out, or it never submitted (`invalid`) | `mra calls <id>`: the last `submit` result lists the problems |
| Stage card `Skipped`, "needs X, which did not complete" | A stage it depends on failed or was refused | that stage's own card |
| Competitor under "Not profiled yet" with the stage completed | Its profiler agent did not get an accepted submit; the stage summary names why | the stage 1 card's summary |
| A product with "0 new (review app … not supported yet, no Amazon listing …)" in the stage 3 card | Its store runs a review app other than Judge.me and it is not on Amazon | `docs/gaps.md` §9 |
| Stage 4 `Failed`: "TRENDTRACK_API_KEY is not set" | No TrendTrack key in the container | `.env`, then `mra up` |
| Stuck on `Finding the product` after a restart | It is not stuck: a restart ends live runs `failed` | refresh; the banner reads "the server restarted" |
