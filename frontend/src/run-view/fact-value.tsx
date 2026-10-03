import { factText, type Source } from '../api';
import { Cite, InlineCite } from './cite';

/** A recorded value laid out to read: a list when the agent recorded several items, and each source id it pasted into the text shown as a link to that source, never as the raw id. */
export function FactValue({ value, runId, sources }: { value: unknown; runId: string; sources: Source[] }) {
  const { items } = factText(value);
  const numbers = new Map<string, number>();
  const numberOf = (id: string) => numbers.get(id) ?? (numbers.set(id, numbers.size + 1), numbers.size);
  const render = (item: ReturnType<typeof factText>['items'][number], key: number) => (
    <span key={key}>
      {item.map((piece, i) =>
        'text' in piece ? <span key={i}>{piece.text}</span> : <InlineCite key={i} runId={runId} id={piece.source} sources={sources} n={numberOf(piece.source)} />,
      )}
    </span>
  );
  if (items.length <= 1) return <>{items.map(render)}</>;
  return (
    <ul className="fact-items">
      {items.map((item, i) => (
        <li key={i}>{render(item, i)}</li>
      ))}
    </ul>
  );
}

/** One fact as a closed row: its name and a one-line preview; opened, the whole value laid out, and the page it was read off. */
export function FactRow({
  label,
  value,
  suffix,
  sourceId,
  runId,
  sources,
}: {
  label: string;
  value: unknown;
  suffix?: string;
  sourceId: string;
  runId: string;
  sources: Source[];
}) {
  const { preview } = factText(value);
  return (
    <details className="kv-row fact">
      <summary>
        <span className="k">{label}</span>
        <span className="fact-preview">
          {preview}
          {suffix ? ` ${suffix}` : ''}
        </span>
      </summary>
      <div className="v">
        <FactValue value={value} runId={runId} sources={sources} />
        {suffix ? ` ${suffix}` : ''}
        <div className="fact-source">
          Read off <Cite runId={runId} id={sourceId} sources={sources} />
        </div>
      </div>
    </details>
  );
}
