# Stage 4: market awareness and sophistication — the tools

*Proposed 2026-10-20; tools chosen the same day. Not built.* What stage 4 must answer, where it sits in the
pipeline, and which tools give it evidence: what each costs and whether it was
seen working. `spec.md` §Stage 4 holds the rubrics; this file is how to fill them.

Read for it: `guide/research-compartment-supplement-mrr-v2.pdf` (the research
compartment, v2), `guide/5 Stages of Market Sophistication (META ADS Advanced
Creative Strategy).txt`, and `spec.md` §§3, 4, 5 and 6.

## What the stage answers

Two questions, kept apart because they are measured differently.

| | Sophistication | Awareness |
|---|---|---|
| Question | How far have claims in this market escalated, and how skeptical is each group of buyers? | How much does a buyer already know when an ad reaches them? |
| Scale | Five stages: plain claim, bigger claim, mechanism, mechanism war, identity | Five levels: unaware, problem aware, solution aware, product aware, most aware |
| Unit | The market, and each avatar | Each avatar on each channel |
| Read from | Competitor creative over time; buyers' own words | Ad openings, landing pages, searches, buyers' own words |
| Done when (guide) | The stage can be defended by pointing at competitor creative, not by assertion | Every avatar and channel pair has an entry level |

Two points from the guides decide the shape:

- **Sophistication is read off the competitor landscape.** "Count how many
  competitors are making the same claim, how long it has been running, and how
  far they have escalated it." Escalation is the evidence.
- **Awareness is a distribution, and it depends on the channel.** The same
  avatar arrives problem-aware from a cold ad and product-aware from a branded
  search. One value for the market hides that.

The video adds a per-persona reading of sophistication: each avatar sits at its
own point on the skepticism scale (beginner, explorer, researcher, skeptic,
hopeless). Stage 5 of the scale, "hopeless", shows as self-blame in reviews
("I'm too far gone"). That is what the market-level stage cannot show.

## Where it sits in the pipeline

*Decided 2026-10-20.* This stage was stage 2 and needed nothing, while avatars
needed it. That could not work: sophistication needs the competitor ads, and an
awareness distribution per avatar needs the avatars. So it moved, and the
stages were renumbered: 1 product and market, 2 reviews, 3 competitor ads,
4 market awareness and sophistication, 5 avatars, 6 gaps, 7 generation
(`STAGE_PLANS`, `domain/stages.ts`).

It works in two parts:

1. **Stage 4, the market read,** needs stages 1, 2 and 3. It produces:
   - the market's sophistication stage with its evidence;
   - every evidence item labelled with an awareness level: each ad opening,
     landing page, search query and review marker.
2. **Stage 5's judge** already sets an awareness value for each avatar. It is
   handed stage 4's labelled items and returns, for each avatar:
   - an awareness distribution per channel, tallied by code from the items
     placed on that avatar;
   - a skepticism stage, citing its reviews by id.

Stage 4 does not run alongside stages 1 to 3. Avatars wait for it, so a run
gets longer by stage 4's duration.

## Tools for sophistication

| Tool | Reads | Gives | Cost | Status |
|---|---|---|---|---|
| **Claim census** (code over stage 3) | This run's read ads: claim type, mechanism, first seen, days running, ring | Which claims are made, by how many brands, since when, still running or dead | Free | Data exists. The agent groups ads into named claims by ad id; code counts brands, earliest first seen, longest running |
| **Ad history** (`search_ad_history`, TrendTrack) | `POST /v1/ads/query` by a competitor's domain, `status: all`, `createdAfter` / `createdBefore` windows, `minDaysRunning` | Old and stopped ads: how each brand's claim escalated over 1–3 years | 1 credit per ad returned, plus about 1 per request (measured on stage 3); $0.0089 a credit | The parameters are in `trendtrack/api/Ads.md`; not yet called with `status: all` |
| **Page history** (Wayback Machine) | The CDX index `web.archive.org/cdx/search/cdx`, then one snapshot read directly | Headline and mechanism changes on a competitor's pages over time | Free | Seen working 2026-10-20: 40 monthly snapshots of trybetterbrand.com, Sep 2019 to May 2024 (the query's limit). None for mullevia.com product pages; small brands may have no history |
| **Marketplace listings** (`search_amazon`) | Apify `apt_marble/amazon-search-results-scraper`: `keywords` (the category and solution queries), `maxResultsPerKeyword` 50, `marketplace` from the run's market, sponsored kept but flagged | Titles and bullet points of the top listings, organic rank and sponsored apart: how crowded and inflated the claims are | $0.0006 a listing (checked 2026-10-20): 50 listings about $0.03 | *Chosen 2026-10-20.* Not yet run; 101 users in 30 days, so its first run is checked by hand |
| **Review skepticism markers** (stage 2 data) | Reviews by id: "tried everything", "skeptical at first", rival products named, self-blame | Skepticism stage per avatar | Model tokens only | Data exists |
| **Reddit** (`search_reddit`) | Apify `coding-doctor-omar/reddit-scraper-pro`: `scrapingMode: keywordSearch`, `keywordsIncluded`, or `subredditUrls` for r/COPD-style communities; `includeComments` with `maxCommentsPerPost` and `maxCommentsDepth` capped (its defaults are 50,000 and 10) | What people tried and gave up on; disbelief; self-blame | No actor fee; Apify platform usage only (cents a run) | *Chosen 2026-10-20, with the risk accepted by the user:* it collects Reddit pages without the official API, and Reddit's User Agreement (effective July 1, 2026) prohibits scraping without Reddit's written consent |

## Tools for awareness

| Tool | Reads | Gives | Cost | Status |
|---|---|---|---|---|
| **Ad opening awareness** (stage 3) | `awareness` on each read ad | The awareness level cold Meta traffic is met at, weighted by winning ads | Free | Data exists |
| **Landing entry point** | Each kept ad's landing url, through the existing `web_fetch` | Advertorial, quiz, listicle or product page. An advertorial meets a problem-aware reader; a product page meets a product-aware one | Firecrawl per page (unpriced in `charges` until measured) | Tool exists |
| **Search suggestions** | Google autocomplete (`suggestqueries.google.com`) and Amazon autocomplete (`completion.amazon.com`), seeded with the product, its key ingredient and its symptoms | What people type. The agent labels each query by level ("chest congestion after quitting smoking" is problem aware; "mullein for lungs" is solution aware; "vitanics mullein gummies" is product aware); code tallies | Free | Seen working 2026-10-20: "mullein for" returned ten Google suggestions ("mullein for copd reviews", "mullein for mucus"…); "mullein" returned ten Amazon suggestions ("vitanics mullein gummies for mucus"…) |
| **Search volume** (`search_volume`) | Apify `memo23/keyword-metrics`: `mode: metrics`, `keywords` (every query autocomplete returned), `country` from the run's market, `includeBing: false` (Bing is a second billed batch) | Google Ads monthly volume per query, with monthly history, so ten rare problem queries do not outvote one large brand query | $0.05 a run plus $0.25 per batch of up to 1,000 keywords: one run about $0.30 | *Chosen 2026-10-20.* Google Trends refused with a 429; Keyword Planner direct needs a Google Ads account and shows ranges without spend |
| **Review discovery markers** (stage 2 data) | Reviews by id: "first time trying", "my doctor recommended", "switched from X", reorders | The level each avatar arrived at when it bought | Model tokens only | Data exists |
| **Reddit questions** | As above | "Does mullein actually work?" is solution aware; "why do I cough every morning" is problem aware | As above | As above |

## How the agent works

One agent, `market_reader`, with the tools above. It ends only through
`submit`, with a zod schema in `domain`:

- **Evidence is named by id, never retyped**: ad id, review id, query id,
  snapshot id. Code copies the text into the report.
- **The model labels, code counts.** The agent gives each item a level or a
  claim group. Code computes:
  - every count, share and distribution (a tally in `extract`);
  - each claim group's earliest first-seen date.
- **Code checks on the submission:**
  - every cited id was returned by a tool in this run;
  - every claim group holds at least one ad;
  - the chosen stage cites the claim groups it rests on;
  - no distribution is written by the model.
- **Budgets**, like the stage 3 scout: TrendTrack history searches capped per
  run; Wayback, autocomplete and review reads free; a turn limit.

Storage: `market_assessments` holds one `awareness_level` today. A new
migration replaces it with a distribution per channel. The per-avatar
awareness and skepticism stage go in `avatars.profile`.

## What the user sees

The Market page from `spec.md` §UI:
- the claim timeline: claim types stacked by month first seen, from the claim
  census and ad history;
- the awareness distribution per channel;
- the evidence list, every line linked to its ad, page, snapshot, query or
  review.

On each avatar card: its awareness distribution and its skepticism stage, with
the reviews that set it.

## Rough cost per run

- TrendTrack history: 10 searches of up to 20 ads, about 210 credits at most,
  about $1.90.
- Wayback Machine, autocomplete and stage 2 and 3 data: free.
- Search volume: about $0.30.
- Amazon listings: about $0.03 for 50.
- Reddit: Apify platform usage only, a few cents with the comment caps.
- Landing pages: one Firecrawl read per distinct landing url.
- Model tokens: unknown until a faux-tested agent runs once on real data.

## Apify, again

Search volume, Amazon listings and Reddit all run on Apify, which the
2026-10-17 rewrite removed. It comes back as one adapter, as before
(`git show b6f45cc:server/src/adapters/apify/`):

- `APIFY_TOKEN` read in `settings.ts`, and nowhere else.
- Every run is given `maxTotalChargeUsd`, sized from its limits; Apify refuses a
  cap below an actor's floor, so the cap is floored per actor.
- Every run's charge is a `charges` row (`service: "apify"`, which
  `COST_SERVICES` already lists), so the run's cost includes it.
- An empty dataset on a run that says it succeeded is reported as a failure to
  read, never as "no results" (measured on the old code: a wall can fetch
  successfully).

## Decisions

- 2026-10-20, search volume: `memo23/keyword-metrics`.
- 2026-10-20, Amazon listings: `apt_marble/amazon-search-results-scraper`.
- 2026-10-20, Reddit: `coding-doctor-omar/reddit-scraper-pro`, the risk under
  Reddit's User Agreement accepted by the user.
