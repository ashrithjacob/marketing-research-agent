import { useState } from 'react';
import type {
  Competitor,
  CompetitorRelation,
  Excerpt,
  Gap,
  Measurement,
  Source,
  StagePacket,
  TargetListing,
} from '../api';
import { AmazonLink } from './amazon-link';
import { BarList } from './charts';
import { Chip, Tile, TileGaps } from './tile';
import { SourceRow } from './packet-sections';

type Focus = CompetitorRelation | 'sources' | 'gaps' | null;

const KINDS: { relation: CompetitorRelation; label: string; tone: 'accent' | 'infer'; means: string }[] = [
  { relation: 'direct', label: 'direct', tone: 'accent', means: "shares an active, in the champion's form" },
  { relation: 'indirect_form', label: 'indirect by form', tone: 'infer', means: 'shares an active, in another form' },
  { relation: 'indirect_active', label: 'indirect by active', tone: 'infer', means: "shares none of the champion's actives" },
];

function CompetitorRow({ competitor: c, listing }: { competitor: Competitor; listing: TargetListing | undefined }) {
  const ads = c.ad_source_ids?.length ?? 0;
  return (
    <div className="comp">
      <a href={c.url} target="_blank" rel="noreferrer" className="comp-name">
        {c.name} <span className="comp-open">↗</span>
      </a>{' '}
      <AmazonLink row={listing} />
      <div className="comp-facts">
        <span className="comp-form">
          {c.form}
          {c.form_as_printed ? ` · ${c.form_as_printed}` : ''}
        </span>
        {c.market && <span>{c.market}</span>}
        {c.shared_actives.length > 0 && <span>shares {c.shared_actives.join(', ')}</span>}
        {c.dose_per_serving && <span>{c.dose_per_serving}</span>}
        {c.price && (
          <span>
            {c.price}
            {c.price_per_dose ? ` (${c.price_per_dose})` : ''}
          </span>
        )}
        {ads > 0 && <span>{ads} ad{ads === 1 ? '' : 's'}</span>}
      </div>
      {c.icp_as_printed && <div className="comp-copy">for: {c.icp_as_printed}</div>}
      {c.positioning_copy && <div className="comp-copy">“{c.positioning_copy}”</div>}
    </div>
  );
}

function SocialProof({ measurements }: { measurements: Measurement[] }) {
  const reviews = measurements.filter(
    (m) => m.metric.startsWith('amazon_review_count') || m.metric.startsWith('trustpilot_review_count'),
  );
  if (reviews.length === 0) return null;
  return (
    <div className="chart">
      <div className="chart-title">Social proof — review counts</div>
      <BarList
        items={reviews.map((m) => ({
          label: shortLabel(m.period ?? m.metric),
          value: m.value as number,
          display: String(m.value),
        }))}
      />
    </div>
  );
}

function shortLabel(period: string): string {
  const parens = period.match(/\(([^)]+)\)\s*$/)?.[1];
  return (parens ?? period).replace(/^listing /, '');
}

export function CompetitorsTile({
  runId,
  packet,
  measurements,
  excerpts,
  sources,
  gaps,
  listings,
}: {
  runId: string;
  packet: StagePacket;
  listings: TargetListing[];
  measurements: Measurement[];
  excerpts: Excerpt[];
  sources: Source[];
  gaps: Gap[];
}) {
  const [focus, setFocus] = useState<Focus>(null);
  const pick = (f: Focus) => setFocus(focus === f ? null : f);
  const reference = packet.competitor_reference ?? null;
  const rows = packet.competitors ?? [];
  const curves = packet.saturation.filter((s) => s.node === 'competitors');
  const listing = focus === null || KINDS.some((k) => k.relation === focus);
  const chips = (
    <>
      {KINDS.map((k) => (
        <Chip key={k.relation} tone={k.tone} onClick={() => pick(k.relation)} active={focus === k.relation}>
          {rows.filter((c) => c.relation === k.relation).length} {k.label}
        </Chip>
      ))}
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
  const head = reference && (
    <p className="comp-ref">
      Champion <b>{reference.name}</b> — {reference.form}
      {reference.form_as_printed ? ` (${reference.form_as_printed})` : ''} ·{' '}
      {reference.actives.join(', ')}
      {reference.reviews_count
        ? ` · ${reference.reviews_count.toLocaleString()} reviews`
        : ''}{' '}
      <AmazonLink row={listings.find((l) => l.target_id === 'product')} />
    </p>
  );
  return (
    <Tile
      label="Competitors"
      sub="sold to the champion's customer, in three kinds"
      open={focus !== null ? true : undefined}
      onToggle={focus !== null ? () => setFocus(null) : undefined}
      chips={chips}
      preview={
        <div className="tile-headline">
          <div className="tile-big">
            {rows.length} competitors mapped
          </div>
          {reference && (
            <div className="tile-note">
              champion: <b>{reference.name}</b>
            </div>
          )}
        </div>
      }
    >
      {listing && head}
      {focus === null && (
        <div className="comp-kinds">
          {KINDS.map((k) => (
            <span key={k.relation}><b>{k.label}</b> — {k.means}</span>
          ))}
        </div>
      )}
      {focus === 'sources' && (
        <div className="src-list">
          {sources.map((source) => (
            <SourceRow key={source.id} runId={runId} source={source} />
          ))}
        </div>
      )}
      {focus === 'gaps' && <TileGaps gaps={gaps} force />}
      {listing && (
        <>
          {focus === null && <SocialProof measurements={measurements} />}
          {KINDS
            .filter((k) => focus === null || focus === k.relation)
            .map(({ relation, label }) => {
              const group = rows.filter((c) => c.relation === relation);
              const curve = curves.find((s) => s.class === relation);
              return (
                <div key={relation} className="comp-group">
                  <div className="comp-head">
                    <span className={`comp-tag ${relation}`}>{label}</span>
                    <span>{group.length} found</span>
                  </div>
                  {curve?.stopped_because && <p className="comp-stopped">Stopped: {curve.stopped_because}</p>}
                  {group.length === 0 && <p className="muted">None recorded.</p>}
                  {group.map((c) => (
                    <CompetitorRow key={c.id} competitor={c} listing={listings.find((l) => l.target_id === c.id)} />
                  ))}
                </div>
              );
            })}
        </>
      )}
      {focus === null && (
        <>
          <TileGaps gaps={gaps} />
          {excerpts.length > 0 && (
            <>
              <h3>Excerpts</h3>
              {excerpts.slice(0, 8).map((excerpt) => (
                <div key={excerpt.id} className="item">
                  <div className="q">“{excerpt.text}”</div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </Tile>
  );
}
