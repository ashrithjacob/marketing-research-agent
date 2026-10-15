import { useRef, useState, type DragEvent } from 'react';

import { useLibrary } from './use-library';

export default function MemoryFolder({ onError }: { onError: (message: string) => void }) {
  const { documents, progress, upload, remove } = useLibrary(onError);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const drop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragging(false);
    void upload([...e.dataTransfer.files]);
  };

  return (
    <section
      className={`side-box memory-folder${dragging ? ' over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
    >
      <div className="side-head">
        <h2>Memory folder</h2>
        <button className="ghost" onClick={() => picker.current?.click()}>
          Add files
        </button>
      </div>
      <input
        ref={picker}
        type="file"
        accept="application/pdf,.pdf,.md,.markdown,.txt"
        multiple
        hidden
        onChange={(e) => {
          void upload([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
      <p className="muted small">PDFs and playbooks (.md, .txt) the agent and every research task can read. Drop files here.</p>
      <ul className="folder-list">
        {documents?.map((doc) => (
          <li key={doc.id}>
            <span className="t">{doc.title}</span>
            <span className={`status ${doc.status === 'ready' ? 'completed' : doc.status === 'converting' ? 'running' : 'failed'}`}>
              {doc.status === 'converting' && progress[doc.id] ? `page ${progress[doc.id]!.page} of ${progress[doc.id]!.pages}` : doc.status}
            </span>
            <button className="ghost" disabled={doc.status === 'converting'} onClick={() => void remove(doc.id)}>
              Remove
            </button>
            {doc.status === 'failed' && <div className="error-note">{doc.error}</div>}
          </li>
        ))}
      </ul>
    </section>
  );
}
