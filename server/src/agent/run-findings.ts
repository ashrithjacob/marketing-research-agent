import { Findings, type Finding, type FindingKind, type FindingLedger, type Node } from "../domain/index.js";
import { FindingCheck } from "../extract/index.js";
import { Trace } from "../trace/index.js";

const NODE_ENTITY: Readonly<Record<Node, string>> = {
  product_data: "product",
  competitors: "product",
  category_data: "category",
  review_mining: "reviews",
};

export type Recorded = { recorded: Finding; replaced: string | null } | { problems: string };

/** One agent's hand on the run ledger: every row checked as it is written, and a newer row replacing the one it supersedes. */
export class RunFindings {
  constructor(
    private readonly ledger: FindingLedger,
    readonly runId: string,
    private readonly agentId: string,
    private readonly scope: readonly Node[],
  ) {}

  record(kind: FindingKind, item: unknown, entity?: string): Recorded {
    Trace.line(import.meta.url, "RunFindings.record", { kind, entity });
    const checked = FindingCheck.check(kind, item, this.scope);
    if ("problems" in checked) return checked;
    const { payload } = checked;
    const key = Findings.key(kind, payload);
    const earlier = key === null ? undefined : this.live().find((row) => row.kind === kind && Findings.key(kind, row.payload) === key);
    const recorded = this.ledger.append({
      run_id: this.runId,
      kind,
      entity: entity?.trim() || RunFindings.entityOf(kind, payload),
      agent_id: this.agentId,
      source_id: String(kind === "source" ? payload.id : (payload.source_id ?? "")),
      payload,
    });
    if (earlier) this.ledger.retract(this.runId, earlier.id, `replaced by ${recorded.id}`);
    return { recorded, replaced: earlier?.id ?? null };
  }

  retract(id: string, why: string): Finding | null {
    Trace.line(import.meta.url, "RunFindings.retract", { id, why });
    return this.ledger.retract(this.runId, id, why);
  }

  rows(): Finding[] {
    Trace.line(import.meta.url, "RunFindings.rows");
    return this.ledger.list(this.runId);
  }

  live(): Finding[] {
    Trace.line(import.meta.url, "RunFindings.live");
    return Findings.live(this.rows());
  }

  private static entityOf(kind: FindingKind, payload: Record<string, unknown>): string {
    Trace.line(import.meta.url, "RunFindings.entityOf", { kind });
    if (kind === "competitor" || kind === "candidate") return String(payload.id ?? "");
    const node = payload.node as Node | undefined;
    return (node && NODE_ENTITY[node]) || "product";
  }
}
