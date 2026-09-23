import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import type { Hono } from "hono";

import type { Settings } from "../config/index.js";
import type { ResearchStore } from "../domain/index.js";

/** The archived raw body, served as text/plain so a scraped page never renders as this origin. */
export class CorpusRoute {
  private static readonly SHA_RE = /^[0-9a-f]{64}$/;

  constructor(
    private readonly store: ResearchStore,
    private readonly settings: Settings,
  ) {}

  register(api: Hono): void {
    api.get("/runs/:runId/sources/:sha", async (c) => {
      const runId = c.req.param("runId");
      const sha = c.req.param("sha");
      if (!this.store.getRun(runId)) return c.json({ detail: "no such run" }, 404);
      if (!CorpusRoute.SHA_RE.test(sha)) return c.json({ detail: "not a source hash" }, 400);

      const root = resolve(join(this.settings.corpusPath, "runs", runId, "sources"));
      const path = resolve(join(root, sha));
      if (!path.startsWith(root + sep)) return c.json({ detail: "not archived" }, 404);

      let body: Buffer;
      try {
        const info = await stat(path);
        if (!info.isFile()) return c.json({ detail: "not archived" }, 404);
        body = await readFile(path);
      } catch {
        return c.json({ detail: "not archived" }, 404);
      }
      const digest = createHash("sha256").update(body).digest("hex");
      return c.body(body.toString("utf-8"), 200, {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Corpus-Digest": digest,
        "X-Corpus-Digest-Matches": digest === sha ? "true" : "false",
        "Content-Security-Policy": "default-src 'none'",
        "X-Content-Type-Options": "nosniff",
      });
    });
  }
}
