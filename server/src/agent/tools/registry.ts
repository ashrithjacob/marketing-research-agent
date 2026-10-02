import type { AgentTool } from "@earendil-works/pi-agent-core";

import { AmazonProducts, MeteredActorRunner } from "../../adapters/apify/index.js";
import { Corpus } from "../../adapters/corpus.js";
import { OpenRouterGate } from "../../adapters/fetch-gate.js";
import { MeteredAdLibrary, MeteredDiscovery, MeteredPageFetcher, MeteredWebSearch } from "../../adapters/metered.js";
import type { ServiceClients } from "../../adapters/service-clients.js";
import type { Settings } from "../../config/index.js";
import type { ChargeMeter, DiscoveryQuestion, ToolName } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import {
  AD_LIBRARY_LINE,
  AMAZON_SEARCH_LINE,
  DISCOVER_LINE,
  EVIDENCE_FETCH_LINE,
  EVIDENCE_SEARCH_LINE,
  WEB_FETCH_LINE,
  WEB_SEARCH_LINE,
} from "../prompt/text/tool-lines.js";
import { AdLibraryTool } from "./ad-library-tool.js";
import { DiscoverCompetitorsTool } from "./discover-competitors-tool.js";
import { EvidenceSearchTool } from "./evidence-search-tool.js";
import { FindProductTool } from "./find-product-tool.js";
import type { FetchRecord } from "./lanes.js";
import { WebFetchTool } from "./web-fetch-tool.js";
import { WebSearchTool } from "./web-search-tool.js";

/** A research tool and the line the system prompt lists it with. */
export interface BuiltTool {
  tool: AgentTool<any>;
  line: string;
}

/** What one agent's tools need from its run. */
export interface ToolContext {
  runId: string;
  subject: string;
  market: string;
  discovery: DiscoveryQuestion | null;
  meter: ChargeMeter;
  onFetch?: (record: FetchRecord) => void;
}

/** Builds the research tools a role names, in its order, each charging what it spends to the agent's meter; a tool whose service is not configured, or whose input the run lacks, is left out, not stubbed. `wait_for` is a ledger tool and is built with the ledger's. */
export class ToolRegistry {
  constructor(
    private readonly services: ServiceClients,
    private readonly settings: Settings,
  ) {}

  build(names: readonly ToolName[], run: ToolContext): BuiltTool[] {
    Trace.line(import.meta.url, "ToolRegistry.build", { names });
    return names.flatMap((name) => {
      const built = this.one(name, run);
      return built ? [built] : [];
    });
  }

  private one(name: ToolName, run: ToolContext): BuiltTool | null {
    Trace.line(import.meta.url, "ToolRegistry.one", { name });
    const { services, settings } = this;
    const { prices } = settings;
    const { meter } = run;
    const corpus = new Corpus(settings.corpusPath);
    switch (name) {
      case "web_search":
        return { tool: new WebSearchTool(new MeteredWebSearch(services.search, prices, meter)).tool(), line: WEB_SEARCH_LINE };
      case "web_fetch": {
        const gate = settings.gateModel ? new OpenRouterGate(settings) : undefined;
        const pages = new MeteredPageFetcher(services.pages, prices, meter);
        return { tool: new WebFetchTool(settings, pages, corpus, run.runId, run.onFetch, gate, run.subject, run.market).tool(), line: WEB_FETCH_LINE };
      }
      case "evidence_search":
        return { tool: new EvidenceSearchTool(new MeteredWebSearch(services.evidence.search, prices, meter), corpus, run.runId).tool(), line: EVIDENCE_SEARCH_LINE };
      case "evidence_fetch": {
        const pages = new MeteredPageFetcher(services.evidence.pages, prices, meter);
        return { tool: new WebFetchTool(settings, pages, corpus, run.runId, run.onFetch, undefined, run.subject, run.market).tool(), line: EVIDENCE_FETCH_LINE };
      }
      case "discover_competitors":
        return services.discovery && run.discovery
          ? { tool: new DiscoverCompetitorsTool(new MeteredDiscovery(services.discovery, prices, meter), run.discovery, corpus, run.runId).tool(), line: DISCOVER_LINE }
          : null;
      case "ad_library_search":
        return services.ads ? { tool: new AdLibraryTool(new MeteredAdLibrary(services.ads, prices, meter), corpus, run.runId).tool(), line: AD_LIBRARY_LINE } : null;
      case "amazon_find_product":
        return services.actors ? { tool: new FindProductTool(new AmazonProducts(new MeteredActorRunner(services.actors, meter))).tool(), line: AMAZON_SEARCH_LINE } : null;
      case "wait_for":
        return null;
    }
  }
}
