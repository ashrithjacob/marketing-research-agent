import { useState } from 'react';

import { workspaceApi, type Plan, type TaskCard } from './api';
import { Link, paths } from './route';

export default function PlanCard({ plan, tasks, onError }: { plan: Plan; tasks: TaskCard[]; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const draft = plan.status === 'draft';
  const subject = plan.brief.product || plan.brief.url;

  async function act(work: () => Promise<unknown>) {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const kept = plan.tasks.filter((task) => task.selected);
  const cap = kept.reduce((sum, task) => sum + task.contract.budget.max_usd, 0);

  return (
    <section className="plan">
      <div className="plan-head">
        <h2>{subject}</h2>
        <span className={`status ${draft ? 'queued' : 'completed'}`}>{draft ? 'awaiting approval' : 'approved'}</span>
      </div>
      <p className="muted small">Market: {plan.brief.market || 'anywhere'}</p>
      <ul className="plan-tasks">
        {plan.tasks.map((task) => {
          const card = tasks.find((t) => t.run_id === task.run_id);
          return (
            <li key={task.key} className={task.selected ? 'kept' : 'dropped'}>
              <label>
                <input
                  type="checkbox"
                  checked={task.selected}
                  disabled={!draft || busy}
                  onChange={() => act(() => workspaceApi.toggle(plan.id, task.key, !task.selected))}
                />
                <span className="t">{task.title}</span>
                {card && <span className={`status ${card.status}`}>{card.status}</span>}
              </label>
              <div className="d">{task.contract.objective}</div>
              <div className="d muted">
                Spend cap ${task.contract.budget.max_usd.toFixed(2)} · at most {task.contract.budget.max_minutes} min
                {card && ` · ${card.sources} sources, ${card.attributes + card.measurements} facts, ${card.gaps} gaps, ${card.calls} model calls`}
                {card?.billed_usd != null && ` · billed $${card.billed_usd.toFixed(4)}`}
              </div>
              {card?.error && <div className="d warn">{card.error}</div>}
              {task.error && <div className="d error">{task.error}</div>}
              {card && card.product_id && (
                <Link to={paths.run(card.product_id, card.run_id)} className="d">
                  Open what it found →
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {draft && (
        <div className="plan-approve">
          <p className="muted small">Nothing runs until you approve. Anything that would spend Apify money gets its own approval button.</p>
          <button className="primary" disabled={busy || kept.length === 0} onClick={() => act(() => workspaceApi.approve(plan.id))}>
            Approve {kept.length} task{kept.length === 1 ? '' : 's'} · up to ${cap.toFixed(2)}
          </button>
        </div>
      )}
    </section>
  );
}
