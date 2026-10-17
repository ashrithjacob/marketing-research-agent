import { useState } from 'react';

import { api, findSource, workspaceApi, type Source } from '../api';

function MarkWrong({ runId, sourceId }: { runId: string; sourceId: string }) {
  const [marked, setMarked] = useState(false);
  if (marked) return <span className="wrong marked"> · marked wrong</span>;
  return (
    <button
      className="wrong"
      title="Mark this source wrong; it is recorded as your correction"
      onClick={async () => {
        const why = window.prompt('What is wrong with this source?');
        if (why === null) return;
        await workspaceApi.markSourceWrong(runId, sourceId, why);
        setMarked(true);
      }}
    >
      {' '}wrong?
    </button>
  );
}

function label(source: Source): string {
  if (source.publisher) return source.publisher;
  if (!/^https?:\/\//.test(source.url)) return source.kind.replace(/_/g, ' ');
  return source.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
}

/** Where one fact came from: the page it was read off, and the archived copy that was read; a source that is not a web page (an ad-library search) links to its archived copy only, and an operator's figure says so. */
export function Cite({ runId, id, sources }: { runId: string; id: string; sources: Source[] }) {
  if (id === 'operator') return <span className="cite muted">entered by the operator</span>;
  const source = findSource(sources, id);
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
      <MarkWrong runId={runId} sourceId={source.id} />
    </span>
  );
}

/** A source named inside a fact's own text, as a numbered link to the page itself, or to the copy that was read when it is not a web page, so a run of them stays short. */
export function InlineCite({ runId, id, sources, n }: { runId: string; id: string; sources: Source[]; n: number }) {
  const source = findSource(sources, id);
  if (!source) return <sup className="cite-n muted">[{n}]</sup>;
  const href = /^https?:\/\//.test(source.url) ? source.url : source.archived ? api.sourceUrl(runId, source.id) : undefined;
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

/** A competitor's ads, each with the date it was first seen, or an asterisk where the ad library gave none. */
export function AdCites({ runId, ids, sources }: { runId: string; ids: readonly string[]; sources: Source[] }) {
  const undated = ids.some((id) => !sources.find((s) => s.id === id)?.first_seen);
  return (
    <>
      {ids.map((id) => {
        const firstSeen = sources.find((s) => s.id === id)?.first_seen;
        return (
          <span key={id} className="ad-cite">
            <Cite runId={runId} id={id} sources={sources} />
            {firstSeen ? <span className="muted"> since {firstSeen}</span> : <span className="muted" title="first seen not found">*</span>}
          </span>
        );
      })}
      {undated && <span className="muted ad-note">* first seen not found</span>}
    </>
  );
}
