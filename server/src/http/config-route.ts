import { stat } from "node:fs/promises";

import type { Hono } from "hono";

import type { Settings } from "../config/index.js";
import { DEFAULT_REJECTED_KINDS } from "../domain/index.js";

/** What the cockpit needs to render the run form honestly. */
export class ConfigRoute {
  constructor(private readonly settings: Settings) {}

  register(api: Hono): void {
    api.get("/config", async (c) => {
      let corpusMounted = false;
      try {
        corpusMounted = (await stat(this.settings.corpusPath)).isDirectory();
      } catch {
        corpusMounted = false;
      }
      return c.json({
        default_reject_kinds: [...DEFAULT_REJECTED_KINDS],
        model: this.settings.model,
        corpus_path: this.settings.corpusPath,
        corpus_mounted: corpusMounted,
        review_mining: {
          configured: Boolean(this.settings.apifyToken),
          max_reviews: this.settings.apifyMaxReviews,
        },
      });
    });
  }
}
