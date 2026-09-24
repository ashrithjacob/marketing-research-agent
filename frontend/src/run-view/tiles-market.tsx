import { Fragment } from 'react';
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

const AWARENESS = ['Unaware', 'Problem', 'Solution', 'Product', 'Most'];

function CompetitorRow({ competitor: c }: { competitor: Competitor }) {
  const ads = c.ad_source_ids?.length ?? 0;
  return (
    <div className="comp">
      <div className="comp-top">
        <a href={c.url} target="_blank" rel="noreferrer" className="comp-name">
          {c.name}
        </a>
        <span className="comp-form">
          {c.form}
          {c.form_as_printed ? ` · ${c.form_as_printed}` : ''}
        </span>
      </div>
      <div className="comp-facts">
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
  packet,
  measurements,
  excerpts,
  sources,
  gaps,
}: {
  packet: StagePacket;
  measurements: Measurement[];
  excerpts: Excerpt[];
  sources: Source[];
  gaps: Gap[];
}) {
  const reference = packet.competitor_reference ?? null;
  const rows = packet.competitors ?? [];
  const curves = packet.saturation.filter((s) => s.node === 'competitors');
  const direct = rows.filter((c) => c.relation === 'direct').length;
  const indirect = rows.filter((c) => c.relation === 'indirect').length;
  return (
    <Tile
      label="Competitors"
      sub="direct = same form, indirect = different form"
      chips={
        <>
          <Chip tone="accent">{direct} direct</Chip>
          <Chip tone="infer">{indirect} indirect</Chip>
          <Chip>{sources.length} {sources.length === 1 ? "source" : "sources"}</Chip>
          {gaps.length > 0 && <Chip tone="warn">{gaps.length} gaps</Chip>}
        </>
      }
      preview={
        <div className="tile-headline">
          <div className="tile-big">
            {rows.length} competitors mapped
          </div>
          {reference && (
            <div className="tile-note">
              measured against <b>{reference.name}</b>
            </div>
          )}
        </div>
      }
    >
      {reference && (
        <p className="comp-ref">
          Measured against <b>{reference.name}</b> — {reference.form}
          {reference.form_as_printed ? ` (${reference.form_as_printed})` : ''} ·{' '}
          {reference.actives.join(', ')}
        </p>
      )}
      <SocialProof measurements={measurements} />
      {(['direct', 'indirect'] as const).map((relation) => {
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
    </Tile>
  );
}

export function VoiceTile({ voice }: { voice: Excerpt[] }) {
  return (
    <Tile
      label="Voice of customer"
      sub="verbatim, never paraphrased"
      chips={<Chip>{voice.length} quotes</Chip>}
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

export function AngleMapTile() {
  return (
    <Tile
      label="Angle map"
      sub="avatar × awareness — stage 4"
      chips={<Chip tone="dim">not built</Chip>}
    >
      <div className="grid">
        <div />
        {AWARENESS.map((a) => (
          <div key={a} className="gh">
            {a}
          </div>
        ))}
        {[0, 1, 2, 3].map((row) => (
          <Fragment key={row}>
            <div className="rh">—</div>
            {AWARENESS.map((_, col) => (
              <div key={col} className="cell no" />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="legend">
        <span>
          <i className="sw" style={{ background: 'rgba(5, 150, 105, 0.4)' }} />
          evidenced
        </span>
        <span>
          <i className="sw" style={{ background: 'rgba(124, 58, 237, 0.4)' }} />
          inferred
        </span>
        <span>
          <i className="sw" style={{ background: 'var(--panel-2)' }} />
          empty
        </span>
      </div>
      <p className="muted">
        Fills in when stage 4 is built — the same reason stages 2–5 sit greyed
        out on the rail.
      </p>
    </Tile>
  );
}
