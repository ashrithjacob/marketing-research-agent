import { Type } from "@earendil-works/pi-ai";

export const searchParameters = Type.Object({
  query: Type.String({ description: "The search query." }),
  max_results: Type.Optional(Type.Number({ description: "How many results to return (default 10, max 25)." })),
});

export const fetchParameters = Type.Object({
  url: Type.String({ description: "The absolute url to fetch." }),
});

export const adSearchParameters = Type.Object({
  query: Type.String({ description: "What to look for: the customer's problem in the ads' own words, a brand name, or a domain." }),
  search_in: Type.Optional(
    Type.Union([Type.Literal("ad_copy"), Type.Literal("brand"), Type.Literal("domain")], { description: "Where to look: ad_copy (default), brand, or domain." }),
  ),
  max_results: Type.Optional(Type.Number({ description: "How many ads to return (default 10, max 20). Each costs one credit." })),
});
