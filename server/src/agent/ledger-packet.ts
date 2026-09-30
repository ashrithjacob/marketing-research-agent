import { Findings, type Brief, type FindingLedger, type Node, type StagePacket } from "../domain/index.js";
import { PacketAssembly, PacketError, PacketValidator } from "../extract/index.js";
import { Trace } from "../trace/index.js";

/** The run's packet, built from every agent's rows in the ledger and checked against the run's scope once all of them have ended. */
export class LedgerPacket {
  constructor(
    private readonly ledger: FindingLedger,
    private readonly runId: string,
    private readonly run: { brief: Brief; nodes: readonly Node[] },
  ) {}

  assemble(): { packet: StagePacket } | { problems: string[] } {
    Trace.line(import.meta.url, "LedgerPacket.assemble", { runId: this.runId });
    const draft = new PacketAssembly(this.ledger.list(this.runId)).draft({ runId: this.runId, ...this.run });
    try {
      return { packet: new PacketValidator().validate(draft, this.run.nodes, this.run.brief) };
    } catch (error) {
      if (!(error instanceof PacketError)) throw error;
      return { problems: [...error.problems] };
    }
  }

  isEmpty(): boolean {
    Trace.line(import.meta.url, "LedgerPacket.isEmpty");
    return Findings.live(this.ledger.list(this.runId)).length === 0;
  }
}
