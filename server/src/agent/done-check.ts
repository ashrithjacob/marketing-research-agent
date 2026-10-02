import { CheckProblems, Roles, StageOnePlans, stagePacketSchema, type Brief, type CheckProblem, type Finding, type Node, type StageOneAgent } from "../domain/index.js";
import { ChampionCheck, DeliverableChecks, PacketAssembly, PacketError, PacketValidator, ZodProblems, type DeliverableCheck } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { RunFindings } from "./run-findings.js";

export interface DoneCheck {
  problems(): CheckProblem[];
}

/** A step-2 agent is done when its deliverable lacks nothing and its own rows, with the champion's when it measures against it, pass the contract for its node. */
export class NodeDone implements DoneCheck {
  constructor(
    private readonly findings: RunFindings,
    private readonly run: { brief: Brief; node: Node; champion: string | null },
    private readonly deliverable: DeliverableCheck,
  ) {}

  problems(): CheckProblem[] {
    Trace.line(import.meta.url, "NodeDone.problems", { agentId: this.findings.agentId, node: this.run.node });
    const { brief, node, champion } = this.run;
    const rows = this.findings.live().filter((row) => row.agent_id === this.findings.agentId || row.agent_id === champion);
    const draft = new PacketAssembly(rows).draft({ runId: this.findings.runId, brief, nodes: [node] });
    const unfilled = this.deliverable.missing(rows).map((missing) => ({ text: missing.text, row: missing.row ?? null }));
    try {
      new PacketValidator().validate(draft, [node], brief);
      return unfilled;
    } catch (error) {
      if (error instanceof PacketError) return [...unfilled, ...error.located];
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

  problems(): CheckProblem[] {
    Trace.line(import.meta.url, "ChampionDone.problems", { agentId: this.findings.agentId });
    const rows: Finding[] = this.findings.own();
    const draft = new PacketAssembly(rows).draft({ runId: this.findings.runId, brief: this.brief, nodes: ["competitors"] });
    const parsed = stagePacketSchema.safeParse(draft);
    if (!parsed.success) return ZodProblems.list(parsed.error).map(CheckProblems.of);
    const packet = parsed.data;
    const reference = packet.competitor_reference;
    if (!reference) return [CheckProblems.of("no champion is recorded — record it with record_reference, then call finish")];
    const sourceIds = new Set(packet.sources.map((source) => source.id));
    const cited = sourceIds.has(reference.source_id)
      ? []
      : [CheckProblems.at("competitor_reference", reference, `the champion cites source '${reference.source_id}', which you have not recorded with record_source`)];
    return [...cited, ...new ChampionCheck().problems(packet, { scope: ["competitors"], stage: 1, sourceIds, brief: this.brief })];
  }
}

/** Which check says a stage-1 agent is done: the champion's own, or its node's contract. */
export class DoneChecks {
  static of(id: StageOneAgent, findings: RunFindings, brief: Brief, nodes: readonly Node[]): DoneCheck {
    Trace.line(import.meta.url, "DoneChecks.of", { id });
    if (id === "champion") return new ChampionDone(findings, brief);
    const node = StageOnePlans.nodeOf(id, nodes);
    const deliverable = Roles.of(id).deliverable;
    if (deliverable.shape === "per_item") throw new Error(`${id} is not a stage-1 node role`);
    return new NodeDone(findings, { brief, node, champion: id === "competitors" ? "champion" : null }, DeliverableChecks.of(deliverable));
  }
}
