import { Findings, type Brief, type CheckProblem, type FindingLedger, type Node, type StagePacket } from "../domain/index.js";
import { PacketAssembly, PacketValidator } from "../extract/index.js";
import { Trace } from "../trace/index.js";

/** The run's packet, built from every agent's rows in the ledger and checked against the run's scope once all of them have ended. */
export class LedgerPacket {
  constructor(
    private readonly ledger: FindingLedger,
    private readonly runId: string,
    private readonly run: { brief: Brief; nodes: readonly Node[] },
  ) {}

  /** The packet as the ledger holds it, with whatever it still breaks; the packet is null only when it does not parse. */
  assemble(): { packet: StagePacket | null; problems: CheckProblem[] } {
    Trace.line(import.meta.url, "LedgerPacket.assemble", { runId: this.runId });
    const draft = new PacketAssembly(this.ledger.list(this.runId)).draft({ runId: this.runId, ...this.run });
    return new PacketValidator().inspect(draft, this.run.nodes, this.run.brief);
  }

  isEmpty(): boolean {
    Trace.line(import.meta.url, "LedgerPacket.isEmpty");
    return Findings.live(this.ledger.list(this.runId)).length === 0;
  }
}
