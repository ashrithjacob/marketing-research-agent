import type { DoseClass, Gap, ProductTruthPacket } from '../../api';
import { Chip, Tile, TileGaps } from '../tile';
import { Cite } from './cite';

const CLASS_LABEL: Record<DoseClass, string> = {
  at_dose: 'at dose',
  partial: 'partial',
  under_dose: 'under dose',
  unassessable: 'unassessable',
};

const CLASS_TONE: Record<DoseClass, string> = { at_dose: 'accent', partial: 'warn', under_dose: 'warn', unassessable: 'dim' };

/** Our daily dose against the studied daily dose, per active, with the class code computed from the ratio. */
export function DoseTile({ runId, packet, gaps }: { runId: string; packet: ProductTruthPacket; gaps: Gap[] }) {
  const counts = packet.doses.reduce<Record<string, number>>((all, d) => ({ ...all, [d.class]: (all[d.class] ?? 0) + 1 }), {});
  const regimen = packet.regimen;
  return (
    <Tile
      label="Dose vs study"
      sub="classes computed by code: at dose ≥ 0.8 · partial 0.5–0.8 · under dose < 0.5"
      chips={Object.entries(counts).map(([cls, n]) => <Chip key={cls} tone={CLASS_TONE[cls as DoseClass]}>{n} {CLASS_LABEL[cls as DoseClass]}</Chip>)}
      defaultOpen
    >
      {regimen && (
        <p className="muted small">
          Daily dose = amount per serving × {regimen.servings_per_day ?? '?'} servings a day
          {regimen.directions_as_printed ? ` (“${regimen.directions_as_printed}”)` : ''}.
        </p>
      )}
      <table className="pt-table">
        <thead>
          <tr><th>Active</th><th>Ours / day</th><th>Studied / day</th><th>Ratio</th><th>Class</th><th>Form match</th><th>Study</th></tr>
        </thead>
        <tbody>
          {packet.doses.map((d) => (
            <tr key={d.active}>
              <td>{d.active}</td>
              <td>{d.our_daily_dose === null ? '—' : `${d.our_daily_dose} ${d.unit}`}</td>
              <td>{d.studied_daily_dose === null ? '—' : `${d.studied_daily_dose} ${d.unit}`}</td>
              <td>{d.ratio ?? '—'}</td>
              <td>
                <span className={`tile-chip ${CLASS_TONE[d.class]}`}>{CLASS_LABEL[d.class]}</span>
                {d.class === 'unassessable' && <div className="small muted">{d.why}</div>}
              </td>
              <td className="small">{d.form_match || '—'}{d.studied_form ? ` (${d.studied_form})` : ''}</td>
              <td className="small">{d.study ? <>{d.study} <Cite runId={runId} id={d.source_id} sources={packet.sources} /></> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <TileGaps gaps={gaps} />
    </Tile>
  );
}
