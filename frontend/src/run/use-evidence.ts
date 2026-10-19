import { useEffect, useState } from 'react';

import { runs, type ReadAd, type ReviewCoverage } from '../api';

export function useEvidence(runId: string, version: string, ready: boolean, onError: (message: string) => void) {
  const [coverage, setCoverage] = useState<ReviewCoverage[]>([]);
  const [ads, setAds] = useState<ReadAd[]>([]);

  useEffect(() => {
    if (!ready) return;
    runs.reviews(runId, null, 1).then((r) => setCoverage(r.coverage), (e: Error) => onError(e.message));
    runs.ads(runId).then((r) => setAds(r.ads), (e: Error) => onError(e.message));
  }, [runId, version, ready, onError]);

  return { coverage, ads };
}
