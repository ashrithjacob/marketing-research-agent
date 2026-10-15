import type { BrandImageFinder, PagePicture } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { Http } from "./http.js";

/** Reads a web page with a plain request, at no cost, for the pictures it names for itself: its share image, and its touch icon or icon (else /favicon.ico). Only public web hosts are fetched, redirects included. */
export class HomepageImage implements BrandImageFinder {
  static readonly MAX_REDIRECTS = 4;
  static readonly MAX_CHARS = 400_000;
  private static readonly SHARE = ["og:image", "og:image:url", "og:image:secure_url", "twitter:image"];
  private static readonly ICON = ["apple-touch-icon", "icon", "shortcut icon"];
  private static readonly NONE: PagePicture = { share: "", icon: "" };

  constructor(private readonly timeoutSeconds = 8) {}

  async read(page: string): Promise<PagePicture> {
    Trace.line(import.meta.url, "HomepageImage.read", { page });
    let url = page;
    for (let hop = 0; hop <= HomepageImage.MAX_REDIRECTS; hop++) {
      if (!HomepageImage.publicHost(url)) return HomepageImage.NONE;
      const response = await Http.withTimeout(url, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (compatible; mra-brand-image)", accept: "text/html" } }, this.timeoutSeconds);
      const next = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && next) {
        url = new URL(next, url).toString();
        continue;
      }
      if (!response.ok) return HomepageImage.NONE;
      return HomepageImage.pick((await response.text()).slice(0, HomepageImage.MAX_CHARS), url);
    }
    return HomepageImage.NONE;
  }

  /** The share image and the icon a page's head names, as absolute URLs. */
  static pick(html: string, base: string): PagePicture {
    Trace.line(import.meta.url, "HomepageImage.pick", { base, chars: html.length });
    const found = new Map<string, string>();
    for (const tag of html.match(/<(meta|link)\b[^>]*>/gi) ?? []) {
      const attrs = HomepageImage.attributes(tag);
      const name = (attrs.property ?? attrs.name ?? attrs.rel ?? "").toLowerCase().trim();
      const value = attrs.content ?? attrs.href ?? "";
      if (name && value && !found.has(name)) found.set(name, value);
    }
    const first = (names: readonly string[]) => names.map((name) => found.get(name)).find((value) => !!value) ?? "";
    return { share: HomepageImage.absolute(first(HomepageImage.SHARE), base), icon: HomepageImage.absolute(first(HomepageImage.ICON) || "/favicon.ico", base) };
  }

  private static absolute(href: string, base: string): string {
    Trace.tick(import.meta.url, "HomepageImage.absolute");
    if (!href) return "";
    try {
      const absolute = new URL(href.trim(), base);
      return absolute.protocol === "https:" || absolute.protocol === "http:" ? absolute.toString() : "";
    } catch {
      return "";
    }
  }

  /** A host on the public web: named with a dot, not an address, not this machine. */
  static publicHost(url: string): boolean {
    Trace.line(import.meta.url, "HomepageImage.publicHost", { url });
    try {
      const { protocol, hostname } = new URL(url);
      if (protocol !== "https:" && protocol !== "http:") return false;
      if (!hostname.includes(".") || hostname.startsWith("[") || /^[\d.]+$/.test(hostname)) return false;
      return !/(^|\.)(localhost|local|internal|localdomain)$/i.test(hostname);
    } catch {
      return false;
    }
  }

  private static attributes(tag: string): Record<string, string> {
    Trace.tick(import.meta.url, "HomepageImage.attributes");
    const attrs: Record<string, string> = {};
    for (const [, key, , dq, sq] of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) attrs[key!.toLowerCase()] = (dq ?? sq ?? "").replace(/&amp;/g, "&");
    return attrs;
  }
}
