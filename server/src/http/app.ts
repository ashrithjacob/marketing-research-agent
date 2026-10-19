import { Hono, type Context, type Next } from "hono";

import { CachedVisuals, JudgemeReviews, OpenRouterPrices, PageVisuals, PublicPage, ServiceClients, ShopifyStorefront, WootReviews } from "../adapters/index.js";
import {
  AmazonListingFinder,
  AnalysisService,
  AvatarStage,
  BrandVisualsCollector,
  CompetitorAdStage,
  LiveRuns,
  LlmModels,
  Pipeline,
  ProductMarketStage,
  ProductResolver,
  ResolutionSignals,
  ResolutionVisuals,
  ReviewListings,
  ReviewStage,
  ShopTractionCollector,
  RunEvents,
  RunLauncher,
  Toolbox,
  type LlmCatalogue,
  type RunServices,
} from "../agent/index.js";
import type { Settings } from "../config/index.js";
import type { BrandVisuals, GenerationSource, ResearchStore } from "../domain/index.js";
import { Trace, TraceFile } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";
import { AuthGate } from "./auth-gate.js";
import { ConfigRoutes } from "./config-routes.js";
import { EvidenceRoutes } from "./evidence-routes.js";
import { Frontend } from "./frontend.js";
import { RunRoutes } from "./run-routes.js";

export interface AppParts {
  settings: Settings;
  traces: TraceFile;
  store: ResearchStore;
  services?: ServiceClients;
  models?: LlmCatalogue;
  generations?: GenerationSource;
  pipeline?: Pipeline;
  visuals?: BrandVisuals;
}

/** The service: auth, the analysis routes, and the built single-page app. Everything concrete is built here and nowhere else. */
export class App {
  readonly fetch: Hono["fetch"];
  readonly analyses: AnalysisService;
  readonly live = new LiveRuns();
  readonly prices: OpenRouterPrices;

  constructor(private readonly parts: AppParts) {
    Trace.line(import.meta.url, "App.constructor");
    const { settings, store } = parts;
    this.prices = new OpenRouterPrices({ apiKey: settings.openrouterApiKey });
    const clients = parts.services ?? ServiceClients.forSettings(settings);
    const pages = new PublicPage(settings);
    const visuals = new CachedVisuals(parts.visuals ?? new PageVisuals(pages), store.visuals);
    const pipeline = parts.pipeline ?? App.pipeline(settings, clients, pages, visuals);
    const events = new RunEvents(store.events);
    const services: RunServices = {
      store,
      models: parts.models ?? LlmModels.openrouter(),
      toolbox: new Toolbox(clients, settings),
      generations: parts.generations ?? this.prices,
      events,
    };
    const launcher = new RunLauncher(services, settings, this.live, pipeline, new ProductResolver(), new ResolutionVisuals(visuals), new ResolutionSignals(clients.shops, store.signals));
    this.analyses = new AnalysisService(store, launcher, this.live, pipeline, settings.model);

    const hono = new Hono<ApiEnv>();
    hono.use("*", (c, next) => this.request(c, next));
    new AuthGate(settings, store.accounts).register(hono);
    hono.get("/api/health", (c) => c.json({ status: "ok" }));
    hono.route("/api/research", new ConfigRoutes(settings.model, pipeline.built).router());
    hono.route("/api/research", new RunRoutes(store, this.analyses, events, parts.traces).router());
    hono.route("/api/research", new EvidenceRoutes(store, this.analyses).router());
    new Frontend(settings.staticDir).mount(hono);
    this.fetch = hono.fetch;
  }

  static pipeline(settings: Settings, clients: ServiceClients, pages: PublicPage, visuals: BrandVisuals): Pipeline {
    Trace.line(import.meta.url, "App.pipeline");
    const sources = new Map([new JudgemeReviews(settings), new WootReviews(settings)].map((source) => [source.name, source] as const));
    const limits = { maxAds: settings.adsPerRun, minCopyChars: settings.adMinCopyChars, maxAdsPerBrand: settings.adsPerBrand };
    return new Pipeline([
      new ProductMarketStage(new BrandVisualsCollector(visuals), new ShopTractionCollector(clients.shops, settings.prices)),
      new ReviewStage(new ReviewListings(new ShopifyStorefront(pages), new AmazonListingFinder()), sources, settings.reviewsPerProduct),
      new CompetitorAdStage(clients.ads, settings.prices, limits),
      new AvatarStage(),
    ]);
  }

  static traceFile(settings: Settings): TraceFile {
    Trace.line(import.meta.url, "App.traceFile");
    return new TraceFile({ dir: settings.traceDir, maxBytes: settings.traceMaxMb * 1024 * 1024, keepDays: settings.traceKeepDays });
  }

  async close(): Promise<void> {
    Trace.line(import.meta.url, "App.close");
    await this.live.stopAll();
    this.prices.stop();
    await this.parts.store.close();
  }

  private async request(c: Context<ApiEnv>, next: Next): Promise<void> {
    Trace.line(import.meta.url, "App.request", { method: c.req.method, path: c.req.path });
    await next();
  }
}
