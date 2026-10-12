import type { Gap, ProductTruthPacket } from '../../api';
import { Chip, Tile, TileGaps } from '../tile';
import { Cite } from '../cite';
import { Fold, FoldCard } from '../fold';

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
          const label = active.amount === null ? 'no amount stated' : `${active.amount} ${active.unit} per serving`;
          return (
            <FoldCard
              key={active.name}
              title={active.name}
              glance={label}
              chips={
                <>
                  {m?.story_weight === 'carrier' && <span className="tile-chip accent">carrier</span>}
                  {active.in_blend && <span className="tile-chip warn">in a blend</span>}
                </>
              }
            >
              <Fold label="on the label" preview={`${label}${active.form ? ` · ${active.form}` : ''}`}>
                {label}
                {active.form ? ` · ${active.form}` : ''} <Cite runId={runId} id={active.source_id} sources={packet.sources} />
              </Fold>
              {m ? (
                <>
                  <Fold label="pathway" preview={m.pathway} />
                  <Fold label="time to effect" preview={effect(m.time_to_effect)} />
                  <Fold label="magnitude" preview={m.magnitude}>
                    {m.magnitude} <Cite runId={runId} id={m.source_id} sources={packet.sources} />
                  </Fold>
                </>
              ) : (
                <Fold label="mechanism" preview="not recorded — see the gaps" tone="muted" />
              )}
            </FoldCard>
          );
        })}
      </div>
      <TileGaps gaps={gaps} />
    </Tile>
  );
}
