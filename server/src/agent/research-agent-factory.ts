import { Agent } from "@earendil-works/pi-agent-core";
import type { Models } from "@earendil-works/pi-ai";

import type { ActorCharge } from "../adapters/apify/index.js";
import {
  DiscoveryQuestions,
  RoleRecords,
  Roles,
  type Brief,
  type Judgement,
  type LlmCall,
  type Node,
  type ResearchStore,
  type RoleSpec,
} from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { AgentRoster } from "./agent-roster.js";
import type { BuiltAgent } from "./built-agent.js";
import { CallSequence, LlmCallLog } from "./llm-call-log.js";
import type { ModelChain } from "./model-chain.js";
import type { RoleBriefing } from "./prompt/index.js";
import { RoleChecks } from "./role-checks.js";
import { RowRepair } from "./row-repair.js";
import { RunFindings } from "./run-findings.js";
import { ToolSteps } from "./tool-steps.js";
import { LedgerToolset, TracedTool, type ToolRegistry } from "./tools/index.js";
import { TurnBudget } from "./turn-budget.js";

/** What every role's agent needs from the run it belongs to, whichever stage. */
export interface RoleContext {
  runId: string;
  brief: Brief;
  nodes: readonly Node[];
  markets: readonly string[];
  rejectKinds: readonly string[];
  judgements: readonly Judgement[];
  chain: ModelChain;
  sequence: CallSequence;
  roster: AgentRoster;
  briefing: RoleBriefing;
  pollMs?: number;
  onCall: (call: LlmCall) => void;
  onChecked: (agentId: string, valid: boolean, problems: readonly string[]) => void;
  onApifyCharge?: (charge: ActorCharge) => void;
}

/** Builds the agent for any role: its tools by name, its prompt around them, its record kinds, its finish check, its turn limit. */
export class ResearchAgentFactory {
  constructor(
    private readonly store: ResearchStore,
    private readonly models: Models,
    private readonly tools: ToolRegistry,
  ) {}

  build(role: RoleSpec, run: RoleContext): BuiltAgent {
    Trace.line(import.meta.url, "ResearchAgentFactory.build", { role: role.id, runId: run.runId });
    const findings = new RunFindings(this.store.findings, run.runId, role.id, Roles.scope(role, run.nodes), run.markets);
    const check = RoleChecks.done(role, findings, run);
    const budget = new TurnBudget(role.maxTurns);
    const steps = new ToolSteps();
    const research = this.tools.build(role.tools, {
      runId: run.runId,
      subject: run.brief.product || run.brief.url,
      market: run.brief.market,
      discovery: DiscoveryQuestions.of(findings.live(), run.brief),
      ...(run.onApifyCharge ? { onApifyCharge: run.onApifyCharge } : {}),
    });
    const ledger = new LedgerToolset({
      findings,
      records: RoleRecords.of(role),
      check,
      onChecked: (valid, problems) => run.onChecked(role.id, valid, problems),
      ...(role.tools.includes("wait_for") ? { roster: run.roster } : {}),
      ...(run.pollMs !== undefined ? { pollMs: run.pollMs } : {}),
    }).build();
    const agent = new Agent({
      streamFn: new LlmCallLog({ runId: run.runId, agentId: role.id, sequence: run.sequence, store: this.store, onCall: run.onCall })
        .wrap((m, c, o) => this.models.streamSimple(m, c, { ...o, onPayload: run.chain.withFallbacks(o?.onPayload) })),
      sessionId: `research-${run.runId}-${role.id}`,
      initialState: {
        systemPrompt: run.briefing.system(role, research.map((built) => built.line).join("")),
        model: run.chain.current,
        tools: [...research.map((built) => built.tool), ...ledger].map((tool) => TracedTool.wrap(tool, steps)),
      },
      finishTurn: budget.finishTurn,
    });
    const instructions = run.briefing.instructions(role, findings.rows());
    const closeOnLimit = RoleChecks.closer(role, findings, new RowRepair(this.store.findings, run.runId, run.nodes), check, run);
    return { agent, instructions, steps, check, budget, closeOnLimit };
  }
}
