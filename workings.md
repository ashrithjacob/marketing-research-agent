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
   page it read (`UrlLedger.unknown`). Accepted, the run waits at
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
3. **Classification is code, not the agent** (`CompetitorRelationship.classify`):
   no key active → `other`; same form factor as the client → `direct`; else
   `indirect`. The agent only reports what the page shows.

The stage completes when the brief is accepted and at least one competitor is
profiled; the summary names any competitor that could not be. Not built yet in
stage 1: ranking (it needs stages 3 and 4), product images and label reading,
economics, market size, Scira.

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
