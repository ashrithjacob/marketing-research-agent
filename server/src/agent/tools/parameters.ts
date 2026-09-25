import { Type } from "@earendil-works/pi-ai";

export const searchParameters = Type.Object({
  query: Type.String({ description: "The search query." }),
  max_results: Type.Optional(
    Type.Number({ description: "How many results to return (default 10, max 25)." }),
  ),
});

export const fetchParameters = Type.Object({
  url: Type.String({ description: "The absolute url to fetch." }),
});

export const packetParameters = Type.Object({
  packet: Type.Unknown({
    description: "The full stage-1 packet, as a JSON object or one JSON string.",
  }),
});

export const findProductParameters = Type.Object({
  query: Type.String({ description: "Product name or phrase to search Amazon for." }),
  max_results: Type.Optional(
    Type.Number({ description: "How many products to return (default 5, max 20)." }),
  ),
});

export const starParameter = Type.Optional(
  Type.Number({
    description:
      "Star band to fetch, 1-5. Omit for a mixed sample. Ask for 3 explicitly — " +
      "3-star coverage is mandatory and is never reliably present in a mixed sample.",
  }),
);

const targetParameter = Type.Optional(
  Type.String({ description: "The roster id this pull belongs to, e.g. product or c1." }),
);

export const amazonReviewParameters = Type.Object({
  target_id: targetParameter,
  product_url: Type.String({ description: "An Amazon product url, e.g. https://www.amazon.com/dp/B0H2JVQ9GR" }),
  star: starParameter,
  max_reviews: Type.Optional(Type.Number({
      description:
        "Reviews to request. The server's default is also its maximum; a larger " +
        "request is cut to it.",
    })),
});

export const trustpilotReviewParameters = Type.Object({
  target_id: targetParameter,
  domain: Type.String({
    description: "Company domain, slug, or Trustpilot /review/ url — e.g. huel.com",
  }),
  star: starParameter,
  max_reviews: Type.Optional(Type.Number({
      description:
        "Reviews to request. The server's default is also its maximum; a larger " +
        "request is cut to it.",
    })),
});

export const mineReviewsParameters = Type.Object({
  listings: Type.Array(
    Type.Object({
      target_id: Type.String({ description: "The roster id this listing belongs to, e.g. product or c1." }),
      product_url: Type.String({ description: "The Amazon product url chosen for that target." }),
    }),
    { description: "Every Amazon listing to mine. Each is fetched once per star band, 1-5, all at once." },
  ),
  trustpilot: Type.Optional(Type.Array(
    Type.Object({
      target_id: Type.String({ description: "The roster id this merchant belongs to." }),
      domain: Type.String({ description: "Company domain, e.g. huel.com" }),
    }),
    { description: "Merchants with a Trustpilot presence worth mining; one mixed-star pull each." },
  )),
});

