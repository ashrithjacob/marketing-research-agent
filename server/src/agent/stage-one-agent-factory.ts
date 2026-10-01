import { Agent } from "@earendil-works/pi-agent-core";
import type { Models } from "@earendil-works/pi-ai";

import type { ActorCharge } from "../adapters/apify/index.js";
import type { ServiceClients } from "../adapters/service-clients.js";
import type { Settings } from "../config/index.js";
import {
  STAGE_ONE_AGENT_SPECS,
  StageOnePlans,
  type Brief,
  type Judgement,
  type LlmCall,
  type Node,
  type ResearchStore,
  type StageOneAgent,
} from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { AgentRoster } from "./agent-roster.js";
import { DoneChecks, type DoneCheck } from "./done-check.js";
import { LimitClose, type LimitClosed } from "./limit-close.js";
import { CallSequence, LlmCallLog } from "./llm-call-log.js";
import type { ModelChain } from "./model-chain.js";
import type { PromptBuilder } from "./prompt/index.js";
import { RowRepair } from "./row-repair.js";
import { RunFindings } from "./run-findings.js";
import { ToolSteps } from "./tool-steps.js";
import { TurnBudget } from "./turn-budget.js";
import { ResearchToolset } from "./tools/index.js";

export interface StageOneRunContext {
  runId: string;
  brief: Brief;
  nodes: readonly Node[];
  rejectKinds: readonly string[];
  judgements: readonly Judgement[];
  chain: ModelChain;
  sequence: CallSequence;
  roster: AgentRoster;
  pollMs?: number;
  onCall: (call: LlmCall) => void;
  onApifyCharge: (charge: ActorCharge) => void;
  onChecked: (agentId: string, valid: boolean, problems: readonly string[]) => void;
}

export interface BuiltAgent {
  agent: Agent;
  instructions: string;
  steps: ToolSteps;
  check: DoneCheck;
  budget: TurnBudget;
  closeOnLimit: (() => LimitClosed) | null;
}

/** Builds one stage-1 agent: its spec's tools and record kinds, its own prompt, its calls logged under its id. */
export class StageOneAgentFactory {
  constructor(
    private readonly settings: Settings,
    private readonly store: ResearchStore,
    private readonly models: Models,
    private readonly services: ServiceClients,
    private readonly prompts: PromptBuilder,
  ) {}

  build(id: StageOneAgent, run: StageOneRunContext): BuiltAgent {
    Trace.line(import.meta.url, "StageOneAgentFactory.build", { id, runId: run.runId });
    const spec = STAGE_ONE_AGENT_SPECS[id];
    const findings = new RunFindings(this.store.findings, run.runId, id, [StageOnePlans.nodeOf(id, run.nodes)]);
    const champion = findings.live().find((row) => row.kind === "competitor_reference")?.payload ?? null;
    const amazon = spec.amazon && this.services.actors !== null;
    const waits = id !== "champion";
    const steps = new ToolSteps();
    const check = DoneChecks.of(id, findings, run.brief, run.nodes);
    const budget = new TurnBudget(spec.maxTurns);
    const node = StageOnePlans.nodeOf(id, run.nodes);
    const streamFn = new LlmCallLog({
      runId: run.runId,
      agentId: id,
      sequence: run.sequence,
      store: this.store,
      onCall: run.onCall,
    }).wrap((m, c, o) => this.models.streamSimple(m, c, { ...o, onPayload: run.chain.withFallbacks(o?.onPayload) }));
    const tools = new ResearchToolset({
      settings: this.settings,
      runId: run.runId,
      services: this.services,
      productSearch: amazon,
      subject: run.brief.product || run.brief.url,
      market: run.brief.market,
      steps,
      onApifyCharge: run.onApifyCharge,
      ledger: {
        findings,
        records: spec.records,
        check,
        onChecked: (valid, problems) => run.onChecked(id, valid, problems),
        ...(waits ? { roster: run.roster } : {}),
        ...(run.pollMs !== undefined ? { pollMs: run.pollMs } : {}),
      },
    }).build();
    const agent = new Agent({
      streamFn,
      sessionId: `research-${run.runId}-${id}`,
      initialState: { systemPrompt: this.prompts.system(id, { amazon, waits }), model: run.chain.current, tools },
      finishTurn: budget.finishTurn,
    });
    const instructions = this.prompts.instructions(id, { ...run, champion });
    const closeOnLimit = id === "champion" ? null : () => new LimitClose(findings, new RowRepair(this.store.findings, run.runId, run.nodes), check, node, spec.maxTurns).close();
    return { agent, instructions, steps, check, budget, closeOnLimit };
  }
}
