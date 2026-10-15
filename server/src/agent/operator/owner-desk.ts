import { Scope, type Plan } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { OperatorDesk } from "./operator-desk.js";
import type { PlanDesk } from "./plan-desk.js";

/** What the owner does from the cockpit: Start a plan, toggle its tasks, approve it, and talk to the operator, who is told of each step. */
export class OwnerDesk {
  constructor(
    private readonly plans: PlanDesk,
    private readonly operator: OperatorDesk,
  ) {}

  async start(body: unknown, workspaceId: string): Promise<Plan> {
    Trace.line(import.meta.url, "OwnerDesk.start", { workspaceId });
    const plan = await this.plans.draft(body, workspaceId);
    const subject = plan.brief.product || plan.brief.url;
    await this.operator.note(workspaceId, `The owner started plan ${plan.id} for ${subject}: ${plan.tasks.map((t) => t.title).join(", ")}. Nothing runs until they approve it.`);
    return plan;
  }

  /** A task of a draft plan kept or dropped, or its stop_when rewritten, from the plan card. */
  edit(planId: string, scope: Scope, key: string, change: { selected?: boolean; stop_when?: string }): Promise<Plan> {
    Trace.line(import.meta.url, "OwnerDesk.edit", { planId, key });
    const kept = change.selected === undefined ? {} : change.selected ? { keep: [key] } : { drop: [key] };
    return this.plans.revise(planId, scope, { ...kept, ...(change.stop_when === undefined ? {} : { stop_when: { [key]: change.stop_when } }) });
  }

  stage(planId: string, scope: Scope, stage: number, change: { selected: boolean; landed_unit_cost?: number; currency?: string }): Promise<Plan> {
    Trace.line(import.meta.url, "OwnerDesk.stage", { planId, stage });
    const { selected, ...cost } = change;
    return this.plans.setStage(planId, scope, stage, selected, cost);
  }

  async approve(planId: string, scope: Scope): Promise<Plan> {
    Trace.line(import.meta.url, "OwnerDesk.approve", { planId });
    const plan = await this.plans.approve(planId, scope);
    const started = plan.tasks.filter((t) => t.run_id).map((t) => `${t.title} (${t.run_id})`);
    const refused = plan.tasks.filter((t) => t.error).map((t) => `${t.title}: ${t.error}`);
    await this.operator.note(plan.workspace_id, `The owner approved plan ${plan.id}. Started: ${started.join(", ") || "nothing"}.${refused.length > 0 ? ` Refused: ${refused.join("; ")}.` : ""}`);
    return plan;
  }

  say(workspaceId: string, text: string, planId: string): Promise<void> {
    Trace.line(import.meta.url, "OwnerDesk.say", { workspaceId });
    return this.operator.say(workspaceId, text, planId);
  }
}
