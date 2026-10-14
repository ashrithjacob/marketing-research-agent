import { useCallback, useEffect, useState } from 'react';

import { draftApi, type DraftPage as Page } from './api';
import { Link, paths } from './route';

const STATUS: Record<Page['draft']['status'], string> = {
  writing: 'being written',
  critique: 'being critiqued',
  review: 'waiting for you',
  approved: 'approved',
  rejected: 'rejected',
};

function Section({ title, shown, raw, editable, onSave }: { title: string; shown: string; raw: string; editable: boolean; onSave: (text: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(raw);
  useEffect(() => setText(raw), [raw]);
  return (
    <section className="draft-section">
      <div className="draft-section-head">
        <h3>{title}</h3>
        {editable && !editing && (
          <button className="ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="draft-edit">
          <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
          <p className="muted small">[[id]] cites a finding; {'{{id}}'} puts its words or figure in.</p>
          <button className="ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <button
            className="primary"
            onClick={async () => {
              await onSave(text);
              setEditing(false);
            }}
          >
            Save as a new version
          </button>
        </div>
      ) : (
        <p className="draft-text">{shown}</p>
      )}
    </section>
  );
}

export default function DraftPage({ draftId, onError }: { draftId: string; onError: (message: string) => void }) {
  const [page, setPage] = useState<Page | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPage(await draftApi.getDraft(draftId));
    } catch (err) {
      onError((err as Error).message);
    }
  }, [draftId, onError]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function act(work: () => Promise<unknown>) {
    setBusy(true);
    try {
      await work();
      await load();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!page) return <div className="empty">Loading draft…</div>;
  const { draft, view, playbook } = page;
  const review = draft.status === 'review';
  const raw = (key: string) => draft.sections.find((s) => s.key === key)?.text ?? '';
  const met = draft.verdicts.filter((v) => v.pass).length;

  return (
    <div className="draft">
      <div className="plan-head">
        <h2>{playbook?.title ?? draft.playbook}</h2>
        <span className={`status ${review ? 'queued' : draft.status === 'rejected' ? 'cancelled' : draft.status === 'approved' ? 'completed' : 'running'}`}>{STATUS[draft.status]}</span>
      </div>
      <p className="muted small">
        Version {draft.version}, by {draft.by === 'owner' ? 'you' : 'the writer'} · <Link to={paths.inbox()}>Inbox</Link>
      </p>
      {view.sections.map((section) => (
        <Section
          key={section.key}
          title={section.title}
          shown={section.text}
          raw={raw(section.key)}
          editable={review && !busy}
          onSave={(text) => act(() => draftApi.editDraft(draft.id, [{ key: section.key, text }]))}
        />
      ))}
      {view.notes.length > 0 && (
        <section className="draft-notes">
          <h3>What it cites</h3>
          <ol>
            {view.notes.map((note) => (
              <li key={note.id}>
                <span className="muted small">{note.kind} {note.id}</span> {note.value}
              </li>
            ))}
          </ol>
        </section>
      )}
      {draft.verdicts.length > 0 && (
        <section className="draft-verdicts">
          <h3>
            The critic: {met} of {draft.verdicts.length} criteria met
          </h3>
          <ul>
            {draft.verdicts.map((verdict) => (
              <li key={verdict.criterion} className={verdict.pass ? 'pass' : 'fail'}>
                <span className={`status ${verdict.pass ? 'completed' : 'cancelled'}`}>{verdict.pass ? 'met' : 'not met'}</span> {verdict.criterion}
                <div className="d muted">{verdict.why}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {review && (
        <div className="plan-approve">
          <button className="ghost" disabled={busy} onClick={() => act(() => draftApi.rejectDraft(draft.id, ''))}>
            Reject
          </button>
          <button className="primary" disabled={busy} onClick={() => act(() => draftApi.approveDraft(draft.id))}>
            Approve this draft
          </button>
        </div>
      )}
    </div>
  );
}
