import type { Run, StageInfo } from '../api';
import BrandMark from '../BrandMark';
import { Link, paths } from '../route';

export const STAGE_SECTIONS: Record<string, string> = { product_market: 'product', reviews: 'reviews', competitor_ads: 'ads', sophistication: 'market', avatars: 'avatars' };

const SHORT_TITLES: Record<string, string> = { product_market: 'Product & market', reviews: 'Reviews', competitor_ads: 'Long-form ads', sophistication: 'Market awareness', avatars: 'Avatars' };

export function sectionOf(stage: string): string {
  return STAGE_SECTIONS[stage] ?? stage;
}

function compact(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : String(value);
}

export default function RunNav({ run, title, brand, image, stages, section, counts }: { run: Run; title: string; brand: string; image: string | null; stages: StageInfo[]; section: string | null; counts: Record<string, number | null> }) {
  return (
    <>
      <div className="sidebar-group">This analysis</div>
      <div className="sidebar-run">
        <BrandMark name={brand || title} src={image} size={32} shape="square" />
        <span className="sidebar-run-name">
          <strong>{title}</strong>
          <span>{brand}</span>
        </span>
      </div>
      <Link to={paths.run(run.id)} className={`sidebar-item ${section === null ? 'active' : ''}`}>
        <span className="sidebar-icon">◎</span>
        <span className="sidebar-label">Overview</span>
        <span className={`sidebar-dot status-${run.status}`} title={run.status.replace(/_/g, ' ')} />
      </Link>
      <div className="sidebar-group">Stages</div>
      {stages
        .filter((stage) => stage.built)
        .map((stage) => {
          const status = run.stage_status[stage.name]?.status ?? 'pending';
          const count = counts[stage.name];
          return (
            <Link key={stage.name} to={paths.run(run.id, sectionOf(stage.name))} className={`sidebar-item ${section === sectionOf(stage.name) ? 'active' : ''}`}>
              <span className="sidebar-icon sidebar-number">{stage.number}</span>
              <span className="sidebar-label" title={stage.title}>
                {SHORT_TITLES[stage.name] ?? stage.title}
              </span>
              {count !== null && count !== undefined && count > 0 && <span className="sidebar-count">{compact(count)}</span>}
              <span className={`sidebar-dot status-${status}`} title={status.replace(/_/g, ' ')} />
            </Link>
          );
        })}
    </>
  );
}
