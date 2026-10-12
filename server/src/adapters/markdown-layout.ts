import { Trace } from "../trace/index.js";

/** One printed line of a page: its text, the height of its tallest glyphs, and how far up the page it sits. */
export interface PrintedLine {
  text: string;
  height: number;
  y: number;
}

/** Lays printed lines out as markdown: lines set clearly larger than the body become headings, and a line at the top or bottom of most pages is a running header or footer and is dropped. */
export class MarkdownLayout {
  private static readonly HEADING_RATIO = 1.2;
  private static readonly HEADING_MAX_CHARS = 120;
  private static readonly PARAGRAPH_GAP = 1.6;
  private static readonly BULLET = /^[•●▪◦‣∙]\s*/;
  private static readonly EDGE_LINES = 2;

  render(pages: readonly (readonly PrintedLine[])[]): string {
    Trace.line(import.meta.url, "MarkdownLayout.render", { pages: pages.length });
    const body = MarkdownLayout.bodyHeight(pages);
    const levels = MarkdownLayout.headingLevels(pages, body);
    const running = MarkdownLayout.runningLines(pages, levels);
    const out: string[] = [];
    for (const page of pages) {
      let previous: PrintedLine | null = null;
      let heading: { level: number; at: number } | null = null;
      for (const [i, line] of page.entries()) {
        const edge = i < MarkdownLayout.EDGE_LINES || i >= page.length - MarkdownLayout.EDGE_LINES;
        const level = levels.get(MarkdownLayout.size(line.height));
        const close = !!previous && previous.y - line.y <= previous.height * MarkdownLayout.PARAGRAPH_GAP;
        if (level && heading?.level === level && close) {
          out[heading.at] += ` ${line.text}`;
        } else if (level && line.text.length <= MarkdownLayout.HEADING_MAX_CHARS) {
          out.push("", `${"#".repeat(level)} ${line.text}`, "");
          heading = { level, at: out.length - 2 };
        } else if (!edge || !running.has(MarkdownLayout.key(line.text))) {
          heading = null;
          if (previous && previous.y - line.y > previous.height * MarkdownLayout.PARAGRAPH_GAP) out.push("");
          out.push(line.text.replace(MarkdownLayout.BULLET, "- "));
        }
        previous = line;
      }
      out.push("");
    }
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  private static bodyHeight(pages: readonly (readonly PrintedLine[])[]): number {
    Trace.line(import.meta.url, "MarkdownLayout.bodyHeight");
    const weight = new Map<number, number>();
    for (const line of pages.flat()) {
      const size = MarkdownLayout.size(line.height);
      weight.set(size, (weight.get(size) ?? 0) + line.text.length);
    }
    return [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  }

  private static headingLevels(pages: readonly (readonly PrintedLine[])[], body: number): Map<number, number> {
    Trace.line(import.meta.url, "MarkdownLayout.headingLevels", { body });
    const sizes = new Set<number>();
    for (const line of pages.flat()) {
      const size = MarkdownLayout.size(line.height);
      if (body > 0 && size >= body * MarkdownLayout.HEADING_RATIO && line.text.length <= MarkdownLayout.HEADING_MAX_CHARS) sizes.add(size);
    }
    const ordered = [...sizes].sort((a, b) => b - a);
    return new Map(ordered.map((size, i) => [size, Math.min(i + 1, 3)]));
  }

  private static runningLines(pages: readonly (readonly PrintedLine[])[], levels: Map<number, number>): Set<string> {
    Trace.line(import.meta.url, "MarkdownLayout.runningLines", { pages: pages.length });
    if (pages.length < 3) return new Set();
    const seen = new Map<string, number>();
    for (const page of pages) {
      const edges = [...page.slice(0, MarkdownLayout.EDGE_LINES), ...page.slice(-MarkdownLayout.EDGE_LINES)];
      const keys = new Set(edges.filter((line) => !levels.has(MarkdownLayout.size(line.height))).map((line) => MarkdownLayout.key(line.text)));
      for (const key of keys) seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const most = Math.ceil(pages.length / 2);
    return new Set([...seen.entries()].filter(([, count]) => count >= most).map(([key]) => key));
  }

  private static key(text: string): string {
    Trace.tick(import.meta.url, "MarkdownLayout.key");
    return text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
  }

  private static size(height: number): number {
    Trace.tick(import.meta.url, "MarkdownLayout.size");
    return Math.round(height * 2) / 2;
  }
}
