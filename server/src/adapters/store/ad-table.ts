import { Ids, type AdHit, type AdReading, type AdStore, type ReadAd, type StoredAd } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** The long-form statics found for a product's analysis, one row per ad per product, and the reading an agent made of each. */
export class AdTable implements AdStore {
  constructor(private readonly db: SqlDatabase) {}

  async save(accountId: string, productId: string, hits: readonly AdHit[], competitorByDomain: ReadonlyMap<string, string>): Promise<StoredAd[]> {
    Trace.line(import.meta.url, "AdTable.save", { productId, count: hits.length });
    await this.db.transaction(async (tx) => {
      for (const hit of hits) {
        const competitorId = competitorByDomain.get(hit.landing_domain.replace(/^www\./, "")) ?? null;
        await tx.run(
          "INSERT INTO ads (id, account_id, product_id, competitor_id, trendtrack_ad_id, advertiser, landing_url, landing_domain, status, media_url," +
            " thumbnail_url, copy, copy_length, first_seen, last_seen, days_running, duplicates, ad_rank, reach, reach_delta, eu_reach)" +
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT ON CONSTRAINT ads_product_ad DO UPDATE SET status = EXCLUDED.status," +
            " last_seen = EXCLUDED.last_seen, days_running = EXCLUDED.days_running, duplicates = EXCLUDED.duplicates, reach = EXCLUDED.reach," +
            " reach_delta = EXCLUDED.reach_delta, competitor_id = COALESCE(ads.competitor_id, EXCLUDED.competitor_id)",
          [Ids.next(), accountId, productId, competitorId, hit.ad_id, hit.advertiser, hit.landing_url, hit.landing_domain, hit.status, hit.media_url,
            hit.thumbnail_url, hit.body, hit.body.length, hit.first_seen || null, hit.last_seen || null, hit.days_running, hit.duplicates, hit.current_rank,
            hit.ad_reach, JSON.stringify({ d7: hit.reach_delta_7d, d30: hit.reach_delta_30d }), hit.is_eu ? hit.ad_reach : null],
        );
      }
    });
    const ids = new Set(hits.map((hit) => hit.ad_id));
    return (await this.list(productId)).filter((ad) => ids.has(ad.trendtrack_ad_id));
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

  async list(productId: string): Promise<ReadAd[]> {
    Trace.line(import.meta.url, "AdTable.list", { productId });
    const rows = await this.db.all(
      "SELECT a.*, to_char(a.first_seen, 'YYYY-MM-DD') AS first_seen, to_char(a.last_seen, 'YYYY-MM-DD') AS last_seen, e.ad_id AS read_id, e.avatar_label," +
        " e.claim_type, e.awareness, e.mechanism, e.proof_types, e.offer, e.objections_handled, e.emotion, e.risk_flags" +
        " FROM ads a LEFT JOIN ad_extractions e ON e.ad_id = a.id WHERE a.product_id = ? ORDER BY a.days_running DESC NULLS LAST, a.id",
      [productId],
    );
    return rows.map((row) => AdTable.ad(row));
  }

  private static ad(row: Record<string, any>): ReadAd {
    Trace.tick(import.meta.url, "AdTable.ad");
    const { read_id, avatar_label, claim_type, awareness, mechanism, proof_types, offer, objections_handled, emotion, risk_flags, account_id: _account, image_text: _text, win_score: _score, ...ad } = row;
    const reading = read_id ? { avatar: avatar_label, claim_type, awareness, mechanism, proof_types, offer, objections_handled, emotion, risk_flags } : null;
    return { ...(ad as StoredAd), reading };
  }
}
