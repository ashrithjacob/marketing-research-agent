import type { Settings } from "../config/index.js";
import type { ArchivedPage, PageArchive } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { Http } from "./http.js";
import type { PublicPage } from "./public-page.js";
import { ReviewText } from "./reviews/review-text.js";

/** The Wayback Machine, free: its CDX index lists a page's snapshots, at most one a month, and a snapshot is read raw (`id_`) and reduced to its text. Small brands may have no snapshots (mullevia.com product pages had none on 2026-10-20). */
export class WaybackArchive implements PageArchive {
  static readonly MAX_SNAPSHOTS = 36;
  static readonly MAX_CHARS = 6000;

  constructor(
    private readonly settings: Settings,
    private readonly pages: PublicPage,
  ) {}

  async snapshots(url: string, signal?: AbortSignal): Promise<ArchivedPage[]> {
    Trace.line(import.meta.url, "WaybackArchive.snapshots", { url });
    const query = new URLSearchParams({ url, output: "json", fl: "timestamp,original", filter: "statuscode:200", collapse: "timestamp:6" });
    const response = await Http.withTimeout(`https://web.archive.org/cdx/search/cdx?${query}`, {}, this.settings.webTimeoutSeconds * 2, signal);
    if (!response.ok) throw new Error(`the Wayback Machine returned ${response.status}`);
    const rows = ((await response.json().catch(() => [])) as string[][]).slice(1);
    const step = Math.max(1, Math.ceil(rows.length / WaybackArchive.MAX_SNAPSHOTS));
    return rows.filter((_, i) => i % step === 0 || i === rows.length - 1).map(([timestamp, original]) => ({ timestamp: timestamp!, url: original! }));
  }

  async read(page: ArchivedPage, signal?: AbortSignal): Promise<string> {
    Trace.line(import.meta.url, "WaybackArchive.read", { url: page.url, timestamp: page.timestamp });
    const { body } = await this.pages.text(`https://web.archive.org/web/${page.timestamp}id_/${page.url}`, "text/html", signal);
    return WaybackArchive.text(body).slice(0, WaybackArchive.MAX_CHARS);
  }

  static text(html: string): string {
    Trace.line(import.meta.url, "WaybackArchive.text", { chars: html.length });
    const visible = html.replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<\/(p|div|h[1-6]|li|section)>/gi, "\n");
    return ReviewText.fromHtml(visible).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  }
}
