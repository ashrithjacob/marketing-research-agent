import { Trace } from "../trace/index.js";

import type { Settings } from "./settings-shape.js";

/** The only reader of process.env. Everything else is handed a Settings. */
export class Env {
  static text(name: string, fallback: string): string {
    Trace.line(import.meta.url, "Env.text", { name, fallback });
    const value = process.env[name];
    return value === undefined || value === "" ? fallback : value;
  }

  static required(name: string): string {
    Trace.line(import.meta.url, "Env.required", { name });
    const value = process.env[name];
    if (value === undefined || value.trim() === "") {
      throw new Error(`${name} is not set. It lives only in .env; the code carries no default.`);
    }
    return value.trim();
  }

  static list(name: string): string[] {
    Trace.line(import.meta.url, "Env.list", { name });
    return (process.env[name] ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== "");
  }

  static backups(primary: string): string[] {
    Trace.line(import.meta.url, "Env.backups", { primary });
    const backups = Env.list("MRA_BACKUP_MODELS");
    const chain = [primary, ...backups];
    const repeated = chain.find((id, index) => chain.indexOf(id) !== index);
    if (repeated) {
      throw new Error(`MRA_BACKUP_MODELS repeats ${repeated}: a model can appear once, primary included.`);
    }
    return backups;
  }

  static number(name: string, fallback: number): number {
    Trace.line(import.meta.url, "Env.number", { name, fallback });
    const raw = process.env[name];
    if (raw === undefined || raw === "") return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${name} must be a number, got ${JSON.stringify(raw)}`);
    }
    return parsed;
  }

  /** A number, or null when unset: a price nobody has measured. */
  static optionalNumber(name: string): number | null {
    Trace.line(import.meta.url, "Env.optionalNumber", { name });
    return process.env[name] === undefined || process.env[name] === "" ? null : Env.number(name, 0);
  }

  /** `name=number` pairs, comma-separated: "pro=0.10,ultra=0.30". */
  static prices(name: string, fallback: Readonly<Record<string, number>>): Record<string, number> {
    Trace.line(import.meta.url, "Env.prices", { name });
    const pairs = Env.list(name);
    if (pairs.length === 0) return { ...fallback };
    return Object.fromEntries(pairs.map((pair) => {
      const [key, raw] = pair.split("=").map((part) => part.trim());
      const value = Number(raw);
      if (!key || !Number.isFinite(value)) throw new Error(`${name} must be name=number pairs, got ${JSON.stringify(pair)}`);
      return [key, value];
    }));
  }

  static flag(name: string, fallback: boolean): boolean {
    Trace.line(import.meta.url, "Env.flag", { name, fallback });
    const raw = process.env[name];
    if (raw === undefined || raw === "") return fallback;
    return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
  }

  static settings(): Settings {
    Trace.line(import.meta.url, "Env.settings");
    const model = Env.required("MRA_MODEL");
    return {

      appUser: Env.text("MRA_APP_USER", "ash"),
      appPasswordHash: Env.text("MRA_APP_PASSWORD_HASH", ""),
      jwtSecret: Env.text("MRA_JWT_SECRET", ""),
      sessionHours: Env.number("MRA_SESSION_HOURS", 720),
      cookieSecure: Env.flag("MRA_COOKIE_SECURE", true),

      openrouterApiKey: Env.text("OPENROUTER_API_KEY", ""),
      model,
      backupModels: Env.backups(model),

      firecrawlApiKey: Env.text("FIRECRAWL_API_KEY", ""),
      firecrawlBaseUrl: Env.text("FIRECRAWL_BASE_URL", "https://api.firecrawl.dev"),
      crawl4aiApiKey: Env.text("CRAWL4AI_API_KEY", ""),
      crawl4aiBaseUrl: Env.text("CRAWL4AI_BASE_URL", "https://api.crawl4ai.com"),
      crawl4aiConcurrency: Env.number("MRA_CRAWL4AI_CONCURRENCY", 2),
      parallelApiKey: Env.text("PARALLEL_API_KEY", ""),
      parallelBaseUrl: Env.text("PARALLEL_BASE_URL", "https://api.parallel.ai"),
      parallelConcurrency: Env.number("MRA_PARALLEL_CONCURRENCY", 4),
      discoveryProcessor: Env.text("MRA_DISCOVERY_PROCESSOR", "pro"),
      discoveryTimeoutSeconds: Env.number("MRA_DISCOVERY_TIMEOUT_SECONDS", 900),
      trendtrackApiKey: Env.text("TRENDTRACK_API_KEY", ""),
      trendtrackBaseUrl: Env.text("TRENDTRACK_BASE_URL", "https://api.trendtrack.io"),
      trendtrackConcurrency: Env.number("MRA_TRENDTRACK_CONCURRENCY", 2),
      webTimeoutSeconds: Env.number("MRA_WEB_TIMEOUT_SECONDS", 90),
      fetchCharLimit: Env.number("MRA_FETCH_CHAR_LIMIT", 25000),
      firecrawlConcurrency: Env.number("MRA_FIRECRAWL_CONCURRENCY", 2),
      gateModel: Env.text("MRA_GATE_MODEL", ""),
      gateCharLimit: Env.number("MRA_GATE_CHAR_LIMIT", 4000),
      gateTimeoutSeconds: Env.number("MRA_GATE_TIMEOUT_SECONDS", 12),
      prices: {
        parallelSearchUsd: Env.number("MRA_PARALLEL_SEARCH_USD", 0.005),
        parallelExtractUsd: Env.number("MRA_PARALLEL_EXTRACT_USD", 0.001),
        parallelTaskUsd: Env.prices("MRA_PARALLEL_TASK_USD", { pro: 0.1, ultra: 0.3 }),
        trendtrackUsdPerCredit: Env.number("MRA_TRENDTRACK_USD_PER_CREDIT", 0.0089),
        crawl4aiUsdPerPage: Env.number("MRA_CRAWL4AI_USD_PER_PAGE", 0),
        firecrawlUsdPerPage: Env.optionalNumber("MRA_FIRECRAWL_USD_PER_PAGE"),
      },

      apifyToken: Env.text("APIFY_TOKEN", ""),
      apifyMaxReviews: Env.number("MRA_APIFY_MAX_REVIEWS", 50),
      apifyWaitSeconds: Env.number("MRA_APIFY_WAIT_SECONDS", 300),
      apifyConcurrency: Env.number("MRA_APIFY_CONCURRENCY", 16),
      apifyPullRetries: Env.number("MRA_APIFY_PULL_RETRIES", 1),
      reviewReuseDays: Env.number("MRA_REVIEW_REUSE_DAYS", 183),

      corpusPath: Env.text("MRA_CORPUS_PATH", "/corpus"),

      databasePath: Env.text("MRA_DATABASE_PATH", "/data/research.db"),
      traceDir: Env.text("MRA_TRACE_DIR", "/data/traces"),
      traceKeepDays: Env.number("MRA_TRACE_KEEP_DAYS", 30),
      traceMaxMb: Env.number("MRA_TRACE_MAX_MB", 20),
      staticDir: Env.text("MRA_STATIC_DIR", "/app/static"),
      host: Env.text("MRA_HOST", "0.0.0.0"),
      port: Env.number("MRA_PORT", 8000),
    };
  }
}
