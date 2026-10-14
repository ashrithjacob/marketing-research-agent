import { useState } from 'react';

import { workspaceApi, type AlwaysOnStatus, type Schedule } from './api';

const TASKS = [
  ['product_facts', 'Product facts'],
  ['category_numbers', 'Category numbers'],
] as const;

export default function AlwaysOnPanel({ status, schedules, onError }: { status: AlwaysOnStatus; schedules: Schedule[]; onError: (message: string) => void }) {
  const [cap, setCap] = useState(status.daily_cap_usd?.toString() ?? '');
  const [subject, setSubject] = useState('');
  const [taskKey, setTaskKey] = useState<string>('product_facts');
  const [days, setDays] = useState('30');

  async function act(work: () => Promise<unknown>) {
    try {
      await work();
    } catch (err) {
      onError((err as Error).message);
    }
  }

  const url = /^https?:\/\//i.test(subject.trim());
  return (
    <section className="always">
      <div className="always-head">
        <h2>Always on</h2>
        <span className={`status ${status.on ? 'running' : 'cancelled'}`}>{status.on ? 'on' : 'off'}</span>
      </div>
      <p className="muted small">
        On, the operator may start product facts and category numbers by itself, from your schedules or when a task ends, up to the daily cap.
        Anything that spends Apify money still waits for your approval. Off, work starts only when you approve a plan.
      </p>
      <div className="always-row">
        <label>
          Daily cap $
          <input value={cap} onChange={(e) => setCap(e.target.value)} placeholder="e.g. 2" inputMode="decimal" />
        </label>
        <button className="primary" onClick={() => act(() => workspaceApi.setAlwaysOn(!status.on, status.on ? status.daily_cap_usd : Number(cap)))}>
          {status.on ? 'Turn off' : 'Turn on'}
        </button>
        <span className="muted small">
          Today ${status.spent_today.toFixed(2)}
          {status.daily_cap_usd !== null ? ` of $${status.daily_cap_usd.toFixed(2)}` : ''} · {status.running} running
        </span>
      </div>
      <h3>Schedules</h3>
      <ul>
        {schedules.map((s) => (
          <li key={s.id}>
            {s.task_key.replace(/_/g, ' ')} for {s.brief.product || s.brief.url} every {s.every_days} days
            <button className="ghost" onClick={() => act(() => workspaceApi.removeSchedule(s.id))}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form
        className="always-row"
        onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            await workspaceApi.addSchedule(taskKey, Number(days), url ? { product: '', url: subject.trim() } : { product: subject.trim() });
            setSubject('');
          });
        }}
      >
        <select value={taskKey} onChange={(e) => setTaskKey(e.target.value)}>
          {TASKS.map(([key, title]) => (
            <option key={key} value={key}>
              {title}
            </option>
          ))}
        </select>
        <input placeholder="Product or site" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <label>
          every
          <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" className="days" />
          days
        </label>
        <button className="ghost" type="submit" disabled={!subject.trim() || !(Number(days) >= 1)}>
          Add
        </button>
      </form>
    </section>
  );
}
