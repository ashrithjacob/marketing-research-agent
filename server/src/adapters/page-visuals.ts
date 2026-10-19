import type { BrandVisual, BrandVisuals } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { PublicPage } from "./public-page.js";

/** A brand's product shot and logo, read from its own page for free: the product image from Shopify's `/products/<handle>.js`, the page's og:image, or Amazon's gallery image (`data-old-hires`, which its product pages carry instead of og:image; measured 2026-10-19), the logo from its icon links or `/favicon.ico`. A page that cannot be read gives nulls. */
export class PageVisuals implements BrandVisuals {
  private static readonly ICON_RELS = ["apple-touch-icon", "apple-touch-icon-precomposed", "icon", "shortcut icon"];

  constructor(private readonly pages: PublicPage) {}

  async find(url: string, signal?: AbortSignal): Promise<BrandVisual> {
    Trace.line(import.meta.url, "PageVisuals.find", { url });
    try {
      const page = await this.pages.text(url, "text/html", signal);
      const shopify = await this.shopifyImage(page.url, signal);
      return { image_url: shopify ?? PageVisuals.meta(page.body, page.url), logo_url: PageVisuals.icon(page.body, page.url) };
    } catch {
      return { image_url: null, logo_url: null };
    }
  }

  static meta(html: string, base: string): string | null {
    Trace.line(import.meta.url, "PageVisuals.meta", { base });
    for (const property of ["og:image:secure_url", "og:image", "twitter:image"]) {
      const tag = PageVisuals.tags(html, "meta").find((attrs) => (attrs.property ?? attrs.name) === property && attrs.content);
      if (tag) return PageVisuals.absolute(tag.content!, base);
    }
    const gallery = /data-old-hires="(https?:[^"]+)"/.exec(html)?.[1];
    return gallery ? PageVisuals.absolute(gallery, base) : null;
  }

  static icon(html: string, base: string): string | null {
    Trace.line(import.meta.url, "PageVisuals.icon", { base });
    const links = PageVisuals.tags(html, "link").filter((attrs) => attrs.href && attrs.rel);
    for (const rel of PageVisuals.ICON_RELS) {
      const link = links.find((attrs) => attrs.rel!.toLowerCase().split(/\s+/).join(" ") === rel);
      if (link) return PageVisuals.absolute(link.href!, base);
    }
    return PageVisuals.absolute("/favicon.ico", base);
  }

  private async shopifyImage(url: string, signal?: AbortSignal): Promise<string | null> {
    Trace.line(import.meta.url, "PageVisuals.shopifyImage", { url });
    const page = new URL(url);
    const handle = /\/products\/([^/?#]+)/.exec(page.pathname)?.[1];
    if (!handle) return null;
    try {
      const product = JSON.parse((await this.pages.text(`${page.origin}/products/${handle}.js`, "application/json", signal)).body) as { featured_image?: string };
      return product.featured_image ? PageVisuals.absolute(product.featured_image, url) : null;
    } catch {
      return null;
    }
  }

  private static tags(html: string, name: string): Record<string, string>[] {
    Trace.line(import.meta.url, "PageVisuals.tags", { name });
    return [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gi"))].map((tag) =>
      Object.fromEntries([...tag[1]!.matchAll(/([a-z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/gi)].map((attr) => [attr[1]!.toLowerCase(), (attr[3] ?? attr[4] ?? "").replace(/&amp;/g, "&")])),
    );
  }

  private static absolute(href: string, base: string): string | null {
    Trace.tick(import.meta.url, "PageVisuals.absolute");
    try {
      const resolved = new URL(href.startsWith("//") ? `https:${href}` : href, base);
      return resolved.protocol === "https:" || resolved.protocol === "http:" ? resolved.toString() : null;
    } catch {
      return null;
    }
  }
}
