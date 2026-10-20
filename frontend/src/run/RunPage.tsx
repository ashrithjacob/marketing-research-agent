import { useEffect, useState, type ReactNode } from 'react';

import { runs, type Config } from '../api';
import Activity from './Activity';
import Ads from './Ads';
import Avatars from './Avatars';
import Market from './Market';
import Competitors from './Competitors';
import ConfirmPanel from './ConfirmPanel';
import ProductBrief from './ProductBrief';
import RerunPrompt from './RerunPrompt';
import Reviews from './Reviews';
import RunHeader from './RunHeader';
import RunNav, { sectionOf } from './RunNav';
import StagesPanel from './StagesPanel';
import StageTracker from './StageTracker';
import { useEvidence } from './use-evidence';
import { useRun } from './use-run';

export default function RunPage({ runId, section, frame, onError }: { runId: string; section: string | null; frame: (nav: ReactNode, body: ReactNode) => ReactNode; onError: (message: string) => void }) {
  const { view, events, reload } = useRun(runId, onError);
  const [config, setConfig] = useState<Config | null>(null);
  useEffect(() => {
    runs.config().then(setConfig, (e: Error) => onError(e.message));
  }, [onError]);
  const stages = view?.run.stage_status;
  const version = `${stages?.reviews?.status}-${stages?.competitor_ads?.status}-${view?.competitors.length}`;
  const { coverage, ads } = useEvidence(runId, version, Boolean(view?.product), onError);

  if (!view || !config) return frame(null, <div className="boot">Loading…</div>);
  const { run, product, competitors } = view;

  const picture = view.visuals[run.resolution?.product.url ?? run.input.product_url ?? ''];
  const title = product?.name ?? run.resolution?.product.name ?? run.input.product_name ?? run.input.product_url ?? 'New analysis';
  const brand = product?.brand ?? run.resolution?.product.brand ?? '';
  const reviewCount = coverage.reduce((sum, row) => sum + Number(row.reviews), 0);
  const counts = { product_market: competitors.length, reviews: reviewCount, competitor_ads: ads.length, avatars: null };
  const stage = config.stages.find((info) => section !== null && sectionOf(info.name) === section);
  const nav = <RunNav run={run} title={title} brand={brand} image={product?.image_url ?? picture?.image_url ?? null} stages={config.stages} section={section} counts={counts} />;

  const body = (
    <div className="run">
      <RunHeader run={run} product={product} competitors={competitors} coverage={coverage} ads={ads} picture={picture} onStop={() => runs.stop(runId).then(reload, (e: Error) => onError(e.message))} />
      {section === null && (
        <>
          <RerunPrompt run={run} stages={config.stages} onDone={reload} onError={onError} />
          {run.error && !run.product_id && <div className="error banner">{run.error}</div>}
          {run.status === 'resolving' && <p className="panel dim">Finding the product page and proposing competitors…</p>}
          {run.status === 'awaiting_confirmation' && run.resolution && <ConfirmPanel runId={runId} resolution={run.resolution} visuals={view.visuals} signals={view.signals} onDone={reload} onError={onError} />}
          <StagesPanel run={run} stages={config.stages} onDone={reload} onError={onError} />
          <Activity events={events} />
        </>
      )}
      {stage && <StageTracker stages={[stage]} states={run.stage_status} />}
      {section === 'product' && product && (
        <>
          <ProductBrief product={product} />
          <Competitors product={product} competitors={competitors} coverage={coverage} ads={ads} />
        </>
      )}
      {section === 'reviews' && product && <Reviews runId={runId} product={product} competitors={competitors} coverage={coverage} onError={onError} />}
      {section === 'ads' && <Ads ads={ads} competitors={competitors} />}
      {section === 'market' && product && <Market runId={runId} version={run.stage_status.sophistication?.status ?? ''} onError={onError} />}
      {section === 'avatars' && product && <Avatars runId={runId} version={run.stage_status.avatars?.status ?? ''} onError={onError} />}
      {section !== null && !product && <p className="panel dim">Nothing here yet: this stage runs once the product is confirmed.</p>}
    </div>
  );
  return frame(nav, body);
}
