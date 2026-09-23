import type { AgentTool } from "@earendil-works/pi-agent-core";

import { Corpus } from "../../adapters/corpus.js";
import { Firecrawl } from "../../adapters/firecrawl.js";
import { Searxng } from "../../adapters/searxng.js";
import type { Settings } from "../../config/index.js";

import type { FetchRecord } from "./lanes.js";
import { fetchParameters, searchParameters } from "./parameters.js";

export class WebSearchTool {
  constructor(private readonly search: Searxng) {}

  tool(): AgentTool<typeof searchParameters> {
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
        const max = Math.min(Math.max(Math.trunc(params.max_results ?? 10), 1), 25);
        const hits = await search.find(params.query, max, signal);
        if (hits.length === 0) {
          return {
            content: [{ type: "text", text: `No results for ${JSON.stringify(params.query)}.` }],
            details: { query: params.query, hits: [] },
          };
        }
        const rendered = hits
          .map((hit, index) => `${index + 1}. ${hit.title}\n   ${hit.url}\n   ${hit.snippet}`)
          .join("\n\n");
        return {
          content: [{ type: "text", text: rendered }],
          details: { query: params.query, hits },
        };
      },
    };
  }
}

export class WebFetchTool {
  constructor(
    private readonly settings: Settings,
    private readonly firecrawl: Firecrawl,
    private readonly corpus: Corpus,
    private readonly runId: string,
    private readonly onFetch?: (record: FetchRecord) => void,
  ) {}

  tool(): AgentTool<typeof fetchParameters> {
    const { settings, firecrawl, corpus, runId, onFetch } = this;
    return {
      name: "web_fetch",
      label: "Fetch page",
      description:
        "Fetch one url and return its readable text. The body is archived and " +
        "hashed before you see it; the result carries the source_id to cite. Use " +
        "that id verbatim as the source's `id` and set `archived` to what the " +
        "result reports.",
      parameters: fetchParameters,
      async execute(_id, params, signal) {
        const { text, title } = await firecrawl.scrape(params.url, signal);
        const { sourceId, archived } = await corpus.write(runId, text);
        const truncated = text.length > settings.fetchCharLimit;
        const shown = truncated ? text.slice(0, settings.fetchCharLimit) : text;

        const record: FetchRecord = {
          source_id: sourceId,
          url: params.url,
          title,
          archived,
          chars: text.length,
          truncated,
        };
        onFetch?.(record);

        const header = [
          `source_id: ${sourceId}`,
          `url: ${params.url}`,
          title ? `title: ${title}` : "",
          `archived: ${archived}`,
          archived
            ? ""
            : "NOTE: the corpus volume could not be written. Record this source " +
              "with archived: false and add a gap entry saying so.",
          truncated
            ? `NOTE: showing the first ${settings.fetchCharLimit} of ${text.length} characters. ` +
              "The archived copy is complete; character offsets in a locator still refer to it."
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        return {
          content: [{ type: "text", text: `${header}\n\n---\n\n${shown}` }],
          details: record,
        };
      },
    };
  }
}
