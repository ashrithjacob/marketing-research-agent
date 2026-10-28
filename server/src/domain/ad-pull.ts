import { z } from "zod/v4";

import type { AdHit } from "./ad-library.js";
import type { AdRing } from "./ads.js";

/** What one ring's scout keeps: the refs of the ads it judged in its ring, and, when it keeps fewer than its quota, why the market has no more. */
export const RingPullSchema = z.object({
  kept: z.array(z.string().min(1)).describe("The refs of the ads you keep, exactly as pull_ads showed them (a1, a2, …)."),
  shortfall: z.string().nullable().describe("Only when you keep fewer than your quota: what you searched and why the market has no more. Otherwise null."),
});
export type RingPull = z.infer<typeof RingPullSchema>;

/** Who an ad speaks as, read off the Facebook page that runs it: the brand's own page (bottom of the funnel); a page the advertiser made to look like a community, publication or outlet (upper funnel); a page in a private person's name (top of the funnel); a page in an expert's name, a doctor or nurse (top of the funnel). */
export const PAGE_KINDS = ["brand", "community", "persona", "authority"] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

/** What the page sorter hands back: each page it was shown, by its handle, with its kind. */
export const PageKindsSchema = z.object({
  pages: z.array(
    z.object({
      page: z.string().min(1).describe("The page's handle exactly as given (p1, p2, …)."),
      kind: z.enum(PAGE_KINDS).describe("brand: the brand or store's own page; community: a made-up community, publication or outlet; persona: a private person's name; authority: an expert's name with a credential (Dr., RN, PhD)."),
    }),
  ),
});
export type PageKinds = z.infer<typeof PageKindsSchema>;

/** An ad as a scout kept it: the library's hit, the ring it was kept in, and the search that found it. */
export interface PulledAd {
  hit: AdHit;
  ring: AdRing;
  found_by: string;
}
