# Backup LLM — spec

A run currently dies with its model. If OpenRouter rate-limits
`deepseek/deepseek-v4-flash-0731` at turn 20, everything the run gathered is lost,
because the only thing the supervisor can do is retry the same model or give up.

This specifies a **backup model**: a second model, chosen by the operator per run,
that a run falls over to when — and only when — the primary is rate-limited or the
provider is failing. Everything else keeps today's behaviour.

Status: **design, not built.** Written 2026-09-21 against the code at that date.
Nothing here is implemented yet; §10 is the checklist.

---

## 1. What already exists (read this first)

The pieces this builds on, all in `server/src`:

| Thing | Where | Today |
|---|---|---|
| Model choice | `runner.ts` `start()` | `request.model \|\| settings.model`, resolved with `models.getModel("openrouter", id)`. Unknown id → run row `failed`, HTTP 502. |
| Pricing | `costs.ts` `price(model)` | Writes OpenRouter's live rates onto `model.cost` and returns `{model, pricing}`. The `pricing` travels with the run's usage. |
| Active model | `agent.state.model` | pi-agent-core: *"Active model used for future turns."* A plain property — assigning it changes the model from the next turn on, transcript intact. |
| Retry | `runner.ts` `watch()`, `shouldRetry()`, `retryableError()`, `backoffMs()` | Up to `DEFAULT_RETRY.attempts` (3) continuations, 2s/4s/8s with equal jitter, capped 30s. Retries anything except `TERMINAL_ERROR`. |
| Salvage | `runner.ts` `lacksPacket()` | After the budget is spent, if the transcript holds a tool result, one tools-off ask for the packet. |
| Per-call record | `trace.ts` → `research_llm_calls.model` | Already stores the model **per call**, so a run that used two models is already recorded honestly at call level. |
| Run record | `store.ts` `research_runs.model` | One model per run. This is the field that has to grow. |
| Catalogue | `models.getModels("openrouter")` | The full synchronous list, each `Model` carrying `contextWindow`, `maxTokens`, `cost`. Nothing in the app exposes it to the UI. |

Two live failures motivate this, both measured:

- **2026-09-21, HappyWags.** Stream dropped 98s into turn 6, `error: "terminated"`.
  Five completed turns and 15 tool calls lost. Retry now covers this.
- **2026-09-21, Droplet.** `Upstream error from Relace: The model stopped before
  completing the response` at turn 6, 140k tokens lost. Retry now covers this too —
  but if Relace stays broken, three retries against the same model buy nothing. That
  is the case for a backup.

**No rate limit has been observed in this app yet.** Every OpenRouter 429 story here
is from the vocabulary in `pi-ai/utils/retry.js`, not from our own logs. Whoever
builds this should add the first real 429 to this file with its exact wording.

---

## 2. Scope

**In:** falling over to a second model on rate limits and provider failures, chosen
per run in the UI, with the switch visible in the cockpit and in the cost record.

**Out, deliberately:**

- Switching back to the primary later in the same run. A run that fell over stays on
  the backup until it ends. Flapping between models mid-transcript makes the trace
  hard to read for a gain nobody has asked for.
- A chain of three or more models. One backup. If the backup also fails, the run
  salvages a packet and fails, as it does today.
- Changing models mid-run by hand. That is a different feature (`/steer` for models)
  and should not be smuggled in here.
- Per-node models (cheap model for product_data, strong model for competitors).
  Possible later; the data model below does not prevent it.

---

## 3. Error taxonomy — the whole decision

Today `retryableError()` splits errors two ways. This needs three. One function,
returning one of three verdicts, replaces it:

```ts
export type Failure = "rate_limit" | "provider" | "terminal";

export function classifyError(errorMessage: string): Failure;
```

| Class | Matches (case-insensitive) | Why | Action |
|---|---|---|---|
| **`rate_limit`** | `429`, `rate limit`, `too many requests`, `overloaded`, `capacity`, `ResourceExhausted`, `try again later`, `temporarily unavailable`, `model is busy` | The model or its upstream is refusing *this* traffic now. Another model on the same key is not refusing anything. | **Switch to backup immediately**, no retry on the primary. |
| **`provider`** | anything not matched by the other two — `terminated`, `socket hang up`, `fetch failed`, `502`/`503`/`504`, `stopped before completing the response`, and wordings nobody has written down yet | Transport or upstream trouble, usually transient. | **Retry the primary** with today's policy (3 attempts, 2/4/8s ± jitter). On exhaustion, **switch to backup**. |
| **`terminal`** | `insufficient_quota`, `quota exceeded`, `out of budget`, `billing`, `payment required`, `402`, `credits exhausted`, `401`, `403`, `unauthorized`, `invalid api key`, `context length`/`context window`/`maximum context`, `prompt is too long`, `invalid_request`, `unknown model`, `model not found`, `content policy`/`content filter`, `safety` | Deterministic, or account-level. | **Fail the run.** No retry, no switch. |

Three rules the table encodes, each of which is easy to get wrong:

1. **`402` / out of credit is terminal, not a rate limit.** The credit belongs to the
   OpenRouter *key*, not the model. A backup on the same key fails identically, and a
   fallback would double the cost of discovering that.
2. **Context-length is terminal even though a bigger backup might fit it.** Switching
   models because a transcript outgrew the window is a different feature — a
   context-aware failover — and it needs to know the backup's `contextWindow` before
   the request, not after the error. See §6 guard 2; the check happens *before* the
   switch, so an error that says "too long" means the transcript will not fit
   anywhere we were willing to send it.
3. **Unknown wording stays retryable.** This is the lesson from Relace: a
   recognise-list refuses what it has never seen, and `retryableError()` was rewritten
   for exactly that reason. Keep the default on the "try again" side.

`retryableError()` becomes a thin wrapper — `classifyError(msg) !== "terminal"` — so
the existing tests keep meaning what they meant.

---

## 4. Run flow with a backup

```
                 ┌─────────────────────────────────────────────┐
                 │ agent.prompt(instructions)  ·  model = MAIN  │
                 └───────────────┬─────────────────────────────┘
                                 │ waitForIdle
                    errorMessage?├── no ──▶ lacksPacket? ──▶ nudge ──▶ settle
                                 │ yes
                     classifyError(msg)
            ┌────────────────────┼─────────────────────┐
     rate_limit              provider                terminal
            │                    │                       │
            │          attempts < budget?                │
            │            yes │      │ no                 │
            │    backoff+jitter     │                    │
            │    prompt(resume)     │                    │
            │         ↺             │                    │
            └──────────┬────────────┘                    │
                       ▼                                 ▼
            backup configured & guards pass?      settle: failed
                yes │              │ no
     switch model, reset budget    ▼
     emit run.model_switched   settle: failed
     prompt(resumeAfterSwitch)
                ↺ (backup gets its own budget; no third model)
```

Concretely, in `watch()`:

1. `agent.prompt(instructions)` → `waitForIdle()` — unchanged.
2. **Failure loop**, replacing today's retry loop:
   - read `agent.state.errorMessage`; empty → leave the loop;
   - `classifyError` it;
   - `terminal` → leave the loop (settle will mark it `failed`);
   - `provider` and attempts remain → `backoffMs` sleep, `prompt(resumeText(...))`,
     continue;
   - `rate_limit`, **or** `provider` with the budget spent → try `switchToBackup()`;
     if it returns false (no backup, or a guard refused) leave the loop;
   - after a successful switch, reset the attempt counter, `prompt(resumeAfterSwitchText(...))`,
     continue. The switch itself is allowed **once per run**.
3. `lacksPacket()` → the tools-off salvage ask, unchanged.
4. `settle()` — unchanged, except that the run row now records which model finished it.

**Budgets.** The primary keeps `DEFAULT_RETRY.attempts` (3). The backup gets its own,
smaller budget — `BACKUP_RETRY = { attempts: 2, baseMs: 2000, capMs: 30000 }` — because
by the time it runs, the run has already spent minutes and a full context re-send per
attempt. Worst case per run: 1 + 3 primary attempts, 1 + 2 backup attempts, 1 salvage
ask.

**Why a rate limit does not retry the primary at all.** A 429 with no `Retry-After` is
worth waiting out only if the window is short, and we cannot see the window.
Switching costs one call; waiting costs 2s + 4s + 8s and then the switch anyway. If a
real 429 turns out to clear in under two seconds, revisit this with the measurement
in hand.

---

## 5. What the agent is told when the model changes

A new prompt in `prompt.ts`, beside `resumeText()` and `packetNudgeText()`:

```ts
export function resumeAfterSwitchText(from: string, to: string, reason: Failure): string {
  return (
    `The model answering this run has changed from ${from} to ${to}, because the ` +
    `first was ${reason === "rate_limit" ? "rate-limited" : "failing"}. ` +
    "The transcript above is yours: the tool results in it stand and do not need " +
    "fetching again. Carry on from where that run left off, and finish with the " +
    "stage-1 packet as a single fenced ```json block."
  );
}
```

Two reasons to say it out loud rather than switch silently:

- The backup reads a transcript written by another model and may otherwise treat the
  half-finished turn as its own work.
- It shows up in `research_llm_calls.input`, so the log page explains the seam.

---

## 6. Guards — refuse a switch that cannot work

`switchToBackup()` returns false, leaving the run to fail honestly, when:

1. **No backup configured.** `run.backup_model` empty and `MRA_BACKUP_MODEL` unset.
2. **The transcript will not fit.** `estimateTokens(agent.state.messages)` — the
   simplest honest estimate is the last call's `usage.input` from
   `research_llm_calls` — against `backup.contextWindow`, with 10% headroom. A
   backup with a smaller window is the likeliest trap, and discovering it by
   sending 200k tokens costs money for a guaranteed error.
3. **The backup is the primary.** Same id, or the same model under two names.
4. **The backup is unknown to the provider.** `models.getModel("openrouter", id)`
   returns undefined. This should already have been caught at `start()` (§7), so
   reaching it here means the catalogue changed mid-run; log it.
5. **The run is stopping.** Same check as `shouldRetry()`.

Each refusal emits `run.model_switch_refused { reason }` so the cockpit can say why a
run with a backup configured did not use it. Silence here would look like a bug.

---

## 7. Data model

### 7.1 `research_runs`

One new column, through the migration list in `store.ts` (**`CREATE TABLE IF NOT
EXISTS` does not alter an existing table** — an old database gets the column only
from here):

```ts
["backup_model", "ALTER TABLE research_runs ADD COLUMN backup_model TEXT NOT NULL DEFAULT ''"],
```

`model` keeps its meaning: **the model the run started on**. Which model finished it
is derivable from `research_llm_calls.model`, which trace.ts already records per
call, and from the `run.model_switched` event. Do not overwrite `model` on a switch —
that would erase what the operator chose.

### 7.2 Usage and cost

`run.usage.pricing` is a single rate set today, written when the run starts. A run
that used two models cannot be priced from one. Change `usage` to carry a breakdown:

```jsonc
"usage": {
  "input": 812340, "output": 21050, "totalTokens": 833390,
  "cost": { "total": 0.0412, … },          // still the run total, summed per call
  "pricing": { … },                         // the PRIMARY's rates: unchanged shape, unchanged meaning
  "models": [                               // new
    { "model": "deepseek/deepseek-v4-flash-0731", "turns": 19, "totalTokens": 700100,
      "cost": 0.0331, "pricing": { "source": "openrouter-live", "rates": { … } } },
    { "model": "google/gemini-2.5-flash",         "turns": 4,  "totalTokens": 133290,
      "cost": 0.0081, "pricing": { … } }
  ]
}
```

`callStats()` in `api.ts` already sums per-call usage, so the log page's totals stay
correct with no change. The `models` array is built the same way — group
`research_llm_calls` by `model`. The cockpit's "Calc. cost" tile keeps showing the
total; its tooltip (`pricingNote`) gains a line per model.

### 7.3 Events

| kind | payload | when |
|---|---|---|
| `run.model_switched` | `{ from, to, reason: "rate_limit" \| "provider", attempt }` | the switch succeeded |
| `run.model_switch_refused` | `{ to, reason: "no_backup" \| "context" \| "same_model" \| "unknown_model" }` | a guard refused |

`run.resumed` keeps its meaning — a retry on the *current* model — and gains nothing.

---

## 8. API and UI

### 8.1 `GET /api/research/config`

Add the catalogue and both defaults, so the modal can render selects without a second
round trip:

```jsonc
{
  "model": "deepseek/deepseek-v4-flash-0731",        // unchanged: the default primary
  "backup_model": "google/gemini-2.5-flash",         // new: MRA_BACKUP_MODEL, "" when unset
  "models": [                                         // new
    { "id": "deepseek/deepseek-v4-flash-0731", "name": "DeepSeek v4 Flash",
      "context_window": 262144, "input_per_m": 0.06, "output_per_m": 0.12 },
    …
  ],
  …existing fields…
}
```

Built from `models.getModels("openrouter")`, priced through `costs.price()` so the
numbers shown are the live ones, and **filtered**: `input` includes `"text"` and
`contextWindow >= 100_000`. A stage-1 run is a long tool-using transcript; offering a
32k model is offering a run that dies at turn eight. Sort by `input_per_m` ascending.

**There is no tool-support flag to filter on.** pi-ai's `Model` carries `id`, `name`,
`api`, `provider`, `baseUrl`, `reasoning`, `input`, `cost`, `contextWindow`,
`maxTokens` — and nothing that says whether the model can call tools. A model that
cannot will fail on its first turn with a provider error, which the loop in §4 will
then read as `provider` and retry three times before switching. Two consequences,
both to be lived with rather than solved here:

- `MRA_MODEL_CHOICES` (comma-separated ids) exists mainly for this. Curate it once
  per deployment and the dropdown cannot offer a model that will not work. Unset
  means the filtered catalogue, which is a longer list with sharper edges.
- If a first-turn failure on a *newly chosen* model turns out to be common, add a
  fourth class to §3 — a failure on turn 1 with no tool result in the transcript is
  more likely a capability problem than a transient one, and retrying it three times
  is wasted. Do that only with a real example in hand.

### 8.2 `POST /api/research/runs`

`runRequestSchema` gains one field:

```ts
backup_model: z.string().default(""),   // "" = MRA_BACKUP_MODEL; "none" = no fallback
```

`"none"` is a real value and must survive: an operator turning the backup *off* for a
run is different from one leaving it unset. Validate both ids at `start()` against
`models.getModel`, and fail with the same 502-plus-failed-row path the unknown
primary uses today — discovering a bad backup id twenty minutes into a run is the
worst possible time to discover it.

### 8.3 Run summary and detail

`summary()` gains `backup_model`. `GET /runs/:id` gains nothing else; the cockpit
reads the switch from the events it already streams.

### 8.4 The Start run modal (`StartRun.tsx`)

Two selects under the market checkboxes, collapsed behind a disclosure so the common
path stays two fields:

```
Product name, or the site's URL   [ https://thedropletco.co.uk/        ]

Markets  [x] US  [x] UK  [x] Australia  [x] New Zealand  [x] Canada
Also / instead  [                                                      ]

▸ Models                    DeepSeek v4 Flash → Gemini 2.5 Flash
  ┌──────────────────────────────────────────────────────────────────┐
  │ Model    [ DeepSeek v4 Flash · 262k · $0.06/$0.12 per M      ▾ ] │
  │ Backup   [ Gemini 2.5 Flash  · 1.0M · $0.30/$2.50 per M      ▾ ] │
  │          Used only if the model is rate-limited, or keeps        │
  │          failing after 3 retries. "No backup" runs as today.     │
  └──────────────────────────────────────────────────────────────────┘
```

- The summary line beside the disclosure shows the current pair, so the choice is
  visible without opening it.
- Backup options include **No backup** (sends `"none"`).
- Selecting the same model for both disables Start with a one-line reason rather than
  failing at runtime.
- Both persist per-browser in `localStorage` (`mra.model`, `mra.backupModel`),
  wrapped in try/catch, falling back to the config defaults. Runs are started from
  the same laptop repeatedly; retyping the pair every time is friction for nothing.
- A per-node re-run from the stage rail inherits the pair of the run on screen.

### 8.5 Run detail and trace (`RunView.tsx`)

- The **Model** row shows the pair and the switch:
  `deepseek-v4-flash-0731 → gemini-2.5-flash (switched, rate limit)`.
  Before any switch: `deepseek-v4-flash-0731 · backup gemini-2.5-flash`.
- `traceText()` gains:
  - `run.model_switched` → *"rate-limited on deepseek-v4-flash-0731 — switched to gemini-2.5-flash"*
  - `run.model_switch_refused` → *"kept deepseek-v4-flash-0731 — the backup's context window is too small for this transcript"*
  Both get `traceClass` `rule`, like `run.resumed`.
- The runs list marks a switched run with a small `⇄` beside its status, titled with
  the reason. A run that quietly changed model is a run whose cost and quality moved
  for reasons the list should not hide.

---

## 9. Settings

| Variable | Default | Meaning |
|---|---|---|
| `MRA_MODEL` | `deepseek/deepseek-v4-flash-0731` | unchanged |
| `MRA_BACKUP_MODEL` | `""` | Default backup. Empty means no fallback unless a run names one. |
| `MRA_MODEL_CHOICES` | `""` | Comma-separated ids to offer in the UI. Empty means the filtered catalogue (§8.1). |
| `MRA_BACKUP_RETRY_ATTEMPTS` | `2` | The backup's own attempt budget. |

Pick a backup from a **different upstream family** than the primary. A backup that
OpenRouter routes to the same provider is not a backup; it is the same queue.

`docker-compose.yaml` passes the new variables through, and `.env.example` documents
them with that sentence.

---

## 10. Implementation checklist

Each item is independently testable; the order is the order to build them.

- [ ] **`classifyError()`** in `runner.ts`, with `retryableError()` reduced to a
      wrapper. Tests: the Relace string → `provider`; `429 rate limit exceeded` →
      `rate_limit`; `402 insufficient_quota` → `terminal`; an unknown wording →
      `provider`.
- [ ] **`backup_model` column** + migration + `summary()` field. Test: an old row
      with no column reads back `""`.
- [ ] **`runRequestSchema.backup_model`**, validated at `start()`; `"none"` honoured;
      unknown id → 502 and a `failed` row. Tests in `api.test.ts`.
- [ ] **`switchToBackup()`** with the five guards and both events. Tests: each guard
      refuses with its own reason; a good switch sets `agent.state.model` and keeps
      `state.messages` intact.
- [ ] **The failure loop** in `watch()`. Tests, with the faux provider: a
      `rate_limit` first error switches with **zero** retries on the primary; a
      `provider` error retries three times *then* switches; a switched run that then
      succeeds settles `completed`; a switched run that keeps failing spends the
      backup budget, then salvages, then fails; `terminal` never switches.
- [ ] **`resumeAfterSwitchText()`** and its appearance in the next call's input.
      Test: the continuation names both models.
- [ ] **Usage `models[]` breakdown**, built by grouping calls. Test: a two-model run
      reports two entries whose costs sum to the run total.
- [ ] **`GET /config` catalogue**, filtered and priced. Tests: a 32k model is
      excluded; `MRA_MODEL_CHOICES` narrows the list.
- [ ] **Modal selects**, `localStorage`, the same-model guard, the summary line.
- [ ] **Run detail, trace lines, runs-list marker.**
- [ ] **Docs**: `workings.md` step 0a (the failure loop is no longer only a retry),
      the event table, the `/config` and `POST /runs` shapes; `setup.md` for the new
      env vars; a line in this file recording the first real 429 seen in the wild.

---

## 11. Deliberate non-goals, with reasons

- **No automatic "cheapest model that works" selection.** The operator picks. A
  system that silently reaches for a different model changes what a packet is worth
  without telling anyone.
- **No switch on `invalid` packets.** A model that produces a malformed packet is a
  prompt or contract problem, and swapping models hides it. The nudge already covers
  the "no packet" case.
- **No parallel hedging** (same prompt to two models, first wins). It doubles cost on
  every turn to save the rare failure, and a research run is not latency-sensitive.
- **No retry-with-backup of the *same* turn.** The switch continues from the
  transcript; it does not re-run the turn the primary failed on. The lost turn's tool
  results were never written, so there is nothing to duplicate.
