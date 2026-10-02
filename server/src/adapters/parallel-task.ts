import { ServiceUnavailableError } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ParallelApi } from "./parallel-api.js";

const DONE = new Set(["completed", "failed", "cancelled"]);

/** One Parallel Task API run from creation to result: Parallel researches on its own side, we only poll its status, and a status read that fails in transit is asked again. */
export class ParallelTask {
  constructor(
    private readonly api: ParallelApi,
    private readonly pollMs: number,
    private readonly timeoutSeconds: number,
  ) {}

  async run(body: Record<string, unknown>, signal?: AbortSignal): Promise<{ runId: string; result: Record<string, unknown> }> {
    Trace.line(import.meta.url, "ParallelTask.run", { processor: body.processor });
    const created = await this.api.post("/v1/tasks/runs", body, {}, signal);
    const runId = String(created.run_id ?? "");
    if (!runId) throw new Error(`Parallel created no task run: ${JSON.stringify(created).slice(0, 200)}`);
    const status = await this.settled(runId, signal);
    if (status !== "completed") throw new Error(`Parallel task run ${runId} ended ${status}`);
    return { runId, result: await this.api.get(`/v1/tasks/runs/${runId}/result`, signal) };
  }

  private async settled(runId: string, signal?: AbortSignal): Promise<string> {
    Trace.line(import.meta.url, "ParallelTask.settled", { runId });
    const deadline = Date.now() + this.timeoutSeconds * 1000;
    let last = "queued";
    while (Date.now() < deadline) {
      await ParallelTask.pause(this.pollMs, signal);
      last = await this.status(runId, last, signal);
      if (DONE.has(last)) return last;
    }
    throw new Error(`Parallel task run ${runId} still ${last} after ${this.timeoutSeconds}s`);
  }

  private async status(runId: string, last: string, signal?: AbortSignal): Promise<string> {
    Trace.line(import.meta.url, "ParallelTask.status", { runId, last });
    try {
      return String((await this.api.get(`/v1/tasks/runs/${runId}`, signal)).status ?? last);
    } catch (error) {
      if (signal?.aborted || error instanceof ServiceUnavailableError) throw error;
      return last;
    }
  }

  private static pause(ms: number, signal?: AbortSignal): Promise<void> {
    Trace.line(import.meta.url, "ParallelTask.pause", { ms });
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
    });
  }
}
