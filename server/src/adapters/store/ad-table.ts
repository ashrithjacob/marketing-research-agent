import { AdBuckets, Ids, type AdReading, type PageKind, type AdStore, type PulledAd, type ReadAd, type StoredAd } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** The long-form statics one run pulled, one row per ad per run, each with the ring its scout kept it in and bucketed from its signals when saved, and the reading an agent made of each. A rerun of stage 3 clears its run's ads first. */
export class AdTable implements AdStore {
  constructor(private readonly db: SqlDatabase) {}

  async clear(runId: string): Promise<void> {
    Trace.line(import.meta.url, "AdTable.clear", { runId });
    await this.db.run("DELETE FROM ads WHERE run_id = ?", [runId]);
  }

  async save(accountId: string, runId: string, productId: string, pulled: readonly PulledAd[], competitorByDomain: ReadonlyMap<string, string>): Promise<StoredAd[]> {
    Trace.line(import.meta.url, "AdTable.save", { runId, count: pulled.length });
    await this.db.transaction(async (tx) => {
      for (const { hit, ring, found_by } of pulled) {
        const competitorId = competitorByDomain.get(hit.landing_domain.replace(/^www\./, "")) ?? null;
        const { bucket, why } = AdBuckets.of(hit);
        await tx.run(
          "INSERT INTO ads (id, account_id, run_id, product_id, competitor_id, trendtrack_ad_id, advertiser, landing_url, landing_domain, status, media_url," +
            " thumbnail_url, copy, copy_length, first_seen, last_seen, days_running, duplicates, ad_rank, reach, reach_delta, eu_reach, audience, bucket, bucket_why, ring, ring_why)" +
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT ON CONSTRAINT ads_run_ad DO UPDATE SET status = EXCLUDED.status," +
            " last_seen = EXCLUDED.last_seen, days_running = EXCLUDED.days_running, duplicates = EXCLUDED.duplicates, reach = EXCLUDED.reach," +
            " reach_delta = EXCLUDED.reach_delta, bucket = EXCLUDED.bucket, bucket_why = EXCLUDED.bucket_why, competitor_id = COALESCE(ads.competitor_id, EXCLUDED.competitor_id)",
          [Ids.next(), accountId, runId, productId, competitorId, hit.ad_id, hit.advertiser, hit.landing_url, hit.landing_domain, hit.status, hit.media_url,
            hit.thumbnail_url, hit.body, hit.body.length, hit.first_seen || null, hit.last_seen || null, hit.days_running, hit.duplicates, hit.current_rank,
            hit.ad_reach, JSON.stringify({ d7: hit.reach_delta_7d, d30: hit.reach_delta_30d }), hit.is_eu ? hit.ad_reach : null,
            JSON.stringify({ age_min: hit.age_min, age_max: hit.age_max, gender: hit.gender }), bucket, why, ring, found_by],
        );
      }
    });
    const ids = new Set(pulled.map(({ hit }) => hit.ad_id));
    return (await this.list(runId)).filter((ad) => ids.has(ad.trendtrack_ad_id));
  }

  async saveReading(adId: string, reading: AdReading): Promise<void> {
    Trace.line(import.meta.url, "AdTable.saveReading", { adId });
    await this.db.run(
      "INSERT INTO ad_extractions (ad_id, avatar_label, claim_type, awareness, mechanism, proof_types, offer, objections_handled, emotion, risk_flags," +
        " proof_kinds, offer_kinds, emotion_kind, landing_kind, copy_structure, value_prop)" +
        " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (ad_id) DO UPDATE SET avatar_label = EXCLUDED.avatar_label, claim_type = EXCLUDED.claim_type," +
        " awareness = EXCLUDED.awareness, mechanism = EXCLUDED.mechanism, proof_types = EXCLUDED.proof_types, offer = EXCLUDED.offer," +
        " objections_handled = EXCLUDED.objections_handled, emotion = EXCLUDED.emotion, risk_flags = EXCLUDED.risk_flags, proof_kinds = EXCLUDED.proof_kinds," +
        " offer_kinds = EXCLUDED.offer_kinds, emotion_kind = EXCLUDED.emotion_kind, landing_kind = EXCLUDED.landing_kind, copy_structure = EXCLUDED.copy_structure, value_prop = EXCLUDED.value_prop",
      [adId, reading.avatar, reading.claim_type, reading.awareness, reading.mechanism, JSON.stringify(reading.proof_types), reading.offer,
        JSON.stringify(reading.objections_handled), reading.emotion, JSON.stringify(reading.risk_flags), JSON.stringify(reading.proof_kinds),
        JSON.stringify(reading.offer_kinds), reading.emotion_kind, reading.landing_kind, reading.copy_structure, reading.value_prop],
    );
  }

  async setPageKinds(runId: string, kindByAdvertiser: ReadonlyMap<string, PageKind>): Promise<void> {
    Trace.line(import.meta.url, "AdTable.setPageKinds", { runId, pages: kindByAdvertiser.size });
    await this.db.transaction(async (tx) => {
      for (const [advertiser, kind] of kindByAdvertiser) await tx.run("UPDATE ads SET page_kind = ? WHERE run_id = ? AND advertiser = ?", [kind, runId, advertiser]);
    });
  }

  async setSegments(segmentByAd: ReadonlyMap<string, string>): Promise<void> {
    Trace.line(import.meta.url, "AdTable.setSegments", { ads: segmentByAd.size });
    await this.db.transaction(async (tx) => {
      for (const [adId, segment] of segmentByAd) await tx.run("UPDATE ads SET segment = ? WHERE id = ?", [segment, adId]);
    });
  }

  async link(runId: string, competitorByDomain: ReadonlyMap<string, string>): Promise<number> {
    Trace.line(import.meta.url, "AdTable.link", { runId, competitors: competitorByDomain.size });
    let linked = 0;
    for (const [domain, competitorId] of competitorByDomain) {
      linked += await this.db.run("UPDATE ads SET competitor_id = ? WHERE run_id = ? AND competitor_id IS NULL AND regexp_replace(landing_domain, '^www\\.', '') = ?", [competitorId, runId, domain]);
    }
    return linked;
  }

  async list(runId: string): Promise<ReadAd[]> {
    Trace.line(import.meta.url, "AdTable.list", { runId });
    const rows = await this.db.all(
      "SELECT a.*, to_char(a.first_seen, 'YYYY-MM-DD') AS first_seen, to_char(a.last_seen, 'YYYY-MM-DD') AS last_seen, e.claim_type IS NOT NULL AS read, e.avatar_label," +
        " e.claim_type, e.awareness, e.mechanism, e.proof_types, e.offer, e.objections_handled, e.emotion, e.risk_flags," +
        " e.proof_kinds, e.offer_kinds, e.emotion_kind, e.landing_kind, e.copy_structure, e.value_prop" +
        " FROM ads a LEFT JOIN ad_extractions e ON e.ad_id = a.id WHERE a.run_id = ? ORDER BY a.days_running DESC NULLS LAST, a.id",
      [runId],
    );
    return rows.map((row) => AdTable.ad(row));
  }

  private static ad(row: Record<string, any>): ReadAd {
    Trace.tick(import.meta.url, "AdTable.ad");
    const { read, avatar_label, claim_type, awareness, mechanism, proof_types, offer, objections_handled, emotion, risk_flags, account_id: _account, image_text: _text, win_score: _score,
      proof_kinds, offer_kinds, emotion_kind, landing_kind, copy_structure, value_prop, ...ad } = row;
    const reading = read
      ? { avatar: avatar_label, claim_type, awareness, mechanism, proof_types, offer, objections_handled, emotion, risk_flags, proof_kinds, offer_kinds, emotion_kind, landing_kind, copy_structure, value_prop: value_prop ?? null }
      : null;
    const { ring, ring_why, ...stored } = ad;
    return { ...(stored as StoredAd), ring: ring ?? null, ring_why: ring_why ?? null, reading };
  }
}
