import { adsShape, type AdFilter, type AdsAnalysis } from '../../api';

const LABELS: Record<string, string> = { claim_type: 'claim', awareness: 'opening assumes', proof: 'proof', offer: 'offer', emotion: 'leads with', landing: 'lands on', structure: 'copy built as' };

export default function AnatomyStep({ analysis, onFilter }: { analysis: AdsAnalysis; onFilter: (filter: AdFilter) => void }) {
  const ranked = analysis.labels.filter((row) => row.ranked);
  const thin = analysis.labels.filter((row) => !row.ranked);
  const kinds = new Set(analysis.labels.map((row) => row.label));
  return (
    <>
      <table className="claims">
        <thead>
          <tr>
            <th>Label</th>
            <th className="num">In proven</th>
            <th className="num">In the rest</th>
            <th className="num">Difference</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((row) => (
            <tr key={`${row.label}:${row.value}`} className="clickable" onClick={() => onFilter({ [row.label]: row.value })}>
              <td>{LABELS[row.label] ?? row.label}: <strong>{adsShape.words(row.value)}</strong></td>
              <td className="num">{adsShape.pct(row.proven_share)} <span className="dim">({row.proven})</span></td>
              <td className="num">{adsShape.pct(row.rest_share)} <span className="dim">({row.rest})</span></td>
              <td className={`num ${row.difference > 0 ? 'up' : 'down'}`}>{row.difference > 0 ? '+' : ''}{Math.round(row.difference * 100)} pts</td>
            </tr>
          ))}
        </tbody>
      </table>
      {thin.length > 0 && (
        <details className="small">
          <summary className="dim">{thin.length} values on fewer than five ads, not ranked</summary>
          <p className="dim">{thin.map((row) => `${LABELS[row.label] ?? row.label}: ${adsShape.words(row.value)} (${row.proven} proven, ${row.rest} rest)`).join(' · ')}</p>
        </details>
      )}
      {!kinds.has('proof') && <p className="dim small">Proof, offer, landing page and structure are not counted for this run: its ads were read before those labels existed. A stage 3 rerun reads them again.</p>}
      <p className="dim small">The scout keeps ads worth studying, which favours long runners, so the rest is not a fair sample of what failed. Read a difference as a lead, not a law.</p>
    </>
  );
}
