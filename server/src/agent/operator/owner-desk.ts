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

  toggle(planId: string, scope: Scope, key: string, selected: boolean): Promise<Plan> {
    Trace.line(import.meta.url, "OwnerDesk.toggle", { planId, key, selected });
    return this.plans.revise(planId, scope, selected ? { keep: [key] } : { drop: [key] });
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
