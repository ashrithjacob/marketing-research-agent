import { useState } from 'react';

import { draftApi, workspaceApi, type Plan, type TaskCard } from './api';
import { Link, paths } from './route';
import PlanStageList from './PlanStageList';
import StopWhen from './StopWhen';

export default function PlanCard({ plan, tasks, onError }: { plan: Plan; tasks: TaskCard[]; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);
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
  const owned = kept.filter((task) => !task.auto);
  const cap = kept.reduce((sum, task) => sum + task.contract.budget.max_usd, 0);
  const found = tasks.some((card) => plan.tasks.some((task) => task.run_id === card.run_id) && (card.status === 'completed' || card.status === 'partial'));

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
                  disabled={!draft || busy || task.auto}
                  onChange={() => act(() => workspaceApi.editTask(plan.id, task.key, { selected: !task.selected }))}
                />
                <span className="t">{task.title}</span>
                {card && <span className={`status ${card.status}`}>{card.status}</span>}
              </label>
              <div className="d">{task.contract.objective}</div>
              {task.auto && (
                <div className="d muted">
                  {task.selected ? 'Needed first: the tasks after it measure against what it finds.' : 'Not needed for the tasks kept.'}
                </div>
              )}
              {!draft && task.selected && task.after.length > 0 && !task.run_id && !task.error && (
                <div className="d muted">Starts when {plan.tasks.filter((t) => task.after.includes(t.key)).map((t) => t.title).join(', ')} finishes.</div>
              )}
              <StopWhen
                text={task.contract.stop_when ?? ''}
                editable={draft && task.selected && !busy}
                onSave={(text) => act(() => workspaceApi.editTask(plan.id, task.key, { stop_when: text }))}
              />
              <div className="d muted">
                Spend cap ${task.contract.budget.max_usd.toFixed(2)} · at most {task.contract.budget.max_minutes} min
                {card && ` · ${card.sources} sources, ${card.attributes + card.measurements} facts, ${card.gaps} gaps, ${card.calls} model calls`}
                {card?.billed_usd != null && ` · billed $${card.billed_usd.toFixed(4)}`}
              </div>
              {card?.question && <div className="d ask">Waiting for your answer, on its card above: {card.question}</div>}
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
      <PlanStageList plan={plan} tasks={tasks} onAct={(work) => void act(work)} />
      {!draft && found && (
        <div className="plan-approve">
          {writing ? (
            <p className="muted small">The writer started. When the critic has checked the draft, it waits for you in the inbox.</p>
          ) : (
            <button className="primary" disabled={busy} onClick={() => act(async () => { await draftApi.writeDraft(plan.id); setWriting(true); })}>
              Write a long-form static from what was found
            </button>
          )}
        </div>
      )}
      {draft && (
        <div className="plan-approve">
          <p className="muted small">Nothing runs until you approve. Anything that would spend Apify money gets its own approval button.</p>
          <button className="primary" disabled={busy || owned.length === 0} onClick={() => act(() => workspaceApi.approve(plan.id))}>
            Approve {kept.length} task{kept.length === 1 ? '' : 's'} · up to ${cap.toFixed(2)}
          </button>
        </div>
      )}
    </section>
  );
}
