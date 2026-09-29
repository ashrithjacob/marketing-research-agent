import { Trace } from "../trace/index.js";

interface Waiter {
  admit: () => void;
  refuse: (reason: unknown) => void;
}

/** At most `limit` calls to one outside service in flight, process-wide; the rest wait their turn in order. */
export class ServiceQueue {
  private active = 0;
  private readonly waiting: Waiter[] = [];

  constructor(
    readonly service: string,
    readonly limit: number,
  ) {
    Trace.line(import.meta.url, "ServiceQueue.constructor", { service, limit });
  }

  async run<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    Trace.line(import.meta.url, "ServiceQueue.run", { service: this.service, active: this.active, waiting: this.waiting.length });
    const queuedAt = Date.now();
    await this.slot(signal);
    this.admitted(Date.now() - queuedAt);
    try {
      return await work();
    } finally {
      this.release();
    }
  }

  private slot(signal?: AbortSignal): Promise<void> {
    Trace.line(import.meta.url, "ServiceQueue.slot", { service: this.service });
    signal?.throwIfAborted();
    if (this.active < Math.max(1, this.limit)) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        admit: () => {
          Trace.line(import.meta.url, "ServiceQueue.slot.admit", { service: this.service });
          signal?.removeEventListener("abort", onAbort);
          resolve();
        },
        refuse: reject,
      };
      const onAbort = () => {
        const at = this.waiting.indexOf(waiter);
        if (at >= 0) this.waiting.splice(at, 1);
        waiter.refuse(signal?.reason);
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      this.waiting.push(waiter);
    });
  }

  /** The wait is traced on its own line so a run's time spent queueing can be summed. */
  private admitted(waitedMs: number): void {
    Trace.line(import.meta.url, "ServiceQueue.admitted", { service: this.service, waited_ms: waitedMs });
  }

  private release(): void {
    Trace.line(import.meta.url, "ServiceQueue.release", { service: this.service });
    const next = this.waiting.shift();
    if (next) next.admit();
    else this.active -= 1;
  }
}
