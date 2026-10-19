import type { StoredReview } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";

/** Deals reviews into batches round-robin across product and star rating, so every batch sees the whole market rather than one product's five-star pile. */
export class ReviewOrder {
  static batches(reviews: readonly StoredReview[], size: number): StoredReview[][] {
    Trace.line(import.meta.url, "ReviewOrder.batches", { reviews: reviews.length, size });
    const piles = new Map<string, StoredReview[]>();
    for (const review of reviews) {
      const key = `${review.competitor_id ?? "client"}:${review.rating}`;
      piles.set(key, [...(piles.get(key) ?? []), review]);
    }
    const queues = [...piles.values()];
    const dealt: StoredReview[] = [];
    while (queues.some((queue) => queue.length > 0)) for (const queue of queues) if (queue.length > 0) dealt.push(queue.shift()!);
    return Array.from({ length: Math.ceil(dealt.length / size) }, (_, i) => dealt.slice(i * size, (i + 1) * size));
  }
}
