/**
 * Owns a stage-0 run for its whole life.
 *
 * Much smaller than `RunSupervisor` because stage 0 is not a conversation: it is
 * a fixed pipeline of roughly a minute, so there is no steering, no transcript,
 * and no SSE. Progress is appended to the run row and the cockpit polls it.
 *
 * The one thing this shares with `RunSupervisor` is the rule that a run outlives
 * the HTTP request that started it, and that a process which dies mid-run says
 * so rather than leaving a row reading `running` forever. See `recover()`.
 */

import { createAgentAsk } from "./ask.js";
import type { Models } from "@earendil-works/pi-ai";
import { runStageZero, stageZeroParamsSchema, type StageZeroParams } from "./stage0.js";
import type { Settings } from "./settings.js";
import { HttpTrendTrackClient, type TrendTrackClient } from "./trendtrack.js";
import { CachedTrendTrackClient } from "./trendtrack-cache.js";
import { nowIso, type ResearchStore } from "./store.js";

/** Raised when a run cannot be started or stopped. */
export class DiscoveryError extends Error {
  override readonly name = "DiscoveryError";
}

export const DISCOVERY_TERMINAL: ReadonlySet<string> = new Set(["completed", "failed", "cancelled"]);

interface Live {
  controller: AbortController;
  done: Promise<void>;
}

export class DiscoverySupervisor {
  private readonly store: ResearchStore;
  private readonly settings: Settings;
  private readonly models: Models;
  private readonly makeClient: () => TrendTrackClient;
  private readonly live = new Map<string, Live>();

  constructor(options: {
    store: ResearchStore;
    settings: Settings;
    models: Models;
    /** Overridden in tests. Each run gets a fresh client so its ledger is its own. */
    makeClient?: () => TrendTrackClient;
  }) {
    this.store = options.store;
    this.settings = options.settings;
    this.models = options.models;
    this.makeClient =
      options.makeClient ??
      (() =>
        new HttpTrendTrackClient({
          apiKey: this.settings.trendtrackApiKey,
          timeoutSeconds: this.settings.webTimeoutSeconds,
        }));
  }

  /**
   * Wrap a client in the response cache.
   *
   * Applied to whatever `makeClient` returns, including a fake one in tests, so
   * the cached path is the path that gets exercised.
   */
  private cached(delegate: TrendTrackClient): CachedTrendTrackClient {
    return new CachedTrendTrackClient({
      delegate,
      store: this.store,
      maxAgeSeconds: Math.max(0, this.settings.trendtrackCacheDays) * 86400,
    });
  }

  /** True when stage 0 can run at all. The cockpit asks before offering the button. */
  get configured(): boolean {
    return Boolean(this.settings.trendtrackApiKey);
  }

  start(raw: unknown): string {
    const parsed = stageZeroParamsSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      throw new DiscoveryError(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const params = parsed.data;
    if (!this.configured) {
      throw new DiscoveryError("TRENDTRACK_API_KEY is not set — stage 0 cannot run");
    }

    const run = this.store.createDiscoveryRun(params as unknown as Record<string, unknown>);
    const controller = new AbortController();
    const done = this.execute(run.id, params, controller.signal);
    this.live.set(run.id, { controller, done });
    return run.id;
  }

  stop(runId: string): void {
    const live = this.live.get(runId);
    if (!live) throw new DiscoveryError(`discovery run ${runId} is not running here`);
    live.controller.abort();
  }

  isLive(runId: string): boolean {
    return this.live.has(runId);
  }

  /** Await a run's completion. Tests need it; nothing in the HTTP path does. */
  async waitFor(runId: string): Promise<void> {
    await this.live.get(runId)?.done;
  }

  /**
   * Settle runs this process was watching when it stopped.
   *
   * The pipeline lives in this process, so a restart killed it. There is nothing
   * to reconcile against and pretending otherwise would invent an outcome.
   */
  recover(): void {
    for (const run of this.store.listDiscoveryRuns(200)) {
      if (DISCOVERY_TERMINAL.has(run.status)) continue;
      this.store.updateDiscoveryRun(run.id, {
        status: "failed",
        error: "the server restarted while this run was in progress; the run did not survive it",
        ended_at: nowIso(),
      });
    }
  }

  async close(): Promise<void> {
    for (const [, live] of this.live) live.controller.abort();
    await Promise.allSettled([...this.live.values()].map((l) => l.done));
    this.live.clear();
  }

  private async execute(runId: string, params: StageZeroParams, signal: AbortSignal): Promise<void> {
    const client = this.cached(this.makeClient());
    // Expiring rows on the way in keeps the table from growing without bound,
    // and does it on the one code path that cares.
    try {
      const dropped = this.store.pruneCache(
        Math.max(0, this.settings.trendtrackCacheDays) * 86400,
      );
      if (dropped > 0) this.store.addDiscoveryProgress(runId, "cache", { expired: dropped });
    } catch (error) {
      console.error(`discovery run ${runId}: cache prune failed`, error);
    }
    try {
      const result = await runStageZero({
        client,
        params,
        ask: createAgentAsk({
          models: this.models,
          modelId: params.model || this.settings.model,
          // Stable across the run's batches so a cache-aware backend keeps the
          // rubric warm — it is identical in every batch and is most of the prompt.
          sessionId: `discovery-${runId}`,
        }),
        signal,
        onProgress: (step, detail) => {
          try {
            this.store.addDiscoveryProgress(runId, step, detail);
          } catch (error) {
            // Losing one progress line is strictly better than losing the run.
            console.error(`discovery run ${runId}: progress write failed`, error);
          }
        },
      });

      if (signal.aborted) {
        // The partial result is kept: the credits were spent either way, and a
        // half-finished ranking is more use than an empty row.
        this.store.updateDiscoveryRun(runId, {
          status: "cancelled",
          result: result as unknown as Record<string, unknown>,
          error: "stopped by the operator",
          ended_at: nowIso(),
        });
        return;
      }

      this.store.updateDiscoveryRun(runId, {
        status: "completed",
        result: result as unknown as Record<string, unknown>,
        error: "",
        ended_at: nowIso(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`discovery run ${runId}: failed`, error);
      this.store.updateDiscoveryRun(runId, {
        status: signal.aborted ? "cancelled" : "failed",
        // Credits already spent are reported even on failure — the operator is
        // charged for them whether or not the run produced a ranking.
        result: { credits: { ...client.ledger, total: client.ledger.rows + client.ledger.details } },
        error: message,
        ended_at: nowIso(),
      });
    } finally {
      this.live.delete(runId);
    }
  }
}
