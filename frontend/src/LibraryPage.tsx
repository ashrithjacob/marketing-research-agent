import { useRef, useState, type DragEvent } from 'react';
import { learningApi, library, type LibraryDocument, type LibraryDocumentText } from './api';
import { useLibrary, type Progress } from './use-library';

export default function LibraryPage({ onError }: { onError: (message: string) => void }) {
  const { documents, progress, upload, remove } = useLibrary(onError);
  const [open, setOpen] = useState<LibraryDocumentText | null>(null);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState('');
  const picker = useRef<HTMLInputElement>(null);

  const drop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void upload([...e.dataTransfer.files]);
  };

  async function distil(documentId: string) {
    try {
      await learningApi.distil(documentId);
      setNotice('A playbook is being distilled from it. Its card arrives in the inbox for you to approve.');
    } catch (err) {
      onError((err as Error).message);
    }
  }

  async function read(doc: LibraryDocument) {
    try {
      setOpen(await library.read(doc.id));
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <div className="products-page library-page">
      <h2>Library</h2>
      <p className="library-intro">
        Strategy documents and playbooks every research agent can read. Each PDF is turned into
        markdown; an agent sees the contents and reads only the sections it needs.
      </p>
      <div
        className={`library-drop${dragging ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      >
        <span>Drop PDFs here, or</span>
        <button className="primary" onClick={() => picker.current?.click()}>
          Choose files
        </button>
        <input
          ref={picker}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            void upload([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
        <span className="muted">PDF only for now. A scanned PDF with no text layer cannot be read yet.</span>
      </div>

      {notice && <p className="muted small">{notice}</p>}
      {documents === null && <div className="empty">Loading library…</div>}
      {documents?.length === 0 && <div className="empty">Nothing uploaded yet.</div>}
      <div className="library-list">
        {documents?.map((doc) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            progress={progress[doc.id]}
            onRead={() => void read(doc)}
            onRemove={() => void remove(doc.id)}
            onDistil={() => void distil(doc.id)}
          />
        ))}
      </div>

      {open && (
        <div className="library-reader">
          <div className="library-reader-top">
            <b>{open.title}</b>
            <span className="muted">
              {open.pages} pages · {open.chars.toLocaleString()} characters of markdown
            </span>
            <button className="ghost" onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
          <pre className="library-md">{open.markdown}</pre>
        </div>
      )}
    </div>
  );
}

function DocumentRow({
  doc,
  progress,
  onRead,
  onRemove,
  onDistil,
}: {
  doc: LibraryDocument;
  progress: Progress | undefined;
  onRead: () => void;
  onRemove: () => void;
  onDistil: () => void;
}) {
  const pct = progress ? Math.round((progress.page / progress.pages) * 100) : 0;
  return (
    <div className="library-row">
      <div className="library-row-top">
        <span className="product-card-title">{doc.title}</span>
        <span className={`status ${doc.status === 'ready' ? 'completed' : doc.status === 'converting' ? 'running' : 'failed'}`}>
          {doc.status}
        </span>
      </div>
      {doc.status === 'converting' && (
        <div className="library-progress" title={progress ? `page ${progress.page} of ${progress.pages}` : 'starting'}>
          <div style={{ width: `${pct}%` }} />
        </div>
      )}
      {doc.status === 'failed' && <div className="error-note">{doc.error}</div>}
      <div className="library-row-meta">
        <span className="muted">
          {doc.filename}
          {doc.status === 'ready' ? ` · ${doc.pages} pages · ${doc.chars.toLocaleString()} chars` : ''}
          {doc.status === 'converting' && progress ? ` · page ${progress.page} of ${progress.pages}` : ''}
        </span>
        {doc.status === 'ready' && (
          <button className="ghost" onClick={onRead}>
            Read
          </button>
        )}
        {doc.status === 'ready' && (
          <button className="ghost" title="An agent reads it and proposes a playbook, as a card for you to approve" onClick={onDistil}>
            Make a playbook
          </button>
        )}
        <button className="ghost" onClick={onRemove} disabled={doc.status === 'converting'}>
          Remove
        </button>
      </div>
    </div>
  );
}
