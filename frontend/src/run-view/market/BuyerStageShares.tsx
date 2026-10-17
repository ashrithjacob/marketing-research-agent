import type { BuyerStageShare } from '../../api';

const MEANS: Record<BuyerStageShare['stage'], string> = {
  beginner: 'the problem is new; they have barely looked',
  explorer: 'has seen or tried a little, open to options',
  researcher: 'reads labels, compares, asks how it works',
  skeptic: 'tried things that failed, wants proof',
  hopeless: 'believes nothing works for them',
};

/** Where the buyers stand, from their own reviews and posts: the customer side of the same five stages. */
export function BuyerStageShares({ shares }: { shares: BuyerStageShare[] }) {
  if (shares.length === 0) return null;
  return (
    <div className="element-shares">
      <p className="muted small">Where buyers stand, from {shares[0].of} customer reviews and posts read:</p>
      {shares.map((share, i) => (
        <div key={share.stage} className={`element-share${share.voices * 2 >= share.of ? ' common' : ''}`}>
          <span className="element-stage">Stage {i + 1}</span>
          <span className="element-name">
            <b>{share.stage}</b> <span className="muted small">{MEANS[share.stage]}</span>
          </span>
          <span className="element-bar">
            <span style={{ width: `${(share.voices / Math.max(share.of, 1)) * 100}%` }} />
          </span>
          <span className="small">
            {share.voices} of {share.of}
          </span>
        </div>
      ))}
    </div>
  );
}
