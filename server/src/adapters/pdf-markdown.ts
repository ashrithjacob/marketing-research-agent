import { getDocumentProxy } from "unpdf";

import type { ConvertedDocument, DocumentConverter } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { MarkdownLayout, type PrintedLine } from "./markdown-layout.js";

interface TextPiece {
  str: string;
  height: number;
  transform: number[];
}

/** Reads a PDF's text layer page by page with pdf.js, in process and at no cost, and lays it out as markdown. A PDF with no text layer, such as a scan, is refused. */
export class PdfMarkdown implements DocumentConverter {
  constructor(private readonly layout: MarkdownLayout) {}

  async convert(bytes: Uint8Array, onPage: (page: number, pages: number) => void): Promise<ConvertedDocument> {
    Trace.line(import.meta.url, "PdfMarkdown.convert", { bytes: bytes.length });
    const pdf = await getDocumentProxy(bytes.slice());
    try {
      const pages: PrintedLine[][] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        pages.push(PdfMarkdown.lines(content.items.filter((item): item is TextPiece & typeof item => "str" in item)));
        page.cleanup();
        onPage(n, pdf.numPages);
      }
      if (pages.every((page) => page.length === 0)) {
        throw new Error("the PDF has no text layer (a scan or images only); it cannot be read without OCR");
      }
      return { markdown: this.layout.render(pages), pages: pdf.numPages };
    } finally {
      await pdf.loadingTask.destroy();
    }
  }

  private static lines(pieces: readonly TextPiece[]): PrintedLine[] {
    Trace.line(import.meta.url, "PdfMarkdown.lines", { pieces: pieces.length });
    const lines: PrintedLine[] = [];
    let current: PrintedLine | null = null;
    for (const piece of pieces) {
      const y = piece.transform[5] ?? 0;
      if (!piece.str) continue;
      if (current && Math.abs(current.y - y) <= Math.max(1, current.height * 0.4)) {
        current.text += piece.str;
        current.height = Math.max(current.height, piece.height);
      } else {
        if (current) lines.push(current);
        current = { text: piece.str, height: piece.height, y };
      }
    }
    if (current) lines.push(current);
    return lines
      .map((line) => ({ ...line, text: line.text.replace(/\s+/g, " ").trim() }))
      .filter((line) => line.text !== "");
  }
}
