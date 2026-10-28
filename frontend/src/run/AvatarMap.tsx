import type { StoredAvatar } from '../api';

const W = 640;
const H = 360;
const PAD = { left: 56, right: 24, top: 24, bottom: 44 };
const INSET = 28;
const pct = (value: number) => `${Math.round(value * 100)}%`;

export const gapOf = (avatar: StoredAvatar) => avatar.demand_share - (avatar.supply_share ?? 0);

export default function AvatarMap({ tops, onOpen }: { tops: StoredAvatar[]; onOpen: (id: string) => void }) {
  const max = Math.max(0.2, ...tops.map((a) => Math.max(a.supply_share ?? 0, a.demand_share))) * 1.1;
  const maxReviews = Math.max(1, ...tops.map((a) => a.review_count));
  const x = (v: number) => PAD.left + INSET + (v / max) * (W - PAD.left - PAD.right - INSET);
  const y = (v: number) => H - PAD.bottom - INSET - (v / max) * (H - PAD.top - PAD.bottom - INSET);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  return (
    <svg className="avatar-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Avatars by share of reviews against share of ads">
      <polygon points={`${x(0)},${y(0)} ${x(0)},${y(max)} ${x(max)},${y(max)}`} className="under" />
      <line x1={x(0)} y1={y(0)} x2={x(max)} y2={y(max)} className="parity" />
      <text x={x(max * 0.04)} y={y(max) + 16} className="quadrant-label">under-served: more buyers than ads</text>
      <text x={x(max) - 4} y={y(max * 0.45)} textAnchor="end" className="quadrant-label">crowded: more ads than buyers</text>
      {ticks.map((t) => (
        <g key={t} className="axis">
          <text x={x(t)} y={H - PAD.bottom + 16} textAnchor="middle">{pct(t)}</text>
          <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end">{pct(t)}</text>
        </g>
      ))}
      <line className="axis-line" x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} />
      <line className="axis-line" x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} />
      <text x={(W + PAD.left) / 2} y={H - 8} textAnchor="middle" className="axis-title">share of ads placed on it</text>
      <text transform={`translate(14 ${(H - PAD.bottom + PAD.top) / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">share of reviews</text>
      {tops.map((avatar, i) => {
        const r = 11 + 13 * Math.sqrt(avatar.review_count / maxReviews);
        const cx = x(avatar.supply_share ?? 0);
        const cy = y(avatar.demand_share);
        return (
          <g key={avatar.id} className="bubble" role="button" tabIndex={0} onClick={() => onOpen(avatar.id)} onKeyDown={(e) => e.key === 'Enter' && onOpen(avatar.id)}>
            <circle cx={cx} cy={cy} r={r + 6} className="hit" />
            <circle cx={cx} cy={cy} r={r} className={gapOf(avatar) >= 0 ? 'mark under' : 'mark over'} />
            <text x={cx} y={cy + 4} textAnchor="middle" className="bubble-number">{i + 1}</text>
            <title>{`${i + 1}. ${avatar.name}\n${avatar.review_count} reviews (${pct(avatar.demand_share)} of reviews)\n${avatar.ad_count} ads (${avatar.supply_share === null ? 'none' : pct(avatar.supply_share)} of ads)\nwin rate ${avatar.win_rate === null ? '—' : pct(avatar.win_rate)}`}</title>
          </g>
        );
      })}
    </svg>
  );
}
