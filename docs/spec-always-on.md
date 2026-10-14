# Always on — spec

**Status:** plan, revised 2026-10-14 to run on pi's durable harness. Part 0,
the document library, is built (§10). Nothing else here is built.
**Harness:** pi — `@earendil-works/pi-durable` 1.2.0 on `pi-ai` 1.2.0 (§6).
**Parents:** `docs/goal.md` (the north star), `workings.md` (how a run works
today), `spec-research-agent-factory.md` (roles as data, which this
generalises). **Read for this revision:** pi's `packages/durable/README.md` and
`packages/durable/docs/spec.md`, its examples 20–28, and
`packages/coding-agent/docs/skills.md`; hermes-agent's
`agent/background_review.py`, `agent/curator.py`, and the docs
`website/docs/user-guide/features/{memory,skills,curator,cron,goals,heartbeat,loops,kanban}.md`.

**What changed on 2026-10-14, and why.** The first version (2026-10-12)
invented its own runtime: a `tasks` table, a lease loop, a hand-written resume,
and an event table replayed by id. pi already ships that as `pi-durable`:
conversations, tool calls and tasks committed to storage before anything is
shown, resumed where they stopped after a crash, with an inbox, background
subagents, child tasks, a task graph, compaction, and watchable views. §6 maps
each piece of this spec onto it, and §7 and §8 replace the hand-written
runtime and streaming. Primitives (§3), contracts (§4) and the learning loop
(§5) are unchanged in substance; what changed is where each one is wired in.

## 1. The problem

Today the cockpit is conventional software. The owner clicks **Start run**,
picks a stage, and waits 13 minutes (median stage-1 run, `spec-platform-move.md`)
for a fixed pipeline to finish. Then nothing happens until they click again.
Four things follow from that shape:

1. **The work is fixed in code.** Which agents exist, what each must deliver,
   and in what order they run are constants: `ROLE_SPECS` in
   `domain/research-roles.ts`, the deliverables in `domain/role-deliverables.ts`.
   A question that does not fit a stage, such as "has competitor X changed its
   angle since last week?", cannot be asked.
2. **Nothing watches.** Competitors launch ads, reviews arrive, and the owner's
   own ads produce results. None of it reaches the system unless someone starts
   a run.
3. **Feedback does not compound.** The owner can add a standing judgement
   (`research_judgements`, injected into every prompt by `PromptBlocks.judgements`)
   or steer a live run. Both are kept as free text. Nothing turns a correction
   into a change in *how* the work is done, and nothing measures whether a
   change helped.
4. **Nothing survives a restart.** The agent loop is pi-agent-core's in-memory
   `Agent`. A deploy kills every live run, and `recoverRunsKilledByRestart` can
   only end them `failed`. An always-on system restarts on every deploy.

## 2. What "always on" means

A standing **operator** per workspace (one brand). It holds the brand's goals
and runs a loop that never ends:

```
            ┌──────────── operator conversation's inbox (pi.inbox) ────────────┐
            │ owner message · schedule tick · watcher signal · task done ·     │
            │ task invalid · feedback · document added                         │
            └───────────────────────────────┬──────────────────────────────────┘
                                            ▼
                    operator run (pi-durable generation, compacted)
                 reads: goals, brand memory, open tasks, ledger summary,
                        playbook index — all as prompt sections
               calls: create_task (with a contract) · ask_owner · note
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
       worker task (durable,         approval card                 note in the
       background) owning a          (money, or verify: owner)     owner's feed
       worker conversation
               │  primitive = its extensions and tools
               │  contract  = its instructions + the onYield check
               ▼
       worker run: code checks the contract each time the model stops
               │
               ▼
       ends through RunEnd ─► reporter task posts "task done" ─► operator inbox
               │
               └─► reviewer: a fork of the worker conversation proposes
                   lessons; the owner approves; playbooks change
```

The operator plans; it never researches. Workers research; they never plan
beyond their own task. Code checks both.

Nothing here waits on a request. A browser opens one stream per workspace and
sees every part of this as it happens (§8).

## 3. Primitives

A **primitive** is a kind of worker: an agent template with a fixed tool set and
a fixed way of recording what it finds. It is today's `RoleSpec` without the
deliverable, which moves to the contract (§4). On pi, a primitive is a named set
of pi-durable **extensions** (§6.3): its tools, its prompt sections, its hooks.

| Primitive | Tools | Records | Spends | Exists today as |
|---|---|---|---|---|
| `research` | `web_search`, `web_fetch`, library | findings of the kinds its contract names | Parallel, page reading | the stage-1 `product`/`category` roles |
| `evidence` | `evidence_search`, `evidence_fetch`, library | findings with study citations | Parallel | the stage-2 roles |
| `ad_scan` | `ad_library_search`, `web_fetch` | ads, angles, landing pages | Trendtrack | part of `category`/`competitors` |
| `review_mine` | none: a code pipeline, as a durable task with no conversation | reviews into the review ledger | **Apify** | stage 3 (`ReviewMiningJob`) |
| `analyse` | ledger reads, library | derived findings that cite ledger rows, not pages | LLM only | the review analyst (`ReviewAnalyst`) |
| `write` | ledger reads, library | drafts (an ad, a brief, a report) that cite findings | LLM only | nothing yet |
| `critique` | ledger reads, library | a verdict on another task's output, against named criteria | LLM only | nothing yet |
| `ask_owner` | none | a question card; the answer comes back as feedback | nothing | `steer`, in reverse |

"Library" is the playbook and document tools of §6.5.

Rules:

- **The set is closed and lives in code.** The operator picks a primitive by
  name; it cannot invent one. A new primitive is a code change with tests, as a
  new tool is now (`ToolRegistry`). On pi this is literal: the operator's
  `create_task` tool configures the worker conversation with
  `configure({ extensions: [...] })` from a fixed table, so a name that is not
  in the table has no code behind it.
- **A primitive is built from data**, as `ResearchAgentFactory` builds a role
  today. The difference is that what it builds is a pi-durable conversation's
  agent (model, extensions, tools, instructions), not an in-memory `Agent`.
- **Stages become saved plans.** Stage 1 is a plan of four tasks
  (`champion`, then `product`/`competitors`/`category` side by side). The operator
  can run it as is, run part of it, or compose something new. The current
  `StageOneRun` and `ProductTruthRun` keep working until the plans replace them,
  and each is replaced only when a run of the plan matches a run of the stage.

## 4. Contracts: completion rules written for the task

The operator writes a **contract** for each task. It is the definition of done,
written at the moment the task is created, for that task.

```ts
interface TaskContract {
  objective: string;                 // one sentence, shown to the owner
  primitive: PrimitiveName;          // from the closed set in §3
  deliverable: Deliverable;          // the existing type, domain/deliverable.ts
  inputs: { finding_ids: string[]; document_ids: string[] };
  budget: { max_turns: number; max_usd: number };
  verify: "code" | "critique" | "owner";
  stop_when?: string;                // prose: when to stop and ask instead
}
```

The whole idea rests on one fact about the code as it is: **`Deliverable` is
already data.** Its three shapes (`fields`, `list`, `per_item`) say which
finding kinds must exist, which fields are compulsory, and when a search is
saturated. `DeliverableCheck` already reads one and refuses `finish` until it is
met; `LimitClose` already reads one to say what is missing at the turn limit;
`DeliverableTable` already renders one into the prompt. A contract is a
`Deliverable` the operator writes as JSON instead of one a developer writes as
a constant.

So the model writes the rule, and code enforces it. That keeps the house rule
"the agent picks from a closed list, code checks the pick": every name in a
contract (finding kinds, `FieldRule` kinds, primitives, tools) comes from a
vocabulary in `domain/`, and a zod schema refuses anything else.

**Compared with hermes.** Hermes's `/goal` has a "completion contract" with
five prose fields (`outcome`, `verification`, `constraints`, `boundaries`,
`stop_when`), and after every turn a judge model reads the reply and decides
`done`, `continue` or `blocked`. That is the right loop and the wrong checker
for this app: a judge model can be talked into "looks done", and the findings
here are rows code can count. So the loop is hermes's and the checker is code.
The judge survives only for `stop_when`, the one field code cannot read (§6.4).

Before a task is queued, a **contract check** (in `extract/`, pure) refuses a
contract that cannot be met or should not run without a human:

| Check | Refuses | Why |
|---|---|---|
| vocabulary | a finding kind, rule or primitive not in `domain/` | the model cannot invent a check code does not have |
| reachable | a field whose finding kind the primitive cannot record | a task that can never finish |
| inputs exist | a `finding_id` or `document_id` not in this workspace | a task built on nothing |
| budget | `max_usd` over the workspace's per-task cap | spend stays bounded |
| money | any `review_mine` task, any task with Apify in reach | **CLAUDE.md rule 5**: Apify spend is asked for first. The task becomes an approval card, not a queued task |

`verify` says who signs the task off once code is satisfied: `code` alone
(the contract check is enough), `critique` (a `critique` task is created against
it, with its own contract), or `owner` (an approval card). The operator picks;
the workspace sets a floor (for example, anything written for publication is
`owner`).

A contract that fails is not retried blindly. The task ends `invalid` with the
problems, as runs do today, and that lands in the operator's inbox. The
operator may write a new contract. `invalid` stays distinct from `failed`.

## 5. The learning loop

Hermes improves itself with three parts, read from its code:

1. **A background review after each turn** (`agent/background_review.py`). A
   fork of the agent replays the conversation and asks "should a memory or a
   skill be saved or changed?" Its prompt treats a user correction ("stop doing
   X") as the strongest signal, and prefers patching a skill that was in use over
   writing a new one.
2. **A write-approval gate** (`memory.write_approval`, `skills.write_approval`).
   When on, every write from the review is **staged** and shown to the user,
   who approves or rejects it before it affects anything.
3. **A curator** (`agent/curator.py`). Runs when the agent has been idle (by
   default 2 hours idle, at most every 7 days), counts how often each skill is
   used, marks unused ones stale and then archives them, can merge
   near-duplicates, snapshots the library first, and keeps a ledger of every
   change so any one can be rolled back.

Hermes's skills are markdown files the agent reads on demand: a short index
always in the prompt, the body loaded when needed. Its `/learn` turns a whole
book into one such skill, a short `SKILL.md` and one reference file per chapter.
pi's coding agent uses the same form, the Agent Skills format
(`packages/coding-agent/docs/skills.md`): name and description in the prompt,
`SKILL.md` read only when the task calls for it.

This app takes the same three parts, adapted to a product with an owner who is
not a developer and a domain where a wrong lesson costs ad money. Where each
one runs on pi is in §6.6.

### 5.1 What is learned, and where it lives

| Store | Holds | Read by | Example |
|---|---|---|---|
| **Brand memory** | facts about this brand and this owner | the operator and every worker, as a prompt section | "Owner does not want comparisons to named competitors in ads." |
| **Playbooks** | how to do a class of task: steps, rules, pitfalls, in Agent Skills form | workers of the primitive the playbook names, index in the prompt, body through a tool | "When mining reviews for a sleep supplement, the 3-star band holds the objections; read it first." |
| **Judgements** | standing rules about sources and weighting | unchanged from today | "Reject affiliate review sites." |

Playbooks live in the library (§10) next to the owner's uploaded PDFs, marked
as playbooks, each with the primitive it applies to. One place for the owner's
documents and the system's learned methods, read the same way.

### 5.2 Feedback: what the owner does that counts

Feedback is an event, stored and attached to what it was about:

| Owner action | Recorded as | Strength |
|---|---|---|
| Rejects a finding, or marks a source wrong | `feedback{target: finding, verdict: reject, why}` | correction |
| Edits a draft before approving it | `feedback{target: draft, verdict: edited, diff}` | correction; the diff is the lesson |
| Approves a draft or a contract unchanged | `feedback{verdict: accept}` | confirmation |
| Answers an `ask_owner` card | `feedback{verdict: answer, text}` | instruction |
| Steers a live task | `feedback{verdict: steer, text}` | correction |
| Ad results arrive (spend, CPA, ROAS) for an ad the system wrote | `feedback{target: draft, verdict: outcome, metrics}` | outcome: the strongest, and the slowest |

Confirmations matter as much as corrections. Hermes's review counts only
corrections, which drifts a library toward caution. Here an accepted contract or
draft raises the use count of the playbooks it read.

### 5.3 The reviewer

After a task ends, and after any feedback event, a **reviewer** runs. It may
only **propose**:

- a new brand-memory entry, or a change to one;
- a patch to a playbook it saw in use (preferred, as in hermes), or a new one;
- nothing ("Nothing to learn" is a valid outcome, recorded).

Every proposal is a **lesson** row: the change as a diff, the feedback ids that
caused it, and the task ids it came from. A lesson with no feedback behind it is
refused by code. This is the main departure from hermes, whose review may save
on its own judgement; here a lesson must trace to something the owner did,
because otherwise the system learns from its own mistakes.

### 5.4 The gate

Lessons are staged. The dashboard shows them as cards: what changes, why
(the feedback quoted), and where it would apply. The owner approves, edits or
rejects. Approval writes a new **version** of the playbook or memory entry;
nothing is overwritten in place. Rejection is itself feedback: the reviewer sees
rejected lessons and must not propose the same one again.

The gate is on by default and per store. An owner can switch brand memory to
auto-apply once they trust it; playbooks stay gated. That matches hermes's
`write_approval`, inverted: hermes defaults to writing freely.

### 5.5 Measuring whether a lesson helped

Every task records which playbook versions it read. Per version the store
counts: tasks that met their contract on the first try, tasks whose output the
owner accepted unchanged, tasks the owner corrected, and for `write` tasks the
outcome metrics of the ads. A version that does worse than the one before it,
over enough tasks to say so, is flagged on the dashboard with the numbers and a
one-click rollback. No version is rolled back automatically.

### 5.6 The curator

Runs when the workspace has had no task for an hour and at most once a day.
Deterministic first: playbooks unread for 30 days are marked stale, for 90 days
archived (never deleted). Then optionally one LLM pass that proposes merges of
overlapping playbooks, **as lessons through the same gate**. Before any change,
the current versions are already kept, because nothing is overwritten (§5.4),
so rollback needs no separate snapshot.

### 5.7 From documents to playbooks

An uploaded PDF is read as it is (§10). The next step, borrowed from hermes's
`/learn`, is a `distil` task: an `analyse` worker reads a document and proposes a
playbook (a short `SKILL.md` plus one reference section per chapter) as a
lesson, through the gate. The PDF stays the source; the playbook cites its
sections. Not built.

## 6. The harness: pi

### 6.1 Why pi-durable, and not pi-agent-core or the coding agent

pi is three layers, all in `agent-collection/pi/packages` and on npm at 1.2.0:

| Package | What it is | Fit |
|---|---|---|
| `pi-agent-core` | an in-memory agent loop: model turns, tool calls, events | what the app runs today (0.87.1). Nothing survives the process. |
| `pi-coding-agent` | the `pi` CLI and SDK: sessions on disk, skills, extensions, read/bash/edit/write | built for a person at a terminal working on files. Its skills format is worth copying (§6.5); its runtime is not this app's. |
| `pi-durable` | a durable harness: every model turn, tool call, and piece of app state committed to storage before it is shown; a restart picks work up where it stopped | the always-on runtime this spec needs. Marked **experimental**: "the API changes without notice between releases". |

pi-durable is built on `pi-ai` (models) and `chord` (document state). It does
not use pi-agent-core: its own `pi.generation` and `pi.tool` tasks replace the
`Agent` loop.

### 6.2 What pi-durable gives, mapped onto this spec

| This spec needs | pi-durable has | README section |
|---|---|---|
| work that survives a deploy (§1.4) | **tasks**: durable state machines that checkpoint every phase; `harness.resume()` continues them after a restart | Concepts; Persist and Resume |
| the operator's inbox (§2) | each conversation's **inbox** (`pi.inbox`): `submit` with `whenBusy: "followUp"` (next run), `"steer"` (joins the running one), `"reject"`, or a `write` that adds an entry without a model call | Busy Conversations |
| a signal that is not an owner message | `submit({ type: "input", content, entry: { kind: "mra.signal", data } })`: the model sees `content`; the transcript keeps the typed entry | Busy Conversations |
| a task delivered exactly once across a restart | `requestId` on a submission: resubmitting with the same id finds the same submission | Persist and Resume |
| a worker per task, running in the background | a **background task** owning a **worker conversation**, the pattern of example `23-subagent-background.ts`: spawn, steer, wait, stop, list, and a reporter task that posts the answer back to the parent as a follow-up | Abort and Subagents |
| one task waiting on others (champion before product/competitors/category) | **child tasks** and a `waiting` state with `on: [...]` and `allSettled` or `failFast` | Child Tasks |
| the work board on the dashboard | the **task graph**: every live task, its owner, its status, as one watchable state | Task Graph |
| primitives as data | **extensions** (tools, prompt sections, hooks) installed in a registry; each conversation's agent (`pi.agent`) stores which it selects, its model, its tools, its instructions | Extensions; Per-Conversation Agent |
| a contract checked by code each time the model stops | the generation hook **`onYield`**: return `{ continue: "<what is still missing>" }` to keep the run going | Hooks |
| the Apify ask-first rule enforced in code | the tool hook **`beforeTool`**: return `{ block: "<why>" }` | Hooks |
| an operator conversation that never ends | **compaction**, automatic in the background and on context overflow, plus `reset(handoff)` | Compaction; Reset and Handoff |
| brand memory, task state, the operator's goals | typed **documents** committed with entries (`defineDoc`) | Your Own State |
| the reviewer reading what a worker did | **`fork(entryId)`**: a new conversation that sees the parent's entries up to that point | More Conversations and Forks |
| live streaming to the browser | `conversation.watch()`, `watchEvents()`, `harness.watchTaskGraph()` | Watching a Conversation; Agent Events |
| token counts per conversation and model | `pi.usage` | Usage and Cost |

What it does not give, and this app keeps:

- **The research store.** Findings, packets, reviews, the library, lessons,
  feedback and playbook versions stay in the research store (SQLite or Neon,
  `adapters/store/`). pi-durable holds only the harness's own state:
  conversations, tasks, inboxes, and the documents of §6.4.
- **Billed cost.** `pi.usage` counts tokens and pi-ai's list-price cost. The
  house rule stands: what a run cost is billed (OpenRouter `/generation`, plus a
  `research_charges` row per paid call), never calculated (`workings.md` §2a).
- **Skills.** pi-durable has no skills feature. Playbooks are an extension
  (§6.5).
- **Timers.** There is no cron. A task phase can `sleep(until)`, and a
  restarted task re-enters its phase with its checkpoint, so a watcher is a
  task that checkpoints its next wake time and sleeps until it (§7.3).

### 6.3 How the pieces are built

```
Harness (one per process, opened in main.ts)
 ├─ storage: openNodeSqliteStorage("/data/harness.sqlite")
 ├─ registry: the extensions below
 └─ per workspace:
     ├─ operator conversation      extensions: operator, memory, playbooks
     │    documents: mra.goals, mra.memory, mra.workspace
     ├─ worker task (background) ──owns──► worker conversation
     │    extensions: one primitive's set, memory, playbooks, contract
     ├─ reporter task              posts the worker's outcome to the operator inbox
     ├─ reviewer conversation      a fork of a finished worker conversation
     └─ watcher tasks              sleep → check → submit a signal → sleep
```

Extensions, each a `defineExtension({ name, tools, sections, hooks })`:

| Extension | Tools | Sections | Hooks |
|---|---|---|---|
| `mra.operator` | `create_task`, `cancel_task`, `ask_owner`, `note` | goals, open and recent tasks, ledger summary | — |
| `mra.web`, `mra.evidence`, `mra.ads`, `mra.ledger` | today's research tools, rewritten as `defineTool` (§9.2) | the tool lines | — |
| `mra.contract` | `finish` | the deliverable table, rendered from the contract | `onYield` checks the contract (§6.4) |
| `mra.money` | — | — | `beforeTool` blocks a paid tool without an approval |
| `mra.memory` | — | brand memory | — |
| `mra.playbooks` | `playbook_read`, `library_read` | the playbook and document index | — |
| `mra.reviewer` | `propose_lesson` | the lesson rules | — |

A primitive (§3) is a row in a table: its extensions, its model, its turn
limit. `create_task` resolves the row and calls `configure()` on the new worker
conversation. The contract goes into that conversation's `instructions` and
into its `mra.contract` document, where the hook reads it.

### 6.4 The contract, run by the harness

Every time a worker's model stops without calling a tool, pi-durable calls the
`onYield` hooks of the extensions that conversation selects:

1. `mra.contract`'s hook runs `DeliverableCheck` over the task's findings in the
   research store. Missing fields come back as
   `{ continue: "Still missing: …" }`, and the run goes on. This is hermes's
   goal loop with code as the judge.
2. The task's turn count, in the `mra.contract` document, rises by one per
   continuation. At `budget.max_turns`, the hook stops continuing, and the task
   ends through `RunEnd` with what `LimitClose` says is missing.
3. When the check passes, or `finish` succeeds, the task ends through `RunEnd`
   as `completed`, or as `invalid` with the problems.
4. Only if the contract has `stop_when` does a cheap judge model read the last
   answer against it (hermes's `goal_judge` role). A `stop` verdict ends the task
   and posts an `ask_owner` card. Code decides done; the judge only decides "ask".

`max_usd` is checked in the same hook against the task's billed charges so far.

### 6.5 Playbooks and documents, as one extension

`mra.playbooks` follows the Agent Skills form that pi's coding agent and hermes
both use. Its section lists each playbook's name and one-line description, and
each ready document's title and sections, which is cheap. `playbook_read` returns
a playbook's `SKILL.md` or one of its reference sections, and `library_read`
returns one section of an uploaded document, only when the model asks. The
library tools built in part 0 (§10) move into this extension; their behaviour
does not change.

### 6.6 The learning loop, on the harness

| Part (§5) | Hermes runs it as | Here it runs as |
|---|---|---|
| reviewer | a forked agent in a daemon thread after each turn | a background task, started by the reporter when a worker task ends and by each feedback event. It forks the worker conversation at its last entry (`fork`), selects `mra.reviewer` only, and runs. A fork sees the whole transcript, so the reviewer reads what the worker actually did, not a summary. |
| gate | staged writes, `/memory pending` | `propose_lesson` writes a lesson row to the research store and an inbox card. Nothing reaches `mra.memory` or a playbook until the owner approves. |
| brand memory in the prompt | a frozen snapshot taken at session start, for the prompt cache | the `mra.memory` section. pi-durable re-sends a section only when its text changes, so an approved lesson reaches the next request and leaves the cache alone otherwise. |
| curator | a gateway housekeeping chore, when idle | a watcher task (§7.3) per workspace: wakes daily, runs only if no task has run for an hour |

### 6.7 Every task is a run

Decided 2026-10-14. Each durable task has a `research_runs` row, created before
the task, and the two are linked both ways.

**Why.** Everything a task produces lives in the research store and is keyed by
run id: `research_findings.run_id` references `research_runs(id)`, and
`RunEnd`, `research_charges`, the cost report, the LLM call log, the packet and
the run view all look a run up by its id. A run row per task means all of that
keeps working unchanged. pi-durable cannot be that record: its storage is a
separate SQLite file (§7.1), and research rows cannot reference it.

**How pi does the same thing.** pi keeps no run table; the record of a piece of
work is the conversation. The coding agent stores one session per JSONL file,
named by session id, and extensions keep their state as custom entries in it.
pi-durable scopes app state to a conversation as documents, writes the first
one in the commit that creates the conversation (`init`), and finds a task's
child conversation through the ownership index
(`scanConversations({ ownerTaskId })`). This app does the same on its side:
the run row is the app's record of the conversation, and each points at the
other.

**The link.**

| Side | Holds |
|---|---|
| `research_runs` | new columns `task_id`, `conversation_id`, `contract` (the contract as JSON). `stage` stays the integer research stage of the contract's node, as for any run. A non-empty `task_id` is what marks a run as a durable task. |
| worker conversation | an `mra.run` document `{ run_id }`, written by `init` in the commit that creates the conversation |

The three columns are `ALTER TABLE` migrations in `StoreMigrations`
(`check-conventions.mjs` enforces that).

**Order across two stores.** The run row is on Neon and the task is in the
harness file, so creating both cannot be one transaction. The run is written
first, `queued`, with its contract. The task is created with `requestId` set to
the run id, so creating it twice finds the same task. At startup, a `queued`
run with an empty `task_id` (the process died between the two writes) gets its
task created then. The task fills in `task_id` and `conversation_id` when it
starts, and sets the run `running`.

**The end.** A task ends only through `RunEnd` with its run id, which assembles
the packet from the run's findings and sets the final status, as for every run
today. The reporter task (§6.3) reads that status to tell the operator.

## 7. The runtime

### 7.1 One process, one harness

Hermes stays on through a **gateway**: one long-running process that hosts the chat
platforms, a cron ticker and a housekeeping pool. Here the `mra` container is
that process, and it already runs all the time. At startup `main.ts` opens the
harness, installs the extensions, and calls `harness.resume()`; on `SIGTERM` it
calls `harness.close()`. Nothing else is needed to be always on.

- **Storage:** `/data/harness.sqlite` on the existing `/data` volume.
  pi-durable has SQLite (Node), JSONL, memory and Cloudflare Durable Object
  backends, and **no Postgres one**, so harness state cannot live on Neon. One
  process owns a storage at a time, with no cross-process locking, which fits a
  single container. The nightly snapshot (`../setup.md` §5a "Backups") adds this
  file.
- **A deploy is a restart.** Tasks resume from their last checkpoint. A tool
  call cut off mid-flight reruns only if it is declared `replay: "safe"`;
  otherwise the model gets an `interrupted` result. Every tool that spends money
  (Parallel, Trendtrack, Apify, Firecrawl) stays not replay-safe, because a
  rerun would pay twice. Its charge row is already written when the call returns.
- **Layers.** `pi-durable` and `chord` belong to the `agent` layer, next to
  `pi-ai`; `architecture.test.ts` gets the two ownership entries. Opening the
  SQLite storage is I/O, so a small adapter in `adapters/` wraps it behind a
  port.

### 7.2 The operator

A long-lived conversation per workspace. Most of what it reads is in prompt
sections rendered fresh before each request (goals, memory, tasks, ledger
summary, playbook index); the transcript holds only what happened. Automatic
compaction keeps it under the context window. If the transcript drifts, a
`reset` with a handoff note starts it clean. A `create_task` whose contract
fails §4 comes back to it as a tool error in the same run.

Owner messages are `submit` with `whenBusy: "followUp"`, and corrections to
work in flight are `"steer"`. Signals and task reports are inputs with an
`mra.signal` entry and a `requestId`, so a restart never delivers one twice.

### 7.3 Watchers and schedules

Code, not agents, decides when something changed. A watcher is a durable task
with two phases: `sleep`, which checkpoints the next wake time and calls
`runtime.sleep(until)`, and `check`, which looks and, if something changed,
submits a signal to the operator. Two hermes rules apply, from `heartbeat.md`
and `loops.md`: **missed ticks coalesce** (a watcher that slept through three
intervals fires once), and **a check that finds nothing says nothing**, so an
idle watcher does not wake the operator to invent work.

| Watcher | Checks | Cost |
|---|---|---|
| competitor ads | Trendtrack: new ads from tracked brands since last check | Trendtrack credits; daily |
| reviews | review counts of tracked listings | free where read from the stored listing; Apify only by approval |
| schedule | the owner's cadence ("refresh market truth monthly") | none |
| curator | the playbooks, when the workspace is idle | none, or an LLM pass if consolidation is on |
| ad results | the owner's ad account, once connected | none |

Hermes refuses to let a cron job create cron jobs, to stop runaway scheduling.
The same rule holds here: workers cannot create tasks or watchers; only the
operator and the owner can.

### 7.4 Limits

Per workspace: tasks running at once (default 3), spend per day, spend per
task. `create_task` refuses past the running cap; `mra.money`'s `beforeTool`
hook blocks any paid call past the spend caps and any Apify call without an
approval. The Apify rule is enforced in code, not only written in a prompt.

## 8. Everything async, everything streaming

One rule: **no request waits for work.** A request that starts work answers
`202` with the id of what it started, and the work reports through a stream.

- **One stream per workspace**, `GET /api/workspace/stream`, Server-Sent
  Events. Behind it the server holds pi-durable watches: `watchTaskGraph()` for
  the work board, `watchEvents()` on the operator conversation for its notes
  and questions, and on each worker conversation the browser has open.
- **Snapshot, then changes.** pi-durable does not replay history to a late
  watcher: "a client that joins late or reconnects starts from the current
  view; nothing is replayed", and a slow one past 100 pending frames gets one
  fresh snapshot instead. So the stream opens with a snapshot event and then
  sends changes; a browser that reconnects gets a new snapshot. The first
  version's `?after=<id>` replay is dropped. History is not lost: the
  transcript entries are the history, read through the conversation, not the
  stream.
- **Token deltas** come from `watchEvents()` as appends, committed at most every
  100 ms (`settings.progress`), so a crash loses at most that window.
- The per-run stream (`http/event-stream.ts`) stays for today's stages until
  they are replaced by plans.
- Caddy already flushes the whole `marketing.vanis.ai` block
  (`flush_interval -1`, `../setup.md` §5a).

The document library (§10) already works this way: upload returns `202`, and
conversion streams one event per page.

## 9. Moving the app onto pi 1.2

### 9.1 The version gap

The app runs `pi-agent-core` and `pi-ai` at **0.87.1**. pi-durable 1.2.0 pins
`pi-ai` **1.2.0** exactly. One package cannot hold two versions of `pi-ai` for
code that shares types, so the first step is to move both pi packages to 1.2.0
and keep the current stages working on them. How much breaks between 0.87.1 and
1.2.0 has not been measured; part 1 measures it, with `mra check` and one run.
pi-durable is experimental, so its version is pinned exactly (no `^`).

### 9.2 What moves, what stays

| Today | On pi-durable |
|---|---|
| `AgentDriver` over pi-agent-core's `Agent` | the harness's generation and tool tasks |
| `AgentTool` objects from `ToolRegistry` | `defineTool` in extensions; same TypeBox schemas from `pi-ai` |
| `RoleDone` refusing `finish` | `mra.contract`'s `onYield` and `finish` (§6.4) |
| `TurnBudget`, `LimitClose` | the turn count in `mra.contract`; `LimitClose` unchanged |
| `LiveRuns`, `EventStream` | watches (§8) |
| `RunEnd` | unchanged; every task still ends through it |
| `recoverRunsKilledByRestart` | `harness.resume()` for new work; kept for old runs until they are gone |
| `StageOneRun`, `ProductTruthRun` | kept on pi-agent-core 1.2.0 until each stage is a saved plan whose run matches the stage's |

Tests keep pi-ai's faux provider; pi-durable adds `MemoryStorage`, so a test
of a durable task needs no file and no network.

## 10. Part 0, built: the document library

Built 2026-10-12, on today's runtime. Part 3 moves its two tools into the
`mra.playbooks` extension (§6.5); the rest stays as it is. What it does, end
to end:

1. **Upload.** The **Library** page (`frontend/src/LibraryPage.tsx`) posts a PDF to
   `POST /api/research/library` (multipart, field `file`). The route checks the
   file starts with `%PDF-` and is at most `MRA_LIBRARY_MAX_MB` (default 25),
   stores a row with status `converting`, and answers `202` with it. Nothing is
   converted inside the request.
2. **Convert, async.** `LibraryIntake` (`agent/library/library-intake.ts`) runs the
   conversion in the background. `PdfMarkdown` (`adapters/pdf-markdown.ts`) reads
   the PDF with `unpdf` (pdf.js, pure JavaScript, no native dependency, no API,
   no cost) page by page and writes markdown: a text line set in a font clearly
   larger than the body text becomes a heading (two such lines in a row become
   one heading), bullets become list items, and a line at the top or bottom of
   most pages (a running header, or "Page 3 of 18") is dropped.
3. **Stream.** Each page converted is an event on
   `GET /api/research/library/:id/events` (SSE): `page` (n of total), then
   `ready` or `failed`. The page shows a progress bar from it.
4. **Store.** The markdown is stored in `research_documents` (SQLite or
   Postgres, the same table), per workspace. The original PDF is not kept.
5. **Read.** Every research role has two tools: `library_index` lists the
   workspace's documents and, for each, its sections by heading; `library_read`
   returns one section's markdown. That is hermes's progressive disclosure: the
   index is cheap, a section is loaded only when the agent wants it, and a
   whole book never enters a prompt. With nothing `ready` in the workspace,
   both tools and their prompt lines are left out, so a run is exactly as it
   was.

Seen working, 2026-10-12, locally: the Long-Form Statics Playbook (18 pages)
and the research compartment (11 pages) uploaded with `mra library`, each
streaming every page and ending `ready`, with every section a heading. Then one
url brief on `product_data` (run `c66235a3`, `https://thedropletco.co.uk`,
completed, 14 attributes, 3 gaps): the agent called `library_index` on its first
turn and `library_read` once, for the research compartment's section 2,
"Stage 2 — Product truth", 4,298 characters of a 33,837-character document.
The section closest to its task is "Stage 1 — Raw material", which holds the
"Product data" node; whether agents pick well is a prompt question for later,
not a tool fault.

Two things found while building it: pdf.js **detaches the buffer it is given**,
so `PdfMarkdown` hands it a copy and the caller's bytes survive; and a fast PDF
finishes before the browser's stream connects, so `LibraryIntake` replays the
latest frame to a late follower.

What it does not do yet: read scanned PDFs (no text layer means an empty
document, reported as `failed` with that reason), read images, accept other
formats, or turn a document into a playbook (§5.7).

## 11. The dashboard

`../goal.md` (the parent) says it: the UI is a dashboard where agent actions take
place and the owner follows and steers them, not a chat. Four areas:

1. **Inbox** — what needs the owner: approval cards (money, contracts marked
   `owner`), questions from `ask_owner`, lessons to approve.
2. **Work** — the task graph as a board by status, each task opening into its
   worker conversation: agent turns, tool lanes, costs.
3. **Knowledge** — the ledger by node (today's tiles), brand memory, and the
   library: uploaded documents and playbooks, with versions and their numbers.
4. **Feed** — the operator's notes and the live stream, in words.

A message box exists, as one way to put something in the operator's inbox, not
as the main surface.

## 12. Plan, in parts that each ship on their own

| Part | Builds | Proves |
|---|---|---|
| 0 | Document library (§10) | **done** |
| 1 | `pi-agent-core` and `pi-ai` to 1.2.0 (§9.1); pi-durable installed, pinned; a harness opened in `main.ts` on `/data/harness.sqlite`, resumed at start, closed on stop; nothing runs on it yet | today's stages still pass `mra check` and one url brief on 1.2.0; the harness survives `mra down` / `mra up` |
| 2 | One worker primitive (`research`) as extensions; a run row per task with its three new columns (§6.7); a durable worker task running a hand-written contract through `onYield` (§6.4); `RunEnd` at its end | a task given by hand meets its contract or ends `invalid`, and a restart mid-task resumes it |
| 3 | The workspace stream (§8): task graph and conversation watches over SSE; library tools move into `mra.playbooks` | a browser sees a task from start to end, and reconnects to a snapshot |
| 4 | The other primitives; stage 1 as a saved plan of four tasks with child-task waiting | a stage-1 plan's result matches a `StageOneRun`'s on the same brief |
| 5 | Feedback events (§5.2) and the inbox cards | the owner's actions are recorded against what they were about |
| 6 | Reviewer as a fork, lessons, the gate, playbook versions (§5.3–5.4, §6.6) | a correction given once produces a lesson; approved, the next task reads it |
| 7 | The operator conversation (§7.2), `create_task`, `mra.money`, the schedule watcher | the system starts work nobody clicked, inside its limits |
| 8 | `write` and `critique` primitives; the long-form statics playbook | an ad draft that cites its findings |
| 9 | Measurement per playbook version (§5.5), curator watcher (§5.6), `distil` (§5.7) | a lesson that hurt is visible with numbers |
| 10 | Ad-results feedback, competitor and review watchers | the loop closes on real ad performance |

## 13. Risks and open questions

- **pi-durable is experimental.** Its README says the API changes without
  notice. Pinning the version contains it; every upgrade is a deliberate part
  with `mra check` and one run.
- **The 0.87 → 1.2 upgrade is unmeasured.** Part 1 exists to measure it before
  anything is built on top.
- **Harness state is not on Neon.** pi-durable has no Postgres backend, so
  conversations and tasks live in a SQLite file on the VPS while research data
  is on Neon. Two stores, two backups. Writing a Postgres storage is possible
  (pi-durable ships a conformance suite for custom backends) and is not planned.
  If the cockpit moves to Cloudflare (`spec-platform-move.md`), pi-durable's
  Durable Object backend fits that move better than the Convex Workflow
  component that spec proposes; that spec should be revisited before either is
  built.
- **The operator over-plans.** An LLM that may create tasks will create too
  many. Limits (§7.4) bound the cost; the measurement that matters is tasks
  created per useful finding, shown on the dashboard from part 7.
- **Lessons from one bad day.** A lesson is only as good as the feedback behind
  it. The gate (§5.4) and version measurement (§5.5) are the defence; whether
  owners will actually review lessons is untested.
- **Contracts the model writes badly.** The contract check refuses impossible
  ones but not pointless ones. `verify: owner` for anything new is the
  defence until there is data.
- **Open — yours:** should the operator run for every workspace, or only those
  that switch it on? Which ad account (Meta first?) for outcome feedback? Is
  brand memory visible to and editable by the owner from day one?
