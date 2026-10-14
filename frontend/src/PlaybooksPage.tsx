import { useCallback, useEffect, useState } from 'react';

import { learningApi, type PlaybookReport } from './api';

function Report({ report, onAct }: { report: PlaybookReport; onAct: (work: () => Promise<unknown>) => void }) {
  const { playbook, versions, flag } = report;
  const [open, setOpen] = useState(false);
  return (
    <section className="plan playbook">
      <div className="plan-head">
        <h2>{playbook.title}</h2>
        <span className={`status ${playbook.status === 'active' ? 'completed' : playbook.status === 'stale' ? 'queued' : 'cancelled'}`}>{playbook.status}</span>
      </div>
      <p className="muted small">
        {playbook.key} · version {playbook.version}, by {playbook.by} · from "{playbook.document_title}"
        {playbook.status === 'archived' && (
          <button className="ghost" onClick={() => onAct(() => learningApi.restorePlaybook(playbook.key))}>
            Restore
          </button>
        )}
      </p>
      {flag && <div className="d warn">Did worse than the version before: {flag}</div>}
      <table className="playbook-scores">
        <thead>
          <tr>
            <th>Version</th>
            <th>Drafts</th>
            <th>Passed first try</th>
            <th>Accepted unchanged</th>
            <th>Corrected</th>
            <th>Ads</th>
            <th>Return on ad spend</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.version}>
              <td>
                {v.version} <span className="muted small">{v.by}</span>
              </td>
              <td>{v.tasks}</td>
              <td>{v.first_try}</td>
              <td>
                {v.accepted_unchanged} of {v.decided}
              </td>
              <td>{v.corrected}</td>
              <td>{v.ads ? `${v.ads} · $${v.spend.toFixed(2)}` : '—'}</td>
              <td>{v.roas === null ? '—' : v.roas.toFixed(2)}</td>
              <td>
                {v.version !== playbook.version && (
                  <button className="ghost" onClick={() => onAct(() => learningApi.rollbackPlaybook(playbook.key, v.version))}>
                    Roll back to this
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="ghost" onClick={() => setOpen(!open)}>
        {open ? 'Hide' : 'Show'} sections and criteria
      </button>
      {open && (
        <div className="playbook-body">
          <ol>
            {playbook.sections.map((s) => (
              <li key={s.key}>
                <strong>{s.title}</strong> — {s.describe}
              </li>
            ))}
          </ol>
          <p className="muted small">The critic checks:</p>
          <ol>
            {playbook.criteria.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

export default function PlaybooksPage({ onError }: { onError: (message: string) => void }) {
  const [reports, setReports] = useState<PlaybookReport[] | null>(null);

  const load = useCallback(async () => {
    try {
      setReports(await learningApi.playbooks());
    } catch (err) {
      onError((err as Error).message);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(work: () => Promise<unknown>) {
    try {
      await work();
      await load();
    } catch (err) {
      onError((err as Error).message);
    }
  }

  if (!reports) return <div className="empty">Loading playbooks…</div>;
  return (
    <div className="draft">
      <p className="muted small">
        How each kind of ad is written. A change is a new version, from a lesson you approved, a rollback, or a document distilled in the library; each
        version is scored on the drafts written with it and the ads they became. Nothing is rolled back without you.
      </p>
      {reports.map((report) => (
        <Report key={report.playbook.key} report={report} onAct={(work) => void act(work)} />
      ))}
    </div>
  );
}
