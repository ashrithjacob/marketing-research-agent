import { Trace } from "../trace/index.js";

/** Refuses a client address after too many failed logins inside a sliding window. */
export class LoginThrottle {
  private static readonly SWEEP_AT = 10_000;
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly limit = 5,
    private readonly windowMs = 15 * 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  retryAfterSeconds(client: string): number {
    Trace.line(import.meta.url, "LoginThrottle.retryAfterSeconds", { client });
    const recent = this.recent(client);
    if (recent.length < this.limit) return 0;
    return Math.max(1, Math.ceil((recent[0]! + this.windowMs - this.now()) / 1000));
  }

  fail(client: string): void {
    Trace.line(import.meta.url, "LoginThrottle.fail", { client });
    if (this.failures.size >= LoginThrottle.SWEEP_AT) this.sweep();
    this.failures.set(client, [...this.recent(client), this.now()]);
  }

  clear(client: string): void {
    Trace.line(import.meta.url, "LoginThrottle.clear", { client });
    this.failures.delete(client);
  }

  /** The rightmost X-Forwarded-For entry is the one Caddy appended; anything left of it came from the client. */
  static clientOf(forwardedFor: string | undefined): string {
    Trace.line(import.meta.url, "LoginThrottle.clientOf", { forwardedFor });
    const hops = (forwardedFor ?? "").split(",").map((hop) => hop.trim()).filter(Boolean);
    return hops.at(-1) ?? "direct";
  }

  private recent(client: string): number[] {
    Trace.line(import.meta.url, "LoginThrottle.recent", { client });
    const cutoff = this.now() - this.windowMs;
    return (this.failures.get(client) ?? []).filter((at) => at > cutoff);
  }

  private sweep(): void {
    Trace.line(import.meta.url, "LoginThrottle.sweep");
    for (const client of [...this.failures.keys()]) {
      if (this.recent(client).length === 0) this.failures.delete(client);
    }
  }
}
