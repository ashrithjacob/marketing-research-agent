import type { Settings } from "../config/index.js";
import { ServiceUnavailableError } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { Http } from "./http.js";

/** One POST to Parallel with the account key; no key, a rejected key or no credit means Parallel can answer nothing. */
export class ParallelApi {
  constructor(private readonly settings: Settings) {}

  async post(path: string, body: Record<string, unknown>, headers: Record<string, string>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    Trace.line(import.meta.url, "ParallelApi.post", { path });
    const { parallelApiKey, parallelBaseUrl, webTimeoutSeconds } = this.settings;
    if (!parallelApiKey) throw new ServiceUnavailableError("parallel", "PARALLEL_API_KEY is not set");
    const response = await Http.withTimeout(
      `${parallelBaseUrl.replace(/\/$/, "")}${path}`,
      { method: "POST", headers: { "x-api-key": parallelApiKey, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) },
      webTimeoutSeconds,
      signal,
    );
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const error = `Parallel returned ${response.status}: ${ParallelApi.message(payload)}`.slice(0, 300);
    if (response.status === 401 || response.status === 402) throw new ServiceUnavailableError("parallel", error);
    if (!response.ok) throw new Error(error);
    return payload;
  }

  private static message(payload: Record<string, unknown>): string {
    Trace.line(import.meta.url, "ParallelApi.message");
    const nested = payload.error as { message?: unknown } | undefined;
    return String(payload.message ?? nested?.message ?? "no body");
  }
}
