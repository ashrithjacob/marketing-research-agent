import type { Gap, ProductTruthPacket } from '../../api';
import { Chip, Tile, TileGaps } from '../tile';
import { Cite } from '../cite';
import { Fold, FoldCard } from '../fold';

function percent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

/** Days of supply against each carrier's time to effect, the churn flag, and the margin at every price. */
export function EconomicsTile({ runId, packet, gaps }: { runId: string; packet: ProductTruthPacket; gaps: Gap[] }) {
  const { economics } = packet;
  const op = economics.operator;
  const churn = economics.churn;
  const churnFlag = churn.mismatch === null ? 'not assessable' : churn.mismatch ? 'yes' : 'no';
  return (
    <Tile
      label="Economics"
      sub="computed by code from the label, the prices and the operator's costs"
      chips={churn.mismatch ? <Chip tone="warn">runs out before it works</Chip> : undefined}
      preview={
        <div className="tile-headline">
          <div className="tile-big">{economics.days_of_supply === null ? 'Days of supply unknown' : `${economics.days_of_supply} days of supply`}</div>
          <div className="tile-note">{churn.why}</div>
        </div>
      }
      defaultOpen
    >
      <div className="kv">
        <Fold label="days of supply" preview={`${economics.days_of_supply ?? '—'} · ${economics.days_why}`} />
        {churn.carriers.map((c) => {
          const works = `${c.time_to_effect_days === null ? 'no time to effect stated' : `${c.time_to_effect_days} days`}${c.runs_out_first ? ' — the container runs out first' : ''}`;
          return <Fold key={c.active} label={`${c.active} works in`} preview={works} tone={c.runs_out_first ? 'churn-bad' : undefined} />;
        })}
        <Fold label="churn flag" preview={`${churnFlag} — ${churn.why}`} tone={churn.mismatch ? 'churn-bad' : undefined} />
        <Fold
          label="operator costs"
          preview={`landed unit cost ${op?.landed_unit_cost != null ? `${op.landed_unit_cost} ${op.currency}` : 'not entered'} · MOQ ${op?.moq ?? 'not entered'} · lead time ${op?.lead_time_days != null ? `${op.lead_time_days} days` : 'not entered'}`}
        />
      </div>
      <h3>Margin at each price</h3>
      <div className="pt-cards">
        {economics.margins.map((m) => (
          <FoldCard
            key={m.label}
            title={`${m.label}${m.subscription ? ' (subscription)' : ''}`}
            glance={`${m.unit_price} ${m.currency} per unit · gross margin ${percent(m.margin)}`}
          >
            <Fold label="how" preview={m.why}>
              {m.why} <Cite runId={runId} id={m.source_id} sources={packet.sources} />
            </Fold>
          </FoldCard>
        ))}
      </div>
      <TileGaps gaps={gaps} />
    </Tile>
  );
}
