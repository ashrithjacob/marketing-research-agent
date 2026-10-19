import type { BrandVisuals, Resolution } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** Reads the product shot and logo of everything the resolver proposed, before the user is asked to choose; free, a few pages at a time. */
export class ResolutionVisuals {
  constructor(
    private readonly visuals: BrandVisuals,
    private readonly concurrency = 6,
  ) {}

  async collect(resolution: Resolution, signal: AbortSignal): Promise<number> {
    Trace.line(import.meta.url, "ResolutionVisuals.collect", { competitors: resolution.competitors.length });
    const urls = [...new Set([resolution.product.url, ...resolution.alternatives.map((a) => a.url), ...resolution.competitors.map((c) => c.url)])];
    let found = 0;
    const worker = async (): Promise<void> => {
      for (let url = urls.shift(); url && !signal.aborted; url = urls.shift()) {
        const visual = await this.visuals.find(url, signal);
        if (visual.image_url || visual.logo_url) found += 1;
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, urls.length) }, worker));
    return found;
  }
}
