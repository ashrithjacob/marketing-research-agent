import type { SourceKind } from "./vocabulary.js";
import type {
  Generation,
  Judgement,
  LlmCall,
  LlmCallRecord,
  PacketCheck,
  RunEvent,
  RunUpdate,
} from "./logs.js";
import type { Account, AccountListing, Scope, Workspace } from "./accounts.js";
import type { ResearchRun } from "./records.js";
import type { Product, RunHead } from "./products.js";
import type { StoredPacketRows } from "./packet-rows.js";
import type { ReviewAnalysis } from "./review-analysis.js";
import type { AmazonListing, TargetListing } from "./review-mining.js";
import type { ReviewLedgerSnapshot, ReviewPlatform, ReviewResult, StoredPull, StoredRunReview } from "./reviews.js";
import type { Charge } from "./charges.js";
import type { Finding, FindingDraft } from "./findings.js";
import type { FetchedPage, SearchPage, SearchScope } from "./web.js";
import type { DiscoveryQuestion, DiscoveryReport } from "./competitor-discovery.js";
import type { AdPage, AdQuery } from "./ad-library.js";

/** Products and what their runs found, counted only over the runs a scope admits. */
export interface ProductCatalog {
  list(scope: Scope): Promise<Product[]>;
  get(productId: string, scope: Scope): Promise<Product | null>;
  byKey(key: string): Promise<Product | null>;
  runHeads(scope: Scope): Promise<RunHead[]>;
  packetRows(productId: string, scope: Scope): Promise<StoredPacketRows>;
}

/** Workspaces and the logins that belong to them. */
export interface AccountDirectory {
  addWorkspace(name: string): Promise<Workspace>;
  workspace(id: string): Promise<Workspace | null>;
  workspaceNamed(name: string): Promise<Workspace | null>;
  addAccount(input: { username: string; passwordHash: string; workspaceId: string; isAdmin: boolean }): Promise<Account>;
  get(accountId: string): Promise<Account | null>;
  byUsername(username: string): Promise<Account | null>;
  list(): Promise<AccountListing[]>;
  setPassword(username: string, passwordHash: string): Promise<boolean>;
  setDisabled(username: string, disabled: boolean): Promise<boolean>;
  revokeSessions(accountId: string): Promise<void>;
  seedAdmin(username: string, passwordHash: string): Promise<boolean>;
}

/** The best-selling Amazon listings for a search phrase in one Amazon store, most popular first, with traction details. */
export interface AmazonListingSource {
  lookup(query: string, marketplace: string, max: number, signal?: AbortSignal): Promise<AmazonListing[]>;
}

/** The Amazon listing looked up for each review-mining target, kept per stage-1 run so it is paid for once. */
export interface TargetListings {
  save(listing: TargetListing): Promise<void>;
  list(sourceRunId: string): Promise<TargetListing[]>;
}

/** Every charge a run made, appended as each call returns. */
export interface ChargeLedger {
  add(charge: Omit<Charge, "created_at">): Promise<Charge>;
  list(runId: string): Promise<Charge[]>;
}

/** What a run has found, one row per finding, written as it is found. Rows are retracted, never deleted. */
export interface FindingLedger {
  append(draft: FindingDraft): Promise<Finding>;
  retract(runId: string, id: string, why: string): Promise<Finding | null>;
  list(runId: string): Promise<Finding[]>;
}

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

/** Names brands selling to a product's customer, from one research pass over the web. */
export interface CompetitorDiscovery {
  discover(question: DiscoveryQuestion, signal?: AbortSignal): Promise<DiscoveryReport>;
}

export interface ResearchStore {
  readonly products: ProductCatalog;
  readonly listings: TargetListings;
  readonly findings: FindingLedger;
  readonly charges: ChargeLedger;
  readonly pulls: ReviewPullStore;
  readonly accounts: AccountDirectory;
  createRun(input: {
    workspaceId: string;
    brief: Record<string, unknown>;
    model: string;
    rejectKinds: string[];
    judgementIds: string[];
    nodes?: string[];
    stage?: number;
  }): Promise<ResearchRun>;
  getRun(runId: string): Promise<ResearchRun | null>;
  listRuns(scope: Scope, limit?: number): Promise<ResearchRun[]>;
  updateRun(runId: string, fields: RunUpdate): Promise<void>;
  addEvent(runId: string, kind: string, payload: Record<string, unknown>): Promise<RunEvent>;
  listEvents(runId: string, afterId?: number): Promise<RunEvent[]>;
  lastEventId(runId: string): Promise<number>;
  listJudgements(scope: Scope, activeOnly?: boolean): Promise<Judgement[]>;
  addJudgement(workspaceId: string, input: { kind: string; text: string; rejects_kinds: SourceKind[] }): Promise<Judgement>;
  deleteJudgement(scope: Scope, judgementId: string): Promise<boolean>;
  bumpJudgement(judgementId: string, by?: number): Promise<void>;
  addPacketCheck(runId: string, valid: boolean, problems: readonly string[]): Promise<PacketCheck>;
  listPacketChecks(runId: string): Promise<PacketCheck[]>;
  addLlmCall(call: LlmCallRecord): Promise<LlmCall>;
  setLlmCallGeneration(runId: string, responseId: string, generation: Generation): Promise<void>;
  listLlmCalls(runId: string): Promise<LlmCall[]>;
  saveRunReviews(runId: string, ledger: ReviewLedgerSnapshot): Promise<number>;
  listRunReviews(runId: string): Promise<StoredRunReview[]>;
  saveReviewAnalysis(analysis: ReviewAnalysis): Promise<void>;
  getReviewAnalysis(runId: string): Promise<ReviewAnalysis | null>;

  close(): Promise<void>;
}

export interface GateVerdict {
  admit: boolean;
  reason: string;
  model: string;
  ms: number;
}

/** A cheap pre-read filter over fetched bodies; a failing gate admits. */
export interface FetchGate {
  admit(input: { url: string; title: string; body: string; subject: string; market: string }): Promise<GateVerdict>;
}

/** Earlier pulls of a listing's star band, from any run in any workspace: reviews are public pages, so one paid pull serves everyone until it is too old. */
export interface ReviewPullStore {
  latest(platform: ReviewPlatform, listing: string, band: number | null, since: string): Promise<StoredPull | null>;
  save(platform: ReviewPlatform, listing: string, band: number | null, result: ReviewResult): Promise<void>;
}
