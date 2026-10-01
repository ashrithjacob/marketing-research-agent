# Handoff — 2026-10-01

State of the work at the end of a long session, so the next agent can carry on
without the operator re-explaining. Read `CLAUDE.md` first (its six rules and the
`mra check` gate are binding), then this, then the spec for the next job.

## Where things stand

| | |
|---|---|
| HEAD | `935acd4` on `main` — committed, **deployed** to marketing.vanis.ai and verified inside the live container |
| Uncommitted | `spec-stage-2-product-truth.md` (the plan for the next job), this file |
| Gate | `.claude/skills/mra-control/bin/mra check` green at HEAD |
| Local stack | may be down; `mra up` starts it |
| VPS | no run in progress at last check; Firecrawl key there is **out of credits** (402), so every live fetch goes through the Crawl4AI fallback |

## What was built this session (all deployed)

1. **Stage 1 is four agents, not one** (`workings_stage1.md` is the decision
   record, 16 decisions). `champion` runs first (finds the product everyone
   measures against; skipped only for a url brief without `competitors`), then
   `product`, `competitors`, `category` run side by side on **one shared ledger**
   (`research_findings`, every row tagged `agent_id`; an agent replaces/retracts
   only its own rows, reads everyone's via `read_ledger`, can `wait_for` another's
   row, polling 15 s). Code: `agent/stage-one-run.ts` (orchestrator),
   `stage-one-agent-factory.ts`, `agent-driver.ts`, `domain/stage-one-agents.ts`.
2. **Per-agent prompts** — `agent/prompt/text/tasks.ts` (one task per agent),
   `sources.ts` (shared source rules), `system.ts` (one role line per agent).
   The old generic `rules.ts`/`recording.ts`/`node-rules.ts` are deleted.
3. **Fields enforced in code** — `domain/node-fields.ts`: product's ten
   `PRODUCT_ATTRIBUTES` and category's `search_volume` (≥3 distinct years),
   `category_size: <segment>`, `seasonality` must each be recorded or gapped
   (`"<field>: <why>"`) before `finish` passes. **Extra keys are allowed** for
   both (operator's call) — required first, extras after, shown under "Also
   found" in the UI. Excerpts are no longer recorded by any stage-1 agent.
4. **Turn limits** via pi-agent-core's own `finishTurn` hook (`agent/turn-budget.ts`):
   champion 10, product 15, competitors 20, category 15 — the operator set these
   numbers in `STAGE_ONE_AGENT_SPECS`. At the limit code gaps every open field
   ("not found within the N-call limit") and emits `agent.limit_reached`.
5. **Per-agent `finish`** checks only that agent's part (`agent/done-check.ts`);
   the run settles once, after the last agent, re-running every agent's check
   plus the whole-packet validation (`run-settlement.ts`).
6. **Shared actives are picks, not free text** (`extract/shared-actives.ts`,
   commit `935acd4`): a competitor's `shared_actives` must be copied word for word
   from the champion's `actives`; checked at record time (`RunFindings`) and at
   finish/settlement (`CompetitorCheck`). Fixes runs `c0f14d91` and `bb89e90a`.
   **Not yet seen on a real competitors run.**
7. **Page fetch fallback** `Firecrawl → Crawl4AI` (`adapters/fallback-fetcher.ts`,
   `crawl4ai.ts`), only when Firecrawl can fetch nothing (401/402/no key). A
   scrape.do middle step was built and **removed** the same day (slow, 5 credits,
   charged for an empty PDF). `CRAWL4AI_API_KEY` is in local `.env`, VPS
   `~/mra-compose/.env`, and both compose files.
8. **Stage 2 belongs to one stage-1 run**: `research_runs.source_run_id` records
   which stage-1 run a review-mining run mined (migration backfilled old rows).
   The run page counts stage 2 only through that link; an old mining run whose
   stage 1 was rerun shows "ready — stage 1 was rerun", a banner, and hides its
   customer voice behind a toggle (`run-view/outdated-voice.tsx`).
9. **UI**: one tab per agent on the activity log (`logs/agents.ts`,
   `AgentTabs.tsx`); `agent_id` on every LLM call and event; required-field split
   via `GET /config` → `required_fields`.

## Done since (same day, not committed, not deployed): Stage 2 · Product truth

Built steps 1–6 of `spec-stage-2-product-truth.md` §8. Its §10 lists where the
build departs from the plan, and `workings.md` §2f has the mechanism and the
measured run (`8d3842e0`, local: completed, 18 min 34 s, $0.1611 billed,
22 Parallel searches + 49 extracts). Review mining is stage 3 and needs product
truth complete on the same stage-1 run. VPS: run the deploy only when told;
`PARALLEL_API_KEY` is not in the VPS `.env` yet, and the first start renumbers
the 6 stored review-mining runs to stage 3.

## Was next: Stage 2 · Product truth

Full plan: **`spec-stage-2-product-truth.md`** (decisions taken with the operator
in its §9). In one line: a new stage between stage 1 and review mining, four
nodes — `mechanism`, `dose_vs_study`, `claim_limits`, `cogs_refills` — run by
agents `formula` → (`mechanism` ∥ `dose_vs_study`) → (`claim_limits`,
`cogs_refills`), with code computing ratios, dose bands (at ≥0.8, partial
0.5–0.8, under <0.5, unassessable), days of supply, margins and the churn flag.
Search via **Parallel** (Search + Extract, measured working with
`PARALLEL_API_KEY` from `.env`), SearXNG as fallback, **no Firecrawl**. Landed
cost/MOQ/lead time are **operator inputs**. Claim limits: brief's markets ×
**Meta + Google Ads**. **Review mining moves to stage 3 and requires stage 2
complete** for the same stage-1 run.

**The operator was asked "start with step 1, the renumbering?" and has not
answered yet.** Step 1 = renumber (review mining → stage 3, rename the 11
`StageTwo*` classes to `ReviewMining*`, migrate the 6 VPS rows with `stage = 2`),
nothing new — gate green, deploy, existing review mining unchanged.

Parallel API facts (measured, not in their quickstart): Search is `POST
https://api.parallel.ai/v1/search`, header `x-api-key`; `max_results` goes in
`advanced_settings`, not top level (top level → 422). Extract is `POST
/v1beta/extract` with header `parallel-beta: search-extract-2025-10-10` and body
`urls`, `objective`, `excerpts`, `full_content` (`/v1/extract` rejects those
fields).

## Open issues, known and not fixed

- **No champion ⇒ run still starts step 2** and ends `invalid` (run `8d5a8325`).
  Proposed: stop after step 1 and say why. Not built.
- **A service that can fetch nothing should fail the run as `failed`**, not let
  agents loop on 402s. Not built.
- **Crawl4AI misses JavaScript-drawn content** (e.g. Shopify bundle prices) and
  routes through arbitrary regions (prices came back in SGD on run `c0f14d91`).
  `proxy: "residential"` + `country` fixes it 5 of 7 times at 4 credits; not
  wired. Parallel Extract got the prices in one try — a candidate to replace
  Firecrawl/Crawl4AI in stage 1 too (operator not asked yet).
- **Category tile headline** matches exact metric names (`market_size`,
  `search_volume`) and shows nothing for `category_size: …`
  (`frontend/src/run-view/tiles-data.tsx:141`). Explained to operator, not fixed.
- **Empty "Excerpts" heading** still rendered on the Product tile.
- **Invalid runs show no stage-1 tiles** (no packet is stored when checks fail);
  operator wants stage 1 visible with its gaps even when incomplete. Not built.
- Error text on invalid runs lists each agent problem twice (per-agent check +
  whole-packet check).
- The trace file is not tagged per agent (LLM calls and events are).

## How the operator works (binding)

- **Ask before any run that spends Apify** — every stage-1 run except a url brief
  without `competitors`. Free verification run: `mra run "https://…"
  product_data,category_data`. One run to verify; no reruns to polish.
- **VPS only when told** ("deploy", "push to VPS"). Deploy with
  `bash marketing-research-agent/deploy/vps/deploy.sh` from `agent-collection/`;
  check no run is live first (a deploy kills it); verify inside the container
  afterwards — a healthy `/api/health` proves nothing.
- **Commit only when asked**; commits go on `main`, ending with the
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` line.
- **No domain knowledge hardcoded in code** (e.g. ingredient synonym tables): the
  operator rejected that because it only works for the case it was written for.
  Prefer an agent's judgement recorded as a pick from a closed list, with code
  checking the pick.
- **Answer the question asked, then stop**; explain mechanisms with file:line;
  every number says where it was measured.
- Docs are part of every change: `workings.md`, `../setup.md` (outside this git
  repo — not versioned), `FEATURE_MAP.md`, `workings_stage1.md`; mark reversed
  decisions *Superseded* with why. Regenerate `docs/class-diagram.md` when
  classes change.

## Runs worth knowing

| Run | Where | What it shows |
|---|---|---|
| `0dc7e23c` | local | first 2-agent run; generic prompts — product 61 excerpts, 10½ min |
| `4035e2b6` | local | custom prompts — 350 s, 1.12M tokens |
| `1a7ce359` | local | extra attributes + limits — 178 s, $0.058 |
| `75d680bc` | local | Firecrawl 402 everywhere; turn limit fired live on category |
| `8d5a8325` | local | no champion (fetch dead) ⇒ `invalid` |
| `c0f14d91` | local | completed, but competitors rewrote 30 rows to pass the old shared-actives check; prices in SGD |
| `bb89e90a` | VPS | `invalid` on the shared-actives mismatch (fixed by `935acd4`) |
| `3a1cd212` | local | old review mining, now shown as out of date |
