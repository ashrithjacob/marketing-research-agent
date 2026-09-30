import { FetcherUnavailableError, type FetchedPage, type PageFetcher } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** Fetches through the primary service, and through the fallback only when the primary can fetch nothing at all; a page the primary failed on is that page's failure. */
export class FallbackPageFetcher implements PageFetcher {
  constructor(
    private readonly primary: PageFetcher,
    private readonly fallback: PageFetcher,
  ) {}

  async scrape(url: string, signal?: AbortSignal): Promise<FetchedPage> {
    Trace.line(import.meta.url, "FallbackPageFetcher.scrape", { url });
    try {
      return await this.primary.scrape(url, signal);
    } catch (error) {
      if (!(error instanceof FetcherUnavailableError)) throw error;
      return this.fallBack(url, error, signal);
    }
  }

  private fallBack(url: string, error: FetcherUnavailableError, signal?: AbortSignal): Promise<FetchedPage> {
    Trace.line(import.meta.url, "FallbackPageFetcher.fallBack", { url, service: error.service, reason: error.message });
    return this.fallback.scrape(url, signal);
  }
}
