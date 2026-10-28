# How a run works

The Avatar Strategist rewrite of 2026-10-17 (`docs/spec.md`). The earlier
workings, stage-1 ledger roles, durable tasks and the operator, are in git
history before commit `b6f45cc`.

## One run, end to end

A run is one analysis of one product. It has two phases with the user in
between, and it moves through these statuses (`domain/runs.ts`):

```
resolving ──▶ awaiting_confirmation ──(user confirms)──▶ running ──▶ completed | invalid | failed | cancelled
```

1. **Start.** `POST /api/research/runs` with an `AnalysisInput`
   (`domain/analysis-input.ts`): `product_url` or `product_name`, `markets`
   (default `["US"]`). zod refuses a url typed as a product name with a 422 before
   anything is spent. The run row is created with every stage `pending` if it is
   built, `not_built` if not (`Stages.initial`).
2. **Resolve.** `RunLauncher.resolve` runs one agent, `resolver`
   (`agent/resolve/product-resolver.ts`), with `web_search`, `web_fetch` and
   `ad_search`. It must submit a `Resolution`: the product page, up to five
   alternatives when only a name was given, and 3–15 competitors. Code refuses
   the submit if the product page was never read with `web_fetch`, or if any
   competitor url never appeared in a search result, an ad's landing page or a
   page it read (`UrlLedger.unknown`), or if an Amazon competitor url is not a
   product page (a search page was proposed on 2026-10-19). Accepted, code reads
   the product shot and logo of every proposed url for free
   (`ResolutionVisuals`, cached by url in `brand_visuals`, which stage 1 then
   reuses), and, for every proposed Shopify product page, looks up its
   TrendTrack shop for free (`ResolutionSignals`: monthly visits, active ads,
   cached by domain in `shop_signals`; a marketplace listing is skipped so it
   never inherits the marketplace's traffic). The run waits at
   `awaiting_confirmation`.
3. **Confirm.** `POST /runs/:id/confirm` with the chosen product url and the
   competitors the user kept or added. The product row is upserted (one per
   account and url) and the picks are marked `confirmed`; any competitor of that
   product left out is set back to `proposed`, not deleted.
4. **Research.** `RunLauncher.research` hands the product and the confirmed
   competitors to the `Pipeline`, which runs each built stage as soon as every
   stage it needs has completed (`STAGE_PLANS` in `domain/stages.ts`). A stage
   whose input did not complete is `skipped` with the reason. Stage states are
   written whole after each change, one write at a time (`StageProgress`), so
   stages running side by side never overwrite each other.
5. **End.** `RunEnd.end` (`agent/run-end.ts`) is the only place a run gets a
   final status. It totals the run's charges into `cost_usd` first. The verdict:
   stopped → `cancelled`; any stage `failed` → `failed`; any `invalid` →
   `invalid`; otherwise `completed`.

## Rerunning stages

Any stage of a finished run can be run again, or all of them
(`POST /runs/:id/rerun` with `{stages}`, the Rerun buttons on the stage cards
and "Rerun all stages" on the run page, `mra rerun <id> <stage>…`). A finished
run whose stages did not all complete also offers to run just those (the
prompt on the run page; the request without `stages`).

`Stages.toRerun` decides what runs: the chosen stages, every built stage that
uses one of them however indirectly (`Stages.downstream`, from `STAGE_PLANS`
needs: rerunning stage 3 reruns stage 5, stage 1 reruns 3 and 5), and every
stage that did not complete. `/config` lists each stage's downstream set as
`reruns`, so the page shows what a click will run before anything is spent.
`Stages.rerun` sets those back to waiting and keeps every other stage as it
is; the pipeline counts a completed stage as done without running it. The run
ends through `RunEnd` as before; its cost is the total of all its charges,
every attempt.

What a rerun replaces: stage 1 overwrites the brief and the profiles; stage 2
adds only reviews it has not stored (they belong to the product); stage 3
deletes its run's ads before the pool is pulled (`AdTable.clear`, ads belong to
the run since migration 8); stage 5 replaces its run's avatars.

## More competitors for a finished run

The resolver proposes 5 to 15 competitors and the user confirms some; the rest
stay only in `run.resolution`. A finished run can take more without its stages
running again, from the "More competitors" panel on the Product & market page:

- **Search** (`POST /runs/:id/competitors/search`, `CompetitorService.search`):
  the `competitor_search` agent (`agent/resolve/competitor-search.ts`, 20 turns,
  `web_search`, `web_fetch`, `ad_search`) is given every competitor url the run
  already knows, confirmed or proposed, and submits up to 15 more.
  `CompetitorUrlCheck` (shared with the resolver) refuses a url it never met,
  the product itself, an Amazon page that is not a listing, and any url already
  known. What it finds is appended to `run.resolution.competitors`, with
  pictures and shop signals, and shows as tiles to pick.
- **Add** (`POST /runs/:id/competitors` with `{competitors}`,
  `CompetitorService.add`): refused for a competitor already researched. The
  picks are confirmed (`CompetitorStore.add`, which, unlike `confirm`, demotes
  nobody), then `Pipeline.add` runs each stage's `add`, for those competitors
  only: stage 1 profiles and classifies them and collects their pictures and
  TrendTrack traction, without redoing the brief; stage 2 collects their
  reviews, not the client's again; stage 3 makes no new search and gives them
  the ads this run already kept that land on their sites (`AdStore.link`).
  Stages 4 and 5 are not run; the panel says to rerun them to include the new
  competitors.

Either way the run is `running` while the work goes on, the stage states are
left as they were, and it ends through `RunEnd` with those states' verdict and
a cost that now includes this work. A deploy or restart in the middle ends it
`failed`, like any working run.

Cost, measured from run `344caa7d`'s charges: the original resolver came to
$0.032 (OpenRouter $0.004, Parallel $0.010, TrendTrack $0.018), so a search is
shown as about $0.03. One added competitor came to about $0.09: profiling about
$0.003 (four profiles, $0.0085 of tokens and one $0.005 search), its Amazon
listing finder about $0.02 ($0.12 over six), and its TrendTrack shop record
$0.064 ($0.32 over five). Review collection itself recorded no charge.
Firecrawl page reads are not priced in either figure.

## How an agent ends

Every agent is driven by `AgentRunner` (`agent/kernel/agent-runner.ts`) and
ends in exactly one way: a `submit` tool whose parameters are the domain zod
schema turned into JSON Schema (`Schemas.json`). pi-ai validates the arguments
against that schema before the tool runs; the tool then parses them with zod
and runs the job's own code checks. A refusal goes back to the model with each
problem numbered; after 3 refusals the agent is stopped (`SubmitTool`). A top-level array or object
the model sends as JSON text is parsed back before validation
(`SubmitTool.unpacked`, pi-agent-core's `prepareArguments`): on 2026-10-26 a
GLM ad reader sent its readings as one string three times and lost the batch.

- A turn that ends in text alone, or is cut off at the output cap, without a
  submit, gets a reminder, at most twice (`TurnPolicy`). The turn ceiling is
  per job.
- Every reply is capped at 40,000 output tokens, reasoning included
  (`AgentRunner.MAX_OUTPUT_TOKENS`). The largest reply that ended normally in
  the call log was 33,822 tokens (an `ad_reader` turn, about 88% reasoning).
  Without a cap, a GLM-5.3-flash reader turn on 2026-10-21 streamed for 67
  minutes until a restart ended it.
- A job may set its reasoning level (`AgentJob.reasoning`, pi-ai's
  `thinkingLevel`); left unset, the model's default applies. GLM-5.3-flash
  cannot turn reasoning off, and at its default spent about 25,000 output
  tokens and 2 to 9 minutes on each 40-review avatar batch (run `344caa7d`,
  2026-10-19), where DeepSeek v4.1 flash took 6 to 50 seconds. The three
  avatar agents ask for `low`.
- A dropped stream is resumed, up to 3 times with backoff, on the next model in
  `MRA_MODEL` + `MRA_BACKUP_MODELS` (`ModelChain`, `Retries`). Terminal errors
  (quota, auth, context length) are not retried.
- An agent whose turn sends exactly the tool calls (names and arguments) its
  previous turn sent is moved, alone, to the next model in that chain for
  its next turn, with a message saying why (`RepeatedTurns`, through
  pi-agent-core's `prepareNextTurn`); the run gets an `agent.model_switched`
  event. The run's other agents keep their model.
- The result is `completed` (accepted), `invalid` (it ended without an accepted
  submit: refused out, turn limit, or never submitted), `failed` (the model
  could not be reached) or `cancelled` (the run was stopped). `invalid` is not
  `failed`.

## Stage 1: product and market research

`ProductMarketStage` (`agent/stages/product-market/`):

1. **Product brief**, agent `product_brief`, 25 turns, `web_search` and
   `web_fetch`. Submits a `ProductBrief`: brand, name, category, `form_factor`
   (a closed list), `key_active`, price, offer, every price point (label,
   containers, subscription or not), subscription terms, the pack (net
   contents, serving size, servings per container and per day, directions),
   ingredients with dose, form, standardisation and whether they sit in a
   proprietary blend, claims word for word, the certificate-of-analysis url, and
   `miscellaneous` (labelled facts no other field holds). Every `source_url`
   must be a page that agent read; code refuses any other. Code also refuses a
   price point not shown on its page (`PriceCheck`), a servings count not on
   the pack's page, and a pack whose net contents ÷ serving size is more than
   10% off its servings count, when the two units match (`PackCheck`).
2. **Competitor profiles**, one agent per confirmed competitor
   (`competitor:<domain>`), 15 turns each, four at a time. Each submits a
   `CompetitorProfile`: platform, form factor, `has_key_active`, how the page
   names the key active, price, positioning, sources it read.
3. **Shop traction**, beside the brief (`ShopTractionCollector`): for the
   client and each confirmed competitor on a Shopify product page, TrendTrack's
   `GET /v1/shops/{id}` (estimated 30-day revenue for the whole shop, its range,
   units, visits, products count; 4 credits) and, when the shop sells more than
   one product, one page of `/products?sortBy=popularity` to find the product's
   best-seller rank (4 credits). A one-product shop's sales are the product's.
   Failures are reported in the `traction.collected` event, not hidden.
4. **Classification is code, not the agent** (`CompetitorRelationship.classify`):
   no key active → `other`; same form factor as the client → `direct`; else
   `indirect`. The agent only reports what the page shows.

The stage completes when the brief is accepted and at least one competitor is
profiled; the summary names any competitor that could not be. Not built yet in
stage 1: ranking (it needs stages 2 and 3), product images and label reading,
economics, market size, Scira.

## Stage 2: reviews

`ReviewStage` (`agent/stages/reviews/`) starts as soon as the user confirms;
it needs nothing from stage 1. For the client's product and each confirmed
competitor, three at a time:

1. **Where its reviews are** (`ReviewListings`). An Amazon url gives the ASIN
   (Amazon's ten-character product code) directly. Otherwise the server reads
   the page itself (`ShopifyStorefront`, a plain request, no service): the
   shop's `myshopify.com` domain, the product id from Shopify's public
   `/products/<handle>.js`, and which review apps the theme loads. Judge.me is
   read; any other app is noted as not supported. Then an agent
   (`amazon_listing:<id>`, `web_search` only, 6 turns) looks for the same
   product on Amazon; code accepts its url only if it appeared in a search
   result and contains `/dp/` and an ASIN.
2. **Collect** up to `MRA_REVIEWS_PER_PRODUCT` (500): Judge.me first
   (`JudgemeReviews`, the widget's own public endpoint, 30 a page), then Amazon
   to fill (`WootReviews`, woot.com's endpoint, 10 a page, star bands 3, 1, 2,
   4, 5 at up to `MRA_REVIEWS_PER_BAND` (100) each, one request every
   `MRA_WOOT_DELAY_MS` (2000)). Both are free. Text is kept as written, with
   markup and entities decoded; reviewer names are never stored.
3. **Store** (`ReviewTable`): one row per review per target. The content hash
   (source, rating, body with case and spacing normalised) is unique per
   product and competitor, so a rerun adds only what is new. The ASIN and
   review app go on the product or competitor row.

The stage completes when any review was stored; its summary has one line per
product: how many were new, from which source, and why a source is missing.
Measured 2026-10-17 against the real endpoints: Mullevia's Judge.me gave all 31
reviews (stars 19/8/2/0/2, matching the widget's own histogram); Woot gave 25
reviews of one ASIN in 12 s.

## Stage 3: the market's long-form statics

`CompetitorAdStage` (`agent/stages/ads/`) waits for stage 1. Since
2026-10-26 four agents pull the ads, one per ring; before that code pulled
the top ads for one term under four sorts (`AdPool`), and before that one
agent (the scout) chose its own searches and kept 5 ads of a market of 3,637
(see `docs/spec.md`, decisions).

1. **Pull** (`AdPull`, `RingScout`, agents `ring_scout:<ring>`, all four at
   once): the pool is `MRA_AD_POOL_SIZE` (400) ads, shared 40% direct
   competitor, 25% same problem, 25% same buyer, 10% general (`AdRings.quotas`;
   the rounding goes to direct competitor). Each scout has `pull_ads`,
   `read_ad` (an ad's whole copy, free) and `find_ad_categories` (TrendTrack's
   `GET /v1/facets/categories`). Code holds every `pull_ads` to TrendTrack
   `POST /v1/ads/query` with `status: active`, `mediaType: image`,
   `minDescriptionLength` `MRA_AD_MIN_COPY_CHARS` (3000), `minDaysRunning` at
   least `MRA_AD_MIN_DAYS_RUNNING` (10) and the run's markets in
   `adCountries`; the agent picks the terms and where they are looked for
   (ad copy, brand, landing domain), any/all, the sort (longest running, most
   duplicated, reach, 7-day reach growth), a higher days floor, a duplicates
   floor, category ids, audience age and sex, the page and up to 50 per page.
   Each ad shown gets a short ref (a1, a2, …); each scout may be shown at most
   2.5 times its quota, and the page size shrinks to what is left. The scout
   submits the refs it keeps. Code refuses a ref it was never shown, one kept
   twice, more than the quota, and fewer than the quota without a stated
   shortfall; a shortfall is taken only once every search it ran is paged to
   the end, its budget is spent, or it has made 8 searches. An ad two scouts
   kept stays in the ring listed first (direct competitor, same problem, same
   buyer, general). The search that first found an ad is stored as its
   `ring_why`.
   A page of a search already sent (same settings, same page) is refused
   without being fetched or billed, and the refusal echoes the settings as
   received. On run `344caa7d` (2026-10-26) the same-problem scout's calls
   all arrived as `{"category_ids": [178], "keyword_mode": "any"}` whatever
   it wrote, so it re-bought the same pages and spent its budget on them.
2. **Store** (`AdTable`): every kept ad with its ring, linked to a confirmed
   competitor by landing domain, and bucketed by code from its signals
   (`AdBuckets`): winning once it has run 10 days, or sooner while still
   running with 400+ reach in 7 days or 5+ duplicates; testing while running
   without either; dead when it stopped before 10 days. With the pull's
   10-day floor every ad is winning.
3. **Read**: the same copy often runs many times from several pages (one
   Mullevia script ran as 77 ads), so code groups ads whose copy matches once
   case, spacing and punctuation are set aside (`AdScripts`) and only the
   first ad of each script is read. Agents (`ad_reader:<n>`, no tools,
   reasoning low), told the client's product, take 8 scripts at a time and
   record the avatar, the leading promise (`value_prop`, one of eight: the
   real cause the treatment cannot reach, "managed" numbers hiding damage, a
   better form after a cheap one failed, a ritual to replace, a suppressed or
   forgotten remedy, a way off drugs or surgery, a brand notice, a plain
   introduction), claim type, awareness, mechanism, proof, offer, objections, emotion, risk
   flags, and five closed lists so ads can be counted together: proof kinds,
   offer kinds, the emotion the opening leads with, where the click lands
   (read from the landing url; `unknown` when it does not say) and how the
   copy is built. Code refuses a batch that skips, invents or repeats an ad
   id, and any value outside a list; it then copies each reading to every ad
   of the script.
4. **Sort pages** (`PageSorter`, agents `page_sorter:<n>`, no tools,
   reasoning low), at the same time as the reading: each distinct advertiser
   page once, under a short handle (p1, p2, …: page name, landing domain, ads
   kept, one ad's opening), 60 pages a call, tagged with who the ads speak
   as: `brand` (the brand's own page, bottom of the funnel), `community` (a
   made-up community, publication or outlet, upper funnel), `persona` (a
   private person's name, top of the funnel) or `authority` (an expert's
   name with a credential, top of the funnel). Code refuses a page left
   out, invented or sorted twice, then gives every ad its page's kind
   (`ads.page_kind`, migration 13). A batch that cannot be sorted leaves its
   ads untagged and ends the stage `invalid`, ads kept.

5. **Segment audiences** (`AudienceSegmenter`), after reading, per market:
   the client's market (direct competitor and same problem) and same buyer;
   general ads are not segmented. One agent (`segment_namer:<market>`) sees
   every distinct copy of the market once (handle, who it speaks to, its
   opening) and names 3 to 10 segments; then agents
   (`segment_sorter:<market>:<n>`) sort the copies into those segments, 25 a
   call. Code refuses a copy left out, invented, sorted twice, or put in a
   segment that was not named, and gives every ad of a copy its segment's name
   (`ads.segment`, migration 14). Ads that cannot be sorted end the stage
   `invalid`, ads kept. Segments are named per run, from the ads, because a
   fixed list would fit one product only.

The long-form ads page opens on an Analysis tab, counted in the browser from
the run's ads (`run/ads/ad-digest.ts`): segments per market, promises per
category, median days running and duplicates per promise, segment × promise,
page kinds and opening awareness per category. All ads is the second tab.

That is the whole stage. Grouping into angles, checking each angle's fit
and writing findings (`AngleGrouper`, `AngleFitter`, `FindingsWriter`, the
counted page at `GET /runs/:id/ads/analysis`) were removed on 2026-10-26
(migration 12 drops `ad_angles` and `ad_findings`); `docs/spec.md`,
decisions, says why.

Stages 4 and 5 use only read ads, and count as supply only confirmed
competitors' ads and ads kept in `direct_competitor` or `same_problem`
(`AdRings.isSupply`).

The code sweep before it (keywords from an agent, then fixed searches) was
removed on 2026-10-19: on run `344caa7d` its one-word keywords pulled in dental
and pet ads, and it paid for 540 rows to keep 150.

## Stage 4: market awareness and sophistication

`MarketStage` (`agent/stages/market/`) waits for stages 1, 2 and 3
(`docs/spec-stage4.md`). One agent, `market_reader` (50 turns), answers two
separate questions:

- **Sophistication**: how far the market's claims have escalated, stage 1 to
  5. It groups this run's ads into claims, and looks at a competitor's past
  ads and its pages over time.
- **Awareness**: how much a buyer already knows, per channel. It labels each
  piece of buyer evidence: unaware, problem aware, solution aware, product
  aware, most aware.

Its tools, each logged in `MarketLog` under the id the agent cites:

| Tool | Source | Cost | Limit |
|---|---|---|---|
| `list_ads` | this run's read ads | free | — |
| `search_ad_history` | TrendTrack, a domain's ads, running and stopped, optional first-seen window | credits per ad | `MRA_MARKET_HISTORY_SEARCHES` (8) |
| `page_history`, `read_snapshot` | Wayback Machine CDX index, then the raw snapshot reduced to text | free | 6, 12 |
| `search_suggestions` | Google and Amazon search-box completions (Amazon: US and UK only) | free | 20 |
| `search_volume` | Apify `memo23/keyword-metrics`, Google only | about $0.30 a call | `MRA_MARKET_PAID_CALLS` (2) |
| `search_amazon` | Apify `apt_marble/amazon-search-results-scraper`, 30 a search | about $0.02 a call | 2 |
| `search_reddit` | Apify `coding-doctor-omar/reddit-scraper-pro`, 25 posts, 15 comments each, 2 deep | platform time | 2 |
| `find_reviews` | stored reviews containing a phrase | free | 20 |
| `read_landing` | an ad's landing page, through the page reader | Firecrawl per page | 6 |

The Apify tools exist only with `APIFY_TOKEN`. Before an actor runs, its
input is checked against the actor's current input schema (a free read,
cached per process); a field the actor no longer accepts stops the run with
the field named. That happened on 2026-10-21: the Reddit actor replaced
`keywordsIncluded` with `query`, ran its default search, returned nothing and
was charged.

Every Apify run is charged as Apify billed it (`usageTotalUsd`, which includes
per-result charges; the STARTER plan pays BRONZE prices), read once the charge
has settled:
- **Why it waits:** Apify adds per-result charges after the run finishes.
  Measured 2026-10-21: $0 at 12 s, final at 16 s.
- **How the lookup works:** it waits `MRA_APIFY_SETTLE_SECONDS` (60) after
  the run finished, then reads until two reads 15 s apart agree.
- **Why the run waits for it:** the lookup is deferred through `BilledCosts`,
  so the run waits for it before totalling its cost.
- **What it fixed:** reading at finish recorded $0.0001 for a memo23 run Apify
  billed $0.30.

A run still going after `MRA_APIFY_WAIT_SECONDS` (600) is aborted. An empty
dataset is an error, never "no results".

**Code checks** on the submission: every claim group cites only ads a tool
showed; the stage rests on submitted claim groups; cited snapshots were read;
labels go only on queries, listings, Reddit posts, reviews and landing pages,
each once. Ads carry their own awareness from stage 3.

**Code counts** everything (`MarketTally`):
- **The claim census:** each claim's brands, earliest first seen, longest run,
  and how many of its ads are still running.
- **Awareness shares per channel:**
  - Google searches weighted by monthly volume, when every query has one;
  - Amazon listings weighted by number of ratings;
  - competitor ad openings from stage 3's readings of supply ads.

The result is one `market_assessments` row per run, served at
`GET /runs/:id/market`.

**Stage 5 reads it.**
- The judge is told the market's stage.
- It gives each avatar a skepticism stage (1 beginner to 5 hopeless), citing
  that avatar's own reviews; code refuses another avatar's.
- Code counts each avatar's awareness:
  - from its ads' openings;
  - from the stage 4 labels on its reviews.

## Stage 5: avatars

`AvatarStage` (`agent/stages/avatars/`) needs stages 1, 2 and 3 (and 4 once it
exists). An agent builds the avatars by reading, not by clustering (spec,
2026-10-17):

1. **Read the reviews into a memory.** Every stored review of the analysis,
   dealt round-robin across product and star rating (`ReviewOrder`) into
   batches of 40, read one batch at a time (`avatar_reader:<n>`, no tools). Each
   agent sees the memory so far (`MemoryView`: every avatar's key, description,
   counts and lists) and the batch (review ids, stars, source, verified, date,
   text), and submits a `MemoryUpdate`: create, revise (replace fields, which is
   how lists get condensed), merge, assign every review to an avatar or none,
   and quote reviews by id. `AvatarMemoryCheck` (`extract/`) refuses an unknown
   key, a review left out, invented or assigned twice, or a quote
   from a review assigned elsewhere; `AvatarMemoryBook` applies the rest, merges
   last so everything moves with them. The memory is stored after every batch
   (`avatar_memories`). A batch refused three times is left out and counted in
   the summary.
   The reader builds broad avatars only, a user group or demography: its
   `create` has no `parent`.
2. **Split each avatar into sub-avatars.** For every avatar with at least 10
   reviews, one after another, an agent (`sub_avatar_splitter:<key>:<n>`, no
   tools) reads that avatar's own reviews, 100 a batch, into a memory of its
   sub-avatars: the same `MemoryUpdate`, `AvatarMemoryCheck` and
   `AvatarMemoryBook.apply` as step 1, on a memory that holds only this
   avatar's sub-avatars. A review assigned to none, or in a refused batch,
   stays with the avatar. The check also refuses a key another avatar already
   holds. `AvatarMemoryBook.graft` then hangs the sub-avatars under the avatar,
   moving their reviews and quotes from it. How many there are, none included,
   is the agent's call.
3. **Hold the floor** (`AvatarFloor`, code): a sub-avatar with fewer than 5
   reviews is folded into its parent, reviews, quotes and ads with it; an
   avatar with fewer than 15 is kept but reported `emerging` whatever its
   verdict. The reader and splitter are told their numbers. It is a clustering
   that must not overfit: no sub-avatar off one review.
4. **Place the ads.** Every read lung-market and same-buyer ad from stage 3
   (general ads left out), 15 at a time (`ad_placer:<n>`), each on an avatar or
   none.
5. **Judge** (`avatar_judge`), **find gaps** and **write ad avatars**, at once:
   - the judge gives every avatar its awareness level, confidence, standing
     and the best angle among the ads placed on it;
   - per top-level review avatar, `gap_finder:<key>` sees the avatar, up to 30
     of its reviews (its quotes first, then spread across star ratings,
     `GapFinder.sample`) and the ads placed on it, and lists up to 8 themes its
     reviews raise that none of those ads say (pain, desire, trigger,
     objection, outcome, tried before), each citing one to four of the given
     reviews; code refuses a review it was not given;
   - per stage 3 audience segment, `ad_avatar:<n>` writes the avatar those ads
     are aimed at from each distinct copy's reading, naming one to three of the
     segment's ads; code refuses an ad outside the segment. For a same-buyer
     segment it is also given the client's top-level review avatars and says
     why the segment is the client's buyer (`same_buyer`): which of those
     avatars its readers are, by key (code refuses a key not listed; null when
     none), what they share in one sentence, and what of its ads carries over
     (angles, hooks, story structures, proof formats, offers).
6. **Count** (`AvatarTally` for review avatars, `AdAvatarTally` for ad
   avatars): a top-level avatar counts its sub-avatars' reviews and ads too;
   demand share is its reviews over all reviews assigned to any avatar; supply
   share is its ads over all placed ads (for an ad avatar, over all segmented
   ads); win rate is its ads judged winning over its ads. An ad avatar under 5
   ads is emerging. Stored in `avatars` with `source` reviews or ads (migration
   15), the gap themes in the avatar's profile, and reviews, quotes, ads and the
   reviews a gap cites (`gap`) in `avatar_members`.

The avatars page has three tabs: from reviews, from ads, and gaps (the
demand-versus-supply map, then each review avatar most under-served first,
with its themes and the reviews behind them).

## The first real run, 2026-10-19

Run `344caa7d`: Mullevia, US, five competitors. Resolving took about 2 minutes
and proposed 11 competitors, of which 5 were kept. Stage 1 completed (5
ingredients, 9 claims, 5 of 5 profiled; the capsules came out indirect, the
four droppers direct). Stage 2 stored 874 reviews: Mullevia 38 (Judge.me),
Betterbrand tincture 370 and capsules 312, Havasu 130 (its Amazon listing found
from a Target url), OriginDrops 24, all Amazon through Woot, each fewer than 500
because Woot's star bands ran out; Ethale 0 (its reviews are on an app this does
not read). Stage 3 failed on `maxAdsPerBrand` (fixed above). Billed: $0.176, of
which OpenRouter $0.043 over 44 calls, Parallel $0.115 (the Amazon listing
finder's 20 searches were $0.10), TrendTrack $0.018; 16 Firecrawl pages are
unpriced because `MRA_FIRECRAWL_USD_PER_PAGE` is not set.

## What a run costs, and where that is recorded

Billed, never calculated. Every paid call writes a `charges` row as it
returns, tagged with the agent whose tool made it: Parallel searches at their
listed price, Firecrawl pages at `MRA_FIRECRAWL_USD_PER_PAGE` (null when unset),
TrendTrack in credits. Each LLM call's billed cost is looked up from
OpenRouter's `/generation`, which 404s for a few seconds after a turn, so the
lookup retries and the run waits for every pending one before `RunEnd` totals
the charges (`BilledCosts`). A charge with no price is counted as unpriced, not
as zero.

## Where to look

| Question | Where |
|---|---|
| What the agent did, turn by turn | `GET /runs/:id/calls`, `mra calls` |
| What each tool call fetched | `run_events` (`tool.called`), the run page's live activity |
| Every function and HTTP request | `GET /runs/:id/trace`, `mra trace` |
| What it spent | `GET /runs/:id/charges` |
