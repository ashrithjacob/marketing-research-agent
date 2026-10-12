import type { DocumentConverter, DocumentLibrary, LibraryDocument, LibraryFrame } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

export type LibrarySubscriber = (frame: LibraryFrame) => void;

interface LiveConversion {
  subscribers: Set<LibrarySubscriber>;
  latest: LibraryFrame | null;
  done: Promise<void> | null;
}

/** Takes an uploaded file, answers at once with its row, and converts it in the background, telling whoever follows each page as it is read. */
export class LibraryIntake {
  static readonly RESTARTED = "the server restarted while this was converting; upload it again";

  private readonly converting = new Map<string, LiveConversion>();

  constructor(
    private readonly library: DocumentLibrary,
    private readonly converter: DocumentConverter,
  ) {}

  async accept(workspaceId: string, file: { filename: string; bytes: Uint8Array }): Promise<LibraryDocument> {
    Trace.line(import.meta.url, "LibraryIntake.accept", { workspaceId, filename: file.filename, bytes: file.bytes.length });
    const document = await this.library.add(workspaceId, { title: LibraryIntake.title(file.filename), filename: file.filename });
    const live: LiveConversion = { subscribers: new Set<LibrarySubscriber>(), latest: null, done: null };
    this.converting.set(document.id, live);
    live.done = this.convert(document.id, file.bytes, live);
    return document;
  }

  /** Follows a conversion in flight, starting from the page it has reached; null when the document is not converting in this process. */
  subscribe(documentId: string, subscriber: LibrarySubscriber): (() => void) | null {
    Trace.line(import.meta.url, "LibraryIntake.subscribe", { documentId });
    const live = this.converting.get(documentId);
    if (!live) return null;
    live.subscribers.add(subscriber);
    if (live.latest) subscriber(live.latest);
    return () => live.subscribers.delete(subscriber);
  }

  async settled(documentId: string): Promise<void> {
    Trace.line(import.meta.url, "LibraryIntake.settled", { documentId });
    await this.converting.get(documentId)?.done;
  }

  /** A conversion cut off by a restart cannot resume, since the upload was never kept. */
  async recover(): Promise<number> {
    Trace.line(import.meta.url, "LibraryIntake.recover");
    return this.library.failConverting(LibraryIntake.RESTARTED);
  }

  async drain(): Promise<void> {
    Trace.line(import.meta.url, "LibraryIntake.drain");
    await Promise.allSettled([...this.converting.values()].map(async (live) => live.done));
  }

  private async convert(documentId: string, bytes: Uint8Array, live: LiveConversion): Promise<void> {
    Trace.line(import.meta.url, "LibraryIntake.convert", { documentId });
    const tell = (frame: LibraryFrame): void => {
      live.latest = frame;
      for (const subscriber of live.subscribers) subscriber(frame);
    };
    try {
      const converted = await this.converter.convert(bytes, (page, pages) => tell({ kind: "page", page, pages }));
      tell({ kind: "ready", document: await this.library.finish(documentId, converted) });
    } catch (error) {
      tell({ kind: "failed", document: await this.library.fail(documentId, (error as Error).message || String(error)) });
    } finally {
      this.converting.delete(documentId);
    }
  }

  private static title(filename: string): string {
    Trace.line(import.meta.url, "LibraryIntake.title", { filename });
    return filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "Untitled";
  }
}
