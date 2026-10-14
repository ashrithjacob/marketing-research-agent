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
`website/docs/user-guide/features/{memory,skills,curator,cron,goals,heartbeat,loops,kanban}.md`;
and the Stanford CS146S lecture "How always-on agents work"
(`docs/Stanford-CS146S-How-always-on-agents-work.txt`), whose changes are
listed in §14.

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
               calls: create_task (with a contract) · send_owner
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
beyond their own task. Code checks both. Like the lecture's main agent, the
operator keeps its own conversation sparse: workers do the expensive reading,
and only their outcome comes back (§7.2).

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
| `ask_owner` | none: opened by `send_owner` with kind `question` (§7.2) | a question card; the answer comes back as feedback | nothing | `steer`, in reverse |

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
- **Cheapest source first.** A worker, and the operator deciding whether to
  start one, climbs a fixed ladder and stops at the first rung that answers:
  findings already in the ledger from earlier runs → the library → free page
  reads → paid tools (Parallel, Trendtrack, then Apify by approval) → the owner,
  last. The lecture's version runs conversation → API → web search → browser →
  full computer → user. Asking the owner is the most expensive rung, not the
  first, and reusing a finding beats paying for it again (as review pulls are
  reused today).
- **Stages become saved plans.** Stage 1 is a plan of four tasks
  (`champion`, then `product`/`competitors`/`category` side by side). The operator
  can run it as is, run part of it, or compose something new. The current
  `StageOneRun` and `ProductTruthRun` keep working until the plans replace them,
  and each is replaced only when a run of the plan matches a run of the stage.

### 3.1 What "complete" means, per primitive

Decided 2026-10-14: **what complete means and when to stop trying are two
separate things.** A task is complete when its primitive's definition of
complete is met, and that definition is code, one per primitive. When to stop
trying is decided by circuit breakers (§3.2), never by the definition. The contract (§4) only fills in the definition's parameters: which
fields, which inputs, which criteria. The operator cannot write a new kind of
"done"; it can only choose a primitive and say what that primitive must cover.

| Primitive | Complete when | Checked by | The contract supplies |
|---|---|---|---|
| `research` | every required field or item of its deliverable is recorded, each citing a source in the run's ledger; a `list` deliverable's search has saturated (its `stop.quietRun` sources in a row added nothing new) | `DeliverableChecks` (`FieldsCheck`, `ListCheck`, `PerItemCheck`), `CitationCheck` — all exist | a `Deliverable` |
| `evidence` | as `research`, and every finding cites a source recorded in the ledger, so it can be re-read from the archived page | `DeliverableChecks`, `TruthCitations` — exist | a `Deliverable` |
| `ad_scan` | its advertiser list has saturated: the given number of searches in a row found no advertiser not already listed; every ad listed is archived as an `ad_library` source | `ListCheck` with an `ad` item — to build | the search terms, markets, and the quiet-run length |
| `review_mine` | every target × star band in its plan was pulled, or recorded as unavailable with the reason | the pipeline's own end, as `ReviewMiningJob` today | the targets and bands |
| `analyse` | every input finding is covered by at least one derived finding, and every derived finding cites ledger rows that exist | new check — to build | the input finding ids |
| `write` | a draft exists with every section its playbook names, and every claim in it cites a finding | new check — to build | the playbook and the finding ids it may draw on |
| `critique` | a verdict (pass or fail, and why) exists for every criterion named | new check — to build | the criteria and the task it reviews |
| `ask_owner` | the owner answered | the answer's arrival | the question |

### 3.2 When to stop trying, and ending partly done

Decided 2026-10-14. Only `finish` ends a task as complete, and `finish` refuses
while the definition of complete is not met (§6.4). Refusing alone would loop:
a refused `finish` is a tool call, so the model never stops, and a rule that
only looks at stops never sees it. Four circuit breakers end a task that is not
getting there; whichever trips first ends it, the same way:

| Breaker | Trips when | Catches |
|---|---|---|
| refused `finish` | `finish` has been refused 3 times; the next call is accepted | a model that keeps asking to finish without doing the missing work |
| no progress | 5 model responses in a row added no finding and no source | a model circling the same searches or pages |
| step ceiling | the task's model responses reach its primitive's ceiling | anything the first two miss; a backstop, not a definition of done |
| money and time | billed spend reaches `budget.max_usd`, or the task has run `budget.max_minutes` | a tool that hangs, a task that is expensive but busy |

The step ceiling is set per primitive, generously: to start, twice today's role
limits in `domain/research-roles.ts` (8 to 20 turns), so about 30 for
`research` and 40 for `evidence`, then re-set in part 2 from the turn counts
real tasks use, which the call log records. At 80% of the ceiling the model is
told, once, "record what you have, then call `finish`", as hermes's task board
warns its workers at 90% of their iteration budget.

*Corrected 2026-10-14, part 3:* "added no finding and no source" counts a page
archived for the first time as a source. Part 2 counted only ledger rows, and
the first real plan run (`f3c22148…`) ended `partial` after five calls that each
fetched new pages of the site before recording anything. `Corpus.write` no
longer rewrites a page it has, so a file's time is when the run first saw it,
and a page fetched again adds nothing.

*Built 2026-10-14, part 2:* the refused-finish breaker trips at the end of the
turn whose `finish` was refused the third time, so the "next call" is never
made; if one is already in flight, `finish` answers it NOT CHECKED and ends the
agent. Stage agents used to get five checks; they now get the same three.

**A tripped breaker does not fail the task.** It ends through `RunEnd` like any
other: `LimitClose` records each item still missing as a gap with the reason
(refused finish, no progress, step ceiling, spend cap, time cap), the packet is
assembled from everything recorded, and the task ends **`partial`**:

| Status | Means |
|---|---|
| `completed` | every required item of the definition is met |
| `partial` | some are met; each missing one is a gap with the reason it stopped |
| `invalid` | the agent finished, but what it produced was refused by the checks |
| `failed` | a crash |
| `cancelled` | stopped by the owner |

`partial` is not `invalid`, as `invalid` is not `failed`. The dashboard shows a
partial task's findings as usual, with its gaps highlighted: what is missing,
why it stopped, what the task cost. The operator receives the gap list and may
start a follow-up task whose contract covers only the gaps, which costs less
than rerunning the whole task.

Today's stage runs get the same status: a run that hits its turn limit with
gaps ends `completed` today, so "everything found" and "half found" look the
same on screen. That changes `FinalStatus` in `agent/run-end.ts`, the terminal
status list, and the frontend's status chips.

**Superseded the same day:** the first version of §3.1 said "a task has no turn
limit", with a no-progress rule counted per stop as the only backstop. A refused
`finish` is not a stop, so that rule could not see the loop it was meant to
stop; the ceiling came back, as a breaker only.

## 4. Contracts: completion rules written for the task

The operator writes a **contract** for each task. It is the definition of done,
written at the moment the task is created, for that task.

```ts
interface TaskContract {
  objective: string;                 // one sentence, shown to the owner
  primitive: PrimitiveName;          // from the closed set in §3
  complete: CompleteParams;          // that primitive's parameters (§3.1); a Deliverable for research and evidence
  inputs: { finding_ids: string[]; document_ids: string[] };
  budget: { max_usd: number; max_minutes: number };  // breakers, not done (§3.2)
  verify: "code" | "critique" | "owner";
  stop_when?: string;                // prose: when to stop and ask instead
}
```

The contract does not define what complete means; the primitive does (§3.1).
The contract says what this task must cover. For `research` and `evidence` that
is a `Deliverable`, and this part rests on one fact about the code as it is:
**`Deliverable` is already data.** Its three shapes (`fields`, `list`, `per_item`) say which
finding kinds must exist, which fields are compulsory, and when a search is
saturated. `DeliverableCheck` already reads one and refuses `finish` until it is
met; `LimitClose` already reads one to say what is missing when a run is cut short;
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
| shape | `complete` parameters that are not the shape its primitive takes | each primitive's definition of complete is fixed (§3.1) |
| reachable | a field whose finding kind the primitive cannot record | a task that can never finish |
| inputs exist | a `finding_id` or `document_id` not in this workspace | a task built on nothing |
| budget | `max_usd` over the workspace's per-task cap | spend stays bounded |
| money | any `review_mine` task, any task with Apify in reach | **CLAUDE.md rule 5**: Apify spend is asked for first. The task becomes an approval card, not a queued task. *Built 2026-10-14:* `ContractCheck.asksFirst`, not a refusal; approving a plan opens the card, and its Approve starts the task |

`verify` says who signs the task off once code is satisfied: `code` alone
(the contract check is enough), `critique` (a `critique` task is created against
it, with its own contract), or `owner` (an approval card). The operator picks;
the workspace sets a floor (for example, anything written for publication is
`owner`).

A contract that fails is not retried blindly. A task whose output the checks
refuse ends `invalid` with the problems; one stopped by a breaker ends
`partial` with its gaps (§3.2). Either lands in the operator's inbox, and the
operator may write a new contract. `invalid` stays distinct from `failed`, and
`partial` from both.

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

**Brand memory is visible and editable from day one.** Decided 2026-10-14.
The owner sees every entry in a list (§11) and can add, change or delete one
directly, without going through a lesson card. The reason is hermes's own: its
`write_approval` gate exists because "the agent saved a wrong assumption about
me", and a wrong entry nobody can see steers every task quietly. Nothing is
overwritten in place even then: a direct edit or delete is a new version marked
`by: owner`, so what changed and when stays on record and §5.5 can still compare
versions. An owner's edit also counts as feedback (§5.2, a correction), so the
reviewer learns from it and does not propose the removed entry again.

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

### 5.7 Evals: the engineering loop

The learning loop above changes playbooks and memory while the product runs.
The lecture describes a second loop that the team runs: a failure becomes an
**eval case**, the harness or prompt is fixed, the fix is checked against the
evals, and only then shipped. The same models, prompts and pi versions change
here too, so the same guard is needed.

- **What becomes a case:** every task that ends `invalid` or stops for no
  progress, and every owner correction that produces a lesson. A case is the
  contract, the tool results the worker received, and what should have
  happened.
- **Why replay is possible:** every page a tool reads is already archived in
  the corpus under its sha256, and every paid result is a stored row. A case
  replays the model against those recorded results, so it spends LLM tokens
  but no search, page or Apify money.
- **When the suite runs:** on demand, before a change to a prompt, a
  primitive's definition, a model, or the pi version, with the pass rate
  compared to the last run. Not inside `mra check`, because it calls a real
  model.
- **Long tasks:** the lecture's open problem is evaluating an agent that runs
  for a month while models ship monthly. Here a task is short (minutes to
  hours) and the operator is the long-running part, so the suite evaluates
  tasks, and the operator is judged by the production numbers of §5.5 and §7.2.

### 5.8 From documents to playbooks

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

The lecture makes the same choice for the same reason: what an always-on agent
needs underneath is a **durable workflow**, not a job queue. If a job queue
crashes at step three, a restart replays steps one to three; a durable workflow
resumes at step three. The lecture's team uses Temporal so as not to build that
themselves; pi-durable is that layer here. Its other rule applies to this whole
spec: models are the worst they will ever be, so build as little as possible,
expect to rebuild the surface within months, and keep primitives thin.

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
| `mra.operator` | `create_task`, `cancel_task`, `list_tasks`, `search_log`, `send_owner` | its role and the brand's goals: stable text only (§7.2) | — |
| `mra.web`, `mra.evidence`, `mra.ads`, `mra.ledger` | today's research tools, rewritten as `defineTool` (§9.2) | the tool lines | — |
| `mra.contract` | `finish` | what the task must cover, rendered from the contract | `onYield` runs the primitive's completion check (§3.1, §6.4) |
| `mra.money` | — | — | `beforeTool` blocks a paid tool without an approval |
| `mra.memory` | — | brand memory | — |
| `mra.playbooks` | `playbook_read`, `library_read` | the playbook and document index | — |
| `mra.reviewer` | `propose_lesson` | the lesson rules | — |

A primitive (§3) is a row in a table: its extensions, its model, and its
definition of complete (§3.1). Models are chosen by role, as the lecture
describes: the operator runs on a fast, low-latency model because the owner
waits on it; workers run on whatever model does their job best per dollar,
because ten minutes or twelve makes no difference to a background task. `create_task` resolves the row and calls `configure()` on the new worker
conversation. The contract goes into that conversation's `instructions` and
into its `mra.contract` document, where the hook reads it.

*Superseded 2026-10-14, part 2:* a worker does not select shared
`mra.web`/`mra.evidence`/`mra.ledger`/`mra.contract` extensions. Each task gets
its own, `mra.task.<run id>`, built from its run row and installed for the
task's life: its tools, its prompt section and its contract hooks. The reason
is that today's tools are bound to a run when they are built (its charge
meter, its ledger, its corpus folder), and pi-durable registers a tool once per
process, so a shared tool would have to look its run up on every call. pi-durable
allows the registry to change while it runs, and a conversation stores the
extension's name, so the per-run extension is selected by name like any other.
The cost is that startup must install the extensions of live tasks before
`harness.resume()`, which `TaskSupervisor.recover` does. The contract is read
from the run row, not an `mra.contract` document.

### 6.4 The contract, run by the harness

**One exit.** Only `finish` ends a task as complete. `finish` runs the
primitive's completion check (§3.1) over the task's findings in the research
store; met, the task ends through `RunEnd` as `completed`, or `invalid` if what
it recorded is refused; not met, `finish` refuses with "Still missing: …", which
counts toward the refused-`finish` breaker (§3.2).

**Nudges, not exits.** pi-durable's generation hooks, from `mra.contract`:

1. `onYield`, when the model stops without calling a tool: it runs the same
   check and answers `{ continue: "Still missing: …, then call finish" }`. This
   is hermes's goal loop with code as the judge. It never ends the task.
2. `afterResponse`, after every model response: it counts responses toward the
   step ceiling, and responses without a new finding or source toward the
   no-progress breaker (§3.2). A tripped breaker ends the task through `RunEnd`
   as `partial`.
3. `beforeRequest`, once, at 80% of the ceiling: it adds "record what you
   have, then call `finish`" to the next request.
4. Only if the contract has `stop_when` does a cheap judge model read the last
   answer against it (hermes's `goal_judge` role). A `stop` verdict ends the task
   `partial` and posts an `ask_owner` card. Code decides done; the judge only
   decides "ask".

*Superseded 2026-10-14, part 2:* the breakers are read in `afterTools`, not
`afterResponse`, and `onYield` reads them again before it continues a run.
`afterResponse` runs before the response's tool calls, so a response that
records a finding would be counted as one that added nothing: its rows are not
written yet. `afterResponse` writes the call-log row and queues the billing
lookup. A breaker that trips in `afterTools` stops the run by aborting the
worker conversation from the task, so one more request can start before the
abort lands. The `stop_when` judge (4.) is not built; a contract may carry
`stop_when`, and nothing reads it yet.

*Decided 2026-10-14 with the owner, superseding item 4:* the `stop_when` judge
is a free-form LLM judge, kept because code cannot read prose. It runs **after
every tool round** of a task whose contract has `stop_when`, not only when the
model stops: measured workers end by calling `finish`, so a judge at the stop
would almost never run. A "stop" verdict **pauses** the task (it spends nothing
while it waits) and puts the judge's question to the owner **in the operator
chat**; the owner's answer resumes the same task, with its findings and
context. Question cards replace the chat line when `send_owner` is built. The
judge uses its own model setting, `MRA_JUDGE_MODEL`, defaulting to `MRA_MODEL`.
It still never decides done.

*Built 2026-10-14* (`agent/task/task-judge.ts`, `task-pause.ts`). Measured on
the local stack, plan for thedropletco.co.uk (UK, product facts) with the
saved task's default `stop_when`: after the worker's first step the judge
asked "The homepage shows Droplet sells more than one product (diffusers,
incense & more, plus a Houseplant Scent Burner) and the brief doesn't name one
— should the fact sheet cover the whole brand or a specific product?"; the
task waited with no calls; the owner's chat reply went through the operator's
`answer_task`; the worker received it in its third call and the task ended
`completed`, recording the product as "Scented Drops". 24 calls (12 worker, 12
judge), $0.0652 billed. A judge call after every tool round roughly doubles the
call count; on this model it added about a third of the cost.

`max_usd` is checked in the `afterResponse` hook against the task's billed
charges so far, and `max_minutes` against the task's start time. Decided 2026-10-14: billed, accepting a small overshoot. OpenRouter's
billed cost for a turn is readable only about 4 s after the turn ends
(`/generation` 404s until then, `workings.md` §2a), so the check can miss the
last turn or two and a task can end slightly over its cap. The alternative,
estimating from tokens × list price for the cap alone, was rejected: the house
rule is that cost is billed, never calculated, and a cap that bends it would be
the one place two cost figures disagree. Tool charges (Parallel, Trendtrack,
Apify, Firecrawl) are written as each call returns and have no lag.

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

**Startup recovery skips tasks.** Decided 2026-10-14.
`recoverRunsKilledByRestart` ends every unfinished run as `failed` at boot
(`agent/run-supervisor.ts:84-91`). It must skip runs with a non-empty `task_id`:
pi-durable resumes those from their last checkpoint after `harness.resume()`,
and failing them first would end work that is about to continue. Runs without a
`task_id` (today's stages) are recovered as before.

*Superseded 2026-10-14, part 2:* recovery skips any run with a `contract`, not
only one with a `task_id`. A run is written `queued` before its task starts, so
a restart in between leaves a task's run with a contract and no `task_id` yet;
skipping by `task_id` would end it `failed`. Also, `createTask` takes no
`requestId` (submissions do): a session document `mra.tasks`, read and written in
the same commit that creates the task, maps each run to its task, so creating
it twice finds the first.

**The end.** A task ends only through `RunEnd` with its run id, which assembles
the packet from the run's findings and sets the final status, as for every run
today. The reporter task (§6.3) reads that status to tell the operator.

### 6.8 Copying is done by code, by reference

Decided 2026-10-14: **a model never copies content by writing it out token by
token.** When text or data moves from one place to another (a quote into a
finding, a finding into a draft, a gap into a follow-up task, a worker's result
to the operator), the model names it by id and code copies it. Writing it out
again costs output tokens, the most expensive kind, and a model re-typing a
quote can change it without anyone noticing: a dropped "not", a softened claim,
a number off by a digit.

The app already does this in two places: a finding cites a `source_id` (the
sha256 of the archived page) instead of quoting the page, and the review
analysis names quotes by `ref` while code fills in each review's text from the
review ledger (`IssueQuote`, `domain/review-analysis.ts`; `workings.md` §2d, "a
review ledger no model copies from"). The rule extends that to everything:

| What moves | The model writes | Code copies |
|---|---|---|
| a quote from a fetched page into an excerpt | the `source_id` and the numbered paragraphs it quotes, as `web_fetch` returns them (`[p12]`…`[p13]`) | the exact text of those paragraphs from the archived body |
| a review into an analysis or a draft | the review's `ref` | the review's text, star and source from the ledger |
| a finding into a draft (`write`) | a placeholder naming the finding id, for a verbatim quote or a figure | the quote or figure, at render time |
| the gaps of a `partial` task into a follow-up task | the gap ids, as the contract's inputs | the gap descriptions, into the new contract |
| a worker's result to the operator | nothing: the reporter task sends the run id and status | the outcome summary, from the run row |
| feedback into a lesson | the feedback ids | the quoted feedback, onto the lesson card |
| a document into a playbook (`distil`) | the document id and section numbers it cites | nothing: the section stays the source, read on demand |
| a draft for approval (`send_owner`) | the draft id | the draft, onto the card |

Writing new text is still the model's work: a summary, an analysis, a lesson's
rule, an ad's own copy. The rule is only that what already exists is pointed
at, not retyped.

**The one place today that breaks it:** a stage-1 `excerpt` carries a `text`
the agent types (`excerptSchema`, `domain/evidence.ts`), and no check compares
it with the archived page. Part 2 ports the record tools to pi-durable, and the
ported `record_excerpt` takes a `source_id` and paragraph numbers instead of
`text`; `web_fetch` numbers the paragraphs it returns. The stored excerpt keeps
its `text` field, filled by code, so nothing that reads excerpts changes.

*Corrected 2026-10-14, part 2:* stage 1 has no `record_excerpt` tool
(`RECORD_TOOLS`, `agent/prompt/text/record-tools.ts`), so no stage-1 agent can
record an excerpt at all, and there was nothing to port. Part 2 built
`record_excerpt` new, for tasks only (`ExcerptTool`): it takes a `source_id` and
`from`/`to` paragraph numbers, and code fills `text` and a `char_range` locator
from the archived body (`Paragraphs`, `domain/paragraphs.ts`). A task's
`web_fetch` numbers paragraphs `[pN]` (`NumberedPage`); stage runs keep the
plain page.

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
  SQLite storage is I/O, so a small adapter wraps it behind a port: the port
  is `DurableHarness` (`domain/harness.ts`), the adapter `PiHarness`
  (`agent/pi-harness.ts`).
  *Superseded 2026-10-14, part 1:* this said the adapter goes in `adapters/`.
  It cannot: `openNodeSqliteStorage` comes from `pi-durable`, which only
  `agent/` may import, and the `Harness` it returns is a `pi-durable` type. The
  adapter sits in `agent/`, next to the package it wraps, as pi-agent-core's
  `Agent` already does.

### 7.2 The operator

**Switched on per workspace, off by default.** Decided 2026-10-14. A
workspace is one brand. The operator, its watchers and its curator spend money
with nobody watching (model calls, Trendtrack credits, searches), so none of
them runs for a workspace until its owner turns on **Always on** for it, and
turning it on requires a **daily spend cap** in dollars, with no default. While
it is off, the workspace works as the app does today: work starts only when
someone starts it, and no operator conversation or watcher task exists. Turning
it off stops the watchers and the operator's inbox at once; tasks already
running finish, inside their own caps. The switch and the cap are two columns on
`research_workspaces` (`always_on`, `daily_cap_usd`), added by migration. The
default may become "on" once the spend of a few always-on brands is measured.

A long-lived conversation per workspace. A `create_task` whose contract fails
§4 comes back to it as a tool error in the same run. If the transcript drifts,
a `reset` with a handoff note starts it clean.

**The inbox is a router.** What arrives is not handled in arrival order:

- **The owner comes first.** An owner message is submitted with
  `whenBusy: "steer"`, so it joins the running work at the next tool boundary
  instead of waiting behind signals. The lecture's rule: "my message is gonna
  have priority over everything else that's happening".
- **Everything else is batched.** Signals and task reports are follow-ups, and
  the operator conversation uses pi-durable's `followUpMode: "all"`, so a burst
  of five signals becomes one run, not five.
- **Duplicates are dropped.** A signal's `requestId` is its natural key
  (`ads:<brand>:<date>`, `task:<run_id>:ended`), so two watchers reporting the
  same thing, or a restart redelivering it, add one entry.

**When to bother the owner.** The operator speaks to the owner through one
tool, `send_owner`, with a kind: `note` (the feed only, never a notification),
`question`, or `approval` (an inbox card, with an editable draft when what it
approves is irreversible). The dashboard decides how each kind looks, as the
lecture's clients render one "send user" tool richly. The rule the prompt
carries: progress is a note, a decision is a card, and finishing a task is a
note unless the owner asked to be told. The lecture's speaker says his team
does not have this balance right yet; the dashboard counts cards per day per
workspace so it can be measured, and an owner can mute a kind.

*Built 2026-10-14* (`agent/operator/card-desk.ts`, `research_cards`). Where it
differs: `send_owner` has one kind, a **question card** whose answer comes back
to the operator as a message. There is no `note` kind (the operator's own reply
is already a chat line) and no `approval` kind from the operator: approving
starts work, so only code makes approval cards (the Apify check, §4). A paused
task's question (§6.4) is a question card too, answered on the card or in the
chat. Cards are counted per day per workspace on the board; muting a kind is
not built. Measured on the local stack: a plan's product-facts task paused,
its question ("The Droplet site sells many products … which one should I focus
on?") arrived as a card, the answer on the card resumed it, and it ended
`completed`, 22 calls, $0.0475 billed.

**What stays in the prompt, and what does not.** Prompt caching makes the
unchanged start of a request cheap, and pi-durable re-sends a section only when
its text changes, so "a section that returns something different every time
defeats that" (pi-durable README). The lecture goes further: a cache miss is a
bug. So:

- sections hold only what changes rarely, in a fixed order: the operator's
  role, the brand's goals, brand memory, the playbook index;
- what changes with every event never goes in a section. Task reports arrive
  as inbox entries, and `list_tasks` reads the current board on demand;
- tools are fixed for the life of a conversation; nothing is added or removed
  mid-run;
- the cache hit rate is measured per call from the call log (`cacheRead`
  against input tokens, already recorded) and shown per workspace; a drop after
  a deploy is a regression.

**Memory in layers**, following the lecture's split:

| Layer | Held in | Read |
|---|---|---|
| core facts | brand memory (§5.1) | every request, as a section |
| dated work log | one `mra.log` entry per day: what was started, what ended, what the owner decided | on demand, through `search_log` |
| scratch notes | the worker conversation's own document, ending with the task | by that task only |
| everything else | the ledger, past runs, the library | through the tools that read them |

**Compaction while the cache is warm.** Compacting a long conversation is
cheap while its prefix is still cached, and the cache lives only minutes (the
lecture cites 10 to 60; it depends on the model's provider). So when the
operator has been idle for a few minutes and its context is past half the
window, a watcher (§7.3) calls `compact()` then, rather than waiting for the
owner's next message to trigger it at full price. pi-durable's own background
compaction stays on as the backstop.

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
| compaction | the operator conversation: idle a few minutes and past half its window (§7.2) | one summary request, at the cached price |

Hermes refuses to let a cron job create cron jobs, to stop runaway scheduling.
The same rule holds here: workers cannot create tasks or watchers; only the
operator and the owner can.

### 7.4 Limits

Per workspace: tasks running at once (default 3), spend per day (the daily cap
set when Always on is turned on, §7.2), spend per task. `create_task` refuses past the running cap; `mra.money`'s `beforeTool`
hook blocks any paid call past the spend caps and any Apify call without an
approval. The Apify rule is enforced in code, not only written in a prompt.

### 7.5 Untrusted input

Workers read text written by strangers: web pages, Amazon reviews, competitors'
ad copy, and later emails. Any of it can carry a prompt injection ("ignore your
instructions and…"). The lecture's rule is that such input is never treated as
an instruction.

- **External text is data.** Every tool that returns external text returns it
  labelled with its source and as quoted content, never as plain prompt text.
  Today's tools already archive the body and return a `source_id`; the label is
  added in the same place.
- **The operator takes instructions only from the owner.** A signal carries
  structured fields set by code (a brand, a count, a date, a run id), not
  external prose. A worker's report to the operator is its outcome and run id,
  not quoted page text.
- **Nothing irreversible without the owner.** No tool today publishes or sends
  anything outside the app. When one is added (publishing an ad, emailing a
  report), it is an `approval` card with the draft (§7.2), and its calls go
  through a review model before they run, as the lecture's "auto review" does
  for shell commands.
- **Secrets stay out of conversations.** Tokens (Meta, Apify, OpenRouter) are
  read by adapters from settings or the encrypted store, never placed in a
  prompt or a tool result.

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

**Measured, part 1 (2026-10-14).** Nothing broke. After moving both packages
to 1.2.0, `tsc` reported no errors and all 582 server tests passed with no
code change. A url brief on 1.2.0 (`mra run "https://thedropletco.co.uk"
product_data`, run `b544de8c…`, local) ended `completed`: 12 sources, 2
rejected, 14 attributes, 3 gaps; 13 LLM calls, all `stop_reason` `toolUse` as
on the run before the upgrade; 817,573 tokens; $0.0456 billed by OpenRouter
`/generation`, 13 of 13 turns resolved. The
reason is how little of pi the app touches: it imports only `Agent` and its
types from `pi-agent-core`, and from `pi-ai` the package root and
`providers/openrouter`. The breaking changes between the two versions, read
from both changelogs, are all elsewhere:

- pi-agent-core 1.0.0 removed its experimental harness (`AgentHarness`,
  sessions, compaction, skills, the `./node` and `./harness/*` exports),
  which moved to pi-durable. The app used none of it.
- pi-ai 0.99.0 folded image models into the regular `Models` surface; 1.0.3
  renamed the Azure provider; 1.1.0 requires a stream function to return an
  `AssistantMessageEventStream`. The app has no image models, no Azure, and
  `LlmCallLog` wraps pi-ai's own stream rather than writing a stream class.

Additions it now receives unasked: a `durationMs` on each `AssistantMessage`
and tool result. pi-durable 1.2.0 depends on `pi-ai` `^1.2.0`, not exactly
1.2.0 as written above; `npm ls` shows one deduplicated copy. All four pi
packages (`pi-agent-core`, `pi-ai`, `pi-durable`, `chord`) are pinned exactly
in `server/package.json`, so the ones not under the experimental warning are
pinned too: a minor pi-ai bump would otherwise move under pi-durable alone.

### 9.2 What moves, what stays

| Today | On pi-durable |
|---|---|
| `AgentDriver` over pi-agent-core's `Agent` | the harness's generation and tool tasks |
| `AgentTool` objects from `ToolRegistry` | `defineTool` in extensions; same TypeBox schemas from `pi-ai` |
| `RoleDone`'s deliverable check | the primitive's completion check (§3.1) |
| `TurnBudget` | not used by tasks: the step ceiling is one of four breakers (§3.2), counted in `afterResponse`. Stays for today's stages until they are replaced |
| `LimitClose` | unchanged; runs when a task is cut short |
| `LiveRuns`, `EventStream` | watches (§8) |
| `RunEnd` | unchanged; every task still ends through it |
| `recoverRunsKilledByRestart` | skips runs with a `task_id`, which `harness.resume()` continues (§6.7); recovers today's stage runs as before |
| `StageOneRun`, `ProductTruthRun` | kept on pi-agent-core 1.2.0 until each stage is a saved plan whose run matches the stage's |

### 9.3 Backup models

Today `ModelChain` (`agent/model-chain.ts`, `spec_backup_llm.md`) adds
OpenRouter's own fallback list (`models` in the request body) through pi-ai's
`onPayload` hook, and retries a failure mid-answer on the next model. pi-durable
does not pass `onPayload` through: its generation calls
`runtime.models.streamSimple(model, { messages }, options)` with only its own
stream options (`packages/durable/src/harness/generation.ts:431`), and its
retries repeat the same model. Without a replacement, a rate-limited model
stalls a task until a breaker trips (§3.2).

The way in is the `models` object, which this app supplies to the harness.
*Corrected 2026-10-14, part 2:* not a provider: a pi-ai `Provider` has no stream
function (streams are dispatched by API on `Models`). Built as `FallbackModels`
(`agent/fallback-models.ts`), which wraps the `Models` object the harness is
opened with and replaces only `streamSimple`, the one method pi-durable calls on
it; it keys a conversation's failures by the `sessionId` pi-durable sends.
pi-durable retries what pi-ai's `isRetryableAssistantError` accepts. The
original text: a small provider registered in it wraps pi-ai's OpenRouter provider: it adds the
fallback list to every request body, and on pi-durable's retry of a failed
attempt it moves to the next model in the chain. Built and tested in part 2
with the faux provider failing on cue; the chain itself (`MRA_MODEL`,
`MRA_BACKUP_MODELS`) is unchanged.

Billing carries over without such a step: pi-durable's `afterResponse` hook
receives pi-ai's `AssistantMessage`, which carries `responseId`
(`packages/ai/src/types.ts:572`), so the same hook that counts toward the
breakers writes the call-log row and queues the OpenRouter `/generation`
lookup, as `LlmCallLog` and `BilledCosts` do today.

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
formats, or turn a document into a playbook (§5.8).

## 11. The dashboard

`../goal.md` (the parent) says it: the UI is a dashboard where agent actions take
place and the owner follows and steers them, not a chat. Five areas:

1. **Inbox** — what needs the owner: approval cards (money, contracts marked
   `owner`), questions from `ask_owner`, lessons to approve.
2. **Work** — the task graph as a board by status, each task opening into its
   worker conversation: agent turns, tool lanes, costs. A `partial` task shows
   its findings with its gaps highlighted, each with why it stopped (§3.2).
3. **Knowledge** — the ledger by node (today's tiles); brand memory as a list
   the owner can add to, edit and delete from, each change a version (§5.4); and
   the library: uploaded documents and playbooks, with versions and their
   numbers.
5. **Always on** — per workspace, the switch and its daily cap (§7.2), with
   today's spend against the cap.
4. **Feed** — the operator's notes and the live stream, in words.

A message box exists, as one way to put something in the operator's inbox, not
as the main surface.

*Superseded 2026-10-14:* chat is the way the owner guides the work, beside the
dashboard; a button starts it. Decided with the owner:

1. **Start proposes, it does not run.** Start on a brief shows a **saved plan**
   for that brief: a list of task contracts, each with its objective, what done
   means, an estimated cost, and a flag on any that would spend Apify money. No
   model writes it, so it is free and the same every time. Nothing runs until
   **Approve**.
2. **The plan is edited with toggles and chat.** Each task has a checkbox to
   drop it. Anything else (scope, market, a task the plan lacks) is said in chat,
   and the operator rewrites the plan, which is shown again for approval.
3. **Chat talks to the operator only.** One voice and one memory: the owner's
   message goes to the operator with `whenBusy: "steer"` (§7.2); the operator
   steers, cancels or adds tasks and reports back. A new task the operator adds
   comes back as a plan to approve when it spends money. The operator's
   questions (`send_owner`, kind `question`) and approvals appear in the chat.
4. **Apify spend is approved by a button, always.** Decided 2026-10-14 with the
   owner. No chat message, operator tool or saved plan starts anything that
   spends Apify money; it reaches the owner as something to approve with a
   button. Until that approval exists for tasks, `ContractCheck` refuses any
   task with Apify in reach, so none can be queued.

*Built 2026-10-14, part 3.* Where it differs from the above:
- Plans are research-store records (`research_plans`), not harness state:
  they are what the owner sees and approves, and §6.2 keeps the harness to its
  own state.
- A plan shows each task's **spend cap**, not an estimate: there is no cost
  model yet, and a cap is the one figure that holds.
- The operator answers in the chat itself; there is no separate `send_owner`
  tool yet. Its tools are `list_work`, `revise_plan` (market, drop, keep, add a
  saved task), `stop_task` and `guide_task`; none starts work. Approvals and
  finished tasks are written into its transcript as notes, with no model call.
- The stream is `GET /api/research/workspace/stream`, not
  `/api/workspace/stream`. Its chat frame comes from the operator
  conversation's watch; its board frame is read from the research store every
  2 s, because a task's progress (its rows, its calls, its status) is written
  there, not to the task graph.

## 12. Plan, in parts that each ship on their own

| Part | Builds | Proves |
|---|---|---|
| 0 | Document library (§10) | **done** |
| 1 | `pi-agent-core` and `pi-ai` to 1.2.0 (§9.1); pi-durable installed, pinned; a harness opened in `main.ts` on `/data/harness.sqlite`, resumed at start, closed on stop; nothing runs on it yet | today's stages still pass `mra check` and one url brief on 1.2.0; the harness survives `mra down` / `mra up` |
| 2 | One worker primitive (`research`) as extensions; a run row per task with its three new columns (§6.7); a durable worker task running a hand-written contract through `onYield` (§6.4); `RunEnd` at its end; the four breakers and the `partial` status, for tasks and today's stage runs (§3.2); startup recovery skipping tasks (§6.7); external text labelled as data (§7.5); backup models (§9.3); `record_excerpt` by reference (§6.8); details in §12.1 | **done 2026-10-14** (§12.2) |
| 3 | **done 2026-10-14** (§12.3). **Start, review, chat** (§11, decided 2026-10-14): Start shows a saved plan as task contracts with costs; toggles and Approve queue them; the operator conversation (§7.2) with `create_task`, `cancel_task`, steering a task, and `send_owner` questions, behind a chat panel; the workspace stream (§8) so the board and the chat update live. Until part 4 the saved plan holds what `research` can do: product facts and category numbers | the owner starts a brief, approves a plan, changes it by chat, and watches it run to its end |
| 4 | **Stage 1 as a plan built 2026-10-14** (§12.4); the other primitives are not. The other primitives; stage 1 as a saved plan of four tasks with child-task waiting | a stage-1 plan's result matches a `StageOneRun`'s on the same brief |
| 5 | Feedback events (§5.2) and the inbox cards | the owner's actions are recorded against what they were about |
| 6 | Reviewer as a fork, lessons, the gate, playbook versions, the editable brand-memory list (§5.3–5.4, §6.6); eval cases from invalid tasks and corrections, and the replay suite (§5.7) | a correction given once produces a lesson; approved, the next task reads it |
| 7 | The Always on switch and daily cap, the operator's router for signals, stable sections, work log and warm-cache compaction (the operator conversation itself moved to part 3); `create_task`, `mra.money`, the schedule watcher | the system starts work nobody clicked, inside its limits; the operator's cache hit rate holds across a day |
| 8 | `write` and `critique` primitives; the long-form statics playbook | an ad draft that cites its findings |
| 9 | Measurement per playbook version (§5.5), curator watcher (§5.6), `distil` (§5.8) | a lesson that hurt is visible with numbers |
| 10 | Ad-results feedback (`docs/plan-meta-integration.md` Phase D; its Phases A–B start alongside parts 1–2, because Meta's App Review needs a reader already running), competitor and review watchers | the loop closes on real ad performance |

### 12.1 Part 2 in detail

Decided 2026-10-14.

- **Starting a task:** `POST /api/research/tasks` takes a contract, writes the
  run, creates the task, and answers `202` with the run id. `mra task
  contract.json` starts one and follows it to its end.
- **The contract check:** vocabulary, shape, inputs exist, and budget (§4).
  The money check waits for a primitive that can reach Apify; `research`
  cannot.
- **Watching it:** findings, gaps and costs on today's run view once the task
  ends, and progress through `mra`. Live tool lanes for a task come with part
  3: today's live view reads events that pi-agent-core's agent emits, and a
  pi-durable task does not emit them.
- **Backup models and billing:** §9.3.
- **Copy by reference:** the ported `record_excerpt` takes paragraph numbers,
  and `web_fetch` numbers its paragraphs (§6.8).
- **The restart test:** a test opens the harness on a temporary SQLite file,
  closes it mid-task, reopens it, and checks the task ends with its earlier
  findings intact; on the real app, `mra down` and `mra up` during the one run.

### 12.2 Part 2, built

Measured 2026-10-14 on the local stack, `docs/tasks/droplet-product-data.json`
(the product deliverable as a contract, url brief, budget $0.50 / 20 min):

- **A restart mid-task resumes it.** Run `ab1535f0…`: calls 1–4 ran, three
  sources were recorded, then `mra down` / `mra up` at 11:05:39 UTC. The new
  process logged `harness reopened at /data/harness.sqlite; 1 task(s) to pick
  back up`, the run stayed `running`, call 5 started at 11:05:41, and the run
  ended `completed` after 14 calls with its first three sources still rows 1–3;
  $0.0753 billed, 14 of 14 calls read back. The first call after the restart
  logs the whole conversation as its input again: `TaskCallLog` counts what it
  has logged in memory.
- **The same contract, no restart.** Run `963a7c7d…`: `completed`, 13 calls,
  every row written by `research`, $0.0512 billed.
- **Found by the first run and fixed:** settlement closed a phantom `product`
  part on a task's run (the stage plan's agent, not the task's), writing a
  `product` gap and an `incomplete` node status. Settlement now takes the run's
  own roles (`StageOneParts`).
- **Step ceiling.** Both runs used 13–14 of the `research` primitive's 30
  responses; the ceiling stays at 30 until more tasks have run.
- **Today's stages on part 2.** A url brief on `product_data` (`60109d85…`)
  ended `completed` in 9 calls, its pages shown to the model labelled as data;
  $0.0453 billed.

### 12.3 Part 3, built

Measured 2026-10-14 on the local stack, through the routes the page calls (the
browser could not be driven from here, so the page itself was built and
typechecked, not watched):

- `POST /plans` for thedropletco.co.uk returned a draft with both saved tasks
  kept; no run was created.
- Chat "Just the product facts for now please, and keep it to the UK." reached
  the operator, which called `revise_plan` (drop `category_numbers`, market
  `UK`) and answered "Done — the plan is now UK-only with just product facts;
  category numbers are dropped." The plan changed; it stayed a draft.
- Approve (`202`) started one task, which ended `partial` on the no-progress
  breaker (see §3.2, corrected). After the fix, a second plan, toggled to
  product facts and approved, ended `completed`: 12 calls, 7 sources, 10 facts,
  3 gaps, UK, $0.0409 billed. The operator's transcript holds a note for the
  plan, its approval, and each task's end.

### 12.4 Part 4, stage 1 as a plan, built

Start proposes stage 1's four roles as plan tasks; a contract's `method` (a
stage-1 role) makes a task work as that role does. Where it differs from the
plan above:
- **No child tasks.** The plan orders its tasks in code: approving starts the
  ones with nothing to wait for, and `PlanRelease` starts the rest when the
  champion's run ends (and, at startup, any it missed). pi-durable's
  `waiting`/`on` would hold the order inside the harness, but the tasks are
  separate runs that also wait on approval cards, which the harness does not
  see.
- **Separate ledgers, copied inputs.** Each task is its own run, so the
  champion's reference, its gaps and the page it cites are copied into each
  task that needs them (`TaskInputs`), by reference (§6.8).
- **The champion is the plan's, not the owner's.** It is kept exactly when
  `StageOnePlans` would run one, and has no node of its own
  (`ChampionRunAssembly`).
- **Not measured against a `StageOneRun`.** The proof row above is not met: no
  stage-1 plan with a champion has run live, because the champion and
  competitors spend Apify money and need the owner's go-ahead. Measured live
  without Apify: product facts (`e2bfccd0…`, `completed`, 10 sources, 11 facts)
  and category numbers (`ff505816…`, `partial` at its 15-turn limit) as stage
  roles. The product task's judge asked which product although the brief was
  the product's own page: the judge was not shown the brief. It is now
  (`TaskJudge.brief`), not yet seen live.
- The other primitives (`evidence`, `ad_scan`, `review_mine`, `analyse`) are not
  built (`gaps.md`).

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
- **Ad results:** Meta first, planned in `docs/plan-meta-integration.md`.
  Decided 2026-10-14: the operator is opt-in per workspace with a required daily
  cap (§7.2), and brand memory is visible and editable from day one (§5.4).

## 14. What the CS146S lecture changed

Read 2026-10-14: the Stanford CS146S lecture "How always-on agents work", by
an engineer building an always-on agent at SpaceX
(`docs/Stanford-CS146S-How-always-on-agents-work.txt`).

**Already in this spec, and confirmed:** an agent loop on a server with state
saved to storage (§7.1); a durable workflow, not a job queue, under every
helper (§6.1); helpers as sub-agents with their own context, reporting back
only results (§2, §6.3); triggers other than the user (§7.3); skills and
memory as files read on demand (§5.1, §6.5); a thin client subscribed to the
server's changes (§8).

**Changed:**

| Lecture point | What it changed here | Section |
|---|---|---|
| A message from the user has priority over everything; several queued messages become one turn; a router dedupes | Owner messages steer; signals are batched with `followUpMode: "all"`; signals carry a natural-key `requestId` | §7.2 |
| The agent knows when to stay quiet; one "send user" tool, rendered richly by each client | One `send_owner` tool with kinds; progress is a note, a decision is a card; cards per day are counted | §7.2 |
| Keep tool definitions and the system prompt static; fixed section order; a cache miss is a bug | Volatile state left the operator's sections for inbox entries and `list_tasks`; no tool changes mid-run; cache hit rate measured | §6.3, §7.2 |
| Compact while the cache is still warm | A compaction watcher compacts an idle operator before its cache expires | §7.2, §7.3 |
| Memory in layers: core facts, dated logs, scratch notes, everything else in files | Brand memory, `mra.log` with `search_log`, per-task notes, the ledger and library | §7.2 |
| Try the cheapest source first; ask the user last | The cheapest-source ladder for workers and the operator | §3 |
| Fast model for the main agent, slow is fine for helpers | Models chosen by role | §6.3 |
| Untrusted input is never an instruction; auto-review before irreversible actions; keep secrets out of the conversation | Untrusted input rules | §7.5 |
| Failures become evals; fix, check, ship | The eval loop | §5.7 |
| Build as little as possible; the models are the worst they will ever be | Stated as the reason pi-durable is used rather than built | §6.1 |

**Not taken, and why:** a cloud computer per agent, with a browser and a
desktop, for sites with no API. Research here reads pages through Parallel,
Firecrawl and crawl4ai, and the browser work that exists has its own spec
(`spec-browser-harvest.md`). Triggers from Slack, email and meetings: the
owner reaches the operator through the dashboard for now. Training the model on
the harness: this app uses models through OpenRouter and does not train them.
