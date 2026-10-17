import { Trace } from "../trace/index.js";

/** fetch with a deadline. */
export class Http {
  static async withTimeout(
    url: string,
    init: RequestInit,
    timeoutSeconds: number,
    signal?: AbortSignal,
  ): Promise<Response> {
    Trace.line(import.meta.url, "Http.withTimeout", { url, init, timeoutSeconds });
    const timeout = AbortSignal.timeout(timeoutSeconds * 1000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    return await fetch(url, { ...init, signal: combined });
  }
}
