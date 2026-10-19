import { Asins, type ReviewListing, type ReviewTarget, type Storefront } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { RunContext } from "../../pipeline/run-context.js";

import type { AmazonListingFinder } from "./amazon-listing-finder.js";

/** Where one target's reviews might be read, and what was found out on the way. A listing is a candidate: a store can load an app's script without keeping its reviews there. */
export interface TargetListings {
  listings: ReviewListing[];
  asins: string[];
  notes: string[];
}

/** Works out a target's review listings: its store's Judge.me widget when its page is a Shopify store running it, and its Amazon listing, from its url or found by an agent. */
export class ReviewListings {
  constructor(
    private readonly storefront: Storefront,
    private readonly finder: AmazonListingFinder,
  ) {}

  async of(context: RunContext, target: ReviewTarget, brand: string): Promise<TargetListings> {
    Trace.line(import.meta.url, "ReviewListings.of", { target: target.name });
    const notes: string[] = [];
    const listings: ReviewListing[] = [];
    const direct = Asins.fromUrl(target.url);
    if (!direct) {
      try {
        const store = await this.storefront.inspect(target.url, context.signal);
        if (store?.review_apps.includes("judgeme")) listings.push({ source: "judgeme", shop_domain: store.shop_domain, product_id: store.product_id });
        else if (store && store.review_apps.length > 0) notes.push(`review app ${store.review_apps.join("/")} not supported yet`);
      } catch (error) {
        notes.push(`store page unreadable: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const asin = direct ?? (await this.found(context, target, brand, notes));
    if (asin) listings.push({ source: "amazon", asin });
    return { listings, asins: asin ? [asin] : [], notes };
  }

  private async found(context: RunContext, target: ReviewTarget, brand: string, notes: string[]): Promise<string | null> {
    Trace.line(import.meta.url, "ReviewListings.found", { target: target.name });
    const result = await this.finder.find(context, target, brand);
    if (result.status !== "completed") {
      notes.push(`no Amazon listing: the finder ended ${result.status}`);
      return null;
    }
    if (result.value.amazon_url === null) notes.push(`no Amazon listing (${result.value.why})`);
    return result.value.amazon_url ? Asins.fromUrl(result.value.amazon_url) : null;
  }
}
