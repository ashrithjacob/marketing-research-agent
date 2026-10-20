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
   (default `["US"]`), and optional `known_competitors`, `brand_constraints`,
   `price_offer`. zod refuses a url typed as a product name with a 422 before
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
deletes its run's ads before the scout starts (`AdTable.clear`, ads belong to
the run since migration 8); stage 5 replaces its run's avatars.

## How an agent ends

Every agent is driven by `AgentRunner` (`agent/kernel/agent-runner.ts`) and
ends in exactly one way: a `submit` tool whose parameters are the domain zod
schema turned into JSON Schema (`Schemas.json`). pi-ai validates the arguments
against that schema before the tool runs; the tool then parses them with zod
and runs the job's own code checks. A refusal goes back to the model with each
problem numbered; after 3 refusals the agent is stopped (`SubmitTool`).

- A turn that ends in text alone, without a submit, gets a reminder, at most
  twice (`TurnPolicy`). The turn ceiling is per job.
- A dropped stream is resumed, up to 3 times with backoff, on the next model in
  `MRA_MODEL` + `MRA_BACKUP_MODELS` (`ModelChain`, `Retries`). Terminal errors
  (quota, auth, context length) are not retried.
- The result is `completed` (accepted), `invalid` (it ended without an accepted
  submit: refused out, turn limit, or never submitted), `failed` (the model
  could not be reached) or `cancelled` (the run was stopped). `invalid` is not
  `failed`.

## Stage 1: product and market research

`ProductMarketStage` (`agent/stages/product-market/`):

1. **Product brief**, agent `product_brief`, 25 turns, `web_search` and
   `web_fetch`. Submits a `ProductBrief`: brand, name, category, `form_factor`
   (a closed list), `key_active`, price, offer, ingredients with doses, claims
   word for word. Every `source_url` must be a page that agent read; code
   refuses any other.
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
2026-10-19 an agent decides which brands and ads matter; code only checks its
work and keeps the books.

1. **Scout** (`AdScout`, agent `ad_scout`, 40 turns), briefed as a growth
   marketer with the client's product, claims and confirmed competitors, and
   the four rings to study (`prompt/text/ad-scout.ts`): direct competitors
   (same product), same problem (another product for the same buyer at the
   same moment of pain), same buyer (another problem, the same age, gender
   and awareness: formats to borrow) and trending shop (winning long-form
   statics from a shop on TrendTrack's trending feed, any market: structures
   to apply to the client's store). Only the first two count as supply in the
   avatars (`AdRings.isSupply`). Its tools:
   - `search_ads` (`SearchLongFormTool`): TrendTrack `POST /v1/ads/query` for
     image ads with `MRA_AD_MIN_COPY_CHARS` (2000) characters of copy in the
     run's markets, by ad copy, brand or domain, sorted as it chooses (only
     sorts the API accepts: `AD_SORTS`), 1–20 ads. Each result shows id,
     advertiser, landing domain, days running, duplicates, reach and 7-day
     growth, audience age and gender, opening lines. Every returned row is
     billed to the run; the scout has `MRA_AD_SEARCHES_PER_RUN` (20) searches,
     after which the tool refuses.
   - `read_ad` (`ReadAdTool`): the full copy of an ad it has seen; free.
   - `find_trending_shops` (`TrendingShopsTool`): TrendTrack
     `POST /v1/shops/query` with `displayInTrending`, the run's markets as
     main market, at least `min_active_ads` (default 20) Meta ads in the last
     7 days, optional product or site text, sorted by estimated sales, active
     ads, traffic growth or visits, 1–10 shops. It returns shops, not ads; the
     scout then searches a shop's long-form ads by domain. 4 credits per shop,
     and each call spends one of the same 20 searches.
   It discovers brands as it goes and submits the ads worth studying, each
   with its ring and why, and the brands it found. Code refuses an ad no search
   returned, an ad kept twice, more than `MRA_ADS_PER_RUN` (150), or more than
   `MRA_ADS_PER_BRAND` (15) from one landing domain.
2. **Store** (`AdTable`): the kept ads, linked to a confirmed competitor by
   landing domain, each with the scout's ring and why (`ad_extractions.relation`).
   The brands go in the `ads.brands` event.
3. **Read**: agents (`ad_reader:<n>`, no tools), told the client's product,
   take 8 kept ads at a time and record avatar, claim type, awareness,
   mechanism, proof, offer, objections, emotion, risk flags and a bucket
   (winning, testing, dead) with the signals that decided it. Code refuses a
   batch that skips, invents or repeats an ad id.

Stage 5 counts as supply only confirmed competitors' ads and ads the scout put
in `direct_competitor` or `same_problem` (`AdRings.isSupply`).

The code sweep before it (keywords from an agent, then fixed searches) was
removed on 2026-10-19: on run `344caa7d` its one-word keywords pulled in dental
and pet ads, and it paid for 540 rows to keep 150.

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
   key, a third level, a review left out, invented or assigned twice, or a quote
   from a review assigned elsewhere; `AvatarMemoryBook` applies the rest, merges
   last so everything moves with them. The memory is stored after every batch
   (`avatar_memories`). A batch refused three times is left out and counted in
   the summary.
2. **Place the ads.** Stage 3's supply ads only (a competitor's own, or
   `same_problem`; `AdRings.isSupply`), 15 at a time (`ad_placer:<n>`), each on
   an avatar or none. Same-buyer and unrelated ads never count as supply.
3. **Judge.** One agent (`avatar_judge`) gives every avatar its awareness level,
   confidence, standing (avatar or emerging) and the competitors' best angle on
   it, with every count in front of it.
4. **Count** (`AvatarTally`, code, no thresholds): a top-level avatar counts its
   sub-avatars' reviews and ads too; demand share is its reviews over all
   reviews assigned to any avatar; supply share is its ads over all placed ads;
   win rate is its ads judged winning over its ads. Stored in `avatars`, with
   reviews, quotes and ads in `avatar_members`.

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
