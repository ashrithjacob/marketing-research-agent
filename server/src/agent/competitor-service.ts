import { CompetitorAdditionSchema, FINAL_RUN_STATUSES, Schemas, type Product, type ResearchStore, type Run } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { Refused } from "./analysis-service.js";
import type { CompetitorLauncher } from "./competitor-launcher.js";
import { CompetitorUrlCheck } from "./resolve/competitor-url-check.js";

/** More competitors for a finished run: search for some to propose, or research the ones the user picks, without running the stages again. */
export class CompetitorService {
  constructor(
    private readonly store: ResearchStore,
    private readonly launcher: CompetitorLauncher,
  ) {}

  async search(run: Run): Promise<Run | Refused> {
    Trace.line(import.meta.url, "CompetitorService.search", { runId: run.id });
    const product = await this.finishedProduct(run);
    if ("refused" in product) return product;
    const known = [...new Set([...(await this.store.competitors.list(product.id)).map((c) => c.url), ...(run.resolution?.competitors ?? []).map((c) => c.url)])];
    const started = await this.restart(run, "competitors.search", { known: known.length });
    this.launcher.search(started, product, known);
    return started;
  }

  async add(run: Run, raw: unknown): Promise<Run | Refused> {
    Trace.line(import.meta.url, "CompetitorService.add", { runId: run.id });
    const product = await this.finishedProduct(run);
    if ("refused" in product) return product;
    const parsed = Schemas.parse(CompetitorAdditionSchema, raw);
    if (!parsed.ok) return { refused: parsed.problems };
    const confirmed = new Set((await this.store.competitors.list(product.id)).filter((c) => c.status === "confirmed").map((c) => CompetitorUrlCheck.key(c.url)));
    const already = parsed.value.competitors.filter((pick) => confirmed.has(CompetitorUrlCheck.key(pick.url)) || CompetitorUrlCheck.key(pick.url) === CompetitorUrlCheck.key(product.url));
    if (already.length > 0) return { refused: already.map((pick) => `${pick.url} is already researched in this run`) };
    const added = await this.store.competitors.add(product, parsed.value.competitors);
    const started = await this.restart(run, "competitors.add", { competitors: added.map((c) => c.brand) });
    this.launcher.add(started, product, added);
    return started;
  }

  private async finishedProduct(run: Run): Promise<Product | Refused> {
    Trace.line(import.meta.url, "CompetitorService.finishedProduct", { runId: run.id, status: run.status });
    if (!FINAL_RUN_STATUSES.has(run.status)) return { refused: [`the run is ${run.status}; competitors can be added once it has finished`] };
    if (!run.product_id) return { refused: ["the run never got past confirmation, so it has no product to add competitors to"] };
    return (await this.store.products.get(run.product_id))!;
  }

  private async restart(run: Run, event: string, payload: Record<string, unknown>): Promise<Run> {
    Trace.line(import.meta.url, "CompetitorService.restart", { runId: run.id, event });
    await this.store.runs.updateRun(run.id, { status: "running", error: "", ended_at: null });
    await this.store.events.add(run.id, event, payload);
    return (await this.store.runs.get(run.id))!;
  }
}
