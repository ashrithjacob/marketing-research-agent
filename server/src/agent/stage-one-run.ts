import type { Agent } from "@earendil-works/pi-agent-core";

import { OpenRouterPrices, RunBilling } from "../adapters/index.js";
import { Clock, StageOnePlans, type StageOneAgent } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { AgentDriver, type AgentOutcome } from "./agent-driver.js";
import { AgentRoster } from "./agent-roster.js";
import { BilledCosts } from "./billed-costs.js";
import type { DoneCheck } from "./done-check.js";
import type { TurnEnd } from "./event-recorder.js";
import { LedgerPacket } from "./ledger-packet.js";
import { CallSequence } from "./llm-call-log.js";
import type { RetryPolicy } from "./retry.js";
import { RunSettlement } from "./run-settlement.js";
import { RunWrapUp } from "./run-wrap-up.js";
import type { StageOneAgentFactory, StageOneRunContext } from "./stage-one-agent-factory.js";
import type { StageOneListings } from "./stage-one-listings.js";
import type { LiveRuns } from "./live-runs.js";
import { UsageTotals } from "./usage.js";
import type { ResearchStore } from "../domain/index.js";

type RunBrief = Pick<StageOneRunContext, "runId" | "brief" | "nodes" | "rejectKinds" | "judgements" | "chain" | "pollMs">;

/** One stage-1 run: the champion agent alone, then one agent per node side by side, all on one ledger, settled once from it when the last one ends. */
export class StageOneRun {
  private readonly live = new Map<string, Agent>();
  private readonly passed = new Set<string>();
  private readonly checks = new Map<string, DoneCheck>();
  private stopped = false;
  private usage = UsageTotals.empty();

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
  ) {}

  readonly abort = (): void => {
    Trace.line(import.meta.url, "StageOneRun.abort", { live: [...this.live.keys()] });
    this.stopped = true;
    for (const agent of this.live.values()) agent.abort();
  };

  readonly steer = (text: string): void => {
    Trace.line(import.meta.url, "StageOneRun.steer", { live: [...this.live.keys()] });
    for (const agent of this.live.values()) agent.steer({ role: "user", content: [{ type: "text", text }], timestamp: Date.now() });
  };

  async start(): Promise<void> {
    Trace.line(import.meta.url, "StageOneRun.start", { runId: this.run.runId });
    const { store, runs, costs } = this.deps;
    const { runId, brief, nodes, chain } = this.run;
    const billing = new RunBilling(costs);
    const billed = new BilledCosts(store, runs, runId);
    const context: StageOneRunContext = {
      ...this.run,
      sequence: new CallSequence(),
      roster: new AgentRoster(),
      onCall: billed.onCall,
      onApifyCharge: (charge) => runs.emit(runId, "apify.charged", { actor: charge.actor, usd: charge.usd, status: charge.status }),
      onChecked: (agentId, valid, problems) => {
        Trace.line(import.meta.url, "StageOneRun.start.onChecked", { agentId, valid, problems });
        if (valid) this.passed.add(agentId);
        store.addPacketCheck(runId, valid, problems);
        runs.emit(runId, "packet.checked", { agent_id: agentId, valid, problems: [...problems] });
      },
    };
    const onTurnEnd = (message: TurnEnd) => {
      this.usage = UsageTotals.add(this.usage, message.usage);
      const responseId = message.responseId;
      billing.track(responseId)?.then((generation) => {
        if (generation !== null && responseId) billed.attach(responseId, generation);
      });
    };
    const wrapUp = new RunWrapUp(store, runs, runId, this.deps.listings);
    try {
      const plan = StageOnePlans.of(brief, nodes);
      const outcomes: AgentOutcome[] = [];
      if (plan.champion) outcomes.push(...(await this.step(["champion"], context, onTurnEnd)));
      outcomes.push(...(await this.step(plan.parallel, context, onTurnEnd)));
      const errors = outcomes.filter((o) => o.error).map((o) => `${o.agentId}: ${o.error}`).join("; ");
      new RunSettlement(store, runs, runId, new LedgerPacket(store.findings, runId, { brief, nodes })).settle(
        StageOneRun.output(outcomes),
        { ...this.usage, pricing: chain.pricing },
        errors || undefined,
        this.partProblems(),
      );
      await wrapUp.lookUpListings(nodes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`research run ${runId}: stage 1 failed`, error);
      store.updateRun(runId, { status: "failed", error: `agent failed: ${message}`, usage: { ...this.usage, pricing: chain.pricing }, ended_at: Clock.nowIso() });
      runs.emit(runId, "run.failed", { error: message });
    } finally {
      await wrapUp.recordBilling(billing);
      runs.closeSubscribers(runId);
      runs.remove(runId);
    }
  }

  private async step(ids: readonly StageOneAgent[], context: StageOneRunContext, onTurnEnd: (message: TurnEnd) => void): Promise<AgentOutcome[]> {
    Trace.line(import.meta.url, "StageOneRun.step", { ids });
    const driver = new AgentDriver(this.deps.store, this.deps.runs, this.deps.retry, this.run.runId, this.run.chain);
    const drive = async (id: StageOneAgent): Promise<AgentOutcome[]> => {
      if (this.stopped) return [];
      const built = this.deps.factory.build(id, context);
      this.checks.set(id, built.check);
      this.live.set(id, built.agent);
      try {
        return [await driver.drive(id, built, () => this.passed.has(id), onTurnEnd)];
      } finally {
        this.live.delete(id);
        context.roster.end(id);
      }
    };
    return (await Promise.all(ids.map(drive))).flat();
  }

  /** Each agent's own check, run again on the settled ledger: a part that never passed is not rescued by another agent's rows. */
  private partProblems(): string[] {
    Trace.line(import.meta.url, "StageOneRun.partProblems", { agents: [...this.checks.keys()] });
    return [...this.checks].flatMap(([id, check]) => check.problems().map((problem) => `${id}: ${problem}`));
  }

  private static output(outcomes: readonly AgentOutcome[]): string {
    Trace.line(import.meta.url, "StageOneRun.output", { agents: outcomes.length });
    return outcomes.filter((o) => o.text.trim()).map((o) => `[${o.agentId}]\n${o.text.trim()}`).join("\n\n");
  }
}
