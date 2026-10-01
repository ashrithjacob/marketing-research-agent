import type { SearchHit, SearchPage, SearchScope, WebSearch } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ParallelApi } from "./parallel-api.js";

interface ParallelResult {
  url?: string;
  title?: string;
  excerpts?: string[] | null;
}

/** Parallel Search: each hit comes back with the excerpts Parallel read off its page, so they are text that can be archived and cited. */
export class ParallelSearch implements WebSearch {
  constructor(private readonly api: ParallelApi) {}

  async find(query: string, maxResults: number, signal?: AbortSignal, scope?: SearchScope): Promise<SearchPage> {
    Trace.line(import.meta.url, "ParallelSearch.find", { query, maxResults, scope });
    const domains = scope?.domains ?? [];
    const body = await this.api.post(
      "/v1/search",
      {
        objective: query,
        search_queries: [query],
        advanced_settings: { max_results: maxResults, ...(domains.length > 0 ? { source_policy: { include_domains: [...domains] } } : {}) },
      },
      {},
      signal,
    );
    const results = (body.results as ParallelResult[] | undefined) ?? [];
    const hits: SearchHit[] = results.map((r) => ({ title: r.title ?? "", url: r.url ?? "", snippet: (r.excerpts ?? []).join("\n\n...\n\n") }));
    return {
      hits,
      excerpted: true,
      report: { service: "Parallel", outcome: "ok", parts: [{ name: "search", ok: true, detail: `${hits.length} result${hits.length === 1 ? "" : "s"}` }] },
    };
  }
}
