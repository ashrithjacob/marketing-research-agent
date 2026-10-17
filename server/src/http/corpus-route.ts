import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import type { Hono } from "hono";

import type { Settings } from "../config/index.js";
import { Scope, type ResearchRun, type ResearchStore } from "../domain/index.js";
import type { ApiEnv } from "./api-env.js";
import { Trace } from "../trace/index.js";

/** The archived raw body, served as text/plain so a scraped page never renders as this origin. */
export class CorpusRoute {
  private static readonly SHA_RE = /^[0-9a-f]{64}$/;

  constructor(
    private readonly store: ResearchStore,
    private readonly settings: Settings,
  ) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "CorpusRoute.register");
    api.get("/runs/:runId/sources/:sha", async (c) => {
      const run = await this.store.getRun(c.req.param("runId"));
      const sha = c.req.param("sha");
      if (!run) return c.json({ detail: "no such run" }, 404);
      if (!CorpusRoute.SHA_RE.test(sha)) return c.json({ detail: "not a source hash" }, 400);
      const body = await this.archived(run, sha);
      if (!body) return c.json({ detail: "not archived" }, 404);
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

  /** The page as this run archived it, or, for a source the run cites but an earlier run of its workspace fetched, that run's copy: the file is named by the hash of its body. */
  private async archived(run: ResearchRun, sha: string): Promise<Buffer | null> {
    Trace.line(import.meta.url, "CorpusRoute.archived", { runId: run.id });
    const own = await this.read(run.id, sha);
    if (own) return own;
    const sources = (run.packet as { sources?: Array<{ id?: unknown }> } | null)?.sources ?? [];
    if (!sources.some((source) => source.id === `sha256:${sha}`)) return null;
    for (const earlier of await this.store.listRuns(Scope.of(run.workspace_id), 200)) {
      const copy = earlier.id === run.id ? null : await this.read(earlier.id, sha);
      if (copy) return copy;
    }
    return null;
  }

  private async read(runId: string, sha: string): Promise<Buffer | null> {
    Trace.line(import.meta.url, "CorpusRoute.read", { runId });
    const root = resolve(join(this.settings.corpusPath, "runs", runId, "sources"));
    const path = resolve(join(root, sha));
    if (!path.startsWith(root + sep)) return null;
    try {
      return (await stat(path)).isFile() ? await readFile(path) : null;
    } catch {
      return null;
    }
  }
}
