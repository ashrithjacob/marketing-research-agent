import type { Context, Hono } from "hono";

import { RunError, type CardDesk } from "../agent/index.js";
import { Scope, type Card } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** The owner settles a card: answers a question, or approves or rejects what an approval holds. */
export class CardRoutes {
  constructor(private readonly cards: CardDesk) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "CardRoutes.register");
    api.post("/cards/:cardId/answer", (c) =>
      this.settle(c, async (scope, cardId) => {
        const body = (await c.req.json().catch(() => null)) as { answer?: unknown } | null;
        const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
        if (!answer) throw new RunError("give the answer: { answer }");
        return this.cards.answer(cardId, scope, answer);
      }),
    );
    api.post("/cards/:cardId/approve", (c) => this.settle(c, (scope, cardId) => this.cards.approve(cardId, scope)));
    api.post("/cards/:cardId/reject", (c) => this.settle(c, (scope, cardId) => this.cards.reject(cardId, scope)));
  }

  private async settle(c: Context<ApiEnv>, work: (scope: Scope, cardId: string) => Promise<Card>) {
    Trace.line(import.meta.url, "CardRoutes.settle", { path: c.req.path });
    try {
      return c.json(await work(Scope.forViewer(c.get("principal")), c.req.param("cardId") ?? ""), 202);
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return c.json({ detail: error.message }, 409);
    }
  }
}
