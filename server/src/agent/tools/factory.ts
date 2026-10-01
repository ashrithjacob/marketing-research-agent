import type { AgentTool } from "@earendil-works/pi-agent-core";

import { AmazonProducts, MeteredActorRunner, type ActorCharge } from "../../adapters/apify/index.js";
import { Corpus } from "../../adapters/corpus.js";
import { OpenRouterGate } from "../../adapters/fetch-gate.js";
import type { ServiceClients } from "../../adapters/service-clients.js";
import type { Settings } from "../../config/index.js";
import type { FindingKind } from "../../domain/index.js";

import type { AgentRoster } from "../agent-roster.js";
import type { DoneCheck } from "../done-check.js";
import type { FetchRecord } from "./lanes.js";
import { RECORD_TOOLS } from "../prompt/text/record-tools.js";
import { TRUTH_RECORD_TOOLS } from "../prompt/text/truth-record-tools.js";
import type { RunFindings } from "../run-findings.js";

import { FinishTool } from "./finish-tool.js";
import { ReadLedgerTool, WaitForTool } from "./ledger-read-tools.js";
import { RecordTool, RetractTool } from "./ledger-tools.js";
import { FindProductTool } from "./find-product-tool.js";
import { WebFetchTool } from "./web-fetch-tool.js";
import { TracedTool } from "./traced-tool.js";
import { WebSearchTool } from "./web-search-tool.js";
import { EvidenceSearchTool } from "./evidence-search-tool.js";
import type { ToolSteps } from "../tool-steps.js";
import { Trace } from "../../trace/index.js";

export interface LedgerOptions {
  findings: RunFindings;
  records: readonly FindingKind[];
  check: DoneCheck;
  onChecked: (valid: boolean, problems: readonly string[]) => void;
  roster?: AgentRoster;
  pollMs?: number;
}

export interface ToolsetOptions {
  settings: Settings;
  runId: string;
  services: ServiceClients;
  ledger?: LedgerOptions;
  onFetch?: (record: FetchRecord) => void;
  onApifyCharge?: (charge: ActorCharge) => void;
  productSearch?: boolean;
  evidence?: boolean;
  subject?: string;
  market?: string;
  steps?: ToolSteps;
}

/** The tools one agent gets. Amazon search only where its spec allows and an Apify runner exists; wait_for only with a roster of agents to wait on: withheld, not stubbed. */
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
    const { services } = this.options;
    const bare = this.options.productSearch ? services.actors : null;
    const onCharge = this.options.onApifyCharge;
    const runner = bare && onCharge ? new MeteredActorRunner(bare, onCharge) : bare;
    const web = this.options.evidence ? this.evidenceTools() : this.webTools();
    const search = runner ? [new FindProductTool(new AmazonProducts(runner)).tool()] : [];
    return [...web, ...search, ...this.ledgerTools()];
  }

  private webTools(): AgentTool<any>[] {
    Trace.line(import.meta.url, "ResearchToolset.webTools");
    const { settings, runId, onFetch, services } = this.options;
    const gate = settings.gateModel ? new OpenRouterGate(settings) : undefined;
    return [
      new WebSearchTool(services.search).tool(),
      new WebFetchTool(settings, services.pages, new Corpus(settings.corpusPath), runId, onFetch, gate, this.options.subject, this.options.market).tool(),
    ];
  }

  /** Product truth reads regulators, trials and the label through Parallel, with no relevance gate: a regulator's page is not about the product, and must not be filtered as if it should be. */
  private evidenceTools(): AgentTool<any>[] {
    Trace.line(import.meta.url, "ResearchToolset.evidenceTools");
    const { settings, runId, onFetch, services } = this.options;
    const corpus = new Corpus(settings.corpusPath);
    return [
      new EvidenceSearchTool(services.evidence.search, corpus, runId).tool(),
      new WebFetchTool(settings, services.evidence.pages, corpus, runId, onFetch, undefined, this.options.subject, this.options.market).tool(),
    ];
  }

  private ledgerTools(): AgentTool<any>[] {
    Trace.line(import.meta.url, "ResearchToolset.ledgerTools");
    const ledger = this.options.ledger;
    if (!ledger) return [];
    const records = [...RECORD_TOOLS, ...TRUTH_RECORD_TOOLS].filter((spec) => ledger.records.includes(spec.kind)).map((spec) =>
      new RecordTool(spec, ledger.findings).tool(),
    );
    const wait = ledger.roster ? [new WaitForTool(ledger.findings, ledger.roster, ledger.pollMs).tool()] : [];
    return [
      ...records,
      new RetractTool(ledger.findings).tool(),
      new ReadLedgerTool(ledger.findings).tool(),
      ...wait,
      new FinishTool(ledger.check, ledger.onChecked).tool(),
    ];
  }
}
