import { useState } from 'react';
import type {
  Competitor,
  Excerpt,
  Gap,
  Measurement,
  Source,
  StagePacket,
} from '../api';
import { BarList } from './charts';
import { Chip, Tile, TileGaps } from './tile';
import { SourceRow } from './packet-sections';

type Focus = 'direct' | 'indirect' | 'sources' | 'gaps' | null;

function CompetitorRow({ competitor: c }: { competitor: Competitor }) {
  const ads = c.ad_source_ids?.length ?? 0;
  return (
    <div className="comp">
      <a href={c.url} target="_blank" rel="noreferrer" className="comp-name">
        {c.name} <span className="comp-open">↗</span>
      </a>
      <div className="comp-facts">
        <span className="comp-form">
          {c.form}
          {c.form_as_printed ? ` · ${c.form_as_printed}` : ''}
        </span>
        <span>shares {c.shared_actives.join(', ')}</span>
        {c.dose_per_serving && <span>{c.dose_per_serving}</span>}
        {c.price && (
          <span>
            {c.price}
            {c.price_per_dose ? ` (${c.price_per_dose})` : ''}
          </span>
        )}
        {ads > 0 && <span>{ads} ad{ads === 1 ? '' : 's'}</span>}
      </div>
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
}: {
  runId: string;
  packet: StagePacket;
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
  const direct = rows.filter((c) => c.relation === 'direct').length;
  const indirect = rows.filter((c) => c.relation === 'indirect').length;
  const chips = (
    <>
      <Chip tone="accent" onClick={() => pick('direct')} active={focus === 'direct'}>{direct} direct</Chip>
      <Chip tone="infer" onClick={() => pick('indirect')} active={focus === 'indirect'}>{indirect} indirect</Chip>
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
        : ''}
    </p>
  );
  return (
    <Tile
      label="Competitors"
      sub="direct = same form, indirect = different form"
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
      {(focus === null || focus === 'direct' || focus === 'indirect') && head}
      {focus === 'sources' && (
        <div className="src-list">
          {sources.map((source) => (
            <SourceRow key={source.id} runId={runId} source={source} />
          ))}
        </div>
      )}
      {focus === 'gaps' && <TileGaps gaps={gaps} force />}
      {(focus === null || focus === 'direct' || focus === 'indirect') && (
        <>
          {focus === null && <SocialProof measurements={measurements} />}
          {(['direct', 'indirect'] as const)
            .filter((relation) => focus === null || focus === relation)
            .map((relation) => {
              const group = rows.filter((c) => c.relation === relation);
              const curve = curves.find((s) => s.class === relation);
              return (
                <div key={relation} className="comp-group">
                  <div className="comp-head">
                    <span className={`comp-tag ${relation}`}>{relation}</span>
                    <span>
                      {group.length} found
                      {curve?.stopped_because ? ` · ${curve.stopped_because}` : ''}
                    </span>
                  </div>
                  {group.length === 0 && <p className="muted">None recorded.</p>}
                  {group.map((c) => (
                    <CompetitorRow key={c.id} competitor={c} />
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

export function VoiceTile({ voice }: { voice: Excerpt[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Tile
      label="Voice of customer"
      sub="verbatim, never paraphrased"
      open={open}
      onToggle={() => setOpen((o) => !o)}
      chips={
        <Chip onClick={() => setOpen((o) => !o)} active={open}>
          {voice.length} quotes
        </Chip>
      }
      preview={
        voice[0] ? (
          <div className="tile-headline">
            <div className="tile-quote">“{voice[0].text}”</div>
          </div>
        ) : undefined
      }
    >
      {voice.length === 0 && <p className="muted">Nothing yet.</p>}
      {voice.map((excerpt) => (
        <div key={excerpt.id} className="item">
          <div className="q">
            “{excerpt.text}”
            {excerpt.star_rating != null && (
              <span className="pill star">{excerpt.star_rating}★</span>
            )}
          </div>
          <div className="src">
            {excerpt.axis ? excerpt.axis.replace('why_', 'why ') : ''}
            {excerpt.posted_at ? ` · ${excerpt.posted_at}` : ''}
          </div>
        </div>
      ))}
    </Tile>
  );
}

