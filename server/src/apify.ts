/**
 * Apify, as much of it as review mining needs.
 *
 * This module is the boundary and nothing else: it knows actor ids, input
 * shapes, output field names, and what a call costs. Every judgement about
 * whether a review is admissible lives in the packet schema and the prompt.
 *
 * **Why Apify at all.** Measured from the VPS on 2026-09-17, Amazon serves this
 * address a bot page — at **HTTP 200**, 3.7 KB — to plain curl, to headless
 * Chrome, and through Firecrawl in both proxy modes. The block is keyed to the
 * address, so no fetch tuning reaches it. Apify runs the scraper on *its*
 * addresses. See `spec-review-mining.md` §3 and §5.
 *
 * **Everything below was measured against the live actors**, not read from their
 * READMEs — whose documented field names are wrong. It is `reviewDescription`,
 * not `text`; `ratingScore`, not `rating`. An adapter written from the docs
 * returns `undefined` for every excerpt and looks like an empty source.
 */

import type { Settings } from "./config/index.js";

/** Reviews for one product. `filterByRatings` takes one discrete band per call. */
export const AMAZON_REVIEWS_ACTOR = "junglee/amazon-reviews-scraper";
/** Reviews for one company. Trustpilot has no per-product reviews. */
export const TRUSTPILOT_ACTOR = "memo23/trustpilot-scraper-ppe";
/** Search page -> ASINs. A brief names a product *title*, never an ASIN. */
export const AMAZON_SEARCH_ACTOR = "junglee/free-amazon-product-scraper";

/**
 * Apify rejects a `maxTotalChargeUsd` *below* the actor's own minimum with a
 * 400 at call time — measured 2026-09-17: "Maximum cost per run is less than
 * the allowed minimum of $0.50". The safety instinct, setting a small cap,
 * fails the call outright, so these are floors and not budgets.
 *
 * They are not minimum *charges*: a run returning one error record cost $0.006.
 */
export const MIN_CAP_USD = {
  [AMAZON_REVIEWS_ACTOR]: 0.5,
  [TRUSTPILOT_ACTOR]: 0.45,
  [AMAZON_SEARCH_ACTOR]: 0.005,
} as const satisfies Record<string, number>;

/**
 * Observed FREE-tier unit prices, 2026-09-17. Used to size a cap, never to
 * predict a bill — the authority on what a run cost is `chargedEventCounts`.
 */
const UNIT_PRICE_USD = {
  [AMAZON_REVIEWS_ACTOR]: 0.006,
  [TRUSTPILOT_ACTOR]: 0.00075,
  [AMAZON_SEARCH_ACTOR]: 0.012,
} as const satisfies Record<string, number>;

/** Per-run start fee, where the actor charges one. */
const START_FEE_USD = { [TRUSTPILOT_ACTOR]: 0.05 } as const;

/**
 * A spend ceiling big enough to buy what was asked for.
 *
 * **The actor's minimum cap is not a sufficient cap.** Measured the hard way:
 * `AMAZON_SEARCH_ACTOR` accepts a $0.005 cap — its own stated minimum — and
 * then dies with *"Charge limit has already been reached, cannot start the
 * actor"*, because one result costs $0.012. It returns an **empty dataset**,
 * which reads exactly like "no products matched".
 *
 * So the cap is sized from the volume requested, with 2x headroom, and floored
 * at whatever Apify will accept for that actor.
 */
export function capFor(actorId: keyof typeof UNIT_PRICE_USD, items: number): number {
  const start = (START_FEE_USD as Record<string, number>)[actorId] ?? 0;
  const need = start + Math.max(items, 1) * UNIT_PRICE_USD[actorId] * 2;
  return Math.max(MIN_CAP_USD[actorId], Number(need.toFixed(4)));
}

/** Amazon's star bands, as the actor names them. Never the `positive` /
 *  `critical` aggregates: they overlap, and an overlapped spread cannot be
 *  verified against what was asked for. */
export const STAR_BAND: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "oneStar",
  2: "twoStar",
  3: "threeStar",
  4: "fourStar",
  5: "fiveStar",
};

/** One customer's own words, already shaped for `spec-stage-1.md` §2.3. */
export interface ReviewExcerpt {
  /** Verbatim. Never normalised — §2.3 makes the degradation irreversible. */
  text: string;
  star: number | null;
  /** ISO date where the actor gives one, else the actor's own string. */
  date: string | null;
  /** The url of this review, for a locator. */
  locator: string;
  title: string;
  verified: boolean;
  source: "amazon" | "trustpilot";
}

export interface ReviewResult {
  excerpts: ReviewExcerpt[];
  /**
   * Why this came up short, or null. A gap is not an error: "reviews exist,
   * none at this star band" is the honest answer for most products in a thin
   * category, and §2.3 wants it recorded rather than papered over.
   */
  gap: string | null;
  /** Excerpts dropped because their star did not match the band requested. */
  discarded: number;
  /** Total written reviews the actor reports for this filter, where it says. */
  totalReviews: number | null;
  /** Total ratings, written or not. Ratings >> reviews in most categories. */
  totalRatings: number | null;
}

export interface AmazonProduct {
  asin: string;
  title: string;
  stars: number | null;
  /** The reason this step exists: which product is worth mining, before paying
   *  for a single review. */
  reviewsCount: number | null;
  url: string;
}

/**
 * One actor run. Stubbed in tests, so nothing here touches the network.
 *
 * `status` is the run's terminal status. A **SUCCEEDED run with an empty
 * dataset is the Apify-shaped "a wall fetches successfully"** — well-formed
 * JSON saying nothing — and callers must not read it as "no reviews".
 */
export interface ActorRunner {
  run(
    actorId: string,
    input: Record<string, unknown>,
    maxTotalChargeUsd: number,
    signal?: AbortSignal,
  ): Promise<{ status: string; items: Array<Record<string, unknown>> }>;
}

/** The real runner, over the `apify-client` npm package. */
export class ApifyActorRunner implements ActorRunner {
  constructor(
    private readonly token: string,
    private readonly timeoutSeconds: number,
  ) {}

  async run(
    actorId: string,
    input: Record<string, unknown>,
    maxTotalChargeUsd: number,
    signal?: AbortSignal,
  ): Promise<{ status: string; items: Array<Record<string, unknown>> }> {
    if (!this.token) {
      throw new Error("APIFY_TOKEN is not set — review mining cannot reach Amazon or Trustpilot");
    }
    // Imported lazily so a deployment without review mining need not resolve it.
    const { ApifyClient } = await import("apify-client");
    const client = new ApifyClient({ token: this.token });

    let run: { id: string; status: string; defaultDatasetId: string };
    try {
      run = (await client.actor(actorId).call(input, {
        maxTotalChargeUsd,
        waitSecs: this.timeoutSeconds,
      })) as typeof run;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      // 402 is out of credit. It arrives mid-run and reads exactly like a
      // source going quiet, so it is named rather than passed through.
      if (status === 402) {
        throw new Error(
          `Apify returned 402 for ${actorId}: the account is out of credit. ` +
            "This is a billing limit, not an absence of reviews.",
        );
      }
      throw error;
    }
    signal?.throwIfAborted();
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return { status: run.status, items: items as Array<Record<string, unknown>> };
  }
}

const str = (value: unknown): string => (typeof value === "string" ? value : "");
const numOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Amazon reviews for one product, at one star band.
 *
 * One band per call is deliberate. The actor caps results per star rating, and
 * asking for a single band is the only way to *verify* the spread that comes
 * back matches the spread requested — which is the check Amazon's own
 * `filterByStar` parameter silently fails (§3.4: `one_star` returns the
 * unfiltered sample).
 */
export async function amazonReviews(
  runner: ActorRunner,
  options: {
    productUrl: string;
    star: 1 | 2 | 3 | 4 | 5 | null;
    maxReviews: number;
    signal?: AbortSignal;
  },
): Promise<ReviewResult> {
  const { productUrl, star, maxReviews, signal } = options;
  const { status, items } = await runner.run(
    AMAZON_REVIEWS_ACTOR,
    {
      productUrls: [{ url: productUrl }],
      filterByRatings: [star === null ? "allStars" : STAR_BAND[star]],
      maxReviews,
      sort: "recent",
      // Reviewer names and profile ids are personal data and §2.3 needs none of
      // it — the text, the star and the date carry the whole excerpt.
      includeGdprSensitive: false,
      scrapeProductDetails: false,
    },
    capFor(AMAZON_REVIEWS_ACTOR, maxReviews),
    signal,
  );

  const band = star === null ? "any star" : `${star}-star`;
  if (items.length === 0) {
    return {
      excerpts: [],
      gap: `Apify run finished ${status} with an empty dataset for ${productUrl} ` +
        `(${band}). That is not evidence the product has no reviews.`,
      discarded: 0,
      totalReviews: null,
      totalRatings: null,
    };
  }

  // The actor reports a thin product by emitting ONE record carrying an error
  // instead of reviews — and bills it as a result ($0.006). Measured: a product
  // with 61 ratings and 28 written reviews returns this for `threeStar`.
  const first = items[0] ?? {};
  const totalRatings = numOrNull(first.totalCategoryRatings);
  const totalReviews = numOrNull(first.totalCategoryReviews);
  if (str(first.error)) {
    const why =
      str(first.error) === "no_relevant_reviews_found"
        ? `No ${band} reviews with text on ${productUrl}` +
          (totalRatings !== null ? ` (${totalRatings} ratings exist, none written at this band)` : "")
        : `Apify reported ${str(first.error)} for ${productUrl}: ${str(first.errorDescription)}`;
    return { excerpts: [], gap: why, discarded: 0, totalReviews, totalRatings };
  }

  const excerpts: ReviewExcerpt[] = [];
  let discarded = 0;
  for (const item of items) {
    const text = str(item.reviewDescription).trim();
    const starScore = numOrNull(item.ratingScore);
    if (!text) continue;
    // §3.4's trap in a new costume: if the band asked for is not the band that
    // came back, the filter misbehaved and the row is fabricated star data.
    if (star !== null && starScore !== star) {
      discarded += 1;
      continue;
    }
    excerpts.push({
      text,
      star: starScore,
      date: str(item.date) || null,
      locator: str(item.reviewUrl) || str(item.reviewId),
      title: str(item.reviewTitle),
      verified: item.isVerified === true,
      source: "amazon",
    });
  }

  let gap: string | null = null;
  if (discarded > 0) {
    gap =
      `Discarded ${discarded} of ${items.length} Amazon rows for ${productUrl}: ` +
      `asked for ${band} and the actor returned other ratings. Star data from this ` +
      "call is not trustworthy.";
  } else if (excerpts.length === 0) {
    gap = `Apify returned ${items.length} rows for ${productUrl} (${band}) but none carried review text.`;
  }
  return { excerpts, gap, discarded, totalReviews, totalRatings };
}

/**
 * Trustpilot reviews for one company.
 *
 * **These are reviews of a merchant, not of a product** — measured 2026-09-17,
 * two of three 3-star reviews for `huel.com` were about order handling and one
 * said so outright. Good `why_quit` material; it cannot answer `why_bought`
 * about a SKU, and it is `review_platform`, not `marketplace_review`.
 *
 * `domainOrUrl` accepts a bare domain, a slug, or a full `/review/` url — the
 * actor resolves all three.
 */
export async function trustpilotReviews(
  runner: ActorRunner,
  options: {
    domainOrUrl: string;
    star: 1 | 2 | 3 | 4 | 5 | null;
    maxItems: number;
    signal?: AbortSignal;
  },
): Promise<ReviewResult> {
  const { domainOrUrl, star, maxItems, signal } = options;
  const { status, items } = await runner.run(
    TRUSTPILOT_ACTOR,
    {
      startUrls: [{ url: domainOrUrl }],
      filterStars: star === null ? [] : [String(star)],
      maxItems,
      sortBy: "recent",
      filterLanguages: ["en"],
      // painPointAnalysis / reviewInsights stay OFF. They are LLM paraphrase
      // billed at up to 67x the per-item rate, and §2.3 forbids paraphrase in a
      // review excerpt regardless of price.
      includeCompanyDetails: false,
    },
    capFor(TRUSTPILOT_ACTOR, maxItems),
    signal,
  );

  const band = star === null ? "any star" : `${star}-star`;
  if (items.length === 0) {
    return {
      excerpts: [],
      gap: `Apify run finished ${status} with an empty dataset for ${domainOrUrl} (${band}).`,
      discarded: 0,
      totalReviews: null,
      totalRatings: null,
    };
  }

  const excerpts: ReviewExcerpt[] = [];
  let discarded = 0;
  for (const item of items) {
    const text = str(item.text).trim();
    const starScore = numOrNull(item.rating);
    if (!text) continue;
    if (star !== null && starScore !== star) {
      discarded += 1;
      continue;
    }
    excerpts.push({
      text,
      star: starScore,
      // experiencedDate is when the customer had the experience; publishedDate
      // is when Trustpilot posted it. §2.3 wants the former.
      date: str(item.experiencedDate) || str(item.publishedDate) || null,
      locator: str(item.url) || str(item.id),
      title: str(item.title),
      verified: item.isVerified === true,
      source: "trustpilot",
    });
  }

  let gap: string | null = null;
  if (discarded > 0) {
    gap =
      `Discarded ${discarded} of ${items.length} Trustpilot rows for ${domainOrUrl}: ` +
      `asked for ${band} and other ratings came back.`;
  } else if (excerpts.length === 0) {
    gap = `Apify returned ${items.length} rows for ${domainOrUrl} (${band}) but none carried text.`;
  }
  return { excerpts, gap, discarded, totalReviews: null, totalRatings: null };
}

/**
 * Resolve a product name to Amazon products.
 *
 * A brief names a product and, often, a brand domain — never an ASIN — and the
 * reviews actor takes URLs only. This is the missing link between the two.
 *
 * `reviewsCount` is why the step pays for itself: four intertrigo ASINs picked
 * by hand from a web search had 5, 2, 14 and 10 reviews, while this returned
 * products with 52 and 61 on Amazon's own first page. Choosing the product
 * badly costs more than the resolution does.
 */
export async function findAmazonProducts(
  runner: ActorRunner,
  options: { query: string; maxResults: number; marketplace?: string; signal?: AbortSignal },
): Promise<AmazonProduct[]> {
  const host = options.marketplace ?? "www.amazon.com";
  const searchUrl = `https://${host}/s?k=${encodeURIComponent(options.query)}`;
  const { status, items } = await runner.run(
    AMAZON_SEARCH_ACTOR,
    {
      categoryUrls: [{ url: searchUrl }],
      maxItemsPerStartUrl: options.maxResults,
      maxSearchPagesPerStartUrl: 1,
      scrapeProductDetails: false,
    },
    capFor(AMAZON_SEARCH_ACTOR, options.maxResults),
    options.signal,
  );

  // An actor that dies before producing anything returns an empty dataset, and
  // "no products matched your search" is a *conclusion about Amazon* drawn from
  // a failure of ours. Measured: an undersized spend cap kills the run with
  // "Charge limit has already been reached" and looks exactly like this.
  if (items.length === 0) {
    throw new Error(
      `Apify run for ${AMAZON_SEARCH_ACTOR} finished ${status} with an empty dataset ` +
        `(query ${JSON.stringify(options.query)}). That is a failed lookup, not proof ` +
        "that Amazon has no such product — check the run in the Apify console.",
    );
  }

  const products: AmazonProduct[] = [];
  for (const item of items) {
    const asin = str(item.asin);
    if (!asin) continue;
    products.push({
      asin,
      title: str(item.title),
      stars: numOrNull(item.stars),
      reviewsCount: numOrNull(item.reviewsCount),
      // The actor returns `url` empty; construct it from the asin.
      url: str(item.url) || `https://${host}/dp/${asin}`,
    });
  }
  // Most-reviewed first: the agent should be spending on the product with the
  // most customer language, not the one Amazon happened to rank first.
  products.sort((a, b) => (b.reviewsCount ?? 0) - (a.reviewsCount ?? 0));
  return products;
}

/** The runner this service uses, or null when no token is configured. */
export function createActorRunner(settings: Settings): ActorRunner | null {
  if (!settings.apifyToken) return null;
  return new ApifyActorRunner(settings.apifyToken, settings.apifyWaitSeconds);
}
