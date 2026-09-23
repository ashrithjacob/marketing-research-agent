import { Hono } from "hono";

import { RunSupervisor } from "../agent/index.js";
import { SqliteResearchStore } from "../adapters/index.js";
import { Env, type Settings } from "../config/index.js";
import type { ResearchStore } from "../domain/index.js";

import { AuthGate } from "./auth-gate.js";
import { Frontend } from "./frontend.js";
import { ResearchApi } from "./research-api.js";

/** The service: auth, the research routes, and the built SPA. */
export class App {
  readonly fetch: Hono["fetch"];
  readonly supervisor: RunSupervisor;
  readonly store: ResearchStore;
  readonly settings: Settings;

  constructor(overrides?: {
    settings?: Settings;
    store?: ResearchStore;
    supervisor?: RunSupervisor;
  }) {
    this.settings = overrides?.settings ?? Env.settings();
    this.store = overrides?.store ?? new SqliteResearchStore(this.settings.databasePath);
    this.supervisor =
      overrides?.supervisor ?? new RunSupervisor({ store: this.store, settings: this.settings });

    const hono = new Hono();
    new AuthGate(this.settings).register(hono);
    hono.get("/api/health", (c) => c.json({ status: "ok" }));
    hono.route(
      "/api/research",
      new ResearchApi({
        store: this.store,
        supervisor: this.supervisor,
        settings: this.settings,
      }).router(),
    );
    new Frontend(this.settings.staticDir).mount(hono);
    this.fetch = hono.fetch;
  }

  async close(): Promise<void> {
    await this.supervisor.close();
    this.store.close();
  }
}
