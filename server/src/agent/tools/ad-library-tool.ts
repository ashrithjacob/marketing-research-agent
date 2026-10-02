import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { Corpus } from "../../adapters/corpus.js";
import type { AdHit, AdLibrary, AdPage, AdQuery } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { adSearchParameters } from "./parameters.js";

const SHOWN_CHARS = 300;

/** Searches Meta ads (Trendtrack): the search and every ad come back archived with their own source_id, so an ad can be cited as an ad_library source and the match count as a measurement. */
export class AdLibraryTool {
  constructor(
    private readonly ads: AdLibrary,
    private readonly corpus: Corpus,
    private readonly runId: string,
  ) {}

  tool(): AgentTool<typeof adSearchParameters> {
    Trace.line(import.meta.url, "AdLibraryTool.tool");
    const self = this;
    return {
      name: "ad_library_search",
      label: "Meta ad search",
      description:
        "Search Meta (Facebook and Instagram) ads, live and past, in Trendtrack's index: who runs them, the copy, where each ad lands, " +
        "when it was first and last seen, its reach. The advertiser is often a persona page; the landing domain names the brand. " +
        "Every ad comes back with a source_id to record as an ad_library source.",
      parameters: adSearchParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "AdLibraryTool.tool.execute", { params });
        const query: AdQuery = {
          terms: [params.query],
          searchIn: params.search_in ?? "ad_copy",
          countries: (params.countries ?? []).map((code) => code.toUpperCase()),
          limit: Math.min(Math.max(Math.trunc(params.max_results ?? 10), 1), 20),
        };
        const page = await self.ads.search(query, signal);
        const { text, sources } = await self.render(query, page);
        return { content: [{ type: "text", text }], details: { query, total: page.total, hits: page.hits, sources } };
      },
    };
  }

  private async render(query: AdQuery, page: AdPage): Promise<{ text: string; sources: string[] }> {
    Trace.line(import.meta.url, "AdLibraryTool.render", { total: page.total, hits: page.hits.length });
    const search = await this.corpus.write(this.runId, JSON.stringify({ query, total: page.total, ad_ids: page.hits.map((h) => h.ad_id) }, null, 2));
    const ads = await Promise.all(page.hits.map((hit) => this.corpus.write(this.runId, AdLibraryTool.archived(hit))));
    const where = query.countries.length > 0 ? query.countries.join(", ") : "every country";
    const head =
      `${page.total} Meta ads in Trendtrack's index match ${JSON.stringify(query.terms.join(" "))} in ${query.searchIn}, ${where}; ` +
      `${page.hits.length} shown, by reach. This search is archived as source_id ${search.sourceId}: cite it for the count.`;
    const rows = page.hits.map((hit, i) => AdLibraryTool.row(i + 1, hit, ads[i]!.sourceId));
    return { text: [head, ...rows].join("\n\n"), sources: [search.sourceId, ...ads.map((ad) => ad.sourceId)] };
  }

  private static row(n: number, hit: AdHit, sourceId: string): string {
    Trace.tick(import.meta.url, "AdLibraryTool.row", {});
    const body = hit.body.replace(/\s+/g, " ").trim();
    return [
      `${n}. ${hit.advertiser} — lands on ${hit.landing_domain || "no landing page"} (${hit.status}, first seen ${hit.first_seen || "?"}, last seen ${hit.last_seen || "?"}; ${hit.countries.join(", ") || "countries unknown"})`,
      `   ${hit.landing_url}`,
      `   page: ${hit.page_live_ads ?? "?"} live ads, reach ${hit.page_reach_30d ?? "?"} in 30 days; this ad's reach ${hit.ad_reach ?? "?"}`,
      `   source_id: ${sourceId} — record_source it as kind "ad_library" with first_seen ${hit.first_seen || "null"}`,
      `   "${body.slice(0, SHOWN_CHARS)}${body.length > SHOWN_CHARS ? "…" : ""}"`,
    ].join("\n");
  }

  private static archived(hit: AdHit): string {
    Trace.tick(import.meta.url, "AdLibraryTool.archived", {});
    return [
      `# Meta ad ${hit.ad_id} — ${hit.advertiser} (Facebook page ${hit.page_id})`,
      `landing: ${hit.landing_url}`,
      `status: ${hit.status}; first seen ${hit.first_seen}; last seen ${hit.last_seen}; countries ${hit.countries.join(", ")}`,
      `reach: ad ${hit.ad_reach ?? "?"}; page ${hit.page_reach_30d ?? "?"} in 30 days, ${hit.page_live_ads ?? "?"} live ads`,
      "",
      hit.body,
    ].join("\n");
  }
}
