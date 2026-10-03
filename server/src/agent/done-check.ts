import { CheckProblems, stagePacketSchema, type Brief, type CheckProblem, type Finding, type Node } from "../domain/index.js";
import { ChampionCheck, PacketAssembly, PacketError, PacketValidator, TruthCitations, ZodProblems } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { RunFindings } from "./run-findings.js";

export interface DoneCheck {
  problems(): Promise<CheckProblem[]>;
}

/** A stage-1 node agent's rows, with the champion's when it measures against it, pass the contract for its node: citations real, labels agreeing with forms, markets in the brief, "complete" only with saturation. */
export class NodeContract implements DoneCheck {
  constructor(
    private readonly findings: RunFindings,
    private readonly run: { brief: Brief; node: Node; champion: string | null },
  ) {}

  async problems(): Promise<CheckProblem[]> {
    Trace.line(import.meta.url, "NodeContract.problems", { agentId: this.findings.agentId, node: this.run.node });
    const { brief, node, champion } = this.run;
    const rows = (await this.findings.live()).filter((row) => row.agent_id === this.findings.agentId || row.agent_id === champion);
    const draft = new PacketAssembly(rows).draft({ runId: this.findings.runId, brief, nodes: [node] });
    try {
      new PacketValidator().validate(draft, [node], brief);
      return [];
    } catch (error) {
      if (error instanceof PacketError) return [...error.located];
      throw error;
    }
  }
}

/** A recorded champion cites a source its agent recorded, says who its customer is, and carries the ranking that chose it; that one is recorded at all is its deliverable's question. */
export class ChampionContract implements DoneCheck {
  constructor(
    private readonly findings: RunFindings,
    private readonly brief: Brief,
  ) {}

  async problems(): Promise<CheckProblem[]> {
    Trace.line(import.meta.url, "ChampionContract.problems", { agentId: this.findings.agentId });
    const rows: Finding[] = await this.findings.own();
    const draft = new PacketAssembly(rows).draft({ runId: this.findings.runId, brief: this.brief, nodes: ["competitors"] });
    const parsed = stagePacketSchema.safeParse(draft);
    if (!parsed.success) return ZodProblems.list(parsed.error).map(CheckProblems.of);
    const packet = parsed.data;
    const reference = packet.competitor_reference;
    if (!reference) return [];
    const sourceIds = new Set(packet.sources.map((source) => source.id));
    const cited = sourceIds.has(reference.source_id)
      ? []
      : [CheckProblems.at("competitor_reference", reference, `the champion cites source '${reference.source_id}', which you have not recorded with record_source`)];
    return [...cited, ...new ChampionCheck().problems(packet, { scope: ["competitors"], stage: 1, sourceIds, brief: this.brief })];
  }
}

/** Every row a product-truth agent wrote cites a source in the ledger. */
export class TruthContract implements DoneCheck {
  constructor(private readonly findings: RunFindings) {}

  async problems(): Promise<CheckProblem[]> {
    Trace.line(import.meta.url, "TruthContract.problems", { agentId: this.findings.agentId });
    return TruthCitations.problems(await this.findings.own(), await this.findings.live());
  }
}
