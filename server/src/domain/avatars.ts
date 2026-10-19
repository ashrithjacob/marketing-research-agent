import { z } from "zod/v4";

import { AWARENESS_LEVELS } from "./ads.js";

const Key = z.string().regex(/^[a-z0-9][a-z0-9_]{1,40}$/).describe("A short lower_snake_case key, e.g. ex_smokers.");
const Items = z.array(z.string().min(1).max(200)).max(12);

const ProfileFields = {
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(400).describe("Who they are and what they want, in one or two sentences."),
  pains: Items,
  desires: Items,
  triggers: Items.describe("The moments that made them buy."),
  prior_solutions: Items,
  objections: Items,
  outcomes: Items.describe("What results they describe."),
  angles: Items.describe("Ad angles this avatar would respond to, each grounded in what the reviews say."),
};

/** One avatar as the reading agent holds it in memory. Reviews and quotes are named by review id; code keeps the text. */
export interface AvatarProfile {
  key: string;
  parent: string | null;
  name: string;
  description: string;
  pains: string[];
  desires: string[];
  triggers: string[];
  prior_solutions: string[];
  objections: string[];
  outcomes: string[];
  angles: string[];
  review_ids: string[];
  quote_ids: string[];
  ad_ids: string[];
}

/** The agent's working memory of a market's avatars, rebuilt batch by batch. */
export interface AvatarMemory {
  avatars: AvatarProfile[];
  unassigned_review_ids: string[];
  batches_read: number;
}

/** What the agent does to its memory after reading one batch of reviews. Code applies it, after checking every key and review id. */
export const MemoryUpdateSchema = z.object({
  create: z.array(z.object({ key: Key, parent: Key.nullable().describe("A top-level avatar's key for a sub-avatar, else null."), ...ProfileFields })).default([]),
  revise: z
    .array(z.object(ProfileFields).partial().extend({ key: Key }))
    .default([])
    .describe("Replace the named fields of an existing avatar; use it to sharpen a description or condense a list."),
  merge: z.array(z.object({ from: Key, into: Key })).default([]).describe("Fold one avatar into another; its reviews, quotes and sub-avatars move with it."),
  assign: z.array(z.object({ review_id: z.string().min(1), avatar: Key.nullable().describe("null when the review says nothing about who the buyer is, e.g. shipping only.") })),
  quotes: z.array(z.object({ avatar: Key, review_id: z.string().min(1) })).default([]).describe("Reviews whose words show this avatar best; they must be assigned to it."),
});
export type MemoryUpdate = z.infer<typeof MemoryUpdateSchema>;

/** Where each ad from stage 4 lands on the avatars. */
export const AdPlacementSchema = z.object({
  place: z.array(z.object({ ad_id: z.string().min(1), avatar: Key.nullable().describe("null when the ad targets none of the avatars.") })),
});
export type AdPlacement = z.infer<typeof AdPlacementSchema>;

export const AVATAR_CONFIDENCE = ["low", "medium", "high"] as const;
export const AVATAR_STANDING = ["avatar", "emerging"] as const;

/** The closing judgement on each avatar, made with every count in front of the agent. */
export const AvatarVerdictsSchema = z.object({
  verdicts: z.array(
    z.object({
      key: Key,
      awareness: z.enum(AWARENESS_LEVELS).describe("How much this avatar's reviewers knew about the problem and solutions before buying."),
      confidence: z.enum(AVATAR_CONFIDENCE).describe("How well the evidence supports this avatar: review count, sources, how consistent the reviews are."),
      standing: z.enum(AVATAR_STANDING).describe("emerging when the evidence is too thin to act on yet (the spec's guidance: about 30 reviews)."),
      best_competitor_angle: z.string().nullable().describe("The angle that works best among competitors' ads on this avatar, or null when none target it."),
    }),
  ),
});
export type AvatarVerdicts = z.infer<typeof AvatarVerdictsSchema>;

/** An avatar as stored at the end of the stage, with its numbers counted by code. */
export interface StoredAvatar {
  id: string;
  run_id: string;
  parent_id: string | null;
  key: string;
  name: string;
  description: string;
  demand_share: number;
  supply_share: number | null;
  win_rate: number | null;
  review_count: number;
  ad_count: number;
  awareness: string | null;
  confidence: string | null;
  standing: string;
  profile: Pick<AvatarProfile, "pains" | "desires" | "triggers" | "prior_solutions" | "objections" | "outcomes" | "angles"> & { best_competitor_angle: string | null };
}

export interface AvatarQuote {
  avatar_id: string;
  review_id: string;
  rating: number;
  body: string;
  source: string;
}
