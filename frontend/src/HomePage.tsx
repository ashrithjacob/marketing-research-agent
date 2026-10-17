import { useEffect, useState } from 'react';

import { runs, type Config, type Run } from './api';
import NewAnalysis from './NewAnalysis';
import { Link, paths } from './route';
import { Money, StatusBadge } from './run/badges';

export default function HomePage({ onError }: { onError: (message: string) => void }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [list, setList] = useState<Run[] | null>(null);

  useEffect(() => {
    runs.config().then(setConfig, (e: Error) => onError(e.message));
    runs.list().then((r) => setList(r.runs), (e: Error) => onError(e.message));
  }, [onError]);

  return (
    <div className="home">
      <section className="panel">
        <h1>New analysis</h1>
        <p className="dim">Give a product page or a product name. The agent finds the product and proposes competitors; you confirm them before any research is paid for.</p>
        {config && <NewAnalysis markets={config.markets} onError={onError} />}
      </section>
      <section className="panel">
        <h2>Analyses</h2>
        {list === null && <p className="dim">Loading…</p>}
        {list?.length === 0 && <p className="dim">None yet.</p>}
        <ul className="runs">
          {list?.map((run) => (
            <li key={run.id}>
              <Link to={paths.run(run.id)}>
                <span className="title">{run.resolution?.product.name ?? run.input.product_name ?? run.input.product_url}</span>
                <StatusBadge status={run.status} />
                <span className="dim small">{new Date(run.created_at).toLocaleString()}</span>
                <Money usd={run.cost_usd} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
