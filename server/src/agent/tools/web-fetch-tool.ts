import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { PageFetcher } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import { EXTERNAL_NOTE } from "../prompt/text/external.js";

import type { UrlLedger } from "./url-ledger.js";
import { fetchParameters } from "./tool-parameters.js";

/** Reads one page and remembers that this agent read it; a page longer than the limit is cut, and says so. */
export class WebFetchTool {
  constructor(
    private readonly pages: PageFetcher,
    private readonly urls: UrlLedger,
    private readonly charLimit: number,
  ) {}

  tool(): AgentTool<typeof fetchParameters> {
    Trace.line(import.meta.url, "WebFetchTool.tool");
    const { pages, urls, charLimit } = this;
    return {
      name: "web_fetch",
      label: "Fetch page",
      description: "Read one url as text. Only pages read with this tool may be cited as a source_url.",
      parameters: fetchParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "WebFetchTool.tool.execute", { url: params.url });
        const { text, title } = await pages.scrape(params.url, signal);
        urls.read(params.url);
        const cut = text.length > charLimit;
        const shown = cut ? `${text.slice(0, charLimit)}\n[cut at ${charLimit} of ${text.length} characters]` : text;
        return {
          content: [{ type: "text", text: `url: ${params.url}\ntitle: ${title}\n\n<page>\n${shown}\n</page>\n${EXTERNAL_NOTE}` }],
          details: { url: params.url, title, chars: text.length, cut },
        };
      },
    };
  }
}
