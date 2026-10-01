import { Agent } from "@earendil-works/pi-agent-core";
import type { Models } from "@earendil-works/pi-ai";

import type { ServiceClients } from "../adapters/service-clients.js";
import type { Settings } from "../config/index.js";
import {
  PRODUCT_TRUTH_AGENT_SPECS,
  STAGE_NODES,
  productTruthPacketSchema,
  type Brief,
  type Judgement,
  type LlmCall,
  type ProductTruthAgent,
  type ResearchStore,
  type StagePacket,
} from "../domain/index.js";
import { ProductTruthAssembly } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { AgentRoster } from "./agent-roster.js";
import { CallSequence, LlmCallLog } from "./llm-call-log.js";
import type { ModelChain } from "./model-chain.js";
import { ProductTruthDone } from "./product-truth-done.js";
import type { ProductTruthPrompts } from "./prompt/index.js";
import { RowRepair } from "./row-repair.js";
import { RunFindings } from "./run-findings.js";
import type { BuiltAgent } from "./stage-one-agent-factory.js";
import { ToolSteps } from "./tool-steps.js";
import { ResearchToolset } from "./tools/index.js";
import { TruthLimitClose } from "./truth-limit-close.js";
import { TurnBudget } from "./turn-budget.js";

export interface ProductTruthRunContext {
  runId: string;
  sourceRunId: string;
  brief: Brief;
  markets: readonly string[];
  stageOne: StagePacket;
  rejectKinds: readonly string[];
  judgements: readonly Judgement[];
  chain: ModelChain;
  sequence: CallSequence;
  roster: AgentRoster;
  onCall: (call: LlmCall) => void;
  onChecked: (agentId: string, valid: boolean, problems: readonly string[]) => void;
}

/** Builds one product-truth agent: its record kinds and Parallel-backed tools, its prompt with what the agents before it recorded, its calls logged under its id. */
export class ProductTruthAgentFactory {
  constructor(
    private readonly settings: Settings,
    private readonly store: ResearchStore,
    private readonly models: Models,
    private readonly services: ServiceClients,
    private readonly prompts: ProductTruthPrompts,
  ) {}

  build(id: ProductTruthAgent, run: ProductTruthRunContext): BuiltAgent {
    Trace.line(import.meta.url, "ProductTruthAgentFactory.build", { id, runId: run.runId });
    const spec = PRODUCT_TRUTH_AGENT_SPECS[id];
    const nodes = STAGE_NODES[2];
    const findings = new RunFindings(this.store.findings, run.runId, id, nodes, run.markets);
    const steps = new ToolSteps();
    const check = new ProductTruthDone(findings, id, run.markets);
    const budget = new TurnBudget(spec.maxTurns);
    const streamFn = new LlmCallLog({ runId: run.runId, agentId: id, sequence: run.sequence, store: this.store, onCall: run.onCall })
      .wrap((m, c, o) => this.models.streamSimple(m, c, { ...o, onPayload: run.chain.withFallbacks(o?.onPayload) }));
    const tools = new ResearchToolset({
      settings: this.settings,
      runId: run.runId,
      services: this.services,
      evidence: true,
      subject: run.brief.product || run.brief.url,
      market: run.brief.market,
      steps,
      ledger: { findings, records: spec.records, check, onChecked: (valid, problems) => run.onChecked(id, valid, problems) },
    }).build();
    const agent = new Agent({
      streamFn,
      sessionId: `research-${run.runId}-${id}`,
      initialState: { systemPrompt: this.prompts.system(id), model: run.chain.current, tools },
      finishTurn: budget.finishTurn,
    });
    const sofar = productTruthPacketSchema.parse(
      new ProductTruthAssembly(findings.rows()).draft({ runId: run.runId, sourceRunId: run.sourceRunId, brief: run.brief, nodes: [] }),
    );
    const instructions = this.prompts.instructions(id, { ...run, sofar });
    const part = { agent: id, node: spec.node, markets: run.markets };
    const closeOnLimit = () => new TruthLimitClose(findings, new RowRepair(this.store.findings, run.runId, nodes), check, part, spec.maxTurns).close();
    return { agent, instructions, steps, check, budget, closeOnLimit };
  }
}
