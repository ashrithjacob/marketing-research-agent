import { CheckProblems, Findings, stagePacketSchema, type Brief, type FindingLedger } from "../../domain/index.js";
import { PacketAssembly, ZodProblems } from "../../extract/index.js";
import { Trace } from "../../trace/index.js";

import type { DoneCheck } from "../done-check.js";
import type { Assembled, RunAssembly } from "../run-assembly.js";

/** A write or critique task's packet: the findings its draft rests on, under no node, so the run page shows what the draft cites; its problems are the draft's own check, not a node's. */
export class DraftRunAssembly implements RunAssembly {
  readonly via = "ledger";

  constructor(
    private readonly ledger: FindingLedger,
    readonly runId: string,
    private readonly from: { source: () => Promise<string>; brief: Brief; check: DoneCheck },
  ) {}

  async assemble(): Promise<Assembled> {
    Trace.line(import.meta.url, "DraftRunAssembly.assemble", { runId: this.runId });
    const rows = Findings.live(await this.ledger.list(await this.from.source()));
    const problems = CheckProblems.texts(await this.from.check.problems());
    const parsed = stagePacketSchema.safeParse(new PacketAssembly(rows).draft({ runId: this.runId, brief: this.from.brief, nodes: [] }));
    if (!parsed.success) return { packet: null, problems: [...problems, ...ZodProblems.list(parsed.error)], retracted: [] };
    return { packet: parsed.data, problems, retracted: [] };
  }
}
