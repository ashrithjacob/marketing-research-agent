import { useEffect, useState } from 'react';

import { productCostsApi, type ProductCostsView } from '../../api';

const percent = (margin: number) => `${Math.round(margin * 1000) / 10}%`;

/** The owner's landed unit cost, asked on the Margin card because only they have it, and the gross margin it gives at each price product truth found. */
export function MarginInput({ productId }: { productId: string }) {
  const [view, setView] = useState<ProductCostsView | null>(null);
  const [editing, setEditing] = useState(false);
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState('');

  useEffect(() => {
    productCostsApi
      .get(productId)
      .then(setView)
      .catch((e: Error) => setError(e.message));
  }, [productId]);

  const save = async () => {
    setError('');
    try {
      setView(await productCostsApi.save(productId, Number(cost), currency));
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!view) return error ? <p className="muted small">{error}</p> : null;
  if (view.costs && !editing) {
    return (
      <div className="margin-input">
        <p className="small">
          Your landed cost: <b>{view.costs.landed_unit_cost} {view.costs.currency}</b> a unit{' '}
          <button className="linkish" onClick={() => (setCost(String(view.costs!.landed_unit_cost)), setCurrency(view.costs!.currency), setEditing(true))}>
            change
          </button>
        </p>
        {view.margins.length === 0 && <p className="muted small">Product truth found no prices to work a margin out at.</p>}
        <ul className="margin-list small">
          {view.margins.map((m) => (
            <li key={`${m.label}-${m.subscription}`}>
              {m.label}: {m.unit_price} {m.currency} a unit → {m.margin === null ? <span className="muted">{m.why}</span> : <b>{percent(m.margin)} gross margin</b>}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="margin-input">
      <p className="small">Only you know what one unit costs you landed. Enter it to see your gross margin at each price.</p>
      <div className="margin-form">
        <input type="number" min="0" step="0.01" placeholder="Landed cost per unit" value={cost} onChange={(e) => setCost(e.target.value)} />
        <input className="currency" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        <button onClick={save} disabled={!(Number(cost) > 0) || currency.length !== 3}>
          Save
        </button>
      </div>
      {error && <p className="muted small">{error}</p>}
    </div>
  );
}
