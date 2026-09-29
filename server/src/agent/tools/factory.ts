import type { AgentTool } from "@earendil-works/pi-agent-core";

import { AmazonProducts, MeteredActorRunner, type ActorCharge } from "../../adapters/apify/index.js";
import { Corpus } from "../../adapters/corpus.js";
import { OpenRouterGate } from "../../adapters/fetch-gate.js";
import type { ServiceClients } from "../../adapters/service-clients.js";
import type { Settings } from "../../config/index.js";
import type { Node } from "../../domain/index.js";

import type { FetchRecord } from "./lanes.js";
import type { LedgerPacket } from "../ledger-packet.js";
import { RECORD_TOOLS } from "../prompt/text/record-tools.js";
import type { RunFindings } from "../run-findings.js";

import { FinishTool, type FinishHooks } from "./finish-tool.js";
import { RecordTool, RetractTool } from "./ledger-tools.js";
import { FindProductTool } from "./find-product-tool.js";
import { WebFetchTool } from "./web-fetch-tool.js";
import { TracedTool } from "./traced-tool.js";
import { WebSearchTool } from "./web-search-tool.js";
import type { ToolSteps } from "../tool-steps.js";
import { Trace } from "../../trace/index.js";

export interface LedgerOptions {
  nodes: readonly Node[];
  findings: RunFindings;
  packet: LedgerPacket;
  hooks: FinishHooks;
}

export interface ToolsetOptions {
  settings: Settings;
  runId: string;
  services: ServiceClients;
  findings?: LedgerOptions;
  onFetch?: (record: FetchRecord) => void;
  onApifyCharge?: (charge: ActorCharge) => void;
  productSearch?: boolean;
  subject?: string;
  market?: string;
  steps?: ToolSteps;
}

/** The tools one stage-1 run gets. Amazon search is offered only to a competitors run, and only with an Apify runner: withheld, not stubbed. */
export class ResearchToolset {
  constructor(private readonly options: ToolsetOptions) {}

  build(): AgentTool<any>[] {
    Trace.line(import.meta.url, "ResearchToolset.build");
    const steps = this.options.steps;
    const tools = this.tools();
    return steps ? tools.map((tool) => TracedTool.wrap(tool, steps)) : tools;
  }

  private tools(): AgentTool<any>[] {
    Trace.line(import.meta.url, "ResearchToolset.tools");
    const { settings, runId, onFetch, services } = this.options;
    const bare = this.options.productSearch ? services.actors : null;
    const onCharge = this.options.onApifyCharge;
    const runner = bare && onCharge ? new MeteredActorRunner(bare, onCharge) : bare;
    const gate = settings.gateModel ? new OpenRouterGate(settings) : undefined;
    const web = [
      new WebSearchTool(services.search).tool(),
      new WebFetchTool(settings, services.pages, new Corpus(settings.corpusPath), runId, onFetch, gate, this.options.subject, this.options.market).tool(),
    ];
    const search = runner ? [new FindProductTool(new AmazonProducts(runner)).tool()] : [];
    return [...web, ...search, ...this.ledgerTools()];
  }

  private ledgerTools(): AgentTool<any>[] {
    Trace.line(import.meta.url, "ResearchToolset.ledgerTools");
    const ledger = this.options.findings;
    if (!ledger) return [];
    const competitors = ledger.nodes.includes("competitors");
    const records = RECORD_TOOLS.filter(
      (spec) => competitors || (spec.kind !== "competitor" && spec.kind !== "competitor_reference"),
    ).map((spec) => new RecordTool(spec, ledger.findings).tool());
    return [...records, new RetractTool(ledger.findings).tool(), new FinishTool(ledger.packet, ledger.hooks).tool()];
  }
}
