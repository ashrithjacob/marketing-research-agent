import { Http, type TrustpilotProfiles } from "../adapters/index.js";
import {
  Clock,
  type AmazonListing,
  type AmazonListingSource,
  type MiningTarget,
  type TargetListings,
  type TargetListing,
} from "../domain/index.js";
import { ReviewMiningOffer } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import { ListingMatch } from "./listing-match.js";

/** Each review-mining target's Amazon listing, and for one mined on Trustpilot its Trustpilot score, looked up once per stage-1 run and reused when mining starts. */
export class ReviewMiningListings {
  static readonly CANDIDATES = 5;
  static readonly STORES: ReadonlyArray<readonly [RegExp, string]> = [
    [/\.com\.au$|\.co\.nz$|\.nz$/, "www.amazon.com.au"],
    [/\.co\.uk$|\.uk$|\/uk(\/|$)/, "www.amazon.co.uk"],
    [/\.ca$|\/ca(\/|$)/, "www.amazon.ca"],
    [/\.de$/, "www.amazon.de"],
    [/\.fr$/, "www.amazon.fr"],
  ];

  private readonly inFlight = new Map<string, Promise<TargetListing[]>>();

  constructor(
    private readonly listings: TargetListings,
    private readonly source: AmazonListingSource | null,
    private readonly concurrency: number,
    private readonly profiles: TrustpilotProfiles | null = null,
  ) {}

  get available(): boolean {
    Trace.line(import.meta.url, "ReviewMiningListings.available");
    return this.source !== null;
  }

  /** The stored listings, each re-judged by today's matcher, so a verdict from an older rule is never shown or mined. */
  judged(sourceRunId: string, targets: readonly MiningTarget[]): TargetListing[] {
    Trace.line(import.meta.url, "ReviewMiningListings.judged", { sourceRunId, targets: targets.length });
    return this.listings.list(sourceRunId).map((row) => this.recheck(row, targets));
  }

  ensure(sourceRunId: string, targets: readonly MiningTarget[]): Promise<TargetListing[]> {
    Trace.line(import.meta.url, "ReviewMiningListings.ensure", { sourceRunId, targets: targets.length });
    const running = this.inFlight.get(sourceRunId);
    if (running) return running;
    const work = this.fill(sourceRunId, targets).finally(() => this.inFlight.delete(sourceRunId));
    this.inFlight.set(sourceRunId, work);
    return work;
  }

  private async fill(sourceRunId: string, targets: readonly MiningTarget[]): Promise<TargetListing[]> {
    Trace.line(import.meta.url, "ReviewMiningListings.fill", { sourceRunId, targets: targets.length });
    const source = this.source;
    const have = new Map(this.listings.list(sourceRunId).map((row) => [row.target_id, this.recheck(row, targets)]));
    const missing = targets.filter((target) => {
      const row = have.get(target.id);
      return !row || (!row.matches && row.strategy !== ReviewMiningListings.strategy(target));
    });
    if (source && missing.length > 0) {
      await Http.pool(missing, this.concurrency, async (target) => {
        const query = ReviewMiningListings.query(target);
        const found = await source
          .lookup(query, ReviewMiningListings.marketplace(target), ReviewMiningListings.CANDIDATES)
          .catch(() => undefined);
        if (found === undefined) return;
        const matched = found.find((candidate) => ListingMatch.mismatch(target, candidate) === "");
        const listing = matched ?? found[0] ?? null;
        this.listings.save({
          source_run_id: sourceRunId,
          target_id: target.id,
          query,
          strategy: ReviewMiningListings.strategy(target),
          listing,
          matches: matched !== undefined,
          mismatch: listing && !matched ? ListingMatch.mismatch(target, listing) : "",
          error: listing === null ? "no Amazon listing found for this search" : "",
          fetched_at: Clock.nowIso(),
        });
      });
    }
    await this.fillTrustpilot(sourceRunId, targets);
    return this.listings.list(sourceRunId);
  }

  /** Only a target mined on Trustpilot — no matched listing, its own domain — has its Trustpilot page read. */
  private async fillTrustpilot(sourceRunId: string, targets: readonly MiningTarget[]): Promise<void> {
    Trace.line(import.meta.url, "ReviewMiningListings.fillTrustpilot", { sourceRunId });
    const profiles = this.profiles;
    if (!profiles) return;
    const rows = new Map(this.listings.list(sourceRunId).map((row) => [row.target_id, row]));
    const unread = ReviewMiningOffer.of(targets, [...rows.values()]).filter((t) => t.trustpilot && rows.get(t.id) && !rows.get(t.id)!.trustpilot);
    await Http.pool(unread, this.concurrency, async (target) => {
      this.listings.save({ ...rows.get(target.id)!, trustpilot: await profiles.read(target.trustpilot) });
    });
  }

  static marketplace(target: MiningTarget): string {
    Trace.line(import.meta.url, "ReviewMiningListings.marketplace", { url: target.url });
    let where = "";
    try {
      const url = new URL(target.url);
      where = `${url.hostname}${url.pathname}`.toLowerCase();
    } catch {
      return "www.amazon.com";
    }
    const host = where.split("/")[0]!;
    const found = ReviewMiningListings.STORES.find(([pattern]) => pattern.test(host) || pattern.test(where.slice(host.length)));
    return found ? found[1] : "www.amazon.com";
  }

  static strategy(target: MiningTarget): string {
    Trace.line(import.meta.url, "ReviewMiningListings.strategy", { target: target.id });
    return `${ReviewMiningListings.marketplace(target)} top ${ReviewMiningListings.CANDIDATES}, first of this brand`;
  }

  static query(target: MiningTarget): string {
    Trace.line(import.meta.url, "ReviewMiningListings.query", { target: target.id });
    const name = target.name.replace(/\bAmazon:\s*/gi, " ").replace(/[()]/g, " ");
    const branded = target.brand && !ListingMatch.words(name).includes(ListingMatch.words(target.brand)) ? `${target.brand} ${name}` : name;
    return branded.replace(/\s+/g, " ").trim();
  }

  private recheck(row: TargetListing, targets: readonly MiningTarget[]): TargetListing {
    Trace.line(import.meta.url, "ReviewMiningListings.recheck", { target: row.target_id });
    const target = targets.find((t) => t.id === row.target_id);
    if (!target || !row.listing) return row;
    const mismatch = ListingMatch.mismatch(target, row.listing);
    if (row.matches === (mismatch === "") && row.mismatch === mismatch) return row;
    const updated = { ...row, matches: mismatch === "", mismatch };
    this.listings.save(updated);
    return updated;
  }
}
