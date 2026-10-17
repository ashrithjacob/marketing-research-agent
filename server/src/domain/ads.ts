import { z } from "zod/v4";

export const CLAIM_TYPES = ["plain", "bigger", "mechanism", "identity"] as const;
export const AWARENESS_LEVELS = ["unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"] as const;
export const AD_BUCKETS = ["winning", "testing", "dead"] as const;
export type AdBucket = (typeof AD_BUCKETS)[number];

/** The keywords long-form ads in this category would use in their copy, picked from the product brief. */
export const AdKeywordsSchema = z.object({
  keywords: z.array(z.string().trim().min(2).max(40)).min(2).max(6).describe("Words or short phrases, each likely to appear in the body of a long ad selling this kind of product."),
});

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
}

export interface ReadAd extends StoredAd {
  reading: Omit<AdReading, "ad_id" | "bucket" | "bucket_why"> | null;
}
