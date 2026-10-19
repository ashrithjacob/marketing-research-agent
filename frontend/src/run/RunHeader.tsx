import { FINAL_STATUSES, runs, type Competitor, type Product, type ReadAd, type ReviewCoverage, type Run } from '../api';
import BrandMark, { domainOf } from '../BrandMark';
import { Money, StatusBadge } from './badges';

function Tile({ value, label, note }: { value: string | number; label: string; note?: string }) {
  return (
    <div className="tile">
      <span className="value">{value}</span>
      <span className="label">{label}</span>
      {note && <span className="note">{note}</span>}
    </div>
  );
}

export default function RunHeader({ run, product, competitors, coverage, ads, onStop }: { run: Run; product: Product | null; competitors: Competitor[]; coverage: ReviewCoverage[]; ads: ReadAd[]; onStop: () => void }) {
  const name = product?.name ?? run.resolution?.product.name ?? run.input.product_name ?? run.input.product_url ?? '';
  const brand = product?.brand || run.resolution?.product.brand || '';
  const url = product?.url ?? run.resolution?.product.url ?? run.input.product_url ?? '';
  const reviews = coverage.reduce((sum, row) => sum + Number(row.reviews), 0);
  const winning = ads.filter((ad) => ad.bucket === 'winning').length;
  const stoppable = !FINAL_STATUSES.has(run.status) && run.status !== 'stopping';
  return (
    <section className="panel run-header">
      <BrandMark name={brand || name} src={product?.image_url ?? null} size={112} shape="square" />
      <div className="run-header-body">
        <div className="title-line">
          <BrandMark name={brand || name} src={product?.logo_url ?? null} size={24} />
          <h1>{brand ? `${brand} · ${name}` : name}</h1>
        </div>
        <p className="dim small">
          {url && (
            <a href={url} target="_blank" rel="noreferrer noopener">
              {domainOf(url)}
            </a>
          )}{' '}
          · {run.input.markets.join(', ')} · {run.model} · started {new Date(run.created_at).toLocaleString()}
        </p>
        <div className="tiles">
          <Tile value={competitors.length} label="competitors" note={`${competitors.filter((c) => c.relationship === 'direct').length} direct`} />
          <Tile value={reviews} label="reviews" />
          <Tile value={ads.length} label="long-form ads" note={ads.length > 0 ? `${winning} winning` : undefined} />
          <Tile value={product?.ingredients.length ?? 0} label="ingredients" />
        </div>
      </div>
      <div className="run-actions">
        <StatusBadge status={run.status} />
        <Money usd={run.cost_usd} />
        {stoppable && (
          <button className="ghost" onClick={onStop}>
            Stop
          </button>
        )}
        <a className="ghost" href={runs.traceUrl(run.id)}>
          Trace
        </a>
      </div>
    </section>
  );
}
