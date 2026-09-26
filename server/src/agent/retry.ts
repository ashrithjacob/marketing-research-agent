import { Trace } from "../trace/index.js";

export interface RetryPolicy {
  attempts: number;
  baseMs: number;
  capMs: number;
}

export const DEFAULT_RETRY: RetryPolicy = { attempts: 3, baseMs: 2000, capMs: 30000 };

const TERMINAL_ERROR =
  /insufficient_quota|quota exceeded|out of budget|billing|payment required|\b402\b|usage limit|credits? (exhausted|required)|unauthorized|unauthenticated|invalid api key|invalid_api_key|forbidden|\b401\b|\b403\b|context (length|window)|maximum context|too many tokens|prompt is too long|invalid_request|invalid request|unknown model|model not found|content[ _-]?(policy|filter)|safety/i;

/** Retrying a terminal error just spends the same money again, so it is named. */
export class Retries {
  static isRetryable(errorMessage: string): boolean {
    Trace.line(import.meta.url, "Retries.isRetryable", { errorMessage });
    return errorMessage.trim() !== "" && !TERMINAL_ERROR.test(errorMessage);
  }

  static backoffMs(attempt: number, policy: RetryPolicy = DEFAULT_RETRY): number {
    Trace.line(import.meta.url, "Retries.backoffMs", { attempt, policy });
    const window = Math.min(policy.capMs, policy.baseMs * 2 ** (attempt - 1));
    return Math.round(window / 2 + Math.random() * (window / 2));
  }

  static sleep(ms: number): Promise<void> {
    Trace.line(import.meta.url, "Retries.sleep", { ms });
    return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
  }
}
