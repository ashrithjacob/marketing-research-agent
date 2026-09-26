import { z } from "zod";
import { Trace } from "../trace/index.js";

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
    Trace.line(import.meta.url, "Briefs.looksLikeUrl", { value });
    return URL_LIKE.test(value.trim());
  }

  static normalise(brief: Brief): Brief {
    Trace.line(import.meta.url, "Briefs.normalise", { brief });
    const product = brief.product.trim();
    if (!Briefs.looksLikeUrl(product)) {
      return { ...brief, product, url: brief.url.trim() };
    }
    const url =
      brief.url.trim() || (/^https?:\/\//i.test(product) ? product : `https://${product}`);
    return { ...brief, product: "", url };
  }

  static label(brief: { product?: unknown; url?: unknown }): string {
    Trace.line(import.meta.url, "Briefs.label", { brief });
    for (const value of [brief.product, brief.url]) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "untitled run";
  }

  static key(brief: { product?: unknown; url?: unknown }): string {
    Trace.line(import.meta.url, "Briefs.key", { brief });
    const product = typeof brief.product === "string" ? brief.product.trim() : "";
    const given = typeof brief.url === "string" ? brief.url.trim() : "";
    const url = given || (Briefs.looksLikeUrl(product) ? product : "");
    if (url) {
      return `page:${Briefs.page(url)}`;
    }
    return `product:${product.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  }

  private static page(url: string): string {
    Trace.line(import.meta.url, "Briefs.page", { url });
    try {
      const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
      const parsed = new URL(withScheme);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
      return `${host}${parsed.pathname.toLowerCase().replace(/\/+$/, "")}`;
    } catch {
      return url.toLowerCase();
    }
  }
}
