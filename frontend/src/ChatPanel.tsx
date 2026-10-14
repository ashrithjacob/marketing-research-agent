import { useEffect, useRef, useState, type FormEvent } from 'react';

import { workspaceApi, type ChatMessage } from './api';

export default function ChatPanel({ chat, planId, connected, onError }: { chat: ChatMessage[]; planId: string; connected: boolean; onError: (message: string) => void }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [chat]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const said = text.trim();
    if (!said) return;
    setSending(true);
    try {
      await workspaceApi.say(said, planId);
      setText('');
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <aside className="chat">
      <div className="chat-head">
        Operator <span className={`dot ${connected ? 'on' : ''}`} title={connected ? 'live' : 'reconnecting'} />
      </div>
      <div className="chat-lines">
        {chat.length === 0 && <p className="muted small">Ask for changes to the plan, or guide the work once it runs.</p>}
        {chat.map((line) => (
          <div key={line.id} className={`line ${line.role}${line.partial ? ' partial' : ''}`}>
            {line.text}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="chat-say" onSubmit={send}>
        <input placeholder="Tell the operator…" value={text} onChange={(e) => setText(e.target.value)} disabled={sending} />
        <button className="primary" type="submit" disabled={sending || !text.trim()}>
          Send
        </button>
      </form>
    </aside>
  );
}
