import { useEffect, useState } from 'react';

import { api, type Config } from './api';
import ProductResults from './ProductResults';
import { useProducts } from './use-products';

export default function ProductPanels({ onError }: { onError: (message: string) => void }) {
  const { products } = useProducts(true, onError);
  const [open, setOpen] = useState<string | null>(null);
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    api.config().then(setConfig).catch(() => undefined);
  }, []);

  return (
    <section className="always">
      <h2>Products</h2>
      <p className="muted small">What the research found, per product: the newest stage 1, product truth and customer voice. Start new work with Start.</p>
      {products === null && <p className="muted small">Loading…</p>}
      {products?.length === 0 && <p className="muted small">No products yet. Press Start.</p>}
      <ul className="product-panels">
        {products?.map((p) => (
          <li key={p.id}>
            <button className="ghost product-panel-head" onClick={() => setOpen(open === p.id ? null : p.id)}>
              {open === p.id ? '▾' : '▸'} {p.label} <span className={`status ${p.latest_status}`}>{p.latest_status}</span>
              <span className="muted small"> · {p.run_count} runs · last {new Date(p.latest_at).toLocaleDateString()}</span>
            </button>
            {open === p.id && <ProductResults productId={p.id} requiredFields={config?.required_fields ?? {}} onError={onError} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
