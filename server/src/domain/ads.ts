import { z } from "zod/v4";

import { Trace } from "../trace/index.js";

import type { AdHit } from "./ad-library.js";
import type { PageKind } from "./ad-pull.js";

export const CLAIM_TYPES = ["plain", "bigger", "mechanism", "identity"] as const;
export const AWARENESS_LEVELS = ["unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"] as const;
export const AD_BUCKETS = ["winning", "testing", "dead"] as const;
export type AdBucket = (typeof AD_BUCKETS)[number];

export const PROOF_KINDS = ["clinical_study", "expert", "testimonial", "before_after", "results_timeline", "ingredient_science", "statistics", "social_numbers", "comparison", "third_party_testing", "traditional_use", "media_mention", "guarantee", "none"] as const;
export const OFFER_KINDS = ["discount", "bundle", "subscription", "free_gift", "free_shipping", "guarantee", "price_only", "none"] as const;
export const EMOTION_KINDS = ["fear", "hope", "relief", "shame", "guilt", "anger", "frustration", "grief", "curiosity", "vindication", "belonging", "pride"] as const;
export const LANDING_KINDS = ["advertorial", "listicle", "product_page", "unknown"] as const;
export const COPY_STRUCTURES = ["personal_story", "expert_letter", "listicle", "testimonial_stack", "problem_solution", "comparison"] as const;
/** The leading promise of a long-form ad, the reason the reader should believe this product is different: the real cause the reader's treatment cannot reach; "managed" numbers hiding damage; a cheap or wrong version failed, this form works; not willpower, a ritual to replace; a suppressed or forgotten remedy; a way off drugs, devices or surgery; a brand's own notice (refunds, counterfeits); a plain product introduction. */
export const VALUE_PROPS = ["root_cause", "managed_numbers", "better_form", "replace_ritual", "forgotten_remedy", "off_drugs", "brand_notice", "product_intro"] as const;

/** The rings a growth marketer studies a market's long-form ads in, and the share of the pool each gets: a direct competitor's ad (the same product; what is already said to the buyer); an ad for the same problem from another product (the same buyer at the same moment of pain); an ad for another problem aimed at the same buyer (a format to borrow); a general ad doing well, in any market (a playbook). The first two are supply for the client's avatars; the last two are playbooks. */
export const AD_RINGS = ["direct_competitor", "same_problem", "same_buyer", "general"] as const;
export type AdRing = (typeof AD_RINGS)[number];

/** What an agent reads off one ad: what it says. Its ring was decided by the scout that pulled it; how it is doing is not read, code buckets it from its signals (AdBuckets). */
export const AdReadingSchema = z.object({
  ad_id: z.string().min(1).describe("The ad's id exactly as given."),
  avatar: z.string().min(1).describe("Who the ad speaks to: their situation, in one sentence."),
  claim_type: z.enum(CLAIM_TYPES).describe("The lead claim: plain benefit, bigger (numbers, speed), mechanism (a reason why), or identity (who it is for)."),
  awareness: z.enum(AWARENESS_LEVELS).describe("What the opening assumes the reader already knows."),
  mechanism: z.string().nullable().describe("The named mechanism, or null."),
  proof_types: z.array(z.string()),
  offer: z.string().nullable(),
  objections_handled: z.array(z.string()),
  emotion: z.string().min(1),
  proof_kinds: z.array(z.enum(PROOF_KINDS)).min(1).describe("Every kind of proof the ad uses; none when it uses none."),
  offer_kinds: z.array(z.enum(OFFER_KINDS)).min(1).describe("Every part of the offer: guarantee for a money-back promise, price_only when a price is stated with nothing else, none when the ad only links."),
  emotion_kind: z.enum(EMOTION_KINDS).describe("The emotion the opening leads with."),
  landing_kind: z.enum(LANDING_KINDS).describe("Where the click lands, read from the landing url: advertorial for an article or story page, listicle for a numbered reasons page, product_page for a store product page, unknown when the url does not say."),
  copy_structure: z.enum(COPY_STRUCTURES).describe("How the long copy is built."),
  value_prop: z.enum(VALUE_PROPS).describe("The one leading promise, the reason to believe this product is different."),
  risk_flags: z.array(z.string()).describe("Claims that look risky under FTC or Meta health rules, quoted short."),
});
export type AdReading = z.infer<typeof AdReadingSchema>;

export const AdReadingsSchema = z.object({ ads: z.array(AdReadingSchema).min(1) });
export type AdReadings = z.infer<typeof AdReadingsSchema>;

export interface StoredAd {
  id: string;
  run_id: string;
  product_id: string;
  competitor_id: string | null;
  trendtrack_ad_id: string;
  advertiser: string;
  landing_url: string;
  landing_domain: string;
  status: string;
  copy: string;
  copy_length: number;
  media_url: string | null;
  thumbnail_url: string | null;
  first_seen: string | null;
  last_seen: string | null;
  days_running: number | null;
  duplicates: number | null;
  ad_rank: number | null;
  reach: number | null;
  reach_delta: { d7: number | null; d30: number | null } | null;
  eu_reach: number | null;
  bucket: AdBucket | null;
  bucket_why: string | null;
  audience: { age_min: number | null; age_max: number | null; gender: string | null } | null;
  page_kind: PageKind | null;
  segment: string | null;
}

/** A reading as stored. Ads read before the closed lists existed have no kinds: empty lists and nulls. */
export type StoredReading = Omit<AdReading, "ad_id" | "value_prop" | "emotion_kind" | "landing_kind" | "copy_structure"> & {
  emotion_kind: AdReading["emotion_kind"] | null;
  landing_kind: AdReading["landing_kind"] | null;
  copy_structure: AdReading["copy_structure"] | null;
  value_prop: AdReading["value_prop"] | null;
};

export interface ReadAd extends StoredAd {
  ring: AdRing | null;
  ring_why: string | null;
  reading: StoredReading | null;
}

/** How an ad is doing, from its signals: winning once it has run 10 days, or sooner when still running with early traction (400+ reach in 7 days, or 5+ duplicates); testing while it runs without either; dead when it stopped before 10 days. */
export class AdBuckets {
  static readonly WINNING_DAYS = 10;
  static readonly TRACTION_REACH_7D = 400;
  static readonly TRACTION_DUPLICATES = 5;

  static of(hit: Pick<AdHit, "days_running" | "status" | "reach_delta_7d" | "duplicates">): { bucket: AdBucket; why: string } {
    Trace.tick(import.meta.url, "AdBuckets.of");
    const days = hit.days_running ?? 0;
    if (days >= AdBuckets.WINNING_DAYS) return { bucket: "winning", why: `ran ${days} days` };
    if (hit.status !== "active") return { bucket: "dead", why: `stopped after ${days} days` };
    const reach = hit.reach_delta_7d ?? 0;
    const duplicates = hit.duplicates ?? 0;
    if (reach >= AdBuckets.TRACTION_REACH_7D || duplicates >= AdBuckets.TRACTION_DUPLICATES) return { bucket: "winning", why: `early traction: ${days} days, +${reach} reach in 7 days, ${duplicates} duplicates` };
    return { bucket: "testing", why: `${days} days, still running, no traction yet` };
  }
}

/** The ads that measure supply for the client's buyers, and how a pool is shared between the rings. */
export class AdRings {
  static readonly SHARE: Readonly<Record<AdRing, number>> = { direct_competitor: 0.4, same_problem: 0.25, same_buyer: 0.25, general: 0.1 };

  /** Each ring's quota of a pool of `total` ads, rounded so the quotas add up to the total. */
  static quotas(total: number): Record<AdRing, number> {
    Trace.line(import.meta.url, "AdRings.quotas", { total });
    const quotas = Object.fromEntries(AD_RINGS.map((ring) => [ring, Math.floor(total * AdRings.SHARE[ring])])) as Record<AdRing, number>;
    quotas.direct_competitor += total - AD_RINGS.reduce((sum, ring) => sum + quotas[ring], 0);
    return quotas;
  }

  /** A confirmed competitor's own ad, or one kept in the direct-competitor or same-problem ring. Same-buyer and general ads are playbooks, not supply. */
  static isSupply(ad: ReadAd): boolean {
    Trace.tick(import.meta.url, "AdRings.isSupply");
    return ad.competitor_id !== null || ad.ring === "direct_competitor" || ad.ring === "same_problem";
  }
}
