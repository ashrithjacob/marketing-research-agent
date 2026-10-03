import type { Gap, ProductTruthPacket } from '../../api';
import { Chip, Tile, TileGaps } from '../tile';
import { Cite } from '../cite';

function effect(time: ProductTruthPacket['mechanisms'][number]['time_to_effect']): string {
  return time ? `${time.value} ${time.unit}` : 'not stated by any source';
}

/** One card per active: what the label says, how it works, how long it takes, and whether the product's story rests on it. */
export function IngredientsTile({ runId, packet, gaps }: { runId: string; packet: ProductTruthPacket; gaps: Gap[] }) {
  const carriers = packet.mechanisms.filter((m) => m.story_weight === 'carrier').map((m) => m.active);
  return (
    <Tile
      label="Ingredients"
      sub="how each active works, as sources state it"
      chips={<Chip>{packet.actives.length} actives</Chip>}
      preview={
        <div className="tile-headline">
          <div className="tile-big">{packet.actives.map((a) => a.name).join(', ') || 'No actives recorded'}</div>
          {carriers.length > 0 && <div className="tile-note">story rests on: {carriers.join(', ')}</div>}
        </div>
      }
      defaultOpen
    >
      <div className="pt-cards">
        {packet.actives.map((active) => {
          const m = packet.mechanisms.find((x) => x.active.toLowerCase() === active.name.toLowerCase());
          return (
            <div key={active.name} className="pt-card">
              <div className="pt-card-head">
                <b>{active.name}</b>
                {m?.story_weight === 'carrier' && <span className="tile-chip accent">carrier</span>}
                {active.in_blend && <span className="tile-chip warn">in a blend</span>}
              </div>
              <div className="kv">
                <div className="kv-row">
                  <span className="k">on the label</span>
                  <span className="v">
                    {active.amount === null ? 'no amount stated' : `${active.amount} ${active.unit} per serving`}
                    {active.form ? ` · ${active.form}` : ''} <Cite runId={runId} id={active.source_id} sources={packet.sources} />
                  </span>
                </div>
                {m ? (
                  <>
                    <div className="kv-row"><span className="k">pathway</span><span className="v">{m.pathway}</span></div>
                    <div className="kv-row"><span className="k">time to effect</span><span className="v">{effect(m.time_to_effect)}</span></div>
                    <div className="kv-row">
                      <span className="k">magnitude</span>
                      <span className="v">{m.magnitude} <Cite runId={runId} id={m.source_id} sources={packet.sources} /></span>
                    </div>
                  </>
                ) : (
                  <div className="kv-row"><span className="k">mechanism</span><span className="v muted">not recorded — see the gaps</span></div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <TileGaps gaps={gaps} />
    </Tile>
  );
}
