import { z } from "zod/v4";

/** Where an avatar was built from: buyers' reviews, or stage 3's audience segments of the market's ads. */
export const AVATAR_SOURCES = ["reviews", "ads"] as const;
export type AvatarSource = (typeof AVATAR_SOURCES)[number];

const Items = z.array(z.string().min(1).max(200)).max(8);

/** An avatar written from one audience segment's ads: who they speak to and what they press on, with the ads that show it best named by id. */
export const AdAvatarProfileSchema = z.object({
  description: z.string().min(1).max(400).describe("Who these ads speak to and what they want, in one or two sentences."),
  pains: Items,
  desires: Items,
  triggers: Items.describe("The moments the ads say made the reader act."),
  objections: Items.describe("The doubts the ads answer."),
  angles: Items.describe("The angles the ads use on this audience."),
  quote_ad_ids: z.array(z.string().min(1)).min(1).max(3).describe("One to three ads that show this audience best, by id exactly as given."),
});

/** Why a same-buyer segment is the client's buyer: which of the client's review avatars its readers are, what they share, and what of its ads carries over. */
export const SameBuyerSchema = z.object({
  review_avatar: z.string().min(1).nullable().describe("The key of the client's avatar these readers are, exactly as listed, or null when they are none of them."),
  shared: z.string().min(1).max(300).describe("What makes them the client's buyer, in one sentence: the age, sex, situation or awareness they share with that avatar."),
  borrow: Items.describe("The angles, hooks, story structures, proof formats or offers these ads use that would carry over to the client's product."),
});
export type SameBuyer = z.infer<typeof SameBuyerSchema>;

export const SameBuyerAdAvatarProfileSchema = AdAvatarProfileSchema.extend({ same_buyer: SameBuyerSchema });
export type AdAvatarProfile = z.infer<typeof AdAvatarProfileSchema> & { same_buyer?: SameBuyer };

export const GAP_KINDS = ["pain", "desire", "trigger", "objection", "outcome", "prior_solution"] as const;

/** What a review avatar's buyers say that none of the ads placed on it say, each theme resting on the avatar's own reviews. */
export const GapThemesSchema = z.object({
  themes: z
    .array(
      z.object({
        kind: z.enum(GAP_KINDS),
        theme: z.string().min(1).max(200).describe("What the buyers say, in their terms, that no ad here says."),
        review_ids: z.array(z.string().min(1)).min(1).max(4).describe("One to four of this avatar's reviews that say it, by id exactly as given."),
      }),
    )
    .max(8),
});
export type GapThemes = z.infer<typeof GapThemesSchema>;
export type GapTheme = GapThemes["themes"][number];
