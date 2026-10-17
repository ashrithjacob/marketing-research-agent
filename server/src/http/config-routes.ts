import { Hono } from "hono";

import { MARKETS, STAGE_NAMES, STAGE_PLANS, type StageName } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** What the cockpit needs to draw itself: the model, the markets a user may pick, the seven stages and which of them are built. */
export class ConfigRoutes {
  constructor(
    private readonly model: string,
    private readonly built: readonly StageName[],
  ) {}

  router(): Hono<ApiEnv> {
    Trace.line(import.meta.url, "ConfigRoutes.router");
    const stages = STAGE_NAMES.map((name) => ({ name, ...STAGE_PLANS[name], built: this.built.includes(name) }));
    return new Hono<ApiEnv>().get("/config", (c) => c.json({ model: this.model, markets: MARKETS, stages }));
  }
}
