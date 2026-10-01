import type { MiningTarget, TargetListing } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { BrandLabels, Names } from "./names.js";

/** A target's own Trustpilot domain: the host of its own site, only when that host carries its brand. A retailer's page gives none. */
export class TrustpilotDomain {
  static of(target: MiningTarget): string {
    Trace.line(import.meta.url, "TrustpilotDomain.of", { target: target.id, url: target.url });
    let host: string;
    try {
      host = new URL(target.url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
    if (target.relation === "product") return host;
    const brand = Names.squash(target.brand || target.name);
    const labels = (BrandLabels.of(host) ?? []).map(Names.squash).filter((label) => label.length >= 3);
    return brand && labels.some((label) => brand.includes(label) || label.includes(brand)) ? host : "";
  }
}

/** What review mining mines each target from: its matched Amazon listing, else its own Trustpilot domain, else nothing. One listing belongs to one target. */
export class ReviewMiningOffer {
  static of(roster: readonly MiningTarget[], listings: readonly TargetListing[]): MiningTarget[] {
    Trace.line(import.meta.url, "ReviewMiningOffer.of", { roster: roster.length, listings: listings.length });
    const matched = new Map<string, TargetListing>();
    for (const row of listings) if (row.matches && row.listing) matched.set(row.target_id, row);
    const claimants = new Map<string, string[]>();
    for (const target of roster) {
      const key = ReviewMiningOffer.key(matched.get(target.id));
      if (key) claimants.set(key, [...(claimants.get(key) ?? []), target.id]);
    }
    return roster.flatMap((target) => {
      const row = matched.get(target.id);
      const sharing = claimants.get(ReviewMiningOffer.key(row)) ?? [];
      const collided = sharing.length > 1;
      const amazon = row?.listing && !collided ? row.listing.url : "";
      const trustpilot = amazon ? "" : TrustpilotDomain.of(target);
      const note = collided
        ? `Amazon listing ${row!.listing!.url} matched ${sharing.join(" and ")}, so it is not mined for any of them`
        : "";
      return amazon || trustpilot || note ? [{ ...target, amazon_url: amazon, trustpilot, note }] : [];
    });
  }

  private static key(row: TargetListing | undefined): string {
    Trace.tick(import.meta.url, "ReviewMiningOffer.key", {});
    return row?.listing ? `${row.listing.marketplace}/${row.listing.asin}` : "";
  }
}
