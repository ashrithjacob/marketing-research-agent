import type { Storefront, StorefrontFacts } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { PublicPage } from "./public-page.js";
import { PublicUrls } from "./public-urls.js";

/** Reads a Shopify product page directly, no service, no cost: the shop's myshopify domain from the page, the product id from Shopify's public `/products/<handle>.js`, and the review apps the theme loads. */
export class ShopifyStorefront implements Storefront {
  private static readonly APPS: ReadonlyArray<readonly [string, RegExp]> = [
    ["judgeme", /jdgmSettings|judge\.me\/|judgeme/i],
    ["yotpo", /staticw2\.yotpo\.com|yotpo-widget/i],
    ["okendo", /okendo-reviews|reviews\.okendo\.io/i],
    ["stamped", /stamped\.io\/files|stamped-main-widget/i],
    ["loox", /loox\.io\/widget/i],
  ];

  constructor(private readonly pages: PublicPage) {}

  async inspect(url: string, signal?: AbortSignal): Promise<StorefrontFacts | null> {
    Trace.line(import.meta.url, "ShopifyStorefront.inspect", { url });
    const page = PublicUrls.assert(url);
    const handle = /\/products\/([^/?#]+)/.exec(page.pathname)?.[1];
    if (!handle) return null;
    const html = (await this.pages.text(page.toString(), "text/html", signal)).body;
    const shop = /Shopify\.shop\s*=\s*"([a-z0-9-]+\.myshopify\.com)"/.exec(html)?.[1] ?? /([a-z0-9-]+\.myshopify\.com)/.exec(html)?.[1];
    if (!shop) return null;
    const product = JSON.parse((await this.pages.text(`${page.origin}/products/${handle}.js`, "application/json", signal)).body) as { id?: number };
    if (!product.id) return null;
    return { shop_domain: shop, product_id: String(product.id), review_apps: ShopifyStorefront.apps(html) };
  }

  static apps(html: string): string[] {
    Trace.line(import.meta.url, "ShopifyStorefront.apps", { chars: html.length });
    return ShopifyStorefront.APPS.filter(([, marker]) => marker.test(html)).map(([name]) => name);
  }
}
