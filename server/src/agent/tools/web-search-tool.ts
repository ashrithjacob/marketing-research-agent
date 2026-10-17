import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { WebSearch } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import { EXTERNAL_NOTE } from "../prompt/text/external.js";

import { searchParameters } from "./tool-parameters.js";
import type { UrlLedger } from "./url-ledger.js";

export class WebSearchTool {
  constructor(
    private readonly search: WebSearch,
    private readonly urls: UrlLedger,
  ) {}

  tool(): AgentTool<typeof searchParameters> {
    Trace.line(import.meta.url, "WebSearchTool.tool");
    const { search, urls } = this;
    return {
      name: "web_search",
      label: "Web search",
      description: "Search the web for titles, urls and snippets. Snippets only help you choose what to read: a fact counts only once you have read its page with web_fetch.",
      parameters: searchParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "WebSearchTool.tool.execute", { query: params.query });
        const max = Math.min(Math.max(Math.trunc(params.max_results ?? 10), 1), 25);
        const { hits } = await search.find(params.query, max, signal);
        urls.saw(hits.map((hit) => hit.url));
        const rendered = hits.map((hit, i) => `${i + 1}. ${hit.title}\n   ${hit.url}\n   ${hit.snippet}`).join("\n\n");
        const text = hits.length === 0 ? `No results for ${JSON.stringify(params.query)}.` : `<search_results>\n${rendered}\n</search_results>\n${EXTERNAL_NOTE}`;
        return { content: [{ type: "text", text }], details: { query: params.query, hits } };
      },
    };
  }
}
