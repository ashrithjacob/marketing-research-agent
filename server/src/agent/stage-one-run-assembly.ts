import { CheckProblems, Findings, type Brief, type CheckProblem, type FindingLedger, type Node, type RoleSpec, type StagePacket } from "../domain/index.js";
import { PacketAssembly, PacketValidator, RowBlame } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { Assembled, RunAssembly } from "./run-assembly.js";
import { RowRepair } from "./row-repair.js";
import { StageOneParts } from "./stage-one-parts.js";

/** The stage-1 packet, built from every agent's rows and checked against the run's scope: a row that breaks a check or the schema is retracted into a gap, a part its agent left open is closed with gaps, and the rest is kept. */
export class StageOneRunAssembly implements RunAssembly {
  readonly via = "ledger";

  constructor(
    private readonly ledger: FindingLedger,
    readonly runId: string,
    private readonly run: { brief: Brief; nodes: readonly Node[]; roles: readonly RoleSpec[] },
  ) {}

  async assemble(): Promise<Assembled> {
    Trace.line(import.meta.url, "StageOneRunAssembly.assemble", { runId: this.runId });
    const parts = new StageOneParts(this.ledger, this.runId, this.run);
    const all = async () => [...(await parts.problems()), ...(await this.inspect()).problems];
    const repair = new RowRepair(this.ledger, this.runId, this.run.nodes);
    const retracted = await repair.repair(all, "when the run settled");
    await parts.close();
    retracted.push(...(await repair.repair(all, "when the run settled")));
    const empty = Findings.live(await this.ledger.list(this.runId)).length === 0;
    return { packet: empty ? null : (await this.inspect()).packet, problems: CheckProblems.texts(await all()), retracted };
  }

  private async inspect(): Promise<{ packet: StagePacket | null; problems: CheckProblem[] }> {
    Trace.line(import.meta.url, "StageOneRunAssembly.inspect", { runId: this.runId });
    const rows = await this.ledger.list(this.runId);
    const { brief, nodes } = this.run;
    const draft = new PacketAssembly(rows).draft({ runId: this.runId, brief, nodes });
    return new PacketValidator().inspect(draft, this.run.nodes, this.run.brief, new RowBlame(Findings.live(rows), PacketAssembly.SECTIONS));
  }
}
