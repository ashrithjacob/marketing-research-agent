import { Clock, type PageFetcher, type TrustpilotSummary } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** A company's Trustpilot score and review count, read off its page's own header; the page lists other companies' scores too, so only that header counts. */
export class TrustpilotProfiles {
  constructor(private readonly pages: PageFetcher) {}

  async read(domain: string, signal?: AbortSignal): Promise<TrustpilotSummary> {
    Trace.line(import.meta.url, "TrustpilotProfiles.read", { domain });
    const url = `https://www.trustpilot.com/review/${domain}`;
    try {
      const { text } = await this.pages.scrape(url, signal);
      return { domain, url, ...TrustpilotProfiles.parse(text), fetched_at: Clock.nowIso() };
    } catch (error) {
      return { domain, url, stars: null, reviews: null, error: error instanceof Error ? error.message : String(error), fetched_at: Clock.nowIso() };
    }
  }

  static parse(markdown: string): { stars: number | null; reviews: number | null; error: string } {
    Trace.line(import.meta.url, "TrustpilotProfiles.parse", { chars: markdown.length });
    const lines = markdown.split("\n").map((line) => line.trim()).filter((line) => line !== "");
    const heading = lines.findIndex((line) => /^# .+Reviews$/.test(line));
    if (heading < 0) return { stars: null, reviews: null, error: "no Trustpilot page for this domain" };
    const header = lines.slice(heading + 1, heading + 8);
    const count = header[0] && /^[\d,]+$/.test(header[0]) ? Number(header[0].replace(/,/g, "")) : null;
    const scoreAt = header.findIndex((line) => line.includes("TrustScore"));
    const score = scoreAt >= 0 ? Number(header[scoreAt + 1]) : Number.NaN;
    if (count === null) return { stars: null, reviews: null, error: "the Trustpilot page header had no review count" };
    return { stars: count > 0 && Number.isFinite(score) ? score : null, reviews: count, error: "" };
  }
}
