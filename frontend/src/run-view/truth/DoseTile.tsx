import type { DoseClass, Gap, ProductTruthPacket } from '../../api';
import { Chip, Tile, TileGaps } from '../tile';
import { Cite } from '../cite';
import { Fold, FoldCard } from '../fold';

const CLASS_LABEL: Record<DoseClass, string> = {
  at_dose: 'at dose',
  partial: 'partial',
  under_dose: 'under dose',
  unassessable: 'unassessable',
};

const CLASS_TONE: Record<DoseClass, string> = { at_dose: 'accent', partial: 'warn', under_dose: 'warn', unassessable: 'dim' };

function amount(value: number | null, unit: string): string {
  return value === null ? '—' : `${value} ${unit}`;
}

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
        <div className="kv">
          <Fold label="how the daily dose is computed" preview={`amount per serving × ${regimen.servings_per_day ?? '?'} servings a day`}>
            Amount per serving × {regimen.servings_per_day ?? '?'} servings a day.
            {regimen.directions_as_printed && <div className="muted small">“{regimen.directions_as_printed}”</div>}
          </Fold>
        </div>
      )}
      <div className="pt-cards">
        {packet.doses.map((d) => (
          <FoldCard
            key={d.active}
            title={d.active}
            chips={<span className={`tile-chip ${CLASS_TONE[d.class]}`}>{CLASS_LABEL[d.class]}</span>}
            glance={`ours ${amount(d.our_daily_dose, d.unit)} / day · studied ${amount(d.studied_daily_dose, d.unit)} / day · ratio ${d.ratio ?? '—'}`}
          >
            {d.class === 'unassessable' && <Fold label="why unassessable" preview={d.why} />}
            <Fold label="form match" preview={`${d.form_match || '—'}${d.studied_form ? ` (${d.studied_form})` : ''}`} />
            <Fold label="study" preview={d.study || 'no study found'}>
              {d.study ? <>{d.study} <Cite runId={runId} id={d.source_id} sources={packet.sources} /></> : 'no study found'}
            </Fold>
          </FoldCard>
        ))}
      </div>
      <TileGaps gaps={gaps} />
    </Tile>
  );
}
