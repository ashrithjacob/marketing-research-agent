import { Trace } from "../../trace/index.js";

/** The urls one agent read with web_fetch, and those it only saw in search or ad results, so code can refuse a url the agent never met. */
export class UrlLedger {
  private readonly readUrls = new Set<string>();
  private readonly seenUrls = new Set<string>();

  read(url: string): void {
    Trace.line(import.meta.url, "UrlLedger.read", { url });
    this.readUrls.add(UrlLedger.normal(url));
  }

  saw(urls: readonly string[]): void {
    Trace.line(import.meta.url, "UrlLedger.saw", { count: urls.length });
    for (const url of urls) this.seenUrls.add(UrlLedger.normal(url));
  }

  unread(urls: readonly string[]): string[] {
    Trace.line(import.meta.url, "UrlLedger.unread", { count: urls.length });
    return [...new Set(urls)].filter((url) => !this.readUrls.has(UrlLedger.normal(url)));
  }

  unknown(urls: readonly string[]): string[] {
    Trace.line(import.meta.url, "UrlLedger.unknown", { count: urls.length });
    return [...new Set(urls)].filter((url) => !this.readUrls.has(UrlLedger.normal(url)) && !this.seenUrls.has(UrlLedger.normal(url)));
  }

  private static normal(url: string): string {
    Trace.tick(import.meta.url, "UrlLedger.normal");
    try {
      const parsed = new URL(url);
      return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}${parsed.search}`.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }
}
