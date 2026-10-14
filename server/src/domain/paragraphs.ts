import { Trace } from "../trace/index.js";

/** One paragraph of an archived body, with where it sits in it. */
export interface Paragraph {
  n: number;
  text: string;
  start: number;
  end: number;
}

/** A page body split the one way web_fetch numbers it and record_excerpt reads it back, so a paragraph number names the same text both times. */
export class Paragraphs {
  static split(body: string): Paragraph[] {
    Trace.line(import.meta.url, "Paragraphs.split", { chars: body.length });
    const found: Paragraph[] = [];
    for (const match of body.matchAll(/[^\n]+(?:\n(?![ \t]*\n)[^\n]*)*/g)) {
      const raw = match[0];
      const lead = raw.length - raw.trimStart().length;
      const text = raw.trim();
      if (!text) continue;
      const start = match.index + lead;
      found.push({ n: found.length + 1, text, start, end: start + text.length });
    }
    return found;
  }

  /** Paragraphs `from` to `to` inclusive, or why that range does not exist in this body. */
  static range(body: string, from: number, to: number): { text: string; start: number; end: number } | { problem: string } {
    Trace.line(import.meta.url, "Paragraphs.range", { from, to });
    const all = Paragraphs.split(body);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) return { problem: `paragraphs ${from}–${to} are not a range: from must be at least 1 and to at least from` };
    if (to > all.length) return { problem: `this source has ${all.length} paragraphs, so p${to} does not exist` };
    const picked = all.slice(from - 1, to);
    return { text: picked.map((p) => p.text).join("\n\n"), start: picked[0]!.start, end: picked[picked.length - 1]!.end };
  }
}
