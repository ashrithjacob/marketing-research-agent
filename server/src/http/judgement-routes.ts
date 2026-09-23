import type { Hono } from "hono";

import { type ResearchStore, judgementInSchema } from "../domain/index.js";

/** The standing source rules a human can add or remove. */
export class JudgementRoutes {
  constructor(private readonly store: ResearchStore) {}

  register(api: Hono): void {
    api.get("/judgements", (c) => c.json({ data: this.store.listJudgements() }));

    api.post("/judgements", async (c) => {
      const parsed = judgementInSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success || !parsed.data.text.trim()) {
        return c.json({ detail: "judgement text is required" }, 400);
      }
      return c.json(
        this.store.addJudgement({
          kind: parsed.data.kind,
          text: parsed.data.text.trim(),
          rejects_kinds: parsed.data.rejects_kinds,
        }),
      );
    });

    api.delete("/judgements/:judgementId", (c) => {
      this.store.deleteJudgement(c.req.param("judgementId"));
      return c.json({ ok: true });
    });
  }
}
