import type { Brief } from "./brief.js";
import { Findings, type Finding } from "./findings.js";
import { Trace } from "../trace/index.js";

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

/** The question a discovery pass asks, from the champion the ledger holds; none until a champion is recorded. */
export class DiscoveryQuestions {
  static of(rows: readonly Finding[], brief: Brief): DiscoveryQuestion | null {
    Trace.line(import.meta.url, "DiscoveryQuestions.of", { rows: rows.length });
    const champion = Findings.live(rows).find((row) => row.kind === "competitor_reference")?.payload;
    if (!champion) return null;
    return {
      product: String(champion.name ?? ""),
      url: brief.url,
      icp: String(champion.icp ?? ""),
      form: String(champion.form ?? ""),
      actives: Array.isArray(champion.actives) ? champion.actives.map(String) : [],
      markets: brief.market,
    };
  }
}
