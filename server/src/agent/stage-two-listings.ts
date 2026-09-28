import { Http } from "../adapters/index.js";
import {
  Clock,
  type AmazonListing,
  type AmazonListingSource,
  type MiningTarget,
  type TargetListings,
  type TargetListing,
} from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { ListingMatch } from "./listing-match.js";

/** Each stage-2 target's Amazon listing, looked up once per stage-1 run and reused when mining starts. */
export class StageTwoListings {
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
  ) {}

  get available(): boolean {
    Trace.line(import.meta.url, "StageTwoListings.available");
    return this.source !== null;
  }

  cached(sourceRunId: string): TargetListing[] {
    Trace.line(import.meta.url, "StageTwoListings.cached", { sourceRunId });
    return this.listings.list(sourceRunId);
  }

  ensure(sourceRunId: string, targets: readonly MiningTarget[]): Promise<TargetListing[]> {
    Trace.line(import.meta.url, "StageTwoListings.ensure", { sourceRunId, targets: targets.length });
    const running = this.inFlight.get(sourceRunId);
    if (running) return running;
    const work = this.fill(sourceRunId, targets).finally(() => this.inFlight.delete(sourceRunId));
    this.inFlight.set(sourceRunId, work);
    return work;
  }

  private async fill(sourceRunId: string, targets: readonly MiningTarget[]): Promise<TargetListing[]> {
    Trace.line(import.meta.url, "StageTwoListings.fill", { sourceRunId, targets: targets.length });
    const source = this.source;
    const have = new Map(this.listings.list(sourceRunId).map((row) => [row.target_id, this.recheck(row, targets)]));
    const missing = targets.filter((target) => {
      const row = have.get(target.id);
      return !row || (!row.matches && row.strategy !== StageTwoListings.strategy(target));
    });
    if (source && missing.length > 0) {
      await Http.pool(missing, this.concurrency, async (target) => {
        const query = StageTwoListings.query(target);
        const found = await source
          .lookup(query, StageTwoListings.marketplace(target), StageTwoListings.CANDIDATES)
          .catch(() => undefined);
        if (found === undefined) return;
        const matched = found.find((candidate) => ListingMatch.mismatch(target, candidate) === "");
        const listing = matched ?? found[0] ?? null;
        this.listings.save({
          source_run_id: sourceRunId,
          target_id: target.id,
          query,
          strategy: StageTwoListings.strategy(target),
          listing,
          matches: matched !== undefined,
          mismatch: listing && !matched ? ListingMatch.mismatch(target, listing) : "",
          error: listing === null ? "no Amazon listing found for this search" : "",
          fetched_at: Clock.nowIso(),
        });
      });
    }
    return this.listings.list(sourceRunId);
  }

  static marketplace(target: MiningTarget): string {
    Trace.line(import.meta.url, "StageTwoListings.marketplace", { url: target.url });
    let where = "";
    try {
      const url = new URL(target.url);
      where = `${url.hostname}${url.pathname}`.toLowerCase();
    } catch {
      return "www.amazon.com";
    }
    const host = where.split("/")[0]!;
    const found = StageTwoListings.STORES.find(([pattern]) => pattern.test(host) || pattern.test(where.slice(host.length)));
    return found ? found[1] : "www.amazon.com";
  }

  static strategy(target: MiningTarget): string {
    Trace.line(import.meta.url, "StageTwoListings.strategy", { target: target.id });
    return `${StageTwoListings.marketplace(target)} top ${StageTwoListings.CANDIDATES}, first of this brand`;
  }

  static query(target: MiningTarget): string {
    Trace.line(import.meta.url, "StageTwoListings.query", { target: target.id });
    const name = target.name.replace(/\bAmazon:\s*/gi, " ").replace(/[()]/g, " ");
    const branded = target.brand && !ListingMatch.words(name).includes(ListingMatch.words(target.brand)) ? `${target.brand} ${name}` : name;
    return branded.replace(/\s+/g, " ").trim();
  }

  private recheck(row: TargetListing, targets: readonly MiningTarget[]): TargetListing {
    Trace.line(import.meta.url, "StageTwoListings.recheck", { target: row.target_id });
    const target = targets.find((t) => t.id === row.target_id);
    if (!target || !row.listing) return row;
    const mismatch = ListingMatch.mismatch(target, row.listing);
    if (row.matches === (mismatch === "") && row.mismatch === mismatch) return row;
    const updated = { ...row, matches: mismatch === "", mismatch };
    this.listings.save(updated);
    return updated;
  }

  static withAmazon(roster: readonly MiningTarget[], listings: readonly TargetListing[]): MiningTarget[] {
    Trace.line(import.meta.url, "StageTwoListings.withAmazon", { roster: roster.length, listings: listings.length });
    const matched = new Map(listings.filter((l) => l.listing && l.matches).map((l) => [l.target_id, l.listing!.url]));
    return roster.map((target) => ({ ...target, amazon_url: matched.get(target.id) ?? target.amazon_url }));
  }
}
