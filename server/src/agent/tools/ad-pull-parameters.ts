import { Type } from "@earendil-works/pi-ai";

export const pullAdsParameters = Type.Object({
  terms: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Words to find, one short phrase each (1-3 words): 'mullein', 'lung detox', 'morning cough'. A long phrase is matched as written and usually finds nothing. Leave out to search by category and audience alone.",
    }),
  ),
  search_in: Type.Optional(
    Type.Union([Type.Literal("ad_copy"), Type.Literal("brand"), Type.Literal("domain")], {
      description: "Where the terms are looked for: ad_copy (default) the ad's text; brand the advertiser's page name; domain the landing page's domain (lungclear.com).",
    }),
  ),
  keyword_mode: Type.Optional(
    Type.Union([Type.Literal("any"), Type.Literal("all")], { description: "With several terms: any (default) matches an ad with at least one of them; all only an ad with every one." }),
  ),
  sort_by: Type.Optional(
    Type.Union([Type.Literal("longestRunning"), Type.Literal("mostDuplicates"), Type.Literal("reach"), Type.Literal("reachDelta7d")], {
      description:
        "Which ads come first: longestRunning (default) the proven scripts; mostDuplicates the ads advertisers copy most, a sign they pay; reach the widest seen; reachDelta7d the ones scaling fastest this week.",
    }),
  ),
  min_days_running: Type.Optional(Type.Number({ description: "Raise the floor of days running above the default 10, e.g. 30 for scripts proven over a month." })),
  min_duplicates: Type.Optional(Type.Number({ description: "Only ads the advertiser has duplicated at least this many times, e.g. 3." })),
  category_ids: Type.Optional(Type.Array(Type.Number(), { description: "Category ids from find_ad_categories; matched against the advertiser's shop." })),
  min_age: Type.Optional(Type.Number({ description: "Lower end of the targeted audience's age, as Meta reports it, e.g. 45. Many ads target 18-65+, so a tight range drops them." })),
  max_age: Type.Optional(Type.Number({ description: "Upper end of the targeted audience's age." })),
  sex: Type.Optional(Type.Union([Type.Literal("men"), Type.Literal("women")], { description: "Only ads targeted at men, or at women. Leave out for both." })),
  page: Type.Optional(Type.Number({ description: "Which page of this same search, from 1. Ask for the next page to see more of a search that matched more than it showed." })),
  limit: Type.Optional(Type.Number({ description: "Ads per page, 1 to 50 (default 25). Every ad returned is billed." })),
});

export const findAdCategoriesParameters = Type.Object({
  search: Type.String({ description: "A word in the category's name or path: 'supplements', 'health', 'tea'." }),
});

export const readPulledAdParameters = Type.Object({
  ref: Type.String({ description: "An ad's ref from pull_ads, e.g. a12." }),
});
