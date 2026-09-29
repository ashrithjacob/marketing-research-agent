import {
  CONTRACT_VERSION,
  type Brief,
  type MiningTarget,
  type ReviewLedgerSnapshot,
} from "../domain/index.js";
import { Trace } from "../trace/index.js";

export interface PullFailure {
  target_id: string;
  listing: string;
  error: string;
}

type Row = Record<string, unknown>;

/** The stage-2 packet, computed from what the pulls brought back: no model writes any of it. Reviews are added by ReviewAssembly. */
export class StageTwoPacket {
  constructor(
    private readonly targets: readonly MiningTarget[],
    private readonly ledger: ReviewLedgerSnapshot,
    private readonly failures: readonly PullFailure[],
  ) {
    Trace.line(import.meta.url, "StageTwoPacket.constructor", { targets: targets.length });
  }

  draft(runId: string, brief: Brief): Record<string, unknown> {
    Trace.line(import.meta.url, "StageTwoPacket.draft", { runId });
    return {
      contract_version: CONTRACT_VERSION,
      stage: 2,
      run_id: runId,
      brief,
      measurements: this.measurements(),
      nodes: [this.status()],
      gaps: this.gaps(),
    };
  }

  private status(): Row {
    Trace.line(import.meta.url, "StageTwoPacket.status");
    const mined = this.targets.filter((t) => t.amazon_url || t.trustpilot);
    const pullsOf = (id: string) => new Set(this.ledger.pulls.filter((p) => p.target_id === id).map((p) => p.handle));
    const without = mined.filter((t) => {
      const pulls = pullsOf(t.id);
      return !this.ledger.reviews.some((r) => pulls.has(r.pull) && r.star === 3);
    });
    const complete = mined.length > 0 && without.length === 0;
    return {
      node: "review_mining",
      status: complete ? "complete" : "incomplete",
      done_criterion_met: complete,
      why: complete
        ? `every mined target (${mined.length}) has at least one 3-star review`
        : mined.length === 0
          ? "no target could be mined"
          : `no 3-star review for ${without.map((t) => t.id).join(", ")}`,
    };
  }

  private measurements(): Row[] {
    Trace.line(import.meta.url, "StageTwoPacket.measurements");
    const seen = new Set<string>();
    return this.ledger.pulls.flatMap((pull) => {
      if (seen.has(pull.listing) || (pull.total_reviews === null && pull.total_ratings === null)) return [];
      seen.add(pull.listing);
      const row = (metric: string, value: number | null, id: string): Row[] =>
        value === null ? [] : [{ id, node: "review_mining", metric, value, unit: "reviews", period: pull.listing, source_id: pull.handle }];
      return [
        ...row("written_reviews_total", pull.total_reviews, `m-${pull.handle}-written`),
        ...row("ratings_total", pull.total_ratings, `m-${pull.handle}-ratings`),
      ];
    });
  }

  private gaps(): Row[] {
    Trace.line(import.meta.url, "StageTwoPacket.gaps");
    const gap = (missing: string, would_need: string): Row => ({ node: "review_mining", missing, would_need, blocking: false });
    return [
      ...this.targets.filter((t) => t.note).map((t) => gap(`${t.id}: ${t.note}`, "a listing that only this target matches")),
      ...this.ledger.pulls.filter((p) => p.gap).map((p) => gap(`${p.target_id}: ${p.gap}`, "")),
      ...this.failures.map((f) => gap(`${f.target_id}: the pull of ${f.listing} failed — ${f.error}`, "a successful pull")),
    ];
  }
}
