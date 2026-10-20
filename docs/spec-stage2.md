# Stage 2: market awareness and sophistication — the tools

*Proposed 2026-10-20. Not built.* What stage 2 must answer, where it sits in the
pipeline, and which tools give it evidence: what each costs and whether it was
seen working. `spec.md` §Stage 2 holds the rubrics; this file is how to fill them.

Read for it: `guide/research-compartment-supplement-mrr-v2.pdf` (the research
compartment, v2), `guide/5 Stages of Market Sophistication (META ADS Advanced
Creative Strategy).txt`, and `spec.md` §§2, 4, 5 and 6.

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

`STAGE_PLANS` today: stage 2 needs nothing, and avatars (stage 5) need stage 2.
That cannot work: sophistication needs the competitor ads (stage 4), and an
awareness distribution per avatar needs the avatars (stage 5).

**Proposed:** two parts.

1. **Stage 2, the market read,** needs stages 1, 3 and 4. It produces the
   market's sophistication stage with its evidence, and every evidence item
   labelled with an awareness level: each ad opening, landing page, search
   query and review marker.
2. **Stage 5's judge** already sets an awareness value for each avatar. It is
   handed stage 2's labelled items and returns, for each avatar:
   - an awareness distribution per channel, tallied by code from the items
     placed on that avatar;
   - a skepticism stage, citing its reviews by id.

Stage 2 then no longer runs alongside stages 1, 3 and 4. Avatars already wait
for it, so a run gets longer by stage 2's duration.

## Tools for sophistication

| Tool | Reads | Gives | Cost | Status |
|---|---|---|---|---|
| **Claim census** (code over stage 4) | This run's read ads: claim type, mechanism, first seen, days running, ring | Which claims are made, by how many brands, since when, still running or dead | Free | Data exists. The agent groups ads into named claims by ad id; code counts brands, earliest first seen, longest running |
| **Ad history** (`search_ad_history`, TrendTrack) | `POST /v1/ads/query` by a competitor's domain, `status: all`, `createdAfter` / `createdBefore` windows, `minDaysRunning` | Old and stopped ads: how each brand's claim escalated over 1–3 years | 1 credit per ad returned, plus about 1 per request (measured on stage 4); $0.0089 a credit | The parameters are in `trendtrack/api/Ads.md`; not yet called with `status: all` |
| **Page history** (Wayback Machine) | The CDX index `web.archive.org/cdx/search/cdx`, then one snapshot read directly | Headline and mechanism changes on a competitor's pages over time | Free | Seen working 2026-10-20: 40 monthly snapshots of trybetterbrand.com, Sep 2019 to May 2024 (the query's limit). None for mullevia.com product pages; small brands may have no history |
| **Marketplace listings** | Titles and bullet points of the top 30–50 Amazon listings for the category | How crowded and inflated the claims are | One of: Parallel search snippets (per search, already paid for), or an Apify Amazon search actor (old price $0.012 a listing; check current) | To choose |
| **Review skepticism markers** (stage 3 data) | Reviews by id: "tried everything", "skeptical at first", rival products named, self-blame | Skepticism stage per avatar | Model tokens only | Data exists |
| **Reddit** (official API, OAuth2) | `GET /search`, `GET /r/{sub}/search`, `GET /comments/{article}`, `GET /api/morechildren` | What people tried and gave up on; disbelief; self-blame | No fee within 60 requests a minute (archived API wiki) | Blocked: the Data API Terms require a separate agreement with Reddit for commercial use |

## Tools for awareness

| Tool | Reads | Gives | Cost | Status |
|---|---|---|---|---|
| **Ad opening awareness** (stage 4) | `awareness` on each read ad | The awareness level cold Meta traffic is met at, weighted by winning ads | Free | Data exists |
| **Landing entry point** | Each kept ad's landing url, through the existing `web_fetch` | Advertorial, quiz, listicle or product page. An advertorial meets a problem-aware reader; a product page meets a product-aware one | Firecrawl per page (unpriced in `charges` until measured) | Tool exists |
| **Search suggestions** | Google autocomplete (`suggestqueries.google.com`) and Amazon autocomplete (`completion.amazon.com`), seeded with the product, its key ingredient and its symptoms | What people type. The agent labels each query by level ("chest congestion after quitting smoking" is problem aware; "mullein for lungs" is solution aware; "vitanics mullein gummies" is product aware); code tallies | Free | Seen working 2026-10-20: "mullein for" returned ten Google suggestions ("mullein for copd reviews", "mullein for mucus"…); "mullein" returned ten Amazon suggestions ("vitanics mullein gummies for mucus"…) |
| **Search volume** | Monthly searches per query | Weights the query mix, so ten rare problem queries do not outvote one large brand query | Unknown | To choose. Google Trends refused with a 429 on 2026-10-20. Candidates not yet checked: DataForSEO, Google Ads Keyword Planner |
| **Review discovery markers** (stage 3 data) | Reviews by id: "first time trying", "my doctor recommended", "switched from X", reorders | The level each avatar arrived at when it bought | Model tokens only | Data exists |
| **Reddit questions** | As above | "Does mullein actually work?" is solution aware; "why do I cough every morning" is problem aware | As above | Blocked, as above |

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
- **Budgets**, like the stage 4 scout: TrendTrack history searches capped per
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
- Wayback Machine, autocomplete and stage 3 and 4 data: free.
- Landing pages: one Firecrawl read per distinct landing url.
- Model tokens: unknown until a faux-tested agent runs once on real data.

## Open decisions

1. **The pipeline change** above: stage 2 waits for stages 1, 3 and 4, and
   stage 5's judge produces the per-avatar part.
2. **Search volume source**: none chosen; nothing has been priced.
3. **Amazon listings route**: Parallel snippets or a paid Apify actor.
4. **Reddit**: only with an agreement with Reddit covering commercial use.
   Until then the stage is built without it.
