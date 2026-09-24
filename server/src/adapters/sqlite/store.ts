import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";

import type {
  Judgement,
  LlmCall,
  LlmCallRecord,
  PacketCheck,
  ResearchRun,
  ResearchStore,
  ReviewLedger,
  RunEvent,
  RunUpdate,
  SourceKind,
} from "../../domain/index.js";

import { CallLog } from "./call-log.js";
import { EventLog } from "./event-log.js";
import { JudgementTable } from "./judgement-table.js";
import { PacketCheckLog } from "./check-log.js";
import { SqliteReviewLedger } from "./review-ledger.js";
import { RunTable } from "./run-table.js";
import { SqliteSchema } from "./schema.js";

export class SqliteResearchStore implements ResearchStore {
  private readonly db: Database.Database;
  private readonly runs: RunTable;
  private readonly events: EventLog;
  private readonly judgements: JudgementTable;
  private readonly checks: PacketCheckLog;
  private readonly calls: CallLog;
  private readonly ledger: SqliteReviewLedger;

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
    this.ledger = new SqliteReviewLedger(this.db);
  }

  reviewLedger(): ReviewLedger {
    return this.ledger;
  }

  createRun(input: {
    brief: Record<string, unknown>;
    model: string;
    rejectKinds: string[];
    judgementIds: string[];
    nodes?: string[];
    stage?: number;
  }): ResearchRun {
    return this.runs.create(input);
  }

  getRun(runId: string): ResearchRun | null {
    return this.runs.get(runId);
  }

  listRuns(limit = 50): ResearchRun[] {
    return this.runs.list(limit);
  }

  updateRun(runId: string, fields: RunUpdate): void {
    this.runs.update(runId, fields);
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

  close(): void {
    this.db.close();
  }
}
