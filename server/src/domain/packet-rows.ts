import type { z } from "zod";

import { attributeSchema, excerptSchema, measurementSchema, sourceSchema } from "./evidence.js";
import { competitorSchema, gapSchema } from "./packet.js";
import { Trace } from "../trace/index.js";

export interface PacketRowSet {
  sources: z.infer<typeof sourceSchema>[];
  attributes: z.infer<typeof attributeSchema>[];
  measurements: z.infer<typeof measurementSchema>[];
  excerpts: z.infer<typeof excerptSchema>[];
  competitors: z.infer<typeof competitorSchema>[];
  gaps: z.infer<typeof gapSchema>[];
}

export type StoredPacketRows = {
  [K in keyof PacketRowSet]: Array<PacketRowSet[K][number] & { run_id: string }>;
};

/** Splits a packet into its rows, keeping each row that passes its own schema. */
export class PacketRows {
  static of(packet: unknown): PacketRowSet {
    Trace.line(import.meta.url, "PacketRows.of", { packet });
    const body = (packet && typeof packet === "object" ? packet : {}) as Record<string, unknown>;
    return {
      sources: PacketRows.valid(body.sources, sourceSchema),
      attributes: PacketRows.valid(body.attributes, attributeSchema),
      measurements: PacketRows.valid(body.measurements, measurementSchema),
      excerpts: PacketRows.valid(body.excerpts, excerptSchema),
      competitors: PacketRows.valid(body.competitors, competitorSchema),
      gaps: PacketRows.valid(body.gaps, gapSchema),
    };
  }

  private static valid<S extends z.ZodTypeAny>(rows: unknown, schema: S): z.infer<S>[] {
    Trace.line(import.meta.url, "PacketRows.valid", { rows, schema });
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((row) => {
      const parsed = schema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    });
  }
}
