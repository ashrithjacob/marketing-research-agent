import { useEffect, useState } from 'react';

import { runs, type Config, type RunSummary } from './api';
import BrandMark, { domainOf } from './BrandMark';
import NewAnalysis from './NewAnalysis';
import { Link, paths } from './route';
import { Money, StatusBadge } from './run/badges';

function RunRow({ run }: { run: RunSummary }) {
  const name = run.product?.name ?? run.resolution?.product.name ?? run.input.product_name ?? run.input.product_url ?? '';
  const brand = run.product?.brand || run.resolution?.product.brand || '';
  const url = run.resolution?.product.url ?? run.input.product_url ?? '';
  return (
    <li>
      <Link to={paths.run(run.id)} className="run-row">
        <BrandMark name={brand || name} src={run.product?.image_url ?? null} size={56} shape="square" />
        <div className="run-row-title">
          <div className="title-line">
            <BrandMark name={brand || name} src={run.product?.logo_url ?? null} size={18} />
            <strong>{brand ? `${brand} · ${name}` : name}</strong>
          </div>
          <div className="dim small">
            {url && domainOf(url)} · {run.input.markets.join(', ')} · {new Date(run.created_at).toLocaleDateString()}
          </div>
        </div>
        <div className="logo-stack" title={run.competitors.map((c) => c.brand).join(', ')}>
          {run.competitors.slice(0, 6).map((c, i) => (
            <BrandMark key={`${c.brand}-${i}`} name={c.brand} src={c.logo_url ?? c.image_url} size={26} />
          ))}
          {run.competitors.length > 6 && <span className="more">+{run.competitors.length - 6}</span>}
        </div>
        <div className="metric"><span className="value">{run.review_count}</span><span className="label">reviews</span></div>
        <div className="metric"><span className="value">{run.ad_count}</span><span className="label">ads</span></div>
        <div className="metric"><span className="value">{run.avatar_count}</span><span className="label">avatars</span></div>
        <div className="run-row-end">
          <StatusBadge status={run.status} />
          <Money usd={run.cost_usd} />
        </div>
      </Link>
    </li>
  );
}

export default function HomePage({ onError }: { onError: (message: string) => void }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [list, setList] = useState<RunSummary[] | null>(null);

  useEffect(() => {
    runs.config().then(setConfig, (e: Error) => onError(e.message));
    runs.list().then((r) => setList(r.runs), (e: Error) => onError(e.message));
  }, [onError]);

  return (
    <div className="home">
      <section className="panel hero-panel">
        <h1>Who buys, and which ads reach them</h1>
        <p className="dim">Give a product page or a product name. The agent finds the product and proposes competitors; you confirm them before any research is paid for.</p>
        {config && <NewAnalysis markets={config.markets} onError={onError} />}
      </section>
      <section className="panel flush">
        <div className="panel-head">
          <h2>Analyses</h2>
          <span className="count-chip">{list?.length ?? 0}</span>
        </div>
        {list === null && <p className="dim pad">Loading…</p>}
        {list?.length === 0 && <p className="dim pad">None yet.</p>}
        <ul className="run-rows">
          {list?.map((run) => <RunRow key={run.id} run={run} />)}
        </ul>
      </section>
    </div>
  );
}
