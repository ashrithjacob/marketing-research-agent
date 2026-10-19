import type { BrandVisual, BrandVisualCache, BrandVisuals } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** Reads a page's visuals once: a url cached with a product shot is answered from the cache; one never read, or cached without a product shot, is read again (free) and remembered when it gave anything. */
export class CachedVisuals implements BrandVisuals {
  constructor(
    private readonly inner: BrandVisuals,
    private readonly cache: BrandVisualCache,
  ) {}

  async find(url: string, signal?: AbortSignal): Promise<BrandVisual> {
    Trace.line(import.meta.url, "CachedVisuals.find", { url });
    const held = (await this.cache.get([url])).get(url);
    if (held?.image_url) return held;
    const visual = await this.inner.find(url, signal);
    if (visual.image_url || visual.logo_url) await this.cache.put(url, visual);
    return visual;
  }
}
