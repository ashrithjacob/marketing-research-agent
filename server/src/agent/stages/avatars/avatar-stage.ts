import type { AvatarMemory, GapTheme, ReadAd, StageName, StoredReview } from "../../../domain/index.js";
import { AdAvatarTally, AvatarFloor, AvatarMemoryBook, AvatarTally } from "../../../extract/index.js";
import { Trace } from "../../../trace/index.js";
import type { RunContext } from "../../pipeline/run-context.js";
import type { Stage, StageInput, StageOutcome } from "../../pipeline/stage.js";

import { AdAvatars } from "./ad-avatars.js";
import { AdPlacer } from "./ad-placer.js";
import { AvatarJudge } from "./avatar-judge.js";
import { AvatarReader } from "./avatar-reader.js";
import { GapFinder } from "./gap-finder.js";
import { ReviewOrder } from "./review-order.js";
import { SubAvatarSplitter } from "./sub-avatar-splitter.js";

/** Stage 5: avatars from reviews, avatars from ads, and the gaps between them. An agent reads every stored review a batch at a time, building a memory of broad avatars; per avatar, an agent reads that avatar's reviews into its sub-avatars; code folds sub-avatars under the floor into their parents; stage 3's ads are placed on the avatars and each is judged; per avatar an agent lists what its reviews say that its ads do not; and each stage 3 audience segment becomes an ad avatar, written by an agent from its ads. Code counts the shares. */
export class AvatarStage implements Stage {
  readonly name: StageName = "avatars";
  static readonly REVIEW_BATCH = 40;
  static readonly AD_BATCH = 15;

  constructor(
    private readonly reader = new AvatarReader(),
    private readonly placer = new AdPlacer(),
    private readonly judge = new AvatarJudge(),
    private readonly gapFinder = new GapFinder(),
    private readonly adAvatars = new AdAvatars(),
    private readonly splitter = new SubAvatarSplitter(),
  ) {}

  async run(input: StageInput): Promise<StageOutcome> {
    Trace.line(import.meta.url, "AvatarStage.run", { runId: input.context.run.id });
    const { context } = input;
    const product = (await context.store.products.get(input.product.id))!;
    const reviews = await context.store.reviews.all(product.id);
    if (reviews.length === 0) return { status: "invalid", summary: "", error: "there are no stored reviews to build avatars from" };
    const about = `The client's product: ${product.brand} ${product.name}${product.category ? `, a ${product.category}` : ""}${product.key_active ? ` sold on ${product.key_active}` : ""}.`;
    const { memory: read, skipped } = await this.readReviews(context, reviews, about);
    if (context.signal.aborted) return { status: "failed", summary: "", error: "the run was stopped" };
    if (read.avatars.length === 0) return { status: "invalid", summary: "", error: `no avatar came out of ${reviews.length} reviews; ${skipped} batch(es) refused` };
    const split = await this.splitAll(context, read, reviews);
    if (context.signal.aborted) return { status: "failed", summary: "", error: "the run was stopped" };
    const { memory: floored, folded } = AvatarFloor.fold(split.memory);
    const ads = (await context.store.ads.list(context.run.id)).filter((ad) => ad.reading !== null && ad.ring !== "general");
    const placed = await this.placeAds(context, floored, ads);
    if (context.signal.aborted) return { status: "failed", summary: "", error: "the run was stopped" };
    const market = await context.store.market.get(context.run.id);
    const [verdicts, gaps, built] = await Promise.all([this.judge.judge(context, placed, ads, market), this.findGaps(context, placed, reviews, ads), this.adAvatars.build(context, ads, placed.avatars.filter((avatar) => avatar.parent === null))]);
    const reviewAwareness = new Map((market?.evidence ?? []).filter((item) => item.kind === "review" && item.awareness).map((item) => [item.id, item.awareness!]));
    await context.store.avatars.saveAvatars(context.run.id, [...AvatarTally.records(placed, verdicts.status === "completed" ? verdicts.value : null, ads, reviewAwareness, gaps.themes), ...AdAvatarTally.records(built.segments)]);
    const subs = placed.avatars.filter((avatar) => avatar.parent !== null).length;
    const assigned = placed.avatars.reduce((sum, avatar) => sum + avatar.review_ids.length, 0);
    const adsPlaced = placed.avatars.reduce((sum, avatar) => sum + avatar.ad_ids.length, 0);
    const summary =
      `From reviews: ${placed.avatars.length - subs} avatars and ${subs} sub-avatars from ${reviews.length} reviews (${assigned} assigned, ${placed.unassigned_review_ids.length} about no buyer${skipped ? `, ${skipped} batch(es) refused and left out` : ""}${split.skipped ? `, ${split.skipped} sub-avatar batch(es) refused and left with their avatar` : ""}${folded ? `, ${folded} sub-avatar(s) under ${AvatarFloor.MIN_SUB} reviews folded into their parent` : ""}); ` +
      `${adsPlaced} of ${ads.length} ads placed on them.${verdicts.status === "completed" ? "" : " Verdicts missing: every avatar is marked emerging."} ` +
      `From ads: ${built.segments.length} avatars${built.unprofiled ? `, ${built.unprofiled} without a profile` : ""}. Gaps: ${gaps.count} themes across ${gaps.themes.size} avatars${gaps.failed ? `, ${gaps.failed} avatar(s) not checked` : ""}.`;
    return { status: "completed", summary, error: "" };
  }

  private async findGaps(context: RunContext, memory: AvatarMemory, reviews: readonly StoredReview[], ads: readonly ReadAd[]): Promise<{ themes: Map<string, GapTheme[]>; count: number; failed: number }> {
    Trace.line(import.meta.url, "AvatarStage.findGaps", { avatars: memory.avatars.length });
    const byId = new Map(reviews.map((review) => [review.id, review]));
    const tops = memory.avatars.filter((avatar) => avatar.parent === null && avatar.review_ids.length + memory.avatars.filter((sub) => sub.parent === avatar.key).length > 0);
    const results = await Promise.all(tops.map((avatar) => this.gapFinder.find(context, memory, avatar, byId, ads)));
    const themes = new Map<string, GapTheme[]>();
    tops.forEach((avatar, i) => {
      const result = results[i]!;
      if (result.status === "completed") themes.set(avatar.key, result.value.themes);
    });
    return { themes, count: [...themes.values()].reduce((n, list) => n + list.length, 0), failed: results.filter((r) => r.status !== "completed").length };
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

  private async splitAll(context: RunContext, memory: AvatarMemory, reviews: readonly StoredReview[]): Promise<{ memory: AvatarMemory; skipped: number }> {
    Trace.line(import.meta.url, "AvatarStage.splitAll", { avatars: memory.avatars.length });
    const byId = new Map(reviews.map((review) => [review.id, review]));
    let split = memory;
    let skipped = 0;
    for (const avatar of memory.avatars.filter((member) => member.review_ids.length >= SubAvatarSplitter.MIN_REVIEWS)) {
      if (context.signal.aborted) break;
      const result = await this.splitter.split(context, split, avatar, byId);
      split = AvatarMemoryBook.graft(split, avatar.key, result.subs);
      skipped += result.skipped;
    }
    split = { ...split, batches_read: split.batches_read + 1 };
    await context.store.avatars.saveMemory(context.run.id, split);
    return { memory: split, skipped };
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
