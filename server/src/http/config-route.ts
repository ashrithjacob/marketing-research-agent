import { stat } from "node:fs/promises";

import type { Hono } from "hono";

import type { Settings } from "../config/index.js";
import { BREAKING_POINT_DELIVERABLE, CATEGORY_DELIVERABLE, DEFAULT_REJECTED_KINDS, GATE_DELIVERABLE, MARKET_SIZE_DELIVERABLE, OFFERS_DELIVERABLE, PRODUCT_DELIVERABLE, SOPHISTICATION_DELIVERABLE, type FieldsDeliverable } from "../domain/index.js";
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
          ...Object.fromEntries([MARKET_SIZE_DELIVERABLE, OFFERS_DELIVERABLE, SOPHISTICATION_DELIVERABLE, BREAKING_POINT_DELIVERABLE, GATE_DELIVERABLE].map((d) => [d.node, ConfigRoute.required(d)])),
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
