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

  searxngUrl: string;
  firecrawlApiKey: string;
  firecrawlBaseUrl: string;
  crawl4aiApiKey: string;
  crawl4aiBaseUrl: string;
  crawl4aiConcurrency: number;
  parallelApiKey: string;
  parallelBaseUrl: string;
  parallelConcurrency: number;
  webTimeoutSeconds: number;
  fetchCharLimit: number;
  firecrawlConcurrency: number;
  searchConcurrency: number;
  gateModel: string;
  gateCharLimit: number;
  gateTimeoutSeconds: number;

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
