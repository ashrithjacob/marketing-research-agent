import { useState } from 'react';

import { workspaceApi, type Card } from './api';
import { Link, paths } from './route';

function OpenCard({ card, onError }: { card: Card; onError: (message: string) => void }) {
  const lesson = card.action.kind === 'lesson' && card.action.editable !== false;
  const [answer, setAnswer] = useState(lesson ? card.body.split('\n\nWhy:')[0] ?? '' : '');
  const [busy, setBusy] = useState(false);

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

  return (
    <li className={`card ${card.kind}`}>
      <div className="card-title">{card.kind === 'approval' ? 'Needs your approval' : 'Needs your answer'} · {card.title}</div>
      <div className="card-body">{card.body}</div>
      {card.action.draft_id && (
        <Link to={paths.draft(card.action.draft_id)} className="d">
          Read the draft →
        </Link>
      )}
      {card.kind === 'question' ? (
        <form
          className="card-answer"
          onSubmit={(e) => {
            e.preventDefault();
            if (answer.trim()) void act(() => workspaceApi.answerCard(card.id, answer.trim()));
          }}
        >
          <input placeholder="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={busy} />
          <button className="primary" type="submit" disabled={busy || !answer.trim()}>
            Answer
          </button>
        </form>
      ) : (
        <div className="card-answer">
          {lesson && <textarea className="lesson-text" rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={busy} />}
          <button className="ghost" disabled={busy} onClick={() => act(() => workspaceApi.rejectCard(card.id))}>
            Reject
          </button>
          <button className="primary" disabled={busy || (lesson && !answer.trim())} onClick={() => act(() => workspaceApi.approveCard(card.id, lesson ? answer.trim() : ''))}>
            Approve
          </button>
        </div>
      )}
    </li>
  );
}

export default function Cards({ cards, onError }: { cards: Card[]; onError: (message: string) => void }) {
  if (cards.length === 0) return null;
  return (
    <ul className="chat-cards">
      {cards.map((card) => (
        <OpenCard key={card.id} card={card} onError={onError} />
      ))}
    </ul>
  );
}
