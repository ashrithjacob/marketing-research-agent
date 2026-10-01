import type { FindingKind } from "./finding-kinds.js";
import { Findings } from "./findings.js";
import { Trace } from "../trace/index.js";

export interface RowRef {
  kind: FindingKind;
  key: string;
}

export interface CheckProblem {
  text: string;
  row: RowRef | null;
}

/** A contract problem, tied to the ledger row it is about when one row is the cause. */
export class CheckProblems {
  static of(text: string): CheckProblem {
    Trace.line(import.meta.url, "CheckProblems.of");
    return { text, row: null };
  }

  static at(kind: FindingKind, entry: object, text: string): CheckProblem {
    Trace.line(import.meta.url, "CheckProblems.at", { kind });
    const payload = entry as Record<string, unknown>;
    return { text, row: { kind, key: Findings.identity(kind, payload, String(payload.id ?? "")) } };
  }

  static texts(problems: readonly CheckProblem[]): string[] {
    Trace.line(import.meta.url, "CheckProblems.texts", { problems: problems.length });
    return problems.map((problem) => problem.text);
  }
}
