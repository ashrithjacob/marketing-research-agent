import { useEffect, useState } from 'react';
import { streamRunEvents, type RunEvent } from '../api';

/** Follows one run's events for the cockpit: the latest tool call, and a notice while reconnecting. */
export function useRunStream(
  runId: string,
  reload: () => Promise<void>,
  onChanged: () => void,
  onError: (message: string) => void,
): { lastTool: RunEvent | undefined; reconnecting: string } {
  const [lastTool, setLastTool] = useState<RunEvent | undefined>(undefined);
  const [reconnecting, setReconnecting] = useState('');

  useEffect(() => {
    setLastTool(undefined);
    setReconnecting('');
    let dropped = false;
    const stop = streamRunEvents(runId, 0, {
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
  }, [runId, reload, onChanged, onError]);

  return { lastTool, reconnecting };
}
