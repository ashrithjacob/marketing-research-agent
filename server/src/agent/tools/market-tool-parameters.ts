import { Type } from "@earendil-works/pi-ai";

export const listAdsParameters = Type.Object({});

export const adHistoryParameters = Type.Object({
  domain: Type.String({ description: "A competitor's domain, e.g. trybetterbrand.com." }),
  sort_by: Type.Union([Type.Literal("longestRunning"), Type.Literal("newest")], { description: "longestRunning finds the claims that paid; newest shows what is being tried now." }),
  created_after: Type.Optional(Type.String({ description: "Only ads first seen on or after this date, YYYY-MM-DD." })),
  created_before: Type.Optional(Type.String({ description: "Only ads first seen before this date, YYYY-MM-DD." })),
  limit: Type.Optional(Type.Number({ description: "1 to 20 (default 10). Every ad returned is billed." })),
});

export const pageHistoryParameters = Type.Object({
  url: Type.String({ description: "A competitor's page, e.g. its home page or product page." }),
});

export const readSnapshotParameters = Type.Object({
  snapshot_id: Type.String({ description: "A snapshot id from page_history." }),
});

export const suggestionsParameters = Type.Object({
  seed: Type.String({ description: "What a buyer starts typing: a symptom, the ingredient, the product type, a brand." }),
  source: Type.Union([Type.Literal("google"), Type.Literal("amazon")]),
});

export const volumeParameters = Type.Object({
  query_ids: Type.Array(Type.String(), { description: "Ids of Google queries from search_suggestions to look up. One call covers up to 1,000." }),
});

export const amazonSearchParameters = Type.Object({
  keywords: Type.Array(Type.String(), { description: "1 to 3 searches a buyer would type, e.g. 'mullein drops'." }),
});

export const redditParameters = Type.Object({
  keywords: Type.Array(Type.String(), { description: "1 to 3 keyword searches, e.g. 'mullein cough'." }),
  subreddits: Type.Optional(Type.Array(Type.String(), { description: "Communities to read instead of searching all of Reddit, e.g. COPD, quittingsmoking." })),
});

export const findReviewsParameters = Type.Object({
  phrase: Type.String({ description: "Words to find in the stored reviews, e.g. 'tried everything', 'skeptical', 'doctor'." }),
});

export const readLandingParameters = Type.Object({
  ad_id: Type.String({ description: "An ad id from list_ads; its landing page is read." }),
});
