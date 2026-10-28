import type { AvatarMemory, MemoryUpdate } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** Every way an update to the avatar memory can be wrong: an unknown key, a key another avatar already holds, a review left out or invented, a quote from a review assigned elsewhere. */
export class AvatarMemoryCheck {
  static problems(memory: AvatarMemory, update: MemoryUpdate, batch: readonly string[], taken: readonly string[] = []): string[] {
    Trace.line(import.meta.url, "AvatarMemoryCheck.problems", { avatars: memory.avatars.length, batch: batch.length, taken: taken.length });
    const keys = new Set(memory.avatars.map((avatar) => avatar.key));
    const problems: string[] = [];
    for (const created of update.create) {
      if (keys.has(created.key)) problems.push(`create ${created.key}: that key already exists; use revise`);
      else if (taken.includes(created.key)) problems.push(`create ${created.key}: another avatar already has that key; choose another`);
      keys.add(created.key);
    }
    const known = (key: string, where: string): void => {
      if (!keys.has(key)) problems.push(`${where}: avatar ${key} does not exist`);
    };
    update.revise.forEach((revised) => known(revised.key, "revise"));
    for (const merge of update.merge) {
      known(merge.from, "merge");
      known(merge.into, "merge");
      if (merge.from === merge.into) problems.push(`merge ${merge.from}: an avatar cannot merge into itself`);
    }
    problems.push(...AvatarMemoryCheck.assignments(update, batch, (key) => known(key, "assign")));
    const assignedTo = new Map<string, string | null>(memory.avatars.flatMap((avatar) => avatar.review_ids.map((id) => [id, avatar.key] as const)));
    for (const assignment of update.assign) assignedTo.set(assignment.review_id, assignment.avatar);
    for (const quote of update.quotes) {
      known(quote.avatar, "quote");
      if (assignedTo.get(quote.review_id) !== quote.avatar) problems.push(`quote ${quote.review_id}: it is not assigned to ${quote.avatar}`);
    }
    return problems;
  }

  private static assignments(update: MemoryUpdate, batch: readonly string[], known: (key: string) => void): string[] {
    Trace.line(import.meta.url, "AvatarMemoryCheck.assignments", { assigned: update.assign.length, batch: batch.length });
    const problems: string[] = [];
    const given = new Set(batch);
    const seen = new Set<string>();
    for (const assignment of update.assign) {
      if (!given.has(assignment.review_id)) problems.push(`assign ${assignment.review_id}: that review is not in this batch; copy each id exactly`);
      if (seen.has(assignment.review_id)) problems.push(`assign ${assignment.review_id}: assigned twice`);
      seen.add(assignment.review_id);
      if (assignment.avatar !== null) known(assignment.avatar);
    }
    const missing = batch.filter((id) => !seen.has(id));
    if (missing.length > 0) problems.push(`${missing.length} review(s) in this batch are not assigned: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? ", …" : ""}`);
    return problems;
  }
}
