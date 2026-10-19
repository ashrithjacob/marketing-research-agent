import type { AvatarMemory, ReadAd, StageName, StoredReview } from "../../../domain/index.js";
import { AvatarMemoryBook, AvatarTally } from "../../../extract/index.js";
import { Trace } from "../../../trace/index.js";
import type { RunContext } from "../../pipeline/run-context.js";
import type { Stage, StageInput, StageOutcome } from "../../pipeline/stage.js";

import { AdPlacer } from "./ad-placer.js";
import { AvatarJudge } from "./avatar-judge.js";
import { AvatarReader } from "./avatar-reader.js";
import { ReviewOrder } from "./review-order.js";

/** Stage 5: an agent reads every stored review a batch at a time, building and revising a memory of avatars as it goes; then competitors' ads are placed on them and each avatar judged. Code counts the shares. */
export class AvatarStage implements Stage {
  readonly name: StageName = "avatars";
  static readonly REVIEW_BATCH = 40;
  static readonly AD_BATCH = 15;

  constructor(
    private readonly reader = new AvatarReader(),
    private readonly placer = new AdPlacer(),
    private readonly judge = new AvatarJudge(),
  ) {}

  async run(input: StageInput): Promise<StageOutcome> {
    Trace.line(import.meta.url, "AvatarStage.run", { runId: input.context.run.id });
    const { context } = input;
    const product = (await context.store.products.get(input.product.id))!;
    const reviews = await context.store.reviews.all(product.id);
    if (reviews.length === 0) return { status: "invalid", summary: "", error: "there are no stored reviews to build avatars from" };
    const about = `The client's product: ${product.brand} ${product.name}${product.category ? `, a ${product.category}` : ""}${product.key_active ? ` sold on ${product.key_active}` : ""}.`;
    const { memory: read, skipped } = await this.readReviews(context, reviews, about);
    if (read.avatars.length === 0) return { status: "invalid", summary: "", error: `no avatar came out of ${reviews.length} reviews; ${skipped} batch(es) refused` };
    const ads = (await context.store.ads.list(product.id)).filter((ad) => ad.reading !== null);
    const placed = await this.placeAds(context, read, ads);
    const verdicts = await this.judge.judge(context, placed, ads);
    await context.store.avatars.saveAvatars(context.run.id, AvatarTally.records(placed, verdicts.status === "completed" ? verdicts.value : null, ads));
    const subs = placed.avatars.filter((avatar) => avatar.parent !== null).length;
    const assigned = placed.avatars.reduce((sum, avatar) => sum + avatar.review_ids.length, 0);
    const adsPlaced = placed.avatars.reduce((sum, avatar) => sum + avatar.ad_ids.length, 0);
    const summary =
      `${placed.avatars.length - subs} avatars and ${subs} sub-avatars from ${reviews.length} reviews (${assigned} assigned, ${placed.unassigned_review_ids.length} about no buyer${skipped ? `, ${skipped} batch(es) refused and left out` : ""}); ` +
      `${adsPlaced} of ${ads.length} competitor ads placed.${verdicts.status === "completed" ? "" : " Verdicts missing: every avatar is marked emerging."}`;
    return { status: "completed", summary, error: "" };
  }

  private async readReviews(context: RunContext, reviews: readonly StoredReview[], about: string): Promise<{ memory: AvatarMemory; skipped: number }> {
    Trace.line(import.meta.url, "AvatarStage.readReviews", { reviews: reviews.length });
    let memory = AvatarMemoryBook.empty();
    let skipped = 0;
    for (const batch of ReviewOrder.batches(reviews, AvatarStage.REVIEW_BATCH)) {
      if (context.signal.aborted) break;
      const result = await this.reader.read(context, memory, batch, about);
      if (result.status !== "completed") {
        skipped += 1;
        memory = { ...memory, batches_read: memory.batches_read + 1 };
        continue;
      }
      memory = AvatarMemoryBook.apply(memory, result.value);
      await context.store.avatars.saveMemory(context.run.id, memory);
      await context.emit("avatars.memory", { batch: memory.batches_read, avatars: memory.avatars.map((avatar) => ({ key: avatar.key, reviews: avatar.review_ids.length })) });
    }
    return { memory, skipped };
  }

  private async placeAds(context: RunContext, memory: AvatarMemory, ads: readonly ReadAd[]): Promise<AvatarMemory> {
    Trace.line(import.meta.url, "AvatarStage.placeAds", { ads: ads.length });
    let placed = memory;
    for (let start = 0, number = 1; start < ads.length && !context.signal.aborted; start += AvatarStage.AD_BATCH, number++) {
      const result = await this.placer.place(context, placed, ads.slice(start, start + AvatarStage.AD_BATCH), number);
      if (result.status === "completed") placed = AvatarMemoryBook.placeAds(placed, result.value.place);
    }
    await context.store.avatars.saveMemory(context.run.id, { ...placed, batches_read: placed.batches_read + 1 });
    return placed;
  }
}
