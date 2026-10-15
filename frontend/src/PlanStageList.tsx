import { useState } from 'react';

import { workspaceApi, type Plan, type PlanStage, type TaskCard } from './api';
import { Link, paths } from './route';

const SAYS: Record<2 | 3, string> = {
  2: 'The product in isolation: formula, doses against studies, claim limits per market, economics. LLM and web search; starts by itself once stage 1 is in.',
  3: 'Customer language from Amazon and Trustpilot reviews of the product and its competitors. Spends Apify money, so it waits for your approval card, which shows the most it can cost.',
};

function Stage({ plan, step, card, draft, onAct }: { plan: Plan; step: PlanStage; card: TaskCard | undefined; draft: boolean; onAct: (work: () => Promise<unknown>) => void }) {
  const [cost, setCost] = useState(step.inputs?.landed_unit_cost?.toString() ?? '');
  const [currency, setCurrency] = useState(step.inputs?.currency ?? 'GBP');
  const saveCost = () => {
    const value = Number(cost);
    if (cost && Number.isFinite(value) && value > 0) onAct(() => workspaceApi.setStage(plan.id, step.stage, { selected: step.selected, landed_unit_cost: value, currency }));
  };
  return (
    <li className={step.selected ? 'kept' : 'dropped'}>
      <label>
        <input type="checkbox" checked={step.selected} disabled={!draft} onChange={() => onAct(() => workspaceApi.setStage(plan.id, step.stage, { selected: !step.selected }))} />
        <span className="t">
          Stage {step.stage} · {step.title}
        </span>
        {card && <span className={`status ${card.status}`}>{card.status}</span>}
      </label>
      <div className="d">{SAYS[step.stage]}</div>
      {step.stage === 2 && step.selected && draft && (
        <div className="d always-row">
          Landed cost per unit
          <input value={cost} onChange={(e) => setCost(e.target.value)} onBlur={saveCost} placeholder="optional, e.g. 4.10" inputMode="decimal" />
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} onBlur={saveCost} className="short" />
        </div>
      )}
      {!draft && step.selected && !step.run_id && !step.error && <div className="d muted">Starts once every stage-1 task has ended and their findings are combined.</div>}
      {step.error && <div className={`d ${step.error.startsWith('waiting') ? 'ask' : 'error'}`}>{step.error}</div>}
      {card && card.product_id && (
        <Link to={paths.run(card.product_id, card.run_id)} className="d">
          Open what it found →
        </Link>
      )}
    </li>
  );
}

export default function PlanStageList({ plan, tasks, onAct }: { plan: Plan; tasks: TaskCard[]; onAct: (work: () => Promise<unknown>) => void }) {
  const draft = plan.status === 'draft';
  const combined = tasks.find((t) => t.run_id === plan.stage_one_run_id);
  if (plan.stages.length === 0) return null;
  return (
    <>
      <h3 className="plan-sub">After stage 1</h3>
      {combined && combined.product_id && (
        <p className="muted small">
          Stage 1 combined into one run: <Link to={paths.run(combined.product_id, combined.run_id)}>open it</Link> ({combined.status}).
        </p>
      )}
      <ul className="plan-tasks">
        {plan.stages.map((step) => (
          <Stage key={step.stage} plan={plan} step={step} card={tasks.find((t) => t.run_id === step.run_id && step.run_id !== '')} draft={draft} onAct={onAct} />
        ))}
      </ul>
    </>
  );
}
