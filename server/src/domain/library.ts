import type { Scope } from "./accounts.js";
import { Trace } from "../trace/index.js";

export const DOCUMENT_STATUSES = ["converting", "ready", "failed"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** An uploaded document as the library lists it: everything but its text. */
export interface LibraryDocument {
  id: string;
  workspace_id: string;
  title: string;
  filename: string;
  status: DocumentStatus;
  pages: number;
  chars: number;
  error: string;
  created_at: string;
  updated_at: string;
}

/** What a converter made of a file: markdown, and how many pages it read. */
export interface ConvertedDocument {
  markdown: string;
  pages: number;
}

/** One part of a document an agent can ask for by index: a heading's section, or a slice of a long one. */
export interface DocumentSection {
  index: number;
  heading: string;
  chars: number;
  text: string;
}

/** A conversion's progress, as the browser following it sees it. */
export type LibraryFrame =
  | { kind: "page"; page: number; pages: number }
  | { kind: "ready"; document: LibraryDocument }
  | { kind: "failed"; document: LibraryDocument };

/** The workspace's uploaded documents, as markdown. */
export interface DocumentLibrary {
  add(workspaceId: string, input: { title: string; filename: string }): Promise<LibraryDocument>;
  finish(documentId: string, converted: ConvertedDocument): Promise<LibraryDocument>;
  fail(documentId: string, error: string): Promise<LibraryDocument>;
  failConverting(error: string): Promise<number>;
  list(scope: Scope): Promise<LibraryDocument[]>;
  get(scope: Scope, documentId: string): Promise<LibraryDocument | null>;
  markdown(scope: Scope, documentId: string): Promise<string | null>;
  delete(scope: Scope, documentId: string): Promise<boolean>;
}

/** Turns a file's bytes into markdown, reporting each page as it is read. */
export interface DocumentConverter {
  convert(bytes: Uint8Array, onPage: (page: number, pages: number) => void): Promise<ConvertedDocument>;
}

/** Cuts markdown at its headings, and a section longer than `maxChars` into slices at paragraph breaks. */
export class DocumentSections {
  private static readonly HEADING = /^#{1,3} +(.+)$/;

  static of(markdown: string, maxChars: number): DocumentSection[] {
    Trace.line(import.meta.url, "DocumentSections.of", { chars: markdown.length, maxChars });
    const sections: Array<{ heading: string; text: string }> = [];
    let current = { heading: "(opening)", lines: [] as string[] };
    const close = (): void => {
      const text = current.lines.join("\n").trim();
      if (text) sections.push(...DocumentSections.slices(current.heading, text, maxChars));
    };
    for (const line of markdown.split("\n")) {
      const heading = DocumentSections.HEADING.exec(line);
      if (heading) {
        close();
        current = { heading: (heading[1] ?? "").trim(), lines: [line] };
      } else {
        current.lines.push(line);
      }
    }
    close();
    return sections.map((section, index) => ({ index, heading: section.heading, chars: section.text.length, text: section.text }));
  }

  private static slices(heading: string, text: string, maxChars: number): Array<{ heading: string; text: string }> {
    Trace.line(import.meta.url, "DocumentSections.slices", { heading, chars: text.length });
    if (text.length <= maxChars) return [{ heading, text }];
    const slices: string[] = [];
    let slice = "";
    for (const paragraph of text.split(/\n{2,}/)) {
      if (slice && slice.length + paragraph.length + 2 > maxChars) {
        slices.push(slice);
        slice = "";
      }
      slice = slice ? `${slice}\n\n${paragraph}` : paragraph;
      while (slice.length > maxChars) {
        slices.push(slice.slice(0, maxChars));
        slice = slice.slice(maxChars);
      }
    }
    if (slice) slices.push(slice);
    return slices.map((part, i) => ({ heading: `${heading} (${i + 1}/${slices.length})`, text: part }));
  }
}
