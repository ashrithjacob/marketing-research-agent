# Gaps in what is built

Known gaps in the always-on work on the `ubiquitous` branch (parts 1–8, the
`stop_when` judge and cards, `docs/spec-always-on.md`). Each was checked against the code
or the local store on 2026-10-14. When one is closed, strike it through with the
commit that closed it; do not delete it.

## Small, in what is already built

1. **Plans are not listed anywhere.** The only link to a plan page is the
   redirect after Start (`frontend/src/App.tsx`, `navigate(paths.plan(plan.id))`).
   Leave the page and only its URL gets you back. Needs: a list of recent plans
   (the products page, or the header).
2. **Stop on a task's run page fails.** The header's Stop calls
   `POST /api/research/runs/:id/stop`, which looks the run up among this
   process's live stage runs and answers "run … is not running here"
   (`agent/live-runs.ts`, `controllable`). A task stops only through the chat
   (`stop_task`) or `POST /api/research/tasks/:runId/stop`. Needs: Stop to call
   the task route when the run has a contract.
3. **A running task's run page does not update live.** The per-run event stream
   follows only stage runs held in `LiveRuns`; for a task it sends the stored
   events and ends with "not live" (`http/event-stream.ts`). The plan page does
   update live. Needs: for a task's run, keep reading new events from the store
   until it ends.
4. **The chat is not filtered to the plan on screen.** There is one operator
   conversation per workspace, and the chat shows all of it, so one plan's page
   shows another plan's conversation. Needs: lines tagged with their plan, and
   the page showing its own.
5. **A wrong `MRA_JUDGE_MODEL` silently turns the judge off.** `TaskJudge`
   returns "go on" when the model id is not in OpenRouter's catalogue, so a task
   with a `stop_when` never pauses. Needs: a task with a `stop_when` refused at
   approval, as stage runs refuse an unknown `MRA_MODEL`.
6. **"Approve … · up to $1.00" reads as a price.** It is the kept tasks' spend
   caps added together (`frontend/src/PlanCard.tsx`); measured product-facts
   tasks cost $0.04–0.07. Needs: a label that says it is a cap.
7. ~~**The category-numbers task has never run for real.**~~ Closed 2026-10-14:
   run `ff505816…` (stage-1 `category` role, as part 4's plan task) ended
   `partial` at its 15-turn limit with 12 sources, 10 facts, 11 measurements and
   2 gaps, $0.0723 billed. It ran out of turns rather than finishing; whether 15
   is enough for a task (the stage role's limit) is open.

8. **Cards cannot be muted.** Spec §7.2 lets the owner mute a kind; not built.
   (Cards showing only on a plan page was closed by part 5's inbox, `/inbox`.)

9. **Part 4 built stage 1 as a plan, not the other primitives.** `evidence`,
   `ad_scan`, `review_mine`, `analyse` (spec §3) are not tasks yet: product truth
   and review mining still run only as stage runs. Stage 1's four roles are tasks
   through a contract's `method`. **When `review_mine` becomes a task it must go
   through `ReviewReuse` before any Apify pull**, as stage-3 runs do today: a
   stored pull of the same listing and star band, younger than
   `MRA_REVIEW_REUSE_DAYS`, answers it and nothing is paid (checked 2026-10-14:
   no review-mining file changed since part 1, and its reuse tests pass).
10. **Two writers can save one plan at once.** `PlanRelease` (a champion ended)
    and `CardDesk` (an approval pressed) each read a plan, change one task and
    save it whole; if both happen together, the later save drops the other's
    change. Needs: saving one task of a plan, not the whole plan.

11. **Feedback covers sources, not single findings.** A finding can be rejected
    only through its source ("wrong?" beside a citation); spec §5.2 also lists
    rejecting a finding itself. Nothing reads feedback yet (part 6).

12. **Part 6 left out the evals and replay suite (spec §5.7) and playbook
    versions.** Lessons change brand memory only; there are no playbooks yet.
13. **The reviewer's and the operator's model calls are not in the call log or
    billed.** They run on the harness outside any research run, so no
    `research_llm_calls` row or `/generation` lookup records them. The house rule
    is that every dollar is billed and shown. Needs: a log for spend that belongs
    to a workspace, not a run.
14. **Today's stage runs do not read brand memory.** Only tasks and the operator
    do (as a prompt section). A stage run's prompt has no memory block.

15. **Part 7 left out the operator's work log, warm-cache compaction and cache
    hit-rate measurement.** No `mra.log` entries or `search_log` tool; the
    compaction watcher is not built (pi-durable's own background compaction is
    the only one); the cache hit rate cannot be measured until the operator's
    calls are logged (gap 13). Spec §12's proof for part 7, "the operator's
    cache hit rate holds across a day", is not met.
16. **Only the schedule watcher exists.** The competitor-ads, reviews and
    ad-results watchers of §7.3 are later parts (10).
17. **The money gate reads today's spend on every paid tool call.** Each paid
    call scans the day's runs, charges and calls; fine at today's volume, slow
    for a busy workspace. Needs: a running total, or a short cache.
18. **`create_task` starts only product facts and category numbers.** A task that
    waits on the champion or reaches Apify always becomes a draft plan, even
    with Always on; a whole stage-1 plan cannot be started unattended.

19. **A playbook is code, written by hand from the library document.** Spec §5.1
    has playbooks distilled from the owner's documents and versioned (§5.5);
    `long_form_static` is one entry in `domain/playbooks.ts`, and the writer
    reads the document itself through the library tools only when the library
    has it. No other playbook exists, and the route accepts only write playbooks.
20. **A draft does not know its plan.** `research_drafts` has the write run, not
    the plan; the plan card's "The writer started" is page state and is gone on
    reload. Drafts are found through the inbox list and the approval card.
21. **The critic's verdicts do not reach the writer.** A criterion not met is
    shown to the owner; nothing rewrites the draft with it.
22. **The owner's edits are not checked.** `DraftDesk.edit` saves any text, so an
    edit can type a figure or cite an id that is not a finding; and the edit box
    shows the raw `[[id]]` and `{{id}}` markup.
23. **The operator cannot start a write.** Only the plan card's button does;
    `create_task` knows the saved research tasks only.
24. **The writer's inputs are not chosen.** Every citable row of the plan's
    delivered runs, in plan order, cut at 80; nothing ranks them by use to an ad.

## Built but not seen live

The owner asked on 2026-10-14 for no more live runs; these are covered by tests
against the faux model only.

- **A stage-1 plan with the champion.** The champion and competitors spend
  Apify money, so none has run: not the approval cards' Approve, not
  `PlanRelease` handing the champion's rows on, and not the check that a plan's
  result matches a `StageOneRun`'s on the same brief (spec §12, part 4).
- **The judge reading the brief** (`TaskJudge.brief`), added after a live task
  asked which product although its brief was that product's page.
- **Always on.** Work started by a due schedule, `create_task` within the limits,
  the money gate and signals are tested against the faux model; on the local
  stack the routes answer and Always on reads off, but it has not been switched
  on there.
- **The learning loop.** A correction becoming a lesson, approved and read by
  the next task, is tested against the faux model; the reviewer has not run on
  a real model.
- **Feedback and the inbox.** Recorded and listed in tests; the routes answer on
  the local stack, but no action has been taken there to record one.
- **A category-numbers task finishing.** Its one run hit the stage role's
  15-turn limit (gap 7); whether tasks need a higher ceiling is open.

- **A draft written by a real model.** The write → critique → owner flow, the
  typed-figure refusal and owner edits are tested against the faux model; on the
  local stack the draft routes answer (`/drafts` lists none) but no draft has
  been written.

## Outside the code

- **Nothing is deployed.** Parts 1–8 are only on the `ubiquitous` branch and the
  local stack; marketing.vanis.ai runs the old code. The harness backup step in
  `deploy/vps/mra-snapshot.sh` has not run on the VPS.
- **`../setup.md` is not in any commit.** It sits outside this repository.
- **No one has clicked through the new pages in a browser end to end.** The
  routes behind them were run live; the pages were built and typechecked, and the
  owner has opened the plan page once.
