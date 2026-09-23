import type { Settings } from "../config/index.js";

import { Http } from "./http.js";

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

/** SearXNG finds urls; it cannot read pages. That is Firecrawl's half. */
export class Searxng {
  constructor(private readonly settings: Settings) {}

  async find(
    query: string,
    maxResults: number,
    signal?: AbortSignal,
  ): Promise<SearchHit[]> {
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
    const body = (await response.json()) as { results?: Array<Record<string, unknown>> };
    return (body.results ?? []).slice(0, maxResults).map((r) => ({
      title: String(r.title ?? ""),
      url: String(r.url ?? ""),
      snippet: String(r.content ?? ""),
    }));
  }
}
