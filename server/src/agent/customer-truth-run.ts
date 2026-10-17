import type { OpenRouterPrices } from "../adapters/index.js";
import { Briefs, CUSTOMER_TRUTH_AGENTS, Roles, STAGE_NODES, type CustomerTruthAgent, type ResearchStore } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { AgentRoster } from "./agent-roster.js";
import { AgentTeam, type TeamMember } from "./agent-team.js";
import type { CustomerEvidence } from "./customer-truth-inputs.js";
import { CallSequence } from "./llm-call-log.js";
import type { LiveRuns } from "./live-runs.js";
import { CustomerDigest, CustomerTruthBriefing, CustomerTruthPrompts } from "./prompt/index.js";
import type { ResearchAgentFactory, RoleContext } from "./research-agent-factory.js";
import type { RetryPolicy } from "./retry.js";
import { RunEnd, type RunEnding } from "./run-end.js";
import { RunMeter } from "./run-meter.js";
import { RunWrapUp } from "./run-wrap-up.js";
import { StageOneRunAssembly } from "./stage-one-run-assembly.js";
import { UsageTotals } from "./usage.js";

type RunBrief = Pick<RoleContext, "runId" | "brief" | "rejectKinds" | "judgements" | "chain" | "pollMs"> & { evidence: CustomerEvidence };

/** One customer-truth run: the language bank and the identity layer side by side from the mined reviews, then the avatars from both, then awareness per avatar and channel; settled once from the ledger. */
export class CustomerTruthRun {
  private readonly team: AgentTeam;

  constructor(
    private readonly deps: { store: ResearchStore; runs: LiveRuns; costs: OpenRouterPrices; retry: RetryPolicy; factory: ResearchAgentFactory },
    private readonly run: RunBrief,
  ) {
    Trace.line(import.meta.url, "CustomerTruthRun.constructor", { runId: run.runId });
    this.team = new AgentTeam(deps, run.runId, run.chain);
  }

  get abort(): () => void {
    Trace.line(import.meta.url, "CustomerTruthRun.abort");
    return this.team.abort;
  }

  get steer(): (text: string) => void {
    Trace.line(import.meta.url, "CustomerTruthRun.steer");
    return this.team.steer;
  }

  async start(): Promise<void> {
    Trace.line(import.meta.url, "CustomerTruthRun.start", { runId: this.run.runId });
    const { store, runs, factory } = this.deps;
    const { runId, brief, evidence } = this.run;
    const team = this.team;
    const nodes = STAGE_NODES[5];
    const context: RoleContext = {
      ...this.run,
      nodes,
      markets: Briefs.markets(brief),
      reviews: evidence.reviews,
      briefing: new CustomerTruthBriefing(new CustomerTruthPrompts(), { brief, digest: CustomerDigest.render(evidence) }),
      sequence: new CallSequence(),
      roster: new AgentRoster(),
      onCall: team.onCall,
      meter: (agentId) => new RunMeter(store, runs, runId, agentId),
      onChecked: team.onChecked,
    };
    const assembly = new StageOneRunAssembly(store.findings, runId, { brief, nodes, roles: CUSTOMER_TRUTH_AGENTS.map((id) => Roles.of(id)) });
    let ending: RunEnding;
    let output = "";
    try {
      const outcomes = await team.run(CustomerTruthRun.members(), (id) => factory.build(Roles.of(id), context), context.roster);
      const errors = outcomes.filter((o) => o.error).map((o) => `${o.agentId}: ${o.error}`).join("; ");
      const trips = outcomes.flatMap((o) => (o.trip ? [o.trip] : []));
      ending = trips.length > 0 ? { kind: "cut_short", trips, errorMessage: errors || undefined } : { kind: "settled", errorMessage: errors || undefined };
      output = AgentTeam.output(outcomes);
    } catch (error) {
      console.error(`research run ${runId}: customer truth failed`, error);
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

  private static members(): TeamMember<CustomerTruthAgent>[] {
    Trace.line(import.meta.url, "CustomerTruthRun.members");
    return [
      { id: "voices", after: [] },
      { id: "identity", after: [] },
      { id: "avatars", after: ["voices", "identity"] },
      { id: "awareness", after: ["avatars"] },
    ];
  }
}
