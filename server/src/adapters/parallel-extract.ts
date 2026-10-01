import type { FetchedPage, PageFetcher } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ParallelApi } from "./parallel-api.js";

interface ExtractResult {
  title?: string;
  full_content?: string | null;
}

interface ExtractError {
  error_type?: string;
  http_status_code?: number | null;
}

/** Parallel Extract reads one page in full, scripts run, which is what a price table drawn by JavaScript needs. Throws rather than returning an empty body. */
export class ParallelExtract implements PageFetcher {
  static readonly BETA = "search-extract-2025-10-10";
  constructor(private readonly api: ParallelApi) {}

  async scrape(url: string, signal?: AbortSignal): Promise<FetchedPage> {
    Trace.line(import.meta.url, "ParallelExtract.scrape", { url });
    const body = await this.api.post("/v1beta/extract", { urls: [url], excerpts: false, full_content: true }, { "parallel-beta": ParallelExtract.BETA }, signal);
    const result = ((body.results as ExtractResult[] | undefined) ?? [])[0];
    const text = result?.full_content ?? "";
    if (text.trim()) return { text, title: result?.title ?? "" };
    const failed = ((body.errors as ExtractError[] | undefined) ?? [])[0];
    const why = failed ? `${failed.error_type ?? "error"}${failed.http_status_code ? ` (HTTP ${failed.http_status_code})` : ""}` : "an empty body";
    throw new Error(`Parallel Extract could not read this url: ${why}`);
  }
}
