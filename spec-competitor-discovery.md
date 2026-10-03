# Competitor discovery: the same product should get the same competitors

Status: proposed, 2026-10-04. Covers the stage-1 `competitors` agent only.

## 1. What happened

The same brief, `https://mullevia.com/products/mullevia-mullein-drops`, markets
"US, UK, Australia, New Zealand, Canada", all three stage-1 nodes, was run four
times. Every number below comes from `GET /api/research/runs/<id>` (the packet)
and `GET /api/research/runs/<id>/calls` (the LLM call log) on the local store.

| Run | Started (UTC) | Competitors | Web searches by the competitors agent | Called `discover_competitors` |
|---|---|---|---|---|
| `e27a862a` | 09-30 18:18 | 28 | not checked | not checked |
| `c0f14d91` | 09-30 21:23 | 28 | 11 | no |
| `f7b10adb` | 10-02 13:58 | 10 | 2 | yes, first |
| `9571639c` | 10-03 06:52 | 17 | 5 | yes, first |

How many brands two runs share:

| | c0f14d91 | f7b10adb | 9571639c |
|---|---|---|---|
| e27a862a | 9 | 2 | 4 |
| c0f14d91 | | 1 | 1 |
| f7b10adb | | | 5 |

The two September runs largely agree with each other: classic single-herb
mullein tinctures (Herb Pharm, Nature's Answer, Horbäach, Nutravita, St. Francis,
Inseason Herbals). The October runs are a different population: direct-to-consumer
"lung cleanse" brands (MilaMiAmor, Novara Organics, Harker Herbals) and
cough medicines (Prospan, Bisolvon, Bronchostop). Nature's Answer, which the champion agent's
own Amazon search in `9571639c` returned, is in neither October list.

## 2. Why: three mechanisms

**2a. One research call replaced the search grid.** `COMPETITORS_TASK`
(`server/src/agent/prompt/text/tasks.ts:133`) says to call `discover_competitors`
first, then "widen for each kind" with searches. The September agent, which had no
`discover_competitors`, searched active × form × market: "mullein leaf capsules
brand", "mullein gummies lung support", "mullein drops UK buy", "mullein tincture
Canada buy", and so on, 11 queries. The October agents got 14 and 18 candidates
from Parallel, fetched those pages, and ran 2 and 5 searches. Widening is an
instruction, and the model treated the Parallel list as the answer. So the
competitor list is now whatever one Parallel Task run returns, and two Parallel
runs on the same question returned different lists: 14 candidates on 10-02, 18 on
10-03, with 11 brands in common.

**2b. The Parallel question is asked by customer, not by ingredient.**
`ParallelCompetitorDiscovery.input` (`server/src/adapters/parallel-discovery.ts:59`)
leads with the champion's `icp` ("anyone with breathing issues, including
smokers"), and the schema says "every brand selling to the same customer …
whatever its ingredients". That is the right question for `indirect_active`
and the wrong one for `direct`. Parallel answers it with whatever ranks for
"lung health": cough syrups and lung-cleanse brands, and it never enumerates
"every mullein liquid sold in the UK". The direct class, the one a client reads
first, is the one now sampled least.

**2c. The stop rule can be satisfied without looking.** `ListCheck.quietRun`
(`server/src/extract/list-check.ts:52`) counts the trailing points of a
saturation curve with `new_themes: 0`. It does not check what those points were.
In `9571639c` the direct curve's quiet tail is six `ad_library_search` calls by
the domain of a brand already recorded (`domain+milamiamor.com`,
`domain+trybetterbrand.com`, …) and one re-fetch of `ethale.com`. A lookup of a
known brand cannot name a new brand, so the curve was guaranteed to go quiet. The
same curve also credits the Parallel report with 13 new brands *and* each of
those brands' own pages with 1 more, so the curve counts the same brands twice.
The check accepts both.

2a makes the list depend on one sample, 2b makes that sample cover the wrong
part of the market for the direct class, and 2c means nothing forces the agent
to go back and cover it.

## 3. The change

The principle: **code decides where to look; the agent decides what it found.**
The search grid becomes a fixed list that code builds from the champion, so
coverage no longer depends on how diligent the model is that day.

### 3a. A query grid built by code

A new `CandidateGrid` (domain, pure) builds the queries from the champion's
`competitor_reference` row and the brief:

- direct and indirect_form: `<lead active> <form>` for every `FORMS` entry except
  `other`, plus `<lead active> <champion form> <market>` for each market in the brief;
- indirect_active: `<problem> <form>` for the same forms, plus `best <problem> <market>`.

`lead active` and `problem` are picked by the champion agent: `lead_actives` is a
pick from its own `actives` list, and `problem` is a short phrase quoted from its
`icp`. Code checks that every lead active appears in `actives`. No synonym table
in code.

For the mullein run (one lead active, five markets, eight forms) that is 8 + 5 + 8
+ 5 = 26 queries.

A `CandidateSweep` (agent layer) runs the grid through the existing `WebSearch`
port before the competitors agent starts, alongside the one `discover_competitors`
call, and records each query as a `search` source. Its output is a candidate pool:
brand, url, which query found it. The agent receives the pool in its briefing,
the same way it receives the Parallel list today. `amazon_find_product` is **not**
in the sweep: it is Apify and billed per call, so it stays the agent's choice, as
now.

### 3b. The saturation curve is computed, not reported

Code computes the curve from the pool, one point per grid query in grid order,
`new_themes` = brands that query surfaced for the first time. A brand counts once,
from the first query that found it. The Parallel report is one point, placed
first. `record_saturation` is removed from the competitors agent's tools. 2c
becomes impossible because the agent no longer authors the curve.

A class is saturated when its last N grid queries added no brand (N stays as
`role-deliverables.ts:65` sets it: 3 direct, 2 for each indirect). If the grid runs
out before that, code extends the grid by one step: the next form or market not
yet tried. If there is none, it records a gap, `saturation: <class>: grid
exhausted`.

### 3c. The agent's job shrinks to verdicts

For each candidate in the pool the agent records one of:

- `record_competitor`, as today, after `web_fetch` of its own page; or
- `record_rejected_candidate`: brand, url, reason ∈ {`other_icp`, `other_problem`,
  `out_of_market`, `page_unreachable`, `not_a_product`}, and the source it read.

`finish` refuses while any pool candidate has neither verdict. The agent may still
search for more, and anything it adds goes into the pool and needs a verdict too.

### 3d. Ask Parallel by ingredient and customer, in one question

Keep one Task run, but rewrite `ParallelCompetitorDiscovery.input` and the
schema's `competitors` description so the question names both: products for the
champion's customer and problem **and** products containing `<lead active>`, in
any form, sold in `<markets>`. Each candidate gets a `found_by` field, one of
`ingredient`, `customer`, or `both`, so the list shows which half of the question
it answers. Today the schema says "whatever its ingredients", which leaves the
direct class covered only by chance.

### 3e. A second run starts from the first

Runs already carry `product_id`. When a run for a product starts, the previous
completed run's competitors and rejected candidates join the pool, marked
`carried`. A carried competitor needs its page fetched again (prices and copy
change) but cannot silently vanish: it gets a competitor row or a rejection with
a reason. Re-running then refines the list instead of drawing a new sample.

## 4. What it costs

- 26 `web_search` calls in the mullein case. They are Parallel Search, which is
  billed per call and written to `research_charges`. Check the price per call in
  that table before building this; this spec does not quote one.
- No extra Parallel Task run: 3d changes the question, not the number of calls.
- Fewer agent turns spent choosing searches. Not measured.
- No Apify calls added.

## 5. How we know it worked

Run the mullevia brief twice with `competitors` in scope. Because that runs the
champion, which calls `amazon_find_product`, both runs need the user's go-ahead
(CLAUDE.md rule 5). Pass if:

1. the second run's competitors include every competitor from the first, or a
   rejection row with a reason for each one missing;
2. at least 4 of the September direct brands (Herb Pharm, Nature's Answer,
   Horbäach, Nutravita, St. Francis Herb Farm, Inseason Herbals) are among the
   direct competitors or rejected with a reason;
3. no saturation point in the packet is an `ad_library` source or a page of a
   brand already in the pool.

Regression tests: `CandidateGrid` for a fixed champion builds the exact query
list; the computed curve over a fixed pool gives the expected points; `finish`
refuses with an unjudged candidate; a carried competitor with no verdict
blocks `finish`.

## 6. Out of scope

- Which model runs the agent. All four runs used `z-ai/glm-5.3-flash`, so the
  model did not cause the difference.
- Ads (`ad_library_search` by competitor domain). It stays as it is, but it no
  longer feeds the curve.
