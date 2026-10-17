import { useCallback, useEffect, useState } from 'react';

import { FINAL_STATUSES, runs, type RunEvent, type RunView } from '../api';

const RELOAD_ON = new Set(['stage.changed', 'run.resolved', 'run.ended', 'agent.ended']);
const KEPT_EVENTS = 200;

export function useRun(runId: string, onError: (message: string) => void) {
  const [view, setView] = useState<RunView | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);

  const reload = useCallback(() => {
    runs.get(runId).then(setView, (e: Error) => onError(e.message));
  }, [runId, onError]);

  useEffect(reload, [reload]);

  const live = view !== null && !FINAL_STATUSES.has(view.run.status);
  useEffect(() => {
    if (!live) return;
    return runs.follow(runId, (event) => {
      setEvents((now) => [...now.slice(-(KEPT_EVENTS - 1)), event]);
      if (RELOAD_ON.has(event.kind)) reload();
    });
  }, [runId, live, reload]);

  return { view, events, reload };
}
