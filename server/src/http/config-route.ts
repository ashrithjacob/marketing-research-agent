import { stat } from "node:fs/promises";

import type { Hono } from "hono";

import type { Settings } from "../config/index.js";
import { CATEGORY_DELIVERABLE, DEFAULT_REJECTED_KINDS, PRODUCT_DELIVERABLE, type FieldsDeliverable } from "../domain/index.js";
import type { ApiEnv } from "./api-env.js";
import { Trace } from "../trace/index.js";

/** What the cockpit needs to render the run form honestly. */
export class ConfigRoute {
  constructor(private readonly settings: Settings) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "ConfigRoute.register");
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
        required_fields: {
          product_data: ConfigRoute.required(PRODUCT_DELIVERABLE),
          category_data: ConfigRoute.required(CATEGORY_DELIVERABLE),
        },
        review_mining: {
          configured: Boolean(this.settings.apifyToken),
          max_reviews: this.settings.apifyMaxReviews,
        },
      });
    });
  }

  /** The fields a checklist role must fill, from its deliverable. */
  private static required(deliverable: FieldsDeliverable): string[] {
    Trace.line(import.meta.url, "ConfigRoute.required", { node: deliverable.node });
    return deliverable.fields.filter((field) => field.required).map((field) => field.key);
  }
}
