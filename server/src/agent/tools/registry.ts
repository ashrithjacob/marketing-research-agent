import type { AgentTool } from "@earendil-works/pi-agent-core";

import { AmazonProducts, MeteredActorRunner, type ActorCharge, type ActorRunner } from "../../adapters/apify/index.js";
import { Corpus } from "../../adapters/corpus.js";
import { OpenRouterGate } from "../../adapters/fetch-gate.js";
import type { ServiceClients } from "../../adapters/service-clients.js";
import type { Settings } from "../../config/index.js";
import type { DiscoveryQuestion, ToolName } from "../../domain/index.js";
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
  onApifyCharge?: (charge: ActorCharge) => void;
  onFetch?: (record: FetchRecord) => void;
}

/** Builds the research tools a role names, in its order; a tool whose service is not configured, or whose input the run lacks, is left out, not stubbed. `wait_for` is a ledger tool and is built with the ledger's. */
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
    const corpus = new Corpus(settings.corpusPath);
    switch (name) {
      case "web_search":
        return { tool: new WebSearchTool(services.search).tool(), line: WEB_SEARCH_LINE };
      case "web_fetch": {
        const gate = settings.gateModel ? new OpenRouterGate(settings) : undefined;
        return { tool: new WebFetchTool(settings, services.pages, corpus, run.runId, run.onFetch, gate, run.subject, run.market).tool(), line: WEB_FETCH_LINE };
      }
      case "evidence_search":
        return { tool: new EvidenceSearchTool(services.evidence.search, corpus, run.runId).tool(), line: EVIDENCE_SEARCH_LINE };
      case "evidence_fetch":
        return { tool: new WebFetchTool(settings, services.evidence.pages, corpus, run.runId, run.onFetch, undefined, run.subject, run.market).tool(), line: EVIDENCE_FETCH_LINE };
      case "discover_competitors":
        return services.discovery && run.discovery
          ? { tool: new DiscoverCompetitorsTool(services.discovery, run.discovery, corpus, run.runId).tool(), line: DISCOVER_LINE }
          : null;
      case "ad_library_search":
        return services.ads ? { tool: new AdLibraryTool(services.ads, corpus, run.runId).tool(), line: AD_LIBRARY_LINE } : null;
      case "amazon_find_product":
        return services.actors ? { tool: new FindProductTool(new AmazonProducts(this.runner(run))).tool(), line: AMAZON_SEARCH_LINE } : null;
      case "wait_for":
        return null;
    }
  }

  private runner(run: ToolContext): ActorRunner {
    Trace.line(import.meta.url, "ToolRegistry.runner");
    const actors = this.services.actors!;
    return run.onApifyCharge ? new MeteredActorRunner(actors, run.onApifyCharge) : actors;
  }
}
