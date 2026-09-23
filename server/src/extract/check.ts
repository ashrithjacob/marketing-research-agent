import type { Node, Stage, StagePacket } from "../domain/index.js";

export interface PacketContext {
  scope: readonly Node[];
  stage: Stage;
  sourceIds: ReadonlySet<string>;
  brief?: { product?: unknown; url?: unknown } | undefined;
}

export interface PacketCheck {
  problems(packet: StagePacket, context: PacketContext): string[];
}
