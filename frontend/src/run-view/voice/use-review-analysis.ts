import { useCallback, useEffect, useState } from 'react';
import { api, type ReviewAnalysis } from '../../api';

const POLL_MS = 3000;

export function useReviewAnalysis(runId: string) {
  const [analysis, setAnalysis] = useState<ReviewAnalysis | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { analysis: next } = await api.reviewAnalysis(runId);
      setAnalysis(next);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [runId]);

  useEffect(() => {
    setAnalysis(null);
    setLoaded(false);
    void load();
  }, [load]);

  useEffect(() => {
    if (analysis?.status !== 'running') return;
    const timer = window.setTimeout(() => void load(), POLL_MS);
    return () => window.clearTimeout(timer);
  }, [analysis, load]);

  const start = useCallback(async () => {
    try {
      const { analysis: next } = await api.startReviewAnalysis(runId);
      setAnalysis(next);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [runId]);

  return { analysis, loaded, error, start };
}
