import { ServiceUnavailableError, type SearchPage, type SearchScope, type WebSearch } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** Searches through the primary service, and through the fallback only when the primary can answer nothing at all. */
export class FallbackWebSearch implements WebSearch {
  constructor(
    private readonly primary: WebSearch,
    private readonly fallback: WebSearch,
  ) {}

  async find(query: string, maxResults: number, signal?: AbortSignal, scope?: SearchScope): Promise<SearchPage> {
    Trace.line(import.meta.url, "FallbackWebSearch.find", { query, maxResults });
    try {
      return await this.primary.find(query, maxResults, signal, scope);
    } catch (error) {
      if (!(error instanceof ServiceUnavailableError)) throw error;
      return this.fallBack(error, query, maxResults, signal, scope);
    }
  }

  private fallBack(error: ServiceUnavailableError, query: string, maxResults: number, signal?: AbortSignal, scope?: SearchScope): Promise<SearchPage> {
    Trace.line(import.meta.url, "FallbackWebSearch.fallBack", { service: error.service, reason: error.message });
    return this.fallback.find(query, maxResults, signal, scope);
  }
}
