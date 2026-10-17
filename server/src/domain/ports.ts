import type { Account, Scope, User, UserListing } from "./accounts.js";
import type { AdPage, AdQuery } from "./ad-library.js";
import type { AnalysisInput } from "./analysis-input.js";
import type { Charge } from "./charges.js";
import type { Competitor, CompetitorPick, CompetitorProfile, Relationship } from "./competitors.js";
import type { Generation, LlmCall, LlmCallRecord, RunEvent } from "./logs.js";
import type { Product, ProductBrief } from "./products.js";
import type { Run, RunUpdate } from "./runs.js";
import type { StageStates } from "./stages.js";
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
  upsert(accountId: string, url: string, name: string): Promise<Product>;
  get(productId: string): Promise<Product | null>;
  saveBrief(productId: string, brief: ProductBrief): Promise<Product>;
}

export interface CompetitorStore {
  confirm(product: Product, picks: readonly CompetitorPick[]): Promise<Competitor[]>;
  list(productId: string): Promise<Competitor[]>;
  saveProfile(competitorId: string, profile: CompetitorProfile, relationship: Relationship): Promise<void>;
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
  readonly events: EventLog;
  readonly charges: ChargeLedger;
  readonly calls: CallLog;
  close(): Promise<void>;
}
