import type { AvatarMemory, AvatarProfile, MemoryUpdate } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** Applies a checked update to the avatar memory: creations, revisions, assignments and quotes first, merges last, so everything assigned to a merged avatar moves with it. */
export class AvatarMemoryBook {
  static empty(): AvatarMemory {
    Trace.line(import.meta.url, "AvatarMemoryBook.empty");
    return { avatars: [], unassigned_review_ids: [], batches_read: 0 };
  }

  static apply(memory: AvatarMemory, update: MemoryUpdate): AvatarMemory {
    Trace.line(import.meta.url, "AvatarMemoryBook.apply", { create: update.create.length, merge: update.merge.length, assign: update.assign.length });
    const avatars = new Map<string, AvatarProfile>(memory.avatars.map((avatar) => [avatar.key, structuredClone(avatar)]));
    for (const created of update.create) avatars.set(created.key, { ...created, review_ids: [], quote_ids: [], ad_ids: [] });
    for (const { key, ...fields } of update.revise) Object.assign(avatars.get(key)!, Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)));
    const unassigned = [...memory.unassigned_review_ids];
    for (const assignment of update.assign) {
      if (assignment.avatar === null) unassigned.push(assignment.review_id);
      else avatars.get(assignment.avatar)!.review_ids.push(assignment.review_id);
    }
    for (const quote of update.quotes) {
      const avatar = avatars.get(quote.avatar)!;
      if (!avatar.quote_ids.includes(quote.review_id)) avatar.quote_ids.push(quote.review_id);
    }
    for (const merge of update.merge) AvatarMemoryBook.merge(avatars, merge.from, merge.into);
    return { avatars: [...avatars.values()], unassigned_review_ids: unassigned, batches_read: memory.batches_read + 1 };
  }

  static placeAds(memory: AvatarMemory, placements: readonly { ad_id: string; avatar: string | null }[]): AvatarMemory {
    Trace.line(import.meta.url, "AvatarMemoryBook.placeAds", { placements: placements.length });
    const avatars = memory.avatars.map((avatar) => ({ ...avatar, ad_ids: [...avatar.ad_ids] }));
    for (const placement of placements) avatars.find((avatar) => avatar.key === placement.avatar)?.ad_ids.push(placement.ad_id);
    return { ...memory, avatars };
  }

  private static merge(avatars: Map<string, AvatarProfile>, from: string, into: string): void {
    Trace.line(import.meta.url, "AvatarMemoryBook.merge", { from, into });
    const source = avatars.get(from);
    const target = avatars.get(into);
    if (!source || !target) return;
    target.review_ids = [...new Set([...target.review_ids, ...source.review_ids])];
    target.quote_ids = [...new Set([...target.quote_ids, ...source.quote_ids])];
    target.ad_ids = [...new Set([...target.ad_ids, ...source.ad_ids])];
    for (const avatar of avatars.values()) if (avatar.parent === from) avatar.parent = into;
    avatars.delete(from);
  }
}
