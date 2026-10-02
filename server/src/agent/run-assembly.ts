import type { ProductTruthPacket, StagePacket } from "../domain/index.js";

/** What a run's ledger makes once every agent has ended: the packet, null only when the ledger holds nothing, what it still breaks, and the rows retracted on the way. */
export interface Assembled {
  packet: StagePacket | ProductTruthPacket | null;
  problems: string[];
  retracted: string[];
}

/** How one stage turns its ledger into a packet; the only part of a run's ending that differs by stage. */
export interface RunAssembly {
  readonly runId: string;
  readonly via: "ledger" | "pipeline";
  assemble(): Assembled;
}
