import { BUYER_STAGES, Findings, type BuyerStageShare, type Finding } from "../domain/index.js";
import { LatestRows } from "./latest-rows.js";
import { Trace } from "../trace/index.js";

/** How the customer voices a run read are spread across the five buyer stages, each voice counted once at its newest tag; pure. */
export class BuyerStages {
  static shares(rows: readonly Finding[]): BuyerStageShare[] {
    Trace.line(import.meta.url, "BuyerStages.shares", { rows: rows.length });
    const stages = LatestRows.payloads(Findings.live(rows), "buyer_stage").map((payload) => String(payload.stage ?? ""));
    return BUYER_STAGES.map((stage) => ({ stage, voices: stages.filter((s) => s === stage).length, of: stages.length }));
  }
}
