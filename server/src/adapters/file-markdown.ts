import type { ConvertedDocument, DocumentConverter } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** Any file the memory folder takes, as markdown: a PDF through its converter, a markdown or text file as it is. A file that is not UTF-8 text is refused. */
export class FileMarkdown implements DocumentConverter {
  static readonly PDF_MAGIC = "%PDF-";

  constructor(private readonly pdf: DocumentConverter) {}

  async convert(bytes: Uint8Array, onPage: (page: number, pages: number) => void): Promise<ConvertedDocument> {
    Trace.line(import.meta.url, "FileMarkdown.convert", { bytes: bytes.length });
    if (FileMarkdown.isPdf(bytes)) return this.pdf.convert(bytes, onPage);
    const markdown = FileMarkdown.text(bytes).trim();
    if (!markdown) throw new Error("the file is empty");
    onPage(1, 1);
    return { markdown: `${markdown}\n`, pages: 1 };
  }

  static isPdf(bytes: Uint8Array): boolean {
    Trace.line(import.meta.url, "FileMarkdown.isPdf");
    return new TextDecoder().decode(bytes.subarray(0, 5)) === FileMarkdown.PDF_MAGIC;
  }

  private static text(bytes: Uint8Array): string {
    Trace.line(import.meta.url, "FileMarkdown.text");
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("the file is not a PDF or UTF-8 text");
    }
  }
}
