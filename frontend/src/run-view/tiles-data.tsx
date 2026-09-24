import type { AttributeRecord, Excerpt, Gap, Measurement, Source, StagePacket } from '../api';
import { Chip, Tile, TileGaps } from './tile';
import { MeasurementBars } from './charts';

function ExcerptList({ excerpts }: { excerpts: Excerpt[] }) {
  if (excerpts.length === 0) return null;
  return (
    <div className="tile-excerpts">
      {excerpts.slice(0, 12).map((excerpt) => (
        <div key={excerpt.id} className="item">
          <div className="q">
            “{excerpt.text}”
            {excerpt.star_rating != null && (
              <span className="pill star">{excerpt.star_rating}★</span>
            )}
          </div>
          {excerpt.posted_at && <div className="src">{excerpt.posted_at}</div>}
        </div>
      ))}
    </div>
  );
}

export function ProductTile({
  packet,
  attributes,
  measurements,
  excerpts,
  sources,
  gaps,
}: {
  packet: StagePacket;
  attributes: AttributeRecord[];
  measurements: Measurement[];
  excerpts: Excerpt[];
  sources: Source[];
  gaps: Gap[];
}) {
  const name = attributes.find((a) => a.key === 'name')?.value ?? packet.competitor_reference?.name;
  const form = packet.competitor_reference?.form;
  return (
    <Tile
      label="Product data"
      sub="read off the product's own pages"
      chips={
        <>
          <Chip>{attributes.length} facts</Chip>
          <Chip>{sources.length} {sources.length === 1 ? "source" : "sources"}</Chip>
          {gaps.length > 0 && <Chip tone="warn">{gaps.length} gaps</Chip>}
        </>
      }
      preview={
        <div className="tile-headline">
          {name && <div className="tile-big">{name}</div>}
          {form && <div className="tile-note">form: {form}</div>}
        </div>
      }
      defaultOpen
    >
      <div className="kv">
        {attributes.map((attribute) => (
          <div key={attribute.id} className="kv-row">
            <span className="k">{attribute.key.replace(/_/g, ' ')}</span>
            <span className="v">{attribute.value}</span>
          </div>
        ))}
      </div>
      <MeasurementBars measurements={measurements} />
      <h3>Excerpts</h3>
      <ExcerptList excerpts={excerpts} />
      <TileGaps gaps={gaps} />
    </Tile>
  );
}

export function CategoryTile({
  measurements,
  sources,
  gaps,
}: {
  measurements: Measurement[];
  sources: Source[];
  gaps: Gap[];
}) {
  const marketSize = measurements.filter((m) => m.metric === 'market_size');
  const cagr = measurements.find((m) => m.metric === 'market_cagr');
  const search = measurements.find((m) => m.metric === 'search_volume');
  const headline = (value: number | string | undefined, unit: string | undefined) => {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    const abs = Math.abs(value);
    if (unit === 'USD') return abs >= 1e9 ? `$${(value / 1e9).toFixed(1)}B` : `$${(value / 1e6).toFixed(0)}M`;
    if (abs >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return String(value);
  };
  return (
    <Tile
      label="Category data"
      sub="market size, demand, trend"
      chips={
        <>
          <Chip>{measurements.length} figures</Chip>
          <Chip>{sources.length} {sources.length === 1 ? "source" : "sources"}</Chip>
          {gaps.length > 0 && <Chip tone="warn">{gaps.length} gaps</Chip>}
        </>
      }
      preview={
        <div className="tile-headline">
          {marketSize.length > 0 && (
            <div className="tile-big">
              {headline(marketSize[0].value, marketSize[0].unit)}
              {marketSize[0].period ? ` · ${marketSize[0].period}` : ''}
            </div>
          )}
          <div className="tile-note">
            {cagr && `CAGR ${cagr.value}${cagr.unit === '%' ? '%' : ''}`}
            {cagr && search && ' · '}
            {search && `search volume ${headline(search.value, search.unit)}/mo`}
          </div>
        </div>
      }
    >
      <MeasurementBars measurements={measurements} />
      <h3>Every figure, with its period</h3>
      <div className="kv">
        {measurements.map((m) => (
          <div key={m.id} className="kv-row">
            <span className="k">{m.metric.replace(/_/g, ' ')}</span>
            <span className="v">
              {m.value} {m.unit}
              {m.period ? ` · ${m.period}` : ''}
            </span>
          </div>
        ))}
      </div>
      <TileGaps gaps={gaps} />
    </Tile>
  );
}
