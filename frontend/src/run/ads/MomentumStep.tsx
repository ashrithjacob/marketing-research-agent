import type { AdFilter, AdsAnalysis } from '../../api';

const TREND: Record<string, string> = { rising: '↑ rising', fading: '↓ fading', steady: 'steady' };

export default function MomentumStep({ analysis, onFilter }: { analysis: AdsAnalysis; onFilter: (filter: AdFilter) => void }) {
  const most = Math.max(1, ...analysis.angles.map((angle) => angle.ads));
  const launching = analysis.brands.filter((brand) => brand.launched_60d > 0).sort((a, b) => b.launched_60d - a.launched_60d);
  return (
    <>
      {analysis.angles.length > 0 && (
      <table className="claims">
        <thead>
          <tr>
            <th>Angle</th>
            <th>Launched: last 30 days · 31–60 days · older</th>
            <th className="num">30 days</th>
            <th className="num">60 days</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
          {analysis.angles.map((angle) => (
            <tr key={angle.key} className="clickable" onClick={() => onFilter({ angle: angle.key })}>
              <td>{angle.name}</td>
              <td>
                <div className="launch-bar" style={{ width: `${(angle.ads / most) * 100}%` }}>
                  <span className="launch-30" style={{ flex: angle.launched_30d }} />
                  <span className="launch-60" style={{ flex: angle.launched_60d - angle.launched_30d }} />
                  <span className="launch-old" style={{ flex: angle.ads - angle.launched_60d }} />
                </div>
              </td>
              <td className="num">{angle.launched_30d}</td>
              <td className="num">{angle.launched_60d}</td>
              <td className={`trend-${angle.trend}`}>{TREND[angle.trend]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
      {launching.length > 0 && (
        <p className="small">
          Launching now:{' '}
          {launching.slice(0, 8).map((brand, i) => (
            <span key={brand.domain}>
              {i > 0 && ', '}
              <button className="link-button" onClick={() => onFilter({ brand: brand.domain })}>{brand.domain}</button> {brand.launched_60d} in 60 days{brand.competitor ? ' (competitor)' : ''}
            </span>
          ))}
        </p>
      )}
      <p className="dim small">Counted from the kept ads' first-seen dates against {analysis.as_of}. The scout keeps a brand's best ads, at most 15, so this shows which angles a brand's recent ads are on, not how many it launches.</p>
    </>
  );
}
