import { useEffect, useState } from 'react';
import { api, RELATION_LABEL, REVIEWS_PER_BAND, type Brief, type RunSummary, type ReviewMiningPlanResponse, type TargetListing } from './api';
import { ListingLine } from './review-mining/ListingLine';

/** The review-mining go-ahead: the roster stage 1 found, what is approved, and what it costs. */
export default function ReviewMiningPlan({
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
  const [plan, setPlan] = useState<ReviewMiningPlanResponse | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listings, setListings] = useState<TargetListing[] | null>(null);
  const [looking, setLooking] = useState(false);
  const [revision, setRevision] = useState(0);
  const [perBand, setPerBand] = useState('');
  const asked = Number(perBand);
  const perBandValid = perBand === '' || (Number.isInteger(asked) && asked >= REVIEWS_PER_BAND.min && asked <= REVIEWS_PER_BAND.max);
  const reviewsPerBand = perBand === '' || !perBandValid ? undefined : asked;

  useEffect(() => {
    if (!perBandValid) return;
    let cancelled = false;
    api
      .reviewMiningPlan(brief, selected, reviewsPerBand)
      .then((response) => {
        if (cancelled) return;
        setPlan(response);
        setPerBand((current) => current || String(response.plan?.estimate.reviews_per_band ?? ''));
        setListings((current) => current ?? response.listings ?? []);
        if (response.ready && selected.length === 0) {
          setSelected((response.plan?.offered ?? []).filter((t) => !t.note || t.trustpilot).map((t) => t.id));
        }
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [selected.join(','), revision, reviewsPerBand]);

  const lookupNeeded = !!plan?.ready && !!plan.lookup_needed;

  useEffect(() => {
    if (!lookupNeeded || looking) return;
    setLooking(true);
    api
      .reviewMiningListings(brief)
      .then(({ listings: found }) => {
        setListings(found);
        setSelected([]);
        setRevision((r) => r + 1);
      })
      .catch((e) => setError(`Amazon lookup failed: ${(e as Error).message}`))
      .finally(() => setLooking(false));
  }, [lookupNeeded]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  async function approve() {
    if (!plan?.plan || busy || !perBandValid) return;
    setBusy(true);
    setError('');
    try {
      const run = await api.startRun(brief, ['review_mining'], selected, undefined, reviewsPerBand);
      await onStarted(run);
    } catch (e) {
      setError((e as Error).message);
      await onFailed();
    } finally {
      setBusy(false);
    }
  }

  const estimate = plan?.plan?.estimate;
  const targets = plan?.plan?.offered ?? [];

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
              Stage 1 chose <b>{plan.plan.subject.name}</b> ({plan.plan.subject.form};{' '}
              {plan.plan.subject.actives.join(', ')}) as the champion product — the genre's
              most-bought — plus the brands that share its active ingredient. Review mining mines
              verbatim customer reviews for the approved targets: on Amazon, per star band,
              where the target has a matched listing, and on its own Trustpilot page where it
              does not. A target with neither is not listed.
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
                    {target.url ? (
                      <>
                        {' · '}
                        <a className="small" href={target.url} target="_blank" rel="noreferrer">
                          {target.url.replace(/^https?:\/\/(www\.)?/, '')} ↗
                        </a>
                      </>
                    ) : null}
                    <ListingLine target={target} row={listings?.find((l) => l.target_id === target.id)} looking={looking} />
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="market">
              Reviews per star band
              <input
                type="number"
                min={REVIEWS_PER_BAND.min}
                max={REVIEWS_PER_BAND.max}
                step={1}
                value={perBand}
                onChange={(e) => setPerBand(e.target.value)}
              />
              <span className="muted small">
                {perBandValid
                  ? 'per star on Amazon (1–5 stars), and per target on Trustpilot'
                  : `a whole number from ${REVIEWS_PER_BAND.min} to ${REVIEWS_PER_BAND.max}; Amazon returns at most ${REVIEWS_PER_BAND.max} per star`}
              </span>
            </label>
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
                disabled={busy || selected.length === 0 || !perBandValid}
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
