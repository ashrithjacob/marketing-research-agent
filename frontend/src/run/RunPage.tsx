import { useEffect, useState } from 'react';

import { FINAL_STATUSES, runs, type Config } from '../api';
import Activity from './Activity';
import Ads from './Ads';
import Avatars from './Avatars';
import { Money, StatusBadge } from './badges';
import Competitors from './Competitors';
import ConfirmPanel from './ConfirmPanel';
import ProductBrief from './ProductBrief';
import Reviews from './Reviews';
import StageTracker from './StageTracker';
import { useRun } from './use-run';

export default function RunPage({ runId, onError }: { runId: string; onError: (message: string) => void }) {
  const { view, events, reload } = useRun(runId, onError);
  const [config, setConfig] = useState<Config | null>(null);
  useEffect(() => {
    runs.config().then(setConfig, (e: Error) => onError(e.message));
  }, [onError]);

  if (!view || !config) return <div className="boot">Loading…</div>;
  const { run, product, competitors } = view;
  const title = product?.name ?? run.resolution?.product.name ?? run.input.product_name ?? run.input.product_url;
  const stoppable = !FINAL_STATUSES.has(run.status) && run.status !== 'stopping';

  return (
    <div className="run">
      <section className="panel run-head">
        <div>
          <h1>{title}</h1>
          <p className="dim small">
            {run.input.markets.join(', ')} · {run.model} · started {new Date(run.created_at).toLocaleString()}
          </p>
        </div>
        <div className="run-actions">
          <StatusBadge status={run.status} />
          <Money usd={run.cost_usd} />
          {stoppable && (
            <button className="ghost" onClick={() => runs.stop(runId).then(reload, (e: Error) => onError(e.message))}>
              Stop
            </button>
          )}
          <a className="ghost" href={runs.traceUrl(runId)}>
            Trace
          </a>
        </div>
      </section>
      {run.error && <div className="error banner">{run.error}</div>}
      {run.status === 'resolving' && <p className="panel dim">Finding the product page and proposing competitors…</p>}
      {run.status === 'awaiting_confirmation' && run.resolution && <ConfirmPanel runId={runId} resolution={run.resolution} onDone={reload} onError={onError} />}
      <StageTracker stages={config.stages} states={run.stage_status} />
      {product && <ProductBrief product={product} />}
      {product && <Avatars runId={runId} version={run.stage_status.avatars?.status ?? ''} onError={onError} />}
      {product && <Competitors product={product} competitors={competitors} />}
      {product && <Reviews runId={runId} product={product} competitors={competitors} version={run.stage_status.reviews?.status ?? ''} onError={onError} />}
      {product && <Ads runId={runId} version={run.stage_status.competitor_ads?.status ?? ''} onError={onError} />}
      <Activity events={events} />
    </div>
  );
}
