import type { StoredAd } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** An ad is proven when it is still running after a month and has been duplicated: a brand keeps paying for that only while the ad makes money (docs/spec-ads-analysis.md D5). */
export class ProvenRule {
  static readonly MIN_DAYS = 30;
  static readonly MIN_DUPLICATES = 2;

  static isProven(ad: Pick<StoredAd, "status" | "days_running" | "duplicates">): boolean {
    Trace.tick(import.meta.url, "ProvenRule.isProven");
    return ad.status === "active" && (ad.days_running ?? 0) >= ProvenRule.MIN_DAYS && (ad.duplicates ?? 0) >= ProvenRule.MIN_DUPLICATES;
  }
}
