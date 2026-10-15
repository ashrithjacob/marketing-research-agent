import { useState } from 'react';

import { workspaceApi, type MemoryEntry } from './api';

function Entry({ entry, onError }: { entry: MemoryEntry; onError: (message: string) => void }) {
  const [text, setText] = useState(entry.text);
  const [editing, setEditing] = useState(false);

  async function act(work: () => Promise<unknown>) {
    try {
      await work();
      setEditing(false);
    } catch (err) {
      onError((err as Error).message);
    }
  }

  return (
    <li>
      {editing ? (
        <>
          <input value={text} onChange={(e) => setText(e.target.value)} />
          <button className="primary" disabled={!text.trim()} onClick={() => act(() => workspaceApi.editMemory(entry.entry_id, text.trim()))}>
            Save
          </button>
          <button className="ghost" onClick={() => (setText(entry.text), setEditing(false))}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <span className="t">{entry.text}</span>
          <span className="muted small">{entry.by === 'lesson' ? 'learned' : 'yours'} · v{entry.version}</span>
          <button className="ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="ghost" onClick={() => act(() => workspaceApi.deleteMemory(entry.entry_id))}>
            Delete
          </button>
        </>
      )}
    </li>
  );
}

export default function MemoryList({ entries, onError }: { entries: MemoryEntry[]; onError: (message: string) => void }) {
  return (
    <section className="side-box memory">
      <h2>What the agent has learned</h2>
      <p className="muted small">Every task and the agent read this. It grows from what you say and do, as lessons you approve in the chat. Each change is a new version.</p>
      <ul>
        {entries.map((entry) => (
          <Entry key={`${entry.entry_id}-${entry.version}`} entry={entry} onError={onError} />
        ))}
      </ul>
    </section>
  );
}
