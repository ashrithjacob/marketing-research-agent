import { useState } from 'react';
import { api, type Brief, type ProductTruthInputs, type RunSummary } from './api';
import { STAGE_NODES } from './stages';

type PriceDraft = { label: string; amount: string; currency: string; units: string; subscription: boolean };

const blankPrice: PriceDraft = { label: '', amount: '', currency: 'USD', units: '1', subscription: false };

function numberOrNull(value: string): number | null {
  const n = Number(value);
  return value.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

/** Product truth's start: the costs only the operator knows, each optional — a blank is recorded as a gap, never estimated. */
export default function ProductTruthStart({
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
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [moq, setMoq] = useState('');
  const [leadTime, setLeadTime] = useState('');
  const [prices, setPrices] = useState<PriceDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const edit = (i: number, change: Partial<PriceDraft>) => setPrices((all) => all.map((p, j) => (j === i ? { ...p, ...change } : p)));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const inputs: ProductTruthInputs = {
      landed_unit_cost: numberOrNull(cost),
      currency: currency.trim().toUpperCase(),
      moq: numberOrNull(moq),
      lead_time_days: numberOrNull(leadTime),
      prices: prices
        .filter((p) => p.label.trim() && numberOrNull(p.amount) !== null)
        .map((p) => ({ label: p.label.trim(), amount: Number(p.amount), currency: p.currency.trim().toUpperCase(), units: Math.max(1, Math.trunc(Number(p.units) || 1)), subscription: p.subscription })),
    };
    try {
      await onStarted(await api.startRun(brief, STAGE_NODES[2], [], inputs));
    } catch (e) {
      setError((e as Error).message);
      await onFailed();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Stage 2 · Product truth</h2>
        <p className="lede">
          Five agents assess the product stage 1 found, in isolation: its formula, how each active works, its dose
          against the studies, what it may claim on Meta and Google Ads in {brief.market || 'the brief’s markets'}, and
          its prices. Code computes every ratio, dose class, day count and margin. Searching and reading go through
          Parallel; no Apify.
        </p>
        <fieldset className="markets">
          <legend>Your costs — leave blank what you do not know yet</legend>
          <div className="row">
            <input id="landed-cost" placeholder="Landed cost per unit" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
            <input id="landed-currency" placeholder="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
          <div className="row">
            <input id="moq" placeholder="MOQ (units)" inputMode="numeric" value={moq} onChange={(e) => setMoq(e.target.value)} />
            <input id="lead-time" placeholder="Lead time (days)" inputMode="numeric" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
          </div>
        </fieldset>
        <p className="muted small">
          {numberOrNull(cost) === null
            ? 'With no landed cost, every margin is gapped rather than estimated.'
            : 'Margins are computed per unit at each price in the same currency as this cost.'}
        </p>
        <fieldset className="markets">
          <legend>Prices to add — the agent records the store’s own</legend>
          {prices.map((p, i) => (
            <div key={i} className="row">
              <input placeholder="Label, e.g. 3 bottles" value={p.label} onChange={(e) => edit(i, { label: e.target.value })} />
              <input placeholder="Amount" inputMode="decimal" value={p.amount} onChange={(e) => edit(i, { amount: e.target.value })} />
              <input placeholder="Currency" value={p.currency} onChange={(e) => edit(i, { currency: e.target.value })} />
              <input placeholder="Units" inputMode="numeric" value={p.units} onChange={(e) => edit(i, { units: e.target.value })} />
              <label className="market">
                <input type="checkbox" checked={p.subscription} onChange={(e) => edit(i, { subscription: e.target.checked })} />
                subscription
              </label>
            </div>
          ))}
          <button type="button" className="ghost" onClick={() => setPrices((all) => [...all, blankPrice])}>
            Add a price
          </button>
        </fieldset>
        {error && <p className="error small">{error}</p>}
        <div className="row">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Starting…' : 'Start product truth'}
          </button>
        </div>
      </form>
    </div>
  );
}
