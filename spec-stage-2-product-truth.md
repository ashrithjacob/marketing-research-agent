# Stage 2 · Product truth — plan

Status: **built 2026-10-01, steps 1–6 of §8; not deployed.** The decisions in §9
were taken with the operator the same day. Where the build departs from this
plan, §10 says how and why; §1–§7 are left as planned.

Product truth turns the stage-1 dossier into assessments of the product **in
isolation** — no market comparison. It becomes **stage 2** in the app, and
review mining moves to **stage 3**. The app's stage rail already reserves a
"Product truth — product in isolation" slot (`StageRail.tsx`); this fills it and
moves it ahead of review mining.

---

## 1. What it produces

Four nodes. Each has a fixed shape and a "done" that **code** checks, the way
stage 1's product and category agents do (`NodeFields`, `finish`).

| Node | Output | Done when (checked in code) |
|---|---|---|
| `mechanism` | per active: pathway in plain language (the receptor, enzyme or deficiency it acts on), **time to effect** (value + unit + source), expected magnitude of effect, **story weight** (`carrier` or `supporting`) | every active has every field recorded or gapped; at least one active is a `carrier` |
| `dose_vs_study` | per active: our dose per serving, the studied dose, the studied form, the study cited, a **form-match** note | every active is `at_dose`, `partial`, `under_dose` or `unassessable` |
| `claim_limits` | per market (from the brief) × platform (**Meta, Google Ads**): **permitted** and **forbidden** constructions written out, required disclaimers, the evidence standard each claim needs | every market and both platforms have both lists and their disclaimers, or a gap |
| `cogs_refills` | landed unit cost, MOQ and lead time **as the operator entered them**, days of supply, natural refill interval, gross margin at candidate prices | refill interval and time to effect have been compared, and any mismatch flagged |

The research artifact carries the guard from the brief: *a research artifact,
not legal advice; high-risk categories warrant counsel review before spend.*

## 2. What code computes, and what the agents record

The rule from stage 1 holds: agents record what sources say, with citations;
**code computes anything that is arithmetic or a threshold**, so the answer
cannot drift between runs.

| Computed by code | From |
|---|---|
| dose ratio = our dose ÷ studied dose | the two doses the dose agent records (with units; a unit mismatch is refused when recorded) |
| `at_dose` (ratio ≥ 0.8) / `partial` (0.5–0.8) / `under_dose` (< 0.5) / `unassessable` | the ratio (§9 decision 2); a proprietary blend, an undisclosed amount or no human study ⇒ `unassessable` automatically |
| days of supply = servings per container ÷ servings per day | stage 1's `servings_per_container` and the label's directions |
| natural refill interval | days of supply |
| the churn mismatch flag | refill interval < time to effect of any `carrier` active |
| gross margin at each candidate price, with and without the subscription discount | the operator's landed cost and the price points (§9 decisions 1, 5); no landed cost ⇒ margins gapped, never estimated |

Judgements stay with the agents and are recorded with their source: the
pathway, story weight, whether a study's form matches ours, which constructions
a regulator or platform permits.

## 3. Agents and order

Same architecture as stage 1: one shared ledger, rows tagged with `agent_id`,
each agent its own prompt, record kinds, turn limit and `finish` check, settled
once from the ledger when the last agent ends.

```
step 1   formula ──────────────────────────────┐
                                               ▼
step 2   mechanism ─────────┐       dose_vs_study ─────────┐
                            ▼                              ▼
step 3   cogs_refills (needs time to effect)   claim_limits (needs dose classes)
```

1. **`formula`** (short). Turns stage 1's free-text `full_ingredient_panel` and
   `dose_per_serving` into one row per active: name as printed, amount, unit,
   form (salt, extract ratio), and whether it sits in a proprietary blend. It
   re-reads the label when stage 1's text lacks amounts. Everything after keys
   off this list. *Why an agent:* stage 1 records the panel as text
   ("Wildcrafted Mullein leaf, Ginger, Bromelain… no amounts stated"), and on
   Mullevia that absence **is** the finding — every active is unassessable.
2. **`mechanism`** and **`dose_vs_study`**, side by side, one pass over the
   active list each.
3. **`claim_limits`** after `dose_vs_study` (substantiation depends on which
   claims have at-dose support) and **`cogs_refills`** after `mechanism` (the
   mismatch needs time to effect). `cogs_refills` is mostly code once its inputs
   exist: the agent only reads the label's servings-per-day directions.

Turn limits per agent, as in stage 1, with open fields gapped at the limit.

## 4. Input

- A **completed stage-1 run**, recorded on the stage-2 run as `source_run_id` —
  the link built on 2026-10-01 for review mining, reused. Product truth reads
  that run's product attributes, champion row and markets. A newer stage 1 makes
  an older product-truth run "out of date" the same way it does review mining.
- **Operator inputs**, typed when starting stage 2: landed unit cost (with
  currency), MOQ, lead time. Each may be left blank; blank is recorded as a gap,
  and the margins it would feed are gapped with it.

**Order of stages.** Review mining (stage 3) unlocks only when product truth
(stage 2) has completed **for the same stage-1 run**: stage 3 records its stage-1
run as today and checks that a completed stage-2 run shares it.

## 5. Search and reading — no Firecrawl

| Need | Tool | Measured 2026-10-01 |
|---|---|---|
| finding sources | **Parallel Search** (`POST /v1/search`, `x-api-key`; `objective` + 3–6-word `search_queries`, `advanced_settings.max_results`) | one dose-vs-study query: 200 in **2.4 s**, 5 results with focused excerpts — including drugs.com's *"Clinical data are lacking to provide dosing recommendations"* for mullein. **$5 / 1,000** searches (advanced), $1 / 1,000 (fast) |
| reading a page in full | **Parallel Extract** (`POST /v1beta/extract`, header `parallel-beta: search-extract-2025-10-10`, `urls`, `objective`, `excerpts`, `full_content`) | the Mullevia product page in **23 s**, 19,469 chars, **the full USD bundle table** ($26.95…$179.75) that Crawl4AI missed. **$1 / 1,000** URLs |
| regulator and platform rules | Parallel Search with `source_policy` limited to official domains (fda.gov, ftc.gov, asa.org.uk, tga.gov.au, canada.ca, ad-policy pages of Meta, Google, TikTok, Amazon) | not yet measured |
| fallback without a Parallel key | ~~**SearXNG** (free, ours) for search~~ — removed 2026-10-01, so no search fallback; Crawl4AI for reading | SearXNG's engines blocked the VPS and it answered a blocked search with an empty 200; see `../setup.md` §5c |

Every excerpt and extracted page is archived under its sha256 like a
`web_fetch` today, so "cite only what was read" still holds.

**SearXNG upkeep** (moot since 2026-10-01, SearXNG removed). The VPS ran `searxng/searxng:latest` as pulled on
2026-09-11 (`VERSION_STRING = "2026.9.11+61d660276"`); `latest` means whichever
day it was last pulled. Plan: pin a dated tag in both compose files and update
it on purpose, following the SearXNG update guide, with `setup.md` recording the
pinned version.

**Cost of a run** (estimate, to be measured on the first run): about 60–120
searches and 10–30 extracts ⇒ roughly **$0.35–0.70** in Parallel, plus model
calls. No Apify.

## 6. Renumbering: review mining becomes stage 3

- `domain/nodes.ts`: `STAGES = [1, 2, 3]`; `STAGE_NODES[2]` = the four
  product-truth nodes; `STAGE_NODES[3] = ["review_mining"]`.
- **Names by function, not number.** The 11 `StageTwo*` classes
  (`StageTwoListings` 28 uses, `StageTwoHandoff` 17, `StageTwoRoster` 16…) and
  `stage-two-*` files and routes are review mining, so they become
  `ReviewMining*`. Measured: 23 server files and 11 frontend files mention stage
  two. Numbers in names are what made this rename necessary.
- **Data migration:** existing review-mining runs are stored with `stage = 2`
  (6 on the VPS, measured) and their packets carry `"stage": 2`. One migration
  sets `stage = 3` on runs whose nodes are `review_mining`, and the review packet
  schema reads both until then.
- Stage rail order: 1 Raw material · **2 Product truth** · **3 Review mining** ·
  Market truth · Viability gate · Customer truth · Synthesis.

## 7. Screen

Four tiles on the stage-2 run page:

- **Ingredients** — one card per active: pathway in plain words, time to
  effect, magnitude, a `carrier` badge on the actives that carry the story.
- **Dose vs study** — the table: active · our dose · studied dose · ratio ·
  class · form match · study link; unassessable rows say why.
- **Claim limits** — per market and platform, two columns (permitted /
  forbidden) with the exact wording, the disclaimers above them, and the guard.
- **Economics** — days of supply against each carrier's time to effect (the
  churn flag in red when the bottle runs out first), margin at each price.

## 8. Build order

1. Renumbering and the `ReviewMining*` rename, with the migration; nothing new
   yet. Gate green, deploy, existing review mining unchanged.
2. Parallel Search and Extract adapters behind the existing `WebSearch` and
   `PageFetcher` ports; archived like `web_fetch`.
3. Domain: the four nodes' record kinds and schemas; the code computations of §2
   with tests built from Mullevia's real stage-1 data.
4. Agents (`formula`, `mechanism`, `dose_vs_study`, `claim_limits`,
   `cogs_refills`), prompts, turn limits, done checks.
5. Tiles.
6. One real run on a completed stage-1 run, measured: time, Parallel calls,
   cost, what was gapped.

## 9. Decisions, taken with the operator 2026-10-01

| # | Question | Decided | Rejected |
|---|---|---|---|
| 1 | Where landed unit cost comes from | **The operator enters it** (with MOQ and lead time) when starting stage 2; blank is a gap and so are the margins it feeds | an agent's researched estimate; both |
| 2 | Dose bands | **Three:** `at_dose` ≥ 0.8 · `partial` 0.5–0.8 · `under_dose` < 0.5, plus `unassessable` | two bands at 0.8; two bands at 1.0 |
| 3 | Platforms for claim limits | **Meta and Google Ads**; markets from the brief | TikTok, Amazon (not now) |
| 4 | Order | **Review mining needs product truth complete** for the same stage-1 run | only stage 1, as today |
| 5 | Candidate prices | *Not asked; default:* stage 1's listed prices and subscription price. Others can be added when starting stage 2 | — |

## 10. As built, 2026-10-01

Where the build differs from §1–§8, and why. File paths are under `server/src`.

1. **`formula` reads the regimen, not `cogs_refills`.** §3 had `cogs_refills`
   read servings per day off the label. The dose class needs our *daily* dose
   (amount per serving × servings per day), and `claim_limits` needs the dose
   classes, so servings per day has to exist before step 3. `formula` is already
   reading the label, so it records `regimen` (servings per day and per
   container). `cogs_refills` records every price instead: decision 5's default
   (stage 1's prices) re-read off the product page, because stage 1 records
   price as free text ("1 Bottle: 47.00 SGD; 2+1 Bottles…") and code computes
   nothing from free text.
2. **Order is a dependency graph, not barriers.** `claim_limits` starts when
   `dose_vs_study` ends and `cogs_refills` when `mechanism` ends, as §3's diagram
   draws it (`PRODUCT_TRUTH_AGENT_SPECS.after`). The team mechanics stage 1 had
   inline (`StageOneRun`) moved into `agent/agent-team.ts`, which both stages
   use; stage 1's "champion, then the rest" is the same graph with one edge per
   agent. All 451 existing tests passed unchanged after the move.
3. **"Done" is a list of open items, each closed by a row or a gap whose
   `missing` starts with the item's key** (`extract/product-truth-coverage.ts`),
   the convention stage 1's `NodeFields` already uses. Keys: `actives`,
   `servings_per_day`, `servings_per_container`; `mechanism: <active>`,
   `time_to_effect: <active>`, `carrier`; `dose: <active>` (only actives with an
   amount, outside a blend); `claims: <market> / <platform>` (`claims: market`
   when the brief names none); `prices`. Node status is computed by code at
   settlement from these, so no agent records `node_status`.
4. **Picks are checked when written** (`extract/row-picks.ts`): a mechanism or
   dose study must name a recorded active, a claim limit a market of the brief's,
   and a studied dose must be in the label's unit for that active. This is
   stage 1's shared-actives check generalised; `SharedActives` is called from
   the same place.
5. **Search excerpts are citable.** Parallel Search returns text it read off each
   page, so `agent/tools/evidence-search-tool.ts` archives each result under its
   sha256 and returns a `source_id`, the same as `web_fetch`. Bare SearXNG
   snippets (the fallback) are marked not citable. `domains` on the tool becomes
   `advanced_settings.source_policy.include_domains` (measured: at the top level
   it is a 422). The fetch relevance gate is off for product truth: it would
   filter a regulator's page as off-topic.
6. **Turn limits were chosen in the build, not by the operator:** `formula` 10,
   `mechanism` 15, `dose_vs_study` 15, `claim_limits` 20, `cogs_refills` 8. They
   live in `domain/product-truth-agents.ts`.
7. **Product truth always runs whole.** Any stage-2 node in a request expands to
   all four (`Stages.expand`), because each node needs what another found.
8. **The renumbering migration is a named data migration**
   (`adapters/store/migrations.ts`, `research_migrations`), since the existing
   migrations only add columns.
9. **Margins are per unit**: (price ÷ units in the price − landed cost) ÷ (price
   ÷ units). A price in another currency than the landed cost gets no margin,
   with the reason, rather than a conversion.
10. **Found while building:** `StageOneHandoff.forBrief` (was `StageTwoHandoff`)
    handed over the newest stage-1 run with a packet whatever its status, which
    became wrong once invalid runs kept their packet. It now takes only
    completed runs; regression test in `tests/review-mining-plan.test.ts`.

