import { z } from "zod";

import type { ReviewPlatform } from "./reviews.js";

export const ISSUE_KINDS = ["complaint", "request", "praise"] as const;
export type IssueKind = (typeof ISSUE_KINDS)[number];

export const issueCatalogSchema = z
  .object({
    issues: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9_]+$/),
            label: z.string().min(1),
            kind: z.enum(ISSUE_KINDS),
            description: z.string(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type IssueCatalog = z.infer<typeof issueCatalogSchema>;
export type Issue = IssueCatalog["issues"][number];

export const reviewTagsSchema = z
  .object({
    tags: z.array(
      z
        .object({
          n: z.number().int(),
          issues: z.array(z.string()),
          severity: z.number().int().min(1).max(3),
          off_product: z.boolean(),
          new_label: z.string(),
          new_kind: z.enum(ISSUE_KINDS),
        })
        .strict(),
    ),
  })
  .strict();
export type ReviewTags = z.infer<typeof reviewTagsSchema>;
export type ReviewTag = ReviewTags["tags"][number];

export const issueMergeSchema = z
  .object({
    new_issues: z.array(issueCatalogSchema.shape.issues.element),
    mapping: z.array(z.object({ proposed: z.string(), issue_id: z.string() }).strict()),
  })
  .strict();
export type IssueMerge = z.infer<typeof issueMergeSchema>;

export type StarWeights = Readonly<Record<1 | 2 | 3 | 4 | 5, number>>;

export interface AnalysedReview {
  ref: string;
  target_id: string;
  platform: ReviewPlatform;
  star: number | null;
  title: string;
  text: string;
  locator: string;
}

export interface CleaningTally {
  fetched: number;
  duplicates: number;
  empty: number;
  off_product: number;
  untagged: number;
  kept: number;
}

export interface IssueQuote {
  ref: string;
  star: number | null;
  title: string;
  text: string;
  platform: ReviewPlatform;
  locator: string;
}

export const SOURCE_SCOPES = ["all", "amazon", "other"] as const;
export type SourceScope = (typeof SOURCE_SCOPES)[number];
export const GROUP_SCOPES = ["product", "direct", "indirect"] as const;
export type GroupScope = (typeof GROUP_SCOPES)[number];

export interface ProductIssue {
  issue_id: string;
  mentions: number;
  share: number;
  score: number;
  quotes: string[];
}

export interface ProductVoice {
  source: SourceScope;
  target_id: string;
  name: string;
  relation: string;
  reviews: number;
  stars: [number, number, number, number, number];
  complaints: number;
  issues: ProductIssue[];
}

export interface RankedIssue {
  issue_id: string;
  mentions: number;
  score: number;
  quotes: string[];
}

export interface IssueSlice {
  source: SourceScope;
  group: GroupScope;
  reviews: number;
  ranked: RankedIssue[];
}

export type ReviewAnalysisStatus = "running" | "done" | "failed";

export interface ReviewAnalysis {
  run_id: string;
  status: ReviewAnalysisStatus;
  error: string;
  started_at: string;
  ended_at: string;
  model: string;
  llm_calls: number;
  cost_usd: number;
  star_weights: StarWeights;
  cleaning: CleaningTally;
  issues: Issue[];
  slices: IssueSlice[];
  products: ProductVoice[];
  quotes: Record<string, IssueQuote>;
}
