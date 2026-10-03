import {
  Briefs,
  type AccountDirectory, type ChargeLedger, type ReviewPullStore, type FindingLedger, type Generation, type Judgement, type LlmCall,
  type LlmCallRecord, type PacketCheck, type ProductCatalog, type ResearchRun, type ResearchStore,
  type ReviewAnalysis, type ReviewLedgerSnapshot, type RunEvent, type RunUpdate, type Scope, type SourceKind, type StoredRunReview, type TargetListings,
} from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";
import { StoreTables } from "./tables.js";

/** The research store, on whichever SQL database it is handed. */
export class SqlResearchStore implements ResearchStore {
  readonly products: ProductCatalog;
  readonly accounts: AccountDirectory;
  readonly listings: TargetListings;
  readonly findings: FindingLedger;
  readonly charges: ChargeLedger;
  readonly pulls: ReviewPullStore;

  private constructor(private readonly tables: StoreTables) {
    Trace.line(import.meta.url, "SqlResearchStore.constructor");
    this.products = this.tables.catalog;
    this.accounts = this.tables.accounts;
    this.listings = this.tables.listings;
    this.findings = this.tables.findings;
    this.charges = this.tables.charges;
    this.pulls = this.tables.pulls;
  }

  static async open(db: SqlDatabase): Promise<SqlResearchStore> {
    Trace.line(import.meta.url, "SqlResearchStore.open");
    return new SqlResearchStore(await StoreTables.open(db));
  }

  async createRun(input: Parameters<ResearchStore["createRun"]>[0]): Promise<ResearchRun> {
    Trace.line(import.meta.url, "SqlResearchStore.createRun", { input });
    const productId = await this.tables.products.ensure(Briefs.key(input.brief), Briefs.label(input.brief));
    return this.tables.runs.create({ ...input, productId });
  }

  async getRun(runId: string): Promise<ResearchRun | null> {
    Trace.line(import.meta.url, "SqlResearchStore.getRun", { runId });
    return this.tables.runs.get(runId);
  }

  async listRuns(scope: Scope, limit = 50): Promise<ResearchRun[]> {
    Trace.line(import.meta.url, "SqlResearchStore.listRuns", { scope, limit });
    return this.tables.runs.list(scope, limit);
  }

  async updateRun(runId: string, fields: RunUpdate): Promise<void> {
    Trace.line(import.meta.url, "SqlResearchStore.updateRun", { runId, fields });
    await this.tables.runs.update(runId, fields);
    if (fields.packet !== undefined) {
      await this.tables.packetRows.replace(runId, await this.productOf(runId), fields.packet);
    }
  }

  async addEvent(runId: string, kind: string, payload: Record<string, unknown>): Promise<RunEvent> {
    Trace.tick(import.meta.url, "SqlResearchStore.addEvent", { kind });
    return this.tables.events.add(runId, kind, payload);
  }

  async lastEventId(runId: string): Promise<number> {
    Trace.line(import.meta.url, "SqlResearchStore.lastEventId", { runId });
    return this.tables.events.lastId(runId);
  }

  async listEvents(runId: string, afterId = 0): Promise<RunEvent[]> {
    Trace.line(import.meta.url, "SqlResearchStore.listEvents", { runId, afterId });
    return this.tables.events.list(runId, afterId);
  }

  async listJudgements(scope: Scope, activeOnly = false): Promise<Judgement[]> {
    Trace.line(import.meta.url, "SqlResearchStore.listJudgements", { scope, activeOnly });
    return this.tables.judgements.list(scope, activeOnly);
  }

  async addJudgement(workspaceId: string, input: { kind: string; text: string; rejects_kinds: SourceKind[] }): Promise<Judgement> {
    Trace.line(import.meta.url, "SqlResearchStore.addJudgement", { workspaceId, input });
    return this.tables.judgements.add(workspaceId, input);
  }

  async deleteJudgement(scope: Scope, judgementId: string): Promise<boolean> {
    Trace.line(import.meta.url, "SqlResearchStore.deleteJudgement", { scope, judgementId });
    return this.tables.judgements.delete(scope, judgementId);
  }

  async bumpJudgement(judgementId: string, by = 1): Promise<void> {
    Trace.line(import.meta.url, "SqlResearchStore.bumpJudgement", { judgementId, by });
    await this.tables.judgements.bump(judgementId, by);
  }

  async addPacketCheck(runId: string, valid: boolean, problems: readonly string[]): Promise<PacketCheck> {
    Trace.line(import.meta.url, "SqlResearchStore.addPacketCheck", { runId, valid, problems });
    return this.tables.checks.add(runId, valid, problems);
  }

  async listPacketChecks(runId: string): Promise<PacketCheck[]> {
    Trace.line(import.meta.url, "SqlResearchStore.listPacketChecks", { runId });
    return this.tables.checks.list(runId);
  }

  async addLlmCall(call: LlmCallRecord): Promise<LlmCall> {
    Trace.line(import.meta.url, "SqlResearchStore.addLlmCall", { call });
    return this.tables.calls.add(call);
  }

  async setLlmCallGeneration(runId: string, responseId: string, generation: Generation): Promise<void> {
    Trace.line(import.meta.url, "SqlResearchStore.setLlmCallGeneration", { runId, responseId, generation });
    await this.tables.calls.setGeneration(runId, responseId, generation);
  }

  async listLlmCalls(runId: string): Promise<LlmCall[]> {
    Trace.line(import.meta.url, "SqlResearchStore.listLlmCalls", { runId });
    return this.tables.calls.list(runId);
  }

  async saveRunReviews(runId: string, ledger: ReviewLedgerSnapshot): Promise<number> {
    Trace.line(import.meta.url, "SqlResearchStore.saveRunReviews", { runId, ledger });
    return this.tables.reviews.save(runId, await this.productOf(runId), ledger);
  }

  async listRunReviews(runId: string): Promise<StoredRunReview[]> {
    Trace.line(import.meta.url, "SqlResearchStore.listRunReviews", { runId });
    return this.tables.reviews.list(runId);
  }

  async saveReviewAnalysis(analysis: ReviewAnalysis): Promise<void> {
    Trace.line(import.meta.url, "SqlResearchStore.saveReviewAnalysis", { runId: analysis.run_id });
    await this.tables.analyses.save(analysis);
  }

  async getReviewAnalysis(runId: string): Promise<ReviewAnalysis | null> {
    Trace.line(import.meta.url, "SqlResearchStore.getReviewAnalysis", { runId });
    return this.tables.analyses.get(runId);
  }

  private async productOf(runId: string): Promise<string> {
    Trace.line(import.meta.url, "SqlResearchStore.productOf", { runId });
    return (await this.tables.runs.get(runId))?.product_id ?? "";
  }

  async close(): Promise<void> {
    Trace.line(import.meta.url, "SqlResearchStore.close");
    await this.tables.db.close();
  }
}
