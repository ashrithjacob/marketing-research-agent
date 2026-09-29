import { useMemo } from 'react';
import type { Source, StagePacket, TargetListing } from '../api';
import { CompetitorsTile } from './tiles-market';
import { CategoryTile, ProductTile } from './tiles-data';

type Rows = Pick<StagePacket, 'attributes' | 'measurements' | 'excerpts' | 'gaps'> & {
  sources: Source[];
};

/** The product, competitor and category tiles of one stage-1 packet. */
export function StageOneTiles({
  runId,
  packet,
  nodes,
  listings,
}: {
  runId: string;
  packet: StagePacket;
  nodes: ReadonlySet<string>;
  listings: TargetListing[];
}) {
  const byNode = useMemo(() => {
    const map: Record<string, Rows> = {};
    const rows = (node: string): Rows =>
      (map[node] ??= { attributes: [], measurements: [], excerpts: [], gaps: [], sources: [] });
    for (const a of packet.attributes) rows(a.node).attributes.push(a);
    for (const m of packet.measurements) rows(m.node).measurements.push(m);
    for (const e of packet.excerpts) rows(e.node).excerpts.push(e);
    for (const s of packet.sources) rows(s.node).sources.push(s);
    for (const g of packet.gaps) rows(g.node).gaps.push(g);
    return map;
  }, [packet]);

  const none: Rows = { attributes: [], measurements: [], excerpts: [], gaps: [], sources: [] };
  const product = byNode.product_data ?? none;
  const competitors = byNode.competitors ?? none;
  const category = byNode.category_data ?? none;
  const showCompetitors = !!packet.competitor_reference || (packet.competitors ?? []).length > 0;

  return (
    <>
      {nodes.has('product_data') && (
        <ProductTile
          runId={runId}
          packet={packet}
          attributes={product.attributes}
          measurements={product.measurements}
          excerpts={product.excerpts}
          sources={product.sources}
          gaps={product.gaps}
        />
      )}
      {showCompetitors && (
        <CompetitorsTile
          runId={runId}
          packet={packet}
          measurements={competitors.measurements}
          excerpts={competitors.excerpts}
          sources={competitors.sources}
          gaps={competitors.gaps}
          listings={listings}
        />
      )}
      {nodes.has('category_data') && (
        <CategoryTile
          runId={runId}
          measurements={category.measurements}
          sources={category.sources}
          gaps={category.gaps}
        />
      )}
    </>
  );
}
