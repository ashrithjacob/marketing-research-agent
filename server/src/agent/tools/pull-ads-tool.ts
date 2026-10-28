import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { Static } from "@earendil-works/pi-ai";

import type { AdHit, AdLibrary, AdQuery } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import type { RingLog } from "../stages/ads/ring-log.js";

import { pullAdsParameters } from "./ad-pull-parameters.js";
import { ToolReply } from "./tool-reply.js";

/** What every pull is held to, whatever the agent asks: the run's markets, still running, image ads with long copy, running long enough to have paid. */
export interface AdPullRules {
  countries: readonly string[];
  minCopyChars: number;
  minDaysRunning: number;
}

/** Searches TrendTrack for long-form statics doing well, under the rules code fixes and the filters the agent picks; every ad shown gets a ref the agent keeps it by. Billed per ad, against the ring's budget. */
export class PullAdsTool {
  static readonly NAME = "pull_ads";
  static readonly DEFAULT_LIMIT = 25;
  static readonly MAX_LIMIT = 50;
  static readonly OPENING_CHARS = 400;

  constructor(
    private readonly ads: AdLibrary,
    private readonly rules: AdPullRules,
    private readonly log: RingLog,
  ) {}

  tool(): AgentTool<typeof pullAdsParameters> {
    Trace.line(import.meta.url, "PullAdsTool.tool");
    const self = this;
    return {
      name: PullAdsTool.NAME,
      label: "Pull long-form ads",
      description: `Search TrendTrack's Meta ads. Every search is already held to: still running, in this run's markets, image ads with ${self.rules.minCopyChars}+ characters of copy, running ${self.rules.minDaysRunning}+ days. Shows each ad's ref, brand, landing domain, days running, duplicates, reach, audience and opening. Every ad returned is billed.`,
      parameters: pullAdsParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "PullAdsTool.tool.execute", { terms: params.terms, sortBy: params.sort_by });
        const page = Math.max(Math.trunc(params.page ?? 1), 1);
        const signature = PullAdsTool.signature(self.query(params, 0, page));
        if (!self.log.claim(signature, page)) return ToolReply.refused(PullAdsTool.repeated(self.query(params, 0, page), page, self.log.idOf(signature)));
        const limit = self.log.reserve(Math.min(Math.max(Math.trunc(params.limit ?? PullAdsTool.DEFAULT_LIMIT), 1), PullAdsTool.MAX_LIMIT));
        if (limit === 0) {
          self.log.unclaim(signature, page);
          return ToolReply.refused("This ring's ad budget is spent. Submit what you have.");
        }
        const query = self.query(params, limit, page);
        const found = await self.ads.search(query, signal).catch((error: unknown) => {
          self.log.release(limit);
          self.log.unclaim(signature, page);
          throw error;
        });
        const { search, refs } = self.log.record(signature, PullAdsTool.label(query), (page - 1) * limit, found, limit);
        const more = search.total - search.seen;
        const head = `Search ${search.id} (${search.label}): ${search.total} ads match; page ${page} shows ${found.hits.length}.${more > 0 ? ` ${more} more on later pages.` : " No more."} ${self.log.ads} ads seen so far; ${self.log.left} ads left in the budget.`;
        return ToolReply.external([head, ...found.hits.map((hit, i) => PullAdsTool.row(refs[i]!, hit))], { total: search.total, shown: found.hits.length });
      },
    };
  }

  private query(params: Static<typeof pullAdsParameters>, limit: number, page: number): AdQuery {
    Trace.line(import.meta.url, "PullAdsTool.query", { limit, page });
    const audience = { ...(params.min_age !== undefined ? { minAge: params.min_age } : {}), ...(params.max_age !== undefined ? { maxAge: params.max_age } : {}), ...(params.sex ? { sex: params.sex } : {}) };
    return {
      terms: (params.terms ?? []).map((term) => term.trim()).filter((term) => term !== ""),
      searchIn: params.search_in ?? "ad_copy",
      keywordMode: params.keyword_mode ?? "any",
      sortBy: params.sort_by ?? "longestRunning",
      countries: this.rules.countries,
      activeOnly: true,
      longForm: { minCopyChars: this.rules.minCopyChars },
      minDaysRunning: Math.max(this.rules.minDaysRunning, Math.trunc(params.min_days_running ?? 0)),
      ...(params.min_duplicates !== undefined ? { minDuplicates: Math.trunc(params.min_duplicates) } : {}),
      ...(params.category_ids && params.category_ids.length > 0 ? { categoryIds: params.category_ids } : {}),
      ...(Object.keys(audience).length > 0 ? { audience } : {}),
      limit,
      page,
    };
  }

  /** Why a search was refused as a repeat, with the settings as received, so an agent whose arguments are being lost can see it. */
  static repeated(query: AdQuery, page: number, earlier: string | null): string {
    Trace.line(import.meta.url, "PullAdsTool.repeated", { page });
    return `Not run: page ${page} of this search was already sent${earlier ? ` as ${earlier}` : " in this turn"}, and is not fetched or billed twice. The settings received were: ${PullAdsTool.label(query)}. If that is not what you meant, your arguments are not arriving as you wrote them; change the search, or ask for the next page.`;
  }

  static signature(query: AdQuery): string {
    Trace.tick(import.meta.url, "PullAdsTool.signature");
    const { page: _page, limit: _limit, ...rest } = query;
    return JSON.stringify(rest);
  }

  static label(query: AdQuery): string {
    Trace.tick(import.meta.url, "PullAdsTool.label");
    const who = query.audience;
    return [
      query.terms.length > 0 ? `${query.searchIn} ${query.terms.map((term) => `"${term}"`).join(query.keywordMode === "all" ? " + " : " or ")}` : "no terms",
      query.sortBy,
      `${query.minDaysRunning}+ days`,
      query.minDuplicates !== undefined ? `${query.minDuplicates}+ duplicates` : "",
      query.categoryIds ? `categories ${query.categoryIds.join(",")}` : "",
      who ? `audience ${who.sex ?? "all"} ${who.minAge ?? "?"}-${who.maxAge ?? "?"}` : "",
    ]
      .filter((part) => part !== "")
      .join(", ");
  }

  static row(ref: string, hit: AdHit): string {
    Trace.tick(import.meta.url, "PullAdsTool.row");
    const audience = hit.age_min === null && hit.age_max === null && !hit.gender ? "audience unknown" : `${hit.gender ?? "all"} ${hit.age_min ?? "?"}-${hit.age_max ?? "?"}`;
    return `[${ref}] ${hit.advertiser} → ${hit.landing_domain || "no landing page"} | ${hit.days_running ?? "?"} days, ${hit.duplicates ?? "?"} duplicates, reach ${hit.ad_reach ?? "?"} | ${audience}\n   "${ToolReply.clip(hit.body, PullAdsTool.OPENING_CHARS)}"`;
  }
}
