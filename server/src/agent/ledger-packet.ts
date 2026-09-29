import type { Brief, Node, StagePacket } from "../domain/index.js";
import { PacketAssembly, PacketError, PacketValidator } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { RunFindings } from "./run-findings.js";

/** The run's packet, built from its ledger and checked: what `finish` answers, and what settles a run that never called it. */
export class LedgerPacket {
  constructor(
    private readonly findings: RunFindings,
    private readonly run: { brief: Brief; nodes: readonly Node[] },
  ) {}

  assemble(): { packet: StagePacket } | { problems: string[] } {
    Trace.line(import.meta.url, "LedgerPacket.assemble", { runId: this.findings.runId });
    const draft = new PacketAssembly(this.findings.rows()).draft({ runId: this.findings.runId, ...this.run });
    try {
      return { packet: new PacketValidator().validate(draft, this.run.nodes, this.run.brief) };
    } catch (error) {
      if (!(error instanceof PacketError)) throw error;
      return { problems: [...error.problems] };
    }
  }

  isEmpty(): boolean {
    Trace.line(import.meta.url, "LedgerPacket.isEmpty");
    return this.findings.live().length === 0;
  }
}
