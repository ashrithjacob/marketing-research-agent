import { Hono } from "hono";

import type { RunSupervisor } from "../agent/index.js";
import type { Settings } from "../config/index.js";
import type { ResearchStore } from "../domain/index.js";

import { ConfigRoute } from "./config-route.js";
import { CorpusRoute } from "./corpus-route.js";
import { EventStream } from "./event-stream.js";
import { JudgementRoutes } from "./judgement-routes.js";
import { RunRoutes } from "./run-routes.js";

/** `/api/research/*` — the cockpit's surface. */
export class ResearchApi {
  constructor(
    private readonly options: {
      store: ResearchStore;
      supervisor: RunSupervisor;
      settings: Settings;
    },
  ) {}

  router(): Hono {
    const api = new Hono();
    const { store, supervisor, settings } = this.options;
    new RunRoutes(store, supervisor).register(api);
    new EventStream(store, supervisor).register(api);
    new CorpusRoute(store, settings).register(api);
    new JudgementRoutes(store).register(api);
    new ConfigRoute(settings).register(api);
    return api;
  }
}
