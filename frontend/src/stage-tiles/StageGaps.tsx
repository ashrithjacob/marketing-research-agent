import type { Gap } from '../api';
import { NODE_LABELS } from '../stages';

export default function StageGaps({ gaps }: { gaps: Gap[] }) {
  if (gaps.length === 0) return <p className="muted small">Nothing was left unfound.</p>;
  return (
    <table className="stage-table">
      <thead>
        <tr>
          <th>Section</th>
          <th>Not found</th>
          <th>Would need</th>
        </tr>
      </thead>
      <tbody>
        {gaps.map((gap, i) => (
          <tr key={`${gap.node}-${i}`}>
            <td>{NODE_LABELS[gap.node] ?? gap.node}</td>
            <td>{gap.missing}</td>
            <td className="muted">{gap.would_need ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
