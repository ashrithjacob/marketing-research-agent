/**
 * Competitors came in two kinds until 2026-10-03 and three since. Stored runs are
 * relabelled once, by the rule code applies to new rows, so an old run reads
 * like a new one.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteResearchStore } from "../src/adapters/index.js";
import { CompetitorKinds } from "../src/adapters/sqlite/competitor-kinds.js";

let dir: string;
let path: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mra-kinds-"));
  path = join(dir, "research.db");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const reference = { name: "Mullevia", form: "liquid", actives: ["mullein"], icp: "adults with a cough", source_id: "s" };
const competitor = (id: string, relation: string, form: string, shared: string[]) => ({
  id, name: id, url: `https://${id}.example`, relation, form, form_as_printed: form,
  active_ingredients: [{ name_as_printed: "Mullein", name_normalised: "mullein" }], shared_actives: shared, icp_as_printed: "coughs", source_id: "s",
});

describe("the competitor-kinds migration", () => {
  it("relabels old packets, their packet rows and the ledger, and marks an old indirect curve for what it was", () => {
    const store = new SqliteResearchStore(path);
    const runId = store.createRun({ workspaceId: "admin", brief: { product: "Mullevia" }, model: "m", rejectKinds: [], judgementIds: [] }).id;
    store.close();
    const db = new Database(path);
    const packet = {
      competitor_reference: reference,
      competitors: [
        competitor("c1", "direct", "liquid", ["mullein"]),
        competitor("c2", "indirect", "capsule", ["mullein"]),
        competitor("c3", "direct", "liquid", []),
        competitor("c4", "indirect", "spray", []),
      ],
      saturation: [{ node: "competitors", class: "indirect", curve: [], stopped_because: "three quiet sources" }],
    };
    db.prepare("UPDATE research_runs SET packet = ? WHERE id = ?").run(JSON.stringify(packet), runId);
    const ledger = db.prepare("INSERT INTO research_findings (run_id, seq, id, kind, payload, created_at) VALUES (?,?,?,?,?,?)");
    ledger.run(runId, 1, "ref1", "competitor_reference", JSON.stringify(reference), "");
    ledger.run(runId, 2, "co2", "competitor", JSON.stringify(competitor("c3", "direct", "liquid", [])), "");
    ledger.run(runId, 3, "sat3", "saturation", JSON.stringify(packet.saturation[0]), "");
    db.prepare("DELETE FROM research_migrations WHERE name = ?").run(CompetitorKinds.NAME);
    db.close();

    const reopened = new SqliteResearchStore(path);
    const stored = reopened.getRun(runId)!.packet as any;
    expect(stored.competitors.map((c: any) => c.relation)).toEqual(["direct", "indirect_form", "indirect_active", "indirect_active"]);
    expect(stored.saturation[0]).toMatchObject({ class: "indirect_form", stopped_because: expect.stringMatching(/^\(an `indirect` curve from before 2026-10-03, counting brands of both indirect kinds\) three quiet sources/) });
    const rows = reopened.findings.list(runId);
    expect(rows.find((r) => r.kind === "competitor")!.payload.relation).toBe("indirect_active");
    expect(rows.find((r) => r.kind === "saturation")!.payload.class).toBe("indirect_form");
    reopened.close();
    const check = new Database(path);
    expect((check.prepare("SELECT relation FROM research_packet_competitors WHERE run_id = ? ORDER BY seq").all(runId) as any[]).map((r) => r.relation)).toEqual(["direct", "indirect_form", "indirect_active", "indirect_active"]);
    check.close();
  });

  it("runs once: a store opened again leaves a relabelled run alone", () => {
    new SqliteResearchStore(path).close();
    const db = new Database(path);
    expect(db.prepare("SELECT COUNT(*) AS n FROM research_migrations WHERE name = ?").get(CompetitorKinds.NAME)).toEqual({ n: 1 });
    db.close();
  });
});
