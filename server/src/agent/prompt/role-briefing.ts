import {
  Findings,
  productTruthPacketSchema,
  type Brief,
  type Finding,
  type Judgement,
  type Node,
  type ProductTruthAgent,
  type RoleSpec,
  type StageOneAgent,
  type StagePacket,
} from "../../domain/index.js";
import { ProductTruthAssembly } from "../../extract/index.js";
import { Trace } from "../../trace/index.js";

import type { PromptBuilder } from "./builder.js";
import type { ProductTruthPrompts } from "./truth-builder.js";

/** One run's prompts for any of its roles: the system prompt around the tools the agent was built with, and the task with what the ledger already holds. */
export interface RoleBriefing {
  system(role: RoleSpec, tools: string): string;
  instructions(role: RoleSpec, rows: readonly Finding[]): string;
}

/** A stage-1 run's prompts: each agent after the champion is shown the champion's row. */
export class StageOneBriefing implements RoleBriefing {
  constructor(
    private readonly prompts: PromptBuilder,
    private readonly run: { brief: Brief; nodes: readonly Node[]; rejectKinds: readonly string[]; judgements: readonly Judgement[] },
  ) {}

  system(role: RoleSpec, tools: string): string {
    Trace.line(import.meta.url, "StageOneBriefing.system", { role: role.id });
    return this.prompts.system(role.id as StageOneAgent, { tools, waits: role.tools.includes("wait_for") });
  }

  instructions(role: RoleSpec, rows: readonly Finding[]): string {
    Trace.line(import.meta.url, "StageOneBriefing.instructions", { role: role.id });
    const champion = Findings.live(rows).find((row) => row.kind === "competitor_reference")?.payload ?? null;
    return this.prompts.instructions(role.id as StageOneAgent, { ...this.run, champion });
  }
}

/** A product-truth run's prompts: each agent is shown stage 1's packet and what the agents before it recorded. */
export class ProductTruthBriefing implements RoleBriefing {
  constructor(
    private readonly prompts: ProductTruthPrompts,
    private readonly run: { runId: string; sourceRunId: string; brief: Brief; stageOne: StagePacket; rejectKinds: readonly string[]; judgements: readonly Judgement[] },
  ) {}

  system(role: RoleSpec, tools: string): string {
    Trace.line(import.meta.url, "ProductTruthBriefing.system", { role: role.id });
    return this.prompts.system(role.id as ProductTruthAgent, tools);
  }

  instructions(role: RoleSpec, rows: readonly Finding[]): string {
    Trace.line(import.meta.url, "ProductTruthBriefing.instructions", { role: role.id });
    const { runId, sourceRunId, brief } = this.run;
    const sofar = productTruthPacketSchema.parse(new ProductTruthAssembly(rows).draft({ runId, sourceRunId, brief, nodes: [] }));
    return this.prompts.instructions(role.id as ProductTruthAgent, { ...this.run, sofar });
  }
}
