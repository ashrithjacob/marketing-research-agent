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
  const [text, setText] = useState('');
  return (
    <section className="memory">
      <h2>What we know about this brand</h2>
      <p className="muted small">Every task and the operator read this. Approved lessons add to it; you can add, change or delete anything. Nothing is overwritten: each change is a new version.</p>
      <ul>
        {entries.map((entry) => (
          <Entry key={`${entry.entry_id}-${entry.version}`} entry={entry} onError={onError} />
        ))}
      </ul>
      <form
        className="memory-add"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          try {
            await workspaceApi.addMemory(text.trim());
            setText('');
          } catch (err) {
            onError((err as Error).message);
          }
        }}
      >
        <input placeholder="Add something every task should know" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary" type="submit" disabled={!text.trim()}>
          Add
        </button>
      </form>
    </section>
  );
}
