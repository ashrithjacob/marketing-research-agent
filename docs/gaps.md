# Gaps in what is built

Known gaps in the always-on work on the `ubiquitous` branch (parts 1–3 and the
`stop_when` judge, `docs/spec-always-on.md`). Each was checked against the code
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
7. **The category-numbers task has never run for real.** No run in the local
   store has a `category_data` contract. Needs: one real run before it is shown
   to anyone.

8. **Cards cannot be muted, and show only on a plan page.** Spec §7.2 lets the
   owner mute a kind; not built. The cards list sits on the plan page, so a card
   raised while no plan page is open is seen the next time one is.

9. **Part 4 built stage 1 as a plan, not the other primitives.** `evidence`,
   `ad_scan`, `review_mine`, `analyse` (spec §3) are not tasks yet: product truth
   and review mining still run only as stage runs. Stage 1's four roles are tasks
   through a contract's `method`.
10. **Two writers can save one plan at once.** `PlanRelease` (a champion ended)
    and `CardDesk` (an approval pressed) each read a plan, change one task and
    save it whole; if both happen together, the later save drops the other's
    change. Needs: saving one task of a plan, not the whole plan.

## Outside the code

- **Nothing is deployed.** Parts 1–3 are only on the `ubiquitous` branch and the
  local stack; marketing.vanis.ai runs the old code. The harness backup step in
  `deploy/vps/mra-snapshot.sh` has not run on the VPS.
- **`../setup.md` is not in any commit.** It sits outside this repository.
- **No one has clicked through the new pages in a browser end to end.** The
  routes behind them were run live; the pages were built and typechecked, and the
  owner has opened the plan page once.
