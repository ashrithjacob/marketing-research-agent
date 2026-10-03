import type { OpenRouterPrices } from "../adapters/index.js";
import {
  Briefs,
  PRODUCT_TRUTH_AGENTS,
  Roles,
  STAGE_NODES,
  type Brief,
  type Judgement,
  type ProductTruthAgent,
  type ProductTruthInputs,
  type ResearchStore,
  type StagePacket,
} from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { AgentRoster } from "./agent-roster.js";
import { AgentTeam, type TeamMember } from "./agent-team.js";
import { CallSequence } from "./llm-call-log.js";
import type { LiveRuns } from "./live-runs.js";
import type { ModelChain } from "./model-chain.js";
import { OperatorInputs } from "./operator-inputs.js";
import { ProductTruthBriefing, ProductTruthPrompts } from "./prompt/index.js";
import type { ResearchAgentFactory, RoleContext } from "./research-agent-factory.js";
import { ProductTruthRunAssembly } from "./product-truth-run-assembly.js";
import type { RetryPolicy } from "./retry.js";
import { RunEnd, type RunEnding } from "./run-end.js";
import { RunMeter } from "./run-meter.js";
import { UsageTotals } from "./usage.js";
import { RunWrapUp } from "./run-wrap-up.js";

export interface ProductTruthBrief {
  runId: string;
  sourceRunId: string;
  brief: Brief;
  stageOne: StagePacket;
  inputs: ProductTruthInputs;
  rejectKinds: readonly string[];
  judgements: readonly Judgement[];
  chain: ModelChain;
}

/** One product-truth run: the operator's inputs written first, then formula, then mechanism beside dose_vs_study, then claim_limits and cogs_refills each once the agent it needs has ended; settled once from the ledger. */
export class ProductTruthRun {
  private readonly team: AgentTeam;

  constructor(
    private readonly deps: { store: ResearchStore; runs: LiveRuns; costs: OpenRouterPrices; retry: RetryPolicy; factory: ResearchAgentFactory },
    private readonly run: ProductTruthBrief,
  ) {
    Trace.line(import.meta.url, "ProductTruthRun.constructor", { runId: run.runId });
    this.team = new AgentTeam(deps, run.runId, run.chain);
  }

  get abort(): () => void {
    Trace.line(import.meta.url, "ProductTruthRun.abort");
    return this.team.abort;
  }

  get steer(): (text: string) => void {
    Trace.line(import.meta.url, "ProductTruthRun.steer");
    return this.team.steer;
  }

  async start(): Promise<void> {
    Trace.line(import.meta.url, "ProductTruthRun.start", { runId: this.run.runId });
    const { store, runs, factory } = this.deps;
    const { runId, sourceRunId, brief } = this.run;
    const team = this.team;
    const markets = Briefs.markets(brief);
    const context: RoleContext = {
      ...this.run,
      nodes: STAGE_NODES[2],
      markets,
      briefing: new ProductTruthBriefing(new ProductTruthPrompts(), this.run),
      sequence: new CallSequence(),
      roster: new AgentRoster(),
      onCall: team.onCall,
      onChecked: team.onChecked,
      meter: (agentId) => new RunMeter(store, runs, runId, agentId),
    };
    const assembly = new ProductTruthRunAssembly(store.findings, runId, { sourceRunId, brief, markets });
    let ending: RunEnding;
    let output = "";
    try {
      await new OperatorInputs(store.findings, runId).record(this.run.inputs);
      const outcomes = await team.run(ProductTruthRun.members(), (id) => factory.build(Roles.of(id), context), context.roster);
      const errors = outcomes.filter((o) => o.error).map((o) => `${o.agentId}: ${o.error}`).join("; ");
      ending = { kind: "settled", errorMessage: errors || undefined };
      output = AgentTeam.output(outcomes);
    } catch (error) {
      console.error(`research run ${runId}: product truth failed`, error);
      ending = { kind: "crashed", error: `agent failed: ${error instanceof Error ? error.message : String(error)}` };
    }
    try {
      await team.written(context.sequence);
      await new RunEnd(store, runs).end(assembly, ending, { output, usage: UsageTotals.tokens(team.totals) });
    } finally {
      await new RunWrapUp(store, runs, runId).recordBilling(team.billing);
      await team.written(context.sequence);
      await runs.closeSubscribers(runId);
      runs.remove(runId);
    }
  }

  private static members(): TeamMember<ProductTruthAgent>[] {
    Trace.line(import.meta.url, "ProductTruthRun.members");
    return PRODUCT_TRUTH_AGENTS.map((id) => ({ id, after: Roles.of(id).waitsFor as ProductTruthAgent[] }));
  }
}
