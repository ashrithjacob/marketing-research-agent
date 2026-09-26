import type { Hono } from "hono";

import { type ResearchStore, Scope, judgementInSchema } from "../domain/index.js";
import type { ApiEnv } from "./api-env.js";
import { Trace } from "../trace/index.js";

/** The standing source rules a human can add or remove, always those of the caller's own workspace. */
export class JudgementRoutes {
  constructor(private readonly store: ResearchStore) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "JudgementRoutes.register");
    api.get("/judgements", (c) =>
      c.json({ data: this.store.listJudgements(Scope.of(c.get("principal").workspaceId)) }),
    );

    api.post("/judgements", async (c) => {
      const parsed = judgementInSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success || !parsed.data.text.trim()) {
        return c.json({ detail: "judgement text is required" }, 400);
      }
      return c.json(
        this.store.addJudgement(c.get("principal").workspaceId, {
          kind: parsed.data.kind,
          text: parsed.data.text.trim(),
          rejects_kinds: parsed.data.rejects_kinds,
        }),
      );
    });

    api.delete("/judgements/:judgementId", (c) => {
      const scope = Scope.of(c.get("principal").workspaceId);
      if (!this.store.deleteJudgement(scope, c.req.param("judgementId"))) {
        return c.json({ detail: "no such judgement" }, 404);
      }
      return c.json({ ok: true });
    });
  }
}
