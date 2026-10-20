import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { SearchSuggestions } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import type { MarketLog } from "../stages/market/market-log.js";

import { suggestionsParameters } from "./market-tool-parameters.js";
import { ToolReply } from "./tool-reply.js";

/** What buyers type, as Google's or Amazon's search box completes a seed; free. Each query gets an id to label and to look up volume for. */
export class SuggestionsTool {
  static readonly NAME = "search_suggestions";

  constructor(
    private readonly suggestions: SearchSuggestions,
    private readonly country: string,
    private readonly log: MarketLog,
  ) {}

  tool(): AgentTool<typeof suggestionsParameters> {
    Trace.line(import.meta.url, "SuggestionsTool.tool");
    const self = this;
    return {
      name: SuggestionsTool.NAME,
      label: "Search-box suggestions",
      description: "The searches Google or Amazon suggests for a seed: what buyers actually type. Free. Seed with symptoms (problem aware), the ingredient or product type (solution aware), and brand names (product aware).",
      parameters: suggestionsParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "SuggestionsTool.tool.execute", { seed: params.seed, source: params.source });
        if (!self.log.spend(SuggestionsTool.NAME)) return ToolReply.refused("You have enough suggestions; label them.");
        const kind = params.source === "google" ? "google_query" : "amazon_query";
        const known = new Set(self.log.ofKind(kind).map((item) => item.text.toLowerCase()));
        const fresh = (await self.suggestions.suggest(params.seed, params.source, self.country, signal)).filter((query) => !known.has(query.toLowerCase()));
        const items = fresh.map((query) => self.log.add({ kind, text: query, url: null, brand: null, date: null, days_running: null, active: null, volume: null }, params.source === "google" ? "gq-" : "aq-"));
        if (items.length === 0) return ToolReply.text(`No new ${params.source} suggestions for "${params.seed}".`);
        return ToolReply.external([`${params.source} suggests for "${params.seed}":`, items.map((item) => `[${item.id}] ${item.text}`).join("\n")], { queries: items.length });
      },
    };
  }
}
