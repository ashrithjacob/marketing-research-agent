# Long-form ads: from a pile of cards to a guided read

*Superseded 2026-10-26:* everything this spec built (angles, fit, findings, the six-step page) was removed; stage 3 now ends at the pulled, read ads, shown by category. Why is in `docs/spec.md`, decisions. Kept as the record of what was tried.

*Proposed 2026-10-21. Revised 2026-10-22: the page leads the user through six
findings instead of five tables (D5 to D8 added, D2 extended, D4 and the
"written read later" plan superseded). Built 2026-10-22 for stage 3 (build
order 1 to 6, except D6's census); steps 1 and 6 wait for stage 6. No live run
has produced angles or findings yet.* What the Long-form ads page
(stage 3) should show so a D2C brand owner knows what to test next, which new
data that needs, and what it costs. `spec.md` §Stage 3 is the stage itself;
`workings.md` §Stage 3 is how it runs today.

## The problem

The page lists every kept ad as a card, grouped by ring (direct competitor,
same problem, same buyer, trending shop), winners first. Run `344caa7d` kept
**207 ads from 68 advertisers**. Reading 207 cards is the work the user came to
the tool to avoid, and it is what TrendTrack already shows them.

The analysis is mostly done already, then thrown away. The ad reader
(`agent/stages/ads/ad-reader.ts`, eight ads a call) labels every ad with the
avatar it targets, a claim type, an awareness level, its mechanism, proof types,
offer, objections handled, emotion, risk flags and a bucket (winning, testing or
dead). 190 of the 207 were read. Nothing on the page counts any of it.

## Who reads the page, and what they need from it

A D2C brand owner trying to get a return on ad spend (ROAS). Their question is
not "what ads exist" but **"what should my next testing budget go on, and why
should I believe it will work?"** The page answers it in six steps, each a
finding with the evidence under it:

1. **Who is this market paying to reach?** Avatars, demand from reviews against
   supply from ads. An avatar with heavy demand and few winning ads is open.
2. **Which angles are proven, not just popular?** Many ads is popular; ads
   still running after weeks and duplicated is proven (D5).
3. **What are competitors doubling down on right now?** Angles a brand keeps
   launching new ads on (D6).
4. **What do winning ads do that dead ones don't?** Offer, proof, landing page,
   copy structure, opening (D2).
5. **Can the client run it?** Each proven angle against the client's own
   claims and the risk the winners take (D7).
6. **What to test next.** Three to five test cards, each avatar × angle × hook
   × proof × offer × landing, with the ads to model it on (D8).

A competitor's spend and ROAS are not visible to this tool. Every "winning" or
"proven" here is inferred from how long an ad runs and how often it is
duplicated, and the page says "scaled and kept running", never "profitable".

Every number is counted by code from labels and ad ids. A model labels, groups
and writes the finding sentences; it never counts and never re-types an ad's
words.

~~*What the page answers*: angle scoreboard, winners vs losers, brand × angle
grid, hook library, filters.~~ *Superseded 2026-10-22: those five are still
built, but as the evidence under steps 2 to 4, not as the page. Five tables
leave the user to do the reading the tool exists to do; a finding sentence on
top tells them what the table shows and what to do about it.*

## Which decision feeds which step

| Step | Counted per | Needs | From |
|---|---|---|---|
| 1. Who the market pays to reach | avatar | ads placed on avatars; demand share | stage 5, built (`avatar_members`, `AvatarTally`) |
| 2. Proven, not popular | angle | angles; the proven tier | D1, D5 |
| 3. Doubling down | angle, brand | angles; launch dates; a brand census | D1, D6 |
| 4. What winners do | label value | closed lists | D2 |
| 5. Can the client run it | angle | angles; stage 1's claims; risk flags | D1, D7 |
| 6. What to test | angle × avatar | all of the above; hooks | D1, D2, D3, D8 |

Steps 2 to 5 need only stage 1 and stage 3, which stage 3 already waits for.
Steps 1 and 6 need stage 5's avatars, so they are written by stage 6 (gap
detection), not stage 3 (D8). Until stage 6 runs, the page shows steps 2 to 5
and marks steps 1 and 6 as waiting.

## The data: what can be counted today and what cannot

Measured on run `344caa7d`'s 190 read ads (`ad_extractions`, 2026-10-21):

| Label | Shape today | Distinct values in 190 ads | Countable? |
|---|---|---|---|
| `claim_type` | closed list of 4 | 4 | yes |
| `awareness` | closed list of 5 | 5 | yes |
| `bucket` | closed list of 3 | 3 (135 winning, 44 dead, 11 testing) | yes |
| ring | closed list of 4 | 4 | yes |
| advertiser / competitor | from TrendTrack | 68 advertisers | yes |
| `days_running`, `duplicates`, reach, `status`, `first_seen` | from TrendTrack | — | yes |
| `emotion` | free text | **136** | no |
| `mechanism` | free text | **133** | no |
| `offer` | free text | **128** (181 ads have one) | no |
| `proof_types` | free-text list | **578** across 918 mentions | no |

Grouping free text by its wording fails: "60-day guarantee", "60-day money-back
guarantee" and "money-back guarantee" are each counted apart. A synonym table in
code is refused here (the agent picks from a closed list and code checks the
pick). So two changes are needed before the counts mean anything: **angles**
(D1) and **closed lists** (D2).

Stage 4's claim groups cannot stand in for angles. Its market reader grouped
only **41 ads into 6 claims** for this run. It reads a sample, mixes in
historical ads, and stores counts per claim but not which ads they cover
(`market_assessments.evidence.claims` has no ad ids).

## Decisions

### D1. Angles: one grouping call after the ads are read

A new step at the end of stage 3, the **angle grouper**: one agent call is
given every read ad of the run as a compact line (id, advertiser, claim type,
mechanism, avatar, first line of copy). It hands back 5 to 20 angles, each with:

- `key` in lower_snake_case
- a few-word name and one line saying what the angle claims
- `ad_ids`

Code checks that every read ad sits in **exactly one** angle and that every id
exists, as `AdReader` does for its batches. Code then counts each angle's ads,
brands, winners and run lengths. The grouping is stored per run (new table
`ad_angles`: run_id, key, name, description, ad_ids), so the page and later
stages can read it.

Why one call and not a field on each ad: the reader sees eight ads at a time,
and keys invented in separate batches would not line up. One call that sees
every ad keeps the keys consistent.

Size: 190 ads at about 200 characters each is about 38,000 characters, roughly
10,000 input tokens. On the current model (`z-ai/glm-5.3-flash`, $0.15 per
million input tokens, $0.50 per million output, OpenRouter's list on
2026-10-21) the call costs about a cent.

The angle is the unit of steps 2, 3, 5 and 6: proven, momentum, fit and the
test cards are all counted or judged per angle.

*Open: should stage 4 group its claims from these angles instead of its own
sample? That would make the two pages agree. Not decided here.*

### D2. Closed lists for proof, offer, emotion, landing page and copy structure

`AdReadingSchema` (`domain/ads.ts`) gains five enum fields. The free-text
fields stay beside them as detail:

- `proof_kinds` (a list): clinical_study, expert, testimonial, before_after,
  results_timeline, ingredient_science, statistics, social_numbers,
  comparison, third_party_testing, traditional_use, media_mention, guarantee,
  none
- `offer_kinds` (a list): discount, bundle, subscription, free_gift,
  free_shipping, guarantee, price_only, none
- `emotion_kind` (the emotion the opening leads with): fear, hope, relief,
  shame, guilt, anger, frustration, grief, curiosity, vindication, belonging,
  pride
- `landing_kind` *(added 2026-10-22)*: advertorial, listicle, product_page,
  unknown
- `copy_structure` *(added 2026-10-22)*: personal_story, expert_letter,
  listicle, testimonial_stack, problem_solution, comparison

*Fixed 2026-10-22 against run `344caa7d`'s stored values (every row of the
free-text proof, offer and emotion values, and every landing path):*

- *Proof gained the kinds the draft missed and the run used often: day-by-day
  or week-by-week results timelines, cost comparisons against other
  treatments, certificates of analysis, traditional use, statistics.
  `demonstration` was dropped: nothing used it.*
- *Offer became a list: most offers combine a discount with a money-back
  guarantee, and one value per ad would hide one of them. `price_only` covers
  a stated price with nothing else.*
- *Emotion: the stored values are arcs ("fear turning to relief"), so the kind
  is the emotion the opening leads with. Guilt, grief and vindication were
  added.*
- *Landing: every landing path in the run is an advertorial (`/pages/…`,
  `/blogs/…`, a story path), a listicle (`listicle`, `5-reasons`, `7-reasons`)
  or a product page (`/products/…`). Quiz, collection and homepage were
  dropped: nothing used them.*
- *`copy_structure` is not yet checked: that needs the copy read, which is the
  reader's job. After the first run with it, an entry with no ads is dropped.*

Why the two additions: what happens after the click (an advertorial against a
product page) and how the long copy is built are the levers a brand owner pulls
next, more than the emotion named. Step 4 compares them between winning and
dead ads; step 6's test cards carry them.

`landing_kind` is picked from the ad's `landing_url` and copy. The reader does
not see the landing page, so a URL that does not say is `unknown`, never a
guess. Reading the page itself would be a Firecrawl fetch per ad. That is not
in this spec; if `unknown` turns out to be the common answer, it is the next
change.

The lists above are a draft. Before they are fixed, they get checked against
the stored free-text values (proof, offer, emotion) and the stored copy and
landing URLs (landing, structure): every stored ad should fit one entry, and an
entry nothing uses is dropped. Code rejects any value outside the list, as it
already does for `claim_type`.

Existing runs have no `*_kind` values until their ads are read again. The ad
reader cost $0.42 for 190 ads on run `344caa7d` (its charges). Rereading is an
explicit rerun of stage 3; nothing rereads on its own.

### D3. Hooks are copied by code

A hook is the opening of an ad's copy: its first sentence, or first line,
whichever is shorter, capped at 200 characters. Code cuts it from `ads.copy`.
No model writes it. That follows the house rule that a model never copies
content by writing it out.

Hooks are not their own section of the page. They appear as evidence: under
step 2, how the proven ads on an angle open; on a step 6 test card, the hooks
to model.

### ~~D4. Which signal counts as "winning"~~

~~Every table also shows median and longest `days_running` and total
`duplicates`; the bucket rule is unchanged.~~

*Superseded 2026-10-22 by D5.* 135 of 190 read ads (71%) are labelled winning,
so the bucket barely separates good ads from bad. Showing the continuous
signals beside it leaves the user to do the separating, which is the work this
page is meant to do for them. D5 adds a stricter tier that code decides.

### D5. Proven: a stricter tier than "winning", decided by code

An ad is **proven** when all three hold, read from TrendTrack's fields:

- `status` is `active`
- `days_running` is 30 or more
- `duplicates` is 2 or more

A brand keeps paying for an ad it has run a month and copied into new ad sets
only while the ad makes money.

*Measured 2026-10-22 on run `344caa7d`: 30 of 207 kept ads are proven (14%),
inside the 10% to 40% band, so the thresholds stand. 90 ads are active, 40 of
those have run 30 days or more; 68 ads have no duplicate count from TrendTrack
and can never be proven.* "Winning" (the reader's bucket) stays as it is;
proven is a second, narrower flag next to it, and it is the one steps 2, 4 and 6
rank by.

Code, not the reader, decides it: the three conditions are facts on the ad, so
they are a rule in `extract/`, not a judgement. The thresholds (30 days, 2
duplicates) are a draft: before they are fixed, they get counted on run
`344caa7d`. If proven comes out under about 10% or over about 40% of read ads,
it does not separate either, and the thresholds move.

TrendTrack's `daysRunning` for a collated creative is "the creative calendar
span from the oldest member start", which "does not imply continuous delivery
by one ad" (`trendtrack/api/Ads.md`). A proven creative may have been paused in
between. The page says "running since", not "running for".

The winning-vs-dead comparison (step 4) has a bias this does not remove: the
scout keeps ads worth studying, which favours long runners, so the dead ads on
a run are not a fair sample of what failed. Step 4 therefore compares proven
against the rest, and a value seen in fewer than 5 ads on either side is shown
greyed and not ranked.

### D6. Momentum: what a brand is launching now

Step 3 counts, per angle and per brand, how many ads were first seen in the
last 30 and the last 60 days (`first_seen`, from TrendTrack's `firstSeenAt`). A
brand that launches several new ads on one angle in a month has found something
there and is iterating on it: the strongest sign of where its money is going
next that public data gives.

Two sources, kept apart on the page:

- **The kept ads**, free. These are the scout's picks, at most 15 per brand
  (`MRA_ADS_PER_BRAND`), so they show which angles a brand's recent ads are on,
  but not how many ads it launches.
- **A brand census**, paid, for confirmed competitors only. Three one-row
  queries per competitor domain, each with the scout's own filters (image ads,
  `minDescriptionLength` 2000, the run's markets), reading TrendTrack's `total`:
  - all ads, `status: all`
  - ads launched in the last 60 days (`createdAfter`)
  - ads that stopped within 14 days (`status: inactive`, `maxDaysRunning: 14`)

  From those come each competitor's launch rate and **kill rate**, the share of
  its tests it turns off inside two weeks. A proven ad at a brand that kills
  most of its tests has survived a harder filter than one at a brand that turns
  nothing off, and step 2's table shows the kill rate beside each brand.

  Cost: a one-row page of `POST /v1/ads/query` cost 2 credits (measured
  2026-10-19, `trendtrack-api.md`), so 6 credits per competitor, at
  `MRA_TRENDTRACK_USD_PER_CREDIT` (0.0089) about $0.05. Five competitors is
  about $0.27. *Not yet checked: that `total` counts every match when the page
  is one row. Measure it on one domain before building.*

  Stored per run in a new table `ad_brand_census` (run_id, domain, total,
  launched_60d, killed_14d, measured_at).

  *Not built (2026-10-22): the census waits for the `total` measurement above,
  which spends credits. Step 3 shows the kept-ad counts only, labelled as such.
  TrendTrack already returns `total` on every scout search
  (`pagination.total`, shown to the scout and then dropped); a domain search's
  total is the brand's count only when its sort does not narrow the results
  (`trendtrack-api.md:11`).*

Why not every advertiser: 68 advertisers at 6 credits is about $3.63 a run,
for brands the client does not compete with directly. Same-buyer and trending
shops are playbooks, not rivals; their momentum is not a decision the client
makes.

### D7. Fit: can the client run a proven angle?

One agent call at the end of stage 3, after the angle grouper. It is given each
angle (name, description, its proven ads' hooks) and the client's own claims
from stage 1 (`claims_on_page`, each with its index) and product facts. For
each angle it picks one of:

- `supported`: a claim the client already makes backs this angle. Cites the
  claim by index.
- `needs_new_claim`: the angle rests on something the client does not claim
  today. Names what in one line. Not a no: it is a claim to substantiate first.
- `does_not_apply`: the angle is about something the product is not (another
  form, another ingredient, another problem).

Code checks every cited claim index exists, every angle gets exactly one
verdict, and a `supported` verdict cites at least one claim. Code, not the agent, adds the **risk share**: the share of the
angle's proven ads with at least one `risk_flag`. An angle whose winners
mostly take risks under FTC or Meta health rules is marked so whatever the
verdict, because a claim that keeps a competitor's ad running can still get
the client's account banned.

There is no "permitted claims" list in stage 1. The client's own claims are the
nearest thing it has; this check says "you already say this", never "you are
allowed to say this". Stored on `ad_angles` (fit, fit_claim_indexes,
fit_why).

*Measured 2026-10-22: 189 of run `344caa7d`'s 190 read ads carry at least one
risk flag, so risk share is near 100% for every angle and does not separate
them. The reader flags too much to rank by. Recorded as a gap; the fix is in
what the reader flags, not in the share.* Size: one call over about 20 angles, a few thousand tokens; about a
cent.

### D8. Findings: one sentence per step, numbers filled in by code

~~*Later, paid, optional: a written read of the market.* One agent call, given
the scoreboard and the winners vs losers table, writes five to eight sentences
on what this market rewards, citing angle keys or ad ids. Only after the
tables exist, and only if users want prose on top of them.~~

*Superseded 2026-10-22.* The read was planned as optional prose on top of the
tables. For a brand owner it is the point of the page: the tables are the
evidence, the finding is the answer. And free prose was the wrong shape: five
to eight sentences that each carry their own numbers is a model writing
numbers, which code cannot check sentence by sentence. Replaced by:

The **findings writer**, one agent call given the counted tables (not the ads).
It submits one finding per step, each:

- `step` (1 to 6) and `subject`: the angle keys, avatar ids, label values or
  brand domains the finding is about
- `headline`: one sentence saying what the evidence shows and what it means for
  the client, **with no digits in it**
- `ad_ids`: the ads to show under it

Code checks every subject and ad id exists in the run and refuses a headline
containing a digit. The numbers the user reads beside the headline (demand
38%, supply 9%, 5 of 6 proven) are rendered by the page from the same tallies
the writer was shown, so a number on screen is always one code counted.

Step 6's finding is the **test plan**: three to five cards, each an avatar, an
angle, a proof kind, an offer kind, a landing kind, hook ad ids to model, and a
one-line why. Code checks each field is a value that exists in the run. A card
is stage 7's brief.

Where it runs, following when its inputs exist:

- **Stage 3** writes steps 2 to 5 once the angle grouper and fit check are done.
- **Stage 6** (gap detection, not built) writes steps 1 and 6, because both
  need stage 5's avatars. Demand against supply per avatar is stage 6's job in
  `spec.md` already; step 1 is that, shown on the ads page.

Size: the tables for one run are a few thousand tokens; about a cent per call.

## What the page shows

Top to bottom, the six steps, then the ad grid. Chips at the top jump to each
step.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Long-form ads · 190 ads read, 68 brands, N proven                       │
│ [1 Avatars] [2 Proven] [3 Momentum] [4 Anatomy] [5 Fit] [6 Test] [All]  │
├────────────────────────────────────────────────────────────────────────┤
│ 1  WHO THIS MARKET PAYS TO REACH                    (waits for stage 6) │
│    finding · avatar table: demand, supply, proven ads, brands · ads     │
├────────────────────────────────────────────────────────────────────────┤
│ 2  PROVEN, NOT JUST POPULAR                                             │
│    finding · angle scoreboard · brand × angle grid · proven hooks       │
├────────────────────────────────────────────────────────────────────────┤
│ 3  WHAT COMPETITORS ARE DOUBLING DOWN ON                                │
│    finding · launches per angle, 30/60 days · competitor kill rates     │
├────────────────────────────────────────────────────────────────────────┤
│ 4  WHAT WINNERS DO THAT THE REST DON'T                                  │
│    finding · label shares, proven against the rest                      │
├────────────────────────────────────────────────────────────────────────┤
│ 5  CAN YOU RUN IT                                                       │
│    per angle: supported / needs new claim / does not apply · risk share │
├────────────────────────────────────────────────────────────────────────┤
│ 6  WHAT TO TEST NEXT                                (waits for stage 6) │
│    3–5 test cards · [see evidence] [→ write ad]                         │
├────────────────────────────────────────────────────────────────────────┤
│ ALL ADS  filters · sort · today's cards                                 │
└────────────────────────────────────────────────────────────────────────┘
```

Each step is the finding's headline, the numbers code counted for its subject,
a collapsed table that proves it, and a strip of the ads it cites. Every "see
the ads" opens the grid at the bottom already filtered.

### Step 1. Who the market pays to reach

| Avatar | Demand | Supply | Proven ads | Brands |
|---|---|---|---|---|

From stage 5's `avatars` and `avatar_members`, with the proven flag (D5) added.
An avatar whose demand share is well above its supply share is marked **open**;
the rule for "well above" is stage 6's to decide.

### Step 2. Proven, not just popular

The angle scoreboard, one row per angle:

| Angle | Ads | Proven | Brands | Median days | Longest | Duplicates | Earliest |
|---|---|---|---|---|---|---|---|

- Sortable by any column. Default: proven count, then proven share.
- A row expands to its description, its proven ads' hooks (D3) with a copy
  button each, and its brands with their kill rates (D6).
- Behind a toggle, the **brand × angle grid**: rows are brands (confirmed
  competitors first, then advertisers with three or more ads), columns are
  angles, a cell is that brand's ads on the angle coloured by proven share. An
  angle few brands use but whose ads are proven is flagged **open angle**.

### Step 3. Doubling down

Per angle, ads first seen in the last 30 and 60 days, as small bars, marked
rising or fading against the angle's older ads. Under it, the census per
confirmed competitor: total long-form ads, launched in 60 days, kill rate.
Census numbers and kept-ad numbers are labelled apart (D6).

### Step 4. What winners do that the rest don't

For each value of each closed list (claim type, awareness, proof kind, offer
kind, emotion kind, landing kind, copy structure): its share among proven ads
beside its share among the rest, and the difference.

| Label | In proven | In the rest | Difference |
|---|---|---|---|

- Sorted by difference.
- A value seen in fewer than 5 ads on either side is greyed and not ranked.

### Step 5. Can you run it

Per angle with at least one proven ad: the D7 verdict, the client claim it
cites or the claim it would need, and the risk share.

### Step 6. What to test next

The test cards (D8). Each shows its avatar and angle, the proof, offer and
landing it uses, the hooks of the ads to model, the one-line why with the
numbers behind it, and two actions: open the evidence (the grid filtered to its
ads) and hand it to stage 7.

### The ad grid, with filters

Today's cards, under a filter bar: bucket, proven, ring, brand, angle, avatar,
awareness, claim type, proof kind, offer kind, emotion kind, landing kind, copy
structure, plus sort (days running, duplicates, reach, first seen). Filters
show their counts and combine. The current filter goes in the URL, so a view
can be shared.

## Where the code goes

| Piece | Layer | Notes |
|---|---|---|
| `AdAngleSchema`, `AngleFitSchema`, `FindingsSchema`, the five closed lists | `domain/ads.ts` (split if it passes 150 lines) | the three agents' submissions |
| `AngleGrouper` | `agent/stages/ads/` | one call; `check`: each read ad in exactly one angle, every id known |
| `AngleFitter` | `agent/stages/ads/` | one call; `check`: one verdict per angle, every claim index known |
| `FindingsWriter` | `agent/` (used by stage 3 and stage 6) | one call; `check`: every subject and ad id known, no digit in a headline |
| `BrandCensus` | `agent/stages/ads/`, over a new `AdCensus` port | three one-row queries per competitor; charges like every TrendTrack call |
| `ProvenRule`, `AngleTally`, `Momentum`, `LabelDiff`, `HookCutter` | `extract/` | every count on the page; pure, unit-tested |
| `ad_angles`, `ad_brand_census`, `ad_findings` | new migration | per run |
| `GET /runs/:id/ads/analysis` | `http/evidence-routes.ts` | the six steps' tallies and findings, counted on read |
| `Ads.tsx` split | `frontend/src/run/ads/` | one component per step, `AdFilters`, `TestCard`; each under 250 lines |

~~Stage 3's `add` (competitors added to a finished run) re-runs the grouping,
the fit check, the census for the new competitors and the findings, not the
reading.~~ *Superseded 2026-10-22: `add` only links kept ads to the new
competitors, as before. Which brand is a competitor is counted when the page
loads, so the grid and momentum update on their own; regrouping would cost
three model calls and change nothing else. The findings are not rewritten.*

*As built:* `AngleGrouper`, `AngleFitter`, `FindingsWriter` and the step that
runs them in order (`AdAnalysisStep`) are in `agent/stages/ads/`; the counts
are `ProvenRule`, `HookCutter`, `Momentum`, `AngleTally`, `LabelDiff`,
`BrandGrid` and `AdsAnalyzer` in `extract/`; the store is `AdAnalysisTable`
(migration 10, `ad_analysis`); the route is `GET /runs/:id/ads/analysis`; the
page is `frontend/src/run/ads/`. A grouper, fit check or findings writer that
ends `invalid` makes stage 3 `invalid`, with its ads kept and read.

## Cost per run

| Part | Cost |
|---|---|
| Angle grouper | about $0.01 (one call, about 10,000 input tokens) |
| Fit check | about $0.01 (one call) |
| Findings writer | about $0.01 in stage 3, about $0.01 in stage 6 |
| Brand census | 6 TrendTrack credits per confirmed competitor, about $0.05 each; $0.27 for five |
| Closed lists | none on a new run (the same reader call, a few more output tokens). Existing runs: a stage 3 rerun, $0.42 on run `344caa7d`, plus TrendTrack's ad credits for the search ($4.81 on that run) |
| Everything else | none (code) |

The LLM figures are estimates from token counts at list price, to be replaced
by the billed charges of the first run that has them.

## Build order

1. `HookCutter`, `ProvenRule`, and the filters on the existing grid (no new
   data). Count proven on run `344caa7d` to fix D5's thresholds.
2. D1, the angle grouper, then step 2 (scoreboard and grid).
3. D2, the closed lists, then step 4.
4. D6, momentum from the kept ads; then measure `total` on one domain and add
   the census.
5. D7, the fit check, then step 5.
6. D8 in stage 3: findings for steps 2 to 5. The page becomes the guided read
   here.
7. Steps 1 and 6 with stage 6.

## Not in scope

- Image analysis of the creative itself (layout, headline size, photo vs
  illustration). The reader works from copy and TrendTrack's metadata.
- Reading competitors' landing pages (see D2's `unknown`).
- Changing how the scout finds ads, or how many it keeps.
- Writing the ads. Step 6's cards are stage 7's input.

*2026-10-26:* the scout this spec mentions is gone. Stage 3 now pulls the top
100 ads for the market term under four sorts (`AdPool`) and reads one ad per
distinct script; the per-brand cap of 15 no longer exists, and an ad's bucket
is computed from its signals (`AdBuckets`, `workings.md` stage 3). Where this
spec says "the scout's picks", read "the pool". *Later the same day:* agents pull the ads again, one per ring,
each to a quota (`AdPull`, `RingScout`; `workings.md` stage 3).
