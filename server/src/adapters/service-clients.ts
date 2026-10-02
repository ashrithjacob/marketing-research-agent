import type { Settings } from "../config/index.js";
import type { AdLibrary, CompetitorDiscovery, PageFetcher, WebSearch } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { ActorRunners, type ActorRunner } from "./apify/index.js";
import { Crawl4ai } from "./crawl4ai.js";
import { FallbackPageFetcher } from "./fallback-fetcher.js";
import { Firecrawl } from "./firecrawl.js";
import { ParallelApi } from "./parallel-api.js";
import { ParallelCompetitorDiscovery } from "./parallel-discovery.js";
import { ParallelExtract } from "./parallel-extract.js";
import { ParallelSearch } from "./parallel-search.js";
import { ParallelTask } from "./parallel-task.js";
import { ServiceQueue } from "./service-queue.js";
import { ThrottledActorRunner, ThrottledAdLibrary, ThrottledPageFetcher, ThrottledWebSearch } from "./throttled.js";
import { TrendtrackAds } from "./trendtrack-ads.js";

/** What product truth searches and reads with: Parallel, with Crawl4AI reading only when Parallel can answer nothing. Never Firecrawl. */
export interface EvidenceServices {
  search: WebSearch;
  pages: PageFetcher;
}

/** The outside services every run shares, one queue each, built once per process because the limits are per account. */
export class ServiceClients {
  constructor(
    readonly pages: PageFetcher,
    readonly search: WebSearch,
    readonly actors: ActorRunner | null,
    readonly evidence: EvidenceServices = { search, pages },
    readonly discovery: CompetitorDiscovery | null = null,
    readonly ads: AdLibrary | null = null,
  ) {}

  static forSettings(settings: Settings): ServiceClients {
    Trace.line(import.meta.url, "ServiceClients.forSettings");
    const actors = ActorRunners.forSettings(settings);
    const parallel = new ServiceQueue("parallel", settings.parallelConcurrency);
    const api = new ParallelApi(settings);
    const search = new ThrottledWebSearch(new ParallelSearch(api), parallel);
    return new ServiceClients(
      ServiceClients.pageChain(settings),
      search,
      actors ? new ThrottledActorRunner(actors, new ServiceQueue("apify", settings.apifyConcurrency)) : null,
      ServiceClients.evidence(settings, api, parallel, search),
      new ParallelCompetitorDiscovery(new ParallelTask(api, 10_000, settings.discoveryTimeoutSeconds), settings.discoveryProcessor),
      settings.trendtrackApiKey ? new ThrottledAdLibrary(new TrendtrackAds(settings), new ServiceQueue("trendtrack", settings.trendtrackConcurrency)) : null,
    );
  }

  private static evidence(settings: Settings, api: ParallelApi, parallel: ServiceQueue, search: WebSearch): EvidenceServices {
    Trace.line(import.meta.url, "ServiceClients.evidence");
    const extract = new ThrottledPageFetcher(new ParallelExtract(api), parallel);
    return {
      search,
      pages: settings.crawl4aiApiKey
        ? new FallbackPageFetcher(extract, new ThrottledPageFetcher(new Crawl4ai(settings), new ServiceQueue("crawl4ai", settings.crawl4aiConcurrency)))
        : extract,
    };
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

  withActors(actors: ActorRunner | null): ServiceClients {
    Trace.line(import.meta.url, "ServiceClients.withActors");
    return new ServiceClients(this.pages, this.search, actors, this.evidence, this.discovery, this.ads);
  }
}
