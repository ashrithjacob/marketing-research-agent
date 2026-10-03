import { useEffect, useState } from 'react';
import { streamRunEvents, type RunEvent } from '../api';

/** Follows a live run's new events for the cockpit — the latest tool call, and a notice while reconnecting — from `from` on; with `from` null (a finished run, or one not loaded yet) it opens no stream, since replaying history would only re-fetch the run once per old event. */
export function useRunStream(
  runId: string,
  from: number | null,
  reload: () => Promise<void>,
  onChanged: () => void,
  onError: (message: string) => void,
): { lastTool: RunEvent | undefined; reconnecting: string } {
  const [lastTool, setLastTool] = useState<RunEvent | undefined>(undefined);
  const [reconnecting, setReconnecting] = useState('');

  useEffect(() => {
    setLastTool(undefined);
    setReconnecting('');
    if (from === null) return;
    let dropped = false;
    const stop = streamRunEvents(runId, from, {
      onEvent: (event) => {
        if (event.kind === 'tool.started') setLastTool(event);
        if (event.kind.startsWith('run.') || event.kind.startsWith('packet.')) {
          void reload();
          onChanged();
        }
      },
      onEnd: () => void reload(),
      onError,
      onReconnecting: (attempt, reason) => {
        dropped = true;
        setReconnecting(`${reason} — reconnecting (attempt ${attempt})`);
      },
      onConnected: () => {
        setReconnecting('');
        if (dropped) void reload();
        dropped = false;
      },
    });
    return () => stop();
  }, [runId, from, reload, onChanged, onError]);

  return { lastTool, reconnecting };
}
