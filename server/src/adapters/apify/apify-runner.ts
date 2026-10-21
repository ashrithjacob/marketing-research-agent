import type { Settings } from "../../config/index.js";
import type { ActorLimits, ActorRun, ActorRunner } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { ActorInputCheck } from "./actor-input-check.js";
import type { ApifyApi } from "./apify-api.js";

interface ApifyRun {
  id: string;
  status: string;
  defaultDatasetId: string;
  finishedAt?: string | null;
  usageTotalUsd?: number;
}

/** Runs an Apify actor and waits for it; a run still going when the wait is over is aborted so it stops spending. Its charge is read once it has settled: `settle` seconds after it finished, then until two reads agree. */
export class ApifyRunner implements ActorRunner {
  static readonly STILL_GOING: ReadonlySet<string> = new Set(["READY", "RUNNING"]);
  static readonly MAX_BILLING_READS = 4;

  constructor(
    private readonly api: ApifyApi,
    private readonly settings: Settings,
    private readonly inputs = new ActorInputCheck(api),
  ) {}

  async run(actor: string, input: Record<string, unknown>, limits: ActorLimits, signal?: AbortSignal): Promise<ActorRun> {
    Trace.line(import.meta.url, "ApifyRunner.run", { actor, limits });
    const problems = await this.inputs.problems(actor, input, signal);
    if (problems.length > 0) throw new Error(`${problems.join("; ")}: its input changed, so it was not run`);
    const options = new URLSearchParams({ waitForFinish: String(60), timeout: String(limits.timeoutSeconds), memory: String(limits.memoryMb) });
    if (limits.maxTotalChargeUsd !== null) options.set("maxTotalChargeUsd", String(limits.maxTotalChargeUsd));
    let run = await this.api.post<ApifyRun>(`/acts/${actor.replace("/", "~")}/runs?${options}`, input, signal);
    const deadline = Date.now() + this.settings.apifyWaitSeconds * 1000;
    while (ApifyRunner.STILL_GOING.has(run.status) && Date.now() < deadline) run = await this.api.get<ApifyRun>(`/actor-runs/${run.id}?waitForFinish=60`, signal);
    if (ApifyRunner.STILL_GOING.has(run.status)) {
      await this.api.post<ApifyRun>(`/actor-runs/${run.id}/abort`);
      run = await this.api.get<ApifyRun>(`/actor-runs/${run.id}?waitForFinish=10`);
    }
    return { id: run.id, status: run.status, items: await this.api.items(run.defaultDatasetId, signal), finished_at: run.finishedAt ?? null };
  }

  async billed(run: ActorRun): Promise<number | null> {
    Trace.line(import.meta.url, "ApifyRunner.billed", { runId: run.id });
    const settle = this.settings.apifySettleSeconds * 1000;
    const finished = run.finished_at ? Date.parse(run.finished_at) : Date.now();
    await ApifyRunner.sleep(finished + settle - Date.now());
    let last: number | null = null;
    for (let read = 0; read < ApifyRunner.MAX_BILLING_READS; read++) {
      const usd = (await this.api.get<ApifyRun>(`/actor-runs/${run.id}`)).usageTotalUsd ?? null;
      if (read > 0 && usd === last) return usd;
      last = usd;
      await ApifyRunner.sleep(settle / 4);
    }
    return last;
  }

  private static sleep(ms: number): Promise<void> {
    Trace.line(import.meta.url, "ApifyRunner.sleep", { ms: Math.round(ms) });
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }
}
