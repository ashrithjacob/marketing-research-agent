/** What each paid service's unit costs, for services that report units and not dollars; null where the price is not known. */
export interface ServicePrices {
  parallelSearchUsd: number;
  parallelExtractUsd: number;
  parallelTaskUsd: Readonly<Record<string, number>>;
  trendtrackUsdPerCredit: number;
  crawl4aiUsdPerPage: number;
  firecrawlUsdPerPage: number | null;
}

/** Everything the service is configured with; read once from the environment by `Env.settings()`. */
export interface Settings {
  appUser: string;
  appPasswordHash: string;
  jwtSecret: string;
  sessionHours: number;
  cookieSecure: boolean;

  openrouterApiKey: string;
  model: string;
  backupModels: string[];

  firecrawlApiKey: string;
  firecrawlBaseUrl: string;
  crawl4aiApiKey: string;
  crawl4aiBaseUrl: string;
  crawl4aiConcurrency: number;
  parallelApiKey: string;
  parallelBaseUrl: string;
  parallelConcurrency: number;
  discoveryProcessor: string;
  discoveryTimeoutSeconds: number;
  trendtrackApiKey: string;
  trendtrackBaseUrl: string;
  trendtrackConcurrency: number;
  webTimeoutSeconds: number;
  fetchCharLimit: number;
  firecrawlConcurrency: number;
  gateModel: string;
  gateCharLimit: number;
  gateTimeoutSeconds: number;
  prices: ServicePrices;

  apifyToken: string;
  apifyMaxReviews: number;
  apifyWaitSeconds: number;
  apifyConcurrency: number;
  apifyPullRetries: number;

  corpusPath: string;

  databasePath: string;
  traceDir: string;
  traceKeepDays: number;
  traceMaxMb: number;
  staticDir: string;
  host: string;
  port: number;
}
