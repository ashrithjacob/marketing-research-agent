import { Hono } from "hono";

import { ReviewAnalyst, RunSupervisor, StageTwoHandoff, StageTwoListings } from "../agent/index.js";
import type { Settings } from "../config/index.js";
import type { AmazonListingSource, ResearchStore } from "../domain/index.js";
import { Trace, type TraceFile } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";
import { ConfigRoute } from "./config-route.js";
import { CorpusRoute } from "./corpus-route.js";
import { EventStream } from "./event-stream.js";
import { JudgementRoutes } from "./judgement-routes.js";
import { ReviewAnalysisRoutes } from "./review-analysis-routes.js";
import { RunRoutes } from "./run-routes.js";
import { StageTwoRoutes } from "./stage-two-routes.js";
import { ProductRoutes } from "./product-routes.js";
import { ScopeGuard } from "./scope-guard.js";
import { TraceRoute } from "./trace-route.js";

/** `/api/research/*` — the cockpit's surface. */
export class ResearchApi {
  constructor(
    private readonly options: {
      store: ResearchStore;
      supervisor: RunSupervisor;
      settings: Settings;
      traces: TraceFile;
      listingSource: AmazonListingSource | null;
    },
  ) {}

  router(): Hono<ApiEnv> {
    Trace.line(import.meta.url, "ResearchApi.router");
    const api = new Hono<ApiEnv>();
    const { store, supervisor, settings, traces, listingSource } = this.options;
    const handoff = new StageTwoHandoff(store);
    new ScopeGuard(store).register(api);
    new RunRoutes(store, supervisor, handoff).register(api);
    new StageTwoRoutes(handoff, settings, new StageTwoListings(store.listings, listingSource, settings.apifyConcurrency)).register(api);
    new ReviewAnalysisRoutes(store, supervisor, new ReviewAnalyst(store, settings, supervisor.models, supervisor.costs)).register(api);
    new ProductRoutes(store).register(api);
    new EventStream(store, supervisor).register(api);
    new CorpusRoute(store, settings).register(api);
    new JudgementRoutes(store).register(api);
    new ConfigRoute(settings).register(api);
    new TraceRoute(traces).register(api);
    return api;
  }
}
