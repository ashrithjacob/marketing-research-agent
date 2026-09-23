import type { Settings } from "../config/index.js";

import { Http } from "./http.js";

/** Reads one page as markdown. Throws rather than returning an empty body. */
export class Firecrawl {
  constructor(private readonly settings: Settings) {}

  async scrape(
    url: string,
    signal?: AbortSignal,
  ): Promise<{ text: string; title: string }> {
    if (!this.settings.firecrawlApiKey) {
      throw new Error("FIRECRAWL_API_KEY is not set — web_fetch cannot read pages");
    }
    const response = await Http.withTimeout(
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
    const payload = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      data?: { markdown?: string; metadata?: { title?: string } };
    };
    if (!response.ok || payload.success === false) {
      throw new Error(
        `Firecrawl returned ${response.status}: ${payload.error ?? "no body"}`.slice(0, 300),
      );
    }
    const text = payload.data?.markdown ?? "";
    if (!text.trim()) throw new Error("Firecrawl returned an empty body for this url");
    return { text, title: payload.data?.metadata?.title ?? "" };
  }
}
