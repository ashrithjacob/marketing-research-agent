import { STAGE_STORY, stageOverview, stageTabs, type StageNumber } from '../api';
import { navigate, paths } from '../route';
import StageDetail from './StageDetail';
import StageStats from './StageStats';
import { useStageRuns } from './use-stage-runs';

export default function StageView({ brandKey, brandLabel, productId, stage, tab, requiredFields, onError }: { brandKey: string; brandLabel: string; productId: string; stage: StageNumber; tab: string; requiredFields: Record<string, string[]>; onError: (message: string) => void }) {
  const stages = useStageRuns(productId, onError);
  const { summary, run } = stages.find((s) => s.stage === stage)!;
  const tabs = stageTabs(stage, run);
  const current = tabs.some((t) => t.key === tab) ? tab : tabs[0]!.key;
  const overview = run ? stageOverview(stage, run) : null;
  return (
    <div className="stage-view">
      <nav className="crumbs">
        <button className="crumb" onClick={() => navigate(paths.brand(brandKey))}>
          {brandLabel}
        </button>
        <span aria-hidden>›</span>
        <span>
          Stage {stage} · {STAGE_STORY[stage].title}
        </span>
        {summary && <span className={`status ${summary.status}`}>{summary.status}</span>}
        {summary && <span className="muted small">{new Date(summary.created_at).toLocaleString()}</span>}
      </nav>
      {!summary && <p className="muted small">{stages.every((s) => !s.summary) ? 'Loading…' : 'This stage has not run for this product.'}</p>}
      {overview && (
        <div className="stage-view-head">
          <p className="stage-read">{overview.read}</p>
          <StageStats stats={overview.stats} />
        </div>
      )}
      {summary && (
        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={t.key === current} className={`tab${t.key === current ? ' on' : ''}`} onClick={() => navigate(paths.stage(brandKey, productId, stage, t.key))}>
              {t.label}
              {t.count !== undefined && <span className="tab-count">{t.count}</span>}
            </button>
          ))}
        </div>
      )}
      {summary && !run && <p className="muted small">Loading…</p>}
      {run && (
        <div className="stage-tab-body">
          <StageDetail key={current} stage={stage} tab={current} run={run} requiredFields={requiredFields} />
        </div>
      )}
    </div>
  );
}
