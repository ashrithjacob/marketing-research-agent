import type { AvatarMemory, AvatarProfile, ReadAd, StoredReview } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";

/** The avatar memory, reviews and ads as text an agent reads; review and ad ids are given so the agent names them rather than copying their text. */
export class MemoryView {
  static readonly MAX_REVIEW_CHARS = 1500;
  static readonly MAX_AD_CHARS = 700;

  static memory(memory: AvatarMemory): string {
    Trace.line(import.meta.url, "MemoryView.memory", { avatars: memory.avatars.length });
    if (memory.avatars.length === 0) return "<memory>No avatars yet: this is the first batch.</memory>";
    const tops = memory.avatars.filter((avatar) => avatar.parent === null);
    const lines = tops.flatMap((top) => [MemoryView.avatar(top, ""), ...memory.avatars.filter((child) => child.parent === top.key).map((child) => MemoryView.avatar(child, "  "))]);
    return `<memory batches_read="${memory.batches_read}" unassigned="${memory.unassigned_review_ids.length}">\n${lines.join("\n")}\n</memory>`;
  }

  static reviews(reviews: readonly StoredReview[]): string {
    Trace.line(import.meta.url, "MemoryView.reviews", { count: reviews.length });
    return reviews
      .map((review) => {
        const body = review.body.length > MemoryView.MAX_REVIEW_CHARS ? `${review.body.slice(0, MemoryView.MAX_REVIEW_CHARS)}…` : review.body;
        const about = review.competitor_id ? "a competitor's product" : "the client's product";
        return `<review id="${review.id}" stars="${review.rating}" source="${review.source}" verified="${review.verified ?? "unknown"}" date="${review.review_date ?? "unknown"}" about="${about}">${review.title ? `${review.title}: ` : ""}${body}</review>`;
      })
      .join("\n");
  }

  static ads(ads: readonly ReadAd[]): string {
    Trace.line(import.meta.url, "MemoryView.ads", { count: ads.length });
    return ads
      .map((ad) => {
        const reading = ad.reading ? `speaks to: ${ad.reading.avatar}; claim ${ad.reading.claim_type}; ${ad.reading.awareness}` : "not read";
        return `<ad id="${ad.id}" advertiser="${ad.advertiser}" bucket="${ad.bucket ?? "unknown"}">${reading}\n${ad.copy.slice(0, MemoryView.MAX_AD_CHARS)}</ad>`;
      })
      .join("\n");
  }

  private static avatar(avatar: AvatarProfile, indent: string): string {
    Trace.tick(import.meta.url, "MemoryView.avatar");
    const list = (label: string, items: readonly string[]) => (items.length > 0 ? `\n${indent}  ${label}: ${items.join(" | ")}` : "");
    return (
      `${indent}- ${avatar.key}${avatar.parent ? ` (sub-avatar of ${avatar.parent})` : ""}: ${avatar.name}. ${avatar.description} [${avatar.review_ids.length} reviews, ${avatar.quote_ids.length} quotes${avatar.ad_ids.length ? `, ${avatar.ad_ids.length} ads` : ""}]` +
      list("pains", avatar.pains) + list("desires", avatar.desires) + list("triggers", avatar.triggers) + list("prior solutions", avatar.prior_solutions) +
      list("objections", avatar.objections) + list("outcomes", avatar.outcomes) + list("angles", avatar.angles)
    );
  }
}
