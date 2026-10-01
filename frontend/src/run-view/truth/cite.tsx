import { api, type Source } from '../../api';

/** Where one row's fact came from: the page, and the archived copy that was read; an operator's figure says so. */
export function Cite({ runId, id, sources }: { runId: string; id: string; sources: Source[] }) {
  if (id === 'operator') return <span className="cite muted">entered by the operator</span>;
  const source = sources.find((s) => s.id === id);
  if (!source) return <span className="cite muted">source not recorded</span>;
  return (
    <span className="cite">
      <a href={source.url} target="_blank" rel="noreferrer" title={source.title || source.url}>
        {source.publisher || source.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]} ↗
      </a>
      {source.archived && (
        <a className="archived" href={api.sourceUrl(runId, source.id)} target="_blank" rel="noreferrer" title="the copy that was read">
          {' '}read
        </a>
      )}
    </span>
  );
}
