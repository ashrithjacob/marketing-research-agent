# Gaps in what is built

Known gaps in the always-on work on the `ubiquitous` branch (parts 1–4, the
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
   through a contract's `method`.
10. **Two writers can save one plan at once.** `PlanRelease` (a champion ended)
    and `CardDesk` (an approval pressed) each read a plan, change one task and
    save it whole; if both happen together, the later save drops the other's
    change. Needs: saving one task of a plan, not the whole plan.

11. **Feedback covers sources, not single findings.** A finding can be rejected
    only through its source ("wrong?" beside a citation); spec §5.2 also lists
    rejecting a finding itself. Nothing reads feedback yet (part 6).

## Built but not seen live

The owner asked on 2026-10-14 for no more live runs; these are covered by tests
against the faux model only.

- **A stage-1 plan with the champion.** The champion and competitors spend
  Apify money, so none has run: not the approval cards' Approve, not
  `PlanRelease` handing the champion's rows on, and not the check that a plan's
  result matches a `StageOneRun`'s on the same brief (spec §12, part 4).
- **The judge reading the brief** (`TaskJudge.brief`), added after a live task
  asked which product although its brief was that product's page.
- **Feedback and the inbox.** Recorded and listed in tests; the routes answer on
  the local stack, but no action has been taken there to record one.
- **A category-numbers task finishing.** Its one run hit the stage role's
  15-turn limit (gap 7); whether tasks need a higher ceiling is open.

## Outside the code

- **Nothing is deployed.** Parts 1–4 are only on the `ubiquitous` branch and the
  local stack; marketing.vanis.ai runs the old code. The harness backup step in
  `deploy/vps/mra-snapshot.sh` has not run on the VPS.
- **`../setup.md` is not in any commit.** It sits outside this repository.
- **No one has clicked through the new pages in a browser end to end.** The
  routes behind them were run live; the pages were built and typechecked, and the
  owner has opened the plan page once.
