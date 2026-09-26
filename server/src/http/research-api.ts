import { Hono } from "hono";

import { RunSupervisor, StageTwoHandoff } from "../agent/index.js";
import type { Settings } from "../config/index.js";
import type { ResearchStore } from "../domain/index.js";
import { Trace, type TraceFile } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";
import { ConfigRoute } from "./config-route.js";
import { CorpusRoute } from "./corpus-route.js";
import { EventStream } from "./event-stream.js";
import { JudgementRoutes } from "./judgement-routes.js";
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
    },
  ) {}

  router(): Hono<ApiEnv> {
    Trace.line(import.meta.url, "ResearchApi.router");
    const api = new Hono<ApiEnv>();
    const { store, supervisor, settings, traces } = this.options;
    const handoff = new StageTwoHandoff(store);
    new ScopeGuard(store).register(api);
    new RunRoutes(store, supervisor, handoff).register(api);
    new StageTwoRoutes(handoff, settings).register(api);
    new ProductRoutes(store).register(api);
    new EventStream(store, supervisor).register(api);
    new CorpusRoute(store, settings).register(api);
    new JudgementRoutes(store).register(api);
    new ConfigRoute(settings).register(api);
    new TraceRoute(traces).register(api);
    return api;
  }
}
