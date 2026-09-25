import type { SourceKind } from "./vocabulary.js";
import type {
  Judgement,
  LlmCall,
  LlmCallRecord,
  PacketCheck,
  RunEvent,
  RunUpdate,
} from "./logs.js";
import type { ResearchRun } from "./records.js";
import type { ReviewLedgerSnapshot, StoredRunReview } from "./reviews.js";

export interface ResearchStore {
  createRun(input: {
    brief: Record<string, unknown>;
    model: string;
    rejectKinds: string[];
    judgementIds: string[];
    nodes?: string[];
    stage?: number;
  }): ResearchRun;
  getRun(runId: string): ResearchRun | null;
  listRuns(limit?: number): ResearchRun[];
  updateRun(runId: string, fields: RunUpdate): void;
  addEvent(runId: string, kind: string, payload: Record<string, unknown>): RunEvent;
  listEvents(runId: string, afterId?: number): RunEvent[];
  listJudgements(activeOnly?: boolean): Judgement[];
  addJudgement(input: { kind: string; text: string; rejects_kinds: SourceKind[] }): Judgement;
  deleteJudgement(judgementId: string): void;
  bumpJudgement(judgementId: string, by?: number): void;
  addPacketCheck(runId: string, valid: boolean, problems: readonly string[]): PacketCheck;
  listPacketChecks(runId: string): PacketCheck[];
  addLlmCall(call: LlmCallRecord): LlmCall;
  setLlmCallBilled(runId: string, responseId: string, cost: number): void;
  listLlmCalls(runId: string): LlmCall[];
  saveRunReviews(runId: string, ledger: ReviewLedgerSnapshot): number;
  listRunReviews(runId: string): StoredRunReview[];

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
