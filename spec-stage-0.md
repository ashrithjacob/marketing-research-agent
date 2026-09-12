# Stage 0 — the product finder

Stages 1–5 answer *what is true about this product*. They presuppose a product,
and until now the operator picked it by hand. Stage 0 is the step before: which
products are worth researching at all.

Everything below was measured against the live TrendTrack API on 2026-09-12 with
a real key. Numbers are real responses, not illustrations.

Implementation: `server/src/stage0.ts` (pipeline), `server/src/trendtrack.ts`
(API boundary), `server/src/mrr-prompt.ts` (the judgement),
`server/src/discovery.ts` (run lifecycle), `frontend/src/Discovery.tsx` (cockpit).
Background on the data source is `trendtrack/product-finder.md`.

---

## 1. What it produces

A ranked list of **products**, each carrying the shop it came from, a 0–10 score
for how well it would sustain a ~28-day subscription, and one sentence saying
why. That list is the input to a stage-1 brief.

Plus, per surviving shop: a seven-month traffic series (six observed, t-6
estimated), the rise count and growth ratio, its main market and share, its
Trustpilot rating, and the funnel counts that explain why it survived.

---

## 2. The pipeline

```
A  discover     POST /v1/shops/query × pages       1 credit per row
B  shape        sort history, count rises, ratio   free
C  gate         6 months, rises, baseline, mirrors free
D  markets      top country in US/GB/CA/NZ/AU      free
E  trustpilot   GET /v1/shops/{id} per survivor    1 credit each
F  mrr          LLM scores each product 0–10       tokens, not credits
G  rank         by score, descending               free
```

**The ordering is the cost control, not a preference.** Every free gate runs
before the one paid step, so a credit is only ever spent on a shop that has
already survived everything free. Swapping E above C or D is the easiest way to
multiply the bill for the same result.

Every stage records its survivor count. "Four results" is unreadable without
knowing which gate ate the other four hundred and ninety-six, and the funnel is
the first thing to read when a run disappoints.

---

## 3. Where this came from, and the three things it got wrong

Stage 0 is a port of a shell pipeline — a `for`-loop of five `curl` calls piped
through `jq`, plus `six_month_growth.ts` for the t-6 estimate. It was ported
faithfully except where it was wrong, and it was wrong in three places. All three
are silent failures, which is why they are recorded here rather than just fixed.

### 3.1 `marketCountries` does not restrict the main market

The shell pipeline sent `marketCountries: ["US","GB","AU","NZ","CA"]` and treated
the result as big-five shops. Measured:

| Filter | Shops matched | First page |
|---|---|---|
| `marketCountries` | 17,604 | `chiikawamarket.jp` (JP 57%, US 7%), `discoverpilgrim.com` (IN 92%, US 1%) |
| `mainMarketCountries` | 13,023 | every sampled row had a big-five top market |

`marketCountries` matches *any* presence in those countries. A Japanese shop with
7% US traffic qualifies.

**Decision:** send `mainMarketCountries`, **and** re-check the top country by
visit share client-side. The server-side filter is a narrowing, not a guarantee —
it is not documented to mean "top country by share", so the client-side check
stays even though it is currently redundant. Belt and braces on a filter whose
semantics already surprised us once.

### 3.2 `traffic.history` was read in wire order

The jq computed `[.traffic.history[].value]` then `$h[-1] / $h[0]`, taking the
API's array order as chronological. The live API does return ascending periods,
so it worked; nothing documents that it must, and `six_month_growth.ts` sorts
defensively for exactly this reason.

An unsorted series inverts the ratio, which does not error — it silently ranks
the fastest-*shrinking* shops first, and the output still looks plausible.

**Decision:** sort by `period` before any arithmetic. `trafficSeries()` is the
only way the series is read, and it sorts.

### 3.3 Trustpilot cannot be pushed into the query

`POST /v1/shops/query` accepts `minTrustpilotRating`, which would be free and
would save a credit per shop. It would also drop every shop with **no** Trustpilot
profile.

`product-finder.md` §5's standing rule applies: a missing value means "not
measured", not "zero". Plenty of real businesses never set Trustpilot up;
treating their absence as a failing grade would quietly delete them.

**Decision:** keep a shop when Trustpilot says nothing bad **or says nothing at
all**, which requires reading the rating rather than filtering on it — so a
detail call per survivor, after the free gates have cut the list down.

The consolation is that the detail call earns its credit twice: it also carries
`growth90d` and `growth180d`, which the search row does not, and those are what
make the t-6 reconstruction possible. One credit, two answers.

---

## 4. The gates, and why each number

| Gate | Default | Why |
|---|---|---|
| 6 months of history | required | the ratio and rise count are meaningless without a full series |
| rises ≥ 4 of 5 | 4 | sustained, not one good month. Four of five allows a single dip |
| baseline ≥ 20,000 visits | 20,000 | **the important one.** Sorting by growth surfaces tiny-baseline explosions: `product-finder.md` §4 caught a `growth30d` of 23.67 — +2367% — from a shop that went from almost nothing to slightly more than nothing |
| top market in big five | fixed | shared language, returns culture and shipping story |
| Trustpilot ≥ 3, or absent | 3 | below 3 the shop is selling badly whatever its traffic says |

**Mirror-domain dedupe, and why it runs late.** One business can be indexed under
two domains; the shell pipeline caught this with `unique_by(.hist)`, since six
identical absolute visit counts do not happen twice by chance. But a *degenerate*
series — all zeros, or a handful of identical small numbers — collides across
genuinely different shops, and deduping on it before the baseline gate silently
drops real ones. So id-dedupe runs first (it catches pagination repeats), and the
fingerprint dedupe runs after the baseline gate, when every remaining row has six
months and a real baseline. There is a test for this.

---

## 5. The MRR judgement

### 5.1 Why an LLM at all

The question is "would a typical buyer deplete this in about a month and let it
ship again without deciding again". That is a judgement about consumption
cadence, and there is no field in the API for it. The alternative is a category
whitelist, which fails in both directions: a 30-day pill bottle and a 12-week
course of the same pills score very differently, and a razor-blade subscription
works without being a supplement.

### 5.2 The rubric is about depletion, not category

Scored on observable properties — does it run out, is the replacement identical,
is stopping a decision, is the cadence near 28 days — with anchors so the scale
means the same thing across batches. A category list is something a model
pattern-matches against instead of thinking.

Verified on a live run: lotions and supplements scored 6–8, flavoured teas 4,
fleece blankets 1, and `100 EXTRA ENTRIES` (a prize-draw entry) 0.

### 5.3 The candidate list goes last — and this is a fix, not a style choice

`server/src/prompt.ts` puts stage 1's worked example last, and that example is a
complete magnesium research packet. Stage-1 runs drifted toward magnesium
whatever product was briefed, because the last thing the model read before
generating was a finished answer about a different subject. The brief was ~100
characters; the example was 3,639, with 14 magnesium-specific tokens.

Stage 0 does the opposite: rubric, then a shape-only example, then the
candidates. The example carries no real product, its refs are negative so a
copied one is obvious, and the prompt states that reusing its contents is an
error. A test asserts the candidates appear after the example.

*(The stage-1 prompt has the same defect and has not yet been fixed. It is a
separate change — see the note at the end of `mrr-prompt.ts`.)*

### 5.4 Unscored is not zero

Zero means "durable, one-off, or not a product". A product the model returned no
verdict for means "not measured". Defaulting the second to the first would rank
an unmeasured product as confidently bad, so a missing verdict stays `null`,
sorts last rather than as zero, is reported in the problems list, and is drawn as
a dash — deliberately unlike any score band — in the cockpit.

### 5.5 Junk titles are dropped before the model sees them

The best-seller feed contains things that are not products — `product-finder.md`
§F6 found a `10 Year Warranty` ranked #2 in one shop — and titles that are not
titles: `worldofbooks.com` returns three best sellers all named `!`. The rubric
would score both 0, but paying tokens to be told so is waste, so the obvious
cases are filtered first. A shop left with nothing scoreable shows a dash rather
than a zero, because that is a data problem and not a verdict.

---

## 6. Cost

TrendTrack bills **per row returned, not per call** (`product-finder.md` §1,
measured against `/v1/usage`).

| Call | Credits |
|---|---|
| `POST /v1/shops/query` | 1 per returned shop |
| `GET /v1/shops/{id}` | 1, flat |
| `GET /v1/usage`, `/v1/workspace`, `/v1/system/freshness` | 0 |

A default 5-page run is up to 500 credits plus one per surviving shop, against a
10,000/month allowance — so roughly 18 full runs a month. The result carries a
ledger split into rows and details so the expensive half is obvious, and the
cockpit prints the ceiling before the run and the actual figure after.

**Verified 2026-09-12:** a capped run (12 rows rather than 500) reported 20
credits — 12 rows + 8 details — and `/v1/usage` showed exactly 20 spent.

### 6.1 Retries, and the asymmetry

Six concurrent detail calls on one credential returned `429 Too many concurrent
public API requests are already in flight for this workspace or credential` for
three of seven shops. The limit is on **concurrency**, not on a rate over time,
so the fix is a smaller pool — `DETAIL_CONCURRENCY = 3` — not a slower one.

A refused call is retried with jittered backoff. That retry applies to detail
calls and **deliberately not to searches**: a 429 bills nothing, so asking again
is free, but a search retried after a partial success is paid for twice at a
credit a row. `queryShops` has no retry at all, and a failing page ends discovery
rather than being re-bought.

### 6.2 The response cache

Responses are reused for 7 days (`MRA_TRENDTRACK_CACHE_DAYS`).

**Cached at the API-response level, not the result level, and that choice is the
whole feature.** The obvious cache is "same parameters, same answer" — and it is
nearly useless, because the parameters worth tuning are the cheap ones.
`minUps`, `minBaseline`, `minTrustpilotRating` and the entire MRR rubric are
applied *client-side* to rows already bought, so a result-level cache means
paying 500 credits again to see what a baseline of 30,000 would have kept.

Caching each response puts the split where the money is:

| Change | Costs |
|---|---|
| `minUps`, `minBaseline`, Trustpilot floor, batch size, model | nothing |
| `pages`, `minMonthlyVisits`, `minActiveAds`, `minProductsCount`, growth | new rows |

Detail calls are keyed by shop id, so a shop in two searches is bought once.
`/v1/usage` is never cached — free, and its purpose is to be current.

**Why a week.** `/v1/system/freshness` reports a one-day lag and a daily rebuild,
so a cached row can be eight days behind. What stage 0 reads from it is a
six-month traffic series and a Trustpilot rating, both of which move on a scale
of months; a week cannot change which shops are compounding. It could matter for
`activeAds`, a 30-day figure, so every run reports how stale its oldest reused
response was. This is a screening cache and nothing from it should back a claim
about what a shop is doing today.

**Verified 2026-09-12:** a first run cost 31 credits; an identical rerun cost
**0** — 14 hits, 31 saved — and produced the same ranking.

### 6.3 The MRR call is retried

A live run lost all 24 of its candidates to a single `Connection error.` from
the provider, and the identical run a minute later scored 24 of 24. The call is
idempotent and costs tokens rather than credits, so each batch gets three
attempts with backoff. A *malformed reply* is not retried — `parseMrrVerdicts`
keeps whatever verdicts were valid and reports the rest as unscored.

### 6.4 Refusing to start beats failing halfway

With `TRENDTRACK_API_KEY` unset, stage 0 returns 400 before spending anything. A
pipeline that discovers its key is missing on page four has already spent 400
credits.

---

## 7. Decisions recorded

**Its own table, not `research_runs` with `stage = 0`.** Stage 0 has no brief, no
packet and no agent transcript — it has parameters and a ranked list. Sharing the
stage-1 row would mean six permanently empty columns and a `summary()` that has
to branch on stage to mean anything.

**Polling, not SSE.** Stage 1 streams because a run is an hour of agent turns and
the transcript *is* the product. Stage 0 is about a minute and has seven steps;
progress is appended to the run row and the browser polls every two seconds.

**A cancelled run keeps its partial result.** The credits were spent either way,
and a half-finished ranking is more use than an empty row.

**A shop whose detail call failed is kept, with nulls.** The call was for
Trustpilot, and a network error is not evidence of a bad rating. It carries null
ratings, an empty series and a warning saying why — nothing is invented for it,
and the failure is in the problems list.

**Medians and percentiles are not used here.** `product-finder.md` §5 builds a
six-feature weighted score with percentile ranking, and that is the right design
for ranking *products by market demand* across a candidate pool. Stage 0 is a
narrower question — is this shop growing, is it reachable, would its product
resubscribe — so it uses hard gates and one LLM score. The §5 model is the
natural next step if stage 0's output needs ordering by more than MRR fit.

---

## 8. What is not done

- **No product-level demand score.** Stage 0 ranks by subscription fit only. The
  F1–F6 model in `product-finder.md` §5 is the intended follow-on.
- **Best sellers are limited to the three in the search row.** `GET
  /v1/shops/{id}/products?limit=100` would give a ranked feed of up to 100 for 1
  credit flat, which is better value per credit than almost anything else in the
  API. It was left out to keep the first version's cost model simple.
- **Saturation is not assessed.** `product-finder.md` §6 answers "can you still
  get in", which is a different question from "do people want it" and needs the
  cohort search stage 0 does not do.
- **The weights and thresholds are guesses.** As `product-finder.md` §5 says of
  its own: the honest way to set them is to score products already known to have
  succeeded or flopped and tune until the groups separate. Nothing here has been
  calibrated that way.
- **The cache is not invalidated by freshness.** It expires on age alone. A
  smarter version would compare `latestReadyDate` from `/v1/system/freshness`
  (free) against the entry's timestamp and expire only when TrendTrack has
  actually rebuilt.
- **The stage-1 example leak is unfixed.** §5.3 above describes the defect in
  `prompt.ts` that stage 0 was written to avoid. Fixing it is a separate change
  with its own regression test.
