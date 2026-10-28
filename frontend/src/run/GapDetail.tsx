import type { AvatarQuote, StoredAvatar } from '../api';
import { gapOf } from './AvatarMap';

const KIND: Record<string, string> = { pain: 'Pain', desire: 'Desire', trigger: 'Trigger', objection: 'Objection', outcome: 'Outcome', prior_solution: 'Tried before' };
const pct = (v: number | null) => `${Math.round((v ?? 0) * 100)}%`;

function Shares({ avatar }: { avatar: StoredAvatar }) {
  return (
    <div className="gap-shares small">
      <span className="dim">Reviews</span>
      <span className="gap-bar"><span style={{ width: pct(avatar.demand_share), background: 'var(--series-1)' }} /></span>
      <span>{pct(avatar.demand_share)} ({avatar.review_count})</span>
      <span className="dim">Ads</span>
      <span className="gap-bar"><span style={{ width: pct(avatar.supply_share), background: 'var(--series-2)' }} /></span>
      <span>{pct(avatar.supply_share)} ({avatar.ad_count})</span>
    </div>
  );
}

export default function GapDetail({ avatar, quotes, onBack }: { avatar: StoredAvatar; quotes: AvatarQuote[]; onBack: () => void }) {
  const gaps = avatar.profile.gaps ?? [];
  const cited = quotes.filter((q) => q.kind === 'gap');
  const gap = gapOf(avatar);
  return (
    <section className="panel avatar-detail">
      <nav className="crumbs small" aria-label="Breadcrumb">
        <button className="link" onClick={onBack}>All gaps</button> › <span>{avatar.name}</span>
      </nav>
      <div className="competitor-head">
        <h2>{avatar.name}</h2>
        {avatar.standing === 'emerging' && <span className="badge">emerging</span>}
        {avatar.ad_count === 0 && <span className="badge">no ads</span>}
      </div>
      <p className="small dim">
        {gap >= 0 ? `Under-served by ${pct(gap)}: its share of the reviews is larger than its share of the ads.` : `Crowded by ${pct(-gap)}: its share of the ads is larger than its share of the reviews.`}
      </p>
      <Shares avatar={avatar} />
      <section className="detail-block">
        <h3>What its reviews say that its ads do not</h3>
        {gaps.length === 0 && <p className="small dim">No theme its reviews raise that its ads leave out.</p>}
        {gaps.map((theme) => (
          <details key={theme.theme} className="gap-theme">
            <summary><span className="badge faint">{KIND[theme.kind] ?? theme.kind}</span> {theme.theme} <span className="small dim">{theme.review_ids.length} {theme.review_ids.length === 1 ? 'review' : 'reviews'}</span></summary>
            <ul className="quotes">
              {theme.review_ids.map((id) => cited.find((q) => q.review_id === id)).filter((q): q is AvatarQuote => q !== undefined).map((q) => (
                <li key={q.review_id} className="small">“{q.body}” <span className="dim">{q.rating}★</span></li>
              ))}
            </ul>
          </details>
        ))}
      </section>
    </section>
  );
}
