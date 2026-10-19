import type { AgentTool } from "@earendil-works/pi-agent-core";

import { AD_SORTS, type AdHit, type AdLibrary, type AdSort } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import { EXTERNAL_NOTE } from "../prompt/text/external.js";
import type { ScoutLog } from "../stages/ads/scout-log.js";

import { searchLongFormParameters } from "./tool-parameters.js";

/** Searches TrendTrack for long-form image ads in the run's markets, within the scout's search budget; every ad returned is logged, so code can check what the scout keeps. */
export class SearchLongFormTool {
  static readonly SHOWN_CHARS = 220;

  constructor(
    private readonly ads: AdLibrary,
    private readonly countries: readonly string[],
    private readonly minCopyChars: number,
    private readonly log: ScoutLog,
  ) {}

  tool(): AgentTool<typeof searchLongFormParameters> {
    Trace.line(import.meta.url, "SearchLongFormTool.tool");
    const self = this;
    return {
      name: "search_ads",
      label: "Search long-form ads",
      description: `Search Meta long-form image ads (${this.minCopyChars}+ characters of copy) in the run's markets. Returns each ad's id, advertiser, landing domain, days running, duplicates, reach and its growth, audience and opening lines. Every ad returned is billed.`,
      parameters: searchLongFormParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "SearchLongFormTool.tool.execute", { query: params.query, searchIn: params.search_in, sortBy: params.sort_by });
        if (!(AD_SORTS as readonly string[]).includes(params.sort_by)) {
          return { content: [{ type: "text", text: `sort_by ${params.sort_by} is not one TrendTrack accepts; use one of ${AD_SORTS.join(", ")}.` }], details: { refused: true } };
        }
        if (self.log.searchesLeft <= 0) {
          return { content: [{ type: "text", text: `Your search budget (${self.log.budget}) is spent. Use read_ad on ads you have seen, then submit.` }], details: { refused: true } };
        }
        const limit = Math.min(Math.max(Math.trunc(params.limit ?? 10), 1), 20);
        const page = await self.ads.search({ terms: [params.query], searchIn: params.search_in, countries: self.countries, limit, sortBy: params.sort_by as AdSort, longForm: { minCopyChars: self.minCopyChars } }, signal);
        self.log.record(page.hits);
        const rows = page.hits.map(SearchLongFormTool.row);
        const head = `${page.total} long-form ads match; ${page.hits.length} shown. ${self.log.searchesLeft} searches left.`;
        return { content: [{ type: "text", text: [head, ...rows, EXTERNAL_NOTE].join("\n\n") }], details: { total: page.total, shown: page.hits.length } };
      },
    };
  }

  static row(hit: AdHit): string {
    Trace.tick(import.meta.url, "SearchLongFormTool.row");
    const body = hit.body.replace(/\s+/g, " ").trim();
    const audience = hit.age_min !== null || hit.age_max !== null ? `${hit.gender ?? "all"} ${hit.age_min ?? "?"}-${hit.age_max ?? "?"}` : "audience unknown";
    const growth = hit.reach_delta_7d !== null ? `, +${hit.reach_delta_7d} reach in 7 days` : "";
    return [
      `[${hit.ad_id}] ${hit.advertiser} → ${hit.landing_domain || "no landing page"} | ${hit.status}, ${hit.days_running ?? "?"} days, ${hit.duplicates ?? "?"} duplicates, reach ${hit.ad_reach ?? "?"}${growth} | ${audience}`,
      `   "${body.slice(0, SearchLongFormTool.SHOWN_CHARS)}${body.length > SearchLongFormTool.SHOWN_CHARS ? "…" : ""}"`,
    ].join("\n");
  }
}
