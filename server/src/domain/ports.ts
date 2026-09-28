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
import type { AmazonListing, TargetListing } from "./stage-two.js";
import type { ReviewLedgerSnapshot, StoredRunReview } from "./reviews.js";

/** Products and what their runs found, counted only over the runs a scope admits. */
export interface ProductCatalog {
  list(scope: Scope): Product[];
  get(productId: string, scope: Scope): Product | null;
  byKey(key: string): Product | null;
  runHeads(scope: Scope): RunHead[];
  packetRows(productId: string, scope: Scope): StoredPacketRows;
}

/** Workspaces and the logins that belong to them. */
export interface AccountDirectory {
  addWorkspace(name: string): Workspace;
  workspace(id: string): Workspace | null;
  workspaceNamed(name: string): Workspace | null;
  addAccount(input: {
    username: string;
    passwordHash: string;
    workspaceId: string;
    isAdmin: boolean;
  }): Account;
  get(accountId: string): Account | null;
  byUsername(username: string): Account | null;
  list(): AccountListing[];
  setPassword(username: string, passwordHash: string): boolean;
  setDisabled(username: string, disabled: boolean): boolean;
  revokeSessions(accountId: string): void;
  seedAdmin(username: string, passwordHash: string): boolean;
}

/** The best-selling Amazon listings for a search phrase in one Amazon store, most popular first, with traction details. */
export interface AmazonListingSource {
  lookup(query: string, marketplace: string, max: number, signal?: AbortSignal): Promise<AmazonListing[]>;
}

/** The Amazon listing looked up for each stage-2 target, kept per stage-1 run so it is paid for once. */
export interface TargetListings {
  save(listing: TargetListing): void;
  list(sourceRunId: string): TargetListing[];
}

export interface ResearchStore {
  readonly products: ProductCatalog;
  readonly listings: TargetListings;
  readonly accounts: AccountDirectory;
  createRun(input: {
    workspaceId: string;
    brief: Record<string, unknown>;
    model: string;
    rejectKinds: string[];
    judgementIds: string[];
    nodes?: string[];
    stage?: number;
  }): ResearchRun;
  getRun(runId: string): ResearchRun | null;
  listRuns(scope: Scope, limit?: number): ResearchRun[];
  updateRun(runId: string, fields: RunUpdate): void;
  addEvent(runId: string, kind: string, payload: Record<string, unknown>): RunEvent;
  listEvents(runId: string, afterId?: number): RunEvent[];
  listJudgements(scope: Scope, activeOnly?: boolean): Judgement[];
  addJudgement(
    workspaceId: string,
    input: { kind: string; text: string; rejects_kinds: SourceKind[] },
  ): Judgement;
  deleteJudgement(scope: Scope, judgementId: string): boolean;
  bumpJudgement(judgementId: string, by?: number): void;
  addPacketCheck(runId: string, valid: boolean, problems: readonly string[]): PacketCheck;
  listPacketChecks(runId: string): PacketCheck[];
  addLlmCall(call: LlmCallRecord): LlmCall;
  setLlmCallGeneration(runId: string, responseId: string, generation: Generation): void;
  listLlmCalls(runId: string): LlmCall[];
  saveRunReviews(runId: string, ledger: ReviewLedgerSnapshot): number;
  listRunReviews(runId: string): StoredRunReview[];
  saveReviewAnalysis(analysis: ReviewAnalysis): void;
  getReviewAnalysis(runId: string): ReviewAnalysis | null;

  close(): void;
}

export interface GateVerdict {
  admit: boolean;
  reason: string;
  model: string;
  ms: number;
}

/** A cheap pre-read filter over fetched bodies; a failing gate admits. */
export interface FetchGate {
  admit(input: {
    url: string;
    title: string;
    body: string;
    subject: string;
    market: string;
  }): Promise<GateVerdict>;
}
