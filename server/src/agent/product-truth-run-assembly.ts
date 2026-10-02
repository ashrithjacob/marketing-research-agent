import {
  Findings,
  PRODUCT_TRUTH_AGENTS,
  Roles,
  STAGE_NODES,
  productTruthPacketSchema,
  type Brief,
  type CheckProblem,
  type FindingLedger,
  type ProductTruthAgent,
  type ProductTruthPacket,
} from "../domain/index.js";
import { ProductTruthAssembly, RowBlame, type NodeReport } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import { ProductTruthDone } from "./product-truth-done.js";
import type { Assembled, RunAssembly } from "./run-assembly.js";
import { RowRepair } from "./row-repair.js";
import { RunFindings } from "./run-findings.js";

/** The product-truth packet from the ledger: rows citing nothing read, or breaking the packet's schema, become gaps; a node is complete when every item its agents own is recorded or gapped. */
export class ProductTruthRunAssembly implements RunAssembly {
  readonly via = "ledger";

  constructor(
    private readonly ledger: FindingLedger,
    readonly runId: string,
    private readonly run: { sourceRunId: string; brief: Brief; markets: readonly string[] },
  ) {}

  assemble(): Assembled {
    Trace.line(import.meta.url, "ProductTruthRunAssembly.assemble", { runId: this.runId });
    const agentRows = Findings.live(this.ledger.list(this.runId)).filter((row) => (PRODUCT_TRUTH_AGENTS as readonly string[]).includes(row.agent_id));
    if (agentRows.length === 0) return { packet: null, problems: this.problems().map((p) => p.text), retracted: [] };
    const all = () => [...this.problems(), ...this.parse().problems];
    const retracted = new RowRepair(this.ledger, this.runId, STAGE_NODES[2]).repair(all, "when the run settled");
    const { packet, problems } = this.parse();
    return { packet, problems: [...this.problems(), ...problems].map((p) => p.text), retracted };
  }

  private parse(): { packet: ProductTruthPacket | null; problems: CheckProblem[] } {
    Trace.line(import.meta.url, "ProductTruthRunAssembly.parse", { runId: this.runId });
    const rows = this.ledger.list(this.runId);
    const draft = new ProductTruthAssembly(rows).draft({ ...this.run, runId: this.runId, nodes: this.nodes() });
    const parsed = productTruthPacketSchema.safeParse(draft);
    if (parsed.success) return { packet: parsed.data, problems: [] };
    const blamed = new RowBlame(Findings.live(rows), ProductTruthAssembly.SECTIONS).problems(parsed.error);
    return { packet: null, problems: blamed.map((p) => ({ ...p, text: `the packet does not parse: ${p.text}` })) };
  }

  private problems(): CheckProblem[] {
    Trace.line(import.meta.url, "ProductTruthRunAssembly.problems");
    return PRODUCT_TRUTH_AGENTS.flatMap((id) => this.check(id).map((p) => ({ ...p, text: `${id}: ${p.text}` })));
  }

  private check(id: ProductTruthAgent): CheckProblem[] {
    Trace.line(import.meta.url, "ProductTruthRunAssembly.check", { id });
    const findings = new RunFindings(this.ledger, this.runId, id, STAGE_NODES[2], this.run.markets);
    return new ProductTruthDone(findings, id, this.run.markets).problems();
  }

  private nodes(): NodeReport[] {
    Trace.line(import.meta.url, "ProductTruthRunAssembly.nodes");
    return STAGE_NODES[2].map((node) => {
      const open = PRODUCT_TRUTH_AGENTS.filter((id) => Roles.of(id).deliverable.node === node).flatMap((id) => this.check(id));
      const done = open.length === 0;
      return { node, status: done ? "complete" : "incomplete", done_criterion_met: done, why: done ? "every item recorded or gapped" : open.map((p) => p.text).join("; ") };
    });
  }
}
