/** A brand a research pass names as selling to the champion's customer: a candidate until its own page is read. */
export interface CompetitorCandidate {
  brand: string;
  name: string;
  url: string;
  form: string;
  market: string;
  icp_as_printed: string;
  evidence_url: string;
  evidence: string;
}

/** What a discovery pass is asked about: the champion and the brief's markets. */
export interface DiscoveryQuestion {
  product: string;
  url: string;
  icp: string;
  form: string;
  actives: readonly string[];
  markets: string;
}

export interface DiscoveryReport {
  candidates: CompetitorCandidate[];
  processor: string;
  taskRunId: string;
}
