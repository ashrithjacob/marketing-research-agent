# Context, ledger and subagents — spec

A stage-1 run is one conversation that only grows. Every page the agent reads
stays in that conversation until the run ends and is sent again on every call.
The packet is written by the model in one final reply, from memory, and checked
once. **The decision this spec records: findings live in a ledger written as the
run goes; no page enters an agent's context — a reader reads each fetched page
alone and hands back a short digest whose quotes code has checked against the
page; a parent agent hands each entity (a competitor, the category) to a child
agent with a fresh context, at most three at a time; a context that grows too
large is compacted, at set points, into a summary built from the ledger; and every
outside service is called through one queue per service, shared by every agent.**

Status: **phase 1 built 2026-09-29** (§8: ledger, `record_*`, `retract`, `finish`, `PacketAssembly`, the §4.3 retirements, service queues, and the §9 fix), for stage 1 and stage 2 alike, and checked on one real run (§12.1). Phase 2 (the page reader, §12) is next; phases 3 (compaction) and 4 (children) follow. None of them built. §3a is how pi does it, read from its source; §3b is each decision and what it replaced; §8 is the build order; §11 is what phase 1 decided that this spec left open.

---

## 1. What happened — run `8a02bed6`, 2026-09-29, on the VPS

Brief: `https://mullevia.com/products/mullevia-mullein-drops`, nodes
`product_data, competitors, category_data`, model `z-ai/glm-5.3-flash`. The run
ended `invalid` after 38 minutes, with:

```
competitor_reference.runner_up_name: Expected string, received null;
competitor_reference.runner_up_reviews: Expected number, received null
```

Here is the context sent on each call, from `research_llm_calls`
(`input + cacheRead` tokens; `duration` is wall-clock time):

| call | context tokens | output tokens | duration | ended |
|---|---|---|---|---|
| 1 | 6,640 | 249 | 13 s | toolUse |
| 4 | 32,598 | 1,992 | 58 s | toolUse |
| 7 | 105,245 | 1,945 | 52 s | toolUse |
| 10 | 178,593 | 1,410 | 49 s | toolUse |
| 11–14 | 177,636 – 177,911 | 13,264 – 15,251 | 304 – 313 s | **error** |
| 15 | 197,557 | 56,016 | 318 s | stop, packet refused |

What made up the 68 messages sent on call 11 (about 798k characters, rebuilt by
joining each call's `input` field):

| what | share |
|---|---|
| raw `web_fetch` pages (34, up to 25,000 chars each: `MRA_FETCH_CHAR_LIMIT`) | **70.4%** |
| the agent's earlier thinking | 19.1% |
| `web_search` results | 6.0% |
| everything else | 4.5% |

Every one of those pages was already written to the corpus under its `source_id`
(`adapters/corpus.ts`). The copy in the conversation repeats data we already hold.

Calls 11–14 each spent about 90 KB on thinking while assembling the whole packet
in one reply, with no tool call. Each ran on GMICloud and was cut at about 304 s.
OpenRouter's `/generation` record for each shows `finish_reason: error`,
`native_finish_reason: null`, HTTP 200 and $0 billed. Call 15 went to Friendli,
ran 318 s and finished, so neither OpenRouter nor our client stops at 300 s. That
cap is GMICloud's. Across every run in the VPS database, GMICloud has served 19
successful calls (the longest 118 s) and 4 failures, all at 304–312 s. Decart
failed 8 times with `Upstream idle timeout exceeded`, at 123–320 s.

Once the retries ran out, the no-packet nudge ran and switched off every tool,
`validate_packet` included (`agent/run-watch.ts:81`). Call 15 wrote the packet as
plain text. `RunSettlement.settle` parsed it once and marked the run `invalid`
(`agent/run-settlement.ts:73-79`). The agent never saw the error.
`validate_packet` had been called 0 times in the run.

The schema problem itself: `runner_up_name: z.string().default("")`
(`domain/packet.ts:69`). zod's `.default()` applies only when a field is missing
(`undefined`). An explicit `null` is a value of the wrong type.

---

## 2. How a run works now

| Part | Now | Where |
|---|---|---|
| Agent | One pi `Agent` per run, one message list, no `transformContext` | `agent/run-agent-factory.ts` |
| History | `agent.state.messages`, in memory. `research_llm_calls` stores each call's new messages and its reply | `agent/llm-call-log.ts` |
| What each call sees | The whole message list, every time. pi's `streamAssistantResponse` passes `context.messages` through `transformContext` only if one is set, then to `convertToLlm`. We set none | `pi-agent-core/dist/agent-loop.js:262-267`; the `new Agent({...})` in `agent/run-agent-factory.ts` |
| Page text | Returned in full to the model (up to 25,000 chars), and also archived to the corpus | `agent/tools/web-fetch-tool.ts`, `adapters/corpus.ts` |
| Re-reading a page | Not possible. `Corpus` has `write` and no `read` | `adapters/corpus.ts` |
| Findings | Held only in the model's context, in its thinking and tool results inside `agent.state.messages`, until the final reply. No code of ours holds them: the first code to see them parses the packet | `agent/run-settlement.ts` (`settle`), `agent/tools/packet-check-tool.ts` |
| Reviews | Already the exception: filed in `ReviewLedger`, the model sees handles only, and `ReviewAssembly` adds them to the packet | workings §2d |
| Packet | Written by the model as one JSON block. Either a `validate_packet` call passes it, or `RunSettlement` parses it once | `agent/tools/packet-check-tool.ts`, `agent/run-settlement.ts` |
| Repair | Only through `validate_packet`, 5 checks (`PACKET_CHECK_BUDGET`). The final-text path has no repair | `agent/tools/lanes.ts:26` |
| Retry after a dropped call | The same over-long turn is sent again. `ModelChain.failover` moves only to another *model*, and this run's chain had one | `agent/run-watch.ts`, `agent/model-chain.ts` |
| Division of work | None. One agent researches the product, every competitor and the category in one context | `agent/prompt/` |

Three failures follow from this shape, whatever the model:

1. **The context grows with every page read.** Material from company A is still
   sent while the agent works on company B.
2. **The deliverable comes from one long reply.** At about 178k tokens of input,
   writing it takes longer than a provider's time limit.
3. **A packet that fails the check is lost.** Unless it went through
   `validate_packet`, nothing sends the agent the problems to fix.

---

## 3. What we are moving to

```
            ┌──────────────────── run ledger (SQLite, written per record) ────────────────────┐
            │  sources · excerpts · measurements · attributes · competitors · reference · gaps  │
            └──────▲───────────────────────▲──────────────────────────▲─────────────────────────┘
                   │ record_*              │ record_*                 │ record_*
        ┌──────────┴─────────┐   ┌─────────┴──────────┐     ┌─────────┴──────────┐
        │  parent            │   │ child (competitor)  │ ... │ child (category)    │
        │  full stage-1      │──►│ c3 "HERBIFY"        │     │                     │
        │  prompt; product;  │   │ code-built prompt   │     │ code-built prompt   │
        │  spawns, finishes  │◄──│ + parent's note     │     │ + parent's note     │
        └──────────┬─────────┘   └──────────┬──────────┘     └──────────┬──────────┘
                   │ finish                 └───── one line: complete | missing … ─────┘
                   ▼
        PacketAssembly(ledger) → PacketValidator → completed | problems back to the parent

        every web_fetch / web_search / Apify call, from any agent → the queue for that service
```

| Part | Now | Moving to |
|---|---|---|
| Findings | In the model's context | **Run ledger**: one row per finding, written by a `record_*` tool, checked when written |
| Packet | The model writes it | **Code assembles it** from the ledger, the way `ReviewAssembly` already does for reviews |
| Repair | `validate_packet`, or nothing | A bad record fails at `record_*`, on a small turn. Cross-field problems come back from `finish`. No final-text path |
| Division of work | One agent | **Parent + children**. Each child gets a fresh context for one entity. At most 3 run at once, and the rest wait |
| Child prompt | — | **Built by code** from the existing rule blocks, plus a short note and a list of needed fields written by the parent |
| "Is the child done?" | — | **Code** checks the parent's needed fields against the ledger. The parent gets one line per child and decides on follow-ups |
| What each call sees | Everything | Everything **until a token budget is passed**. Then one compaction: a summary rendered from the ledger plus the recent tail. Only appended to until the next compaction |
| Page text | Stays in context for good | **Never enters an agent's context.** A reader reads each page alone and returns a digest of what was asked for, with quotes code has checked against the page (§12). `read_source(source_id, …)` re-reads an archived page with a new question |
| History | In memory, plus call deltas | Full history kept (message list, **per-agent JSONL** transcript, call log). Compaction changes what is sent, not what is stored |
| Outside services | Called directly. Firecrawl gets 3 fetches at once against a limit of 2 | **One queue per service** for the whole process, sized to that service's limit |

---

## 3a. How pi handles this, read from the source

Read from the pi repo checked out at `../pi` (`packages/agent` 0.85.0) and from
the `@earendil-works/pi-agent-core` we run (0.87.1). The checkout is older than
what we run, so the line numbers below point into 0.85.0.

### 3a.1 The plain `Agent`: the hooks we build on

`Agent` (`pi-agent-core/dist/agent.d.ts`) takes these options:

- **`transformContext(messages, signal)`** runs before every call and returns the
  list to send. Its documented uses are "context window management (pruning old
  messages)" and "injecting context from external sources". It must not throw.
- **`convertToLlm(messages)`** turns our own message types into provider
  messages, and drops what the model should not see.
- **`CustomAgentMessages`** is an interface we can extend with our own message
  types (for example, a compaction summary) that live in the message list.
- `beforeToolCall` / `afterToolCall`, `getApiKey`, and `agent.steer(...)`, which
  we already use for live judgements.

We use none of the first three today (`agent/run-agent-factory.ts`).

### 3a.2 Subagents: the reference extension

`packages/coding-agent/examples/extensions/subagent/` is pi's worked example.

- **Definitions.** A child type is a markdown file with frontmatter: `name`,
  `description`, `tools`, `model`. The body is the child's system prompt.
  Examples: `scout` (Haiku, read-only tools, returns a compressed handoff),
  `planner`, `reviewer`, `worker`. When `model` is omitted, the child uses the
  parent's model. Definitions load from `~/.pi/agent/agents`, and from the
  project's `.pi/agents` only with `agentScope: "project" | "both"` plus a
  confirmation, because a repo-controlled prompt can instruct the model to run
  commands.
- **What the parent writes.** Only the task. The child is launched as
  `pi --model … --tools … --append-system-prompt <definition body> "Task: <task>"`
  (`index.ts:303-341`). The rules and tools come from the definition, never from
  the parent.
- **Modes.** Single `{agent, task}`. Parallel `{tasks: [...]}`: at most 8 tasks,
  4 at once (`MAX_PARALLEL_TASKS`, `MAX_CONCURRENCY`, `index.ts:33-34`), run
  through `mapWithConcurrencyLimit`. Chain `{chain: [...]}`, where each step's
  task can include `{previous}`, the prior step's output.
- **What comes back.** The child's final text, capped at 50 KB per task, plus
  usage (turns, tokens, cost). A child ending with `stopReason: "error"` returns
  the error. A chain stops at the first failing step.
- **Process model.** Each child is a separate `pi` process (`spawn`,
  `index.ts:346`), started with `--mode json -p --no-session` (`:300`). So pi
  keeps no transcript for a child, and only its final text survives. Abort kills
  it. We differ here: each of our children gets its own JSONL transcript (§5.5).

### 3a.3 Compaction: the coding agent

`packages/coding-agent/src/core/agent-session.ts`, on the plain `Agent`:

- After each assistant message, `_checkCompaction` (`:2132`) estimates the
  context. It compacts when `shouldCompact` is true, meaning
  `contextTokens > contextWindow − reserveTokens`
  (`agent/src/harness/compaction/compaction.ts:246`), or when the provider
  reported a context overflow. In the overflow case it removes the failed
  response first (`:2199`).
- `prepareCompaction` picks what to summarise. `findCutPoint` keeps about
  `keepRecentTokens` of recent history and handles a cut that falls inside a
  turn.
- The `session_before_compact` extension hook (`:1974-1993`) can cancel the
  compaction or **supply the summary itself**. Otherwise `generateSummary` asks
  the model for a structured summary (`SUMMARIZATION_SYSTEM_PROMPT`).
- The result replaces `agent.state.messages` in one step (`:2034`, `:2359`).
- Defaults (`DEFAULT_COMPACTION_SETTINGS`): `enabled: true`,
  `reserveTokens: 16384`, `keepRecentTokens: 20000`.

### 3a.4 Context: the harness rules

`packages/agent/docs/harness.md` §2.5 defines how a request's context is built
from a session:

1. Read the branch from its tip back to the newest compaction, and nothing
   earlier.
2. The context is the compaction's `summary`, then its `retainedTail`, then
   every entry after it.
3. Drop assistant responses whose stop reason is `error`, `aborted` or
   `deferred`.
4. Pass custom entries through `entryProjectors`. A custom entry with no
   projector never reaches the model.
5. Run `transform_context`, then convert to provider messages.

Then the rule this spec is designed around (`harness.md:518`): **provider context
must only grow at the tail.** An insertion before the previous request's tail
invalidates the provider's cache. Compaction is the one deliberate exception.

### 3a.5 Sessions, forks and lanes

- **Session.** A JSONL file (`JsonlSessionRepo`, `harness/session/jsonl`) of
  entries, each with `id`, `parentId`, `seq`, `timestamp`, and a `type` of
  `message | compaction | branch_summary | custom`. Entries are never deleted:
  "compaction changes provider context, not storage". It needs pi's
  `ExecutionEnv` and `Context`, which we do not use.
- **Fork** (`createForkSnapshot`) copies history into a new session. Scope
  `branch` copies one path; scope `tree` copies everything. The new session
  carries on with everything the source knew.
- **Lanes.** `AgentHarness` manages several `AgentLane`s over one `Session`. A
  lane is a branch plus its own configuration (`model`, `thinkingLevel`,
  `activeToolNames`). Lanes share the session's stored values. This is pi's
  in-process way to run several agents over shared data. Its status
  (`harness.md` §0.9): "Storage format 4 is still WIP… shapes may change in place
  without migrations". Forks of named branches (WP08) are still in progress, and
  `watchSession` throws `SliceNotImplemented`. In the coding agent, the harness
  is used only under `src/experimental/`. The shipped agent uses `new Agent(`
  (`core/sdk.ts:306`).

### 3a.6 Skills

A skill is a `SKILL.md` with a name and description, then instructions.
`loadSkills(env, dirs)` reads them, `formatSkillsForSystemPrompt` lists names and
descriptions only, and `formatSkillInvocation(skill, extra)` turns one skill into
a prompt. A skill is text only: it cannot grant or restrict tools, or check
output.

---

## 3b. The decisions, and what each one replaced

Each decision below was argued from the code and measurements above, not from
preference.

| # | Decision | Rejected alternative | Why |
|---|---|---|---|
| 1 | **Copy pi's split:** code fixes a child's prompt and tools, and the parent supplies the task | The parent writes the whole child prompt | This is pi's own pattern (§3a.2). It also answers the next two rows |
| 2 | **The parent does not write the rules.** Code builds the child's prompt from the existing rule blocks. The parent adds a short note per entity and a list of needed fields | The parent writes each child's instructions, rules included | Retyping costs parent output, and parent output is the slow step: about 176 tokens/s on call 15, so about 140 s for ten children. Each rewrite also risks drift from the schema, and drift caused this run (§9) |
| 3 | **Code decides whether a child is done**, by comparing the parent's needed fields with the ledger. The parent gets one line and decides the follow-up | The parent reads the child's rows and judges | Rows sent to the parent grow its context again. A field check is exact and free, and a model doing the same check can get it wrong: this model wrote `null` into a required field |
| 4 | **Compact at set points, with a summary rendered from the ledger.** Our own token budget triggers it, and a tail of recent tokens is kept. In between, only append | (a) A digest rebuilt at the top of every call, keeping the last K turns (the first draft of §5). (b) pi's model-written summary. (c) pi's default trigger | (a) breaks pi's append-only rule and loses the cache on every call. (b) is prose and loses exact numbers and `source_id`s. (c) fires at about 1.03M tokens for this model, and this run peaked at 197,557. K turns fails because one turn added 31,616 tokens |
| 5 | **Children are plain `Agent`s in the same process** | (a) Separate `pi` processes, as in pi's example. (b) Harness lanes | (a) We have no pi CLI, and `Trace` follows the run through `AsyncLocalStorage`, which only works in the same process. (b) Lanes fit best on paper, but their storage format is WIP and pi's shipped agent does not use them. Revisit when §0.9 of `harness.md` says stable |
| 6 | **At most 3 children at once**, the rest queued | pi's 4, or no limit | Your call, to limit load. It bounds model spend and how many follow-ups the parent handles at once |
| 7 | **One queue per outside service**, shared by every agent and run | Relying on the child cap alone | Firecrawl allows 2 fetches at once, and one agent with no children already sent 3 (§7). The child cap limits agents, not fetches |
| 8 | **Children, not forks** | Fork the parent per entity | A fork carries everything the parent knew, company A's pages included, into company B's session (§3a.5) |
| 9 | **Superseded: subagents specialised by `SKILL.md`** (an earlier proposal in this session) | — | A skill is text only (§3a.6): it cannot limit tools or check output. Replaced by child kinds in code (§6.5) plus the parent's note (§6.3) |
| 10 | **Superseded: a repair loop in `RunSettlement`** that sends a failed final packet back to the agent (proposed first, before this spec) | — | It fixed the symptom. With the ledger (§4) there is no final packet written by the model to repair: each record is checked when it is written |
| 11 | **A reader per page, and only its digest in context** (§12) | Keep pages in context and rely on compaction and children to shed them | Pages were 56.0% of the context on run `99002ee8`, and one turn of 18 fetches added about 88k tokens: more than any compaction budget, because pi never cuts between a tool call and its result. Shedding pages later still pays for them on every call until then |

---

## 4. The ledger

### 4.1 Shape

A port, `FindingLedger`, in `domain/ports.ts`, with a SQLite adapter. It is
written per record rather than at the end, so a process restart keeps what was
found. `ReviewLedger` does not do that today (workings §2d, point 5).

```
research_findings
  run_id, seq, id, kind, entity, agent_id, source_id, payload (json), created_at, retracted_at
```

- `kind` is one of `source | excerpt | measurement | attribute | competitor |
  competitor_reference | saturation | node_status | gap`, one per section of
  `stagePacketSchema` (`domain/packet.ts:97`), plus `candidate`: a brand that
  discovery found (id, name, URL) and that a competitor child has not yet
  researched. `candidate` rows steer the run (§6.4). They are not packet sections,
  and `PacketAssembly` does not copy them into the packet.
- `entity` is who the finding is about: `product`, `category`, or a competitor
  id such as `c3`. The compaction summary (§5) and the child status line (§6) are built by
  entity.
- `payload` is checked at write time against that section's existing schema
  (`sourceSchema`, `excerptSchema`, `competitorSchema`, …). No new schema is
  written.

### 4.2 Tools

| Tool | Does | On a bad payload |
|---|---|---|
| `record_source`, `record_excerpt`, `record_measurement`, `record_attribute`, `record_competitor`, `record_reference`, `record_saturation`, `record_node_status`, `record_gap`, and `record_candidate` (discovery only, §6.5) | Append one row and return its id. Which agent may call which is fixed per kind (§6.5) | Tool result `NOT RECORDED — runner_up_name: Expected string, received null`. The agent fixes that one item |
| `retract(id, why)` | Marks a row retracted. Rows are never deleted | — |
| `finish` | `PacketAssembly` builds the packet from the ledger (plus `ReviewLedger`), then `PacketValidator.validate` runs the cross-field rules (`extract/champion-check.ts` and others) | Returns the numbered problems. The run carries on. At most 5 checks per run (`FINISH_BUDGET`). On the sixth call nothing is checked: the tool answers that the budget is spent and returns `terminate: true`, and settlement runs the check from the ledger. The run is `completed` if it passes, otherwise `invalid` |

Each `record_*` tool takes its item the way `validate_packet` takes a packet
today: one `Type.Unknown` argument (`agent/tools/parameters.ts`,
`packetParameters`), checked by the section's zod schema when the tool runs. The
zod schema is the only definition of the shape, so there is no second copy to
drift. Turning the zod schemas into tool parameter schemas is possible later. We
have zod 3.25.76 and no converter installed.

### 4.3 What this retires

- The model writing a packet at all: `agent/prompt/text/example.ts` (the
  full-packet example) and `output.ts` (the "end your reply with one fenced JSON
  block" instructions). Both are replaced by one short example per `record_*` tool.
- `validate_packet`. `finish` replaces it. `PACKET_CHECK_BUDGET` is replaced by
  `FINISH_BUDGET = 5` on `finish` (§11).
- `AgentMessages.packetNudge` and the final-text parse in `RunSettlement.settle`.
  A run that ends without calling `finish` is settled from its ledger: `finish`
  is run on the agent's behalf, and the run is `invalid` only if that fails.
- `RunWatch.lacksPacket`.

`invalid` keeps its meaning: the agent finished, and what it produced failed the
contract. It now means the ledger failed the cross-field rules, and the problems
are stored in `error` as today.

---

## 5. Compaction: what each call sees

### 5.1 The rule it has to keep

`pi/packages/agent/docs/harness.md:518`: "provider context must only grow at the
tail: an insertion before the previous request's tail invalidates the provider's
KV cache and multiplies cost… Compaction is the one deliberate cache
invalidation." On run `8a02bed6`, 631,424 of 1,852,887 tokens were read from
cache, at $0.03 per million instead of $0.15 per million for normal input
(`research_runs.usage.pricing.rates`).

**A superseded design, recorded:** the first draft of this spec rebuilt a ledger
digest near the start of every call and kept the last K turns. That puts an
insertion ahead of the tail on every call, so the cache would be lost on every
call. It is replaced by the design below.

### 5.2 How it works

A `ContextCompactor` (in `agent`) is the `transformContext` hook on each agent.
It holds one piece of state: the current compaction, if any, which is the index
the history was cut at plus the summary text. On every call:

1. Estimate the tokens of what would be sent, with pi's `estimateContextTokens`.
2. **Under the budget:** send the start of the context (system prompt and first
   user message), then the current summary if there is one, then every message
   after the cut. This only grows at the end from one call to the next, so the
   cache holds.
3. **Over the budget:** compact once. pi's `findCutPoint(entries, …,
   keepRecentTokens)` picks a new cut that keeps about `keepRecentTokens` of
   recent history and never separates a tool call from its result. The summary
   is **rendered by code from the ledger at that moment**: entities and their
   status, what is recorded (ids and `source_id`s, no page text), open gaps, and
   the children's result lines. Then step 2 applies. Only this call pays for a
   cold cache.

The stored message list is never changed. pi's coding agent compacts the same
way: a one-off event, with the summary allowed to come from a hook instead of a
model call (`coding-agent/src/core/agent-session.ts:1974-1993`,
`session_before_compact`). There, the result replaces `agent.state.messages`
(`:2034`). We do it inside `transformContext` instead, because our run is one
long `agent.prompt()` and the cut has to be able to happen between turns inside
it.

**Why not pi's model-written summary (`generateSummary`):** it is prose. The
packet needs exact numbers and `source_id`s, and those already sit in the
ledger. A summary rendered from the ledger loses nothing and needs no model call.

### 5.3 The numbers

- **Trigger: our own budget, not the model's window.** pi compacts at the window
  minus `reserveTokens` (16,384, `DEFAULT_COMPACTION_SETTINGS`). pi-ai lists
  `glm-5.3-flash` with a 1,048,576-token window, so that would fire at about
  1.03M tokens. This run peaked at 197,557 tokens, so the default would never
  have fired. The problems here were cost and the length of each call, not the
  window. Proposed `MRA_CONTEXT_BUDGET_TOKENS` = 60,000.
- **The recent tail is counted in tokens, not turns.** One turn on this run
  added 31,616 tokens (call 4 at 32,598, call 5 at 64,214), so "the last 3 turns"
  could be about 90k tokens. Proposed `MRA_CONTEXT_KEEP_RECENT_TOKENS` = 20,000,
  pi's default.
- Both are starting values, set before the reader (§12) took pages out of the
  context. Phase 3 re-measures them on a run that has the reader.

### 5.4 Who compacts

- **Parent:** yes. Its context holds the champion step, review mining, its spawn
  calls and one line per child, so with children it grows slowly. The budget is the
  backstop.
- **Children:** a child has the same compactor, but is expected never to reach
  the budget. It gets a turn budget (`MRA_CHILD_MAX_TURNS`, proposed 12). A child
  that runs out ends. What it recorded stays in the ledger, and code reports what
  is still missing.

### 5.5 Pages and the transcript

- **Superseded 2026-09-29:** `read_source(source_id)` returning the archived page,
  capped at `MRA_FETCH_CHAR_LIMIT`. That would put a page back into the context
  the reader (§12) keeps pages out of. `read_source` now re-reads the archived page
  through the reader with a new question. It still needs `Corpus.read`, and moves
  to phase 2.
- Everything each agent saw and said is appended to
  `runs/<runId>/sessions/<agentId>.jsonl` under the corpus. It is never sent in
  full. The entry format follows pi's (`id`, `parentId`, `seq`,
  `type: message | compaction | custom`), and compactions are written into it as
  entries too. `research_llm_calls` gets an `agent_id` column.

---

## 6. Parent and children

### 6.1 Fork vs child

A **fork** copies history into a new session that carries on with everything the
parent knew (`harness/session/fork.d.ts`, `createForkSnapshot`). A **child**
starts empty and gets only its task, and only its result goes back. A fork would
carry company A's pages into company B's session. We use children.

### 6.2 What pi does, and where we differ

pi's reference subagent (`pi/packages/coding-agent/examples/extensions/subagent/`)
gives each child type a definition file whose frontmatter fixes its `tools` and
`model`, and whose body is its system prompt. The parent writes only the task
(`Task: ${task}`, `index.ts:341`). It allows 8 tasks per call and 4 at once
(`:33-34`), and each child's final text comes back to the parent, capped at 50 KB.
Children are separate `pi` processes (`:346`).

We keep the split: code fixes the prompt and tools, the parent supplies the task.
We differ in two places:

- **In-process, plain `Agent`.** We have no pi CLI. Our `Trace` finds its run
  through `AsyncLocalStorage`, which a child inherits only if it is in the same
  process. pi's shipped coding agent is built on the plain `Agent` too
  (`coding-agent/src/core/sdk.ts:306`). Harness lanes, pi's in-process
  multi-agent layer, are not used yet: `harness.md` §0.9 says "Storage format 4
  is still WIP… shapes may change in place without migrations", and in pi's
  coding agent the harness appears only under `src/experimental/`.
- **What comes back is not the child's text.** The ledger rows are the result.
  The parent gets one status line per child from code (§6.4).

### 6.3 The child's prompt

The parent does **not** write the child's rules. A competitor child needs the
rules we already have as text: quote excerpts character for character, use
`source_id` exactly as returned, pick `kind` from the list, treat the run's
rejected kinds as rejected, copy `market` exactly as the brief names it, apply
the direct/indirect test (`agent/prompt/text/rules.ts`, `node-rules.ts`).
Retyping them per child costs parent output. Call 15 produced 56,016 tokens in
317.9 s, about 176 a second, so ten children at about 2.5k tokens of rules each
is roughly 140 s. It also risks drift from the schema, and drift is what caused
run `8a02bed6` (§9).

So a child's prompt is put together by code (`ChildPrompt`, in `agent/prompt`):

| Part | From |
|---|---|
| Base: how to use the tools and the ledger, when to stop | code, per child kind |
| Rules for the node | the existing blocks in `agent/prompt/text/` |
| Brief, markets, rejected kinds, standing judgements | the run |
| **The task** | the parent: a note about this entity (up to ~500 chars), e.g. "sells on its own site and Amazon; the 4 oz is the comparable size" |
| **Done when** | the parent: the needed fields, e.g. `["price", "pack_size", "servings", "actives"]` |

A live steer (`RunSupervisor.steer`, `agent/run-supervisor.ts:93`) goes to the
parent and to every running child.

### 6.4 The order of a run

The champion is the only thing the other nodes wait for. Each competitor row is
checked against it: `relation` against its form
(`extract/competitor-check.ts:39`) and `shared_actives` against its actives
(`:72`). Product data is the brief's product filled out against its own
checklist, and nothing checks it against another node. Category data needs only
the ingredient or genre. So once the champion is recorded, product, category and
competitors can run side by side.

```
TIME ──────────────────────────────────────────────────────────────────────────►

PARENT   [1 champion]──►[2 spawn ×3]──►[5 review_mining (Apify)]──►[6 read status lines, follow-ups]──►[7 finish]
                          │   │   │                                      ▲
SLOT 1                    │   │   └─►[product child]─────────────────────┤
SLOT 2                    │   └─────►[category child]────►[competitor c2]┤
SLOT 3                    └─────────►[discovery]──►[competitor c1]──►[c3]┤
                                           │                             │
                                           └─ 3 records candidates c1…cN, 4 parent spawns one child per candidate
                                                                         │
LEDGER  ◄────────── every child and the parent write rows here ──────────┘
```

1. **Champion (parent, alone, first).** With a URL brief the parent fetches that
   page. With a genre brief it runs `amazon_find_product` (Apify) and picks the
   listing with the most reviews. Either way it writes one row,
   `competitor_reference`: name, form and actives, with a `source_id`.
2. **Spawn three (parent).** `spawn` returns immediately. The first three
   children fill the three slots:
   - `product`: the brief's product checklist (dose, price, format,
     certificates, …).
   - `category`: search volume over at least three years, category size,
     seasonality.
   - `discovery`: every brand selling the same active, in every form.
3. **Discovery records candidates, and nothing more.** One `candidate` row per
   brand (id, name, URL), plus the two saturation curves the competitors node
   requires, one for direct and one for indirect, where each point is a source
   that surfaced brands. It does not research the brands. It ends, and its slot
   frees up.
4. **One child per competitor (parent).** For each candidate the parent calls
   `spawn("competitor", "c1", note, needs)`, for example
   `note: "sells on own site and Amazon; 4 oz is comparable"`,
   `needs: ["price", "pack_size", "servings", "actives"]`. They wait in the queue
   and each takes a slot as one frees. A competitor child fetches only its own
   company's pages, writes rows only under its own id, and its
   `record_competitor` is checked against the champion row at once.
5. **Review mining (parent itself).** All of it is Apify, and children never get
   Apify tools, so the parent runs it while the children work.
6. **Status lines and follow-ups.** When a child ends, **code** compares its
   `needs` with the ledger and adds one line at the end of the parent's context:
   `c2 complete`, or `c3 incomplete — missing price; child: "price behind a quiz"`.
   The parent never sees a child's pages. For an incomplete one, it accepts the
   gap or spawns a follow-up child for that company with a narrower note.
7. **Finish (parent).** When every entity is complete or has an accepted gap,
   the parent records each node's status and calls `finish` (§4.2). Code builds
   the packet from the ledger and runs the cross-field checks. Problems go back
   to the parent as a numbered list, and the run carries on.

At most **3 children run at once** (`MRA_MAX_CHILDREN`). Product, category,
discovery and every competitor share those three slots, first come first served.
Underneath every agent sit the service queues (§7): even with three children and
the parent busy, at most 2 page fetches are in flight.

### 6.5 Child kinds

`SubagentKind` (in `agent`) fixes each kind's tools, the record kinds it may
write and its turn budget. A child never gets `spawn`, so children cannot spawn
children, and never gets an Apify tool, so spending on Apify stays with the
parent.

| Kind | Started | Tools, besides `web_search`, `web_fetch`, `read_source` | Records, under |
|---|---|---|---|
| `product` | step 2 | `record_source`, `record_excerpt`, `record_measurement`, `record_attribute`, `record_gap` | entity `product` |
| `category` | step 2 | `record_source`, `record_excerpt`, `record_measurement`, `record_gap` | entity `category` |
| `discovery` | step 2 | `record_candidate`, `record_source`, `record_saturation`, `record_gap` | entity `discovery` |
| `competitor` | step 4, one per candidate | `record_competitor`, `record_source`, `record_excerpt`, `record_measurement`, `record_attribute`, `record_gap` | its own id (`c1`, `c2`, …) only |

**Changed from the previous draft:** product data was kept with the parent.
It is now a child. Competitor children read what they need from the champion row
in the ledger, not from the parent's context, so nothing requires product data
to stay in the parent, and moving it keeps the parent's context small.

---

## 7. Service queues

Every outside call goes through one queue per service. Each queue is one object
per **process**, built in `main.ts` and passed through constructors, because
these limits are per account: two live runs share them. It wraps the adapter
behind the same port (`ThrottledPageFetcher implements PageFetcher`, and so on),
so the tools do not change. The existing `Http.pool` (`adapters/http.ts:17`)
only limits one batch inside one tool call. It stays for that.

Limits measured 2026-09-29, from the VPS, with the app's own keys:

| Service | Used by | Limit | Queue |
|---|---|---|---|
| Firecrawl | `web_fetch` | `maxConcurrency: 2` (`GET /v2/concurrency-check`). One agent already started 3 fetches within 2 ms (trace, 14:12:58.443–.445) | **2** (`MRA_FIRECRAWL_CONCURRENCY`) |
| Apify | `amazon_find_product`, `amazon_reviews`, `trustpilot_reviews` (Trustpilot runs as an Apify actor, `adapters/apify/trustpilot-reviews.ts`), `mine_reviews` | `maxConcurrentActorJobs: 32`, `maxActorMemoryGbytes: 64` (`GET /v2/users/me/limits`) | **16**, the existing `MRA_APIFY_CONCURRENCY`, now shared across tools, agents and runs |
| SearXNG | `web_search` | Our own container. The search engines behind it limit by IP. Not measured | **2** (`MRA_SEARCH_CONCURRENCY`) |
| OpenRouter | model calls, `/generation` cost lookups, the fetch gate (off on the VPS: `MRA_GATE_MODEL` is empty) | `GET /api/v1/key` reports no request limit (`requests: -1`, a field marked deprecated) | none. The 3-child cap bounds it |

A call waiting in a queue emits a trace line with how long it waited, so the
phase 4 run measures what the queue costs.

---

## 8. Build order

Each phase is checked with `mra run "<url>" product_data`, which uses no Apify
tools. Phase 4 needs the `competitors` node, whose `amazon_find_product` uses
Apify, so its test run is agreed with you and priced first.

1. **Ledger and queues.** `FindingLedger` port + SQLite adapter + migration, the
   `record_*` tools, `retract`, `finish`, `PacketAssembly`, the retirements in
   §4.3, and the service queues (§7). Regression tests with scripted fake model
   replies: a `record_reference` with `runner_up_name: null` returns
   `NOT RECORDED`, the corrected call records it, and the run ends `completed`.
   Three fetches issued at once reach the fake Firecrawl at most two at a time.
   Five failing `finish` calls, then a sixth that is refused unchecked and ends
   the loop, and the run settles `invalid` with the ledger's problems.
2. **The page reader** (§12). `PageReader`, `web_fetch` returning a digest,
   `Corpus.read`, `read_source`, the quote check, the relevance gate folded in,
   `MRA_READER_MODEL`, `agent_id` on the call log. Tests with a scripted reader:
   a quote found in the page comes back with its exact character range; a quote
   not in the page is dropped and the digest says so; after a batch of fetches no
   tool result the agent sees holds page text (none longer than the digest cap);
   `read_source` re-reads an archived page with a new question; a reader that
   fails returns an error that still carries the `source_id`, and the page stays
   archived. Checked with `mra run "<url>" product_data`.
3. **Compaction.** `ContextCompactor`, the JSONL transcript. Tests: on a scripted
   run past the budget, compaction happens once. The messages sent before and
   after it only grow at the end, except at that one call. The summary holds every
   ledger id.
4. **Parent and children.** `spawn`, `SubagentKind`, `ChildPrompt`, the child
   queue of 3, the completion check, steers reaching children, and the cockpit
   showing agents. Tests: a scripted parent records the champion, spawns
   product, category and discovery, then one competitor per candidate, and at
   most three run at once. Neither child's context holds the other's pages. A child
   missing a needed field produces an `incomplete` line naming it.

Measured on the one real run per phase, against §1: the largest context sent,
the longest single call, the cache-read share, time spent waiting in queues, and
the end status.

---

## 9. Found while writing this: the prompt and the schema disagree

`agent/prompt/text/node-rules.ts:31-33` tells the agent: "When the brief carries
a url, the champion is that site's product and no ranking is needed."
`domain/packet.ts:69-70` still requires `runner_up_name` as a string and
`runner_up_reviews` as a number. Run `8a02bed6` had a URL brief. The agent
followed the prompt and wrote `null` for both, and the packet was refused. This
is a bug in today's code, whatever happens to the rest of this spec. The fix is
to make the schema say what the prompt says: with a URL brief the runner-up
fields are optional, and `null` means "no ranking".

---

## 10. Open questions

- **The budgets.** `MRA_CONTEXT_BUDGET_TOKENS` 60k, `KEEP_RECENT` 20k and
  `MRA_CHILD_MAX_TURNS` 12 are starting values.
- **The reader's model and digest size.** `MRA_READER_MODEL` and
  `MRA_READER_DIGEST_CHARS` (proposed 2,000) are chosen on the phase 2 run: the
  measure is how often the agent has to `read_source` a page again because the
  first digest missed what it needed.
- **The child's model.** Same as the parent's, or something cheaper for
  fetch-and-record work.
- **Provider choice.** OpenRouter's `provider.ignore` could exclude GMICloud and
  Decart. Shorter calls should keep us under their ~300 s cut-off, so this waits
  for the phase 2 measurement.
- **Whether the Firecrawl 403 and 502 on this run** (trace lines 1410, 2241) came
  from going over the limit. Not checked.

---

## 11. Decided while building phase 1

- **Superseded 2026-09-29 by `spec-stage-2-pipeline.md`: stage 2 uses the ledger
  too.** §4.3 retired `validate_packet` and the model-written packet; a
  review-mining run wrote one the same way, so it was moved to record and finish
  like stage 1. Run `f1b67523` then showed stage 2 needs no model: its mining took
  3 min 52 s and its last model call reasoned for 37 min without output. Stage 2
  becomes a code pipeline; the ledger path stays for stage 1.
- **§9 fix as proposed:** `runner_up_name` and `runner_up_reviews` are
  `.nullable().default(null)`. `ChampionCheck` still demands a runner-up on a
  genre brief and treats `null` as missing.
- **Row ids are the code's.** `src3`, `ex14`, `ref7`: kind prefix plus the run's
  sequence number. The packet ids of excerpts, measurements and attributes are the
  row ids; a model-sent `id` on those is ignored.
- **One key, one live row.** A source (by id), a competitor (by id), the
  reference, a node status (by node) and a saturation curve (by node and class)
  are replaced by a newer row with the same key; the older row is retracted with
  `replaced by <id>`. So a curve is recorded whole each time it grows.
- **Write-time checks are per row only:** the section's zod schema, and the node
  being in the run's scope. Everything that needs two rows (citations, relation
  against the champion, saturation per complete node) stays in `finish`, as §4.2
  says.
- **No `record_brief`.** The packet's `brief` is the run's. On a site brief the
  product name is the `product_data` attribute with key `name` (already on the
  checklist), else the champion's name.
- **`finish` ends the loop with pi's own `terminate: true`,** and declares
  `executionMode: "sequential"` so a `finish` sent in the same turn as records
  runs after them (pi runs a batch in parallel otherwise).
- **Settling without `finish`:** Stop → `cancelled`. Error and an empty ledger →
  `failed`. Otherwise `finish` runs on the agent's behalf: pass → `completed`
  (`packet_source = "ledger"`, plus `run.ended_early` if it had errored); fail →
  `invalid`, or `failed` if it had errored.
- **`finish` keeps a budget of 5** (reversing §4.3's removal of
  `PACKET_CHECK_BUDGET`). The old budget existed because each `validate_packet`
  call resent the whole packet as output. `finish` takes no argument, so that
  per-call cost is gone, but each failed `finish` is followed by a turn that
  resends the whole context as input. An agent that can't fix a cross-row
  problem, such as a source it can't reach, would otherwise loop until it stops
  of its own accord. The cap bounds that cost without changing the outcome: a
  ledger that still fails is `invalid`, either way. A failed `finish` reply says
  "Checks used: N of 5". A call that is refused because the budget is spent does
  not count.
- **`PacketError` carries its problem list.** Splitting the joined message on
  `"; "` had split the one problem whose own text contains `"; "` (the empty gap
  list) into two; `validate_packet` had the same bug.
- **`record_candidate` is not offered** in phase 1: it belongs to the discovery
  child (§6.5). The kind and its schema exist.
- `agent_id` is `"parent"` on every row until phase 4.

---

## 12. The page reader — phase 2

### 12.1 What phase 1's run showed

Run `99002ee8`, 2026-09-29, local, the same brief as run `8a02bed6` (§1), all
three stage-1 nodes, `z-ai/glm-5.3-flash`: **`completed` on its first `finish`,
in 10 min 39 s; 20 calls; the longest call 139 s; 2.64M tokens; $0.182 billed.**
Its context peaked at 281,252 tokens on call 20, larger than `8a02bed6`'s
197,557. The ledger took the packet out of the final reply; it did not take pages
out of the context.

What the last call re-sent, by source (summed from the stored `input` of the
run's 20 calls):

| What | chars | share |
|---|---|---|
| `web_fetch` page text (39 pages, median 15,218 chars, largest 27,611) | 614,855 | **56.0%** |
| the agent's earlier thinking | 237,290 | 21.6% |
| the agent's own tool-call arguments, mostly records | 103,997 | 9.5% |
| `web_search` results | 76,103 | 6.9% |
| everything else | 66,633 | 6.0% |

Call 9 fetched 18 pages in one turn; call 10's context was 88k tokens larger
than call 9's. pi's `findCutPoint` never cuts between a tool call and its result
(§3a.3), so no compaction could get that turn under a 60k budget.

### 12.2 The decision

**No page enters an agent's context.** `web_fetch` fetches and archives the whole
page exactly as today, then a **reader** — one model call on that page alone,
with no history — extracts what was asked for. The agent gets only the digest.
It is a lossy compression of each page; the loss is recoverable, because the page
is archived and `read_source` can read it again with a different question.

Decided with you, 2026-09-29:

| # | Decision | Rejected |
|---|---|---|
| a | **What to extract comes from the agent's question plus the node's rules.** `web_fetch(url, node, looking_for)`; the reader gets `looking_for` and the rule block for `node` (`agent/prompt/text/node-rules.ts`) | A fixed per-node checklist, which cannot follow what the agent is chasing (a competitor's link list, a price behind a size selector) |
| b | **The reader returns a digest; the agent records.** The ledger keeps one author | The reader proposing ready-made rows, which moves recording decisions into a call that sees one page and none of the run |
| c | **A cheap model, its own setting** (`MRA_READER_MODEL`) | The run's own model on every page |
| d | **The reader is phase 2**, before compaction | Compaction first: the reader removes the largest share and changes every number compaction is sized by |

### 12.3 How it works

1. `web_fetch(url, node, looking_for)` goes through the Firecrawl queue (§7) and
   archives the body under its sha256, unchanged.
2. `PageReader` (in `agent`, since it calls pi-ai) sends the page — up to
   `MRA_FETCH_CHAR_LIMIT`, as today — with `looking_for`, the node's rules, the
   brief's product and markets, to `MRA_READER_MODEL`. It asks for one JSON
   object:
   - `page`: one line on what the page is;
   - `admit` and `reason`: whether the page is on the subject at all. **This
     replaces the relevance gate** (`adapters/fetch-gate.ts`, `MRA_GATE_MODEL`),
     which already reads every page first; a refused page comes back `FILTERED`
     as today, and is not archived;
   - `facts`: each `{what, value, quote}`;
   - `links`: `{url, why}` worth following — for discovery, the brands a page
     lists;
   - `missing`: what was asked for and is not on the page.
3. **Code checks every quote against the archived page.** A quote found
   character for character gets its `char_range` locator. A quote that is not
   found is dropped, and the digest counts it (`2 quotes dropped: not found word
   for word`). This makes the verbatim rule stronger than today, when no code
   checks that an excerpt appears on its page.
4. The agent gets the header it gets today (`source_id`, url, title,
   `archived`) and the digest, capped at `MRA_READER_DIGEST_CHARS`. An excerpt it
   records copies a checked quote and its locator.
5. `read_source(source_id, node, looking_for)` reads an archived page again,
   through the same reader, with a new question.
6. **A reader that fails** (timeout, unparseable JSON) returns an error that
   still carries the `source_id`: the page is archived and `read_source` can try
   again. It never falls back to the raw page, which is the thing this removes.
7. Reader calls are LLM calls: each is logged in `research_llm_calls` under
   `agent_id = "reader"`, and counted in the run's usage and billed cost. They
   need no queue of their own; the Firecrawl queue already paces them, one per
   fetched page.

Stage 2 uses the same `web_fetch`. The review tools are untouched: they already
keep review text out of the context (workings §2d).

### 12.4 What it does not solve

Thinking is the next largest share (21.6%), and grows with every call. That is
compaction's job (phase 3), re-sized on a run with the reader. The size of each
digest and the reader's cost per page are not measured; the phase 2 run measures
them, with the largest context sent, the reader's share of the bill, and how
often the agent had to `read_source` a page again.
