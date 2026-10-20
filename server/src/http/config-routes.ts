import { Hono } from "hono";

import { MARKETS, STAGE_NAMES, STAGE_PLANS, Stages, type StageName } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ApiEnv } from "./api-env.js";

/** What the cockpit needs to draw itself: the model, the markets a user may pick, the seven stages, which of them are built, and what rerunning each one also reruns. */
export class ConfigRoutes {
  constructor(
    private readonly model: string,
    private readonly built: readonly StageName[],
  ) {}

  router(): Hono<ApiEnv> {
    Trace.line(import.meta.url, "ConfigRoutes.router");
    const stages = STAGE_NAMES.map((name) => ({ name, ...STAGE_PLANS[name], built: this.built.includes(name), reruns: this.built.includes(name) ? Stages.downstream(name, this.built) : [] }));
    return new Hono<ApiEnv>().get("/config", (c) => c.json({ model: this.model, markets: MARKETS, stages }));
  }
}
