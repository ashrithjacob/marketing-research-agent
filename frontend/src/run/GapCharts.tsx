import type { StoredAvatar } from '../api';
import { gapOf } from './AvatarMap';

const pct = (v: number | null) => `${Math.round((v ?? 0) * 100)}%`;
const KINDS: { key: string; label: string }[] = [
  { key: 'pain', label: 'Pains' },
  { key: 'desire', label: 'Desires' },
  { key: 'trigger', label: 'Triggers' },
  { key: 'objection', label: 'Objections' },
  { key: 'outcome', label: 'Outcomes' },
  { key: 'prior_solution', label: 'Tried before' },
];

export function GapSummary({ tops }: { tops: StoredAvatar[] }) {
  if (tops.length === 0) return null;
  const under = tops[0]!;
  const crowded = tops[tops.length - 1]!;
  const noAds = tops.filter((a) => a.ad_count === 0);
  const themes = tops.flatMap((a) => a.profile.gaps ?? []);
  const topKind = KINDS.map((k) => ({ ...k, n: themes.filter((t) => t.kind === k.key).length })).sort((a, b) => b.n - a.n)[0]!;
  return (
    <div className="tiles gap-summary">
      <div className="tile"><span className="small dim">Most under-served</span><strong>{under.name}</strong><span className="small">{pct(under.demand_share)} of reviews, {pct(under.supply_share)} of ads</span></div>
      <div className="tile"><span className="small dim">Most crowded</span><strong>{crowded.name}</strong><span className="small">{pct(crowded.demand_share)} of reviews, {pct(crowded.supply_share)} of ads</span></div>
      <div className="tile"><span className="small dim">No ads at all</span><strong>{noAds.length === 0 ? 'none' : noAds.length}</strong><span className="small">{noAds.map((a) => a.name).join(', ') || 'every avatar has an ad'}</span></div>
      <div className="tile"><span className="small dim">Themes the ads leave out</span><strong>{themes.length}</strong><span className="small">{topKind.n > 0 ? `most are ${topKind.label.toLowerCase()} (${topKind.n})` : 'none found'}</span></div>
    </div>
  );
}

export function GapBars({ tops, onOpen }: { tops: StoredAvatar[]; onOpen: (id: string) => void }) {
  const max = Math.max(0.01, ...tops.map((a) => Math.abs(gapOf(a))));
  return (
    <ol className="gap-bars">
      {tops.map((avatar, i) => {
        const gap = gapOf(avatar);
        const width = `${(Math.abs(gap) / max) * 50}%`;
        return (
          <li key={avatar.id}>
            <button className="gap-bar-row" onClick={() => onOpen(avatar.id)}>
              <span className="gap-name"><span className="key-number">{i + 1}</span>{avatar.name}</span>
              <span className="diverging">
                <span className="midline" />
                <span className={gap >= 0 ? 'fill under' : 'fill over'} style={gap >= 0 ? { left: '50%', width } : { right: '50%', width }} />
              </span>
              <span className="small">{gap >= 0 ? '+' : '−'}{pct(Math.abs(gap))} <span className="dim">{gap >= 0 ? 'under-served' : 'crowded'}</span></span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function ThemeMatrix({ tops, onOpen }: { tops: StoredAvatar[]; onOpen: (id: string) => void }) {
  const count = (a: StoredAvatar, kind: string) => (a.profile.gaps ?? []).filter((t) => t.kind === kind).length;
  const max = Math.max(1, ...tops.flatMap((a) => KINDS.map((k) => count(a, k.key))));
  return (
    <div className="matrix-wrap">
      <table className="theme-matrix">
        <thead>
          <tr><th />{KINDS.map((k) => <th key={k.key} className="small dim">{k.label}</th>)}<th className="small dim">All</th></tr>
        </thead>
        <tbody>
          {tops.map((avatar, i) => (
            <tr key={avatar.id} onClick={() => onOpen(avatar.id)}>
              <th><button className="link-button"><span className="key-number">{i + 1}</span>{avatar.name}</button></th>
              {KINDS.map((k) => {
                const n = count(avatar, k.key);
                return <td key={k.key} style={{ background: n ? `rgba(0, 82, 255, ${0.08 + (0.5 * n) / max})` : undefined }}>{n || ''}</td>;
              })}
              <td><strong>{(avatar.profile.gaps ?? []).length}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
