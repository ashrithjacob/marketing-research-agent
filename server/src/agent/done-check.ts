import { NodeFields, TREND_YEARS, stagePacketSchema, type Brief, type Finding, type Node } from "../domain/index.js";
import { ChampionCheck, PacketAssembly, PacketError, PacketValidator, ZodProblems } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { RunFindings } from "./run-findings.js";

export interface DoneCheck {
  problems(): string[];
}

/** A step-2 agent is done when its own rows, with the champion's when it measures against it, pass the contract for its node. */
export class NodeDone implements DoneCheck {
  constructor(
    private readonly findings: RunFindings,
    private readonly run: { brief: Brief; node: Node; champion: string | null },
  ) {}

  problems(): string[] {
    Trace.line(import.meta.url, "NodeDone.problems", { agentId: this.findings.agentId, node: this.run.node });
    const { brief, node, champion } = this.run;
    const rows = this.findings.live().filter((row) => row.agent_id === this.findings.agentId || row.agent_id === champion);
    const draft = new PacketAssembly(rows).draft({ runId: this.findings.runId, brief, nodes: [node] });
    const unfilled = NodeFields.missing(node, rows).map((field) =>
      field === "search_volume"
        ? `\`search_volume\` needs rows for at least ${TREND_YEARS} different years to be a trend — record them, or record_gap with missing "search_volume: <why>"`
        : `\`${field}\` is neither recorded nor gapped — record it, or record_gap with missing "${field}: <why>"`,
    );
    try {
      new PacketValidator().validate(draft, [node], brief);
      return unfilled;
    } catch (error) {
      if (error instanceof PacketError) return [...unfilled, ...error.problems];
      throw error;
    }
  }
}

/** The champion agent is done when its reference is recorded, cites a source it recorded, and carries the ranking that chose it. */
export class ChampionDone implements DoneCheck {
  constructor(
    private readonly findings: RunFindings,
    private readonly brief: Brief,
  ) {}

  problems(): string[] {
    Trace.line(import.meta.url, "ChampionDone.problems", { agentId: this.findings.agentId });
    const rows: Finding[] = this.findings.own();
    const draft = new PacketAssembly(rows).draft({ runId: this.findings.runId, brief: this.brief, nodes: ["competitors"] });
    const parsed = stagePacketSchema.safeParse(draft);
    if (!parsed.success) return ZodProblems.list(parsed.error);
    const packet = parsed.data;
    const reference = packet.competitor_reference;
    if (!reference) return ["no champion is recorded — record it with record_reference, then call finish"];
    const sourceIds = new Set(packet.sources.map((source) => source.id));
    const cited = sourceIds.has(reference.source_id)
      ? []
      : [`the champion cites source '${reference.source_id}', which you have not recorded with record_source`];
    return [...cited, ...new ChampionCheck().problems(packet, { scope: ["competitors"], stage: 1, sourceIds, brief: this.brief })];
  }
}
