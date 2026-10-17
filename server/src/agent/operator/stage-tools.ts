import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolRegistration } from "@earendil-works/pi-durable";

import { SavedPlans } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { BrandResearch } from "./brand-research.js";
import type { ChatReviews } from "./chat-reviews.js";
import type { ChatStages } from "./chat-stages.js";
import { OperatorAct } from "./operator-act.js";
import type { StageBriefDesk } from "./stage-brief-desk.js";

/** The operator's way through the research: what has been researched and what may come next, a stage proposed as a brief the owner edits and runs, customer voice behind its own approval, and review analysis. */
export class StageTools {
  constructor(
    private readonly research: BrandResearch,
    private readonly briefs: StageBriefDesk,
    private readonly stages: ChatStages,
    private readonly reviews: ChatReviews,
  ) {}

  tools(): ToolRegistration[] {
    Trace.line(import.meta.url, "StageTools.tools");
    return [
      defineTool({
        name: "brand_research",
        description: "What has been researched for this chat's brand: per product, each stage's status, date, figures and what it could not find, and the next steps that may be offered. Call it before saying anything about the brand's research or suggesting what to do next.",
        parameters: Type.Object({}),
        execute: (_args, api, context) => OperatorAct.run(api, context, async (workspace) => this.research.report(workspace, await OperatorAct.brand(api, context))),
      }),
      defineTool({
        name: "propose_stage",
        description:
          "Put a research stage's brief on a card for the owner: what its agents will look for, which they edit and then run with its button. The only way to start market research (1), product truth (2), market truth (4) or customer truth (5). " +
          `For 1: \`url\` when the owner gave a link, else \`product\`, never a link as product; \`parts\` some of ${SavedPlans.parts().join(", ")}, or none for all; \`focus\` what the last run could not find, when plugging gaps. ` +
          "For 2, 4 and 5: `product_key` from brand_research when the brand has several products. For 2: `landed_unit_cost` and `currency` when the owner gave them. `fresh` only when the owner asked to redo a stage that already ran.",
        parameters: Type.Object({
          stage: Type.Number(),
          url: Type.Optional(Type.String()),
          product: Type.Optional(Type.String()),
          market: Type.Optional(Type.String()),
          parts: Type.Optional(Type.Array(Type.String())),
          focus: Type.Optional(Type.String()),
          product_key: Type.Optional(Type.String()),
          landed_unit_cost: Type.Optional(Type.Number()),
          currency: Type.Optional(Type.String()),
          fresh: Type.Optional(Type.Boolean()),
        }),
        execute: (args, api, context) => OperatorAct.run(api, context, async (workspace) => this.briefs.propose(workspace, await OperatorAct.brand(api, context), args)),
      }),
      defineTool({
        name: "start_customer_voice",
        description: "Start customer voice (stage 3) for a product of this brand: its paid Amazon review pulls wait for the owner's Approve button, which states the most it can cost. Only after market truth, and only when its gate did not say drop, unless the owner asks.",
        parameters: Type.Object({ product_key: Type.Optional(Type.String()), fresh: Type.Optional(Type.Boolean()) }),
        execute: (args, api, context) =>
          OperatorAct.run(api, context, async (workspace) => this.stages.start(workspace, await OperatorAct.brand(api, context), 3, { ...(args.product_key ? { product: args.product_key } : {}), fresh: args.fresh ?? false })),
      }),
      defineTool({
        name: "analyse_reviews",
        description: "Analyse the reviews customer voice mined for a product of this brand: clean them, group them into issues and rank them, as the dashboard's Analyse button does. Model calls only, nothing paid to Apify; a few minutes. Running it again replaces the last analysis when the new one is done.",
        parameters: Type.Object({ product: Type.Optional(Type.String()) }),
        execute: (args, api, context) => OperatorAct.run(api, context, async (workspace) => this.reviews.analyse(workspace, await OperatorAct.brand(api, context), args.product)),
      }),
    ];
  }
}
