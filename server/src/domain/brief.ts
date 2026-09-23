import { z } from "zod";

export const briefSchema = z
  .object({
    product: z.string().default(""),
    url: z.string().default(""),
    market: z.string().default(""),
    notes: z.string().default(""),
  })
  .strict();
export type Brief = z.infer<typeof briefSchema>;

const URL_LIKE = /^(https?:\/\/\S+|(?!.*\s)[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?)$/i;

/** Keeps a url out of `product`, and decides when two briefs name one subject. */
export class Briefs {
  static looksLikeUrl(value: string): boolean {
    return URL_LIKE.test(value.trim());
  }

  static normalise(brief: Brief): Brief {
    const product = brief.product.trim();
    if (!Briefs.looksLikeUrl(product)) {
      return { ...brief, product, url: brief.url.trim() };
    }
    const url =
      brief.url.trim() || (/^https?:\/\//i.test(product) ? product : `https://${product}`);
    return { ...brief, product: "", url };
  }

  static key(brief: { product?: unknown; url?: unknown }): string {
    const url = typeof brief.url === "string" ? brief.url.trim() : "";
    if (url) {
      return `site:${Briefs.hostname(url)}`;
    }
    const product = typeof brief.product === "string" ? brief.product : "";
    return `product:${product.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  }

  private static hostname(url: string): string {
    try {
      const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
      return new URL(withScheme).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }
}
