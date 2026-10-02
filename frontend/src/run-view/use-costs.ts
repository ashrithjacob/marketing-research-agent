import { useEffect, useState } from 'react';
import { api, type CostReport } from '../api';

/** The run's cost report, read again every few seconds while the run is live and once more when it ends. */
export function useCosts(runId: string, live: boolean): CostReport | null {
  const [report, setReport] = useState<CostReport | null>(null);
  useEffect(() => {
    let stopped = false;
    const load = () =>
      api
        .costs(runId)
        .then((next) => {
          if (!stopped) setReport(next);
        })
        .catch(() => undefined);
    void load();
    const iv = live ? setInterval(load, 5000) : undefined;
    return () => {
      stopped = true;
      if (iv) clearInterval(iv);
    };
  }, [runId, live]);
  return report;
}
