import type { Settings } from "../config/index.js";
import { Domains, type SearchPage, type SearchScope, type ServicePart, type ServiceReport, type WebSearch } from "../domain/index.js";

import { Http } from "./http.js";
import { Trace } from "../trace/index.js";

/** SearXNG finds urls; it cannot read pages. It has no site filter, so a scoped search keeps only the hits on the scope's domains. */
export class Searxng implements WebSearch {
  constructor(private readonly settings: Settings) {}

  async find(
    query: string,
    maxResults: number,
    signal?: AbortSignal,
    scope?: SearchScope,
  ): Promise<SearchPage> {
    Trace.line(import.meta.url, "Searxng.find", { query, maxResults, scope });
    const url = new URL("/search", this.settings.searxngUrl);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");

    const response = await Http.withTimeout(
      url.toString(),
      { headers: { Accept: "application/json" } },
      this.settings.webTimeoutSeconds,
      signal,
    );
    if (!response.ok) {
      throw new Error(
        `SearXNG returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
      );
    }
    const body = (await response.json()) as {
      results?: Array<Record<string, unknown>>;
      unresponsive_engines?: unknown[];
    };
    const results = (body.results ?? []).filter((r) => Domains.within(String(r.url ?? ""), scope?.domains));
    return {
      excerpted: false,
      hits: results.slice(0, maxResults).map((r) => ({
        title: String(r.title ?? ""),
        url: String(r.url ?? ""),
        snippet: String(r.content ?? ""),
      })),
      report: Searxng.report(results, body.unresponsive_engines ?? []),
    };
  }

  private static report(results: Array<Record<string, unknown>>, unresponsive: unknown[]): ServiceReport {
    Trace.line(import.meta.url, "Searxng.report", { results, unresponsive });
    const answered = new Map<string, number>();
    for (const result of results) {
      const engines = Array.isArray(result.engines) ? result.engines : [result.engine];
      for (const engine of engines) {
        if (typeof engine === "string") answered.set(engine, (answered.get(engine) ?? 0) + 1);
      }
    }
    const parts: ServicePart[] = [...answered].map(([name, count]) => ({
      name,
      ok: true,
      detail: `${count} result${count === 1 ? "" : "s"}`,
    }));
    for (const entry of unresponsive) {
      const [name, reason] = Array.isArray(entry) ? entry : [entry, ""];
      parts.push({ name: String(name), ok: false, detail: String(reason ?? "") });
    }
    const failed = parts.some((p) => !p.ok);
    const outcome = results.length === 0 && failed ? "failed" : failed ? "degraded" : "ok";
    return { service: "SearXNG", outcome, parts };
  }
}
