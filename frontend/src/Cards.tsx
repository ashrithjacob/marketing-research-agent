import { useState } from 'react';

import { workspaceApi, type Card } from './api';
import { Link, paths } from './route';

function OpenCard({ card, onError }: { card: Card; onError: (message: string) => void }) {
  const brief = card.action.kind === 'stage_brief';
  const lesson = card.action.kind === 'lesson' && card.action.editable !== false;
  const editable = lesson || brief;
  const [said, why] = brief ? [card.body, ''] : card.body.split('\n\nWhy: ');
  const [edited, setEdited] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const answer = card.kind === 'question' ? typed : (edited ?? said ?? '');
  const setAnswer = card.kind === 'question' ? setTyped : setEdited;
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
      <div className="card-title">{card.title}</div>
      {!editable && <div className="card-body">{said}</div>}
      {why && <div className="card-why">Because {why.charAt(0).toLowerCase()}{why.slice(1)}</div>}
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
          {lesson && <p className="card-note">Approve and the agent remembers this for every task on every brand. Edit it first if it is not quite right.</p>}
          {brief && <p className="card-note">This is what the research agents will be told. Edit anything, add your guidance at the end, then run it.</p>}
          {editable && <textarea className={brief ? 'lesson-text brief-text' : 'lesson-text'} rows={brief ? 14 : 2} value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={busy} />}
          <button className="ghost" disabled={busy} onClick={() => act(() => workspaceApi.rejectCard(card.id))}>
            {brief ? 'Not now' : 'Reject'}
          </button>
          <button className="primary" disabled={busy || (editable && !answer.trim())} onClick={() => act(() => workspaceApi.approveCard(card.id, editable ? answer.trim() : ''))}>
            {brief ? 'Run with this brief' : 'Approve'}
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
