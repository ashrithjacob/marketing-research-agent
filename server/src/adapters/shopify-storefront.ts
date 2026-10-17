import type { Settings } from "../config/index.js";
import type { Storefront, StorefrontFacts } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { Http } from "./http.js";
import { PublicUrls } from "./public-urls.js";

/** Reads a Shopify product page directly, no service, no cost: the shop's myshopify domain from the page, the product id from Shopify's public `/products/<handle>.js`, and the review apps the theme loads. */
export class ShopifyStorefront implements Storefront {
  static readonly MAX_REDIRECTS = 3;
  static readonly USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0 Safari/537.36";
  private static readonly APPS: ReadonlyArray<readonly [string, RegExp]> = [
    ["judgeme", /jdgmSettings|judge\.me\/|judgeme/i],
    ["yotpo", /staticw2\.yotpo\.com|yotpo-widget/i],
    ["okendo", /okendo-reviews|reviews\.okendo\.io/i],
    ["stamped", /stamped\.io\/files|stamped-main-widget/i],
    ["loox", /loox\.io\/widget/i],
  ];

  constructor(private readonly settings: Settings) {}

  async inspect(url: string, signal?: AbortSignal): Promise<StorefrontFacts | null> {
    Trace.line(import.meta.url, "ShopifyStorefront.inspect", { url });
    const page = PublicUrls.assert(url);
    const handle = /\/products\/([^/?#]+)/.exec(page.pathname)?.[1];
    if (!handle) return null;
    const html = await this.get(page.toString(), "text/html", signal);
    const shop = /Shopify\.shop\s*=\s*"([a-z0-9-]+\.myshopify\.com)"/.exec(html)?.[1] ?? /([a-z0-9-]+\.myshopify\.com)/.exec(html)?.[1];
    if (!shop) return null;
    const product = JSON.parse(await this.get(`${page.origin}/products/${handle}.js`, "application/json", signal)) as { id?: number };
    if (!product.id) return null;
    return { shop_domain: shop, product_id: String(product.id), review_apps: ShopifyStorefront.apps(html) };
  }

  static apps(html: string): string[] {
    Trace.line(import.meta.url, "ShopifyStorefront.apps", { chars: html.length });
    return ShopifyStorefront.APPS.filter(([, marker]) => marker.test(html)).map(([name]) => name);
  }

  private async get(url: string, accept: string, signal?: AbortSignal): Promise<string> {
    Trace.line(import.meta.url, "ShopifyStorefront.get", { url });
    let next = url;
    for (let hop = 0; hop <= ShopifyStorefront.MAX_REDIRECTS; hop++) {
      const init: RequestInit = { headers: { "User-Agent": ShopifyStorefront.USER_AGENT, Accept: accept }, redirect: "manual" };
      const response = await Http.withTimeout(PublicUrls.assert(next).toString(), init, this.settings.webTimeoutSeconds, signal);
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        next = new URL(location, next).toString();
        continue;
      }
      if (!response.ok) throw new Error(`${next} returned ${response.status}`);
      return response.text();
    }
    throw new Error(`${url} redirected more than ${ShopifyStorefront.MAX_REDIRECTS} times`);
  }
}
