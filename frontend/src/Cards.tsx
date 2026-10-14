import { useState } from 'react';

import { workspaceApi, type Card } from './api';

function OpenCard({ card, onError }: { card: Card; onError: (message: string) => void }) {
  const [answer, setAnswer] = useState('');
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
          <button className="ghost" disabled={busy} onClick={() => act(() => workspaceApi.rejectCard(card.id))}>
            Reject
          </button>
          <button className="primary" disabled={busy} onClick={() => act(() => workspaceApi.approveCard(card.id))}>
            Approve
          </button>
        </div>
      )}
    </li>
  );
}

export default function Cards({ cards, today, onError }: { cards: Card[]; today: number; onError: (message: string) => void }) {
  const open = cards.filter((card) => card.status === 'open');
  const settled = cards.filter((card) => card.status !== 'open');
  if (cards.length === 0) return null;
  return (
    <section className="cards">
      <div className="cards-head">
        {open.length > 0 ? `${open.length} waiting for you` : 'Nothing waiting for you'}
        <span className="muted small">{today} card{today === 1 ? '' : 's'} today</span>
      </div>
      <ul>
        {open.map((card) => (
          <OpenCard key={card.id} card={card} onError={onError} />
        ))}
        {settled.map((card) => (
          <li key={card.id} className="card settled">
            <span className={`status ${card.status === 'rejected' ? 'cancelled' : 'completed'}`}>{card.status}</span> {card.title}: {card.body}
            {card.answer && card.kind === 'question' && <div className="card-body">You answered: {card.answer}</div>}
          </li>
        ))}
      </ul>
    </section>
  );
}
