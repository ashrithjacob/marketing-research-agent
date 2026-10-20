import { Ids, type AdHit, type AdReading, type AdRing, type AdStore, type ReadAd, type StoredAd } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** The long-form statics one run's scout kept, one row per ad per run, and the reading an agent made of each. A rerun of stage 4 clears its run's ads first. */
export class AdTable implements AdStore {
  constructor(private readonly db: SqlDatabase) {}

  async clear(runId: string): Promise<void> {
    Trace.line(import.meta.url, "AdTable.clear", { runId });
    await this.db.run("DELETE FROM ads WHERE run_id = ?", [runId]);
  }

  async save(accountId: string, runId: string, productId: string, hits: readonly AdHit[], competitorByDomain: ReadonlyMap<string, string>): Promise<StoredAd[]> {
    Trace.line(import.meta.url, "AdTable.save", { runId, count: hits.length });
    await this.db.transaction(async (tx) => {
      for (const hit of hits) {
        const competitorId = competitorByDomain.get(hit.landing_domain.replace(/^www\./, "")) ?? null;
        await tx.run(
          "INSERT INTO ads (id, account_id, run_id, product_id, competitor_id, trendtrack_ad_id, advertiser, landing_url, landing_domain, status, media_url," +
            " thumbnail_url, copy, copy_length, first_seen, last_seen, days_running, duplicates, ad_rank, reach, reach_delta, eu_reach, audience)" +
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT ON CONSTRAINT ads_run_ad DO UPDATE SET status = EXCLUDED.status," +
            " last_seen = EXCLUDED.last_seen, days_running = EXCLUDED.days_running, duplicates = EXCLUDED.duplicates, reach = EXCLUDED.reach," +
            " reach_delta = EXCLUDED.reach_delta, competitor_id = COALESCE(ads.competitor_id, EXCLUDED.competitor_id)",
          [Ids.next(), accountId, runId, productId, competitorId, hit.ad_id, hit.advertiser, hit.landing_url, hit.landing_domain, hit.status, hit.media_url,
            hit.thumbnail_url, hit.body, hit.body.length, hit.first_seen || null, hit.last_seen || null, hit.days_running, hit.duplicates, hit.current_rank,
            hit.ad_reach, JSON.stringify({ d7: hit.reach_delta_7d, d30: hit.reach_delta_30d }), hit.is_eu ? hit.ad_reach : null,
            JSON.stringify({ age_min: hit.age_min, age_max: hit.age_max, gender: hit.gender })],
        );
      }
    });
    const ids = new Set(hits.map((hit) => hit.ad_id));
    return (await this.list(runId)).filter((ad) => ids.has(ad.trendtrack_ad_id));
  }

  async saveReading(adId: string, reading: AdReading): Promise<void> {
    Trace.line(import.meta.url, "AdTable.saveReading", { adId, bucket: reading.bucket });
    await this.db.transaction(async (tx) => {
      await tx.run("UPDATE ads SET bucket = ?, bucket_why = ? WHERE id = ?", [reading.bucket, reading.bucket_why, adId]);
      await tx.run(
        "INSERT INTO ad_extractions (ad_id, avatar_label, claim_type, awareness, mechanism, proof_types, offer, objections_handled, emotion, risk_flags)" +
          " VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT (ad_id) DO UPDATE SET avatar_label = EXCLUDED.avatar_label, claim_type = EXCLUDED.claim_type," +
          " awareness = EXCLUDED.awareness, mechanism = EXCLUDED.mechanism, proof_types = EXCLUDED.proof_types, offer = EXCLUDED.offer," +
          " objections_handled = EXCLUDED.objections_handled, emotion = EXCLUDED.emotion, risk_flags = EXCLUDED.risk_flags",
        [adId, reading.avatar, reading.claim_type, reading.awareness, reading.mechanism, JSON.stringify(reading.proof_types), reading.offer,
          JSON.stringify(reading.objections_handled), reading.emotion, JSON.stringify(reading.risk_flags)],
      );
    });
  }

  async saveRing(adId: string, ring: AdRing, why: string): Promise<void> {
    Trace.line(import.meta.url, "AdTable.saveRing", { adId, ring });
    await this.db.run("INSERT INTO ad_extractions (ad_id, relation, relation_why) VALUES (?,?,?) ON CONFLICT (ad_id) DO UPDATE SET relation = EXCLUDED.relation, relation_why = EXCLUDED.relation_why", [adId, ring, why]);
  }

  async list(runId: string): Promise<ReadAd[]> {
    Trace.line(import.meta.url, "AdTable.list", { runId });
    const rows = await this.db.all(
      "SELECT a.*, to_char(a.first_seen, 'YYYY-MM-DD') AS first_seen, to_char(a.last_seen, 'YYYY-MM-DD') AS last_seen, e.claim_type IS NOT NULL AS read, e.avatar_label," +
        " e.claim_type, e.awareness, e.mechanism, e.proof_types, e.offer, e.objections_handled, e.emotion, e.risk_flags, e.relation, e.relation_why" +
        " FROM ads a LEFT JOIN ad_extractions e ON e.ad_id = a.id WHERE a.run_id = ? ORDER BY a.days_running DESC NULLS LAST, a.id",
      [runId],
    );
    return rows.map((row) => AdTable.ad(row));
  }

  private static ad(row: Record<string, any>): ReadAd {
    Trace.tick(import.meta.url, "AdTable.ad");
    const { read, avatar_label, claim_type, awareness, mechanism, proof_types, offer, objections_handled, emotion, risk_flags, relation, relation_why, account_id: _account, image_text: _text, win_score: _score, ...ad } = row;
    const reading = read ? { avatar: avatar_label, claim_type, awareness, mechanism, proof_types, offer, objections_handled, emotion, risk_flags } : null;
    return { ...(ad as StoredAd), ring: relation ?? null, ring_why: relation_why ?? null, reading };
  }
}
