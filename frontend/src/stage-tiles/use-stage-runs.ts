import { useEffect, useState } from 'react';

import { api, STAGE_ORDER, stageRun, type RunDetail, type RunSummary, type StageNumber } from '../api';
import { useProduct } from '../use-products';

export const STAGES: readonly StageNumber[] = STAGE_ORDER;

/** A product's run for each stage, and each one's detail once it has loaded. */
export function useStageRuns(productId: string, onError: (message: string) => void): { stage: StageNumber; summary: RunSummary | null; run: RunDetail | null }[] {
  const { runs } = useProduct(productId, onError);
  const [details, setDetails] = useState<Record<string, RunDetail>>({});
  const chosen = STAGES.map((stage) => ({ stage, summary: stageRun(runs, stage) }));
  const ids = chosen.flatMap((c) => (c.summary ? [c.summary.id] : [])).join(',');

  useEffect(() => {
    for (const id of ids ? ids.split(',') : []) {
      api
        .run(id)
        .then((run) => setDetails((d) => ({ ...d, [id]: run })))
        .catch((err: Error) => onError(err.message));
    }
  }, [ids, onError]);

  return chosen.map((c) => ({ ...c, run: c.summary ? (details[c.summary.id] ?? null) : null }));
}
