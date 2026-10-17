import { isIP } from "node:net";

import { Trace } from "../trace/index.js";

/** Refuses a url the server must not fetch for an agent or a user: anything not http(s), and any host that names this machine or a private network. */
export class PublicUrls {
  private static readonly PRIVATE = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./, /^::1$/, /^f[cd][0-9a-f]{2}:/i, /^fe80:/i];

  static assert(url: string): URL {
    Trace.line(import.meta.url, "PublicUrls.assert", { url });
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error(`refusing ${parsed.protocol} url ${url}`);
    const host = parsed.hostname.replace(/^\[|\]$/g, "");
    const local = host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || !host.includes(".") && isIP(host) === 0;
    if (local || (isIP(host) !== 0 && PublicUrls.PRIVATE.some((range) => range.test(host)))) throw new Error(`refusing a non-public host: ${host}`);
    return parsed;
  }
}
