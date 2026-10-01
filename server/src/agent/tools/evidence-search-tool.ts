import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { Corpus } from "../../adapters/corpus.js";
import type { SearchHit, SearchPage, WebSearch } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { evidenceSearchParameters } from "./parameters.js";

const SHOWN_CHARS = 2500;

/** Search for product truth: when the service read each page and answers with excerpts, they are archived like a fetched page and come back with a source_id to cite; bare snippets are only for choosing what to fetch. */
export class EvidenceSearchTool {
  constructor(
    private readonly search: WebSearch,
    private readonly corpus: Corpus,
    private readonly runId: string,
  ) {}

  tool(): AgentTool<typeof evidenceSearchParameters> {
    Trace.line(import.meta.url, "EvidenceSearchTool.tool");
    const searcher = this;
    return {
      name: "web_search",
      label: "Web search",
      description:
        "Search the web. Results normally carry excerpts read off each page; those are archived, and each " +
        "result's source_id can be recorded with record_source and cited, like a fetched page. `domains` " +
        "limits the search to those sites — a regulator's own domain, a platform's policy pages. Results " +
        "marked SNIPPETS ONLY are not citable: web_fetch the page first.",
      parameters: evidenceSearchParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "EvidenceSearchTool.tool.execute", { params });
        const max = Math.min(Math.max(Math.trunc(params.max_results ?? 5), 1), 10);
        const page = await searcher.search.find(params.query, max, signal, params.domains ? { domains: params.domains } : undefined);
        const hits = await searcher.archived(page);
        const text = hits.length === 0 ? `No results for ${JSON.stringify(params.query)}.` : EvidenceSearchTool.render(hits, page.excerpted);
        return { content: [{ type: "text", text }], details: { query: params.query, domains: params.domains ?? [], hits, service: page.report } };
      },
    };
  }

  private async archived(page: SearchPage): Promise<Array<SearchHit & { source_id: string; archived: boolean }>> {
    Trace.line(import.meta.url, "EvidenceSearchTool.archived", { hits: page.hits.length, excerpted: page.excerpted });
    return Promise.all(
      page.hits.map(async (hit) => {
        if (!page.excerpted || !hit.snippet.trim()) return { ...hit, source_id: "", archived: false };
        const { sourceId, archived } = await this.corpus.write(this.runId, `# ${hit.title}\n${hit.url}\n\n${hit.snippet}`);
        return { ...hit, source_id: sourceId, archived };
      }),
    );
  }

  private static render(hits: ReadonlyArray<SearchHit & { source_id: string; archived: boolean }>, excerpted: boolean): string {
    Trace.line(import.meta.url, "EvidenceSearchTool.render", { hits: hits.length, excerpted });
    const head = excerpted ? "" : "SNIPPETS ONLY — the excerpt service could not answer; these are not citable. web_fetch a page to cite it.\n\n";
    return head + hits
      .map((hit, i) => {
        const cite = hit.source_id ? `   source_id: ${hit.source_id} (archived: ${hit.archived})\n` : "";
        const body = hit.snippet.length > SHOWN_CHARS ? `${hit.snippet.slice(0, SHOWN_CHARS)}\n   [… ${hit.snippet.length - SHOWN_CHARS} more characters in the archived copy]` : hit.snippet;
        return `${i + 1}. ${hit.title}\n   ${hit.url}\n${cite}\n${body}`;
      })
      .join("\n\n---\n\n");
  }
}
