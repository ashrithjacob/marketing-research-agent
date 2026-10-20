import type { Settings } from "../../config/index.js";
import { ServiceUnavailableError, type ActorLimits, type ActorRun, type ActorRunner } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import { Http } from "../http.js";

interface ApifyRun {
  id: string;
  status: string;
  defaultDatasetId: string;
  usageTotalUsd?: number;
}

/** Runs an Apify actor through Apify's REST API and waits for it; a run still going when the wait is over is aborted, so it stops spending, and reported with what it cost. */
export class ApifyRunner implements ActorRunner {
  static readonly BASE = "https://api.apify.com/v2";
  static readonly WAIT_STEP_SECONDS = 60;
  static readonly STILL_GOING: ReadonlySet<string> = new Set(["READY", "RUNNING"]);

  constructor(private readonly settings: Settings) {}

  async run(actor: string, input: Record<string, unknown>, limits: ActorLimits, signal?: AbortSignal): Promise<ActorRun> {
    Trace.line(import.meta.url, "ApifyRunner.run", { actor, limits });
    const options = new URLSearchParams({ waitForFinish: String(ApifyRunner.WAIT_STEP_SECONDS), timeout: String(limits.timeoutSeconds), memory: String(limits.memoryMb) });
    if (limits.maxTotalChargeUsd !== null) options.set("maxTotalChargeUsd", String(limits.maxTotalChargeUsd));
    let run = await this.call<ApifyRun>(`/acts/${actor.replace("/", "~")}/runs?${options}`, { method: "POST", body: JSON.stringify(input) }, signal);
    const deadline = Date.now() + this.settings.apifyWaitSeconds * 1000;
    while (ApifyRunner.STILL_GOING.has(run.status) && Date.now() < deadline) {
      run = await this.call<ApifyRun>(`/actor-runs/${run.id}?waitForFinish=${ApifyRunner.WAIT_STEP_SECONDS}`, { method: "GET" }, signal);
    }
    if (ApifyRunner.STILL_GOING.has(run.status)) {
      await this.call<ApifyRun>(`/actor-runs/${run.id}/abort`, { method: "POST" });
      run = await this.call<ApifyRun>(`/actor-runs/${run.id}?waitForFinish=10`, { method: "GET" });
    }
    const items = await this.call<Array<Record<string, unknown>>>(`/datasets/${run.defaultDatasetId}/items?clean=true&format=json`, { method: "GET" }, signal, false);
    return { status: run.status, items: Array.isArray(items) ? items : [], usd: typeof run.usageTotalUsd === "number" ? run.usageTotalUsd : null };
  }

  private async call<T>(path: string, init: { method: string; body?: string }, signal?: AbortSignal, wrapped = true): Promise<T> {
    Trace.line(import.meta.url, "ApifyRunner.call", { path, method: init.method });
    if (!this.settings.apifyToken) throw new ServiceUnavailableError("apify", "APIFY_TOKEN is not set");
    const headers = { Authorization: `Bearer ${this.settings.apifyToken}`, ...(init.body ? { "Content-Type": "application/json" } : {}) };
    const response = await Http.withTimeout(`${ApifyRunner.BASE}${path}`, { ...init, headers }, ApifyRunner.WAIT_STEP_SECONDS + this.settings.webTimeoutSeconds, signal);
    const body = (await response.json().catch(() => ({}))) as { data?: T; error?: { message?: string } };
    const error = `Apify returned ${response.status}: ${body.error?.message ?? "no body"}`.slice(0, 300);
    if (response.status === 401 || response.status === 402 || response.status === 403) throw new ServiceUnavailableError("apify", error);
    if (!response.ok) throw new Error(error);
    return wrapped ? (body.data as T) : (body as T);
  }
}
