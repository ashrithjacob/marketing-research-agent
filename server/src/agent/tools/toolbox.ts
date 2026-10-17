import type { AgentTool } from "@earendil-works/pi-agent-core";

import { MeteredAdLibrary, MeteredPageFetcher, MeteredWebSearch, type ServiceClients } from "../../adapters/index.js";
import type { Settings } from "../../config/index.js";
import { Markets, type ChargeMeter, type Market } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { AdSearchTool } from "./ad-search-tool.js";
import { WebFetchTool } from "./web-fetch-tool.js";
import { UrlLedger } from "./url-ledger.js";
import { WebSearchTool } from "./web-search-tool.js";

export const TOOL_NAMES = ["web_search", "web_fetch", "ad_search"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

/** One agent's tools, each paid call charged to it, and the urls it has read or seen. */
export interface AgentKit {
  tools: AgentTool<any>[];
  urls: UrlLedger;
}

/** Builds an agent's tools by name over the process's shared service clients; ad_search is left out when TrendTrack has no key. */
export class Toolbox {
  constructor(
    private readonly services: ServiceClients,
    private readonly settings: Settings,
  ) {}

  kit(names: readonly ToolName[], meter: ChargeMeter, markets: readonly Market[]): AgentKit {
    Trace.line(import.meta.url, "Toolbox.kit", { names });
    const { services, settings } = this;
    const urls = new UrlLedger();
    const built: Record<ToolName, () => AgentTool<any> | null> = {
      web_search: () => new WebSearchTool(new MeteredWebSearch(services.search, settings.prices, meter), urls).tool(),
      web_fetch: () => new WebFetchTool(new MeteredPageFetcher(services.pages, settings.prices, meter), urls, settings.fetchCharLimit).tool(),
      ad_search: () => (services.ads ? new AdSearchTool(new MeteredAdLibrary(services.ads, settings.prices, meter), Markets.countries(markets), urls).tool() : null),
    };
    const tools = names.map((name) => built[name]()).filter((tool): tool is AgentTool<any> => tool !== null);
    return { tools, urls };
  }
}
