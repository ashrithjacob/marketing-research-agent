import type { AvatarMemory } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** How big a group must be before it is reported on its own, so the avatars generalise instead of fitting single reviews: a sub-avatar under MIN_SUB members is folded into its parent, with its reviews, quotes and ads; an avatar under MIN_AVATAR is kept but reported as emerging. Ad avatars are held to MIN_SUB. */
export class AvatarFloor {
  static readonly MIN_SUB = 5;
  static readonly MIN_AVATAR = 15;

  static fold(memory: AvatarMemory): { memory: AvatarMemory; folded: number } {
    Trace.line(import.meta.url, "AvatarFloor.fold", { avatars: memory.avatars.length });
    const small = memory.avatars.filter((avatar) => avatar.parent !== null && avatar.review_ids.length < AvatarFloor.MIN_SUB);
    const avatars = memory.avatars
      .filter((avatar) => !small.includes(avatar))
      .map((avatar) => {
        const absorbed = small.filter((sub) => sub.parent === avatar.key);
        if (absorbed.length === 0) return avatar;
        const union = (own: string[], pick: (sub: (typeof absorbed)[number]) => string[]) => [...new Set([...own, ...absorbed.flatMap(pick)])];
        return { ...avatar, review_ids: union(avatar.review_ids, (s) => s.review_ids), quote_ids: union(avatar.quote_ids, (s) => s.quote_ids), ad_ids: union(avatar.ad_ids, (s) => s.ad_ids) };
      });
    return { memory: { ...memory, avatars }, folded: small.length };
  }

  static emerging(members: number, sub: boolean): boolean {
    Trace.tick(import.meta.url, "AvatarFloor.emerging");
    return members < (sub ? AvatarFloor.MIN_SUB : AvatarFloor.MIN_AVATAR);
  }
}
