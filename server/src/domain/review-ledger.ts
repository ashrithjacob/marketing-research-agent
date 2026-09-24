export interface LedgerExcerpt {
  text: string;
  star: number | null;
  date: string | null;
  locator: string;
  title: string;
  verified: boolean;
}

export interface ReviewLedger {
  cached(bandKey: string, limit: number): LedgerExcerpt[];
  record(bandKey: string, runId: string, excerpts: readonly LedgerExcerpt[]): void;
}
