import { useCallback, useEffect, useRef, useState } from 'react';
import { library, type LibraryDocument, type LibraryFrame } from './api';

export interface Progress {
  page: number;
  pages: number;
}

export function useLibrary(onError: (message: string) => void) {
  const [documents, setDocuments] = useState<LibraryDocument[] | null>(null);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const following = useRef(new Map<string, () => void>());

  const follow = useCallback((id: string) => {
    if (following.current.has(id)) return;
    const stop = library.follow(id, (frame: LibraryFrame) => {
      if (frame.kind === 'page') {
        setProgress((p) => ({ ...p, [id]: { page: frame.page, pages: frame.pages } }));
        return;
      }
      following.current.delete(id);
      setDocuments((docs) => (docs ?? []).map((d) => (d.id === id ? frame.document : d)));
    });
    following.current.set(id, stop);
  }, []);

  useEffect(() => {
    library
      .list()
      .then((docs) => {
        setDocuments(docs);
        docs.filter((d) => d.status === 'converting').forEach((d) => follow(d.id));
      })
      .catch((e: Error) => onError(e.message));
    const streams = following.current;
    return () => {
      streams.forEach((stop) => stop());
      streams.clear();
    };
  }, [follow, onError]);

  const upload = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        try {
          const doc = await library.upload(file);
          setDocuments((docs) => [doc, ...(docs ?? [])]);
          follow(doc.id);
        } catch (e) {
          onError(`${file.name}: ${(e as Error).message}`);
        }
      }
    },
    [follow, onError],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await library.remove(id);
        setDocuments((docs) => (docs ?? []).filter((d) => d.id !== id));
      } catch (e) {
        onError((e as Error).message);
      }
    },
    [onError],
  );

  return { documents, progress, upload, remove };
}
