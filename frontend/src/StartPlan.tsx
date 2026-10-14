import { useState, type FormEvent } from 'react';

import { workspaceApi, type Plan } from './api';

export default function StartPlan({ onClose, onStarted }: { onClose: () => void; onStarted: (plan: Plan) => void }) {
  const [subject, setSubject] = useState('');
  const [market, setMarket] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isUrl = /^https?:\/\//i.test(subject.trim()) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(subject.trim());

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const text = subject.trim();
      const brief = isUrl ? { product: '', url: text, market: market.trim() } : { product: text, market: market.trim() };
      onStarted(await workspaceApi.startPlan(brief));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Start</h2>
        <p className="lede">
          Name the product or paste its site. You get a plan of tasks to review first: nothing runs, and nothing is spent,
          until you approve it. Change the plan with its checkboxes, or ask for changes in the chat beside it.
        </p>
        <input autoFocus placeholder="Product name, or its site's URL" value={subject} onChange={(e) => setSubject(e.target.value)} />
        {isUrl && <p className="muted small">Read as a site: the tasks read the product off its own pages.</p>}
        <input placeholder="Market, e.g. UK (leave empty for anywhere)" value={market} onChange={(e) => setMarket(e.target.value)} />
        {error && <p className="error small">{error}</p>}
        <div className="row">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={!subject.trim() || busy}>
            {busy ? 'Planning…' : 'Show the plan'}
          </button>
        </div>
      </form>
    </div>
  );
}
