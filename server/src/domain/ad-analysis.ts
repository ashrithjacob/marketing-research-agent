import { z } from "zod/v4";

export const FIT_VERDICTS = ["supported", "needs_new_claim", "does_not_apply"] as const;
export type FitVerdict = (typeof FIT_VERDICTS)[number];

export const ANGLE_TRENDS = ["rising", "steady", "fading"] as const;
export type AngleTrend = (typeof ANGLE_TRENDS)[number];

/** The steps of the guided read on the long-form ads page (docs/spec-ads-analysis.md); stage 3 writes 2 to 5, stage 6 writes 1 and 6. */
export const AD_STEPS = [1, 2, 3, 4, 5, 6] as const;
export const STAGE3_STEPS = [2, 3, 4, 5] as const;

const KEY = z.string().regex(/^[a-z0-9][a-z0-9_]{1,40}$/).describe("A short lower_snake_case key, e.g. doctor_ex_smoker_story.");

/** What the angle grouper hands back: every read ad of the run in exactly one angle. */
export const AdAnglesSchema = z.object({
  angles: z
    .array(
      z.object({
        key: KEY,
        name: z.string().min(1).describe("The angle in a few words."),
        description: z.string().min(1).describe("One line: what the ads on this angle claim, and to whom."),
        ad_ids: z.array(z.string().min(1)).min(1).describe("Ids of every ad on this angle, exactly as given."),
      }),
    )
    .min(1)
    .max(20),
});
export type AdAngles = z.infer<typeof AdAnglesSchema>;

/** What the fit checker hands back: one verdict per angle on whether the client can run it, citing the client's own claims by index. */
export const AngleFitsSchema = z.object({
  fits: z
    .array(
      z.object({
        angle_key: z.string().min(1),
        verdict: z.enum(FIT_VERDICTS).describe("supported: a claim the client already makes backs the angle; needs_new_claim: it rests on something the client does not claim today; does_not_apply: it is about something the product is not."),
        claim_indexes: z.array(z.number().int().min(0)).describe("The client claims that back it, by index; required for supported."),
        why: z.string().min(1).describe("One line: the claim it rests on, or what the client would need to claim."),
      }),
    )
    .min(1),
});
export type AngleFits = z.infer<typeof AngleFitsSchema>;

/** What the findings writer hands back: one finding per step it is asked for. A headline carries no digits; the page shows the numbers code counted beside it. */
export const AdFindingsSchema = z.object({
  findings: z
    .array(
      z.object({
        step: z.number().int().min(1).max(6),
        subjects: z.array(z.string().min(1)).min(1).describe("What the finding is about: angle keys, label values as label:value, or brand domains, exactly as given."),
        headline: z.string().min(1).max(300).describe("One sentence: what the evidence shows and what it means for the client. No digits: the page shows the numbers."),
        ad_ids: z.array(z.string().min(1)).max(6).describe("Up to six ads to show under it, by id."),
      }),
    )
    .min(1),
});
export type AdFindings = z.infer<typeof AdFindingsSchema>;
export type AdFinding = AdFindings["findings"][number];

export interface AdAngle {
  key: string;
  name: string;
  description: string;
  ad_ids: string[];
  fit: FitVerdict | null;
  fit_claim_indexes: number[];
  fit_why: string | null;
}

export interface AngleHook {
  ad_id: string;
  advertiser: string;
  hook: string;
  days_running: number | null;
}

/** One angle as code counted it: size, how proven, how recent, and whether the client can run it. */
export interface AngleRow {
  key: string;
  name: string;
  description: string;
  ads: number;
  proven: number;
  brands: string[];
  median_days: number | null;
  longest_days: number | null;
  duplicates: number;
  earliest: string | null;
  launched_30d: number;
  launched_60d: number;
  trend: AngleTrend;
  risk_share: number | null;
  fit: FitVerdict | null;
  fit_claims: string[];
  fit_why: string | null;
  hooks: AngleHook[];
}

/** One closed-list value's share among proven ads against the rest. Ranked only when enough ads carry it. */
export interface LabelRow {
  label: string;
  value: string;
  proven: number;
  rest: number;
  proven_share: number;
  rest_share: number;
  difference: number;
  ranked: boolean;
}

export interface BrandRow {
  domain: string;
  advertiser: string;
  competitor: boolean;
  ads: number;
  proven: number;
  launched_60d: number;
  cells: Record<string, { ads: number; proven: number }>;
}

/** Everything the long-form ads page counts, for one run. */
export interface AdsAnalysis {
  as_of: string;
  read: number;
  proven: number;
  proven_ids: string[];
  angle_of: Record<string, string>;
  angles: AngleRow[];
  labels: LabelRow[];
  brands: BrandRow[];
  findings: AdFinding[];
}
