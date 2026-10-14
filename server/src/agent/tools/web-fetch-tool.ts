import type { AgentTool } from "@earendil-works/pi-agent-core";

import { Corpus } from "../../adapters/corpus.js";
import type { Settings } from "../../config/index.js";
import type { FetchGate, PageFetcher } from "../../domain/index.js";

import { EXTERNAL_PAGE_NOTE } from "../prompt/text/external.js";

import type { FetchRecord } from "./lanes.js";
import { PlainPage, type PageView } from "./page-views.js";
import { fetchParameters } from "./parameters.js";
import { Trace } from "../../trace/index.js";

export class WebFetchTool {
  constructor(
    private readonly settings: Settings,
    private readonly firecrawl: PageFetcher,
    private readonly corpus: Corpus,
    private readonly runId: string,
    private readonly onFetch?: (record: FetchRecord) => void,
    private readonly gate?: FetchGate,
    private readonly subject = "",
    private readonly market = "",
    private readonly view: PageView = new PlainPage(),
  ) {}

  tool(): AgentTool<typeof fetchParameters> {
    Trace.line(import.meta.url, "WebFetchTool.tool");
    const { settings, firecrawl, corpus, runId, onFetch, gate, subject, market, view } = this;
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
        const { shown, truncated, note } = view.render(text, settings.fetchCharLimit);

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
          note,
        ]
          .filter(Boolean)
          .join("\n");

        return {
          content: [{ type: "text", text: `${header}\n\n<page source_id="${sourceId}">\n${shown}\n</page>\n${EXTERNAL_PAGE_NOTE}` }],
          details: record,
        };
      },
    };
  }
}
