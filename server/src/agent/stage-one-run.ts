import type { OpenRouterPrices } from "../adapters/index.js";
import { Clock, StageOnePlans, type ResearchStore, type StageOneAgent, type StageOnePlan } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { AgentRoster } from "./agent-roster.js";
import { AgentTeam, type TeamMember } from "./agent-team.js";
import { LedgerPacket } from "./ledger-packet.js";
import { CallSequence } from "./llm-call-log.js";
import type { LiveRuns } from "./live-runs.js";
import type { RetryPolicy } from "./retry.js";
import { RowRepair } from "./row-repair.js";
import { RunSettlement } from "./run-settlement.js";
import { RunWrapUp } from "./run-wrap-up.js";
import type { StageOneAgentFactory, StageOneRunContext } from "./stage-one-agent-factory.js";
import type { StageOneListings } from "./stage-one-listings.js";

type RunBrief = Pick<StageOneRunContext, "runId" | "brief" | "nodes" | "rejectKinds" | "judgements" | "chain" | "pollMs">;

/** One stage-1 run: the champion agent alone, then one agent per node side by side, all on one ledger, settled once from it when the last one ends. */
export class StageOneRun {
  private readonly team: AgentTeam;

  constructor(
    private readonly deps: {
      store: ResearchStore;
      runs: LiveRuns;
      costs: OpenRouterPrices;
      retry: RetryPolicy;
      factory: StageOneAgentFactory;
      listings?: StageOneListings;
    },
    private readonly run: RunBrief,
  ) {
    Trace.line(import.meta.url, "StageOneRun.constructor", { runId: run.runId });
    this.team = new AgentTeam(deps, run.runId, run.chain);
  }

  get abort(): () => void {
    Trace.line(import.meta.url, "StageOneRun.abort");
    return this.team.abort;
  }

  get steer(): (text: string) => void {
    Trace.line(import.meta.url, "StageOneRun.steer");
    return this.team.steer;
  }

  async start(): Promise<void> {
    Trace.line(import.meta.url, "StageOneRun.start", { runId: this.run.runId });
    const { store, runs, factory } = this.deps;
    const { runId, brief, nodes, chain } = this.run;
    const team = this.team;
    const context: StageOneRunContext = {
      ...this.run,
      sequence: new CallSequence(),
      roster: new AgentRoster(),
      onCall: team.onCall,
      onApifyCharge: (charge) => runs.emit(runId, "apify.charged", { actor: charge.actor, usd: charge.usd, status: charge.status }),
      onChecked: team.onChecked,
    };
    const wrapUp = new RunWrapUp(store, runs, runId, this.deps.listings);
    try {
      const outcomes = await team.run(StageOneRun.members(StageOnePlans.of(brief, nodes)), (id) => factory.build(id, context), context.roster);
      const errors = outcomes.filter((o) => o.error).map((o) => `${o.agentId}: ${o.error}`).join("; ");
      const ledger = new LedgerPacket(store.findings, runId, { brief, nodes });
      new RunSettlement(store, runs, runId, ledger, new RowRepair(store.findings, runId, nodes)).settle(
        AgentTeam.output(outcomes),
        { ...team.totals, pricing: chain.pricing },
        errors || undefined,
        () => team.partProblems(),
      );
      await wrapUp.lookUpListings(nodes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`research run ${runId}: stage 1 failed`, error);
      store.updateRun(runId, { status: "failed", error: `agent failed: ${message}`, usage: { ...team.totals, pricing: chain.pricing }, ended_at: Clock.nowIso() });
      runs.emit(runId, "run.failed", { error: message });
    } finally {
      await wrapUp.recordBilling(team.billing);
      runs.closeSubscribers(runId);
      runs.remove(runId);
    }
  }

  /** The champion first when the plan has one, and every node's agent after it, side by side. */
  private static members(plan: StageOnePlan): TeamMember<StageOneAgent>[] {
    Trace.line(import.meta.url, "StageOneRun.members", { plan });
    const after: StageOneAgent[] = plan.champion ? ["champion"] : [];
    return [...(plan.champion ? [{ id: "champion" as const, after: [] }] : []), ...plan.parallel.map((id) => ({ id, after }))];
  }
}
