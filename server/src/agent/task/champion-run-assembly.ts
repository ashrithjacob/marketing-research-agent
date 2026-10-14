import { CheckProblems, Findings, stagePacketSchema, type Brief, type FindingLedger } from "../../domain/index.js";
import { PacketAssembly } from "../../extract/index.js";
import { Trace } from "../../trace/index.js";

import { ChampionContract } from "../done-check.js";
import type { Assembled, RunAssembly } from "../run-assembly.js";
import { RunFindings } from "../run-findings.js";

/** A champion task's packet: its reference and the pages it cites, under no node, since the reference serves the plan's other tasks. Checked by the champion's own contract, not a node's. */
export class ChampionRunAssembly implements RunAssembly {
  readonly via = "ledger";

  constructor(
    private readonly ledger: FindingLedger,
    readonly runId: string,
    private readonly brief: Brief,
  ) {}

  async assemble(): Promise<Assembled> {
    Trace.line(import.meta.url, "ChampionRunAssembly.assemble", { runId: this.runId });
    const rows = await this.ledger.list(this.runId);
    if (Findings.live(rows).length === 0) return { packet: null, problems: [], retracted: [] };
    const findings = new RunFindings(this.ledger, this.runId, "champion", ["competitors"]);
    const problems = CheckProblems.texts(await new ChampionContract(findings, this.brief).problems());
    const reference = Findings.live(rows).some((row) => row.kind === "competitor_reference");
    const missing = reference ? [] : ["the champion was not recorded"];
    const packet = stagePacketSchema.parse(new PacketAssembly(rows).draft({ runId: this.runId, brief: this.brief, nodes: [] }));
    return { packet, problems: [...missing, ...problems], retracted: [] };
  }
}
