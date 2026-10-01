import { Findings, type Finding, type FindingKind, type FindingLedger, type Node } from "../domain/index.js";
import { FindingCheck, RowPicks } from "../extract/index.js";
import { Trace } from "../trace/index.js";

const NODE_ENTITY: Readonly<Record<Node, string>> = {
  product_data: "product",
  competitors: "product",
  category_data: "category",
  review_mining: "reviews",
  mechanism: "product",
  dose_vs_study: "product",
  claim_limits: "product",
  cogs_refills: "product",
};

export type Recorded = { recorded: Finding; replaced: string | null } | { problems: string };

/** One agent's hand on the shared run ledger: it reads every agent's rows, writes under its own id, and replaces or retracts only rows it wrote. */
export class RunFindings {
  constructor(
    private readonly ledger: FindingLedger,
    readonly runId: string,
    readonly agentId: string,
    private readonly scope: readonly Node[],
    private readonly markets: readonly string[] = [],
  ) {}

  record(kind: FindingKind, item: unknown, entity?: string): Recorded {
    Trace.line(import.meta.url, "RunFindings.record", { kind, entity });
    const checked = FindingCheck.check(kind, item, this.scope);
    if ("problems" in checked) return checked;
    const { payload } = checked;
    const unlisted = RowPicks.problems(kind, payload, this.live(), this.markets);
    if (unlisted.length > 0) return { problems: unlisted.join("; ") };
    const key = Findings.key(kind, payload);
    const earlier = key === null ? undefined : this.own().find((row) => row.kind === kind && Findings.key(kind, row.payload) === key);
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

  retract(id: string, why: string): { retracted: Finding } | { refused: string } {
    Trace.line(import.meta.url, "RunFindings.retract", { id, why });
    const row = this.live().find((r) => r.id === id);
    if (!row) return { refused: `no live row with id ${id} in this run's ledger` };
    if (row.agent_id !== this.agentId) return { refused: `${id} was recorded by agent ${row.agent_id}; an agent retracts only its own rows` };
    const retracted = this.ledger.retract(this.runId, id, why);
    return retracted ? { retracted } : { refused: `${id} could not be retracted` };
  }

  rows(): Finding[] {
    Trace.line(import.meta.url, "RunFindings.rows");
    return this.ledger.list(this.runId);
  }

  live(): Finding[] {
    Trace.line(import.meta.url, "RunFindings.live");
    return Findings.live(this.rows());
  }

  own(): Finding[] {
    Trace.line(import.meta.url, "RunFindings.own", { agentId: this.agentId });
    return this.live().filter((row) => row.agent_id === this.agentId);
  }

  private static entityOf(kind: FindingKind, payload: Record<string, unknown>): string {
    Trace.line(import.meta.url, "RunFindings.entityOf", { kind });
    if (kind === "competitor") return String(payload.id ?? "");
    const node = payload.node as Node | undefined;
    return (node && NODE_ENTITY[node]) || "product";
  }
}
