import { createHash } from "node:crypto";

import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";
import { MIGRATIONS, type Migration } from "./text/migrations.js";

/** Brings a database up to the newest schema: each migration not yet recorded runs in its own transaction, under a lock so two processes never race; one edited after it was applied stops the start. */
export class Migrator {
  private static readonly LOCK = 7_301_917;

  constructor(
    private readonly db: SqlDatabase,
    private readonly migrations: readonly Migration[] = MIGRATIONS,
  ) {}

  static checksum(migration: Migration): string {
    Trace.line(import.meta.url, "Migrator.checksum", { id: migration.id });
    return createHash("sha256").update(migration.sql).digest("hex");
  }

  async migrate(): Promise<number[]> {
    Trace.line(import.meta.url, "Migrator.migrate", { known: this.migrations.length });
    await this.db.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());" +
        " ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT",
    );
    const applied: number[] = [];
    for (const migration of this.migrations) {
      if (await this.apply(migration)) applied.push(migration.id);
    }
    return applied;
  }

  private async apply(migration: Migration): Promise<boolean> {
    Trace.line(import.meta.url, "Migrator.apply", { id: migration.id });
    const checksum = Migrator.checksum(migration);
    return this.db.transaction(async (tx) => {
      await tx.run("SELECT pg_advisory_xact_lock(?)", [Migrator.LOCK]);
      const recorded = await tx.get<{ checksum: string | null }>("SELECT checksum FROM schema_migrations WHERE id = ?", [migration.id]);
      if (recorded && recorded.checksum !== null && recorded.checksum !== checksum) {
        throw new Error(`migration ${migration.id} (${migration.name}) was edited after it was applied; restore it and add a new migration instead`);
      }
      if (recorded) {
        await tx.run("UPDATE schema_migrations SET checksum = ? WHERE id = ? AND checksum IS NULL", [checksum, migration.id]);
        return false;
      }
      await tx.exec(migration.sql);
      await tx.run("INSERT INTO schema_migrations (id, name, checksum) VALUES (?, ?, ?)", [migration.id, migration.name, checksum]);
      return true;
    });
  }
}
