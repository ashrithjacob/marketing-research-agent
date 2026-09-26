import type { ProductSummary, RunSummary } from './api';
import { Link, paths } from './route';
import { NODE_ORDER, scopeLabel } from './StageRail';

export default function ProductRuns({
  product,
  runs,
  activeId,
}: {
  product: ProductSummary;
  runs: RunSummary[];
  activeId: string;
}) {
  return (
    <>
      <Link to={paths.products()} className="ghost folder-back">
        ← All products
      </Link>
      <h3 style={{ marginTop: 10 }}>
        {product.label} <span className="n">{runs.length}</span>
      </h3>
      <div className="runlist">
        {runs.map((r) => (
          <Link
            key={r.id}
            to={paths.run(product.id, r.id)}
            className={`runrow ${r.id === activeId ? 'active' : ''}`}
          >
            <div className="runrow-top">
              <span className="runrow-title">
                {r.nodes && r.nodes.length < NODE_ORDER.length ? scopeLabel(r.nodes) : 'Whole stage'}
              </span>
              <span className={`status ${r.status}`}>{r.status}</span>
            </div>
            <div className="runrow-sub">
              {new Date(r.created_at).toLocaleString()}
              {r.brief.market ? ` · ${r.brief.market}` : ''}
            </div>
            <div className="runrow-sub">
              {r.counts.competitors &&
                r.counts.competitors.direct + r.counts.competitors.indirect > 0 &&
                `${r.counts.competitors.direct} direct · ${r.counts.competitors.indirect} indirect · `}
              {r.counts.sources} sources · {r.counts.excerpts} excerpts · {r.counts.gaps} gaps
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
