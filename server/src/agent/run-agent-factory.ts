import { Agent } from "@earendil-works/pi-agent-core";
import type { Api, Model, Models } from "@earendil-works/pi-ai";

import { OpenRouterPrices, type Pricing } from "../adapters/index.js";
import type { Settings } from "../config/index.js";
import type { Brief, Judgement, Node, ResearchStore, SourceKind } from "../domain/index.js";

import { BilledCosts } from "./billed-costs.js";
import { LlmCallLog } from "./llm-call-log.js";
import type { LiveRuns } from "./live-runs.js";
import type { PromptBuilder } from "./prompt/index.js";
import type { RetryPolicy } from "./retry.js";
import { RunWatch } from "./run-watch.js";
import { ResearchToolset } from "./tools/index.js";

/** Builds one run's Agent — priced model, traced stream, the tools its nodes allow — and starts its watch. */
export class RunAgentFactory {
  constructor(
    private readonly settings: Settings,
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    private readonly models: Models,
    private readonly costs: OpenRouterPrices,
    private readonly retry: RetryPolicy,
    private readonly prompts: PromptBuilder,
  ) {}

  assemble<TApi extends Api>(
    runId: string,
    options: {
      brief: Brief;
      nodes: readonly Node[];
      rejectKinds: SourceKind[];
      judgements: readonly Judgement[];
      model: Model<TApi>;
      pricing: Pricing;
    },
  ): { agent: Agent; done: Promise<void> } {
    const { nodes, model, pricing } = options;
    const watch = new RunWatch({
      store: this.store,
      runs: this.runs,
      costs: this.costs,
      retry: this.retry,
      runId,
      nodes,
      pricing,
    });
    const billed = new BilledCosts(this.store, this.runs, runId);
    const streamFn = new LlmCallLog({
      runId,
      store: this.store,
      onCall: billed.onCall,
    }).wrap((m, c, o) => this.models.streamSimple(m, c, o));
    const agent = new Agent({
      streamFn,
      sessionId: `research-${runId}`,
      initialState: {
        systemPrompt: this.prompts.system(nodes),
        model,
        tools: new ResearchToolset({
          settings: this.settings,
          runId,
          reviewTools: nodes.includes("review_mining"),
          productSearch: nodes.includes("competitors"),
          subject: options.brief.product || options.brief.url,
          market: options.brief.market,
          packetCheck: {
            nodes,
            brief: options.brief,
            onValid: (packet) => watch.settlement.keepValidated(packet),
            onChecked: (valid, problems) => {
              this.store.addPacketCheck(runId, valid, problems);
              this.runs.emit(runId, "packet.checked", { valid, problems: [...problems] });
            },
          },
        }).build(),
      },
    });
    const instructions = this.prompts.instructions({
      brief: options.brief,
      rejectKinds: options.rejectKinds,
      judgements: options.judgements,
      nodes,
    });
    return { agent, done: watch.run(agent, instructions, billed.attach) };
  }
}
