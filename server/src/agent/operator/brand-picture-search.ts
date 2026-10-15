import { Brands, Scope, type BrandImageFinder, type BrandImageKind, type PagePicture, type ProductSummary, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** Finds a brand's picture, best first: the site's homepage share image, a product's Amazon listing photo (already stored), the share image of the product's own pages a run read, then the site's icon. */
export class BrandPictureSearch {
  static readonly PAGES = 3;
  private static readonly NONE: PagePicture = { share: "", icon: "" };

  constructor(
    private readonly store: ResearchStore,
    private readonly finder: BrandImageFinder,
  ) {}

  async find(key: string, products: readonly ProductSummary[]): Promise<{ image_url: string; kind: BrandImageKind }> {
    Trace.line(import.meta.url, "BrandPictureSearch.find", { key, products: products.length });
    const homepage = Brands.homepage(key);
    const home = homepage ? await this.read(homepage) : BrandPictureSearch.NONE;
    if (home.share) return { image_url: home.share, kind: "share" };
    const thumbnail = await this.thumbnail(products);
    if (thumbnail) return { image_url: thumbnail, kind: "thumbnail" };
    for (const page of (await this.ownPages(products)).slice(0, BrandPictureSearch.PAGES)) {
      const picture = await this.read(page);
      if (picture.share) return { image_url: picture.share, kind: "share" };
    }
    return home.icon ? { image_url: home.icon, kind: "icon" } : { image_url: "", kind: "" };
  }

  private async read(page: string): Promise<PagePicture> {
    Trace.line(import.meta.url, "BrandPictureSearch.read", { page });
    return this.finder.read(page).catch(() => BrandPictureSearch.NONE);
  }

  /** The photo of an Amazon listing found for one of the products, a matching listing first. */
  private async thumbnail(products: readonly ProductSummary[]): Promise<string> {
    Trace.line(import.meta.url, "BrandPictureSearch.thumbnail");
    const ids = new Set(products.map((p) => p.id));
    const runs = (await this.store.products.runHeads(Scope.everything)).filter((head) => ids.has(head.product_id));
    const listings = (await Promise.all(runs.map((run) => this.store.listings.list(run.id)))).flat().filter((l) => l.target_id === "product" && l.listing?.thumbnail);
    const best = listings.find((l) => l.matches) ?? listings[0];
    return best?.listing?.thumbnail ?? "";
  }

  /** The products' own pages the runs read, the product-facts pages first, each once. */
  private async ownPages(products: readonly ProductSummary[]): Promise<string[]> {
    Trace.line(import.meta.url, "BrandPictureSearch.ownPages");
    const sources = (await Promise.all(products.map((p) => this.store.products.packetRows(p.id, Scope.everything)))).flatMap((rows) => rows.sources);
    const own = sources.filter((s) => s.kind === "first_party" && /^https?:\/\//.test(s.url) && !/\.(json|xml|pdf)(\?|$)/i.test(s.url));
    const ordered = [...own.filter((s) => s.node === "product_data"), ...own.filter((s) => s.node !== "product_data")];
    return [...new Set(ordered.map((s) => s.url))];
  }
}
