import { Briefs } from "./brief.js";
import type { ProductSummary } from "./products.js";
import { Trace } from "../trace/index.js";

/** A brand's chat with the operator, which may exist before any of its research does. */
export interface BrandChat {
  key: string;
  label: string;
  created_at: string;
}

/** One tile on the first page: a brand, its graphic, and the products researched under it. */
export interface BrandFolder {
  key: string;
  label: string;
  image_url: string;
  products: ProductSummary[];
  latest_at: string;
  latest_status: string;
}

/** Where a brand's picture came from, best first: a page's share image, an Amazon listing's photo, a site's icon; "" when none was found. */
export type BrandImageKind = "share" | "thumbnail" | "icon" | "";

/** A brand's picture, kept so it is looked for once, and again only while it is an icon or nothing. */
export interface BrandImage {
  key: string;
  image_url: string;
  kind: BrandImageKind;
  fetched_at: string;
}

/** The pictures one page names for itself: its share image and its icon, each "" when it names none. */
export interface PagePicture {
  share: string;
  icon: string;
}

export interface BrandImageBook {
  list(keys: readonly string[]): Promise<BrandImage[]>;
  put(key: string, image: { image_url: string; kind: BrandImageKind }): Promise<void>;
}

/** Reads the pictures a web page names for itself. */
export interface BrandImageFinder {
  read(page: string): Promise<PagePicture>;
}

/** What a brand is: a website's domain, holding every page researched on it, or, for a product named without a page, that product alone. */
export class Brands {
  static readonly SITE = "site:";

  static key(brief: { product?: unknown; url?: unknown }): string {
    Trace.line(import.meta.url, "Brands.key", { brief });
    return Brands.ofProduct(Briefs.key(brief));
  }

  static ofProduct(productKey: string): string {
    Trace.line(import.meta.url, "Brands.ofProduct", { productKey });
    if (!productKey.startsWith("page:")) return productKey;
    return `${Brands.SITE}${productKey.slice("page:".length).split("/")[0]}`;
  }

  /** The page a site brand's graphic is read from; "" for a product named without a page. */
  static homepage(key: string): string {
    Trace.line(import.meta.url, "Brands.homepage", { key });
    return key.startsWith(Brands.SITE) ? `https://${key.slice(Brands.SITE.length)}/` : "";
  }

  static label(key: string): string {
    Trace.line(import.meta.url, "Brands.label", { key });
    return key.startsWith(Brands.SITE) ? key.slice(Brands.SITE.length) : key.replace(/^product:/, "");
  }

  /** Every brand with research or a chat, newest activity first: products grouped by brand, with each brand's graphic. */
  static folders(products: readonly ProductSummary[], chats: readonly BrandChat[], images: readonly BrandImage[]): BrandFolder[] {
    Trace.line(import.meta.url, "Brands.folders", { products: products.length, chats: chats.length });
    const byKey = new Map<string, BrandFolder>();
    const image = (key: string) => images.find((i) => i.key === key)?.image_url ?? "";
    for (const chat of chats) byKey.set(chat.key, { key: chat.key, label: chat.label, image_url: image(chat.key), products: [], latest_at: chat.created_at, latest_status: "" });
    for (const product of products) {
      const key = Brands.ofProduct(product.key);
      const folder = byKey.get(key) ?? { key, label: key.startsWith(Brands.SITE) ? Brands.label(key) : product.label, image_url: image(key), products: [], latest_at: "", latest_status: "" };
      folder.products.push(product);
      if (product.latest_at > folder.latest_at) Object.assign(folder, { latest_at: product.latest_at, latest_status: product.latest_status });
      byKey.set(key, folder);
    }
    return [...byKey.values()].sort((a, b) => b.latest_at.localeCompare(a.latest_at));
  }
}
