import { adsShape, type AdFilter, type AdsAnalysis } from '../../api';

const VERDICT: Record<string, { mark: string; label: string }> = {
  supported: { mark: '✓', label: 'you already claim this' },
  needs_new_claim: { mark: '+', label: 'needs a claim you do not make yet' },
  does_not_apply: { mark: '×', label: 'not about your product' },
};

export default function FitStep({ analysis, onFilter }: { analysis: AdsAnalysis; onFilter: (filter: AdFilter) => void }) {
  const judged = [...analysis.angles].filter((angle) => angle.fit !== null).sort((a, b) => b.proven - a.proven);
  if (judged.length === 0) return <p className="dim small">No angle has been checked against your claims yet.</p>;
  return (
    <>
      <ul className="fits">
        {judged.map((angle) => {
          const verdict = VERDICT[angle.fit ?? ''];
          return (
            <li key={angle.key} className={`fit fit-${angle.fit}`}>
              <span className="fit-mark">{verdict?.mark}</span>
              <div>
                <button className="link-button" onClick={() => onFilter({ angle: angle.key })}><strong>{angle.name}</strong></button>{' '}
                <span className="dim small">· {angle.proven} proven · {verdict?.label}</span>
                <div className="small">{angle.fit_why}</div>
                {angle.fit_claims.length > 0 && <div className="small dim">Your claim: {angle.fit_claims.map((claim) => `“${claim}”`).join(' · ')}</div>}
                {angle.risk_share !== null && angle.risk_share > 0 && (
                  <div className="small error">{adsShape.pct(angle.risk_share)} of its proven ads make a claim that looks risky under FTC or Meta health rules.</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="dim small">Checked against the claims on your own product page. This says what you already say, not what you are allowed to say.</p>
    </>
  );
}
