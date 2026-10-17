import { Trace } from "../../trace/index.js";

/** Review text as the reviewer wrote it: markup and entities decoded, nothing else changed. */
export class ReviewText {
  private static readonly ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

  static fromHtml(html: string): string {
    Trace.tick(import.meta.url, "ReviewText.fromHtml");
    const text = html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<[^>]+>/g, "");
    return ReviewText.decode(text).trim();
  }

  static decode(text: string): string {
    Trace.tick(import.meta.url, "ReviewText.decode");
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
      if (entity[0] === "#") {
        const code = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
      }
      return ReviewText.ENTITIES[entity.toLowerCase()] ?? whole;
    });
  }
}
