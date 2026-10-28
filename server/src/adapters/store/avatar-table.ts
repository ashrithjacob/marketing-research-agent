import { Ids, type AvatarMemory, type AvatarQuote, type AvatarRecord, type AvatarStore, type StoredAvatar } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** A run's avatar memory, kept batch by batch, and the avatars it settled on, from reviews and from ads, with their evidence in avatar_members: member reviews, quotes, placed or member ads, and the reviews a gap rests on. */
export class AvatarTable implements AvatarStore {
  constructor(private readonly db: SqlDatabase) {}

  async saveMemory(runId: string, memory: AvatarMemory): Promise<void> {
    Trace.line(import.meta.url, "AvatarTable.saveMemory", { runId, batch: memory.batches_read });
    await this.db.run("INSERT INTO avatar_memories (run_id, batch, memory) VALUES (?,?,?) ON CONFLICT (run_id, batch) DO UPDATE SET memory = EXCLUDED.memory", [
      runId,
      memory.batches_read,
      JSON.stringify(memory),
    ]);
  }

  async saveAvatars(runId: string, records: readonly AvatarRecord[]): Promise<void> {
    Trace.line(import.meta.url, "AvatarTable.saveAvatars", { runId, avatars: records.length });
    const ids = new Map(records.map((record) => [record.avatar.key, Ids.next()]));
    const ordered = [...records].sort((a, b) => Number(a.parent_key !== null) - Number(b.parent_key !== null));
    await this.db.transaction(async (tx) => {
      await tx.run("DELETE FROM avatars WHERE run_id = ?", [runId]);
      for (const { avatar, parent_key, review_ids, quote_ids, ad_ids, gap_review_ids } of ordered) {
        const id = ids.get(avatar.key)!;
        await tx.run(
          "INSERT INTO avatars (id, run_id, parent_id, key, source, name, description, demand_share, supply_share, win_rate, review_count, ad_count, awareness, confidence, standing, profile)" +
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          [id, runId, parent_key ? (ids.get(parent_key) ?? null) : null, avatar.key, avatar.source, avatar.name, avatar.description, avatar.demand_share, avatar.supply_share,
            avatar.win_rate, avatar.review_count, avatar.ad_count, avatar.awareness, avatar.confidence, avatar.standing, JSON.stringify(avatar.profile)],
        );
        const members = [...review_ids.map((item) => ["review", item]), ...quote_ids.map((item) => ["quote", item]), ...ad_ids.map((item) => ["ad", item]), ...gap_review_ids.map((item) => ["gap", item])];
        for (const [type, item] of members) await tx.run("INSERT INTO avatar_members (avatar_id, item_type, item_id) VALUES (?,?,?) ON CONFLICT DO NOTHING", [id, type!, item!]);
      }
    });
  }

  async list(runId: string): Promise<StoredAvatar[]> {
    Trace.line(import.meta.url, "AvatarTable.list", { runId });
    return this.db.all<StoredAvatar>(
      "SELECT id, run_id, parent_id, key, source, name, description, demand_share, supply_share, win_rate, review_count, ad_count, awareness, confidence, standing, profile" +
        " FROM avatars WHERE run_id = ? ORDER BY parent_id NULLS FIRST, demand_share DESC",
      [runId],
    );
  }

  async quotes(runId: string): Promise<AvatarQuote[]> {
    Trace.line(import.meta.url, "AvatarTable.quotes", { runId });
    return this.db.all<AvatarQuote>(
      "SELECT m.avatar_id, m.item_type AS kind, r.id AS review_id, r.rating, r.body, r.source FROM avatar_members m JOIN avatars a ON a.id = m.avatar_id" +
        " JOIN reviews r ON r.id = m.item_id WHERE a.run_id = ? AND m.item_type IN ('quote', 'gap') ORDER BY m.avatar_id, r.rating",
      [runId],
    );
  }
}
