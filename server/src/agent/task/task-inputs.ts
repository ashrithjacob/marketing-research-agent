import { Findings, type Finding, type FindingLedger, type Node } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** A task's input findings copied into its own ledger before it starts (spec §6.8: code copies, by reference): each named row, and the source rows it cites, filed under the task's node and kept under the agent that wrote them, so today's checks and prompts find them where a shared ledger would have put them. */
export class TaskInputs {
  constructor(private readonly ledger: FindingLedger) {}

  async copy(refs: readonly string[], runId: string, node: Node | null): Promise<number> {
    Trace.line(import.meta.url, "TaskInputs.copy", { refs: refs.length, runId });
    const picked: Finding[] = [];
    for (const ref of refs) {
      const [fromRun = "", rowId = ""] = ref.split("/");
      const rows = Findings.live(await this.ledger.list(fromRun));
      const row = rows.find((r) => r.id === rowId);
      if (!row) continue;
      const cited = rows.filter((r) => r.kind === "source" && row.source_id && r.payload.id === row.source_id);
      for (const each of [...cited, row]) if (!picked.includes(each)) picked.push(each);
    }
    for (const row of picked) {
      const payload = node && "node" in row.payload ? { ...row.payload, node } : row.payload;
      await this.ledger.append({ run_id: runId, kind: row.kind, entity: row.entity, agent_id: row.agent_id, source_id: row.source_id, payload });
    }
    return picked.length;
  }
}
