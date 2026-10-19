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
| `/runs/:runId` | One analysis (`run/RunPage.tsx`) |
| anything else | The home page |

## Home (`HomePage.tsx`)

| Surface | Component | Calls |
|---|---|---|
| New analysis form: product url or name, markets, optional competitors, brand constraints, price and offer | `NewAnalysis.tsx` | `GET /api/research/config` (markets), `POST /api/research/runs` |
| List of analyses: product shot, brand logo, domain, up to six competitor logos, review/ad/avatar counts, status, cost | `HomePage.tsx`, `BrandMark.tsx` | `GET /api/research/runs` (`RunSummary`: one query joins the product, competitors and counts) |

The form decides url or name by shape; the server refuses a url sent as a name
(422, shown in the red banner).

## One analysis (`run/RunPage.tsx`)

The page loads `GET /api/research/runs/:id` (the run, its product, its confirmed
competitors) and, while the run is not final, follows
`GET /api/research/runs/:id/events` (server-sent events). It reloads on
`stage.changed`, `run.resolved`, `run.ended` and `agent.ended` (`run/use-run.ts`).

| Surface | Component | Shows / calls |
|---|---|---|
| Header: product shot, logo, title, domain, markets, model; tiles for competitors, reviews, long-form ads, ingredients; status, cost, Stop, Trace | `run/RunHeader.tsx` | Stop: `POST /runs/:id/stop`. Trace: `GET /runs/:id/trace` (download) |
| Red banner under the header | `RunPage.tsx` | `run.error`: why the run ended `invalid` or `failed` |
| "Finding the product page…" | `RunPage.tsx` | status `resolving` |
| Confirm panel: the product and each proposed competitor as a tile with its product shot, logo, name and domain (↗ opens the page); click a tile to leave it out or put it back; Add appends a tile; "Research this product and N competitors" | `run/ConfirmPanel.tsx`, `run/PickTile.tsx` | status `awaiting_confirmation`; pictures from `GET /runs/:id`'s `visuals` (read for free right after the resolver, cached by url in `brand_visuals`); `POST /runs/:id/confirm`. Hovering a tile shows why the resolver proposed it. Competitor tiles are ordered by their shop's monthly visits and show visits and active ads (`view.signals`, TrendTrack's free lookup); marketplace listings come last |
| Seven stage cards | `run/StageTracker.tsx` | `run.stage_status` against `GET /config`'s stages. `Not built yet` is greyed; a card shows the stage's summary and error, folded to three lines behind "more" |
| Product brief: price, offer, ingredients, claims, each with a source link | `run/ProductBrief.tsx` | the `product` row, once stage 1's brief is accepted |
| Avatars: the demand-versus-supply map (up: share of reviews; right: share of competitor ads; size: reviews; colour: win rate, grey when no ads; hover for numbers), then one card per avatar with its lists, the competitors' best angle, up to four quotes and its sub-avatars | `run/Avatars.tsx`, `run/AvatarMap.tsx` | `GET /runs/:id/avatars`, loaded once stage 5 has completed |
| Competitors: Direct / Indirect / Context only, ordered by estimated sales, one row each with product shot, logo, form, domain, positioning, price, traction ("$52.7k/mo shop sales · #1 of 23 products", or "product sales · its only product"; hover for TrendTrack's range), review count, ad count and up to three ad creatives | `run/Competitors.tsx`, `run/Traction.tsx` | `competitors[]` (relationship decided by code), with reviews and ads from `run/use-evidence.ts` |
| Reviews: one row per product and source (count, average), click a row for its reviews, lowest ratings first | `run/Reviews.tsx` | `GET /runs/:id/reviews` (coverage, and `?competitor=<id>&limit=` for a page) |
| Competitor long-form statics: bucket filter, cards with image, signals, the reader's verdict and the full copy | `run/Ads.tsx` | `GET /runs/:id/ads` |
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
