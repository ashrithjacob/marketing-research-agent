import { useEffect, useState } from 'react';

import { TERMINAL_STATUSES, type RunSummary } from './api';

/** Elapsed run time, ticking once a second while the run is live. */
export function useClock(run: RunSummary | null): string {
  const live = !!run && !TERMINAL_STATUSES.has(run.status);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!live) return;
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [live]);
  if (!run) return '';
  const start = new Date(run.created_at).getTime();
  const end = run.ended_at ? new Date(run.ended_at).getTime() : Date.now();
  const s = Math.max(0, Math.floor((end - start) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
