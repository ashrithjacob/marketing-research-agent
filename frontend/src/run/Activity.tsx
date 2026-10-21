import { useEffect, useState } from 'react';

import type { Run, RunEvent, StageInfo } from '../api';
import { story } from './activity-story';

const WORKING = new Set(['resolving', 'running', 'stopping']);

function ago(at: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(at).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return `${Math.round(seconds / 3600)} h ago`;
}

function useNow(live: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [live]);
  return now;
}

function Pulse({ run, stages, lastAt, now }: { run: Run; stages: StageInfo[]; lastAt: string | null; now: number }) {
  if (WORKING.has(run.status)) {
    const current = stages.filter((stage) => run.stage_status[stage.name]?.status === 'running').map((stage) => stage.title);
    const doing = run.status === 'resolving' ? 'Finding your product and its competitors' : run.status === 'stopping' ? 'Stopping' : current.length > 0 ? `Working on ${current.join(' and ')}` : 'Working';
    return (
      <div className="pulse live">
        <span className="pulse-dot" />
        <strong>Live</strong>
        <span>{doing}</span>
        {lastAt && <span className="pulse-ago">last update {ago(lastAt, now)}</span>}
      </div>
    );
  }
  if (run.status === 'awaiting_confirmation') {
    return (
      <div className="pulse waiting">
        <span className="pulse-dot" />
        <strong>Waiting for you</strong>
        <span>Confirm the product and competitors to start the research</span>
      </div>
    );
  }
  return (
    <div className="pulse idle">
      <span className="pulse-dot" />
      <strong>{run.status === 'completed' ? 'Finished' : 'Not running'}</strong>
      {run.ended_at && <span className="pulse-ago">{new Date(run.ended_at).toLocaleString()}</span>}
    </div>
  );
}

export default function Activity({ run, events, stages }: { run: Run; events: RunEvent[]; stages: StageInfo[] }) {
  const now = useNow(WORKING.has(run.status));
  const titles = Object.fromEntries(stages.map((stage) => [stage.name, stage.title]));
  const lines = story(events, titles);
  if (lines.length === 0) return null;
  return (
    <section className="panel activity">
      <div className="activity-head">
        <h2>Live activity</h2>
        <Pulse run={run} stages={stages} lastAt={lines[lines.length - 1].at} now={now} />
      </div>
      <ol>
        {lines.slice(-60).reverse().map((line) => (
          <li key={line.id} className={`tone-${line.tone}`}>
            <time>{new Date(line.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
            <span className="tone-mark" />
            <span className="activity-text">{line.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
