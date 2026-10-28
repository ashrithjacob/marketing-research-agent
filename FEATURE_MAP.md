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
| `/` | New analysis and the list of researched brands, one row each with the product shot, competitors' logos and evidence counts (`HomePage.tsx`) |
| `/runs/:runId` | One analysis, its overview (`run/RunPage.tsx`) |
| `/runs/:runId/product`, `/reviews`, `/ads`, `/market`, `/avatars` | One stage of that analysis: stages 1 to 5 (`STAGE_SECTIONS` in `run/RunNav.tsx`) |
| anything else | The home page |

## The sidebar (`Shell.tsx`, `run/RunNav.tsx`)

Dark, on every page, like TrendTrack's. Brand and **Researched brands** (the home page);
on a run, the product's shot and name, **Overview**, and one item per built
stage with its number, a count (competitors, reviews, ads) and a status dot
(green completed, blue running, red failed or invalid, amber skipped,
cancelled or waiting). A stage appears there once it is built. The signed-in
user and Sign out sit at the bottom when login is on. Below 900px it becomes
a scrolling bar across the top.

## Home (`HomePage.tsx`)

| Surface | Component | Calls |
|---|---|---|
| New analysis form: product url or name, markets | `NewAnalysis.tsx` | `GET /api/research/config` (markets), `POST /api/research/runs` |
| Researched brands: product shot, brand logo, domain, up to six competitor logos, review/ad/avatar counts, status, cost | `HomePage.tsx`, `BrandMark.tsx` | `GET /api/research/runs` (`RunSummary`: one query joins the product, competitors and counts) |
| Delete a row: the bin at its end asks once, then deletes the run and everything it wrote; greyed out while the run is working | `DeleteRun.tsx` | `DELETE /api/research/runs/:runId` (409 while resolving, running or stopping) |

The form decides url or name by shape; the server refuses a url sent as a name
(422, shown in the red banner).

## One analysis (`run/RunPage.tsx`)

Overview shows the header, the rerun prompt, the confirm panel, the seven
stage cards and live activity. A stage's page shows the header, that stage's
bar (`run/StageBar.tsx`: number, title, status, when it ended, and chips that
scroll to a part of the section, or the stage's error in place of the chips),
and its section: Product & market (brief and competitors), Reviews,
Long-form ads, Avatars.

The page loads `GET /api/research/runs/:id` (the run, its product, its confirmed
competitors) and, while the run is not final, follows
`GET /api/research/runs/:id/events` (server-sent events). It reloads on
`stage.changed`, `run.resolved`, `run.ended` and `agent.ended` (`run/use-run.ts`).

| Surface | Component | Shows / calls |
|---|---|---|
| Header: product shot, logo, title, domain, markets; status, cost, Stop, Trace; four full-width tiles for competitors, reviews, long-form ads, ingredients, each opening a breakdown on hover or focus (competitors by relationship and price; reviews and average rating per brand; ads by winning, testing, stopped early, top advertisers, longest-running; ingredients with doses) | `run/RunHeader.tsx`, `run/HeaderTiles.tsx` | Stop: `POST /runs/:id/stop`. Trace: `GET /runs/:id/trace` (download) |
| Rerun prompt (red card under the header): each built stage that did not complete, with why (its error, "skipped" and what it needed, or "built since this run"), and **Rerun these N stages** | `run/RerunPrompt.tsx` | shown for a finished run with a product and any unfinished built stage; `POST /runs/:id/rerun` (409 with the reason when nothing can be rerun). Completed stages are kept |
| Red banner under the header | `RunPage.tsx` | `run.error`, only for a run that ended before it had a product (resolving refused or failed); otherwise the rerun prompt says it |
| "Finding the product page…" | `RunPage.tsx` | status `resolving` |
| Confirm panel: the product and each proposed competitor as a tile with its product shot, logo, name and domain (↗ opens the page); click a tile to leave it out or put it back; Add appends a tile; "Research this product and N competitors" | `run/ConfirmPanel.tsx`, `run/PickTile.tsx` | status `awaiting_confirmation`; pictures from `GET /runs/:id`'s `visuals` (read for free right after the resolver, cached by url in `brand_visuals`); `POST /runs/:id/confirm`. Hovering a tile shows why the resolver proposed it. Competitor tiles are ordered by their shop's monthly visits and show visits and active ads (`view.signals`, TrendTrack's free lookup); marketplace listings come last |
| Seven stage cards | `run/StageTracker.tsx`, `run/StagesPanel.tsx` | `run.stage_status` against `GET /config`'s stages. `Not built yet` is greyed; a card shows the stage's summary and error, folded to three lines behind "more" |
| **Rerun** on each built stage card, **Rerun all stages** above them (finished runs with a product) | `run/StagesPanel.tsx` | a click opens a blue confirm card naming every stage that will run (the stage and those that use it, from `/config`'s `reruns`, plus any unfinished stage) and what it spends; **Rerun** sends `POST /runs/:id/rerun` `{stages}`; from a stage card whose stage others use, **Rerun stage N only** sends `{stages: [that one], alone: true}` and the stages after it keep their state |
| More competitors (Product & market page, below the competitors): tiles for every competitor proposed but not researched, an add-by-url form, **Research N competitors (about $X)** and **Search for more (about $0.03)**; while it works, what it is doing; after, what each stage did and that Market awareness and Avatars need a rerun | `run/MoreCompetitors.tsx`, `api/competitors.ts` | candidates are `run.resolution.competitors` less the researched ones; `POST /runs/:id/competitors/search`, `POST /runs/:id/competitors`; status from the latest `competitors.*` event. The stage bar's amber "proposed, not researched" chip jumps here |
| Product brief: price, pack and directions, offer, subscription terms, lab test, prices per option with price a serving, ingredients (form, standardisation, blend), claims, "Also on the page", each with a source link | `run/ProductBrief.tsx` | the `product` row, once stage 1's brief is accepted; price a serving is the option's amount ÷ (containers × `pack.servings_per_container`) |
| Avatars, three tabs. From reviews: an overview, one row per avatar built from reviews, largest first: name and reviews, a bar as long as its reviews split into one block per sub-avatar (grey: reviews in none), the sub-avatars as clickable names, share of reviews, ads and win rate. Clicking an avatar, block or name opens it: breadcrumb, badges, description, four tiles (reviews, ads, win rate, skepticism), its sub-avatars as bars to click into, pains/desires/triggers/objections/tried before/angles three each with "+N more", two quotes with "+N more", and outcomes, competitors' best angle and awareness counts behind "More". From ads: the same overview per market (lung market, same buyer), one row per stage 3 audience segment: a bar as long as its ads, one block per advertiser writing to it, the first five advertisers named ("+N more"), share of ads, advertisers and win rate. Clicking opens it: breadcrumb, description, four tiles (ads, win rate, advertisers, longest-running ad in days), each advertiser's ads as bars, pains/desires/triggers/objections/angles three each, and two of its ads (its example ads first) with "+N more". Gaps: four tiles worked out by code (most under-served, most crowded, avatars with no ads, themes the ads leave out and their commonest kind); the buyers-against-ads map (up: share of reviews; right: share of ads; size: reviews; bubbles numbered, with a numbered key beside it; a diagonal where ads match buyers, blue above it under-served, amber below crowded); gap by avatar (share of reviews minus share of ads, diverging bars); and a table of gap themes by kind per avatar. Clicking any avatar opens its shares and its themes, each opening to the reviews that say it | `run/Avatars.tsx`, `run/AvatarOverview.tsx`, `run/AvatarDetail.tsx`, `run/ProfileList.tsx`, `run/AdAvatars.tsx`, `run/AdAvatarDetail.tsx`, `run/StackedBar.tsx`, `run/AvatarGaps.tsx`, `run/AvatarMap.tsx`, `run/GapCharts.tsx`, `run/GapDetail.tsx` | `GET /runs/:id/avatars` (`avatars` with `source`, `profile.gaps`, `profile.quote_ad_ids`; `quotes` with `kind`), the run's ads |
| Competitors: Direct / Indirect / Context only, ordered by estimated sales, one row each with product shot, logo, form, domain, positioning, price, traction ("$52.7k/mo shop sales · #1 of 23 products", or "product sales · its only product"; hover for TrendTrack's range), review count, ad count and up to three ad creatives | `run/Competitors.tsx`, `run/Traction.tsx` | `competitors[]` (relationship decided by code), with reviews and ads from `run/use-evidence.ts` |
| Reviews: one row per product and source (count, average), click a row for its reviews, lowest ratings first | `run/Reviews.tsx` | `GET /runs/:id/reviews` (coverage, and `?competitor=<id>&limit=` for a page) |
| Long-form ads, Analysis tab (opens first): a takeaway sentence and tiles (ads analysed, distinct copies, lung market, same buyer), then who the ads are written for (segments per market as stacked bars), what they promise (promise per category; median days running and duplicates per promise; segment × promise grid), how they speak (page kind and opening awareness per category, 100% bars). General ads left out | `run/ads/Ads.tsx`, `run/ads/AdsAnalysis.tsx`, `run/ads/ad-digest.ts`, `run/ads/StackedBars.tsx`, `run/ads/HeatGrid.tsx` | `GET /runs/:id/ads` (`segment`, `reading.value_prop`, `page_kind`) |
| Long-form ads, All ads tab (opens first when the url has `?ads=`): the stage bar counts each category; one chip per category (all, direct competitor, same problem, same buyer, general, with counts) above a filter bar (page kind, bucket, brand, awareness, claim type, proof, offer, emotion, landing, structure; counts per value; kept in the url as `?ads=`) and a sort; each card with image, signals, a page-kind tag (brand page · bottom of funnel, community page · upper funnel, persona or authority page · top of funnel), its category and the search that found it, the bucket's reason (code's, from the ad's signals), the reader's claim, awareness and avatar, and the full copy | `run/ads/Ads.tsx`, `run/ads/AdGrid.tsx`, `run/AdCard.tsx`, `api/ads.ts` | `GET /runs/:id/ads` |
| Market awareness (stage 4 page): the five sophistication stages with the market's highlighted, its confidence and why; the claim census (claim, type, brands, ads, first seen, longest run, still running); one awareness bar per channel (ad openings, landing pages, Google and Amazon searches, Amazon listings, Reddit, reviews), "weighted by volume" where it is; the evidence list, each line linked | `run/Market.tsx` | `GET /runs/:id/market` (null until stage 4 has run: "Stage 4 has not read this market yet") |
| Live activity: a pulsing green Live pill with the running stage and time since the last update (amber when waiting for you, grey when ended); the last 60 events in plain English, timestamps in their own column, milestones bold, findings purple, problems amber. Only a live run is followed, so an ended run shows none | `run/Activity.tsx`, `run/activity-story.ts` (event to sentence) | `GET /runs/:id/events` (SSE) |

Pictures are addresses on the brands' own sites, read by stage 1 for free (`PageVisuals`: Shopify's `/products/<handle>.js` image or the page's og:image; the icon links or `/favicon.ico`). A brand whose picture fails to load shows a two-letter monogram (`BrandMark.tsx`). A competitor proposed by a retailer url (target.com) shows the retailer's icon as its logo.

## What failures look like

| On screen | Cause | Where to look |
|---|---|---|
| Status `Refused` and a banner naming a submit problem | An agent's submit was refused out, or it never submitted (`invalid`) | `mra calls <id>`: the last `submit` result lists the problems |
| Stage card `Skipped`, "needs X, which did not complete" | A stage it depends on failed or was refused | that stage's own card |
| Competitor under "Not profiled yet" with the stage completed | Its profiler agent did not get an accepted submit; the stage summary names why | the stage 1 card's summary |
| A product with "0 new (review app … not supported yet, no Amazon listing …)" in the stage 2 card | Its store runs a review app other than Judge.me and it is not on Amazon | `docs/gaps.md` §9 |
| Stage 3 `Failed`: "TRENDTRACK_API_KEY is not set" | No TrendTrack key in the container | `.env`, then `mra up` |
| Stage 5 `Skipped`, "needs competitor_ads, which did not complete" | Stage 5 waits for stages 1, 2 and 3; one of them failed | that stage's card |
| An avatar card with a dashed border and "emerging" | The judge found its evidence too thin to act on yet | its review count and confidence on the card |
| Stuck on `Finding the product` after a restart | It is not stuck: a restart ends live runs `failed` | refresh; the banner reads "the server restarted" |
