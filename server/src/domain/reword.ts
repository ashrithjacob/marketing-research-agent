import { z } from "zod";

/** The four parts the verdict is laid out in, in order, each with the heading the owner reads. */
export const VERDICT_SECTIONS = [
  { key: "stands", title: "Where it stands" },
  { key: "change", title: "What has to change" },
  { key: "from_you", title: "What we need from you" },
  { key: "would_change", title: "What would change this verdict" },
] as const;

const verdictSectionsSchema = z
  .object({ stands: z.string().min(1), change: z.string(), from_you: z.string(), would_change: z.string() })
  .strict();

/** The judge model's rewrites of the owner-facing fields: one plain text per field key, and the verdict in its four parts. */
export const rewordsSchema = z
  .object({
    rewrites: z.array(z.object({ key: z.string().min(1), text: z.string().min(1) }).strict()).min(1),
    verdict: verdictSectionsSchema.optional(),
  })
  .strict();
export type Rewords = z.infer<typeof rewordsSchema>;
