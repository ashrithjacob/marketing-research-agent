import type { Gap, ProductTruthPacket } from '../../api';
import { Chip, Tile, TileGaps } from '../tile';
import { Cite } from '../cite';

function percent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

/** Days of supply against each carrier's time to effect, the churn flag, and the margin at every price. */
export function EconomicsTile({ runId, packet, gaps }: { runId: string; packet: ProductTruthPacket; gaps: Gap[] }) {
  const { economics } = packet;
  const op = economics.operator;
  const churn = economics.churn;
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
        <div className="kv-row"><span className="k">days of supply</span><span className="v">{economics.days_of_supply ?? '—'} · {economics.days_why}</span></div>
        {churn.carriers.map((c) => (
          <div key={c.active} className="kv-row">
            <span className="k">{c.active} works in</span>
            <span className={`v ${c.runs_out_first ? 'churn-bad' : ''}`}>
              {c.time_to_effect_days === null ? 'no time to effect stated' : `${c.time_to_effect_days} days`}
              {c.runs_out_first ? ' — the container runs out first' : ''}
            </span>
          </div>
        ))}
        <div className="kv-row">
          <span className="k">churn flag</span>
          <span className={`v ${churn.mismatch ? 'churn-bad' : ''}`}>{churn.mismatch === null ? 'not assessable' : churn.mismatch ? 'yes' : 'no'} — {churn.why}</span>
        </div>
        <div className="kv-row">
          <span className="k">landed unit cost</span>
          <span className="v">{op?.landed_unit_cost != null ? `${op.landed_unit_cost} ${op.currency}` : 'not entered'} · MOQ {op?.moq ?? 'not entered'} · lead time {op?.lead_time_days != null ? `${op.lead_time_days} days` : 'not entered'}</span>
        </div>
      </div>
      <h3>Margin at each price</h3>
      <table className="pt-table">
        <thead><tr><th>Price</th><th>Per unit</th><th>Gross margin</th><th>How</th><th>Source</th></tr></thead>
        <tbody>
          {economics.margins.map((m) => (
            <tr key={m.label}>
              <td>{m.label}{m.subscription ? ' (subscription)' : ''}</td>
              <td>{m.unit_price} {m.currency}</td>
              <td>{percent(m.margin)}</td>
              <td className="small muted">{m.why}</td>
              <td className="small"><Cite runId={runId} id={m.source_id} sources={packet.sources} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <TileGaps gaps={gaps} />
    </Tile>
  );
}
