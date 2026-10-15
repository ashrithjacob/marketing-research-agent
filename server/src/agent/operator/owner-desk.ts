import { Brands, FeedbackStrengths, Scope, type FeedbackBook, type Plan } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";

import type { OperatorDesk } from "./operator-desk.js";
import type { PlanDesk } from "./plan-desk.js";

/** What the owner does: open a brand's chat with a link or a name, talk to the operator in it, and the plan steps the API still offers, of which the brand's chat is told. */
export class OwnerDesk {
  constructor(
    private readonly plans: PlanDesk,
    private readonly operator: OperatorDesk,
    private readonly feedback: FeedbackBook,
  ) {}

  /** A new brand's chat, begun with what the owner typed (a link or a product's name) as its first message; its brand key comes back. */
  async open(workspaceId: string, text: string): Promise<{ key: string }> {
    Trace.line(import.meta.url, "OwnerDesk.open", { workspaceId });
    const said = text.trim();
    if (!said) throw new RunError("a new brand needs a link or a product's name: { text }");
    const key = Brands.key({ product: said });
    await this.say(workspaceId, key, said, key.startsWith(Brands.SITE) ? Brands.label(key) : said);
    return { key };
  }

  async start(body: unknown, workspaceId: string): Promise<Plan> {
    Trace.line(import.meta.url, "OwnerDesk.start", { workspaceId });
    const plan = await this.plans.draft(body, workspaceId);
    const subject = plan.brief.product || plan.brief.url;
    await this.operator.note(workspaceId, Brands.key(plan.brief), `The owner started plan ${plan.id} for ${subject}: ${plan.tasks.map((t) => t.title).join(", ")}. Nothing runs until they approve it.`);
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
    await this.operator.note(plan.workspace_id, Brands.key(plan.brief), `The owner approved plan ${plan.id}. Started: ${started.join(", ") || "nothing"}.${refused.length > 0 ? ` Refused: ${refused.join("; ")}.` : ""}`);
    return plan;
  }

  /** The owner's message to a brand's operator, recorded as feedback too, so the reviewer learns what in it holds for later work. */
  async say(workspaceId: string, brand: string, text: string, label = ""): Promise<void> {
    Trace.line(import.meta.url, "OwnerDesk.say", { workspaceId, brand });
    await this.operator.say(workspaceId, brand, text, label);
    await this.feedback.record(workspaceId, { verdict: "said", target: FeedbackStrengths.target("chat", brand), text });
  }
}
