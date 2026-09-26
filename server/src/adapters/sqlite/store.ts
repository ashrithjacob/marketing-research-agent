import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";

import {
  Briefs,
  type Judgement,
  type LlmCall,
  type LlmCallRecord,
  type PacketCheck,
  type ResearchRun,
  type ResearchStore,
  type ReviewLedgerSnapshot,
  type ProductCatalog,
  type RunEvent,
  type RunUpdate,
  type SourceKind,
  type StoredRunReview,
} from "../../domain/index.js";

import { CallLog } from "./call-log.js";
import { EventLog } from "./event-log.js";
import { JudgementTable } from "./judgement-table.js";
import { PacketCheckLog } from "./check-log.js";
import { PacketRowTable } from "./packet-row-table.js";
import { ProductBackfill } from "./product-backfill.js";
import { SqliteProductCatalog } from "./product-catalog.js";
import { ProductTable } from "./product-table.js";
import { ReviewTable } from "./review-table.js";
import { RunTable } from "./run-table.js";
import { SqliteSchema } from "./schema.js";

export class SqliteResearchStore implements ResearchStore {
  private readonly db: Database.Database;
  private readonly runs: RunTable;
  private readonly events: EventLog;
  private readonly judgements: JudgementTable;
  private readonly checks: PacketCheckLog;
  private readonly calls: CallLog;
  private readonly reviews: ReviewTable;
  private readonly productTable: ProductTable;
  private readonly packetRows: PacketRowTable;
  readonly products: ProductCatalog;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { timeout: 15000 });
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 15000");
    this.db.pragma("foreign_keys = ON");
    SqliteSchema.apply(this.db);
    this.runs = new RunTable(this.db);
    this.events = new EventLog(this.db);
    this.judgements = new JudgementTable(this.db);
    this.checks = new PacketCheckLog(this.db);
    this.calls = new CallLog(this.db);
    this.reviews = new ReviewTable(this.db);
    this.productTable = new ProductTable(this.db);
    this.packetRows = new PacketRowTable(this.db);
    this.products = new SqliteProductCatalog(this.productTable, this.runs, this.packetRows);
    new ProductBackfill(this.db, this.productTable, this.packetRows).apply();
  }

  createRun(input: Parameters<ResearchStore["createRun"]>[0]): ResearchRun {
    const productId = this.productTable.ensure(Briefs.key(input.brief), Briefs.label(input.brief));
    return this.runs.create({ ...input, productId });
  }

  getRun(runId: string): ResearchRun | null {
    return this.runs.get(runId);
  }

  listRuns(limit = 50): ResearchRun[] {
    return this.runs.list(limit);
  }

  updateRun(runId: string, fields: RunUpdate): void {
    this.runs.update(runId, fields);
    if (fields.packet !== undefined) {
      this.packetRows.replace(runId, this.productOf(runId), fields.packet);
    }
  }

  addEvent(runId: string, kind: string, payload: Record<string, unknown>): RunEvent {
    return this.events.add(runId, kind, payload);
  }

  listEvents(runId: string, afterId = 0): RunEvent[] {
    return this.events.list(runId, afterId);
  }

  listJudgements(activeOnly = false): Judgement[] {
    return this.judgements.list(activeOnly);
  }

  addJudgement(input: { kind: string; text: string; rejects_kinds: SourceKind[] }): Judgement {
    return this.judgements.add(input);
  }

  deleteJudgement(judgementId: string): void {
    this.judgements.delete(judgementId);
  }

  bumpJudgement(judgementId: string, by = 1): void {
    this.judgements.bump(judgementId, by);
  }

  addPacketCheck(runId: string, valid: boolean, problems: readonly string[]): PacketCheck {
    return this.checks.add(runId, valid, problems);
  }

  listPacketChecks(runId: string): PacketCheck[] {
    return this.checks.list(runId);
  }

  addLlmCall(call: LlmCallRecord): LlmCall {
    return this.calls.add(call);
  }

  setLlmCallBilled(runId: string, responseId: string, cost: number): void {
    this.calls.setBilled(runId, responseId, cost);
  }

  listLlmCalls(runId: string): LlmCall[] {
    return this.calls.list(runId);
  }

  saveRunReviews(runId: string, ledger: ReviewLedgerSnapshot): number {
    return this.reviews.save(runId, this.productOf(runId), ledger);
  }

  listRunReviews(runId: string): StoredRunReview[] {
    return this.reviews.list(runId);
  }

  private productOf(runId: string): string {
    return this.runs.get(runId)?.product_id ?? "";
  }

  close(): void {
    this.db.close();
  }
}
