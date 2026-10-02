import type { z } from "zod";

import { CheckProblems, Findings, type CheckProblem, type Finding, type FindingKind } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { LatestRows } from "./latest-rows.js";

/** A packet section a ledger kind fills: a list of entries, or the one latest row. */
export interface PacketSection {
  kind: FindingKind;
  one: boolean;
}

/** Ties each reason a packet does not parse to the ledger row whose entry broke it, so that row can be retracted and the rest shown. */
export class RowBlame {
  constructor(
    private readonly live: readonly Finding[],
    private readonly sections: Readonly<Record<string, PacketSection>>,
  ) {}

  problems(error: z.ZodError): CheckProblem[] {
    Trace.line(import.meta.url, "RowBlame.problems", { issues: error.issues.length });
    return error.issues.map((issue) => {
      const text = `${issue.path.join(".") || "(root)"}: ${issue.message}`;
      const row = this.rowAt(issue.path);
      return row ? { text, row: { kind: row.kind, key: Findings.identity(row.kind, row.payload, row.id) } } : CheckProblems.of(text);
    });
  }

  private rowAt(path: readonly PropertyKey[]): Finding | undefined {
    Trace.line(import.meta.url, "RowBlame.rowAt", { section: String(path[0] ?? "") });
    const section = this.sections[String(path[0] ?? "")];
    if (!section) return undefined;
    const rows = LatestRows.rows(this.live, section.kind);
    if (section.one) return rows.at(-1);
    return typeof path[1] === "number" ? rows[path[1]] : undefined;
  }
}
