import type Database from "better-sqlite3";

import { Relations, type CompetitorRelation } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { PacketRowTable } from "./packet-row-table.js";
import { Rows } from "./rows.js";

type Row = Record<string, unknown>;

/** Relabels every stored competitor from the two kinds before 2026-10-03 (`direct`, `indirect`) to the three since, by the rule code now applies to new rows; an old `indirect` saturation curve, which counted both indirect kinds together, becomes `indirect_form` and says so. Runs once. */
export class CompetitorKinds {
  static readonly NAME = "competitor-kinds-split";

  constructor(private readonly db: Database.Database) {}

  apply(): void {
    Trace.line(import.meta.url, "CompetitorKinds.apply");
    this.packets();
    this.ledger();
  }

  private packets(): void {
    Trace.line(import.meta.url, "CompetitorKinds.packets");
    const rows = new PacketRowTable(this.db);
    const runs = this.db.prepare("SELECT id, product_id, packet FROM research_runs WHERE packet LIKE '%\"relation\"%' OR packet LIKE '%\"indirect\"%'").all() as Array<{ id: string; product_id: string; packet: string }>;
    for (const run of runs) {
      const packet = Rows.json(run.packet, null) as Row | null;
      if (!packet) continue;
      const reference = (packet.competitor_reference as Row | null) ?? null;
      packet.competitors = ((packet.competitors as Row[] | undefined) ?? []).map((row) => ({ ...row, relation: CompetitorKinds.kind(row, reference) }));
      packet.saturation = ((packet.saturation as Row[] | undefined) ?? []).map(CompetitorKinds.curve);
      const json = JSON.stringify(packet);
      this.db.prepare("UPDATE research_runs SET packet = ? WHERE id = ?").run(json, run.id);
      rows.replace(run.id, run.product_id, packet);
    }
  }

  private ledger(): void {
    Trace.line(import.meta.url, "CompetitorKinds.ledger");
    const rows = this.db.prepare("SELECT run_id, seq, kind, payload FROM research_findings WHERE kind IN ('competitor', 'saturation', 'competitor_reference') ORDER BY run_id, seq").all() as Array<{ run_id: string; seq: number; kind: string; payload: string }>;
    const references = new Map<string, Row>();
    for (const row of rows) if (row.kind === "competitor_reference") references.set(row.run_id, Rows.json(row.payload, {}) as Row);
    const update = this.db.prepare("UPDATE research_findings SET payload = ? WHERE run_id = ? AND seq = ?");
    for (const row of rows) {
      const payload = Rows.json(row.payload, {}) as Row;
      if (row.kind === "competitor") update.run(JSON.stringify({ ...payload, relation: CompetitorKinds.kind(payload, references.get(row.run_id) ?? null) }), row.run_id, row.seq);
      if (row.kind === "saturation" && payload.class === "indirect") update.run(JSON.stringify(CompetitorKinds.curve(payload)), row.run_id, row.seq);
    }
  }

  /** The kind code would give the row now; when it cannot tell (no champion, or both forms `other`), the old label's nearest: `direct` stays, `indirect` was by form. */
  private static kind(row: Row, reference: Row | null): CompetitorRelation {
    Trace.tick(import.meta.url, "CompetitorKinds.kind");
    const shared = Array.isArray(row.shared_actives) ? row.shared_actives : [];
    const derived = reference ? Relations.expected(String(row.form ?? ""), String(reference.form ?? ""), shared) : null;
    if (derived) return derived;
    return row.relation === "direct" ? "direct" : "indirect_form";
  }

  private static curve(row: Row): Row {
    Trace.tick(import.meta.url, "CompetitorKinds.curve");
    if (row.class !== "indirect") return row;
    const was = "(an `indirect` curve from before 2026-10-03, counting brands of both indirect kinds) ";
    return { ...row, class: "indirect_form", stopped_because: `${was}${String(row.stopped_because ?? "")}` };
  }
}
