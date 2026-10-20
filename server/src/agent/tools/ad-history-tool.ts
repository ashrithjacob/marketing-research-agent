import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { AdHit, AdLibrary } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import type { MarketLog } from "../stages/market/market-log.js";

import { adHistoryParameters } from "./market-tool-parameters.js";
import { ToolReply } from "./tool-reply.js";

/** A competitor's ads over time, stopped ones included (TrendTrack `status: all`), any format: how its claim escalated. Budgeted; every ad returned is billed. */
export class AdHistoryTool {
  static readonly NAME = "search_ad_history";

  constructor(
    private readonly ads: AdLibrary,
    private readonly countries: readonly string[],
    private readonly log: MarketLog,
  ) {}

  tool(): AgentTool<typeof adHistoryParameters> {
    Trace.line(import.meta.url, "AdHistoryTool.tool");
    const self = this;
    return {
      name: AdHistoryTool.NAME,
      label: "Search a competitor's ad history",
      description: "A competitor's Meta ads by its domain, running and stopped, newest or longest running first, optionally inside a first-seen date window. Shows id, dates, days running, status and the opening. Every ad returned is billed; your calls are limited.",
      parameters: adHistoryParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "AdHistoryTool.tool.execute", { domain: params.domain, sortBy: params.sort_by });
        if (!self.log.spend(AdHistoryTool.NAME)) return ToolReply.refused(`Your ad history budget is spent. Use what you have.`);
        const limit = Math.min(Math.max(Math.trunc(params.limit ?? 10), 1), 20);
        const page = await self.ads.search(
          { terms: [params.domain], searchIn: "domain", countries: self.countries, limit, sortBy: params.sort_by, ...(params.created_after ? { createdAfter: params.created_after } : {}), ...(params.created_before ? { createdBefore: params.created_before } : {}) },
          signal,
        );
        for (const hit of page.hits) self.log.add(AdHistoryTool.item(hit), "");
        const rows = page.hits.map((hit) => `[${hit.ad_id}] ${hit.landing_domain || hit.advertiser} | first seen ${hit.first_seen || "?"}, ${hit.days_running ?? "?"} days, ${hit.status}\n   "${ToolReply.clip(hit.body, 200)}"`);
        return ToolReply.external([`${page.total} ads match; ${page.hits.length} shown. ${self.log.left(AdHistoryTool.NAME)} history searches left.`, ...rows], { shown: page.hits.length });
      },
    };
  }

  static item(hit: AdHit) {
    Trace.tick(import.meta.url, "AdHistoryTool.item");
    return { id: hit.ad_id, kind: "history_ad" as const, text: hit.body, url: hit.landing_url || null, brand: (hit.landing_domain || hit.advertiser).replace(/^www\./, ""), date: hit.first_seen ? hit.first_seen.slice(0, 10) : null, days_running: hit.days_running, active: hit.status === "active", volume: null };
  }
}
