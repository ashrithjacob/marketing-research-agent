import type { RunEvent } from './calls';

/** The server sends a keepalive every 20 s; this long without a byte means the connection is dead. */
const STALL_MS = 45_000;
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000];
/** Retrying cannot fix these: not signed in, not allowed, no such run. */
const FATAL_STATUSES = new Set([401, 403, 404]);

export interface StreamHandlers {
  onEvent: (event: RunEvent) => void;
  /** The server said the run is over. Not called for a dropped connection — that is retried. */
  onEnd: (reason: string) => void;
  /** A failure retrying cannot fix. The stream has stopped. */
  onError: (message: string) => void;
  /** The connection dropped mid-run; `attempt` counts from 1. Cleared by `onConnected`. */
  onReconnecting?: (attempt: number, reason: string) => void;
  onConnected?: () => void;
}

class FatalStreamError extends Error {}

/**
 * Follow a run's SSE event stream, resuming from the last event seen after any drop.
 * Hand-parsed rather than EventSource: the abort handle comes free, and resuming by
 * event id needs no server change — `?after=` already replays what was missed.
 */
export function streamRunEvents(runId: string, after: number, handlers: StreamHandlers): () => void {
  const stopped = new AbortController();
  let last = after;
  let wakeBackoff: (() => void) | null = null;
  const retryNow = () => wakeBackoff?.();
  const onVisible = () => {
    if (document.visibilityState === 'visible') retryNow();
  };
  window.addEventListener('online', retryNow);
  document.addEventListener('visibilitychange', onVisible);

  const connectOnce = async (): Promise<{ ended: boolean; progressed: boolean }> => {
    const attempt = new AbortController();
    const abortAttempt = () => attempt.abort();
    stopped.signal.addEventListener('abort', abortAttempt);
    let stall: ReturnType<typeof setTimeout> | undefined;
    const armStall = () => {
      clearTimeout(stall);
      stall = setTimeout(() => attempt.abort(new Error('no data for 45 s')), STALL_MS);
    };
    let progressed = false;
    try {
      armStall();
      const response = await fetch(`/api/research/runs/${runId}/events?after=${last}`, {
        credentials: 'same-origin',
        signal: attempt.signal,
      });
      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => '');
        const message = text || `event stream returned ${response.status}`;
        if (FATAL_STATUSES.has(response.status)) throw new FatalStreamError(message);
        throw new Error(message);
      }
      handlers.onConnected?.();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return { ended: false, progressed };
        armStall();
        progressed = true;
        buffer += decoder.decode(value, { stream: true });
        let split: number;
        while ((split = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          let name = 'message';
          let data = '';
          for (const line of frame.split('\n')) {
            if (line.startsWith('event: ')) name = line.slice(7).trim();
            else if (line.startsWith('data: ')) data += line.slice(6);
          }
          if (!data) continue;
          const payload = JSON.parse(data);
          if (name === 'event') {
            const event = payload as RunEvent;
            if (event.id <= last) continue;
            last = event.id;
            handlers.onEvent(event);
          } else if (name === 'end') {
            handlers.onEnd(payload.reason ?? '');
            return { ended: true, progressed };
          }
        }
      }
    } finally {
      clearTimeout(stall);
      stopped.signal.removeEventListener('abort', abortAttempt);
      attempt.abort();
    }
  };

  const backoff = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(done, ms);
      function done() {
        clearTimeout(timer);
        wakeBackoff = null;
        stopped.signal.removeEventListener('abort', done);
        resolve();
      }
      wakeBackoff = done;
      stopped.signal.addEventListener('abort', done);
    });

  (async () => {
    let failures = 0;
    while (!stopped.signal.aborted) {
      let reason = 'connection closed';
      try {
        const { ended, progressed } = await connectOnce();
        if (ended) return;
        if (progressed) failures = 0;
      } catch (error) {
        if (stopped.signal.aborted) return;
        if (error instanceof FatalStreamError) {
          handlers.onError(error.message);
          return;
        }
        reason = (error as Error).message || reason;
      }
      if (stopped.signal.aborted) return;
      failures += 1;
      handlers.onReconnecting?.(failures, reason);
      await backoff(BACKOFF_MS[Math.min(failures - 1, BACKOFF_MS.length - 1)]);
    }
  })().finally(() => {
    window.removeEventListener('online', retryNow);
    document.removeEventListener('visibilitychange', onVisible);
  });

  return () => stopped.abort();
}
