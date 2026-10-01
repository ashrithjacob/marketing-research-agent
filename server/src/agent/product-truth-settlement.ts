import type { Usage } from "@earendil-works/pi-ai";

import type { Pricing } from "../adapters/index.js";
import {
  Clock,
  Findings,
  PRODUCT_TRUTH_AGENTS,
  PRODUCT_TRUTH_AGENT_SPECS,
  STAGE_NODES,
  productTruthPacketSchema,
  type Brief,
  type CheckProblem,
  type ProductTruthAgent,
  type ResearchStore,
} from "../domain/index.js";
import { ProductTruthAssembly, type NodeReport } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { LiveRuns } from "./live-runs.js";
import { ProductTruthDone } from "./product-truth-done.js";
import { RowRepair } from "./row-repair.js";
import { RunFindings } from "./run-findings.js";

/** Ends a product-truth run from its ledger once every agent has ended: rows citing nothing read become gaps, a node is complete when every item its agents own is recorded or gapped, and the packet is kept however the run ends. */
export class ProductTruthSettlement {
  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    private readonly runId: string,
    private readonly run: { sourceRunId: string; brief: Brief; markets: readonly string[] },
  ) {}

  settle(output: string, usage: Usage & { pricing: Pricing }, errorMessage?: string): void {
    Trace.line(import.meta.url, "ProductTruthSettlement.settle", { errorMessage });
    const { store, runs, runId } = this;
    const stopping = store.getRun(runId)?.status === "stopping";
    store.updateRun(runId, { output, usage, ended_at: Clock.nowIso() });
    if (stopping) return this.end("cancelled", errorMessage || "stopped by the operator");
    const agentRows = Findings.live(store.findings.list(runId)).filter((row) => (PRODUCT_TRUTH_AGENTS as readonly string[]).includes(row.agent_id));
    if (errorMessage && agentRows.length === 0) return this.end("failed", errorMessage);
    const retracted = new RowRepair(store.findings, runId, STAGE_NODES[2]).repair(() => this.problems(), "when the run settled");
    const problems = this.problems();
    const draft = new ProductTruthAssembly(store.findings.list(runId)).draft({ ...this.run, runId, nodes: this.nodes() });
    const parsed = productTruthPacketSchema.safeParse(draft);
    if (parsed.success) {
      store.updateRun(runId, { packet: parsed.data, packet_source: "ledger" });
      runs.emit(runId, "packet.ready", { sources: parsed.data.sources.length, excerpts: 0, gaps: parsed.data.gaps.length, retracted: retracted.length, via: "ledger" });
    }
    const texts = [...problems.map((p) => p.text), ...(parsed.success ? [] : [`the packet does not parse: ${parsed.error.issues[0]?.message ?? ""}`])];
    if (texts.length === 0) return this.end("completed", "", { usage });
    if (errorMessage) return this.end("failed", errorMessage);
    store.addPacketCheck(runId, false, texts);
    runs.emit(runId, "packet.invalid", { error: texts.join("; ") });
    this.end("invalid", texts.join("; "));
  }

  private problems(): CheckProblem[] {
    Trace.line(import.meta.url, "ProductTruthSettlement.problems");
    return PRODUCT_TRUTH_AGENTS.flatMap((id) => this.check(id).map((p) => ({ ...p, text: `${id}: ${p.text}` })));
  }

  private check(id: ProductTruthAgent): CheckProblem[] {
    Trace.line(import.meta.url, "ProductTruthSettlement.check", { id });
    const findings = new RunFindings(this.store.findings, this.runId, id, STAGE_NODES[2], this.run.markets);
    return new ProductTruthDone(findings, id, this.run.markets).problems();
  }

  private nodes(): NodeReport[] {
    Trace.line(import.meta.url, "ProductTruthSettlement.nodes");
    return STAGE_NODES[2].map((node) => {
      const open = PRODUCT_TRUTH_AGENTS.filter((id) => PRODUCT_TRUTH_AGENT_SPECS[id].node === node).flatMap((id) => this.check(id));
      const done = open.length === 0;
      return { node, status: done ? "complete" : "incomplete", done_criterion_met: done, why: done ? "every item recorded or gapped" : open.map((p) => p.text).join("; ") };
    });
  }

  private end(status: "completed" | "invalid" | "cancelled" | "failed", error: string, extra: Record<string, unknown> = {}): void {
    Trace.line(import.meta.url, "ProductTruthSettlement.end", { status });
    this.store.updateRun(this.runId, { status, error });
    this.runs.emit(this.runId, `run.${status}`, { ...(error ? { error } : {}), ...extra });
  }
}
