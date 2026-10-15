import { useCallback, useEffect, useState } from 'react';

import { workspaceApi, type AlwaysOnStatus } from './api';

export default function AlwaysOnSwitch({ onError }: { onError: (message: string) => void }) {
  const [status, setStatus] = useState<AlwaysOnStatus | null>(null);
  const [cap, setCap] = useState('');

  const read = useCallback(
    () =>
      workspaceApi
        .alwaysOn()
        .then((s) => {
          setStatus(s);
          setCap((c) => c || (s.daily_cap_usd?.toString() ?? ''));
        })
        .catch((err: Error) => onError(err.message)),
    [onError],
  );

  useEffect(() => {
    void read();
    const timer = setInterval(read, 15000);
    return () => clearInterval(timer);
  }, [read]);

  async function save(on: boolean) {
    const dollars = Number(cap);
    try {
      setStatus(await workspaceApi.setAlwaysOn(on, on ? dollars : status?.daily_cap_usd ?? null));
    } catch (err) {
      onError((err as Error).message);
    }
  }

  if (!status) return null;
  const capValid = Number(cap) > 0;
  return (
    <div className={`always-switch${status.on ? ' on' : ''}`} title="On, the agent may start product facts and category numbers by itself, from schedules or when a task ends, up to the daily cap. Anything that spends Apify money still waits for your Approve button.">
      <button role="switch" aria-checked={status.on} className="switch" disabled={!status.on && !capValid} onClick={() => save(!status.on)}>
        <span className="knob" />
      </button>
      <span className="always-label">Always on</span>
      <label className="always-cap">
        $
        <input
          value={cap}
          inputMode="decimal"
          placeholder="cap"
          onChange={(e) => setCap(e.target.value)}
          onBlur={() => status.on && capValid && Number(cap) !== status.daily_cap_usd && save(true)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        /day
      </label>
      <span className="muted small">
        ${status.spent_today.toFixed(2)} today{status.running > 0 ? ` · ${status.running} running` : ''}
      </span>
    </div>
  );
}
