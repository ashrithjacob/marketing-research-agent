import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { AdLibrary } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { findAdCategoriesParameters } from "./ad-pull-parameters.js";
import { ToolReply } from "./tool-reply.js";

/** TrendTrack's categories (Google's product taxonomy) whose name or path holds a word, with the ids pull_ads narrows by. Billed per category returned. */
export class AdCategoriesTool {
  static readonly NAME = "find_ad_categories";

  constructor(private readonly ads: AdLibrary) {}

  tool(): AgentTool<typeof findAdCategoriesParameters> {
    Trace.line(import.meta.url, "AdCategoriesTool.tool");
    const { ads } = this;
    return {
      name: AdCategoriesTool.NAME,
      label: "Find ad categories",
      description: "Look up category ids to narrow pull_ads to an advertiser's niche, e.g. 'supplements' or 'health care'. Shows each category's id, path and how many ads carry it. Billed per category returned.",
      parameters: findAdCategoriesParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "AdCategoriesTool.tool.execute", { search: params.search });
        const { categories } = await ads.categories(params.search, signal);
        if (categories.length === 0) return ToolReply.text(`No category matches "${params.search}". Try a broader word.`);
        return ToolReply.text(categories.map((c) => `${c.id}: ${c.path}${c.ads !== null ? ` (${c.ads} ads)` : ""}`).join("\n"), { categories: categories.length });
      },
    };
  }
}
