import {
  Briefs,
  type AccountDirectory, type ChargeLedger, type ReviewPullStore, type FindingLedger, type Generation, type Judgement, type LlmCall,
  type LlmCallRecord, type PacketCheck, type ProductCatalog, type ResearchRun, type ResearchStore,
  type ReviewAnalysis, type ReviewLedgerSnapshot, type RunEvent, type RunUpdate, type Scope,
  type SourceKind, type StoredRunReview, type TargetListings,
} from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { SqliteTables } from "./tables.js";

export class SqliteResearchStore implements ResearchStore {
  private readonly tables: SqliteTables;
  readonly products: ProductCatalog;
  readonly accounts: AccountDirectory;
  readonly listings: TargetListings;
  readonly findings: FindingLedger;
  readonly charges: ChargeLedger;
  readonly pulls: ReviewPullStore;

  constructor(path: string) {
    Trace.line(import.meta.url, "SqliteResearchStore.constructor", { path });
    this.tables = SqliteTables.open(path);
    this.products = this.tables.catalog;
    this.accounts = this.tables.accounts;
    this.listings = this.tables.listings;
    this.findings = this.tables.findings;
    this.charges = this.tables.charges;
    this.pulls = this.tables.pulls;
  }

  async createRun(input: Parameters<ResearchStore["createRun"]>[0]): Promise<ResearchRun> {
    Trace.line(import.meta.url, "SqliteResearchStore.createRun", { input });
    const productId = this.tables.products.ensure(Briefs.key(input.brief), Briefs.label(input.brief));
    return this.tables.runs.create({ ...input, productId });
  }

  async getRun(runId: string): Promise<ResearchRun | null> {
    Trace.line(import.meta.url, "SqliteResearchStore.getRun", { runId });
    return this.tables.runs.get(runId);
  }

  async listRuns(scope: Scope, limit = 50): Promise<ResearchRun[]> {
    Trace.line(import.meta.url, "SqliteResearchStore.listRuns", { scope, limit });
    return this.tables.runs.list(scope, limit);
  }

  async updateRun(runId: string, fields: RunUpdate): Promise<void> {
    Trace.line(import.meta.url, "SqliteResearchStore.updateRun", { runId, fields });
    this.tables.runs.update(runId, fields);
    if (fields.packet !== undefined) {
      this.tables.packetRows.replace(runId, this.productOf(runId), fields.packet);
    }
  }

  async addEvent(runId: string, kind: string, payload: Record<string, unknown>): Promise<RunEvent> {
    Trace.tick(import.meta.url, "SqliteResearchStore.addEvent", { kind });
    return this.tables.events.add(runId, kind, payload);
  }

  async lastEventId(runId: string): Promise<number> {
    Trace.line(import.meta.url, "SqliteResearchStore.lastEventId", { runId });
    return this.tables.events.lastId(runId);
  }

  async listEvents(runId: string, afterId = 0): Promise<RunEvent[]> {
    Trace.line(import.meta.url, "SqliteResearchStore.listEvents", { runId, afterId });
    return this.tables.events.list(runId, afterId);
  }

  async listJudgements(scope: Scope, activeOnly = false): Promise<Judgement[]> {
    Trace.line(import.meta.url, "SqliteResearchStore.listJudgements", { scope, activeOnly });
    return this.tables.judgements.list(scope, activeOnly);
  }

  async addJudgement(workspaceId: string, input: { kind: string; text: string; rejects_kinds: SourceKind[] }): Promise<Judgement> {
    Trace.line(import.meta.url, "SqliteResearchStore.addJudgement", { workspaceId, input });
    return this.tables.judgements.add(workspaceId, input);
  }

  async deleteJudgement(scope: Scope, judgementId: string): Promise<boolean> {
    Trace.line(import.meta.url, "SqliteResearchStore.deleteJudgement", { scope, judgementId });
    return this.tables.judgements.delete(scope, judgementId);
  }

  async bumpJudgement(judgementId: string, by = 1): Promise<void> {
    Trace.line(import.meta.url, "SqliteResearchStore.bumpJudgement", { judgementId, by });
    this.tables.judgements.bump(judgementId, by);
  }

  async addPacketCheck(runId: string, valid: boolean, problems: readonly string[]): Promise<PacketCheck> {
    Trace.line(import.meta.url, "SqliteResearchStore.addPacketCheck", { runId, valid, problems });
    return this.tables.checks.add(runId, valid, problems);
  }

  async listPacketChecks(runId: string): Promise<PacketCheck[]> {
    Trace.line(import.meta.url, "SqliteResearchStore.listPacketChecks", { runId });
    return this.tables.checks.list(runId);
  }

  async addLlmCall(call: LlmCallRecord): Promise<LlmCall> {
    Trace.line(import.meta.url, "SqliteResearchStore.addLlmCall", { call });
    return this.tables.calls.add(call);
  }

  async setLlmCallGeneration(runId: string, responseId: string, generation: Generation): Promise<void> {
    Trace.line(import.meta.url, "SqliteResearchStore.setLlmCallGeneration", { runId, responseId, generation });
    this.tables.calls.setGeneration(runId, responseId, generation);
  }

  async listLlmCalls(runId: string): Promise<LlmCall[]> {
    Trace.line(import.meta.url, "SqliteResearchStore.listLlmCalls", { runId });
    return this.tables.calls.list(runId);
  }

  async saveRunReviews(runId: string, ledger: ReviewLedgerSnapshot): Promise<number> {
    Trace.line(import.meta.url, "SqliteResearchStore.saveRunReviews", { runId, ledger });
    return this.tables.reviews.save(runId, this.productOf(runId), ledger);
  }

  async listRunReviews(runId: string): Promise<StoredRunReview[]> {
    Trace.line(import.meta.url, "SqliteResearchStore.listRunReviews", { runId });
    return this.tables.reviews.list(runId);
  }

  async saveReviewAnalysis(analysis: ReviewAnalysis): Promise<void> {
    Trace.line(import.meta.url, "SqliteResearchStore.saveReviewAnalysis", { runId: analysis.run_id });
    this.tables.analyses.save(analysis);
  }

  async getReviewAnalysis(runId: string): Promise<ReviewAnalysis | null> {
    Trace.line(import.meta.url, "SqliteResearchStore.getReviewAnalysis", { runId });
    return this.tables.analyses.get(runId);
  }

  private productOf(runId: string): string {
    Trace.line(import.meta.url, "SqliteResearchStore.productOf", { runId });
    return this.tables.runs.get(runId)?.product_id ?? "";
  }

  async close(): Promise<void> {
    Trace.line(import.meta.url, "SqliteResearchStore.close");
    this.tables.db.close();
  }
}
