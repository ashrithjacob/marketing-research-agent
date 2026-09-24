import { Hono } from "hono";

import { StageTwoPlanner, type StageTwoHandoff } from "../agent/index.js";
import type { Settings } from "../config/index.js";
import { Briefs, stageTwoPlanRequestSchema } from "../domain/index.js";
import { StageTwoRoster } from "../extract/index.js";

/** The stage-2 go-ahead: what stage 1 found, and what mining it costs. */
export class StageTwoRoutes {
  constructor(
    private readonly handoff: StageTwoHandoff,
    private readonly settings: Settings,
  ) {}

  register(api: Hono): void {
    api.post("/stage2/plan", async (c) => {
      const parsed = stageTwoPlanRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) {
        return c.json({ detail: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
      }
      const brief = Briefs.normalise(parsed.data.brief);
      const source = this.handoff.forBrief(brief);
      if (!source) {
        return c.json({
          ready: false,
          detail:
            "no stage-1 packet for this subject yet. Run stage 1 for this brief first, " +
            "and let it complete — its packet names the listings stage 2 mines.",
        });
      }
      const full = StageTwoRoster.of(source.packet);
      const selected = StageTwoRoster.select(full, parsed.data.targets);
      const plan = new StageTwoPlanner(this.settings.apifyMaxReviews).plan(
        selected,
        source.run.id,
      );
      if (!plan) return c.json({ ready: false, detail: "stage-1 packet names no targets" });
      return c.json({ ready: true, plan });
    });
  }
}
