import { Briefs, Brands, CUSTOMER_TRUTH_AGENTS, MARKET_TRUTH_AGENTS, PRODUCT_TRUTH_AGENTS, ProductFolders, SavedPlans, Scope, briefSchema, type Brief, type CardAction, type CardDraft, type Plan, type ResearchStore, type RoleId } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";
import { StageBriefTemplate } from "../prompt/stage-brief-template.js";

import type { ChatStages } from "./chat-stages.js";
import type { PlanDesk } from "./plan-desk.js";

/** What the operator proposes a stage with: the subject (for market research), the parts to keep, what the last run could not find, product truth's cost inputs, and whether a delivered stage is to run fresh. */
export interface StageProposal {
  stage: number;
  url?: string;
  product?: string;
  market?: string;
  parts?: string[];
  focus?: string;
  product_key?: string;
  landed_unit_cost?: number;
  currency?: string;
  fresh?: boolean;
}

type BriefAction = Extract<CardAction, { kind: "stage_brief" }>;

const PART_ROLES: Readonly<Record<string, RoleId>> = { product_facts: "product", competitors: "competitors", category_numbers: "category" };
const NAMES: Readonly<Record<number, string>> = { 1: "market research", 2: "product truth", 4: "market truth" };

/** Every research stage starts from a brief the owner sees (spec-always-on §11, 2026-10-16): proposed as an editable card, written from what the stage's agents look for or as last approved, and run, as approved, as the run's notes, which every agent of the stage reads. */
export class StageBriefDesk {
  constructor(
    private readonly store: ResearchStore,
    private readonly plans: PlanDesk,
    private readonly stages: ChatStages,
    private readonly open: (workspaceId: string, draft: CardDraft) => Promise<unknown>,
  ) {}

  async propose(workspaceId: string, brand: string, p: StageProposal): Promise<string> {
    Trace.line(import.meta.url, "StageBriefDesk.propose", { workspaceId, brand, stage: p.stage });
    const { brief, subject, roles, productId } = p.stage === 1 ? await this.marketResearch(p) : await this.later(workspaceId, brand, p);
    const parts = p.stage === 1 ? (p.parts ?? []) : [];
    const last = productId ? await this.lastApproved(workspaceId, productId, p.stage) : "";
    const text = last && !p.focus ? last : StageBriefTemplate.of(p.stage, StageBriefTemplate.roles(roles), subject, p.focus ?? "");
    const inputs = { ...(p.landed_unit_cost !== undefined ? { landed_unit_cost: p.landed_unit_cost } : {}), ...(p.currency ? { currency: p.currency } : {}) };
    const action: BriefAction = { kind: "stage_brief", editable: true, brand: brand || Brands.key(brief), stage: p.stage, brief, product: p.product_key ?? "", parts, inputs, fresh: p.fresh ?? false };
    await this.open(workspaceId, { kind: "approval", title: `Run ${NAMES[p.stage]} for ${subject}?`, body: text, action });
    return `The brief for ${NAMES[p.stage]} is on a card under the chat${last && !p.focus ? ", as the owner last approved it" : ""}. The owner reads and edits it there, then runs it. Tell them in a sentence what it looks for, and ask for anything it needs from them.`;
  }

  /** The stage run with the brief as the owner approved it, word for word, as its notes. */
  async run(workspaceId: string, action: BriefAction, approved: string): Promise<string> {
    Trace.line(import.meta.url, "StageBriefDesk.run", { workspaceId, stage: action.stage });
    const notes = approved.trim();
    if (action.stage !== 1) return this.stages.start(workspaceId, action.brand, action.stage, { product: action.product, notes, inputs: action.inputs, fresh: action.fresh });
    const draft = await this.plans.draft({ brief: { ...action.brief, notes } }, workspaceId, action.parts);
    return StageBriefDesk.report(await this.plans.approve(draft.id, Scope.of(workspaceId)));
  }

  /** Each task of a started market-research plan in one line: started, waiting on another, or why it did not start. */
  static report(plan: Plan): string {
    Trace.line(import.meta.url, "StageBriefDesk.report", { planId: plan.id });
    const lines = plan.tasks.filter((task) => task.selected).map((task) => {
      if (task.run_id) return `- ${task.title}: started, task ${task.run_id}`;
      if (task.error) return `- ${task.title}: ${task.error}`;
      return `- ${task.title}: starts when ${task.after.join(", ")} ends`;
    });
    return [`Market research for ${plan.brief.product || plan.brief.url}:`, ...lines].join("\n");
  }

  private async marketResearch(p: StageProposal): Promise<{ brief: Brief; subject: string; roles: RoleId[]; productId: string }> {
    Trace.line(import.meta.url, "StageBriefDesk.marketResearch", { parts: p.parts });
    const parsed = briefSchema.safeParse({ url: p.url ?? "", product: p.product ?? "", market: p.market ?? "" });
    if (!parsed.success) throw new RunError("market research needs a link (url) or a product's name (product)");
    const brief = Briefs.normalise(parsed.data);
    if (!brief.url && !brief.product) throw new RunError("market research needs a link (url) or a product's name (product)");
    const unknown = (p.parts ?? []).filter((part) => !SavedPlans.parts().includes(part));
    if (unknown.length > 0) throw new RunError(`no part ${unknown.join(", ")}; the parts are ${SavedPlans.parts().join(", ")}`);
    const roles = SavedPlans.tasks(brief, p.parts ?? []).filter((t) => t.selected).map((t) => PART_ROLES[t.key] ?? "champion");
    const product = await this.store.products.byKey(Briefs.key(brief));
    return { brief, subject: brief.product || Brands.label(Brands.key(brief)), roles, productId: product?.id ?? "" };
  }

  private async later(workspaceId: string, brand: string, p: StageProposal): Promise<{ brief: Brief; subject: string; roles: RoleId[]; productId: string }> {
    Trace.line(import.meta.url, "StageBriefDesk.later", { stage: p.stage });
    if (p.stage !== 2 && p.stage !== 4 && p.stage !== 5) throw new RunError("a brief is for market research (1), product truth (2), market truth (4) or customer truth (5); customer voice (3) starts with start_customer_voice, behind its own approval card");
    const { product, brief } = await this.stages.subject(workspaceId, brand, p.stage, { ...(p.product_key ? { product: p.product_key } : {}), ...(p.fresh ? { fresh: true } : {}) });
    const roles = p.stage === 2 ? [...PRODUCT_TRUTH_AGENTS] : p.stage === 5 ? [...CUSTOMER_TRUTH_AGENTS] : [...MARKET_TRUTH_AGENTS];
    return { brief, subject: product.label.replace(/^https?:\/\//, ""), roles, productId: product.id };
  }

  /** The brief the owner last approved for this product and stage: the notes of its newest run that had any. */
  private async lastApproved(workspaceId: string, productId: string, stage: number): Promise<string> {
    Trace.line(import.meta.url, "StageBriefDesk.lastApproved", { productId, stage });
    const heads = (await this.store.products.runHeads(Scope.of(workspaceId))).filter((h) => h.stage === stage);
    for (const id of ProductFolders.runIds(heads, productId)) {
      const notes = String(((await this.store.getRun(id))?.brief as { notes?: unknown } | undefined)?.notes ?? "").trim();
      if (notes) return notes;
    }
    return "";
  }
}
