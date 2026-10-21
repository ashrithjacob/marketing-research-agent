import type { Settings } from "../../config/index.js";
import { ServiceUnavailableError } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import { Http } from "../http.js";

/** One request to Apify's REST API with the account token; no token, a refused one or no credit means Apify can run nothing. */
export class ApifyApi {
  static readonly BASE = "https://api.apify.com/v2";
  static readonly LONG_POLL_SECONDS = 60;

  constructor(private readonly settings: Settings) {}

  async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    Trace.line(import.meta.url, "ApifyApi.get", { path });
    return this.send<T>(path, { method: "GET" }, signal);
  }

  async post<T>(path: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    Trace.line(import.meta.url, "ApifyApi.post", { path });
    return this.send<T>(path, { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) }, signal);
  }

  /** The dataset endpoint answers a bare array, not `{ data }`. */
  async items(datasetId: string, signal?: AbortSignal): Promise<Array<Record<string, unknown>>> {
    Trace.line(import.meta.url, "ApifyApi.items", { datasetId });
    const body = await this.send<unknown>(`/datasets/${datasetId}/items?clean=true&format=json`, { method: "GET" }, signal, false);
    return Array.isArray(body) ? (body as Array<Record<string, unknown>>) : [];
  }

  private async send<T>(path: string, init: { method: string; body?: string }, signal?: AbortSignal, wrapped = true): Promise<T> {
    Trace.line(import.meta.url, "ApifyApi.send", { path, method: init.method });
    if (!this.settings.apifyToken) throw new ServiceUnavailableError("apify", "APIFY_TOKEN is not set");
    const headers = { Authorization: `Bearer ${this.settings.apifyToken}`, ...(init.body ? { "Content-Type": "application/json" } : {}) };
    const response = await Http.withTimeout(`${ApifyApi.BASE}${path}`, { ...init, headers }, ApifyApi.LONG_POLL_SECONDS + this.settings.webTimeoutSeconds, signal);
    const body = (await response.json().catch(() => ({}))) as { data?: T; error?: { message?: string } };
    const error = `Apify returned ${response.status}: ${body.error?.message ?? "no body"}`.slice(0, 300);
    if (response.status === 401 || response.status === 402 || response.status === 403) throw new ServiceUnavailableError("apify", error);
    if (!response.ok) throw new Error(error);
    return wrapped ? (body.data as T) : (body as T);
  }
}
