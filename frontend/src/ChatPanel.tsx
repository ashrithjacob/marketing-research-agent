import { useEffect, useRef, useState, type FormEvent } from 'react';

import { workspaceApi, type Card, type ChatMessage } from './api';
import Cards from './Cards';
import ChatText from './ChatText';

export default function ChatPanel({ brand, chat, cards, connected, draft, onHide, onError }: { brand: string; chat: ChatMessage[]; cards: Card[]; connected: boolean; draft: { text: string; n: number }; onHide: () => void; onError: (message: string) => void }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const open = cards.filter((card) => card.status === 'open');

  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [chat, open.length]);
  useEffect(() => {
    if (draft.n > 0) setText(draft.text);
  }, [draft]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const said = text.trim();
    if (!said) return;
    setSending(true);
    try {
      await workspaceApi.say(said, brand);
      setText('');
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="chat">
      <div className="chat-head">
        Marketing agent <span className={`dot ${connected ? 'on' : ''}`} title={connected ? 'live' : 'reconnecting'} />
        <button className="ghost chat-hide" onClick={onHide} title="Hide the chat to read at full width">
          Hide ⟩
        </button>
      </div>
      <div className="chat-lines">
        {chat.length === 0 && <p className="muted small">Ask for market research on this brand, or paste one of its product pages.</p>}
        {chat.map((line) => (
          <div key={line.id} className={`line ${line.role}${line.partial ? ' partial' : ''}`}>
            {line.role === 'operator' ? <ChatText text={line.text} /> : line.text}
          </div>
        ))}
        <Cards cards={open} onError={onError} />
        <div ref={end} />
      </div>
      <form className="chat-say" onSubmit={send}>
        <input placeholder="Ask the agent…" value={text} onChange={(e) => setText(e.target.value)} disabled={sending} />
        <button className="primary" type="submit" disabled={sending || !text.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
