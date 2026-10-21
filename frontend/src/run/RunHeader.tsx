import { FINAL_STATUSES, runs, type BrandVisual, type Competitor, type Product, type ReadAd, type ReviewCoverage, type Run } from '../api';
import BrandMark, { domainOf } from '../BrandMark';
import { Money, StatusBadge } from './badges';
import HeaderTiles from './HeaderTiles';

export default function RunHeader({ run, product, competitors, coverage, ads, picture, onStop }: { run: Run; product: Product | null; competitors: Competitor[]; coverage: ReviewCoverage[]; ads: ReadAd[]; picture: BrandVisual | undefined; onStop: () => void }) {
  const name = product?.name ?? run.resolution?.product.name ?? run.input.product_name ?? run.input.product_url ?? '';
  const brand = product?.brand || run.resolution?.product.brand || '';
  const url = product?.url ?? run.resolution?.product.url ?? run.input.product_url ?? '';
  const stoppable = !FINAL_STATUSES.has(run.status) && run.status !== 'stopping';
  return (
    <section className="panel run-header">
      <BrandMark name={brand || name} src={product?.image_url ?? picture?.image_url ?? null} size={112} shape="square" />
      <div className="run-header-body">
        <div className="title-line">
          <BrandMark name={brand || name} src={product?.logo_url ?? picture?.logo_url ?? null} size={24} />
          <h1>{brand ? `${brand} · ${name}` : name}</h1>
        </div>
        <p className="dim small">
          {url && (
            <a href={url} target="_blank" rel="noreferrer noopener">
              {domainOf(url)}
            </a>
          )}{' '}
          · {run.input.markets.join(', ')} · started {new Date(run.created_at).toLocaleString()}
        </p>
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
      <HeaderTiles product={product} competitors={competitors} coverage={coverage} ads={ads} />
    </section>
  );
}
