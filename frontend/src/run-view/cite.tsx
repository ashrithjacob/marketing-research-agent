import { api, type Source } from '../api';

function label(source: Source): string {
  if (source.publisher) return source.publisher;
  if (!/^https?:\/\//.test(source.url)) return source.kind.replace(/_/g, ' ');
  return source.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
}

/** Where one fact came from: the page it was read off, and the archived copy that was read; a source that is not a web page (an ad-library search) links to its archived copy only, and an operator's figure says so. */
export function Cite({ runId, id, sources }: { runId: string; id: string; sources: Source[] }) {
  if (id === 'operator') return <span className="cite muted">entered by the operator</span>;
  const source = sources.find((s) => s.id === id);
  if (!source) return <span className="cite muted">source not recorded</span>;
  const live = /^https?:\/\//.test(source.url);
  const archived = source.archived ? api.sourceUrl(runId, source.id) : null;
  return (
    <span className="cite">
      {live ? (
        <a href={source.url} target="_blank" rel="noreferrer" title={source.title || source.url}>
          {label(source)} ↗
        </a>
      ) : archived ? (
        <a href={archived} target="_blank" rel="noreferrer" title={source.title || source.url}>
          {label(source)} ↗
        </a>
      ) : (
        <span className="muted" title={source.url}>{label(source)}</span>
      )}
      {live && archived && (
        <a className="archived" href={archived} target="_blank" rel="noreferrer" title="the copy that was read">
          {' '}read
        </a>
      )}
    </span>
  );
}

/** A source named inside a fact's own text, as a numbered link to the copy that was read, so a run of them stays short. */
export function InlineCite({ runId, id, sources, n }: { runId: string; id: string; sources: Source[]; n: number }) {
  const source = sources.find((s) => s.id === id);
  if (!source) return <sup className="cite-n muted">[{n}]</sup>;
  const href = source.archived ? api.sourceUrl(runId, source.id) : /^https?:\/\//.test(source.url) ? source.url : undefined;
  return (
    <sup className="cite-n">
      <a href={href} target="_blank" rel="noreferrer" title={`${label(source)} — ${source.title || source.url}`}>
        [{n}]
      </a>
    </sup>
  );
}

/** Each of several sources, side by side. */
export function Cites({ runId, ids, sources }: { runId: string; ids: readonly string[]; sources: Source[] }) {
  return (
    <>
      {ids.map((id) => (
        <Cite key={id} runId={runId} id={id} sources={sources} />
      ))}
    </>
  );
}
