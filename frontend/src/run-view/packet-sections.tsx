import { api } from '../api';
import type { AttributeRecord, Competitor, Measurement, Source, StagePacket } from '../api';

/** §2.2's two classes, side by side; the relation was checked by the server's validator, this only lays it out. */
export function CompetitorsView({ packet }: { packet: StagePacket }) {
  const reference = packet.competitor_reference ?? null;
  const rows = packet.competitors ?? [];
  const curves = packet.saturation.filter((s) => s.node === 'competitors');
  return (
    <section>
      <h3>
        Competitors{' '}
        <span className="n">same active · direct = same form, indirect = different form</span>
      </h3>
      {reference && (
        <p className="comp-ref">
          Measured against <b>{reference.name}</b> — {reference.form}
          {reference.form_as_printed ? ` (${reference.form_as_printed})` : ''} ·{' '}
          {reference.actives.join(', ')}
        </p>
      )}
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
    </section>
  );
}

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

function SourceRow({ runId, source }: { runId: string; source: Source }) {
  const body = source.archived ? api.sourceUrl(runId, source.id) : null;
  return (
    <div className={`src-row ${source.admitted ? '' : 'rejected'}`}>
      <span className="st">{source.admitted ? 'ADMITTED' : 'SKIPPED'}</span>
      <span className="url" title={source.admission_reason || source.url}>
        {source.url}
      </span>
      <span className="kind">
        {source.kind}
        {source.marketing ? ' · marketing' : ''}
      </span>
      {body ? (
        <a className="archived" href={body} target="_blank" rel="noreferrer">
          body
        </a>
      ) : (
        <span className="archived off" title="not archived">
          —
        </span>
      )}
    </div>
  );
}

export function SourcesSection({
  runId,
  sources,
  admitted,
  rejected,
}: {
  runId: string;
  sources: Source[];
  admitted: Source[];
  rejected: Source[];
}) {
  return (
    <section>
      <h3>
        Sources{' '}
        <span className="n">
          {admitted.length} admitted · {rejected.length} rejected
        </span>
      </h3>
      <div className="src-list">
        {sources.map((source) => (
          <SourceRow key={source.id} runId={runId} source={source} />
        ))}
      </div>
    </section>
  );
}

export function AttributesSection({ attributes }: { attributes: AttributeRecord[] }) {
  return (
    <section>
      <h3>
        Attributes <span className="n">read off a page, not worked out</span>
      </h3>
      <div className="kv">
        {attributes.map((attribute) => (
          <div key={attribute.id} className="kv-row">
            <span className="k">{attribute.key}</span>
            <span className="v">{attribute.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MeasurementsSection({ measurements }: { measurements: Measurement[] }) {
  return (
    <section>
      <h3>
        Measurements <span className="n">numbers a source states</span>
      </h3>
      <div className="kv">
        {measurements.map((measurement) => (
          <div key={measurement.id} className="kv-row">
            <span className="k">{measurement.metric}</span>
            <span className="v">
              {measurement.value} {measurement.unit}
              {measurement.period ? ` · ${measurement.period}` : ''}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
