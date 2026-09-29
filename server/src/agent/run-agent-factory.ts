import { Agent } from "@earendil-works/pi-agent-core";
import type { Models } from "@earendil-works/pi-ai";

import { OpenRouterPrices } from "../adapters/index.js";
import type { ServiceClients } from "../adapters/service-clients.js";
import type { Settings } from "../config/index.js";
import type {
  Brief,
  Judgement,
  Node,
  ResearchStore,
  SourceKind,
} from "../domain/index.js";

import { BilledCosts } from "./billed-costs.js";
import { LedgerPacket } from "./ledger-packet.js";
import { LlmCallLog } from "./llm-call-log.js";
import type { ModelChain } from "./model-chain.js";
import type { LiveRuns } from "./live-runs.js";
import type { PromptBuilder } from "./prompt/index.js";
import type { RetryPolicy } from "./retry.js";
import { RunFindings } from "./run-findings.js";
import { StageOneListings } from "./stage-one-listings.js";
import { RunWatch } from "./run-watch.js";
import { ToolSteps } from "./tool-steps.js";
import { ResearchToolset } from "./tools/index.js";
import { Trace } from "../trace/index.js";

/** Builds one stage-1 run's Agent — priced model, traced stream, the tools its nodes allow — and starts its watch. */
export class RunAgentFactory {
  constructor(
    private readonly settings: Settings,
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    private readonly models: Models,
    private readonly costs: OpenRouterPrices,
    private readonly retry: RetryPolicy,
    private readonly prompts: PromptBuilder,
    private readonly services: ServiceClients,
  ) {
    Trace.line(import.meta.url, "RunAgentFactory.constructor");
  }

  assemble(
    runId: string,
    options: {
      workspaceId: string;
      brief: Brief;
      nodes: readonly Node[];
      rejectKinds: SourceKind[];
      judgements: readonly Judgement[];
      chain: ModelChain;
    },
  ): { agent: Agent; done: Promise<void> } {
    Trace.line(import.meta.url, "RunAgentFactory.assemble", { runId, options });
    const { nodes, chain } = options;
    const findings = new RunFindings(this.store.findings, runId, "parent", nodes);
    const packet = new LedgerPacket(findings, { brief: options.brief, nodes });
    const steps = new ToolSteps();
    const watch = new RunWatch({
      store: this.store,
      runs: this.runs,
      costs: this.costs,
      retry: this.retry,
      runId,
      packet,
      steps,
      chain,
      nodes,
      listings: new StageOneListings(this.store.listings, this.services.actors, this.services.pages, this.settings.apifyConcurrency),
    });
    const billed = new BilledCosts(this.store, this.runs, runId);
    const streamFn = new LlmCallLog({
      runId,
      store: this.store,
      onCall: billed.onCall,
    }).wrap((m, c, o) => this.models.streamSimple(m, c, { ...o, onPayload: chain.withFallbacks(o?.onPayload) }));
    const agent = new Agent({
      streamFn,
      sessionId: `research-${runId}`,
      initialState: {
        systemPrompt: this.prompts.system(nodes),
        model: chain.current,
        tools: new ResearchToolset({
          settings: this.settings,
          runId,
          services: this.services,
          productSearch: nodes.includes("competitors"),
          subject: options.brief.product || options.brief.url,
          market: options.brief.market,
          steps,
          onApifyCharge: (charge) =>
            this.runs.emit(runId, "apify.charged", {
              actor: charge.actor,
              usd: charge.usd,
              status: charge.status,
            }),
          findings: {
            nodes,
            findings,
            packet,
            hooks: {
              onValid: (checked) => watch.settlement.keepValidated(checked),
              onChecked: (valid, problems) => {
                Trace.line(import.meta.url, "RunAgentFactory.assemble.onChecked", { valid, problems });
                this.store.addPacketCheck(runId, valid, problems);
                this.runs.emit(runId, "packet.checked", { valid, problems: [...problems] });
              },
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
