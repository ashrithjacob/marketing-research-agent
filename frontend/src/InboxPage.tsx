import type { Feedback } from './api';
import Cards from './Cards';
import { useWorkspace } from './use-workspace';

const SAID: Record<Feedback['verdict'], string> = {
  reject: 'You rejected',
  edited: 'You changed',
  accept: 'You approved',
  answer: 'You answered',
  steer: 'You guided',
  outcome: 'Results came in for',
};

function about(feedback: Feedback): string {
  const { target } = feedback;
  if (target.kind === 'source') return `a source of run ${target.run_id.slice(0, 8)}`;
  if (target.kind === 'contract') return target.id === target.plan_id ? 'a plan' : `the ${target.id.replace(/_/g, ' ')} task`;
  if (target.kind === 'card') return 'a card';
  return `task ${target.run_id.slice(0, 8)}`;
}

function detail(feedback: Feedback): string {
  if (feedback.text) return feedback.text;
  if (feedback.diff) return Object.entries(feedback.diff).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${JSON.stringify(value)}`).join('; ');
  return '';
}

export default function InboxPage({ onError }: { onError: (message: string) => void }) {
  const { board } = useWorkspace();
  if (!board) return <div className="empty">Loading…</div>;
  return (
    <div className="inbox">
      <Cards cards={board.cards} today={board.cards_today} onError={onError} />
      {board.cards.length === 0 && <div className="empty">Nothing is waiting for you.</div>}
      <section className="feedback-log">
        <h2>What you have told the system</h2>
        <p className="muted small">Every correction, approval, answer and steer, kept against what it was about. Later parts learn from these.</p>
        {board.feedback.length === 0 && <p className="muted small">Nothing yet.</p>}
        <ul>
          {board.feedback.map((feedback) => (
            <li key={feedback.id} className={feedback.strength}>
              <span className="when">{new Date(feedback.created_at).toLocaleString()}</span>
              <span className="what">
                {SAID[feedback.verdict]} {about(feedback)}
              </span>
              {detail(feedback) && <span className="d">{detail(feedback)}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
