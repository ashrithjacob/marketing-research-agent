import { FINDING_ROW_PREFIX, type FindingKind } from "./finding-kinds.js";
import { Trace } from "../trace/index.js";

export interface FindingDraft {
  run_id: string;
  kind: FindingKind;
  entity: string;
  agent_id: string;
  source_id: string;
  payload: Record<string, unknown>;
}

export interface Finding extends FindingDraft {
  seq: number;
  id: string;
  created_at: string;
  retracted_at: string;
  retracted_why: string;
}

/** Row ids, and which rows a newer one replaces. */
export class Findings {
  static rowId(kind: FindingKind, seq: number): string {
    Trace.line(import.meta.url, "Findings.rowId", { kind, seq });
    return `${FINDING_ROW_PREFIX[kind]}${seq}`;
  }

  /** Rows of one kind with the same key describe one thing; the newest stands. Null means rows never replace each other. */
  static key(kind: FindingKind, payload: Record<string, unknown>): string | null {
    Trace.line(import.meta.url, "Findings.key", { kind });
    switch (kind) {
      case "source":
      case "competitor":
        return String(payload.id ?? "");
      case "competitor_reference":
        return "reference";
      case "node_status":
        return String(payload.node ?? "");
      case "saturation":
        return `${String(payload.node ?? "")}:${String(payload.class ?? "")}`;
      case "attribute":
        return `${String(payload.node ?? "")}:${String(payload.key ?? "")}`;
      case "measurement":
        return `${String(payload.node ?? "")}:${String(payload.metric ?? "")}:${String(payload.period ?? "")}`;
      case "active":
        return Findings.name(payload.name);
      case "mechanism":
      case "dose_study":
        return Findings.name(payload.active);
      case "claim_limit":
        return `${Findings.name(payload.market)}:${String(payload.platform ?? "")}`;
      case "price_point":
        return Findings.name(payload.label);
      case "regimen":
      case "operator_input":
        return kind;
      default:
        return null;
    }
  }

  /** What one packet entry and the row it came from have in common: the replacement key, or the row id where rows never replace each other. */
  static identity(kind: FindingKind, payload: Record<string, unknown>, rowId: string): string {
    Trace.line(import.meta.url, "Findings.identity", { kind });
    return Findings.key(kind, payload) ?? rowId;
  }

  /** A name as a key: case and surrounding space do not make two things. */
  static name(value: unknown): string {
    Trace.tick(import.meta.url, "Findings.name");
    return String(value ?? "").trim().toLowerCase();
  }

  static live(rows: readonly Finding[]): Finding[] {
    Trace.line(import.meta.url, "Findings.live", { rows: rows.length });
    return rows.filter((row) => row.retracted_at === "");
  }
}
