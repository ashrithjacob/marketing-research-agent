import type { Settings } from "../config/index.js";
import { FetcherUnavailableError, type FetchedPage, type PageFetcher } from "../domain/index.js";

import { Http } from "./http.js";
import { RateLimitWait } from "./rate-limit-wait.js";
import { Trace } from "../trace/index.js";

interface FirecrawlPayload {
  success?: boolean;
  error?: string;
  data?: { markdown?: string; metadata?: { title?: string } };
}

/** Reads one page as markdown, waiting out a rate limit when Firecrawl says how long. Throws rather than returning an empty body; an account that can fetch nothing (no key, no credits) throws FetcherUnavailableError. */
export class Firecrawl implements PageFetcher {
  static readonly RATE_LIMIT_RETRIES = 2;

  constructor(private readonly settings: Settings) {}

  async scrape(
    url: string,
    signal?: AbortSignal,
  ): Promise<FetchedPage> {
    Trace.line(import.meta.url, "Firecrawl.scrape", { url });
    if (!this.settings.firecrawlApiKey) {
      throw new FetcherUnavailableError("firecrawl", "FIRECRAWL_API_KEY is not set");
    }
    const deadline = Date.now() + this.settings.webTimeoutSeconds * 1000;
    for (let retry = 0; ; retry++) {
      const response = await this.request(url, signal);
      const payload = (await response.json().catch(() => ({}))) as FirecrawlPayload;
      if (response.ok && payload.success !== false) return Firecrawl.page(payload);
      const error = `Firecrawl returned ${response.status}: ${payload.error ?? "no body"}`.slice(0, 300);
      if (response.status === 401 || response.status === 402) throw new FetcherUnavailableError("firecrawl", error);
      const asked = response.status === 429 ? RateLimitWait.askedMs(response.headers, payload.error ?? "") : null;
      const waitMs = asked === null ? null : RateLimitWait.withMarginMs(asked);
      if (waitMs === null || retry >= Firecrawl.RATE_LIMIT_RETRIES || Date.now() + waitMs > deadline) {
        throw new Error(error);
      }
      await RateLimitWait.sleep(waitMs, signal);
    }
  }

  private request(url: string, signal?: AbortSignal): Promise<Response> {
    Trace.line(import.meta.url, "Firecrawl.request", { url });
    return Http.withTimeout(
      `${this.settings.firecrawlBaseUrl.replace(/\/$/, "")}/v2/scrape`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.settings.firecrawlApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      },
      this.settings.webTimeoutSeconds,
      signal,
    );
  }

  private static page(payload: FirecrawlPayload): FetchedPage {
    Trace.line(import.meta.url, "Firecrawl.page");
    const text = payload.data?.markdown ?? "";
    if (!text.trim()) throw new Error("Firecrawl returned an empty body for this url");
    return { text, title: payload.data?.metadata?.title ?? "" };
  }
}
