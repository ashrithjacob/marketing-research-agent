import type { StoredAd } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** Ads whose copy is the same once case, spacing and punctuation are set aside: one script run many times, often from several pages. The first ad of each is the one read. */
export class AdScripts {
  static group<T extends Pick<StoredAd, "copy">>(ads: readonly T[]): T[][] {
    Trace.line(import.meta.url, "AdScripts.group", { ads: ads.length });
    const scripts = new Map<string, T[]>();
    for (const ad of ads) {
      const key = AdScripts.key(ad.copy);
      scripts.set(key, [...(scripts.get(key) ?? []), ad]);
    }
    return [...scripts.values()];
  }

  private static key(copy: string): string {
    Trace.tick(import.meta.url, "AdScripts.key");
    return copy.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  }
}
