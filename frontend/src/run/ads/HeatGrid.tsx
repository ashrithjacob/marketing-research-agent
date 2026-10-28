import type { Heat } from './ad-digest';

export default function HeatGrid({ heat }: { heat: Heat }) {
  if (heat.rows.length === 0) return <p className="dg-note">Nothing to count yet.</p>;
  return (
    <div className="dg-heat-wrap">
      <table className="dg-heat">
        <thead>
          <tr>
            <th />
            {heat.cols.map((col) => <th key={col} scope="col">{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {heat.rows.map((row) => (
            <tr key={row}>
              <th scope="row">{row}</th>
              {heat.cols.map((col) => {
                const n = heat.cells.get(`${row}|${col}`) ?? 0;
                const strength = n / heat.max;
                return (
                  <td
                    key={col}
                    title={n ? `${row} × ${col}: ${n} ads` : `${row} × ${col}: none`}
                    style={n ? { background: `color-mix(in srgb, var(--accent) ${Math.round(10 + strength * 80)}%, transparent)`, color: strength > 0.55 ? '#fff' : 'var(--ink)' } : undefined}
                    className={n ? '' : 'empty'}
                  >
                    {n || ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
