import { Hono, type Context } from "hono";

import type { AnalysisService } from "../agent/index.js";
import { Scope, type ResearchStore, type Run } from "../domain/index.js";
import { AdsAnalyzer } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** What a run's evidence stages stored: review coverage and a page of reviews per target, the long-form statics with their readings and the analysis counted over them, and the avatars with their quotes. */
export class EvidenceRoutes {
  static readonly MAX_PAGE = 100;

  constructor(
    private readonly store: ResearchStore,
    private readonly analyses: AnalysisService,
  ) {}

  router(): Hono<ApiEnv> {
    Trace.line(import.meta.url, "EvidenceRoutes.router");
    const api = new Hono<ApiEnv>();
    api.get("/runs/:runId/reviews", async (c) =>
      this.withProduct(c, async (productId) => {
        const competitor = c.req.query("competitor") || null;
        const limit = Math.min(Number(c.req.query("limit") ?? 20) || 20, EvidenceRoutes.MAX_PAGE);
        const offset = Math.max(Number(c.req.query("offset") ?? 0) || 0, 0);
        return c.json({
          coverage: await this.store.reviews.coverage(productId),
          reviews: await this.store.reviews.list(productId, competitor, limit, offset),
        });
      }),
    );
    api.get("/runs/:runId/ads", async (c) => this.withProduct(c, async () => c.json({ ads: await this.store.ads.list(c.req.param("runId") ?? "") })));
    api.get("/runs/:runId/ads/analysis", async (c) =>
      this.withProduct(c, async (productId, run) => {
        const product = await this.store.products.get(productId);
        const [ads, angles, findings] = await Promise.all([this.store.ads.list(run.id), this.store.adAnalysis.angles(run.id), this.store.adAnalysis.findings(run.id)]);
        const claims = (product?.claims_on_page ?? []).map((claim) => claim.text);
        return c.json({ analysis: AdsAnalyzer.analyze(ads, angles, findings, claims, run.created_at.slice(0, 10)) });
      }),
    );
    api.get("/runs/:runId/market", async (c) => this.withProduct(c, async () => c.json({ market: await this.store.market.get(c.req.param("runId") ?? "") })));
    api.get("/runs/:runId/avatars", async (c) =>
      this.withProduct(c, async () => {
        const runId = c.req.param("runId") ?? "";
        return c.json({ avatars: await this.store.avatars.list(runId), quotes: await this.store.avatars.quotes(runId) });
      }),
    );
    return api;
  }

  private async withProduct(c: Context<ApiEnv>, work: (productId: string, run: Run) => Promise<Response>): Promise<Response> {
    Trace.line(import.meta.url, "EvidenceRoutes.withProduct", { runId: c.req.param("runId") });
    const run: Run | null = await this.analyses.get(c.req.param("runId") ?? "", Scope.forViewer(c.get("principal")));
    if (!run) return c.json({ detail: "no such run" }, 404);
    if (!run.product_id) return c.json({ detail: "the run has no confirmed product yet" }, 409);
    return work(run.product_id, run);
  }
}
