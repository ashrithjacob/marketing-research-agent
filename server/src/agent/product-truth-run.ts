import type { OpenRouterPrices } from "../adapters/index.js";
import {
  Briefs,
  Clock,
  PRODUCT_TRUTH_AGENTS,
  PRODUCT_TRUTH_AGENT_SPECS,
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
import type { ProductTruthAgentFactory, ProductTruthRunContext } from "./product-truth-agent-factory.js";
import { ProductTruthSettlement } from "./product-truth-settlement.js";
import type { RetryPolicy } from "./retry.js";
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
    private readonly deps: { store: ResearchStore; runs: LiveRuns; costs: OpenRouterPrices; retry: RetryPolicy; factory: ProductTruthAgentFactory },
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
    const { runId, sourceRunId, brief, chain } = this.run;
    const team = this.team;
    const markets = Briefs.markets(brief);
    const context: ProductTruthRunContext = { ...this.run, markets, sequence: new CallSequence(), roster: new AgentRoster(), onCall: team.onCall, onChecked: team.onChecked };
    try {
      new OperatorInputs(store.findings, runId).record(this.run.inputs);
      const outcomes = await team.run(ProductTruthRun.members(), (id) => factory.build(id, context), context.roster);
      const errors = outcomes.filter((o) => o.error).map((o) => `${o.agentId}: ${o.error}`).join("; ");
      new ProductTruthSettlement(store, runs, runId, { sourceRunId, brief, markets }).settle(AgentTeam.output(outcomes), { ...team.totals, pricing: chain.pricing }, errors || undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`research run ${runId}: product truth failed`, error);
      store.updateRun(runId, { status: "failed", error: `agent failed: ${message}`, usage: { ...team.totals, pricing: chain.pricing }, ended_at: Clock.nowIso() });
      runs.emit(runId, "run.failed", { error: message });
    } finally {
      await new RunWrapUp(store, runs, runId).recordBilling(team.billing);
      runs.closeSubscribers(runId);
      runs.remove(runId);
    }
  }

  private static members(): TeamMember<ProductTruthAgent>[] {
    Trace.line(import.meta.url, "ProductTruthRun.members");
    return PRODUCT_TRUTH_AGENTS.map((id) => ({ id, after: PRODUCT_TRUTH_AGENT_SPECS[id].after }));
  }
}
