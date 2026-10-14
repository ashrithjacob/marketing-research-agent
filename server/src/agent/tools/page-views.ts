import { Paragraphs } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** How a fetched body is shown to the model, within a character limit. */
export interface PageView {
  render(body: string, limit: number): { shown: string; truncated: boolean; note: string };
}

/** The body as it is, cut at the limit; character offsets refer to the archived copy. */
export class PlainPage implements PageView {
  render(body: string, limit: number): { shown: string; truncated: boolean; note: string } {
    Trace.line(import.meta.url, "PlainPage.render", { chars: body.length, limit });
    const truncated = body.length > limit;
    const note = truncated
      ? `NOTE: showing the first ${limit} of ${body.length} characters. The archived copy is complete; character offsets in a locator still refer to it.`
      : "";
    return { shown: truncated ? body.slice(0, limit) : body, truncated, note };
  }
}

/** Each paragraph prefixed [pN], whole paragraphs up to the limit, so a quote is named by its paragraph numbers and never typed out. */
export class NumberedPage implements PageView {
  render(body: string, limit: number): { shown: string; truncated: boolean; note: string } {
    Trace.line(import.meta.url, "NumberedPage.render", { chars: body.length, limit });
    const all = Paragraphs.split(body);
    const lines: string[] = [];
    let used = 0;
    for (const paragraph of all) {
      const line = `[p${paragraph.n}] ${paragraph.text}`;
      if (lines.length > 0 && used + line.length > limit) break;
      lines.push(line);
      used += line.length + 2;
    }
    const truncated = lines.length < all.length;
    const note = truncated ? `NOTE: showing paragraphs 1–${lines.length} of ${all.length}. The archived copy is complete.` : "";
    return { shown: lines.join("\n\n"), truncated, note };
  }
}
