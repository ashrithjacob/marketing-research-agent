import { z } from "zod/v4";

import { Trace } from "../trace/index.js";

export const CLAIM_TYPES = ["plain", "bigger", "mechanism", "identity"] as const;
export const AWARENESS_LEVELS = ["unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"] as const;
export const AD_BUCKETS = ["winning", "testing", "dead"] as const;
export type AdBucket = (typeof AD_BUCKETS)[number];

/** Which of the market's ads an ad is to the growth marketer studying it: one aimed at the same problem (any product), one aimed at the same buyer with another problem (a format to borrow), or noise. A competitor's own ad is known by its domain, so code decides that, not the reader. */
export const AD_RELATIONS = ["same_problem", "same_buyer", "unrelated"] as const;
export type AdRelation = (typeof AD_RELATIONS)[number];

/** The searches that find a category's long-form ads, picked from the product brief: the key active by name, and the problem in phrases buyers use. */
export const AdKeywordsSchema = z.object({
  ingredient_terms: z.array(z.string().trim().min(3).max(40)).min(1).max(3).describe("The key active ingredient as ads name it, e.g. mullein, mullein leaf."),
  problem_phrases: z
    .array(z.string().trim().min(5).max(50))
    .min(2)
    .max(5)
    .describe("The problem in the buyer's own words, each at least two words, e.g. smoker's cough, trapped mucus. Never a single generic word such as cough."),
});
export type AdKeywords = z.infer<typeof AdKeywordsSchema>;

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
  risk_flags: z.array(z.string()).describe("Claims that look risky under FTC or Meta health rules, quoted short."),
  relation: z.enum(AD_RELATIONS).describe("same_problem: it sells something for the client's problem (any product); same_buyer: another problem, but aimed at the client's buyer (age, situation, awareness), worth studying for its structure and hooks; unrelated: neither."),
  relation_why: z.string().min(1).describe("One line: the problem it addresses and who it is aimed at."),
  bucket: z.enum(AD_BUCKETS).describe("winning: has run long or been duplicated, so it is likely profitable; testing: too new to tell; dead: stopped early."),
  bucket_why: z.string().min(1).describe("One line naming the signals that decided the bucket."),
});
export type AdReading = z.infer<typeof AdReadingSchema>;

export const AdReadingsSchema = z.object({ ads: z.array(AdReadingSchema).min(1) });
export type AdReadings = z.infer<typeof AdReadingsSchema>;

export interface StoredAd {
  id: string;
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

export interface ReadAd extends StoredAd {
  reading: Omit<AdReading, "ad_id" | "bucket" | "bucket_why"> | null;
}

/** The ads that measure supply for the client's buyers: a competitor's own, or another product's aimed at the same problem. Same-buyer ads are a playbook, not supply. */
export class AdRings {
  static isSupply(ad: ReadAd): boolean {
    Trace.tick(import.meta.url, "AdRings.isSupply");
    return ad.competitor_id !== null || ad.reading?.relation === "same_problem";
  }
}
