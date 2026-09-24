import { useEffect, useState } from 'react';
import { api, RELATION_LABEL, type Brief, type RunSummary, type StageTwoPlanResponse } from './api';

/** The stage-2 go-ahead: the roster stage 1 found, what is approved, and what it costs. */
export default function StageTwoPlan({
  brief,
  onStarted,
  onFailed,
  onClose,
}: {
  brief: Brief;
  onStarted: (run: RunSummary) => Promise<void>;
  onFailed: () => Promise<void>;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState<StageTwoPlanResponse | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .stageTwoPlan(brief, selected)
      .then((response) => {
        if (cancelled) return;
        setPlan(response);
        if (response.ready && selected.length === 0) {
          setSelected((response.plan?.targets ?? []).map((t) => t.id));
        }
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [selected.join(',')]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  async function approve() {
    if (!plan?.plan || busy) return;
    setBusy(true);
    setError('');
    try {
      const run = await api.startRun(brief, ['review_mining'], '', selected);
      await onStarted(run);
    } catch (e) {
      setError((e as Error).message);
      await onFailed();
    } finally {
      setBusy(false);
    }
  }

  const estimate = plan?.plan?.estimate;
  const targets = plan?.plan?.targets ?? [];

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Review mining — approve the go-ahead</h2>
        {!plan && <p className="muted">Reading stage 1's findings…</p>}
        {plan && !plan.ready && (
          <>
            <p className="lede">{plan.detail}</p>
            <div className="row">
              <button type="button" className="ghost" onClick={onClose}>
                Back
              </button>
            </div>
          </>
        )}
        {plan?.ready && plan.plan && (
          <>
            <p className="lede">
              Stage 1 found <b>{plan.plan.subject.name}</b> ({plan.plan.subject.form};{' '}
              {plan.plan.subject.actives.join(', ')}) and the brands that share its active
              ingredient. Stage 2 mines verbatim customer language for the approved targets —
              Amazon per star band, 3★ first, plus Trustpilot where a brand has a presence.
            </p>
            <fieldset className="markets">
              <legend>Targets</legend>
              {targets.map((target) => (
                <label key={target.id} className="market">
                  <input
                    type="checkbox"
                    id={`target-${target.id}`}
                    checked={selected.includes(target.id)}
                    onChange={() => toggle(target.id)}
                  />
                  <span>
                    <b>{RELATION_LABEL[target.relation]}</b> — {target.name} ({target.form})
                    {target.url ? <span className="muted small"> · {target.url}</span> : null}
                  </span>
                </label>
              ))}
            </fieldset>
            {estimate && (
              <p className="muted small">
                {estimate.reviews} reviews across {estimate.bands} bands for{' '}
                {estimate.targets} target{estimate.targets === 1 ? '' : 's'} — about{' '}
                <b>${estimate.cost_usd.toFixed(2)}</b> on Apify. {estimate.arithmetic}
              </p>
            )}
            {error && <p className="error small">{error}</p>}
            <div className="row">
              <button type="button" className="ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                className="primary"
                type="button"
                onClick={approve}
                disabled={busy || selected.length === 0}
              >
                {busy ? 'Starting…' : `Approve & mine ${selected.length}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
