import { useState } from 'react';

import { FINAL_STATUSES, runs } from './api';

export default function DeleteRun({ runId, status, onDeleted, onError }: { runId: string; status: string; onDeleted: () => void; onError: (message: string) => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const deletable = FINAL_STATUSES.has(status) || status === 'awaiting_confirmation';

  async function remove() {
    setBusy(true);
    try {
      await runs.delete(runId);
      onDeleted();
    } catch (e) {
      onError((e as Error).message);
      setBusy(false);
      setAsking(false);
    }
  }

  if (!asking) {
    return (
      <button type="button" className="row-delete" disabled={!deletable} title={deletable ? 'Delete this research' : 'Stop the run before deleting it'} aria-label="Delete this research" onClick={() => setAsking(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
        </svg>
      </button>
    );
  }
  return (
    <div className="row-confirm">
      <span className="small">Delete this research permanently? This cannot be undone.</span>
      <button type="button" className="danger" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete'}</button>
      <button type="button" className="ghost" disabled={busy} onClick={() => setAsking(false)}>Cancel</button>
    </div>
  );
}
