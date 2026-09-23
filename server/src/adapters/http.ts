/** fetch with a deadline, and a bounded-concurrency map. */
export class Http {
  static async withTimeout(
    url: string,
    init: RequestInit,
    timeoutSeconds: number,
    signal?: AbortSignal,
  ): Promise<Response> {
    const timeout = AbortSignal.timeout(timeoutSeconds * 1000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    return await fetch(url, { ...init, signal: combined });
  }

  static async pool<T, R>(
    items: readonly T[],
    limit: number,
    work: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await work(items[index]!, index);
      }
    });
    await Promise.all(workers);
    return results;
  }
}
