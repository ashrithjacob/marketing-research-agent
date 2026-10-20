/** What each paid service's unit costs, for services that report units and not dollars; null where the price is not known. */
export interface ServicePrices {
  parallelSearchUsd: number;
  parallelExtractUsd: number;
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
  firecrawlConcurrency: number;
  crawl4aiApiKey: string;
  crawl4aiBaseUrl: string;
  crawl4aiConcurrency: number;
  parallelApiKey: string;
  parallelBaseUrl: string;
  parallelConcurrency: number;
  trendtrackApiKey: string;
  trendtrackBaseUrl: string;
  trendtrackConcurrency: number;
  apifyToken: string;
  apifyWaitSeconds: number;
  webTimeoutSeconds: number;
  fetchCharLimit: number;
  prices: ServicePrices;

  reviewsPerProduct: number;
  reviewsPerBand: number;
  wootDelayMs: number;
  adsPerRun: number;
  adSearchesPerRun: number;
  adMinCopyChars: number;
  adsPerBrand: number;
  marketHistorySearches: number;
  marketPaidCalls: number;

  databaseUrl: string;
  databaseConnections: number;
  traceDir: string;
  traceKeepDays: number;
  traceMaxMb: number;
  staticDir: string;
  host: string;
  port: number;
}
