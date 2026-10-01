import type { Settings } from "../config/index.js";
import type { PageFetcher, WebSearch } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { ActorRunners, type ActorRunner } from "./apify/index.js";
import { Crawl4ai } from "./crawl4ai.js";
import { FallbackPageFetcher } from "./fallback-fetcher.js";
import { FallbackWebSearch } from "./fallback-search.js";
import { Firecrawl } from "./firecrawl.js";
import { ParallelApi } from "./parallel-api.js";
import { ParallelExtract } from "./parallel-extract.js";
import { ParallelSearch } from "./parallel-search.js";
import { Searxng } from "./searxng.js";
import { ServiceQueue } from "./service-queue.js";
import { ThrottledActorRunner, ThrottledPageFetcher, ThrottledWebSearch } from "./throttled.js";

/** What product truth searches and reads with: Parallel, with SearXNG and Crawl4AI only when Parallel can answer nothing. Never Firecrawl. */
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
  ) {}

  static forSettings(settings: Settings): ServiceClients {
    Trace.line(import.meta.url, "ServiceClients.forSettings");
    const actors = ActorRunners.forSettings(settings);
    const searxng = new ThrottledWebSearch(new Searxng(settings), new ServiceQueue("searxng", settings.searchConcurrency));
    return new ServiceClients(
      ServiceClients.pageChain(settings),
      searxng,
      actors ? new ThrottledActorRunner(actors, new ServiceQueue("apify", settings.apifyConcurrency)) : null,
      ServiceClients.evidence(settings, searxng),
    );
  }

  private static evidence(settings: Settings, searxng: WebSearch): EvidenceServices {
    Trace.line(import.meta.url, "ServiceClients.evidence");
    const parallel = new ServiceQueue("parallel", settings.parallelConcurrency);
    const api = new ParallelApi(settings);
    const extract = new ThrottledPageFetcher(new ParallelExtract(api), parallel);
    return {
      search: new FallbackWebSearch(new ThrottledWebSearch(new ParallelSearch(api), parallel), searxng),
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
    return new ServiceClients(this.pages, this.search, actors, this.evidence);
  }
}
