import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { WebSearch } from "../../domain/index.js";

import { searchParameters } from "./parameters.js";
import { Trace } from "../../trace/index.js";

export class WebSearchTool {
  constructor(private readonly search: WebSearch) {}

  tool(): AgentTool<typeof searchParameters> {
    Trace.line(import.meta.url, "WebSearchTool.tool");
    const search = this.search;
    return {
      name: "web_search",
      label: "Web search",
      description:
        "Search the web and return titles, urls and snippets. Snippets are for " +
        "choosing what to fetch — they are not sources. Never quote a snippet and " +
        "never record a source you have not fetched with web_fetch.",
      parameters: searchParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "WebSearchTool.tool.execute", { params });
        const max = Math.min(Math.max(Math.trunc(params.max_results ?? 10), 1), 25);
        const { hits, report } = await search.find(params.query, max, signal);
        if (hits.length === 0) {
          return {
            content: [{ type: "text", text: `No results for ${JSON.stringify(params.query)}.` }],
            details: { query: params.query, hits: [], service: report },
          };
        }
        const rendered = hits
          .map((hit, index) => `${index + 1}. ${hit.title}\n   ${hit.url}\n   ${hit.snippet}`)
          .join("\n\n");
        return {
          content: [{ type: "text", text: rendered }],
          details: { query: params.query, hits, service: report },
        };
      },
    };
  }
}
