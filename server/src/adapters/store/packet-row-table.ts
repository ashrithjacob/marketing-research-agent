
import { PacketRows, type PacketRowSet, type Scope, type StoredPacketRows } from "../../domain/index.js";

import { Rows } from "./rows.js";
import { ScopeFilter } from "./scope-filter.js";
import type { SqlDatabase } from "./sql-database.js";
import { Trace } from "../../trace/index.js";

type Value = string | number | null;
type Column<R> = readonly [name: string, type: string, read: (row: R) => Value];
type Spec<K extends keyof PacketRowSet> = {
  table: string;
  columns: ReadonlyArray<Column<PacketRowSet[K][number]>>;
};

const TEXT = "TEXT NOT NULL";
const FLAG = "INTEGER NOT NULL";

const SPECS: { [K in keyof PacketRowSet]: Spec<K> } = {
  sources: {
    table: "research_packet_sources",
    columns: [
      ["row_id", TEXT, (r) => r.id],
      ["node", TEXT, (r) => r.node],
      ["url", TEXT, (r) => r.url],
      ["title", TEXT, (r) => r.title],
      ["kind", TEXT, (r) => r.kind],
      ["admitted", FLAG, (r) => (r.admitted ? 1 : 0)],
    ],
  },
  attributes: {
    table: "research_packet_attributes",
    columns: [
      ["row_id", TEXT, (r) => r.id],
      ["node", TEXT, (r) => r.node],
      ["key", TEXT, (r) => r.key],
      ["value", TEXT, (r) => r.value],
      ["source_id", TEXT, (r) => r.source_id],
    ],
  },
  measurements: {
    table: "research_packet_measurements",
    columns: [
      ["row_id", TEXT, (r) => r.id],
      ["node", TEXT, (r) => r.node],
      ["metric", TEXT, (r) => r.metric],
      ["value", TEXT, (r) => String(r.value)],
      ["unit", TEXT, (r) => r.unit],
      ["period", TEXT, (r) => r.period],
      ["source_id", TEXT, (r) => r.source_id],
    ],
  },
  excerpts: {
    table: "research_packet_excerpts",
    columns: [
      ["row_id", TEXT, (r) => r.id],
      ["node", TEXT, (r) => r.node],
      ["source_id", TEXT, (r) => r.source_id],
      ["text", TEXT, (r) => r.text],
      ["star_rating", "INTEGER", (r) => r.star_rating],
      ["posted_at", TEXT, (r) => r.posted_at],
    ],
  },
  competitors: {
    table: "research_packet_competitors",
    columns: [
      ["row_id", TEXT, (r) => r.id],
      ["name", TEXT, (r) => r.name],
      ["brand", TEXT, (r) => r.brand],
      ["url", TEXT, (r) => r.url],
      ["relation", TEXT, (r) => r.relation],
      ["price", TEXT, (r) => r.price],
    ],
  },
  gaps: {
    table: "research_packet_gaps",
    columns: [
      ["node", TEXT, (r) => r.node],
      ["missing", TEXT, (r) => r.missing],
      ["would_need", TEXT, (r) => r.would_need],
      ["blocking", FLAG, (r) => (r.blocking ? 1 : 0)],
    ],
  },
};

const KINDS = Object.keys(SPECS) as Array<keyof PacketRowSet>;

/** A run's packet, one row per fact, tagged with its run and its product so either can be queried. */
export class PacketRowTable {
  static readonly DDL = KINDS.map((kind) => {
    const { table, columns } = SPECS[kind] as Spec<typeof kind>;
    const own = columns.map(([name, type]) => `    ${name} ${type},`).join("\n");
    return `CREATE TABLE IF NOT EXISTS ${table} (
    run_id     TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    seq        INTEGER NOT NULL,
${own}
    data       TEXT NOT NULL,
    PRIMARY KEY (run_id, seq)
);
CREATE INDEX IF NOT EXISTS ${table}_product ON ${table}(product_id);`;
  }).join("\n");

  constructor(private readonly db: SqlDatabase) {}

  async replace(runId: string, productId: string, packet: unknown): Promise<void> {
    Trace.line(import.meta.url, "PacketRowTable.replace", { runId, productId, packet });
    const rows = PacketRows.of(typeof packet === "string" ? Rows.json(packet, null) : packet);
    await this.db.transaction(async (tx) => {
      for (const kind of KINDS) await PacketRowTable.write(tx, kind, runId, productId, rows[kind]);
    });
  }

  async list(productId: string, scope: Scope): Promise<StoredPacketRows> {
    Trace.line(import.meta.url, "PacketRowTable.list", { productId, scope });
    const read = async (kind: keyof PacketRowSet) => {
      const rows = await this.db.all<{ run_id: string; data: string }>(
        `SELECT t.run_id, t.data FROM ${SPECS[kind].table} t JOIN research_runs r ON r.id = t.run_id` +
          ` WHERE t.product_id = ? AND ${ScopeFilter.sql("r.workspace_id")} ORDER BY r.created_at, t.run_id, t.seq`,
        [productId, ...ScopeFilter.args(scope)],
      );
      return [kind, rows.map((row) => ({ ...(Rows.json(row.data, {}) as object), run_id: row.run_id }))] as const;
    };
    return Object.fromEntries(await Promise.all(KINDS.map(read))) as StoredPacketRows;
  }

  private static async write<K extends keyof PacketRowSet>(
    tx: SqlDatabase,
    kind: K,
    runId: string,
    productId: string,
    rows: PacketRowSet[K],
  ): Promise<void> {
    Trace.line(import.meta.url, "PacketRowTable.write", { kind, runId, productId, rows });
    const { table, columns } = SPECS[kind] as Spec<K>;
    await tx.run(`DELETE FROM ${table} WHERE run_id = ?`, [runId]);
    const names = ["run_id", "product_id", "seq", ...columns.map(([name]) => name), "data"];
    const insert = `INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(",")})`;
    for (const [seq, row] of rows.entries()) {
      await tx.run(insert, [runId, productId, seq, ...columns.map(([, , read]) => read(row)), JSON.stringify(row)]);
    }
  }
}
