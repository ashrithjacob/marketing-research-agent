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

      searxngUrl: Env.text("SEARXNG_URL", "http://searxng:8080"),
      firecrawlApiKey: Env.text("FIRECRAWL_API_KEY", ""),
      firecrawlBaseUrl: Env.text("FIRECRAWL_BASE_URL", "https://api.firecrawl.dev"),
      crawl4aiApiKey: Env.text("CRAWL4AI_API_KEY", ""),
      crawl4aiBaseUrl: Env.text("CRAWL4AI_BASE_URL", "https://api.crawl4ai.com"),
      crawl4aiConcurrency: Env.number("MRA_CRAWL4AI_CONCURRENCY", 2),
      webTimeoutSeconds: Env.number("MRA_WEB_TIMEOUT_SECONDS", 90),
      fetchCharLimit: Env.number("MRA_FETCH_CHAR_LIMIT", 25000),
      firecrawlConcurrency: Env.number("MRA_FIRECRAWL_CONCURRENCY", 2),
      searchConcurrency: Env.number("MRA_SEARCH_CONCURRENCY", 2),
      gateModel: Env.text("MRA_GATE_MODEL", ""),
      gateCharLimit: Env.number("MRA_GATE_CHAR_LIMIT", 4000),
      gateTimeoutSeconds: Env.number("MRA_GATE_TIMEOUT_SECONDS", 12),

      apifyToken: Env.text("APIFY_TOKEN", ""),
      apifyMaxReviews: Env.number("MRA_APIFY_MAX_REVIEWS", 50),
      apifyWaitSeconds: Env.number("MRA_APIFY_WAIT_SECONDS", 300),
      apifyConcurrency: Env.number("MRA_APIFY_CONCURRENCY", 16),
      apifyPullRetries: Env.number("MRA_APIFY_PULL_RETRIES", 1),

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
