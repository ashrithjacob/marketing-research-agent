import { STAGE_NODES, RunStatuses, Scope, TERMINAL_STATUSES, runRequestSchema, stagePacketSchema, type Plan, type PlanStage, type ResearchStore, type RunRequest } from "../../domain/index.js";
import { ReviewMiningRoster } from "../../extract/index.js";
import { Trace } from "../../trace/index.js";

import { AMAZON_REVIEWS_ACTOR, AMAZON_SEARCH_ACTOR, UNIT_PRICE_USD } from "../../adapters/apify/actors.js";
import type { LiveRuns } from "../live-runs.js";
import type { TaskEvents } from "../task/task-events.js";

import { PlanStageOne } from "./plan-stage-one.js";

/** A plan past stage 1: once every kept stage-1 task has ended, its tasks are combined into one stage-1 run; product truth then starts on it when ticked, and review mining, when ticked and product truth delivered, waits on the owner's approval card. Each step moves on when the run before it ends, and again at startup for any a restart missed. */
export class PlanStages {
  static readonly BANDS = 5;
  static readonly WAITING = "waiting for your approval: it spends Apify money";
  private readonly queue = new Map<string, Promise<void>>();

  constructor(
    private readonly deps: { store: ResearchStore; runs: LiveRuns; start: (request: RunRequest, workspaceId: string) => Promise<string>; reviewsPerBand: number; reuseDays: number },
    events: TaskEvents,
  ) {
    Trace.line(import.meta.url, "PlanStages.constructor");
    events.on((runId) => this.moved(runId));
    deps.runs.onEnd((runId) => this.moved(runId));
  }

  async recover(): Promise<number> {
    Trace.line(import.meta.url, "PlanStages.recover");
    const plans = (await this.deps.store.plans.list(Scope.everything, 50)).filter((p) => p.status === "approved");
    for (const plan of plans) await this.inTurn(plan.id);
    return plans.length;
  }

  /** Moves a plan made elsewhere (the chat's stages) on as far as it can now, as a run ending would. */
  follow(planId: string): Promise<void> {
    Trace.line(import.meta.url, "PlanStages.follow", { planId });
    return this.inTurn(planId);
  }

  /** The owner's answer on review mining's card: approved, it starts; rejected, the step records why it did not. */
  async decide(planId: string, approved: boolean): Promise<void> {
    Trace.line(import.meta.url, "PlanStages.decide", { planId, approved });
    const plan = await this.deps.store.plans.get(Scope.everything, planId);
    const step = plan?.stages.find((s) => s.stage === 3);
    if (!plan || !step || step.run_id) return;
    await this.save(plan, approved ? await this.run(plan, step) : { ...step, error: "rejected by the owner" });
  }

  private async moved(runId: string): Promise<void> {
    Trace.line(import.meta.url, "PlanStages.moved", { runId });
    const plan = (await this.deps.store.plans.list(Scope.everything, 50)).find((p) => p.tasks.some((t) => t.run_id === runId) || p.stages.some((s) => s.run_id === runId));
    if (plan) await this.inTurn(plan.id);
  }

  /** One plan moves one step at a time in this process, reading it fresh each time, so two runs ending together never combine stage 1 twice. */
  private inTurn(planId: string): Promise<void> {
    Trace.line(import.meta.url, "PlanStages.inTurn", { planId });
    const next = (this.queue.get(planId) ?? Promise.resolve()).then(async () => {
      const plan = await this.deps.store.plans.get(Scope.everything, planId);
      if (plan) await this.advance(plan);
    });
    const quiet = next.catch(() => undefined);
    this.queue.set(planId, quiet);
    return next;
  }

  private async advance(plan: Plan): Promise<void> {
    Trace.line(import.meta.url, "PlanStages.advance", { planId: plan.id });
    if (plan.status !== "approved" || !(await this.settled(plan))) return;
    let current = plan;
    if (!current.stage_one_run_id && !current.stages.some((s) => s.error)) {
      const combined = await new PlanStageOne(this.deps.store, this.deps.runs).combine(current);
      current = "runId" in combined ? await this.deps.store.plans.save({ ...current, stage_one_run_id: combined.runId }) : await this.fail(current, combined.error);
    }
    const [two, three] = [2, 3].map((n) => current.stages.find((s) => s.stage === n));
    if (two?.selected && !two.run_id && !two.error) current = await this.save(current, await this.run(current, two));
    const product = two?.run_id ? await this.deps.store.getRun(two.run_id) : null;
    if (three?.selected && !three.run_id && !three.error && product && RunStatuses.delivered(product.status)) await this.save(current, await this.ask(current, three));
    if (three?.selected && !three.run_id && !three.error && product && TERMINAL_STATUSES.has(product.status) && !RunStatuses.delivered(product.status)) {
      await this.save(current, { ...three, error: `product truth ended ${product.status}, and review mining builds on it` });
    }
  }

  /** Every kept stage-1 task has ended, or could not start and is not waiting on an approval card. */
  private async settled(plan: Plan): Promise<boolean> {
    Trace.line(import.meta.url, "PlanStages.settled", { planId: plan.id });
    const cards = (await this.deps.store.cards.list(Scope.of(plan.workspace_id), 100)).filter((c) => c.status === "open" && c.action.kind === "start_task" && c.action.plan_id === plan.id);
    for (const task of plan.tasks.filter((t) => t.selected)) {
      if (task.run_id && !TERMINAL_STATUSES.has((await this.deps.store.getRun(task.run_id))?.status ?? "")) return false;
      if (!task.run_id && (!task.error || cards.some((c) => c.action.kind === "start_task" && c.action.task_key === task.key))) return false;
    }
    return true;
  }

  private async run(plan: Plan, step: PlanStage): Promise<PlanStage> {
    Trace.line(import.meta.url, "PlanStages.run", { planId: plan.id, stage: step.stage });
    const combined = await this.deps.store.getRun(plan.stage_one_run_id);
    if (!combined || !RunStatuses.delivered(combined.status)) return { ...step, error: `the plan's stage 1 ended ${combined?.status ?? "missing"}, so there is nothing to build on` };
    const request = runRequestSchema.parse({ brief: plan.brief, nodes: [...STAGE_NODES[step.stage]], ...(step.inputs ? { inputs: step.inputs } : {}) });
    try {
      return { ...step, run_id: await this.deps.start(request, plan.workspace_id), error: "" };
    } catch (error) {
      return { ...step, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** Review mining's approval card, with what it would spend at most before stored pulls are reused. */
  private async ask(plan: Plan, step: PlanStage): Promise<PlanStage> {
    Trace.line(import.meta.url, "PlanStages.ask", { planId: plan.id });
    const parsed = stagePacketSchema.safeParse((await this.deps.store.getRun(plan.stage_one_run_id))?.packet);
    const targets = parsed.success ? ReviewMiningRoster.of(parsed.data).length : 0;
    if (targets === 0) return { ...step, error: "review mining needs the champion and the competitors stage 1 found; the plan's stage 1 has none" };
    const { reviewsPerBand, reuseDays } = this.deps;
    const most = targets * (UNIT_PRICE_USD[AMAZON_SEARCH_ACTOR] + PlanStages.BANDS * reviewsPerBand * UNIT_PRICE_USD[AMAZON_REVIEWS_ACTOR]);
    const body = `Review mining for ${plan.brief.product || plan.brief.url}: looks up the Amazon listing of each of ${targets} targets, then pulls up to ${reviewsPerBand} reviews per star band through Apify. At most about $${most.toFixed(2)}, before reuse: a stored pull of the same listing and band younger than ${reuseDays} days is reused and costs nothing.`;
    await this.deps.store.cards.create(plan.workspace_id, { kind: "approval", title: "Approve review mining?", body, action: { kind: "start_stage", plan_id: plan.id, stage: 3 } });
    return { ...step, error: PlanStages.WAITING };
  }

  private fail(plan: Plan, error: string): Promise<Plan> {
    Trace.line(import.meta.url, "PlanStages.fail", { planId: plan.id });
    return this.deps.store.plans.save({ ...plan, stages: plan.stages.map((s) => (s.selected ? { ...s, error } : s)) });
  }

  private save(plan: Plan, step: PlanStage): Promise<Plan> {
    Trace.line(import.meta.url, "PlanStages.save", { planId: plan.id, stage: step.stage });
    return this.deps.store.plans.save({ ...plan, stages: plan.stages.map((s) => (s.stage === step.stage ? step : s)) });
  }
}
