import type { Hono, MiddlewareHandler } from "hono";

import { Scope, type ResearchStore } from "../domain/index.js";

import type { ApiEnv } from "./api-env.js";
import { Trace } from "../trace/index.js";

/** 404s every run and product path outside the caller's workspace, once, so no route can forget to. */
export class ScopeGuard {
  constructor(private readonly store: ResearchStore) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "ScopeGuard.register");
    const run: MiddlewareHandler<ApiEnv> = async (c, next) => {
      const found = this.store.getRun(c.req.param("runId") ?? "");
      if (!found || !Scope.forViewer(c.get("principal")).admits(found.workspace_id)) {
        return c.json({ detail: "no such run" }, 404);
      }
      await next();
    };
    const product: MiddlewareHandler<ApiEnv> = async (c, next) => {
      const scope = Scope.forViewer(c.get("principal"));
      if (!this.store.products.get(c.req.param("productId") ?? "", scope)) {
        return c.json({ detail: "no such product" }, 404);
      }
      await next();
    };
    api.use("/runs/:runId", run);
    api.use("/runs/:runId/*", run);
    api.use("/products/:productId", product);
    api.use("/products/:productId/*", product);
  }
}
