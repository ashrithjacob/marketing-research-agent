import type { AttributeRecord, Measurement, Source } from '../api';
import { Cite } from './cite';

function fieldOf(name: string): string {
  return name.split(':')[0].trim();
}

interface Cited {
  runId: string;
  sources: Source[];
}

function AttributeRows({ attributes, runId, sources }: { attributes: AttributeRecord[] } & Cited) {
  return (
    <>
      {attributes.map((attribute) => (
        <div key={attribute.id} className="kv-row">
          <span className="k">{attribute.key.replace(/_/g, ' ')}</span>
          <span className="v">
            {attribute.value} <Cite runId={runId} id={attribute.source_id} sources={sources} />
          </span>
        </div>
      ))}
    </>
  );
}

function MeasurementRows({ measurements, runId, sources }: { measurements: Measurement[] } & Cited) {
  return (
    <>
      {measurements.map((m) => (
        <div key={m.id} className="kv-row">
          <span className="k">{m.metric.replace(/_/g, ' ')}</span>
          <span className="v">
            {m.value} {m.unit}
            {m.period ? ` · ${m.period}` : ''} <Cite runId={runId} id={m.source_id} sources={sources} />
          </span>
        </div>
      ))}
    </>
  );
}

/** The fields a node must fill, in their set order, then everything else the agent kept under "Also found"; each with the page it was read off. */
export function FieldList({
  attributes,
  measurements = [],
  required,
  runId,
  sources,
}: {
  attributes: AttributeRecord[];
  measurements?: Measurement[];
  required: string[];
} & Cited) {
  const cited = { runId, sources };
  const isRequired = (name: string) => required.length === 0 || required.includes(fieldOf(name));
  const rank = (name: string) => required.indexOf(fieldOf(name));
  const byRank = <T,>(name: (row: T) => string) => (a: T, b: T) => rank(name(a)) - rank(name(b));
  const mainAttributes = attributes.filter((a) => isRequired(a.key)).sort(byRank((a) => a.key));
  const mainMeasurements = measurements.filter((m) => isRequired(m.metric)).sort(byRank((m) => m.metric));
  const extraAttributes = attributes.filter((a) => !isRequired(a.key));
  const extraMeasurements = measurements.filter((m) => !isRequired(m.metric));
  return (
    <>
      <div className="kv">
        <AttributeRows attributes={mainAttributes} {...cited} />
        <MeasurementRows measurements={mainMeasurements} {...cited} />
      </div>
      {extraAttributes.length + extraMeasurements.length > 0 && (
        <>
          <h3>Also found</h3>
          <div className="kv extra">
            <AttributeRows attributes={extraAttributes} {...cited} />
            <MeasurementRows measurements={extraMeasurements} {...cited} />
          </div>
        </>
      )}
    </>
  );
}
