import type { ActorLimits, ActorRun, ArchivedPage, ForumPost, ForumQuery, KeywordVolume, MarketplaceListing, SuggestionSource } from "./market-sources.js";
import type { ShopPage, ShopQuery } from "./shop-finder.js";
import type { ShopSignals, ShopTraction } from "./traction.js";
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

/** TrendTrack's shop data: a free lookup by domain, and the paid sales record with a product's best-seller rank. */
export interface ShopIntel {
  lookup(domain: string, signal?: AbortSignal): Promise<ShopSignals | null>;
  traction(signals: ShopSignals, productHandle: string | null, signal?: AbortSignal): Promise<{ traction: ShopTraction; credits: number }>;
}

/** Finds shops on TrendTrack's trending feed by what they sell and how hard they advertise; every shop returned is billed. */
export interface ShopFinder {
  find(query: ShopQuery, signal?: AbortSignal): Promise<ShopPage>;
}

/** What people type into a search box, as the box itself completes a seed; free. */
export interface SearchSuggestions {
  suggest(seed: string, source: SuggestionSource, country: string, signal?: AbortSignal): Promise<string[]>;
}

/** A page's history in the Wayback Machine: its snapshots, about one a month, and the text of one. */
export interface PageArchive {
  snapshots(url: string, signal?: AbortSignal): Promise<ArchivedPage[]>;
  read(page: ArchivedPage, signal?: AbortSignal): Promise<string>;
}

/** Runs one Apify actor to the end within its limits and returns its dataset with what Apify charged. */
export interface ActorRunner {
  run(actor: string, input: Record<string, unknown>, limits: ActorLimits, signal?: AbortSignal): Promise<ActorRun>;
}

export interface KeywordVolumes {
  volumes(keywords: readonly string[], country: string, signal?: AbortSignal): Promise<KeywordVolume[]>;
}

export interface MarketplaceSearch {
  search(keywords: readonly string[], marketplace: string, perKeyword: number, signal?: AbortSignal): Promise<MarketplaceListing[]>;
}

export interface ForumSearch {
  search(query: ForumQuery, signal?: AbortSignal): Promise<ForumPost[]>;
}

/** What OpenRouter billed for one generation, looked up by its response id. */
export interface GenerationSource {
  readonly billable: boolean;
  generation(id: string): Promise<Generation | null>;
}
