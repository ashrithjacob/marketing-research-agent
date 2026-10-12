import type { Node } from "../domain/index.js";
import type { DeliverableCheck } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { RunFindings } from "./run-findings.js";

export interface CloseReason {
  gap: string;
  status: string;
}

/** Closes one agent's part without the agent: everything its deliverable still lacks that no row owns is gapped, and a part that reports its status and left none gets a gap and an incomplete status. */
export class PartClose {
  constructor(
    private readonly findings: RunFindings,
    private readonly deliverable: DeliverableCheck,
    private readonly part: { node: Node; reports: boolean },
  ) {}

  async close(why: CloseReason): Promise<string[]> {
    Trace.line(import.meta.url, "PartClose.close", { node: this.part.node, agentId: this.findings.agentId });
    const { findings } = this;
    const { node, reports } = this.part;
    const open = this.deliverable.missing(await findings.live()).filter((missing) => !missing.row).map((missing) => missing.key);
    for (const key of open) await findings.record("gap", { node, missing: `${key}: ${why.gap}`, would_need: "a longer search" });
    if (!reports) return open;
    const own = await findings.own();
    if (!own.some((row) => row.kind === "gap")) await findings.record("gap", { node, missing: `research stopped: ${why.gap}`, would_need: "a longer search" });
    if (!own.some((row) => row.kind === "node_status")) {
      await findings.record("node_status", { node, status: "incomplete", done_criterion_met: false, why: why.status });
    }
    return open;
  }
}
