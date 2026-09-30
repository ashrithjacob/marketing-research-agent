import type { Settings } from "../config/index.js";
import { FetcherUnavailableError, type FetchedPage, type PageFetcher } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { Http } from "./http.js";

interface Crawl4aiPayload {
  markdown?: string;
  title?: string;
  error?: string;
  message?: string;
}

/** Reads one page as markdown through the Crawl4AI cloud API. Throws rather than returning an empty body. */
export class Crawl4ai implements PageFetcher {
  constructor(private readonly settings: Settings) {}

  async scrape(url: string, signal?: AbortSignal): Promise<FetchedPage> {
    Trace.line(import.meta.url, "Crawl4ai.scrape", { url });
    if (!this.settings.crawl4aiApiKey) {
      throw new FetcherUnavailableError("crawl4ai", "CRAWL4AI_API_KEY is not set");
    }
    const response = await Http.withTimeout(
      `${this.settings.crawl4aiBaseUrl.replace(/\/$/, "")}/scrape`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${this.settings.crawl4aiApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, format: "md" }),
      },
      this.settings.webTimeoutSeconds,
      signal,
    );
    const payload = (await response.json().catch(() => ({}))) as Crawl4aiPayload;
    const error = `Crawl4AI returned ${response.status}: ${payload.message ?? payload.error ?? "no body"}`.slice(0, 300);
    if (response.status === 401 || response.status === 402) throw new FetcherUnavailableError("crawl4ai", error);
    if (!response.ok) throw new Error(error);
    const text = payload.markdown ?? "";
    if (!text.trim()) throw new Error("Crawl4AI returned an empty body for this url");
    return { text, title: payload.title ?? "" };
  }
}
