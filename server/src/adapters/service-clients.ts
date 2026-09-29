import type { Settings } from "../config/index.js";
import type { PageFetcher, WebSearch } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { ActorRunners, type ActorRunner } from "./apify/index.js";
import { Firecrawl } from "./firecrawl.js";
import { Searxng } from "./searxng.js";
import { ServiceQueue } from "./service-queue.js";
import { ThrottledActorRunner, ThrottledPageFetcher, ThrottledWebSearch } from "./throttled.js";

/** The outside services every run shares, one queue each, built once per process because the limits are per account. */
export class ServiceClients {
  constructor(
    readonly pages: PageFetcher,
    readonly search: WebSearch,
    readonly actors: ActorRunner | null,
  ) {}

  static forSettings(settings: Settings): ServiceClients {
    Trace.line(import.meta.url, "ServiceClients.forSettings");
    const actors = ActorRunners.forSettings(settings);
    return new ServiceClients(
      new ThrottledPageFetcher(new Firecrawl(settings), new ServiceQueue("firecrawl", settings.firecrawlConcurrency)),
      new ThrottledWebSearch(new Searxng(settings), new ServiceQueue("searxng", settings.searchConcurrency)),
      actors ? new ThrottledActorRunner(actors, new ServiceQueue("apify", settings.apifyConcurrency)) : null,
    );
  }

  withActors(actors: ActorRunner | null): ServiceClients {
    Trace.line(import.meta.url, "ServiceClients.withActors");
    return new ServiceClients(this.pages, this.search, actors);
  }
}
