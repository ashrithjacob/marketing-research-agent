import type { ShopSignals, ShopTraction } from "./traction.js";
import type { Account, Scope, User, UserListing } from "./accounts.js";
import type { AdAngle, AdAngles, AdFinding, AngleFits } from "./ad-analysis.js";
import type { AdHit } from "./ad-library.js";
import type { AdReading, AdRing, ReadAd, StoredAd } from "./ads.js";
import type { AvatarMemory, AvatarQuote, AvatarRecord, StoredAvatar } from "./avatars.js";
import type { AnalysisInput } from "./analysis-input.js";
import type { Charge } from "./charges.js";
import type { Competitor, CompetitorPick, CompetitorProfile, Relationship } from "./competitors.js";
import type { Generation, LlmCall, LlmCallRecord, RunEvent } from "./logs.js";
import type { BrandVisual, Product, ProductBrief } from "./products.js";
import type { MarketAssessment } from "./market.js";
import type { Run, RunSummary, RunUpdate } from "./runs.js";
import type { StageStates } from "./stages.js";
import type { CollectedReview, ReviewCoverage, ReviewTarget, StoredReview } from "./reviews.js";

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
  summaries(scope: Scope, limit?: number): Promise<RunSummary[]>;
  updateRun(runId: string, fields: RunUpdate): Promise<void>;
  unfinished(): Promise<Run[]>;
  delete(runId: string): Promise<void>;
}

/** One row per product per account, refreshed in place by every run that researches it. */
export interface ProductStore {
  upsert(accountId: string, url: string, name: string, brand: string): Promise<Product>;
  get(productId: string): Promise<Product | null>;
  saveBrief(productId: string, brief: ProductBrief): Promise<Product>;
  saveVisual(productId: string, visual: BrandVisual): Promise<void>;
  saveTraction(productId: string, traction: ShopTraction): Promise<void>;
}

export interface CompetitorStore {
  confirm(product: Product, picks: readonly CompetitorPick[]): Promise<Competitor[]>;
  add(product: Product, picks: readonly CompetitorPick[]): Promise<Competitor[]>;
  list(productId: string): Promise<Competitor[]>;
  saveProfile(competitorId: string, profile: CompetitorProfile, relationship: Relationship): Promise<void>;
  saveVisual(competitorId: string, visual: BrandVisual): Promise<void>;
  saveTraction(competitorId: string, traction: ShopTraction): Promise<void>;
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

/** Long-form statics found for a product's analysis, and what an agent read off each. */
export interface AdStore {
  clear(runId: string): Promise<void>;
  save(accountId: string, runId: string, productId: string, hits: readonly AdHit[], competitorByDomain: ReadonlyMap<string, string>): Promise<StoredAd[]>;
  saveReading(adId: string, reading: AdReading): Promise<void>;
  saveRing(adId: string, ring: AdRing, why: string): Promise<void>;
  link(runId: string, competitorByDomain: ReadonlyMap<string, string>): Promise<number>;
  list(runId: string): Promise<ReadAd[]>;
}

/** The analysis of one run's ads: the angles they were grouped into, each angle's fit, and the findings written over the counts. */
export interface AdAnalysisStore {
  saveAngles(runId: string, angles: AdAngles["angles"]): Promise<void>;
  saveFits(runId: string, fits: AngleFits["fits"]): Promise<void>;
  saveFindings(runId: string, findings: readonly AdFinding[]): Promise<void>;
  angles(runId: string): Promise<AdAngle[]>;
  findings(runId: string): Promise<AdFinding[]>;
}

/** Product shots and logos by page url, shared by every account: they are public pages, read once. */
export interface BrandVisualCache {
  get(urls: readonly string[]): Promise<Map<string, BrandVisual>>;
  put(url: string, visual: BrandVisual): Promise<void>;
}

/** TrendTrack's free lookup per shop domain, shared by every account. */
export interface ShopSignalCache {
  get(domains: readonly string[]): Promise<Map<string, ShopSignals>>;
  put(signals: ShopSignals): Promise<void>;
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

/** Stage 4's assessment of the market, one per run; a rerun replaces it. */
export interface MarketStore {
  save(accountId: string, assessment: MarketAssessment): Promise<void>;
  get(runId: string): Promise<MarketAssessment | null>;
}

export interface ResearchStore {
  readonly accounts: AccountDirectory;
  readonly runs: RunStore;
  readonly products: ProductStore;
  readonly competitors: CompetitorStore;
  readonly reviews: ReviewStore;
  readonly ads: AdStore;
  readonly adAnalysis: AdAnalysisStore;
  readonly avatars: AvatarStore;
  readonly market: MarketStore;
  readonly visuals: BrandVisualCache;
  readonly signals: ShopSignalCache;
  readonly events: EventLog;
  readonly charges: ChargeLedger;
  readonly calls: CallLog;
  close(): Promise<void>;
}
