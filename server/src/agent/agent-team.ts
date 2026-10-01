import type { Agent } from "@earendil-works/pi-agent-core";
import type { Usage } from "@earendil-works/pi-ai";

import { RunBilling, type OpenRouterPrices } from "../adapters/index.js";
import type { CheckProblem, LlmCall, ResearchStore } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { AgentDriver, type AgentOutcome } from "./agent-driver.js";
import type { AgentRoster } from "./agent-roster.js";
import { BilledCosts } from "./billed-costs.js";
import type { DoneCheck } from "./done-check.js";
import type { TurnEnd } from "./event-recorder.js";
import type { LiveRuns } from "./live-runs.js";
import type { ModelChain } from "./model-chain.js";
import type { RetryPolicy } from "./retry.js";
import type { BuiltAgent } from "./stage-one-agent-factory.js";
import { UsageTotals } from "./usage.js";

/** One agent of a run and the agents whose end it waits for. */
export interface TeamMember<Id extends string> {
  id: Id;
  after: readonly Id[];
}

/** A run's agents on one ledger: each starts once the agents it waits for have ended; stopped, steered, checked and billed together. */
export class AgentTeam {
  private readonly live = new Map<string, Agent>();
  private readonly passed = new Set<string>();
  private readonly checks = new Map<string, DoneCheck>();
  private stopped = false;
  private usage = UsageTotals.empty();
  readonly billing: RunBilling;
  private readonly billed: BilledCosts;

  constructor(
    private readonly deps: { store: ResearchStore; runs: LiveRuns; costs: OpenRouterPrices; retry: RetryPolicy },
    private readonly runId: string,
    private readonly chain: ModelChain,
  ) {
    Trace.line(import.meta.url, "AgentTeam.constructor", { runId });
    this.billing = new RunBilling(deps.costs);
    this.billed = new BilledCosts(deps.store, deps.runs, runId);
  }

  readonly abort = (): void => {
    Trace.line(import.meta.url, "AgentTeam.abort", { live: [...this.live.keys()] });
    this.stopped = true;
    for (const agent of this.live.values()) agent.abort();
  };

  readonly steer = (text: string): void => {
    Trace.line(import.meta.url, "AgentTeam.steer", { live: [...this.live.keys()] });
    for (const agent of this.live.values()) agent.steer({ role: "user", content: [{ type: "text", text }], timestamp: Date.now() });
  };

  readonly onCall = (call: LlmCall): void => {
    Trace.line(import.meta.url, "AgentTeam.onCall", { seq: call.seq });
    this.billed.onCall(call);
  };

  readonly onChecked = (agentId: string, valid: boolean, problems: readonly string[]): void => {
    Trace.line(import.meta.url, "AgentTeam.onChecked", { agentId, valid, problems });
    if (valid) this.passed.add(agentId);
    this.deps.store.addPacketCheck(this.runId, valid, problems);
    this.deps.runs.emit(this.runId, "packet.checked", { agent_id: agentId, valid, problems: [...problems] });
  };

  get totals(): Usage {
    Trace.line(import.meta.url, "AgentTeam.totals");
    return this.usage;
  }

  async run<Id extends string>(members: readonly TeamMember<Id>[], build: (id: Id) => BuiltAgent, roster: AgentRoster): Promise<AgentOutcome[]> {
    Trace.line(import.meta.url, "AgentTeam.run", { members });
    const driver = new AgentDriver(this.deps.store, this.deps.runs, this.deps.retry, this.runId, this.chain);
    const inPlan = new Set<string>(members.map((m) => m.id));
    const started = new Map<Id, Promise<AgentOutcome[]>>();
    const start = (member: TeamMember<Id>): Promise<AgentOutcome[]> => {
      const begun = started.get(member.id);
      if (begun) return begun;
      const waits = members.filter((m) => member.after.includes(m.id) && inPlan.has(m.id));
      const outcome = Promise.all(waits.map(start)).then(() => this.drive(driver, member.id, build, roster));
      started.set(member.id, outcome);
      return outcome;
    };
    return (await Promise.all(members.map(start))).flat();
  }

  /** Each agent's own check, run again on the settled ledger: a part that never passed is not rescued by another agent's rows. */
  partProblems(): CheckProblem[] {
    Trace.line(import.meta.url, "AgentTeam.partProblems", { agents: [...this.checks.keys()] });
    return [...this.checks].flatMap(([id, check]) => check.problems().map((problem) => ({ ...problem, text: `${id}: ${problem.text}` })));
  }

  static output(outcomes: readonly AgentOutcome[]): string {
    Trace.line(import.meta.url, "AgentTeam.output", { agents: outcomes.length });
    return outcomes.filter((o) => o.text.trim()).map((o) => `[${o.agentId}]\n${o.text.trim()}`).join("\n\n");
  }

  private async drive<Id extends string>(driver: AgentDriver, id: Id, build: (id: Id) => BuiltAgent, roster: AgentRoster): Promise<AgentOutcome[]> {
    Trace.line(import.meta.url, "AgentTeam.drive", { id });
    if (this.stopped) return [];
    const built = build(id);
    this.checks.set(id, built.check);
    this.live.set(id, built.agent);
    try {
      return [await driver.drive(id, built, () => this.passed.has(id), (message) => this.turnEnded(message))];
    } finally {
      this.live.delete(id);
      roster.end(id);
    }
  }

  private turnEnded(message: TurnEnd): void {
    Trace.line(import.meta.url, "AgentTeam.turnEnded");
    this.usage = UsageTotals.add(this.usage, message.usage);
    const responseId = message.responseId;
    this.billing.track(responseId)?.then((generation) => {
      if (generation !== null && responseId) this.billed.attach(responseId, generation);
    });
  }
}
