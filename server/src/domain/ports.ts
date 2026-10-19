import type { Account, Scope, User, UserListing } from "./accounts.js";
import type { AdHit, AdPage, AdQuery } from "./ad-library.js";
import type { AdReading, ReadAd, StoredAd } from "./ads.js";
import type { AvatarMemory, AvatarQuote, StoredAvatar } from "./avatars.js";
import type { AnalysisInput } from "./analysis-input.js";
import type { Charge } from "./charges.js";
import type { Competitor, CompetitorPick, CompetitorProfile, Relationship } from "./competitors.js";
import type { Generation, LlmCall, LlmCallRecord, RunEvent } from "./logs.js";
import type { Product, ProductBrief } from "./products.js";
import type { Run, RunUpdate } from "./runs.js";
import type { StageStates } from "./stages.js";
import type { CollectedReview, ReviewCoverage, ReviewListing, ReviewSourceName, ReviewTarget, StorefrontFacts, StoredReview } from "./reviews.js";
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

/** What OpenRouter billed for one generation, looked up by its response id. */
export interface GenerationSource {
  readonly billable: boolean;
  generation(id: string): Promise<Generation | null>;
}

/** Client accounts and the logins that belong to them. */
export interface AccountDirectory {
  addAccount(name: string): Promise<Account>;
  account(id: string): Promise<Account | null>;
  accountNamed(name: string): Promise<Account | null>;
  addUser(input: { username: string; passwordHash: string; accountId: string; isAdmin: boolean }): Promise<User>;
  user(userId: string): Promise<User | null>;
  byUsername(username: string): Promise<User | null>;
  users(): Promise<UserListing[]>;
  setPassword(username: string, passwordHash: string): Promise<boolean>;
  setDisabled(username: string, disabled: boolean): Promise<boolean>;
  revokeSessions(userId: string): Promise<void>;
  seedAdmin(username: string, passwordHash: string): Promise<boolean>;
}

export interface RunStore {
  create(input: { accountId: string; input: AnalysisInput; model: string; stages: StageStates }): Promise<Run>;
  get(runId: string): Promise<Run | null>;
  list(scope: Scope, limit?: number): Promise<Run[]>;
  updateRun(runId: string, fields: RunUpdate): Promise<void>;
  unfinished(): Promise<Run[]>;
}

/** One row per product per account, refreshed in place by every run that researches it. */
export interface ProductStore {
  upsert(accountId: string, url: string, name: string, brand: string): Promise<Product>;
  get(productId: string): Promise<Product | null>;
  saveBrief(productId: string, brief: ProductBrief): Promise<Product>;
}

export interface CompetitorStore {
  confirm(product: Product, picks: readonly CompetitorPick[]): Promise<Competitor[]>;
  list(productId: string): Promise<Competitor[]>;
  saveProfile(competitorId: string, profile: CompetitorProfile, relationship: Relationship): Promise<void>;
}

/** Reviews per target, stored once each: a review already held for that target is dropped on insert. */
export interface ReviewStore {
  save(accountId: string, target: ReviewTarget, reviews: readonly CollectedReview[]): Promise<number>;
  recordSources(target: ReviewTarget, sources: { asins: readonly string[]; reviewApp: string | null }): Promise<void>;
  coverage(productId: string): Promise<ReviewCoverage[]>;
  list(productId: string, competitorId: string | null, limit: number, offset: number): Promise<StoredReview[]>;
  all(productId: string): Promise<StoredReview[]>;
}

/** The avatar memory as it grew, one snapshot per batch read, and the avatars a run settled on with the reviews, quotes and ads behind each. */
export interface AvatarStore {
  saveMemory(runId: string, memory: AvatarMemory): Promise<void>;
  saveAvatars(runId: string, avatars: readonly AvatarRecord[]): Promise<void>;
  list(runId: string): Promise<StoredAvatar[]>;
  quotes(runId: string): Promise<AvatarQuote[]>;
}

/** One avatar to store, with the evidence ids it rests on; parents are named by key. */
export interface AvatarRecord {
  avatar: Omit<StoredAvatar, "id" | "run_id" | "parent_id">;
  parent_key: string | null;
  review_ids: readonly string[];
  quote_ids: readonly string[];
  ad_ids: readonly string[];
}

/** Long-form statics found for a product's analysis, and what an agent read off each. */
export interface AdStore {
  save(accountId: string, productId: string, hits: readonly AdHit[], competitorByDomain: ReadonlyMap<string, string>): Promise<StoredAd[]>;
  saveReading(adId: string, reading: AdReading): Promise<void>;
  list(productId: string): Promise<ReadAd[]>;
}

export interface EventLog {
  add(runId: string, kind: string, payload: Record<string, unknown>): Promise<RunEvent>;
  list(runId: string, afterId?: number): Promise<RunEvent[]>;
}

/** Every charge a run made, appended as each call returns. */
export interface ChargeLedger {
  add(charge: Omit<Charge, "created_at">): Promise<Charge>;
  list(runId: string): Promise<Charge[]>;
}

/** Every LLM call, as sent and as answered; OpenRouter's billed cost is attached when it arrives. */
export interface CallLog {
  add(call: LlmCallRecord): Promise<LlmCall>;
  setGeneration(runId: string, responseId: string, generation: Generation): Promise<void>;
  list(runId: string): Promise<LlmCall[]>;
}

export interface ResearchStore {
  readonly accounts: AccountDirectory;
  readonly runs: RunStore;
  readonly products: ProductStore;
  readonly competitors: CompetitorStore;
  readonly reviews: ReviewStore;
  readonly ads: AdStore;
  readonly avatars: AvatarStore;
  readonly events: EventLog;
  readonly charges: ChargeLedger;
  readonly calls: CallLog;
  close(): Promise<void>;
}
