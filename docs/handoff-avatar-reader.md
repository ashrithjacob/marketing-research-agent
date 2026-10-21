# Hand-off: why the avatar reader is slow and token-hungry

*Written 2026-10-21 to start a fresh session from.* Everything below was
measured on run `344caa7d25fe4c108ac0c7f7a936394a` (Mullevia Mullein Drops) in
the local stack (`mra-db`). The query that gives each number is under
"How to look". Nothing here has been fixed yet.

The user's position: **no output-token cap unless it is shown to be needed.**
The aim of the next session is to find out what actually goes wrong, then fix
the cause.

## What the stage does

Stage 5, avatars (`agent/stages/avatars/avatar-stage.ts`):

1. Every stored review of the product and its competitors is read in batches
   of **40** (`AvatarStage.REVIEW_BATCH`), **one batch after another**: each
   batch sees the avatar memory the previous batch produced, so batches cannot
   run in parallel.
2. Each batch is one agent, `avatar_reader:<n>` (`avatar-reader.ts`), with no
   tools and at most 4 turns. Its instructions hold the product line, the whole
   current memory (`MemoryView.memory`) and the 40 reviews, each cut at 1,500
   characters (`MemoryView.reviews`).
3. It ends by calling `submit` with a `MemoryUpdate` (`domain/avatars.ts:46`):
   `create` (new avatars, each a full profile), `revise` (fields of existing
   ones), `merge`, `assign` (every review id → an avatar key or null) and
   `quotes`. Code checks it (`extract/avatar-memory-check.ts`).
4. After all batches: ads are placed on the avatars (15 a call), then one
   judge call gives the verdicts.

Model: `z-ai/glm-5.3-flash` (`MRA_MODEL`), backups
`deepseek/deepseek-v4.1-flash` and `minimax/minimax-m3`. OpenRouter list price
on 2026-10-21: $0.15 per million input tokens, $0.50 per million output.

## Why it takes long even when nothing goes wrong

- Run `344caa7d` had **874 reviews** when this attempt started, so **22
  batches** in sequence. The product now has **1,506** (competitors were added
  on 2026-10-21), so the next run is **38 batches**.
- Batches 1–4 of this attempt took 7.6 minutes together (15:31:28 → 15:39:04
  UTC): about **1.9 minutes a batch**. At that pace 22 batches is about 42
  minutes, and 38 is about 72, before ad placement and judging.
- Market awareness (stage 4) is not the slow one: it ran 03:08 → 03:18 UTC on
  2026-10-21.

## Where the tokens go: four measured causes

Every call of this attempt (`llm_calls`, agent `avatar_reader:%`, started
after 2026-10-21 15:30):

| Call (seq) | Batch | Seconds | Input tokens | Output tokens | Thinking chars | Answer chars | Why it ended |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 156 | 6,623 | 18,286 | 52,506 | 10,760 | refused: `create.0–3.parent` missing |
| 2 | 1 | 23 | 28,824 | 3,404 | 124 | 10,824 | accepted |
| 3 | 2 | 51 | 7,890 | 7,490 | 13,966 | 6,662 | accepted |
| 4 | 3 | 43 | 7,553 | 6,327 | 11,609 | 4,877 | accepted |
| 5 | 4 | 52 | 7,566 | 7,817 | 15,733 | 4,188 | refused: `create.0.parent` missing |
| 6 | 4 | 77 | 15,978 | 4,841 | 7,118 | 8,881 | refused: `revise: must be array` |
| 7 | 4 | 55 | 23,954 | 5,172 | 2,810 | 9,493 | accepted |
| — | 5 | 1–2 h | ? | ? | ? | ? | never ended (below) |

### 1. Most of the output is reasoning, and we never chose how much

Thinking is 68–83% of the characters written on every first attempt. The
setting is never made:

- `AgentRunner` (`agent/kernel/agent-runner.ts`) creates the pi-agent-core
  `Agent` without a `thinkingLevel`. pi-agent-core then defaults to `"off"`
  (`node_modules/@earendil-works/pi-agent-core/dist/agent.js:41`).
- With `"off"`, pi sends no reasoning option (`agent.js:307`).
- pi-ai's catalogue entry for `z-ai/glm-5.3-flash` has
  `thinkingLevelMap.off: null`: this model has no "off". So for
  `thinkingFormat: "openrouter"`, pi-ai sends nothing at all
  (`pi-ai/dist/api/openai-completions.js`, the `openrouter` branch near line
  686), and the model reasons at OpenRouter's or the provider's default
  effort.
- The levels this model does accept, per the same map: `low`, `high`, `max`.
  (DeepSeek's entry maps `off` to `"none"`, so a fallback to DeepSeek *does*
  switch reasoning off. The three models behave differently.)

To check, without spending: print the request body pi-ai builds, through
`onPayload` (already wrapped by `ModelChain.withFallbacks`), in a faux test.

### 2. Small schema slips force the whole answer to be written again

Three of the four batches that finished had a refused `submit`:

- **`parent` missing** (calls 1 and 5). `create[].parent` is
  `Key.nullable()`, which is *required but may be null*. The model leaves the
  key out for top-level avatars.
- **`revise` not a list** (call 6). The model sent one revision as an object.

A refusal is sent back as pi-ai's validation message, which repeats the
model's **entire** arguments ("Received arguments: …",
`pi-ai/dist/utils/validation.js:306`). The model then writes its entire answer
again. So the conversation grows by two copies of the answer per slip: batch
4's input went 7,566 → 15,978 → 23,954 tokens.

Both slips are about the schema's shape, not the content. That makes the
design fix the obvious candidate: `parent` defaulting to null, and `revise`
accepting one object as well as a list. The check in `AvatarMemoryCheck` stays
as it is.

### 3. The answer is long by design

- `assign` carries all 40 review ids (32-hex each) with a key: about 3,000
  characters a batch. Needed: code must know where every review went.
- `create` writes each new avatar's full profile (pains, desires, triggers,
  prior solutions, objections, angles…): about 7,000 characters for 4
  avatars in batch 1.
- `revise` replaces whole fields, so a list that gains one item is written out
  in full: up to 5,922 characters in call 7.

### 4. Batch 5 ran for over two hours, and it took the server with it

- `avatar_reader:5` started at **15:39:04**. Its model call never ended. The
  run's trace (`/data/traces/344caa7d….log` in the `mra` container) logged
  `AgentRunner.observe type=message_update` about **118 times every 5 seconds**
  from then until at least 16:40:54. A restart of the stack ended it:
  `AnalysisService.recover` marked the run failed at 17:50:47. So it streamed
  for over an hour for certain, and up to about 2 hours 11 minutes.
- **What it was writing is unknown.** `llm-call-log.ts` stores a call when it
  finishes; a cut call leaves no row. Thinking or `submit` arguments, a loop
  or just a huge answer: none of that can be told apart now.
- **Nothing stopped it.** We pass no `maxTokens`, so pi-ai uses the model's
  catalogue limit, **943,718** (`simple-options.js:23`). There is no time
  limit per call either.
- **It froze the whole server.** For every streamed piece of a tool call,
  pi-ai appends it and re-parses the *whole* argument text so far
  (`openai-completions.js:440-441`, `parseStreamingJson`). The longer the
  reply, the costlier each piece. The `mra` process sat at 100% CPU (62 CPU
  minutes by 16:40). `/api/health` timed out, review requests from the page
  hung, and Postgres dropped the app's new connections ("canceling
  authentication due to timeout", 15:48 and 15:53).

Worst case on money for that one call: 943,718 × $0.50 per million ≈ $0.47.
The damage was the frozen server and the two hours, not the bill.

## What to find out first

1. **What a runaway call writes.** Store the partial reply of a call that is
   cut off (aborted, failed, or still open when the run ends), so the next one
   can be read. Without this, any fix for batch 5 is a guess.
2. **What reasoning effort the model actually runs at** when we send nothing,
   and what `low` does to the quality of `assign`. Run one batch both ways in
   a small script against the real model on stored reviews: about a cent a
   call, so ask before running it.
3. **Whether the two schema slips go away** with `parent` defaulted and
   `revise` accepting an object. This can be checked without spending: the
   refusal cases are in `llm_calls` and can be replayed against the schema in
   a unit test.

## Options, none chosen

| Option | What it changes | Against |
|---|---|---|
| Set `thinkingLevel` per agent (`low` for readers) | Likely the largest token cut (cause 1) | Must check `assign` quality doesn't drop |
| Default `parent` to null; let `revise` take one object | Removes the retries seen (cause 2) | None seen |
| Send a short refusal, not the full echoed arguments | Smaller retry input (cause 2) | The message comes from pi-ai's validation; changing it means our own check message, not a patch to the library |
| Make `revise` add or remove list items instead of replacing whole lists | Shorter answers (cause 3) | Changes the memory model and its checks |
| Store partial replies of cut calls | Makes the next runaway readable (cause 4) | None |
| A time limit per call (`timeoutMs`, pi-ai `StreamOptions`) | A stuck call ends; the batch is retried or skipped | A slow but healthy call could be cut |
| An output cap (`maxTokens`) | Bounds a runaway (cause 4) | The user prefers not to, unless shown needed |

## A related bug to fix in the same area

`AnalysisService.recover()` ends a cut run `failed` but leaves the stage that
was running marked **`running`** in `stage_status`. Then, at 17:53, more
competitors were added to the run (`CompetitorLauncher.add`). It ends the run
with `RunEnd.verdict(run.stage_status)`, which found nothing failed, and set
the run **`completed`** while avatars still says `running` and never
finished. Fix: `recover()` should close any `running` stage as failed with
"the server restarted while this stage was running", through the same
progress path the pipeline uses.

## How to look

Local database: `docker exec -it mra-db psql -U $POSTGRES_USER -d $POSTGRES_DB`
(the role is not `postgres`).

```sql
-- the reader calls of this attempt
SELECT agent_id, seq, started_at, duration_ms, stop_reason,
       usage->>'input' AS input_tokens, usage->>'output' AS output_tokens
FROM llm_calls
WHERE run_id = '344caa7d25fe4c108ac0c7f7a936394a'
  AND agent_id LIKE 'avatar_reader:%' AND started_at > '2026-10-21 15:30'
ORDER BY seq;

-- what a refusal said back (the last toolResult in the next call's input)
SELECT seq, input FROM llm_calls
WHERE run_id = '344caa7d25fe4c108ac0c7f7a936394a' AND seq IN (2, 6, 7)
  AND started_at > '2026-10-21 15:30';

-- the run's timeline, without per-agent noise
SELECT created_at, kind, left(payload::text, 160) FROM run_events
WHERE run_id = '344caa7d25fe4c108ac0c7f7a936394a' AND created_at > '2026-10-21 15:30'
  AND kind NOT IN ('agent.started','agent.ended','tool.called','reviews.collected')
ORDER BY created_at;
```

Thinking vs answer characters: each `llm_calls.output` is a message whose
`content` holds `thinking`, `text` and `toolCall` blocks. Measure each
block's length.

Model facts, without spending: `node --input-type=module` in `server/` with
`createModels()` + `openrouterProvider()` and `getModel("openrouter", id)`
prints `reasoning`, `maxTokens`, `compat.thinkingFormat` and
`thinkingLevelMap`.

The trace of a live run: `docker exec mra tail -f /data/traces/<runId>.log`.
A steady stream of `message_update ×N` lines with no other line means a model
is still writing.
