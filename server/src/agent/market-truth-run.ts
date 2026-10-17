import type { OpenRouterPrices } from "../adapters/index.js";
import { Briefs, MARKET_TRUTH_AGENTS, MARKET_TRUTH_GATHERERS, Roles, STAGE_NODES, type MarketTruthAgent, type ResearchStore } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { AgentRoster } from "./agent-roster.js";
import { AgentTeam, type TeamMember } from "./agent-team.js";
import { CallSequence } from "./llm-call-log.js";
import type { LiveRuns } from "./live-runs.js";
import type { MarketEvidence } from "./market-truth-inputs.js";
import type { OwnerReword } from "./owner-reword.js";
import { MarketDigest, MarketTruthBriefing, MarketTruthPrompts } from "./prompt/index.js";
import type { ResearchAgentFactory, RoleContext } from "./research-agent-factory.js";
import type { RetryPolicy } from "./retry.js";
import { RunEnd, type RunEnding } from "./run-end.js";
import { RunMeter } from "./run-meter.js";
import { RunWrapUp } from "./run-wrap-up.js";
import { StageOneRunAssembly } from "./stage-one-run-assembly.js";
import { UsageTotals } from "./usage.js";

type RunBrief = Pick<RoleContext, "runId" | "brief" | "rejectKinds" | "judgements" | "chain" | "pollMs"> & { evidence: MarketEvidence };

/** One market-truth run: market size, offers, sophistication and breaking point side by side, each starting from what the earlier stages found, then the gate over all of it; settled once from the ledger, as stage 1 is. */
export class MarketTruthRun {
  private readonly team: AgentTeam;

  constructor(
    private readonly deps: { store: ResearchStore; runs: LiveRuns; costs: OpenRouterPrices; retry: RetryPolicy; factory: ResearchAgentFactory; reword: OwnerReword },
    private readonly run: RunBrief,
  ) {
    Trace.line(import.meta.url, "MarketTruthRun.constructor", { runId: run.runId });
    this.team = new AgentTeam(deps, run.runId, run.chain);
  }

  get abort(): () => void {
    Trace.line(import.meta.url, "MarketTruthRun.abort");
    return this.team.abort;
  }

  get steer(): (text: string) => void {
    Trace.line(import.meta.url, "MarketTruthRun.steer");
    return this.team.steer;
  }

  async start(): Promise<void> {
    Trace.line(import.meta.url, "MarketTruthRun.start", { runId: this.run.runId });
    const { store, runs, factory } = this.deps;
    const { runId, brief, evidence } = this.run;
    const team = this.team;
    const nodes = STAGE_NODES[4];
    const instructions = { brief, rejectKinds: this.run.rejectKinds, judgements: this.run.judgements, digest: MarketDigest.render(evidence) };
    const context: RoleContext = {
      ...this.run,
      nodes,
      markets: Briefs.markets(brief),
      earlier: evidence.sources,
      briefing: new MarketTruthBriefing(new MarketTruthPrompts(), instructions),
      sequence: new CallSequence(),
      roster: new AgentRoster(),
      onCall: team.onCall,
      meter: (agentId) => new RunMeter(store, runs, runId, agentId),
      onChecked: team.onChecked,
    };
    const assembly = new StageOneRunAssembly(store.findings, runId, { brief, nodes, roles: MARKET_TRUTH_AGENTS.map((id) => Roles.of(id)) });
    let ending: RunEnding;
    let output = "";
    try {
      const outcomes = await team.run(MarketTruthRun.members(), (id) => factory.build(Roles.of(id), context), context.roster);
      const errors = outcomes.filter((o) => o.error).map((o) => `${o.agentId}: ${o.error}`).join("; ");
      const trips = outcomes.flatMap((o) => (o.trip ? [o.trip] : []));
      ending = trips.length > 0 ? { kind: "cut_short", trips, errorMessage: errors || undefined } : { kind: "settled", errorMessage: errors || undefined };
      output = AgentTeam.output(outcomes);
    } catch (error) {
      console.error(`research run ${runId}: market truth failed`, error);
      ending = { kind: "crashed", error: `agent failed: ${error instanceof Error ? error.message : String(error)}` };
    }
    try {
      await team.written(context.sequence);
      await new RunEnd(store, runs).end(assembly, ending, { output, usage: UsageTotals.tokens(team.totals) });
      await this.reword();
    } finally {
      await new RunWrapUp(store, runs, runId).recordBilling(team.billing);
      await team.written(context.sequence);
      await runs.closeSubscribers(runId);
      runs.remove(runId);
    }
  }

  /** After the status is set, never before: a failed rewrite is an event, and the page shows the gate's own words. */
  private async reword(): Promise<void> {
    Trace.line(import.meta.url, "MarketTruthRun.reword", { runId: this.run.runId });
    const { runs, reword } = this.deps;
    try {
      runs.emit(this.run.runId, "packet.reworded", { kept: await reword.apply(this.run.runId, this.team.billing) });
    } catch (error) {
      runs.emit(this.run.runId, "packet.reworded", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private static members(): TeamMember<MarketTruthAgent>[] {
    Trace.line(import.meta.url, "MarketTruthRun.members");
    return [...MARKET_TRUTH_GATHERERS.map((id) => ({ id, after: [] as MarketTruthAgent[] })), { id: "gate", after: [...MARKET_TRUTH_GATHERERS] }];
  }
}
