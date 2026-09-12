/**
 * One fetch helper, shared by everything in this service that leaves the box.
 *
 * Extracted from `tools.ts` when `trendtrack.ts` needed the same thing. The
 * detail that makes it worth sharing is the signal composition: a bare
 * `AbortSignal.timeout` replaces the caller's own signal rather than adding to
 * it, so an aborted run would keep its outbound requests alive until they timed
 * out on their own.
 */

/** Fetch with a deadline. `AbortSignal.timeout` alone loses the caller's own signal. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutSeconds: number,
  signal?: AbortSignal,
): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutSeconds * 1000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  return await fetch(url, { ...init, signal: combined });
}

/**
 * Run `work` over `items` with at most `limit` in flight.
 *
 * Results come back in input order. Stage 0 makes one detail call per surviving
 * shop and they are independent, but firing eighty at once is how a rate limit
 * turns a working pipeline into a pile of 429s.
 */
export async function mapPool<T, R>(
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
