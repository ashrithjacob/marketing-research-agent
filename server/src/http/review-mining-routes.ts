import { Hono, type Context } from "hono";

import { ReviewMiningListings, ReviewMiningPlanner, type StageOneHandoff } from "../agent/index.js";
import type { Settings } from "../config/index.js";
import { Briefs, Scope, reviewMiningPlanRequestSchema, type ResearchRun, type StagePacket } from "../domain/index.js";
import { ReviewMiningOffer, ReviewMiningRoster } from "../extract/index.js";
import type { ApiEnv } from "./api-env.js";
import { Trace } from "../trace/index.js";

/** The review-mining go-ahead: what stage 1 found, and what mining it costs. */
export class ReviewMiningRoutes {
  constructor(
    private readonly handoff: StageOneHandoff,
    private readonly settings: Settings,
    private readonly listings: ReviewMiningListings,
  ) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "ReviewMiningRoutes.register");
    api.post("/review-mining/plan", async (c) => {
      const found = await this.source(c);
      if ("error" in found) return found.error;
      const roster = ReviewMiningRoster.of(found.packet);
      const cached = await this.listings.judged(found.run.id, roster);
      const offered = ReviewMiningOffer.of(roster, cached);
      const chosen = ReviewMiningRoster.select(offered, found.targets);
      const unscored = offered.some((t) => t.trustpilot && cached.some((row) => row.target_id === t.id && !row.trustpilot));
      const lookupNeeded = this.listings.available && (unscored || roster.some((t) => !cached.some((row) => row.target_id === t.id)));
      const plan = roster[0] ? new ReviewMiningPlanner(this.settings.apifyMaxReviews).plan(roster[0], offered, chosen, found.run.id) : null;
      if (!plan) return c.json({ ready: false, detail: "no target stage 1 found is on Amazon or has its own Trustpilot domain" });
      return c.json({ ready: true, plan, listings: cached, lookup_available: this.listings.available, lookup_needed: lookupNeeded });
    });
    api.post("/review-mining/listings", async (c) => {
      const found = await this.source(c);
      if ("error" in found) return found.error;
      if (!this.listings.available) return c.json({ detail: "APIFY_TOKEN is not set, so Amazon cannot be searched" }, 409);
      return c.json({ listings: await this.listings.ensure(found.run.id, ReviewMiningRoster.of(found.packet)) });
    });
  }

  private async source(
    c: Context<ApiEnv>,
  ): Promise<{ run: ResearchRun; packet: StagePacket; targets: string[] } | { error: Response }> {
    Trace.line(import.meta.url, "ReviewMiningRoutes.source");
    const parsed = reviewMiningPlanRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return { error: c.json({ detail: parsed.error.issues.map((i) => i.message).join("; ") }, 400) };
    }
    const brief = Briefs.normalise(parsed.data.brief);
    const source = await this.handoff.forBrief(brief, Scope.of(c.get("principal").workspaceId));
    if (!source) {
      return {
        error: c.json({
          ready: false,
          detail:
            "no stage-1 packet for this subject yet. Run stage 1 for this brief first, " +
            "and let it complete — its packet names the listings review mining mines.",
        }),
      };
    }
    if (!(await this.handoff.hasCompleted(2, source.run.id, Scope.of(c.get("principal").workspaceId)))) {
      return {
        error: c.json({
          ready: false,
          detail: "review mining starts once product truth (stage 2) has completed on the stage-1 run it mines. Run product truth first.",
        }),
      };
    }
    return { ...source, targets: parsed.data.targets };
  }
}
