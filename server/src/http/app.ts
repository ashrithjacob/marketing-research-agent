import { Hono, type Context, type Next } from "hono";

import { RunSupervisor } from "../agent/index.js";
import { ServiceClients, SqliteResearchStore } from "../adapters/index.js";
import { AmazonListingLookup } from "../adapters/apify/index.js";
import { Env, type Settings } from "../config/index.js";
import type { AmazonListingSource, ResearchStore } from "../domain/index.js";
import { Trace, TraceFile } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";
import { AuthGate } from "./auth-gate.js";
import { Frontend } from "./frontend.js";
import { ResearchApi } from "./research-api.js";

/** The service: auth, the research routes, and the built SPA. */
export class App {
  readonly fetch: Hono["fetch"];
  readonly supervisor: RunSupervisor;
  readonly store: ResearchStore;
  readonly settings: Settings;
  readonly traces: TraceFile;

  constructor(overrides?: {
    settings?: Settings;
    traces?: TraceFile;
    store?: ResearchStore;
    supervisor?: RunSupervisor;
    listingSource?: AmazonListingSource | null;
  }) {
    Trace.line(import.meta.url, "App.constructor");
    this.settings = overrides?.settings ?? Env.settings();
    this.traces = overrides?.traces ?? App.traceFile(this.settings);
    this.store = overrides?.store ?? new SqliteResearchStore(this.settings.databasePath);
    const services = ServiceClients.forSettings(this.settings);
    this.supervisor =
      overrides?.supervisor ?? new RunSupervisor({ store: this.store, settings: this.settings, services });

    const hono = new Hono<ApiEnv>();
    hono.use("*", (c, next) => this.request(c, next));
    new AuthGate(this.settings, this.store.accounts).register(hono);
    hono.get("/api/health", (c) => c.json({ status: "ok" }));
    hono.route(
      "/api/research",
      new ResearchApi({
        store: this.store,
        supervisor: this.supervisor,
        settings: this.settings,
        traces: this.traces,
        listingSource: overrides?.listingSource !== undefined ? overrides.listingSource : App.listingSource(services),
        pages: services.pages,
      }).router(),
    );
    new Frontend(this.settings.staticDir).mount(hono);
    this.fetch = hono.fetch;
  }

  private async request(c: Context<ApiEnv>, next: Next): Promise<void> {
    Trace.line(import.meta.url, "App.request", { method: c.req.method, path: c.req.path });
    await next();
  }

  static listingSource(services: ServiceClients): AmazonListingSource | null {
    Trace.line(import.meta.url, "App.listingSource");
    return services.actors ? new AmazonListingLookup(services.actors) : null;
  }

  static traceFile(settings: Settings): TraceFile {
    Trace.line(import.meta.url, "App.traceFile", { settings });
    return new TraceFile({
      dir: settings.traceDir,
      maxBytes: settings.traceMaxMb * 1024 * 1024,
      keepDays: settings.traceKeepDays,
    });
  }

  async close(): Promise<void> {
    Trace.line(import.meta.url, "App.close");
    await this.supervisor.close();
    this.store.close();
  }
}
