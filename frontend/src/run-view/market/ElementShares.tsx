import type { ElementShare } from '../../api';

const MEANS: Record<ElementShare['element'], string> = {
  claim: 'a big, direct promise',
  amplifier: 'the promise made faster, bigger, easier, or without a downside',
  mechanism: 'how it works',
  proof: 'testimonials, customer counts, before and afters, experts, studies',
  identity: "shifting what buyers believe about themselves: it's not your fault",
};

/** What competitors' ads already do to persuade, one row per element in stage order, with how many brands do it; the stage is the most advanced one at least half do. */
export function ElementShares({ shares }: { shares: ElementShare[] }) {
  if (shares.length === 0) return null;
  return (
    <div className="element-shares">
      <p className="muted small">What competitors' ads already do to persuade, across {shares[0].of} brands:</p>
      {shares.map((share, i) => (
        <div key={share.element} className={`element-share${share.brands * 2 >= share.of ? ' common' : ''}`}>
          <span className="element-stage">Stage {i + 1}</span>
          <span className="element-name">
            <b>{share.element}</b> <span className="muted small">{MEANS[share.element]}</span>
          </span>
          <span className="element-bar">
            <span style={{ width: `${(share.brands / Math.max(share.of, 1)) * 100}%` }} />
          </span>
          <span className="small">
            {share.brands} of {share.of}
          </span>
        </div>
      ))}
    </div>
  );
}
