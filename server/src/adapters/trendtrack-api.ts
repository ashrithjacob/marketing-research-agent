import type { Settings } from "../config/index.js";
import { ServiceUnavailableError } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { Http } from "./http.js";

/** One request to TrendTrack with the account key, and the credits its header says it cost; no key, a rejected key or no credit means TrendTrack can answer nothing. */
export class TrendtrackApi {
  constructor(private readonly settings: Settings) {}

  async get(path: string, signal?: AbortSignal): Promise<{ body: unknown; credits: number }> {
    Trace.line(import.meta.url, "TrendtrackApi.get", { path });
    return this.send(path, { method: "GET", headers: {} }, signal);
  }

  async post(path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<{ body: unknown; credits: number }> {
    Trace.line(import.meta.url, "TrendtrackApi.post", { path });
    return this.send(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, signal);
  }

  private async send(path: string, init: RequestInit & { headers: Record<string, string> }, signal?: AbortSignal): Promise<{ body: unknown; credits: number }> {
    Trace.line(import.meta.url, "TrendtrackApi.send", { path, method: init.method });
    const { trendtrackApiKey, trendtrackBaseUrl, webTimeoutSeconds } = this.settings;
    if (!trendtrackApiKey) throw new ServiceUnavailableError("trendtrack", "TRENDTRACK_API_KEY is not set");
    const response = await Http.withTimeout(`${trendtrackBaseUrl.replace(/\/$/, "")}${path}`, { ...init, headers: { Authorization: `Bearer ${trendtrackApiKey}`, ...init.headers } }, webTimeoutSeconds, signal);
    const body = (await response.json().catch(() => ({}))) as { message?: string; error?: { message?: string } };
    const error = `Trendtrack returned ${response.status}: ${body.message ?? body.error?.message ?? "no body"}`.slice(0, 300);
    if (response.status === 401 || response.status === 402 || response.status === 403) throw new ServiceUnavailableError("trendtrack", error);
    if (!response.ok) throw new Error(error);
    const credits = Number(response.headers.get("x-credits-used") ?? 0);
    return { body, credits: Number.isFinite(credits) ? credits : 0 };
  }
}
