import type { AdPage, AdQuery } from "./ad-library.js";
import type { Generation } from "./logs.js";
import type { BrandVisual } from "./products.js";
import type { CollectedReview, ReviewListing, ReviewSourceName, StorefrontFacts } from "./reviews.js";
import type { FetchedPage, SearchPage, SearchScope } from "./web.js";

/** Reads one page as text. Throws rather than returning an empty body. */
export interface PageFetcher {
  scrape(url: string, signal?: AbortSignal): Promise<FetchedPage>;
}

/** Finds urls for a query; it cannot read pages. */
export interface WebSearch {
  find(query: string, maxResults: number, signal?: AbortSignal, scope?: SearchScope): Promise<SearchPage>;
}

/** Searches an index of Meta ads: who advertises, the copy, where each ad lands, when it ran. */
export interface AdLibrary {
  search(query: AdQuery, signal?: AbortSignal): Promise<AdPage>;
}

/** One place reviews come from. Collects up to `limit` reviews of one listing, the text as written. */
export interface ReviewSource {
  readonly name: ReviewSourceName;
  collect(listing: ReviewListing, limit: number, signal?: AbortSignal): Promise<CollectedReview[]>;
}

/** Reads a product page's store: its Shopify domain, product id and review apps; null when the page is not a Shopify product. */
export interface Storefront {
  inspect(url: string, signal?: AbortSignal): Promise<StorefrontFacts | null>;
}

/** Reads a product page for how the brand looks: its product shot and its logo. Never throws: a page it cannot read gives nulls. */
export interface BrandVisuals {
  find(url: string, signal?: AbortSignal): Promise<BrandVisual>;
}

/** What OpenRouter billed for one generation, looked up by its response id. */
export interface GenerationSource {
  readonly billable: boolean;
  generation(id: string): Promise<Generation | null>;
}
