import { z } from "zod/v4";

import { Trace } from "../trace/index.js";

export const CLAIM_TYPES = ["plain", "bigger", "mechanism", "identity"] as const;
export const AWARENESS_LEVELS = ["unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"] as const;
export const AD_BUCKETS = ["winning", "testing", "dead"] as const;
export type AdBucket = (typeof AD_BUCKETS)[number];

export const PROOF_KINDS = ["clinical_study", "expert", "testimonial", "before_after", "results_timeline", "ingredient_science", "statistics", "social_numbers", "comparison", "third_party_testing", "traditional_use", "media_mention", "guarantee", "none"] as const;
export const OFFER_KINDS = ["discount", "bundle", "subscription", "free_gift", "free_shipping", "guarantee", "price_only", "none"] as const;
export const EMOTION_KINDS = ["fear", "hope", "relief", "shame", "guilt", "anger", "frustration", "grief", "curiosity", "vindication", "belonging", "pride"] as const;
export const LANDING_KINDS = ["advertorial", "listicle", "product_page", "unknown"] as const;
export const COPY_STRUCTURES = ["personal_story", "expert_letter", "listicle", "testimonial_stack", "problem_solution", "comparison"] as const;

/** The rings a growth marketer studies a market's long-form ads in: a direct competitor's ad (the same product); an ad for the same problem from another product (the same buyer at the same moment of pain); an ad for another problem aimed at the same buyer (a format to borrow); a winning ad from a trending shop that scales on long-form statics, in any market (a playbook to apply to the client's store). The first two are supply for the client's avatars; the last two are playbooks. */
export const AD_RINGS = ["direct_competitor", "same_problem", "same_buyer", "trending_shop"] as const;
export type AdRing = (typeof AD_RINGS)[number];

/** What the scout hands back: the ads worth studying, each in its ring with why, and the brands it found on the way. Ads are named by the TrendTrack id its searches returned. */
export const ScoutReportSchema = z.object({
  kept: z
    .array(
      z.object({
        ad_id: z.string().min(1).describe("The ad's id exactly as search_ads returned it."),
        ring: z.enum(AD_RINGS),
        why: z.string().min(1).describe("One line: the problem it addresses, who it is aimed at, and why it is worth studying."),
      }),
    )
    .min(1),
  brands: z
    .array(
      z.object({
        brand: z.string().min(1),
        domain: z.string().min(3),
        ring: z.enum(AD_RINGS),
        why: z.string().min(1).describe("One line: what it sells and to whom."),
      }),
    )
    .describe("Every brand you found worth studying, the confirmed competitors included."),
});
export type ScoutReport = z.infer<typeof ScoutReportSchema>;

/** What an agent reads off one ad. The bucket is its judgement from the ad's signals, with the reason. */
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
  risk_flags: z.array(z.string()).describe("Claims that look risky under FTC or Meta health rules, quoted short."),
  bucket: z.enum(AD_BUCKETS).describe("winning: has run long or been duplicated, so it is likely profitable; testing: too new to tell; dead: stopped early."),
  bucket_why: z.string().min(1).describe("One line naming the signals that decided the bucket."),
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
}

/** A reading as stored. Ads read before the closed lists existed have no kinds: empty lists and nulls. */
export type StoredReading = Omit<AdReading, "ad_id" | "bucket" | "bucket_why" | "emotion_kind" | "landing_kind" | "copy_structure"> & {
  emotion_kind: AdReading["emotion_kind"] | null;
  landing_kind: AdReading["landing_kind"] | null;
  copy_structure: AdReading["copy_structure"] | null;
};

export interface ReadAd extends StoredAd {
  ring: AdRing | null;
  ring_why: string | null;
  reading: StoredReading | null;
}

/** The ads that measure supply for the client's buyers: a confirmed competitor's own, or one the scout put in the direct-competitor or same-problem ring. Same-buyer ads are a playbook, not supply. */
export class AdRings {
  static isSupply(ad: ReadAd): boolean {
    Trace.tick(import.meta.url, "AdRings.isSupply");
    return ad.competitor_id !== null || ad.ring === "direct_competitor" || ad.ring === "same_problem";
  }
}
