import { Asins } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import type { UrlLedger } from "../tools/url-ledger.js";

/** A proposed competitor's url must be one the agent met, a product page, not the client's product, and not one already known. */
export class CompetitorUrlCheck {
  static problems(urls: readonly string[], ledger: UrlLedger, productUrl: string, known: readonly string[] = []): string[] {
    Trace.line(import.meta.url, "CompetitorUrlCheck.problems", { urls: urls.length, known: known.length });
    const problems = ledger.unknown(urls).map((url) => `competitor url ${url} did not appear in any search, ad or page you read; use a url you actually met`);
    if (urls.some((url) => CompetitorUrlCheck.key(url) === CompetitorUrlCheck.key(productUrl))) problems.push("the product itself is listed as a competitor");
    const seen = new Set(known.map((url) => CompetitorUrlCheck.key(url)));
    for (const url of urls) {
      if (seen.has(CompetitorUrlCheck.key(url))) problems.push(`competitor url ${url} is already known; propose only products not on the list you were given`);
      if (/(^|\.)amazon\.[a-z.]+$/.test(new URL(url).hostname) && !Asins.fromUrl(url)) problems.push(`competitor url ${url} is an Amazon page but not a product page; use the listing's /dp/ url`);
    }
    return problems;
  }

  static key(url: string): string {
    Trace.line(import.meta.url, "CompetitorUrlCheck.key", { url });
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}`.toLowerCase();
  }
}
