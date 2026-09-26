import type { AgentTool } from "@earendil-works/pi-agent-core";

import { Corpus } from "../../adapters/corpus.js";
import { Firecrawl } from "../../adapters/firecrawl.js";
import type { Settings } from "../../config/index.js";
import type { FetchGate } from "../../domain/index.js";

import type { FetchRecord } from "./lanes.js";
import { fetchParameters } from "./parameters.js";
import { Trace } from "../../trace/index.js";

export class WebFetchTool {
  constructor(
    private readonly settings: Settings,
    private readonly firecrawl: Firecrawl,
    private readonly corpus: Corpus,
    private readonly runId: string,
    private readonly onFetch?: (record: FetchRecord) => void,
    private readonly gate?: FetchGate,
    private readonly subject = "",
    private readonly market = "",
  ) {}

  tool(): AgentTool<typeof fetchParameters> {
    Trace.line(import.meta.url, "WebFetchTool.tool");
    const { settings, firecrawl, corpus, runId, onFetch, gate, subject, market } = this;
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
        Trace.line(import.meta.url, "WebFetchTool.tool.execute", { params });
        const { text, title } = await firecrawl.scrape(params.url, signal);

        if (gate) {
          const verdict = await gate.admit({
            url: params.url,
            title,
            body: text,
            subject,
            market,
          });
          if (!verdict.admit) {
            const filtered: FetchRecord = {
              source_id: "",
              url: params.url,
              title,
              archived: false,
              chars: text.length,
              truncated: false,
              filtered: true,
              gate_reason: `${verdict.reason} (${verdict.model}, ${verdict.ms}ms)`,
            };
            onFetch?.(filtered);
            return {
              content: [
                {
                  type: "text",
                  text:
                    `FILTERED — a relevance gate read this page before you and ` +
                    `blocked it: ${verdict.reason}. Do not record it as a source ` +
                    "and do not cite it; fetch a different url instead.",
                },
              ],
              details: filtered,
            };
          }
        }

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
