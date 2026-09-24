import { api } from '../api';
import type { Source } from '../api';

/** One admitted-or-skipped source row; the archived body is the audit trail. */
export function SourceRow({ runId, source }: { runId: string; source: Source }) {
  const body = source.archived ? api.sourceUrl(runId, source.id) : null;
  return (
    <div className={`src-row ${source.admitted ? '' : 'rejected'}`}>
      <span className="st">{source.admitted ? 'ADMITTED' : 'SKIPPED'}</span>
      <a className="url" href={source.url} target="_blank" rel="noreferrer" title={source.admission_reason || source.url}>
        {source.url}
      </a>
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
