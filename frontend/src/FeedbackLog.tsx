import type { Feedback } from './api';

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
  if (target.kind === 'draft') return feedback.verdict === 'outcome' ? 'the ad a draft became' : 'a draft';
  return `task ${target.run_id.slice(0, 8)}`;
}

function detail(feedback: Feedback): string {
  if (feedback.text) return feedback.text;
  if (feedback.diff) return Object.entries(feedback.diff).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${JSON.stringify(value)}`).join('; ');
  return '';
}

export default function FeedbackLog({ feedback }: { feedback: Feedback[] }) {
  return (
    <section className="feedback-log">
      <h2>What you have told the system</h2>
      <p className="muted small">Every correction, approval, answer and steer, kept against what it was about. The reviewer learns from these.</p>
      {feedback.length === 0 && <p className="muted small">Nothing yet.</p>}
      <ul>
        {feedback.map((f) => (
          <li key={f.id} className={f.strength}>
            <span className="when">{new Date(f.created_at).toLocaleString()}</span>
            <span className="what">
              {SAID[f.verdict]} {about(f)}
            </span>
            {detail(f) && <span className="d">{detail(f)}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
