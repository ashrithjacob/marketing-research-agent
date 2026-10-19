import type { StoredAvatar } from '../api';

const W = 720;
const H = 380;
const PAD = { left: 56, right: 40, top: 36, bottom: 44 };
const RAMP = ['#c7d7fe', '#8fb0ff', '#4d7cff', '#0052ff'];
const NO_ADS = '#cbd5e1';

function fill(winRate: number | null): string {
  if (winRate === null) return NO_ADS;
  return RAMP[Math.min(RAMP.length - 1, Math.floor(winRate * RAMP.length))];
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function AvatarMap({ avatars }: { avatars: StoredAvatar[] }) {
  const tops = avatars.filter((avatar) => avatar.parent_id === null);
  const maxX = Math.max(0.2, ...tops.map((a) => a.supply_share ?? 0)) * 1.1;
  const maxY = Math.max(0.2, ...tops.map((a) => a.demand_share)) * 1.1;
  const maxReviews = Math.max(1, ...tops.map((a) => a.review_count));
  const x = (v: number) => PAD.left + (v / maxX) * (W - PAD.left - PAD.right);
  const y = (v: number) => H - PAD.bottom - (v / maxY) * (H - PAD.top - PAD.bottom);
  const midX = x(maxX / 2);
  const midY = y(maxY / 2);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure className="avatar-map">
      <figcaption>
        <strong>Where buyers are and where ads are not.</strong> <span className="dim small">Up: more of the reviews. Right: more of the competitors' long-form ads. Size: reviews. Colour: share of its ads that are winning; grey, no ads.</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Avatars by demand share and supply share">
        <rect x={PAD.left} y={PAD.top} width={midX - PAD.left} height={midY - PAD.top} className="quadrant gap" />
        <rect x={midX} y={PAD.top} width={W - PAD.right - midX} height={midY - PAD.top} className="quadrant proven" />
        <text x={PAD.left + 4} y={PAD.top - 10} className="quadrant-label">gap: demand, few ads</text>
        <text x={W - PAD.right - 4} y={PAD.top - 10} textAnchor="end" className="quadrant-label">proven: demand and ads</text>
        {ticks.map((t) => (
          <g key={t} className="axis">
            <line x1={x(t * maxX)} x2={x(t * maxX)} y1={H - PAD.bottom} y2={H - PAD.bottom + 4} />
            <text x={x(t * maxX)} y={H - PAD.bottom + 16} textAnchor="middle">{pct(t * maxX)}</text>
            <line x1={PAD.left - 4} x2={PAD.left} y1={y(t * maxY)} y2={y(t * maxY)} />
            <text x={PAD.left - 8} y={y(t * maxY) + 4} textAnchor="end">{pct(t * maxY)}</text>
          </g>
        ))}
        <line className="axis-line" x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} />
        <line className="axis-line" x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} />
        <text x={(W + PAD.left) / 2} y={H - 8} textAnchor="middle" className="axis-title">supply: share of competitor ads</text>
        <text transform={`translate(14 ${(H - PAD.bottom + PAD.top) / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">demand: share of reviews</text>
        {tops.map((avatar) => {
          const r = 6 + 18 * Math.sqrt(avatar.review_count / maxReviews);
          const cx = x(avatar.supply_share ?? 0);
          const cy = y(avatar.demand_share);
          const right = cx > (PAD.left + W - PAD.right) / 2;
          return (
            <g key={avatar.id} className="bubble">
              <circle cx={cx} cy={cy} r={r + 6} className="hit" />
              <circle cx={cx} cy={cy} r={r} fill={fill(avatar.win_rate)} stroke="#fff" strokeWidth={2} />
              <text x={right ? cx - r - 6 : cx + r + 6} y={cy + 4} textAnchor={right ? 'end' : 'start'} className="bubble-label">
                {avatar.name}
              </text>
              <title>
                {`${avatar.name}\n${avatar.review_count} reviews (${pct(avatar.demand_share)} of demand)\n${avatar.ad_count} ads (${avatar.supply_share === null ? 'no ads read' : pct(avatar.supply_share)} of supply)\nwin rate ${avatar.win_rate === null ? '—' : pct(avatar.win_rate)}`}
              </title>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
