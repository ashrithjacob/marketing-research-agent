import { MemoryUpdateSchema, type AvatarMemory, type AvatarProfile, type MemoryUpdate, type StoredReview } from "../../../domain/index.js";
import { AvatarFloor, AvatarMemoryBook, AvatarMemoryCheck } from "../../../extract/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { SUB_AVATAR_SYSTEM } from "../../prompt/text/avatars.js";

import { MemoryView } from "./memory-view.js";
import { ReviewOrder } from "./review-order.js";

/** Splits one avatar into the finer groups its own reviews show, read a batch at a time into a memory of sub-avatars; a review left unassigned, or in a refused batch, stays with the avatar. Code checks every key and review id. */
export class SubAvatarSplitter {
  static readonly MAX_TURNS = 4;
  static readonly BATCH = 100;
  static readonly MIN_REVIEWS = 2 * AvatarFloor.MIN_SUB;

  async split(context: RunContext, memory: AvatarMemory, avatar: AvatarProfile, reviews: ReadonlyMap<string, StoredReview>): Promise<{ subs: AvatarMemory; skipped: number }> {
    Trace.line(import.meta.url, "SubAvatarSplitter.split", { avatar: avatar.key, reviews: avatar.review_ids.length });
    const own = avatar.review_ids.map((id) => reviews.get(id)).filter((review): review is StoredReview => review !== undefined);
    const taken = memory.avatars.map((member) => member.key);
    let subs = AvatarMemoryBook.empty();
    let skipped = 0;
    for (const batch of ReviewOrder.batches(own, SubAvatarSplitter.BATCH)) {
      if (context.signal.aborted) break;
      const result = await this.read(context, avatar, subs, batch, taken);
      if (result.status === "completed") subs = AvatarMemoryBook.apply(subs, result.value);
      else {
        skipped += 1;
        subs = { ...subs, batches_read: subs.batches_read + 1 };
      }
    }
    return { subs, skipped };
  }

  private async read(context: RunContext, avatar: AvatarProfile, subs: AvatarMemory, batch: readonly StoredReview[], taken: readonly string[]): Promise<AgentResult<MemoryUpdate>> {
    Trace.line(import.meta.url, "SubAvatarSplitter.read", { avatar: avatar.key, batch: batch.length, read: subs.batches_read });
    const ids = batch.map((review) => review.id);
    return context.agent({
      agentId: `sub_avatar_splitter:${avatar.key}:${subs.batches_read + 1}`,
      system: SUB_AVATAR_SYSTEM,
      instructions: [
        `Avatar to split: ${avatar.key}, ${avatar.name}. ${avatar.description}`,
        subs.avatars.length === 0 ? "<memory>No sub-avatars yet: this is the first batch.</memory>" : MemoryView.memory(subs),
        `Batch ${subs.batches_read + 1} of its reviews, ${batch.length} reviews:`,
        MemoryView.reviews(batch),
      ].join("\n\n"),
      tools: [],
      maxTurns: SubAvatarSplitter.MAX_TURNS,
      reasoning: "low",
      submission: { schema: MemoryUpdateSchema, describe: "Hand back how the sub-avatar memory changes after this batch.", check: (update) => AvatarMemoryCheck.problems(subs, update, ids, taken) },
    });
  }
}
