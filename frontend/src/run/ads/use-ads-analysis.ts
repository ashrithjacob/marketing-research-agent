import { useEffect, useState } from 'react';

import { runs, type AdsAnalysis } from '../../api';

export function useAdsAnalysis(runId: string, version: string, onError: (message: string) => void) {
  const [analysis, setAnalysis] = useState<AdsAnalysis | null>(null);
  useEffect(() => {
    runs.adAnalysis(runId).then((r) => setAnalysis(r.analysis), (e: Error) => onError(e.message));
  }, [runId, version, onError]);
  return analysis;
}
