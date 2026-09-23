import type { RunEvent } from './calls';

/** Hand-parsed rather than EventSource: the abort handle comes free, and one SSE implementation. */
export function streamRunEvents(
  runId: string,
  after: number,
  handlers: {
    onEvent: (event: RunEvent) => void;
    onEnd: (reason: string) => void;
    onError: (message: string) => void;
  },
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`/api/research/runs/${runId}/events?after=${after}`, {
        credentials: 'same-origin',
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        handlers.onError(await response.text());
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
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
          if (name === 'event') handlers.onEvent(payload as RunEvent);
          else if (name === 'end') handlers.onEnd(payload.reason ?? '');
        }
      }
      handlers.onEnd('stream closed');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        handlers.onError((error as Error).message);
      }
    }
  })();

  return () => controller.abort();
}
