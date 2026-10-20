import { useEffect, useState } from 'react';

import { runs, type Config } from '../api';
import Activity from './Activity';
import Ads from './Ads';
import Avatars from './Avatars';
import Competitors from './Competitors';
import ConfirmPanel from './ConfirmPanel';
import ProductBrief from './ProductBrief';
import RerunPrompt from './RerunPrompt';
import Reviews from './Reviews';
import RunHeader from './RunHeader';
import StagesPanel from './StagesPanel';
import { useEvidence } from './use-evidence';
import { useRun } from './use-run';

export default function RunPage({ runId, onError }: { runId: string; onError: (message: string) => void }) {
  const { view, events, reload } = useRun(runId, onError);
  const [config, setConfig] = useState<Config | null>(null);
  useEffect(() => {
    runs.config().then(setConfig, (e: Error) => onError(e.message));
  }, [onError]);
  const stages = view?.run.stage_status;
  const version = `${stages?.reviews?.status}-${stages?.competitor_ads?.status}-${view?.competitors.length}`;
  const { coverage, ads } = useEvidence(runId, version, Boolean(view?.product), onError);

  if (!view || !config) return <div className="boot">Loading…</div>;
  const { run, product, competitors } = view;

  return (
    <div className="run">
      <RunHeader run={run} product={product} competitors={competitors} coverage={coverage} ads={ads} picture={view.visuals[run.resolution?.product.url ?? run.input.product_url ?? '']} onStop={() => runs.stop(runId).then(reload, (e: Error) => onError(e.message))} />
      <RerunPrompt run={run} stages={config.stages} onDone={reload} onError={onError} />
      {run.error && !run.product_id && <div className="error banner">{run.error}</div>}
      {run.status === 'resolving' && <p className="panel dim">Finding the product page and proposing competitors…</p>}
      {run.status === 'awaiting_confirmation' && run.resolution && <ConfirmPanel runId={runId} resolution={run.resolution} visuals={view.visuals} signals={view.signals} onDone={reload} onError={onError} />}
      <StagesPanel run={run} stages={config.stages} onDone={reload} onError={onError} />
      {product && <Avatars runId={runId} version={run.stage_status.avatars?.status ?? ''} onError={onError} />}
      {product && <Competitors product={product} competitors={competitors} coverage={coverage} ads={ads} />}
      {product && <ProductBrief product={product} />}
      {product && <Reviews runId={runId} product={product} competitors={competitors} coverage={coverage} onError={onError} />}
      <Ads ads={ads} competitors={competitors} />
      <Activity events={events} />
    </div>
  );
}
