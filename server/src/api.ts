/**
 * `/api/research/*` — the cockpit's surface.
 *
 * Mounted onto the app by `createApp`, behind the same auth middleware as
 * everything else. A tab, not a second product.
 */

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { DiscoveryError, DiscoverySupervisor } from "./discovery.js";
import { RunError, RunSupervisor, type EventFrame } from "./runner.js";
import { DEFAULT_REJECTED_KINDS, judgementInSchema, runRequestSchema } from "./schema.js";
import type { Settings } from "./settings.js";
import { BIG_FIVE, MIN_TRUSTPILOT_RATING, stageZeroParamsSchema } from "./stage0.js";
import { summary, type ResearchStore } from "./store.js";

/**
 * A source id is `sha256:<64 hex>`; the path segment is the bare hash. Anything
 * else never reaches the filesystem — the corpus is written from fetches whose
 * input is the open web, so its ids are untrusted strings.
 */
const SHA_RE = /^[0-9a-f]{64}$/;

export function buildRouter(options: {
  store: ResearchStore;
  supervisor: RunSupervisor;
  discovery: DiscoverySupervisor;
  settings: Settings;
}): Hono {
  const { store, supervisor, discovery, settings } = options;
  const api = new Hono();

  const runOr404 = (runId: string) => {
    const run = store.getRun(runId);
    if (!run) return null;
    return run;
  };

  // -- runs -------------------------------------------------------------

  api.get("/runs", (c) => {
    const limit = Number(c.req.query("limit") ?? 50);
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
    return c.json({ data: store.listRuns(safeLimit).map(summary) });
  });

  api.post("/runs", async (c) => {
    const parsed = runRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ detail: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
    }
    if (!parsed.data.brief.product.trim()) {
      return c.json({ detail: "brief.product is required" }, 400);
    }
    let runId: string;
    try {
      runId = supervisor.start(parsed.data);
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      // 502: the run record exists and is marked failed, so the UI can show
      // what happened rather than losing the attempt.
      return c.json({ detail: error.message }, 502);
    }
    const run = store.getRun(runId);
    return c.json(run ? summary(run) : { detail: "run vanished" }, run ? 200 : 500);
  });

  api.get("/runs/:runId", (c) => {
    const run = runOr404(c.req.param("runId"));
    if (!run) return c.json({ detail: "no such run" }, 404);
    return c.json({
      ...summary(run),
      packet: run.packet,
      output: run.output,
      reject_kinds: run.reject_kinds,
      live: supervisor.isLive(run.id),
    });
  });

  /**
   * Replay from `after`, then follow live.
   *
   * Subscribing *before* replaying is what closes the gap: an event landing
   * between the two arrives on the queue and is deduped by id, rather than
   * being missed entirely.
   */
  api.get("/runs/:runId/events", (c) => {
    const runId = c.req.param("runId");
    if (!runOr404(runId)) return c.json({ detail: "no such run" }, 404);
    const after = Number(c.req.query("after") ?? 0);
    const from = Number.isFinite(after) ? after : 0;

    return streamSSE(c, async (stream) => {
      const pending: Array<EventFrame | null> = [];
      let wake: (() => void) | null = null;
      const unsubscribe = supervisor.subscribe(runId, (frame) => {
        pending.push(frame);
        wake?.();
      });

      let last = from;
      try {
        for (const event of store.listEvents(runId, last)) {
          last = event.id;
          await stream.writeSSE({
            event: "event",
            data: JSON.stringify({
              id: event.id,
              kind: event.kind,
              payload: event.payload,
              created_at: event.created_at,
            }),
          });
        }
        if (!unsubscribe) {
          // Finished (or never started here). The replay above is the whole story.
          await stream.writeSSE({ event: "end", data: JSON.stringify({ reason: "not live" }) });
          return;
        }
        for (;;) {
          if (pending.length === 0) {
            // Caddy needs `flush_interval -1` for SSE; the keepalive is also how
            // a dead client is noticed — the write throws once it has gone.
            const woken = await Promise.race([
              new Promise<boolean>((r) => {
                wake = () => r(true);
              }),
              new Promise<boolean>((r) => setTimeout(() => r(false), 20000)),
            ]);
            wake = null;
            if (!woken) {
              await stream.writeSSE({ event: "keepalive", data: "" });
              continue;
            }
          }
          const frame = pending.shift();
          if (frame === undefined) continue;
          if (frame === null) {
            await stream.writeSSE({
              event: "end",
              data: JSON.stringify({ reason: "run finished" }),
            });
            return;
          }
          if (frame.id <= last) continue; // already replayed
          last = frame.id;
          await stream.writeSSE({ event: "event", data: JSON.stringify(frame) });
        }
      } finally {
        unsubscribe?.();
      }
    });
  });

  api.post("/runs/:runId/steer", async (c) => {
    const runId = c.req.param("runId");
    if (!runOr404(runId)) return c.json({ detail: "no such run" }, 404);
    const parsed = judgementInSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success || !parsed.data.text.trim()) {
      return c.json({ detail: "judgement text is required" }, 400);
    }
    // Stored first: a correction the human made is worth keeping even if the
    // run it was aimed at has just ended.
    const judgement = store.addJudgement({
      kind: parsed.data.kind,
      text: parsed.data.text.trim(),
      rejects_kinds: parsed.data.rejects_kinds,
    });
    try {
      supervisor.steer(runId, judgement);
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return c.json({ detail: error.message }, 409);
    }
    return c.json(judgement);
  });

  api.post("/runs/:runId/stop", (c) => {
    const runId = c.req.param("runId");
    if (!runOr404(runId)) return c.json({ detail: "no such run" }, 404);
    try {
      supervisor.stop(runId);
    } catch (error) {
      if (!(error instanceof RunError)) throw error;
      return c.json({ detail: error.message }, 409);
    }
    return c.json({ ok: true });
  });

  // -- corpus -----------------------------------------------------------

  /**
   * The archived raw body, for checking a span against its source.
   *
   * Served as text/plain unconditionally. The corpus is fetched from the open
   * web; handing a browser something it would render as HTML from our own
   * origin is how a scraped page becomes a script on this domain.
   */
  api.get("/runs/:runId/sources/:sha", async (c) => {
    const runId = c.req.param("runId");
    const sha = c.req.param("sha");
    if (!runOr404(runId)) return c.json({ detail: "no such run" }, 404);
    if (!SHA_RE.test(sha)) return c.json({ detail: "not a source hash" }, 400);

    const root = resolve(join(settings.corpusPath, "runs", runId, "sources"));
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
      // Whether the file still hashes to its id is the audit, so say it rather
      // than making the caller recompute it.
      "X-Corpus-Digest": digest,
      "X-Corpus-Digest-Matches": digest === sha ? "true" : "false",
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff",
    });
  });

  // -- discovery (stage 0) ----------------------------------------------

  /**
   * The list view. Results are large — a 500-row discovery carries every
   * surviving shop and its scored products — so the row here is a header and
   * the ranking is fetched per run.
   */
  api.get("/discovery", (c) => {
    const limit = Number(c.req.query("limit") ?? 25);
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 25;
    return c.json({
      data: store.listDiscoveryRuns(safeLimit).map((run) => {
        const result = (run.result ?? {}) as Record<string, any>;
        return {
          id: run.id,
          status: run.status,
          error: run.error,
          created_at: run.created_at,
          updated_at: run.updated_at,
          ended_at: run.ended_at,
          credits: result.credits ?? null,
          shops: (result.shops ?? []).length,
          products: (result.products ?? []).length,
        };
      }),
    });
  });

  api.post("/discovery", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    let runId: string;
    try {
      runId = discovery.start(body);
    } catch (error) {
      if (!(error instanceof DiscoveryError)) throw error;
      // 400, not 502: every way this throws is a bad parameter or a missing
      // key, both of which the operator can act on.
      return c.json({ detail: error.message }, 400);
    }
    const run = store.getDiscoveryRun(runId);
    return c.json(run ? { ...run, live: discovery.isLive(runId) } : { detail: "run vanished" }, run ? 200 : 500);
  });

  /**
   * What the response cache holds, and a way to empty it.
   *
   * The DELETE exists because a cache is a promise that yesterday's answer is
   * still good enough, and the operator is the only one who knows when it
   * isn't. Everything it drops has to be bought again, so it says how much.
   *
   * **Registered before `/discovery/:runId`, and it has to be.** Hono matches
   * in registration order, so with these two swapped `/discovery/cache` is a
   * run lookup for a run called "cache" and answers 404.
   */
  api.get("/discovery/cache", (c) =>
    c.json({ ...store.cacheStats(), max_age_days: settings.trendtrackCacheDays }),
  );

  api.delete("/discovery/cache", (c) => {
    const before = store.cacheStats();
    return c.json({ dropped: store.clearCache(), credits_to_rebuy: before.creditsStored });
  });

  api.get("/discovery/:runId", (c) => {
    const run = store.getDiscoveryRun(c.req.param("runId"));
    if (!run) return c.json({ detail: "no such discovery run" }, 404);
    return c.json({ ...run, live: discovery.isLive(run.id) });
  });

  api.post("/discovery/:runId/stop", (c) => {
    const runId = c.req.param("runId");
    if (!store.getDiscoveryRun(runId)) return c.json({ detail: "no such discovery run" }, 404);
    try {
      discovery.stop(runId);
    } catch (error) {
      if (!(error instanceof DiscoveryError)) throw error;
      return c.json({ detail: error.message }, 409);
    }
    return c.json({ ok: true });
  });

  // -- judgements -------------------------------------------------------

  api.get("/judgements", (c) => c.json({ data: store.listJudgements() }));

  api.post("/judgements", async (c) => {
    const parsed = judgementInSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success || !parsed.data.text.trim()) {
      return c.json({ detail: "judgement text is required" }, 400);
    }
    return c.json(
      store.addJudgement({
        kind: parsed.data.kind,
        text: parsed.data.text.trim(),
        rejects_kinds: parsed.data.rejects_kinds,
      }),
    );
  });

  api.delete("/judgements/:judgementId", (c) => {
    store.deleteJudgement(c.req.param("judgementId"));
    return c.json({ ok: true });
  });

  // -- config -----------------------------------------------------------

  /** What the cockpit needs to render the run form honestly. */
  api.get("/config", async (c) => {
    let corpusMounted = false;
    try {
      corpusMounted = (await stat(settings.corpusPath)).isDirectory();
    } catch {
      corpusMounted = false;
    }
    return c.json({
      default_reject_kinds: [...DEFAULT_REJECTED_KINDS],
      model: settings.model,
      corpus_path: settings.corpusPath,
      // False means every source will come back `archived: false` and the run
      // will be full of gaps. Better said up front than discovered.
      corpus_mounted: corpusMounted,
      // Stage 0 costs TrendTrack credits per row, so the cockpit says what a run
      // will cost and whether it can run at all before offering the button.
      stage0: {
        configured: discovery.configured,
        defaults: stageZeroParamsSchema.parse({}),
        big_five: [...BIG_FIVE],
        min_trustpilot_rating: MIN_TRUSTPILOT_RATING,
        cache_days: settings.trendtrackCacheDays,
        cache: store.cacheStats(),
      },
    });
  });

  return api;
}
