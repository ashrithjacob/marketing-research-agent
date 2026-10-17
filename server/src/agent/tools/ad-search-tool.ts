import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { AdHit, AdLibrary, AdQuery } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import { EXTERNAL_NOTE } from "../prompt/text/external.js";

import { adSearchParameters } from "./tool-parameters.js";
import type { UrlLedger } from "./url-ledger.js";

/** Searches Meta ads in TrendTrack's index, in the run's markets: who advertises in a niche and where their ads land. */
export class AdSearchTool {
  static readonly SHOWN_CHARS = 300;

  constructor(
    private readonly ads: AdLibrary,
    private readonly countries: readonly string[],
    private readonly urls: UrlLedger,
  ) {}

  tool(): AgentTool<typeof adSearchParameters> {
    Trace.line(import.meta.url, "AdSearchTool.tool");
    const { ads, countries, urls } = this;
    return {
      name: "ad_search",
      label: "Meta ad search",
      description: "Search Meta ads, live and past, in TrendTrack's index: the advertiser, the copy, the landing page, when it ran, its reach. The landing domain names the brand.",
      parameters: adSearchParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "AdSearchTool.tool.execute", { query: params.query });
        const query: AdQuery = {
          terms: [params.query],
          searchIn: params.search_in ?? "ad_copy",
          countries,
          limit: Math.min(Math.max(Math.trunc(params.max_results ?? 10), 1), 20),
        };
        const page = await ads.search(query, signal);
        urls.saw(page.hits.map((hit) => hit.landing_url).filter((url) => url !== ""));
        const rows = page.hits.map((hit, i) => AdSearchTool.row(i + 1, hit));
        const text = [`${page.total} ads match; ${page.hits.length} shown.`, ...rows, EXTERNAL_NOTE].join("\n\n");
        return { content: [{ type: "text", text }], details: { total: page.total, hits: page.hits } };
      },
    };
  }

  private static row(n: number, hit: AdHit): string {
    Trace.tick(import.meta.url, "AdSearchTool.row");
    const body = hit.body.replace(/\s+/g, " ").trim();
    return [
      `${n}. ${hit.advertiser}, lands on ${hit.landing_domain || "no landing page"} (${hit.status}, first seen ${hit.first_seen || "?"}, last seen ${hit.last_seen || "?"})`,
      `   ${hit.landing_url}`,
      `   "${body.slice(0, AdSearchTool.SHOWN_CHARS)}${body.length > AdSearchTool.SHOWN_CHARS ? "…" : ""}"`,
    ].join("\n");
  }
}
