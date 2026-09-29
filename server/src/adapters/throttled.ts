import type { FetchedPage, PageFetcher, SearchPage, WebSearch } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ActorRun, ActorRunner } from "./apify/index.js";
import type { ServiceQueue } from "./service-queue.js";

export class ThrottledPageFetcher implements PageFetcher {
  constructor(
    private readonly inner: PageFetcher,
    private readonly queue: ServiceQueue,
  ) {}

  scrape(url: string, signal?: AbortSignal): Promise<FetchedPage> {
    Trace.line(import.meta.url, "ThrottledPageFetcher.scrape", { url });
    return this.queue.run(() => this.inner.scrape(url, signal), signal);
  }
}

export class ThrottledWebSearch implements WebSearch {
  constructor(
    private readonly inner: WebSearch,
    private readonly queue: ServiceQueue,
  ) {}

  find(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchPage> {
    Trace.line(import.meta.url, "ThrottledWebSearch.find", { query, maxResults });
    return this.queue.run(() => this.inner.find(query, maxResults, signal), signal);
  }
}

export class ThrottledActorRunner implements ActorRunner {
  constructor(
    private readonly inner: ActorRunner,
    private readonly queue: ServiceQueue,
  ) {}

  run(
    actorId: string,
    input: Record<string, unknown>,
    maxTotalChargeUsd: number,
    signal?: AbortSignal,
  ): Promise<ActorRun> {
    Trace.line(import.meta.url, "ThrottledActorRunner.run", { actorId, maxTotalChargeUsd });
    return this.queue.run(() => this.inner.run(actorId, input, maxTotalChargeUsd, signal), signal);
  }
}
