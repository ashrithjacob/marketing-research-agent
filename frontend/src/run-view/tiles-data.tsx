import { useState } from 'react';
import type { AttributeRecord, Excerpt, Gap, Measurement, Source, StagePacket } from '../api';
import { Chip, Tile, TileGaps } from './tile';
import { MeasurementBars } from './charts';
import { SourceRow } from './packet-sections';

type Focus = 'facts' | 'sources' | 'gaps' | null;

function FocusChips({
  focus,
  setFocus,
  facts,
  sources,
  gaps,
}: {
  focus: Focus;
  setFocus: (f: Focus) => void;
  facts: string;
  sources: Source[];
  gaps: Gap[];
}) {
  const pick = (f: Focus) => setFocus(focus === f ? null : f);
  return (
    <>
      <Chip onClick={() => pick('facts')} active={focus === 'facts'}>{facts}</Chip>
      <Chip onClick={() => pick('sources')} active={focus === 'sources'}>
        {sources.length} {sources.length === 1 ? 'source' : 'sources'}
      </Chip>
      {gaps.length > 0 && (
        <Chip tone="warn" onClick={() => pick('gaps')} active={focus === 'gaps'}>
          {gaps.length} gaps
        </Chip>
      )}
    </>
  );
}

function SourcesFocus({ runId, sources }: { runId: string; sources: Source[] }) {
  if (sources.length === 0) return <p className="muted">No sources fed this tile.</p>;
  return (
    <div className="src-list">
      {sources.map((source) => (
        <SourceRow key={source.id} runId={runId} source={source} />
      ))}
    </div>
  );
}

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
  runId,
  packet,
  attributes,
  measurements,
  excerpts,
  sources,
  gaps,
}: {
  runId: string;
  packet: StagePacket;
  attributes: AttributeRecord[];
  measurements: Measurement[];
  excerpts: Excerpt[];
  sources: Source[];
  gaps: Gap[];
}) {
  const [focus, setFocus] = useState<Focus>(null);
  const name = attributes.find((a) => a.key === 'name')?.value ?? packet.competitor_reference?.name;
  const form = packet.competitor_reference?.form;
  const facts = `${attributes.length + measurements.length} facts`;
  return (
    <Tile
      label="Product data"
      sub="read off the product's own pages"
      open={focus !== null ? true : undefined}
      onToggle={focus !== null ? () => setFocus(null) : undefined}
      chips={<FocusChips focus={focus} setFocus={setFocus} facts={facts} sources={sources} gaps={gaps} />}
      preview={
        <div className="tile-headline">
          {name && <div className="tile-big">{name}</div>}
          {form && <div className="tile-note">form: {form}</div>}
        </div>
      }
      defaultOpen
    >
      {(focus === null || focus === 'facts') && (
        <>
          <div className="kv">
            {attributes.map((attribute) => (
              <div key={attribute.id} className="kv-row">
                <span className="k">{attribute.key.replace(/_/g, ' ')}</span>
                <span className="v">{attribute.value}</span>
              </div>
            ))}
          </div>
          <MeasurementBars measurements={measurements} />
        </>
      )}
      {focus === null && (
        <>
          <h3>Excerpts</h3>
          <ExcerptList excerpts={excerpts} />
        </>
      )}
      {focus === 'sources' && <SourcesFocus runId={runId} sources={sources} />}
      {(focus === 'gaps' || (focus === null && gaps.length > 0)) && <TileGaps gaps={gaps} />}
    </Tile>
  );
}

export function CategoryTile({
  runId,
  measurements,
  sources,
  gaps,
}: {
  runId: string;
  measurements: Measurement[];
  sources: Source[];
  gaps: Gap[];
}) {
  const [focus, setFocus] = useState<Focus>(null);
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
      open={focus !== null ? true : undefined}
      onToggle={focus !== null ? () => setFocus(null) : undefined}
      chips={<FocusChips focus={focus} setFocus={setFocus} facts={`${measurements.length} figures`} sources={sources} gaps={gaps} />}
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
      {(focus === null || focus === 'facts') && (
        <>
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
        </>
      )}
      {focus === 'sources' && <SourcesFocus runId={runId} sources={sources} />}
      {(focus === 'gaps' || (focus === null && gaps.length > 0)) && <TileGaps gaps={gaps} />}
    </Tile>
  );
}
