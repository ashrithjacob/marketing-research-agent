# Long-form ads: from a pile of cards to an analysis

*Proposed 2026-10-21. Not built.* What the Long-form ads page (stage 3) should
show so a user can understand a market's ads without reading each one, which new
data that needs, and what it costs. `spec.md` §Stage 3 is the stage itself;
`workings.md` §Stage 3 is how it runs today.

## The problem

The page lists every kept ad as a card, grouped by ring (direct competitor,
same problem, same buyer, trending shop), winners first. Run `344caa7d` kept
**207 ads from 68 advertisers**. Reading 207 cards is the work the user came to
the tool to avoid.

The analysis is mostly done already, then thrown away. The ad reader
(`agent/stages/ads/ad-reader.ts`, eight ads a call) labels every ad with the
avatar it targets, a claim type, an awareness level, its mechanism, proof types,
offer, objections handled, emotion, risk flags and a bucket (winning, testing or
dead). 190 of the 207 were read. Nothing on the page counts any of it.

## What the page answers

In the order a growth marketer asks:

1. **What angles is this market running, and which ones win?** (angle scoreboard)
2. **What do winning ads do that dead ones don't?** (winners vs losers)
3. **Who is on which angle, and which angles are open?** (brand × angle grid)
4. **How do the winners open?** (hook library)
5. **Show me the ads behind any of that.** (filters on the ad grid)

Every number is counted by code from labels and ad ids. A model labels and
groups; it never counts and never re-types an ad's words.

## The data: what can be counted today and what cannot

Measured on run `344caa7d`'s 190 read ads (`ad_extractions`, 2026-10-21):

| Label | Shape today | Distinct values in 190 ads | Countable? |
|---|---|---|---|
| `claim_type` | closed list of 4 | 4 | yes |
| `awareness` | closed list of 5 | 5 | yes |
| `bucket` | closed list of 3 | 3 (135 winning, 44 dead, 11 testing) | yes |
| ring | closed list of 4 | 4 | yes |
| advertiser / competitor | from TrendTrack | 68 advertisers | yes |
| `days_running`, `duplicates`, reach | numbers from TrendTrack | — | yes |
| `emotion` | free text | **136** | no |
| `mechanism` | free text | **133** | no |
| `offer` | free text | **128** (181 ads have one) | no |
| `proof_types` | free-text list | **578** across 918 mentions | no |

Grouping free text by its wording fails: "60-day guarantee", "60-day money-back
guarantee" and "money-back guarantee" are each counted apart. A synonym table in
code is refused here (the agent picks from a closed list and code checks the
pick). So two changes are needed before the counts mean anything: **angles**
(D1) and **closed lists** for proof, offer and emotion (D2).

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

*Open: should stage 4 group its claims from these angles instead of its own
sample? That would make the two pages agree. Not decided here.*

### D2. Closed lists for proof, offer and emotion

`AdReadingSchema` (`domain/ads.ts`) gains three enum fields. The free-text
fields stay beside them as detail:

- `proof_kinds` (a list): clinical_study, expert, testimonial, before_after,
  ingredient_science, demonstration, social_numbers, media_mention, guarantee,
  none
- `offer_kind`: discount, bundle, subscription, free_gift, free_shipping,
  guarantee_only, none
- `emotion_kind`: fear, hope, relief, shame, anger, frustration, curiosity,
  belonging, pride

The lists above are a draft. Before they are fixed, they get checked against
the 190 free-text values already stored: every stored value should fit one
entry, and an entry nothing uses is dropped. Code rejects any value outside
the list, as it already does for `claim_type`.

Existing runs have no `*_kind` values until their ads are read again. The ad
reader cost $0.42 for 190 ads on run `344caa7d` (its charges). Rereading is an
explicit rerun of stage 3; nothing rereads on its own.

### D3. Hooks are copied by code

A hook is the opening of an ad's copy: its first sentence, or first line,
whichever is shorter, capped at 200 characters. Code cuts it from `ads.copy`.
No model writes it. That follows the house rule that a model never copies
content by writing it out.

### D4. Which signal counts as "winning"

135 of 190 read ads (71%) are labelled winning. A share that high barely
separates good ads from bad ones, so a scoreboard ranked only by "% winning"
would be flat. Every table therefore also shows the continuous TrendTrack
signals: median and longest `days_running`, and total `duplicates` (an ad
copied many times is one being scaled). The bucket rule itself is unchanged
here; whether it is too generous is a question for stage 3's reader.

## What the page shows

Top to bottom. Each section has the stage bar's chips pointing at it.

### 1. Angle scoreboard (the headline)

One row per angle:

| Angle | Ads | Brands | Winning | Median days | Longest | Duplicates | Earliest |
|---|---|---|---|---|---|---|---|

- Sortable by any column. Default: winning share, then longest run.
- A row expands to show the angle's description, its top three ads as
  thumbnails, and its brands.
- Clicking a row filters the ad grid below to that angle.

### 2. Winners vs losers

For each value of each closed list (claim type, awareness, proof kind, offer
kind, emotion kind): its share among winning ads beside its share among dead
ones, and the difference.

| Label | In winners | In dead | Difference |
|---|---|---|---|
| proof: before_after | 34% | 9% | +25 pts |

- Sorted by difference, so "what the winners do that the losers don't" is the
  first row.
- A value seen in fewer than 5 ads is greyed out and not ranked: with 44 dead
  ads, small counts swing the shares.
- Clicking a row filters the grid.

### 3. Brand × angle grid

- Rows are brands (confirmed competitors first, then other advertisers with
  three or more ads). Columns are angles.
- A cell shows how many ads that brand runs on that angle, coloured by its
  winning share. Empty cells are angles that brand does not use.
- An angle few brands use but whose ads win is an **open angle**: it is
  flagged above the grid. This is the supply side of stage 6 (gap detection).
- Clicking a cell filters the grid to that brand and angle.

### 4. Hook library

- The hooks of winning ads, grouped by angle, each with its advertiser, days
  running and a link to the ad.
- Copy button per hook. Nothing is rewritten.

### 5. The ad grid, with filters

Today's cards, under a filter bar: bucket, ring, brand, angle, awareness, claim
type, proof kind, offer kind, emotion kind, plus sort (days running,
duplicates, reach). Filters show their counts and combine. The current filter
goes in the URL, so a view can be shared.

### Later, paid, optional: a written read of the market

One agent call, given the scoreboard and the winners vs losers table (numbers,
not ads), writes five to eight sentences on what this market rewards. Every
claim in it cites angle keys or ad ids, and code checks every cited id. Only
after 1–5 exist, and only if users want prose on top of the tables.

## Where the code goes

| Piece | Layer | Notes |
|---|---|---|
| `AdAngleSchema`, `ProofKind`, `OfferKind`, `EmotionKind` | `domain/ads.ts` | the angle grouper's submission; the three closed lists |
| `AngleGrouper` | `agent/stages/ads/` | one agent call; `check`: each read ad in exactly one angle, every id known |
| `AngleTally`, `HookCutter` | `extract/` | every count on the page; the hook cut. Pure, unit-tested |
| `ad_angles` table | new migration | per run |
| `GET /runs/:id/ads/analysis` | `http/evidence-routes.ts` | scoreboard, winners vs losers, grid, hooks, counted on read |
| `Ads.tsx` split | `frontend/src/run/ads/` | `AngleBoard`, `WinnerDiff`, `BrandAngleGrid`, `HookLibrary`, `AdFilters`; each under 250 lines |

Stage 3's `add` (competitors added to a finished run) re-runs only the
grouping, not the reading.

## Cost per run

| Part | Cost |
|---|---|
| Angle grouper | about $0.01 (one call, about 10,000 input tokens) |
| Closed lists | none on a new run (the same reader call, a few more output tokens). Existing runs: a stage 3 rerun, $0.42 on run `344caa7d`, plus TrendTrack's ad credits for the search ($4.81 on that run) |
| Everything else | none (code) |

## Build order

1. `HookCutter`, and the filters on the existing grid (no new data).
2. D1, the angle grouper, then the scoreboard and the brand × angle grid.
3. D2, the closed lists, then winners vs losers.
4. The written read, if wanted.

## Not in scope

- Image analysis of the creative itself (layout, headline size, photo vs
  illustration). The reader works from copy and TrendTrack's metadata.
- Changing how the scout finds ads, or how many it keeps.
