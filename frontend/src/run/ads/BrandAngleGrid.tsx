import type { AdFilter, AdsAnalysis } from '../../api';

export default function BrandAngleGrid({ analysis, onFilter }: { analysis: AdsAnalysis; onFilter: (filter: AdFilter) => void }) {
  const open = analysis.angles.filter((angle) => angle.proven > 0 && angle.brands.length <= 2);
  return (
    <div className="brand-grid">
      {open.length > 0 && (
        <p className="small">
          <strong>Open angles</strong> (proven, but run by two brands or fewer): {open.map((angle) => angle.name).join(', ')}
        </p>
      )}
      <table className="claims grid">
        <thead>
          <tr>
            <th>Brand</th>
            {analysis.angles.map((angle) => <th key={angle.key} className="num" title={angle.description}>{angle.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {analysis.brands.map((brand) => (
            <tr key={brand.domain}>
              <td>
                {brand.domain} {brand.competitor && <span className="badge">competitor</span>}
              </td>
              {analysis.angles.map((angle) => {
                const cell = brand.cells[angle.key];
                if (!cell) return <td key={angle.key} className="num dim">·</td>;
                const tone = cell.proven === 0 ? 'cold' : cell.proven * 2 >= cell.ads ? 'hot' : 'warm';
                return (
                  <td key={angle.key} className={`num cell-${tone}`}>
                    <button className="link-button" onClick={() => onFilter({ brand: brand.domain, angle: angle.key })} title={`${cell.ads} ads, ${cell.proven} proven`}>{cell.ads}</button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dim small">A cell is that brand's kept ads on the angle, coloured by how many are proven. The scout keeps at most 15 ads per brand, so a big brand is undercounted here.</p>
    </div>
  );
}
