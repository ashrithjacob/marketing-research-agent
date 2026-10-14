# Always on — spec

**Status:** plan, 2026-10-12. Part 0, the document library, is built (§9). Nothing
else here is built. **Parents:** `docs/goal.md` (the north star), `workings.md` (how a
run works today), `spec-research-agent-factory.md` (roles as data, which this
generalises). **Borrowed from:** hermes-agent's learning loop,
`../hermes-agent/agent/background_review.py`, `agent/curator.py`, and the docs
`website/docs/user-guide/features/{memory,skills,curator}.md`.

## 1. The problem

Today the cockpit is conventional software. The owner clicks **Start run**,
picks a stage, and waits 13 minutes (median stage-1 run, `spec-platform-move.md`)
for a fixed pipeline to finish. Then nothing happens until they click again.
Three things follow from that shape:

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

## 2. What "always on" means

A standing **operator** per workspace (one brand). It holds the brand's goals
and runs a loop that never ends:

```
            ┌───────────────────────── inbox ─────────────────────────┐
            │ owner message · schedule tick · watcher signal · task   │
            │ done · task failed · feedback · document added          │
            └──────────────────────────────┬──────────────────────────┘
                                           ▼
                          operator turn (one LLM turn, short)
                 reads: goals, open tasks, ledger summary, playbooks
                writes: tasks, each with a contract  ─or─  a question
                                           │
               ┌───────────────────────────┼───────────────────────────┐
               ▼                           ▼                           ▼
        task (primitive +           approval card              message to owner
        contract), queued           (money, or a judgement)
               │
               ▼
        worker runs it: an agent built from the primitive,
        checked against the contract by code, streaming events
               │
               ▼
        task ends through RunEnd ──► inbox ("task done") ──► operator again
               │
               └──► learning loop: reviewer reads the task + any feedback,
                    stages lessons; the owner approves; playbooks change
```

The operator plans; it never researches. Workers research; they never plan
beyond their own task. Code checks both.

Nothing here waits on a request. A browser opens one stream per workspace and
sees every part of this as it happens (§7).

## 3. Primitives

A **primitive** is a kind of worker: an agent template with a fixed tool set and
a fixed way of recording what it finds. It is today's `RoleSpec` without the
deliverable, which moves to the contract (§4).

| Primitive | Tools | Records | Spends | Exists today as |
|---|---|---|---|---|
| `research` | `web_search`, `web_fetch`, `library_read` | findings of the kinds its contract names | Parallel, page reading | the stage-1 `product`/`category` roles |
| `evidence` | `evidence_search`, `evidence_fetch`, `library_read` | findings with study citations | Parallel | the stage-2 roles |
| `ad_scan` | `ad_library_search`, `web_fetch` | ads, angles, landing pages | Trendtrack | part of `category`/`competitors` |
| `review_mine` | none: a code pipeline | reviews into the review ledger | **Apify** | stage 3 (`ReviewMiningJob`) |
| `analyse` | ledger reads, `library_read` | derived findings that cite ledger rows, not pages | LLM only | the review analyst (`ReviewAnalyst`) |
| `write` | ledger reads, `library_read` | drafts (an ad, a brief, a report) that cite findings | LLM only | nothing yet |
| `critique` | ledger reads, `library_read` | a verdict on another task's output, against named criteria | LLM only | nothing yet |
| `ask_owner` | none | a question card; the answer comes back as feedback | nothing | `steer`, in reverse |

Rules:

- **The set is closed and lives in code.** The operator picks a primitive by
  name; it cannot invent one. A new primitive is a code change with tests, as a
  new tool is now (`ToolRegistry`).
- **A primitive is built by `ResearchAgentFactory`**, which already builds any
  role from data. The change is that its `RoleSpec` is assembled at task time
  from `primitive + contract` instead of read from `ROLE_SPECS`.
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
3. **A curator** (`agent/curator.py`). Runs when the agent has been idle,
   counts how often each skill is used, marks unused ones stale and then
   archives them, can merge near-duplicates, snapshots the library first, and
   keeps a ledger of every change so any one can be rolled back.

Hermes's skills are markdown files the agent reads on demand: a short index
always in the prompt, the body loaded when needed. Its `/learn` turns a whole
book into one such skill, a short `SKILL.md` and one reference file per chapter.

This app takes the same three parts, adapted to a product with an owner who is
not a developer and a domain where a wrong lesson costs ad money.

### 5.1 What is learned, and where it lives

| Store | Holds | Read by | Example |
|---|---|---|---|
| **Brand memory** | facts about this brand and this owner | the operator, every worker, as a block in the prompt | "Owner does not want comparisons to named competitors in ads." |
| **Playbooks** | how to do a class of task: steps, rules, pitfalls | workers of the primitive the playbook names, through `library_read` | "When mining reviews for a sleep supplement, the 3-star band holds the objections; read it first." |
| **Judgements** | standing rules about sources and weighting | unchanged from today | "Reject affiliate review sites." |

Playbooks are markdown documents in the library (§9), marked as playbooks, with
a primitive they apply to. That makes the library one place for the owner's
uploaded PDFs and the system's own learned methods, read the same way.

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

After a task ends, and after any feedback event, a **reviewer** runs: an
`analyse`-shaped agent with read access to the task's events, its contract, the
feedback, and the playbooks the task read. It may only **propose**:

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

An uploaded PDF is read as it is (§9). The next step, borrowed from hermes's
`/learn`, is a `distil` task: an `analyse` worker reads a document and proposes a
playbook (a short rule sheet plus one section per chapter) as a lesson, through
the gate. The PDF stays the source; the playbook cites its sections. Not built.

## 6. The runtime

### 6.1 Durable tasks

A restart today kills every live run (`recoverRunsKilledByRestart` ends them
`failed`). An always-on system restarts on every deploy, so work must survive
one:

- A `tasks` table: id, workspace, contract, status (`queued`, `running`,
  `awaiting_approval`, `completed`, `invalid`, `failed`, `cancelled`), lease
  (worker id and expiry), attempts, parent task, created/updated.
- A worker loop in the process claims a queued task by taking its lease in one
  `UPDATE … WHERE lease is free`, which works on both SQLite and Postgres.
- A task's progress is its findings, which are written as found (the findings
  ledger already is). A task resumed after a restart starts a new agent with the
  ledger it left, the way `LimitClose` already reads a ledger to say what is
  missing. It does not replay the conversation.
- Every task ends through `RunEnd`. The `run-ends-in-one-place` convention
  extends to tasks.

If the move to Convex (`spec-platform-move.md`) goes ahead, its Workflow
component replaces the table and the lease loop; contracts, primitives and the
learning loop do not change. Nothing in this spec should wait on that decision.

### 6.2 The operator

One LLM turn per inbox batch, not a long conversation, so it can run on every
event without growing a context. Its input is assembled fresh each turn: the
brand's goals, brand memory, open and recently ended tasks with their contract
results, a summary of the ledger by node, and the playbook index. Its tools:
`create_task` (with a contract), `cancel_task`, `ask_owner`, `note` (a line in
the owner's feed). Its output is checked like any other: a `create_task` whose
contract fails §4 comes back to it as a tool error in the same turn.

### 6.3 Watchers

Code, not agents, decides when something changed, and posts a signal to the
inbox. Each is a scheduled check that costs little:

| Watcher | Checks | Cost |
|---|---|---|
| competitor ads | Trendtrack: new ads from tracked brands since last check | Trendtrack credits; daily |
| reviews | review counts of tracked listings | free where read from the stored listing; Apify only by approval |
| schedule | the owner's cadence ("refresh market truth monthly") | none |
| ad results | the owner's ad account, once connected | none |

### 6.4 Limits

Per workspace: tasks running at once (default 3), spend per day, spend per
task. A task that would cross a limit waits as `awaiting_approval`. The Apify
rule is enforced here in code, not only written in a prompt.

## 7. Everything async, everything streaming

One rule: **no request waits for work.** A request that starts work answers
`202` with the id of what it started, and the work reports through a stream.

- **One stream per workspace**, `GET /api/workspace/stream?after=<id>`,
  Server-Sent Events. It carries every event of every task, the operator's
  notes, approval cards, lesson cards and library progress, each with an id.
  Replay from `after`, then follow live, subscribing before replaying, exactly
  as `http/event-stream.ts` does per run today.
- The per-run stream stays for the run view, and becomes a filter of the
  workspace stream.
- Events are stored before they are sent, so a browser that reconnects misses
  nothing. Token-level text deltas are the exception: sent live, not stored,
  because a stored delta per token would be most of the table.
- Caddy needs `flush_interval -1` on the route, as for runs (`../setup.md`).

The document library (§9) already works this way: upload returns `202`, and
conversion streams one event per page.

## 8. The dashboard

`../goal.md` (the parent) says it: the UI is a dashboard where agent actions take
place and the owner follows and steers them, not a chat. Four areas:

1. **Inbox** — what needs the owner: approval cards (money, contracts marked
   `owner`), questions from `ask_owner`, lessons to approve.
2. **Work** — tasks as a board by status, each opening into today's run view
   (agent tabs, tool lanes, costs).
3. **Knowledge** — the ledger by node (today's tiles), brand memory, and the
   library: uploaded documents and playbooks, with versions and their numbers.
4. **Feed** — the live stream, in words.

A message box exists, but as one way to put something in the inbox, not as the
main surface.

## 9. Part 0, built: the document library

Built 2026-10-12. What it does, end to end:

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

## 10. Plan, in parts that each ship on their own

| Part | Builds | Proves |
|---|---|---|
| 0 | Document library (§9) | **done** |
| 1 | Workspace stream (§7); runs and library publish to it | one stream carries everything |
| 2 | `tasks` table, worker loop, leases; today's stages enqueued as tasks | a deploy mid-run does not lose the run |
| 3 | Contracts (§4): zod schema, contract check, `ResearchAgentFactory` builds from `primitive + contract` | a hand-written contract runs and is enforced like a stage |
| 4 | Feedback events (§5.2) on findings and drafts; the inbox | the owner's actions are recorded against what they were about |
| 5 | Reviewer, lessons, the gate, playbook versions (§5.3–5.4) | a correction given once produces a lesson; approved, the next task reads it |
| 6 | The operator (§6.2) and the schedule watcher | the system starts work nobody clicked |
| 7 | `write` and `critique` primitives; long-form statics playbook | an ad draft that cites its findings |
| 8 | Measurement per playbook version (§5.5), curator (§5.6), `distil` (§5.7) | a lesson that hurt is visible with numbers |
| 9 | Ad-results feedback, competitor and review watchers | the loop closes on real ad performance |

## 11. Risks and open questions

- **The operator over-plans.** An LLM that may create tasks will create too
  many. Limits (§6.4) bound the cost; the measurement that matters is tasks
  created per useful finding, shown on the dashboard from part 6.
- **Lessons from one bad day.** A lesson is only as good as the feedback behind
  it. The gate (§5.4) and version measurement (§5.5) are the defence; whether
  owners will actually review lessons is untested.
- **Contracts the model writes badly.** The contract check refuses impossible
  ones but not pointless ones. `verify: owner` for anything new is the
  defence until there is data.
- **Open — yours:** should the operator run for every workspace, or only those
  that switch it on? Which ad account (Meta first?) for outcome feedback? Is
  brand memory visible to and editable by the owner from day one?
