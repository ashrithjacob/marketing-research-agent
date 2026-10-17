import type { Settings } from "../config/index.js";
import type { AdLibrary, PageFetcher, WebSearch } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { Crawl4ai } from "./crawl4ai.js";
import { FallbackPageFetcher } from "./fallback-fetcher.js";
import { Firecrawl } from "./firecrawl.js";
import { ParallelApi } from "./parallel-api.js";
import { ParallelSearch } from "./parallel-search.js";
import { ServiceQueue } from "./service-queue.js";
import { ThrottledAdLibrary, ThrottledPageFetcher, ThrottledWebSearch } from "./throttled.js";
import { TrendtrackAds } from "./trendtrack-ads.js";

/** The outside services every run shares, one queue each, built once per process because the limits are per account. */
export class ServiceClients {
  constructor(
    readonly pages: PageFetcher,
    readonly search: WebSearch,
    readonly ads: AdLibrary | null,
  ) {}

  static forSettings(settings: Settings): ServiceClients {
    Trace.line(import.meta.url, "ServiceClients.forSettings");
    return new ServiceClients(
      ServiceClients.pageChain(settings),
      new ThrottledWebSearch(new ParallelSearch(new ParallelApi(settings)), new ServiceQueue("parallel", settings.parallelConcurrency)),
      settings.trendtrackApiKey ? new ThrottledAdLibrary(new TrendtrackAds(settings), new ServiceQueue("trendtrack", settings.trendtrackConcurrency)) : null,
    );
  }

  /** Firecrawl, then Crawl4AI only when Firecrawl can fetch nothing at all; Crawl4AI is left out when it has no key. */
  private static pageChain(settings: Settings): PageFetcher {
    Trace.line(import.meta.url, "ServiceClients.pageChain");
    const chain: PageFetcher[] = [
      new ThrottledPageFetcher(new Firecrawl(settings), new ServiceQueue("firecrawl", settings.firecrawlConcurrency)),
      ...(settings.crawl4aiApiKey ? [new ThrottledPageFetcher(new Crawl4ai(settings), new ServiceQueue("crawl4ai", settings.crawl4aiConcurrency))] : []),
    ];
    return chain.reduceRight((fallback, primary) => new FallbackPageFetcher(primary, fallback));
  }
}
