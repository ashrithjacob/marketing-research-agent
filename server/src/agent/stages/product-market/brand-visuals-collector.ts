import type { BrandVisuals, Competitor, Product } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { RunContext } from "../../pipeline/run-context.js";

/** Reads the product shot and logo of the client's product and every confirmed competitor, a few at a time, and stores them; free, and a page that cannot be read just leaves its brand without a picture. */
export class BrandVisualsCollector {
  constructor(
    private readonly visuals: BrandVisuals,
    private readonly concurrency = 4,
  ) {}

  async collect(context: RunContext, product: Product, competitors: readonly Competitor[]): Promise<number> {
    Trace.line(import.meta.url, "BrandVisualsCollector.collect", { competitors: competitors.length });
    const jobs: Array<() => Promise<boolean>> = [
      () => this.one(context, product.url, (visual) => context.store.products.saveVisual(product.id, visual)),
      ...competitors.map((competitor) => () => this.one(context, competitor.url, (visual) => context.store.competitors.saveVisual(competitor.id, visual))),
    ];
    let found = 0;
    const worker = async (): Promise<void> => {
      for (let job = jobs.shift(); job && !context.signal.aborted; job = jobs.shift()) if (await job()) found += 1;
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, jobs.length) }, worker));
    await context.emit("visuals.collected", { found, of: competitors.length + 1 });
    return found;
  }

  private async one(context: RunContext, url: string, save: (visual: { image_url: string | null; logo_url: string | null }) => Promise<void>): Promise<boolean> {
    Trace.line(import.meta.url, "BrandVisualsCollector.one", { url });
    const visual = await this.visuals.find(url, context.signal);
    if (!visual.image_url && !visual.logo_url) return false;
    await save(visual);
    return true;
  }
}
