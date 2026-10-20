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
| `/` | New analysis and the list of analyses, one row each with the product shot, competitors' logos and evidence counts (`HomePage.tsx`) |
| `/runs/:runId` | One analysis, its overview (`run/RunPage.tsx`) |
| `/runs/:runId/product`, `/reviews`, `/ads`, `/avatars` | One stage of that analysis: stages 1, 3, 4 and 5 (`STAGE_SECTIONS` in `run/RunNav.tsx`) |
| anything else | The home page |

## The sidebar (`Shell.tsx`, `run/RunNav.tsx`)

Dark, on every page, like TrendTrack's. Brand and **Analyses** (the home page);
on a run, the product's shot and name, **Overview**, and one item per built
stage with its number, a count (competitors, reviews, ads) and a status dot
(green completed, blue running, red failed or invalid, amber skipped,
cancelled or waiting). A stage appears there once it is built. The signed-in
user and Sign out sit at the bottom when login is on. Below 900px it becomes
a scrolling bar across the top.

## Home (`HomePage.tsx`)

| Surface | Component | Calls |
|---|---|---|
| New analysis form: product url or name, markets, optional competitors, brand constraints, price and offer | `NewAnalysis.tsx` | `GET /api/research/config` (markets), `POST /api/research/runs` |
| List of analyses: product shot, brand logo, domain, up to six competitor logos, review/ad/avatar counts, status, cost | `HomePage.tsx`, `BrandMark.tsx` | `GET /api/research/runs` (`RunSummary`: one query joins the product, competitors and counts) |

The form decides url or name by shape; the server refuses a url sent as a name
(422, shown in the red banner).

## One analysis (`run/RunPage.tsx`)

Overview shows the header, the rerun prompt, the confirm panel, the seven
stage cards and live activity. A stage's page shows the header, that stage's
card, and its section: Product & market (brief and competitors), Reviews,
Long-form ads, Avatars.

The page loads `GET /api/research/runs/:id` (the run, its product, its confirmed
competitors) and, while the run is not final, follows
`GET /api/research/runs/:id/events` (server-sent events). It reloads on
`stage.changed`, `run.resolved`, `run.ended` and `agent.ended` (`run/use-run.ts`).

| Surface | Component | Shows / calls |
|---|---|---|
| Header: product shot, logo, title, domain, markets, model; tiles for competitors, reviews, long-form ads, ingredients; status, cost, Stop, Trace | `run/RunHeader.tsx` | Stop: `POST /runs/:id/stop`. Trace: `GET /runs/:id/trace` (download) |
| Rerun prompt (red card under the header): each built stage that did not complete, with why (its error, "skipped" and what it needed, or "built since this run"), and **Rerun these N stages** | `run/RerunPrompt.tsx` | shown for a finished run with a product and any unfinished built stage; `POST /runs/:id/rerun` (409 with the reason when nothing can be rerun). Completed stages are kept |
| Red banner under the header | `RunPage.tsx` | `run.error`, only for a run that ended before it had a product (resolving refused or failed); otherwise the rerun prompt says it |
| "Finding the product page…" | `RunPage.tsx` | status `resolving` |
| Confirm panel: the product and each proposed competitor as a tile with its product shot, logo, name and domain (↗ opens the page); click a tile to leave it out or put it back; Add appends a tile; "Research this product and N competitors" | `run/ConfirmPanel.tsx`, `run/PickTile.tsx` | status `awaiting_confirmation`; pictures from `GET /runs/:id`'s `visuals` (read for free right after the resolver, cached by url in `brand_visuals`); `POST /runs/:id/confirm`. Hovering a tile shows why the resolver proposed it. Competitor tiles are ordered by their shop's monthly visits and show visits and active ads (`view.signals`, TrendTrack's free lookup); marketplace listings come last |
| Seven stage cards | `run/StageTracker.tsx`, `run/StagesPanel.tsx` | `run.stage_status` against `GET /config`'s stages. `Not built yet` is greyed; a card shows the stage's summary and error, folded to three lines behind "more" |
| **Rerun** on each built stage card, **Rerun all stages** above them (finished runs with a product) | `run/StagesPanel.tsx` | a click opens a blue confirm card naming every stage that will run (the stage and those that use it, from `/config`'s `reruns`, plus any unfinished stage) and what it spends; **Rerun** sends `POST /runs/:id/rerun` `{stages}` |
| Product brief: price, offer, ingredients, claims, each with a source link | `run/ProductBrief.tsx` | the `product` row, once stage 1's brief is accepted |
| Avatars: the demand-versus-supply map (up: share of reviews; right: share of competitor ads; size: reviews; colour: win rate, grey when no ads; hover for numbers), then one card per avatar with its lists, the competitors' best angle, up to four quotes and its sub-avatars | `run/Avatars.tsx`, `run/AvatarMap.tsx` | `GET /runs/:id/avatars`, loaded once stage 5 has completed |
| Competitors: Direct / Indirect / Context only, ordered by estimated sales, one row each with product shot, logo, form, domain, positioning, price, traction ("$52.7k/mo shop sales · #1 of 23 products", or "product sales · its only product"; hover for TrendTrack's range), review count, ad count and up to three ad creatives | `run/Competitors.tsx`, `run/Traction.tsx` | `competitors[]` (relationship decided by code), with reviews and ads from `run/use-evidence.ts` |
| Reviews: one row per product and source (count, average), click a row for its reviews, lowest ratings first | `run/Reviews.tsx` | `GET /runs/:id/reviews` (coverage, and `?competitor=<id>&limit=` for a page) |
| Long-form statics in this market, in the scout's rings: direct competitors, same problem (counted as supply), same buyer (formats to borrow, not supply), trending shops in any market (structures to apply to your store, not supply); winning first; each card with image, signals, audience age and gender, the scout's reason for keeping it, the reader's verdict and the full copy | `run/Ads.tsx`, `run/AdCard.tsx` | `GET /runs/:id/ads` (`ring`, `ring_why`) |
| Live activity | `run/Activity.tsx` | the last 30 events: tool calls, agents starting and ending, reviews collected per product, the avatar memory after each batch, stage changes |

Pictures are addresses on the brands' own sites, read by stage 1 for free (`PageVisuals`: Shopify's `/products/<handle>.js` image or the page's og:image; the icon links or `/favicon.ico`). A brand whose picture fails to load shows a two-letter monogram (`BrandMark.tsx`). A competitor proposed by a retailer url (target.com) shows the retailer's icon as its logo.

## What failures look like

| On screen | Cause | Where to look |
|---|---|---|
| Status `Refused` and a banner naming a submit problem | An agent's submit was refused out, or it never submitted (`invalid`) | `mra calls <id>`: the last `submit` result lists the problems |
| Stage card `Skipped`, "needs X, which did not complete" | A stage it depends on failed or was refused | that stage's own card |
| Competitor under "Not profiled yet" with the stage completed | Its profiler agent did not get an accepted submit; the stage summary names why | the stage 1 card's summary |
| A product with "0 new (review app … not supported yet, no Amazon listing …)" in the stage 3 card | Its store runs a review app other than Judge.me and it is not on Amazon | `docs/gaps.md` §9 |
| Stage 4 `Failed`: "TRENDTRACK_API_KEY is not set" | No TrendTrack key in the container | `.env`, then `mra up` |
| Stage 5 `Skipped`, "needs competitor_ads, which did not complete" | Stage 5 waits for stages 1, 3 and 4; one of them failed | that stage's card |
| An avatar card with a dashed border and "emerging" | The judge found its evidence too thin to act on yet | its review count and confidence on the card |
| Stuck on `Finding the product` after a restart | It is not stuck: a restart ends live runs `failed` | refresh; the banner reads "the server restarted" |
