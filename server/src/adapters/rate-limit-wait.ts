import { Trace } from "../trace/index.js";

/** How long a rate-limited service asked us to wait, stretched by a margin, and the wait itself. */
export class RateLimitWait {
  static readonly MARGIN = 1.2;

  static askedMs(headers: Headers, errorText: string): number | null {
    Trace.line(import.meta.url, "RateLimitWait.askedMs", { errorText });
    const header = Number(headers.get("retry-after"));
    if (Number.isFinite(header) && header > 0) return header * 1000;
    const stated = /retry after (\d+(?:\.\d+)?)\s*s/i.exec(errorText);
    return stated ? Number(stated[1]) * 1000 : null;
  }

  static withMarginMs(askedMs: number): number {
    Trace.line(import.meta.url, "RateLimitWait.withMarginMs", { askedMs });
    return Math.ceil(askedMs * RateLimitWait.MARGIN);
  }

  static sleep(ms: number, signal?: AbortSignal): Promise<void> {
    Trace.line(import.meta.url, "RateLimitWait.sleep", { ms });
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason ?? new Error("aborted"));
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal?.reason ?? new Error("aborted"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}
