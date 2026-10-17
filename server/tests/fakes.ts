import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels, type Models } from "@earendil-works/pi-ai";
import { fauxProvider } from "@earendil-works/pi-ai/providers/faux";

import { ServiceClients } from "../src/adapters/index.js";
import type { Settings } from "../src/config/index.js";
import type { AdLibrary, AdPage, FetchedPage, GenerationSource, PageFetcher, SearchPage, WebSearch } from "../src/domain/index.js";
import { TraceFile } from "../src/trace/index.js";

export const FAUX_MODEL = "faux-model";

/** Pages by url; a url with no page throws, as a real fetcher does. */
export class FakeWeb implements PageFetcher, WebSearch, AdLibrary {
  readonly fetched: string[] = [];

  constructor(
    private readonly pages: Record<string, string> = {},
    private readonly hits: SearchPage["hits"] = [],
  ) {}

  async scrape(url: string): Promise<FetchedPage> {
    this.fetched.push(url);
    const text = this.pages[url];
    if (text === undefined) throw new Error(`HTTP 404 for ${url}`);
    return { text, title: url, reader: "firecrawl" };
  }

  async find(): Promise<SearchPage> {
    return { hits: this.hits, report: { service: "fake", outcome: "ok", parts: [] }, excerpted: false };
  }

  async search(): Promise<AdPage> {
    return { hits: [], total: 0, credits: 0 };
  }

  services(): ServiceClients {
    return new ServiceClients(this, this, this);
  }
}

export class NoBilling implements GenerationSource {
  readonly billable = false;

  async generation(): Promise<null> {
    return null;
  }
}

export class Faux {
  readonly provider = fauxProvider({ provider: "openrouter", models: [{ id: FAUX_MODEL }] });
  readonly models: Models;

  constructor() {
    const models = createModels();
    models.setProvider(this.provider.provider);
    this.models = models;
  }
}

export class TestSettings {
  static make(overrides: Partial<Settings> = {}): { settings: Settings; traces: TraceFile } {
    const dir = mkdtempSync(join(tmpdir(), "mra-test-"));
    const settings: Settings = {
      appUser: "ash",
      appPasswordHash: "",
      jwtSecret: "test-secret-test-secret-test-secret",
      sessionHours: 1,
      cookieSecure: false,
      openrouterApiKey: "",
      model: FAUX_MODEL,
      backupModels: [],
      firecrawlApiKey: "",
      firecrawlBaseUrl: "http://firecrawl.invalid",
      firecrawlConcurrency: 2,
      crawl4aiApiKey: "",
      crawl4aiBaseUrl: "http://crawl4ai.invalid",
      crawl4aiConcurrency: 2,
      parallelApiKey: "",
      parallelBaseUrl: "http://parallel.invalid",
      parallelConcurrency: 2,
      trendtrackApiKey: "",
      trendtrackBaseUrl: "http://trendtrack.invalid",
      trendtrackConcurrency: 2,
      webTimeoutSeconds: 5,
      fetchCharLimit: 25000,
      prices: { parallelSearchUsd: 0.005, parallelExtractUsd: 0.001, trendtrackUsdPerCredit: 0.0089, crawl4aiUsdPerPage: 0, firecrawlUsdPerPage: 0.001 },
      reviewsPerProduct: 500,
      reviewsPerBand: 100,
      wootDelayMs: 0,
      adsPerRun: 150,
      adMinCopyChars: 2000,
      adsPerBrand: 15,
      databaseUrl: "postgres://unused",
      databaseConnections: 1,
      traceDir: dir,
      traceKeepDays: 1,
      traceMaxMb: 5,
      staticDir: join(dir, "static"),
      host: "127.0.0.1",
      port: 0,
      ...overrides,
    };
    return { settings, traces: new TraceFile({ dir, maxBytes: 5 * 1024 * 1024, keepDays: 1 }) };
  }
}
