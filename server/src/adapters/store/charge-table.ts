import type { Charge, ChargeLedger } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { SqlDatabase } from "./sql-database.js";

/** What each run paid for, one row per paid call, tagged with the agent whose tool made it. */
export class ChargeTable implements ChargeLedger {
  constructor(private readonly db: SqlDatabase) {}

  async add(charge: Omit<Charge, "created_at">): Promise<Charge> {
    Trace.line(import.meta.url, "ChargeTable.add", { runId: charge.run_id, agentId: charge.agent_id, service: charge.service });
    return (await this.db.get<Charge>(
      "INSERT INTO charges (run_id, agent_id, service, item, units, usd, basis) VALUES (?,?,?,?,?,?,?)" +
        " RETURNING run_id, agent_id, service, item, units, usd, basis, created_at",
      [charge.run_id, charge.agent_id, charge.service, charge.item, charge.units, charge.usd, charge.basis],
    ))!;
  }

  async list(runId: string): Promise<Charge[]> {
    Trace.line(import.meta.url, "ChargeTable.list", { runId });
    return this.db.all<Charge>(
      "SELECT run_id, agent_id, service, item, units, usd, basis, created_at FROM charges WHERE run_id = ? ORDER BY id",
      [runId],
    );
  }
}
