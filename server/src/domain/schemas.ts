import { z } from "zod/v4";

import { Trace } from "../trace/index.js";

/** The one place a zod schema becomes something another layer can use: JSON Schema for a tool, or a list of readable problems. */
export class Schemas {
  static json(schema: z.ZodType): Record<string, unknown> {
    Trace.line(import.meta.url, "Schemas.json");
    const { $schema: _dialect, ...rest } = z.toJSONSchema(schema, { target: "draft-7", io: "input" }) as Record<string, unknown>;
    return rest;
  }

  static parse<T>(schema: z.ZodType<T>, value: unknown): { ok: true; value: T } | { ok: false; problems: string[] } {
    Trace.line(import.meta.url, "Schemas.parse");
    const result = schema.safeParse(value);
    if (result.success) return { ok: true, value: result.data };
    return { ok: false, problems: result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`) };
  }
}

export type Schema<T> = z.ZodType<T>;
