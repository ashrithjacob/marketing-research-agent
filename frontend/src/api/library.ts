export interface LibraryDocument {
  id: string;
  workspace_id: string;
  title: string;
  filename: string;
  status: 'converting' | 'ready' | 'failed';
  pages: number;
  chars: number;
  error: string;
  created_at: string;
  updated_at: string;
}

export interface LibraryDocumentText extends LibraryDocument {
  markdown: string;
}

export type LibraryFrame =
  | { kind: 'page'; page: number; pages: number }
  | { kind: 'ready' | 'failed'; document: LibraryDocument };

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      detail = (await response.json()).detail ?? detail;
    } catch {}
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export const library = {
  list: async () =>
    (await readJson<{ data: LibraryDocument[] }>(await fetch('/api/research/library', { credentials: 'same-origin' }))).data,
  read: async (id: string) =>
    readJson<LibraryDocumentText>(await fetch(`/api/research/library/${id}`, { credentials: 'same-origin' })),
  remove: async (id: string) =>
    readJson<{ ok: boolean }>(await fetch(`/api/research/library/${id}`, { method: 'DELETE', credentials: 'same-origin' })),
  upload: async (file: File) => {
    const form = new FormData();
    form.set('file', file);
    return readJson<LibraryDocument>(await fetch('/api/research/library', { method: 'POST', body: form, credentials: 'same-origin' }));
  },
  follow: (id: string, onFrame: (frame: LibraryFrame) => void): (() => void) => {
    const source = new EventSource(`/api/research/library/${id}/events`);
    const take = (event: MessageEvent<string>) => {
      const frame = JSON.parse(event.data) as LibraryFrame;
      onFrame(frame);
      if (frame.kind !== 'page') source.close();
    };
    for (const kind of ['page', 'ready', 'failed']) source.addEventListener(kind, take as EventListener);
    return () => source.close();
  },
};
