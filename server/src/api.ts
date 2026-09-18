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

import { RunError, RunSupervisor, type EventFrame } from "./runner.js";
import { DEFAULT_REJECTED_KINDS, judgementInSchema, runRequestSchema } from "./schema.js";
import type { Settings } from "./settings.js";
import {
  summary,
  type LlmCall,
  type ResearchRun,
  type ResearchStore,
  type RunEvent,
} from "./store.js";

/**
 * A source id is `sha256:<64 hex>`; the path segment is the bare hash. Anything
 * else never reaches the filesystem — the corpus is written from fetches whose
 * input is the open web, so its ids are untrusted strings.
 */
const SHA_RE = /^[0-9a-f]{64}$/;

export function buildRouter(options: {
  store: ResearchStore;
  supervisor: RunSupervisor;
  settings: Settings;
}): Hono {
  const { store, supervisor, settings } = options;
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

  /**
   * Every LLM call the run made — prompt and answer — with the run's totals.
   *
   * `?after=<seq>` returns only later calls, so a page following a live run
   * fetches each call once rather than the whole trace on every update. The
   * stats always cover the whole run.
   */
  api.get("/runs/:runId/calls", (c) => {
    const run = runOr404(c.req.param("runId"));
    if (!run) return c.json({ detail: "no such run" }, 404);
    const after = Number(c.req.query("after") ?? 0);
    const calls = store.listLlmCalls(run.id);
    const live = supervisor.isLive(run.id);
    return c.json({
      run: { ...summary(run), live },
      stats: callStats(run, calls, store.listEvents(run.id), live),
      calls: Number.isFinite(after) && after > 0 ? calls.filter((call) => call.seq > after) : calls,
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
      // False means the three review tools are withheld and `review_mining`
      // will be gapped — Amazon is unreachable from this host by any other
      // route. Said up front for the same reason as `corpus_mounted`.
      review_mining: {
        configured: Boolean(settings.apifyToken),
        max_reviews: settings.apifyMaxReviews,
      },
    });
  });

  return api;
}

/**
 * The log page's header. Everything here is summed from recorded rows — calls
 * and events — so it can only undercount a run, never flatter it.
 */
export function callStats(
  run: ResearchRun,
  calls: readonly LlmCall[],
  events: readonly RunEvent[],
  live: boolean,
): Record<string, unknown> {
  const sum = (pick: (call: LlmCall) => number | undefined) =>
    calls.reduce((total, call) => total + (pick(call) ?? 0), 0);
  const usage = (call: LlmCall) => call.usage as Record<string, any>;
  const billed = calls.filter((call) => call.billed_cost !== null);
  const toolEnds = events.filter((e) => e.kind === "tool.completed");
  const start = Date.parse(run.created_at);
  const end = run.ended_at ? Date.parse(run.ended_at) : live ? Date.now() : Date.parse(run.updated_at);
  return {
    llm_calls: calls.length,
    llm_errors: calls.filter((call) => call.error !== "").length,
    tokens: {
      input: sum((call) => usage(call).input),
      output: sum((call) => usage(call).output),
      cache_read: sum((call) => usage(call).cacheRead),
      cache_write: sum((call) => usage(call).cacheWrite),
      total: sum((call) => usage(call).totalTokens),
    },
    // Calculated from token counts at the run's rates; see workings.md §2a.
    cost: sum((call) => usage(call).cost?.total),
    billed: {
      total: billed.reduce((total, call) => total + (call.billed_cost ?? 0), 0),
      resolved: billed.length,
    },
    llm_time_ms: sum((call) => call.duration_ms),
    wall_time_ms: Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0,
    tool_calls: toolEnds.length,
    tool_errors: toolEnds.filter((e) => e.payload.error === true).length,
  };
}
