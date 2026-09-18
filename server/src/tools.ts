/**
 * The agent's two tools: find pages, and read one.
 *
 * **Superseded:** hermes supplied `web_search` / `web_extract` / a terminal / a
 * browser, and the run depended on which of those the harness happened to have
 * configured — the first live run fell back to driving a browser because `ddgs`
 * was missing on the VPS, and the cockpit showed a run that looked idle while it
 * worked. In-process there is no harness to configure: these two functions are
 * the entire surface the agent has, and they are the same two on every machine.
 *
 * The narrowing is also the security story. Stage 1 reasons over pages fetched
 * from the open web, which is the textbook setup for prompt injection. Neither
 * tool can run a command, read a file, or write anywhere except the corpus
 * directory this run owns, so the worst a poisoned page can do is lie to the
 * packet — and the packet is validated.
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";

import {
  amazonReviews,
  createActorRunner,
  findAmazonProducts,
  trustpilotReviews,
  type ActorRunner,
  type ReviewResult,
} from "./apify.js";
import { fetchWithTimeout } from "./http.js";
import type { Settings } from "./settings.js";

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

export interface FetchRecord {
  source_id: string;
  url: string;
  title: string;
  archived: boolean;
  chars: number;
  truncated: boolean;
}

/** What the runner needs to know about a tool call, for the cockpit's lanes. */
export type ToolLane = "search" | "fetch" | "other";

export const TOOL_LANES: Record<string, ToolLane> = {
  web_search: "search",
  web_fetch: "fetch",
  amazon_find_product: "search",
  amazon_reviews: "fetch",
  trustpilot_reviews: "fetch",
};

/**
 * SearXNG search.
 *
 * `format=json` is refused by a stock SearXNG — the instance in this stack adds
 * it in `searxng/settings.yml`, and without that every search fails with a 403
 * that reads like a bug in this code.
 */
export async function searxngSearch(
  settings: Settings,
  query: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<SearchHit[]> {
  const url = new URL("/search", settings.searxngUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");

  const response = await fetchWithTimeout(
    url.toString(),
    { headers: { Accept: "application/json" } },
    settings.webTimeoutSeconds,
    signal,
  );
  if (!response.ok) {
    throw new Error(
      `SearXNG returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }
  const body = (await response.json()) as { results?: Array<Record<string, unknown>> };
  return (body.results ?? []).slice(0, maxResults).map((r) => ({
    title: String(r.title ?? ""),
    url: String(r.url ?? ""),
    snippet: String(r.content ?? ""),
  }));
}

/** Firecrawl scrape, returning readable markdown plus whatever title it found. */
export async function firecrawlScrape(
  settings: Settings,
  url: string,
  signal?: AbortSignal,
): Promise<{ text: string; title: string }> {
  if (!settings.firecrawlApiKey) {
    throw new Error("FIRECRAWL_API_KEY is not set — web_fetch cannot read pages");
  }
  const response = await fetchWithTimeout(
    `${settings.firecrawlBaseUrl.replace(/\/$/, "")}/v2/scrape`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    },
    settings.webTimeoutSeconds,
    signal,
  );
  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    data?: { markdown?: string; metadata?: { title?: string } };
  };
  if (!response.ok || payload.success === false) {
    throw new Error(
      `Firecrawl returned ${response.status}: ${payload.error ?? "no body"}`.slice(0, 300),
    );
  }
  const text = payload.data?.markdown ?? "";
  if (!text.trim()) throw new Error("Firecrawl returned an empty body for this url");
  return { text, title: payload.data?.metadata?.title ?? "" };
}

/**
 * Write the fetched body to this run's corpus and return its id.
 *
 * The id is the sha256 of the **exact bytes written**, not of some normalised
 * form of them: `GET /api/research/runs/:id/sources/:sha` re-hashes the file and
 * reports whether it still matches. Hashing anything other than what lands on
 * disk turns that audit into a permanent false negative.
 *
 * A failed write is not a failed fetch. The agent still gets the text, the
 * source is recorded `archived: false`, and the prompt tells it to gap that.
 */
export async function archive(
  corpusPath: string,
  runId: string,
  text: string,
): Promise<{ sourceId: string; archived: boolean }> {
  const body = Buffer.from(text, "utf-8");
  const digest = createHash("sha256").update(body).digest("hex");
  const sourceId = `sha256:${digest}`;
  try {
    const dir = join(corpusPath, "runs", runId, "sources");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, digest), body);
    return { sourceId, archived: true };
  } catch {
    return { sourceId, archived: false };
  }
}

const searchParameters = Type.Object({
  query: Type.String({ description: "The search query." }),
  max_results: Type.Optional(
    Type.Number({ description: "How many results to return (default 10, max 25)." }),
  ),
});

const fetchParameters = Type.Object({
  url: Type.String({ description: "The absolute url to fetch." }),
});

const findProductParameters = Type.Object({
  query: Type.String({ description: "Product name or phrase to search Amazon for." }),
  max_results: Type.Optional(
    Type.Number({ description: "How many products to return (default 5, max 20)." }),
  ),
});

const starParameter = Type.Optional(
  Type.Number({
    description:
      "Star band to fetch, 1-5. Omit for a mixed sample. Ask for 3 explicitly — " +
      "3-star coverage is mandatory and is never reliably present in a mixed sample.",
  }),
);

const amazonReviewParameters = Type.Object({
  product_url: Type.String({ description: "An Amazon product url, e.g. https://www.amazon.com/dp/B0H2JVQ9GR" }),
  star: starParameter,
  max_reviews: Type.Optional(Type.Number({
      description:
        "Reviews to request. The server's default is also its maximum; a larger " +
        "request is cut to it.",
    })),
});

const trustpilotReviewParameters = Type.Object({
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

/**
 * Reviews to request: what the agent asked for, never more than
 * `MRA_APIFY_MAX_REVIEWS`.
 *
 * The setting has to be the ceiling, not just the default. `capFor` sizes the
 * Apify spend cap from this number, so an agent that asks for 500 would
 * otherwise authorise $6 on one Amazon call — and on a paid plan, spend it.
 */
export function reviewLimit(requested: number | undefined, max: number): number {
  if (requested === undefined || !Number.isFinite(requested)) return max;
  return Math.min(Math.max(Math.trunc(requested), 1), max);
}

/** Told to the model when its request was cut, so a capped pull is not read as a thin product. */
function cappedNote(requested: number | undefined, limit: number): string {
  if (requested === undefined || Math.trunc(requested) <= limit) return "";
  return (
    `NOTE: asked for ${Math.trunc(requested)} reviews; this server caps each call at ${limit}. ` +
    "Fewer excerpts here does not mean the product has fewer reviews."
  );
}

/** 1-5, or null for a mixed sample. Anything else is a caller error, not a band. */
function starBand(value: number | undefined): 1 | 2 | 3 | 4 | 5 | null {
  if (value === undefined) return null;
  const n = Math.trunc(value);
  if (n < 1 || n > 5) throw new Error(`star must be between 1 and 5, got ${value}`);
  return n as 1 | 2 | 3 | 4 | 5;
}

/**
 * Render a review pull for the model, and archive the excerpts verbatim.
 *
 * Archiving matters as much here as in `web_fetch`: §2.3 requires every excerpt
 * to cite a source that can be re-read, and the packet's `source_id` is
 * re-hashed by `GET /runs/:id/sources/:sha`. What is archived is the exact JSON
 * the model is shown, so the audit compares like with like.
 */
async function renderReviews(
  settings: Settings,
  runId: string,
  label: string,
  result: ReviewResult,
  onFetch?: (record: FetchRecord) => void,
  note = "",
): Promise<{ content: Array<{ type: "text"; text: string }>; details: unknown }> {
  const body = JSON.stringify(result.excerpts, null, 2);
  const { sourceId, archived } = await archive(settings.corpusPath, runId, body);

  onFetch?.({
    source_id: sourceId,
    url: label,
    title: `${result.excerpts.length} reviews — ${label}`,
    archived,
    chars: body.length,
    truncated: false,
  });

  const header = [
    `source_id: ${sourceId}`,
    `source: ${label}`,
    `archived: ${archived}`,
    `excerpts: ${result.excerpts.length}`,
    result.totalReviews !== null ? `written_reviews_total: ${result.totalReviews}` : "",
    result.totalRatings !== null ? `ratings_total: ${result.totalRatings}` : "",
    result.gap
      ? `GAP: ${result.gap}\nRecord this as a gap entry. Do NOT substitute a ` +
        "different star band and do not describe the node as complete."
      : "",
    archived
      ? ""
      : "NOTE: the corpus volume could not be written. Record these sources with " +
        "archived: false and add a gap entry saying so.",
    note,
  ]
    .filter(Boolean)
    .join("\n");

  const rendered = result.excerpts.length
    ? result.excerpts
        .map(
          (e, i) =>
            `${i + 1}. [${e.star ?? "?"}*] ${e.date ?? "no date"}` +
            `${e.verified ? " (verified purchase)" : ""}\n` +
            `   title: ${e.title}\n   ${e.text}\n   locator: ${e.locator}`,
        )
        .join("\n\n")
    : "(no excerpts)";

  return {
    content: [{ type: "text", text: `${header}\n\n---\n\n${rendered}` }],
    details: { source_id: sourceId, archived, ...result },
  };
}

/**
 * The tools for one run. Bound to a run id because the corpus is per-run — a
 * tool that could be pointed at another run's directory is a tool that can
 * forge another run's audit trail.
 */
export function createResearchTools(options: {
  settings: Settings;
  runId: string;
  onFetch?: (record: FetchRecord) => void;
  /** Injected in tests. In production it is built from the settings. */
  actorRunner?: ActorRunner | null;
  /**
   * False for a run that does not cover review mining. The Apify tools are the
   * only ones that cost money per call, and a product-data run has no use for
   * them — offering them anyway invites the agent to spend on the wrong node.
   */
  reviewTools?: boolean;
  /**
   * True offers `amazon_find_product` alone, even when `reviewTools` is false:
   * Amazon's search is a competitor-discovery source ($0.012 a result), while
   * the review tools are not.
   */
  productSearch?: boolean;
}): AgentTool<any>[] {
  const { settings, runId, onFetch } = options;
  const reviews = options.reviewTools !== false;
  const runner =
    reviews || options.productSearch
      ? (options.actorRunner ?? createActorRunner(settings))
      : null;

  const webSearch: AgentTool<typeof searchParameters> = {
    name: "web_search",
    label: "Web search",
    description:
      "Search the web and return titles, urls and snippets. Snippets are for " +
      "choosing what to fetch — they are not sources. Never quote a snippet and " +
      "never record a source you have not fetched with web_fetch.",
    parameters: searchParameters,
    async execute(_id, params, signal) {
      const max = Math.min(Math.max(Math.trunc(params.max_results ?? 10), 1), 25);
      const hits = await searxngSearch(settings, params.query, max, signal);
      if (hits.length === 0) {
        return {
          content: [{ type: "text", text: `No results for ${JSON.stringify(params.query)}.` }],
          details: { query: params.query, hits: [] },
        };
      }
      const rendered = hits
        .map((h, i) => `${i + 1}. ${h.title}\n   ${h.url}\n   ${h.snippet}`)
        .join("\n\n");
      return {
        content: [{ type: "text", text: rendered }],
        details: { query: params.query, hits },
      };
    },
  };

  const webFetch: AgentTool<typeof fetchParameters> = {
    name: "web_fetch",
    label: "Fetch page",
    description:
      "Fetch one url and return its readable text. The body is archived and " +
      "hashed before you see it; the result carries the source_id to cite. Use " +
      "that id verbatim as the source's `id` and set `archived` to what the " +
      "result reports.",
    parameters: fetchParameters,
    async execute(_id, params, signal) {
      const { text, title } = await firecrawlScrape(settings, params.url, signal);
      const { sourceId, archived } = await archive(settings.corpusPath, runId, text);
      const truncated = text.length > settings.fetchCharLimit;
      const shown = truncated ? text.slice(0, settings.fetchCharLimit) : text;

      const record: FetchRecord = {
        source_id: sourceId,
        url: params.url,
        title,
        archived,
        chars: text.length,
        truncated,
      };
      onFetch?.(record);

      const header = [
        `source_id: ${sourceId}`,
        `url: ${params.url}`,
        title ? `title: ${title}` : "",
        `archived: ${archived}`,
        archived
          ? ""
          : "NOTE: the corpus volume could not be written. Record this source " +
            "with archived: false and add a gap entry saying so.",
        truncated
          ? `NOTE: showing the first ${settings.fetchCharLimit} of ${text.length} characters. ` +
            "The archived copy is complete; character offsets in a locator still refer to it."
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      return {
        content: [{ type: "text", text: `${header}\n\n---\n\n${shown}` }],
        details: record,
      };
    },
  };

  // Without a token there is no review route at all. The tools are withheld
  // rather than stubbed: an agent told it has a tool that always throws burns
  // turns rediscovering that, and the prompt already knows how to gap a node.
  if (!runner) return [webSearch, webFetch];

  const findProduct: AgentTool<typeof findProductParameters> = {
    name: "amazon_find_product",
    label: "Find product on Amazon",
    description:
      "Search Amazon by product name and get back asin, title, stars and " +
      "reviewsCount, most-reviewed first. Use this before amazon_reviews — it " +
      "takes a url, not a name. Pick the product by reviewsCount: a listing " +
      "with four reviews cannot support a review-mining node.",
    parameters: findProductParameters,
    async execute(_id, params, signal) {
      const max = Math.min(Math.max(Math.trunc(params.max_results ?? 5), 1), 20);
      const products = await findAmazonProducts(runner, {
        query: params.query,
        maxResults: max,
        signal,
      });
      if (products.length === 0) {
        return {
          content: [{ type: "text", text: `No Amazon products found for ${JSON.stringify(params.query)}.` }],
          details: { query: params.query, products: [] },
        };
      }
      const rendered = products
        .map(
          (p) =>
            `${p.asin}  ${p.stars ?? "?"}*  reviews=${p.reviewsCount ?? "?"}\n` +
            `   ${p.title}\n   ${p.url}`,
        )
        .join("\n\n");
      return {
        content: [{ type: "text", text: rendered }],
        details: { query: params.query, products },
      };
    },
  };

  const amazon: AgentTool<typeof amazonReviewParameters> = {
    name: "amazon_reviews",
    label: "Amazon reviews",
    description:
      "Fetch verbatim Amazon reviews for ONE product url, optionally at one " +
      "star band. Returns text, star, date and a locator, archived and hashed " +
      "like web_fetch. Call it once per star band to cover 1-5; 3 is " +
      "mandatory. If it reports a GAP, record the gap — never substitute " +
      "another band.",
    parameters: amazonReviewParameters,
    async execute(_id, params, signal) {
      const limit = reviewLimit(params.max_reviews, settings.apifyMaxReviews);
      const result = await amazonReviews(runner, {
        productUrl: params.product_url,
        star: starBand(params.star),
        maxReviews: limit,
        signal,
      });
      return renderReviews(
        settings,
        runId,
        params.product_url,
        result,
        onFetch,
        cappedNote(params.max_reviews, limit),
      );
    },
  };

  const trustpilot: AgentTool<typeof trustpilotReviewParameters> = {
    name: "trustpilot_reviews",
    label: "Trustpilot reviews",
    description:
      "Fetch verbatim Trustpilot reviews for ONE company domain, optionally at " +
      "one star band. These review the MERCHANT — delivery, support, ordering " +
      "— not the product, so they are review_platform sources and answer " +
      "why_quit far better than why_bought. Do not use them to fill the " +
      "marketplace-review floor.",
    parameters: trustpilotReviewParameters,
    async execute(_id, params, signal) {
      const limit = reviewLimit(params.max_reviews, settings.apifyMaxReviews);
      const result = await trustpilotReviews(runner, {
        domainOrUrl: params.domain,
        star: starBand(params.star),
        maxItems: limit,
        signal,
      });
      return renderReviews(
        settings,
        runId,
        params.domain,
        result,
        onFetch,
        cappedNote(params.max_reviews, limit),
      );
    },
  };

  return reviews
    ? [webSearch, webFetch, findProduct, amazon, trustpilot]
    : [webSearch, webFetch, findProduct];
}
