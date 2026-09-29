import { Hono, type Context } from "hono";

import { StageTwoListings, StageTwoPlanner, type StageTwoHandoff } from "../agent/index.js";
import type { Settings } from "../config/index.js";
import { Briefs, Scope, stageTwoPlanRequestSchema, type ResearchRun, type StagePacket } from "../domain/index.js";
import { StageTwoOffer, StageTwoRoster } from "../extract/index.js";
import type { ApiEnv } from "./api-env.js";
import { Trace } from "../trace/index.js";

/** The stage-2 go-ahead: what stage 1 found, and what mining it costs. */
export class StageTwoRoutes {
  constructor(
    private readonly handoff: StageTwoHandoff,
    private readonly settings: Settings,
    private readonly listings: StageTwoListings,
  ) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "StageTwoRoutes.register");
    api.post("/stage2/plan", async (c) => {
      const found = await this.source(c);
      if ("error" in found) return found.error;
      const roster = StageTwoRoster.of(found.packet);
      const cached = this.listings.judged(found.run.id, roster);
      const offered = StageTwoOffer.of(roster, cached);
      const chosen = StageTwoRoster.select(offered, found.targets);
      const unscored = offered.some((t) => t.trustpilot && cached.some((row) => row.target_id === t.id && !row.trustpilot));
      const lookupNeeded = this.listings.available && (unscored || roster.some((t) => !cached.some((row) => row.target_id === t.id)));
      const plan = roster[0] ? new StageTwoPlanner(this.settings.apifyMaxReviews).plan(roster[0], offered, chosen, found.run.id) : null;
      if (!plan) return c.json({ ready: false, detail: "no target stage 1 found is on Amazon or has its own Trustpilot domain" });
      return c.json({ ready: true, plan, listings: cached, lookup_available: this.listings.available, lookup_needed: lookupNeeded });
    });
    api.post("/stage2/listings", async (c) => {
      const found = await this.source(c);
      if ("error" in found) return found.error;
      if (!this.listings.available) return c.json({ detail: "APIFY_TOKEN is not set, so Amazon cannot be searched" }, 409);
      return c.json({ listings: await this.listings.ensure(found.run.id, StageTwoRoster.of(found.packet)) });
    });
  }

  private async source(
    c: Context<ApiEnv>,
  ): Promise<{ run: ResearchRun; packet: StagePacket; targets: string[] } | { error: Response }> {
    Trace.line(import.meta.url, "StageTwoRoutes.source");
    const parsed = stageTwoPlanRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return { error: c.json({ detail: parsed.error.issues.map((i) => i.message).join("; ") }, 400) };
    }
    const brief = Briefs.normalise(parsed.data.brief);
    const source = this.handoff.forBrief(brief, Scope.of(c.get("principal").workspaceId));
    if (!source) {
      return {
        error: c.json({
          ready: false,
          detail:
            "no stage-1 packet for this subject yet. Run stage 1 for this brief first, " +
            "and let it complete — its packet names the listings stage 2 mines.",
        }),
      };
    }
    return { ...source, targets: parsed.data.targets };
  }
}
