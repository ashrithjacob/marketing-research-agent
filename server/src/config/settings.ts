export interface Settings {
  appUser: string;
  appPasswordHash: string;
  jwtSecret: string;
  sessionHours: number;
  cookieSecure: boolean;

  openrouterApiKey: string;
  model: string;

  searxngUrl: string;
  firecrawlApiKey: string;
  firecrawlBaseUrl: string;
  webTimeoutSeconds: number;
  fetchCharLimit: number;

  apifyToken: string;
  apifyMaxReviews: number;
  apifyWaitSeconds: number;

  corpusPath: string;

  databasePath: string;
  staticDir: string;
  host: string;
  port: number;
}

/** The only reader of process.env. Everything else is handed a Settings. */
export class Env {
  static text(name: string, fallback: string): string {
    const value = process.env[name];
    return value === undefined || value === "" ? fallback : value;
  }

  static number(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw === "") return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${name} must be a number, got ${JSON.stringify(raw)}`);
    }
    return parsed;
  }

  static flag(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (raw === undefined || raw === "") return fallback;
    return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
  }

  static settings(): Settings {
    return {

      appUser: Env.text("MRA_APP_USER", "ash"),
      appPasswordHash: Env.text("MRA_APP_PASSWORD_HASH", ""),
      jwtSecret: Env.text("MRA_JWT_SECRET", ""),
      sessionHours: Env.number("MRA_SESSION_HOURS", 720),
      cookieSecure: Env.flag("MRA_COOKIE_SECURE", true),

      openrouterApiKey: Env.text("OPENROUTER_API_KEY", ""),
      model: Env.text("MRA_MODEL", "deepseek/deepseek-v4-flash-0731"),

      searxngUrl: Env.text("SEARXNG_URL", "http://searxng:8080"),
      firecrawlApiKey: Env.text("FIRECRAWL_API_KEY", ""),
      firecrawlBaseUrl: Env.text("FIRECRAWL_BASE_URL", "https://api.firecrawl.dev"),
      webTimeoutSeconds: Env.number("MRA_WEB_TIMEOUT_SECONDS", 90),
      fetchCharLimit: Env.number("MRA_FETCH_CHAR_LIMIT", 25000),

      apifyToken: Env.text("APIFY_TOKEN", ""),
      apifyMaxReviews: Env.number("MRA_APIFY_MAX_REVIEWS", 10),
      apifyWaitSeconds: Env.number("MRA_APIFY_WAIT_SECONDS", 300),

      corpusPath: Env.text("MRA_CORPUS_PATH", "/corpus"),

      databasePath: Env.text("MRA_DATABASE_PATH", "/data/research.db"),
      staticDir: Env.text("MRA_STATIC_DIR", "/app/static"),
      host: Env.text("MRA_HOST", "0.0.0.0"),
      port: Env.number("MRA_PORT", 8000),
    };
  }
}
