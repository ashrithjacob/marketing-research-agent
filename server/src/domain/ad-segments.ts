import { z } from "zod/v4";

/** The two markets a run's ads are segmented in: the lung market (direct competitors and the same problem) and the same buyer's other problems. General ads are not segmented. */
export const AD_MARKETS = ["client_market", "same_buyer"] as const;
export type AdMarket = (typeof AD_MARKETS)[number];

const KEY = z.string().regex(/^[a-z0-9][a-z0-9_]{1,40}$/).describe("A short lower_snake_case key, e.g. copd_on_oxygen.");

/** The audience segments one market's ads speak to, named from what the reader recorded of each copy. */
export const AudienceSegmentsSchema = z.object({
  segments: z
    .array(
      z.object({
        key: KEY,
        name: z.string().min(1).max(60).describe("The segment as a marketer would name it, a few words: 'COPD patients on inhalers or oxygen'."),
        description: z.string().min(1).describe("One line: who they are and the moment they are in."),
      }),
    )
    .min(1)
    .max(10),
});
export type AudienceSegments = z.infer<typeof AudienceSegmentsSchema>;

/** Which segment each copy of a batch speaks to, by the copy's handle and the segment's key. */
export const SegmentPicksSchema = z.object({
  picks: z.array(z.object({ copy: z.string().min(1).describe("The copy's handle exactly as given (c1, c2, …)."), segment: z.string().min(1).describe("One segment key exactly as given.") })),
});
export type SegmentPicks = z.infer<typeof SegmentPicksSchema>;
