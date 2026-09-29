import { z } from "zod";

import { attributeSchema, excerptSchema, measurementSchema, sourceSchema } from "./evidence.js";
import {
  competitorReferenceSchema,
  competitorSchema,
  gapSchema,
  nodeStatusSchema,
  saturationSchema,
} from "./packet.js";
import { Trace } from "../trace/index.js";

export const FINDING_KINDS = [
  "source",
  "excerpt",
  "measurement",
  "attribute",
  "competitor",
  "competitor_reference",
  "saturation",
  "node_status",
  "gap",
  "candidate",
] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

export const candidateSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    url: z.string(),
  })
  .strict();

/** Kinds whose packet `id` is the ledger row's id, so the agent never invents one. */
export const CODE_ID_KINDS: ReadonlySet<FindingKind> = new Set(["excerpt", "measurement", "attribute"]);

export const FINDING_SCHEMAS: Readonly<Record<FindingKind, z.ZodTypeAny>> = {
  source: sourceSchema,
  excerpt: excerptSchema.omit({ id: true }),
  measurement: measurementSchema.omit({ id: true }),
  attribute: attributeSchema.omit({ id: true }),
  competitor: competitorSchema,
  competitor_reference: competitorReferenceSchema,
  saturation: saturationSchema,
  node_status: nodeStatusSchema,
  gap: gapSchema,
  candidate: candidateSchema,
};

const ROW_PREFIX: Readonly<Record<FindingKind, string>> = {
  source: "src",
  excerpt: "ex",
  measurement: "me",
  attribute: "at",
  competitor: "co",
  competitor_reference: "ref",
  saturation: "sat",
  node_status: "ns",
  gap: "gap",
  candidate: "cand",
};

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
    return `${ROW_PREFIX[kind]}${seq}`;
  }

  /** Rows of one kind with the same key describe one thing; the newest stands. Null means rows never replace each other. */
  static key(kind: FindingKind, payload: Record<string, unknown>): string | null {
    Trace.line(import.meta.url, "Findings.key", { kind });
    switch (kind) {
      case "source":
      case "competitor":
      case "candidate":
        return String(payload.id ?? "");
      case "competitor_reference":
        return "reference";
      case "node_status":
        return String(payload.node ?? "");
      case "saturation":
        return `${String(payload.node ?? "")}:${String(payload.class ?? "")}`;
      default:
        return null;
    }
  }

  static live(rows: readonly Finding[]): Finding[] {
    Trace.line(import.meta.url, "Findings.live", { rows: rows.length });
    return rows.filter((row) => row.retracted_at === "");
  }
}
