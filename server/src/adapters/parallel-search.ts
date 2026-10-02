import type { SearchHit, SearchPage, SearchScope, ServiceUse, WebSearch } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ParallelApi } from "./parallel-api.js";

interface ParallelUsage {
  name?: string;
  count?: number;
}

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
      use: ParallelSearch.use(body.usage as ParallelUsage[] | undefined),
      report: { service: "Parallel", outcome: "ok", parts: [{ name: "search", ok: true, detail: `${hits.length} result${hits.length === 1 ? "" : "s"}` }] },
    };
  }

  /** Parallel reports a search's use as named counts, e.g. `[{"name":"sku_search","count":1}]`; one search when it reports none. */
  private static use(usage: ParallelUsage[] | undefined): ServiceUse {
    Trace.line(import.meta.url, "ParallelSearch.use", { usage });
    const counted = (usage ?? []).filter((entry) => typeof entry.count === "number");
    if (counted.length === 0) return { item: "search", units: 1 };
    return { item: counted.map((entry) => entry.name ?? "search").join("+"), units: counted.reduce((sum, entry) => sum + (entry.count ?? 0), 0) };
  }
}
