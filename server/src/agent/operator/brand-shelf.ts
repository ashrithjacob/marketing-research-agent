import { Brands, ProductFolders, Scope, type BrandFolder, type BrandImageFinder, type ProductSummary, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { BrandPictureSearch } from "./brand-picture-search.js";
import type { OperatorDesk } from "./operator-desk.js";

/** The first page's tiles: each brand with research or a chat, and its picture. A brand whose picture was never looked for, or is only an icon or nothing a day later, is looked for again in the background, once at a time: new research may have added pages. */
export class BrandShelf {
  static readonly RETRY_MS = 86_400_000;
  private readonly finding = new Map<string, Promise<void>>();
  private readonly search: BrandPictureSearch;

  constructor(
    private readonly store: ResearchStore,
    private readonly operator: OperatorDesk,
    finder: BrandImageFinder,
  ) {
    Trace.line(import.meta.url, "BrandShelf.constructor");
    this.search = new BrandPictureSearch(store, finder);
  }

  async folders(workspaceId: string, scope: Scope): Promise<BrandFolder[]> {
    Trace.line(import.meta.url, "BrandShelf.folders", { workspaceId });
    const products = ProductFolders.summaries(await this.store.products.list(scope), await this.store.products.runHeads(scope));
    const chats = await this.operator.chats(workspaceId);
    const keys = [...new Set([...products.map((p) => Brands.ofProduct(p.key)), ...chats.map((c) => c.key)])];
    const images = await this.store.brandImages.list(keys);
    const stale = new Date(Date.now() - BrandShelf.RETRY_MS).toISOString();
    for (const key of keys) {
      const known = images.find((image) => image.key === key);
      const weak = known && (known.kind === "icon" || known.kind === "") && known.fetched_at < stale;
      if (!known || weak) this.look(key, products.filter((p) => Brands.ofProduct(p.key) === key));
    }
    return Brands.folders(products, chats, images);
  }

  /** Resolves when every lookup started so far has been stored. */
  async settled(): Promise<void> {
    Trace.line(import.meta.url, "BrandShelf.settled", { finding: this.finding.size });
    await Promise.all([...this.finding.values()]);
  }

  private look(key: string, products: readonly ProductSummary[]): void {
    Trace.line(import.meta.url, "BrandShelf.look", { key });
    if (this.finding.has(key)) return;
    const found = this.search
      .find(key, products)
      .then((image) => this.store.brandImages.put(key, image))
      .catch((error: unknown) => console.error("brand picture lookup failed", key, error))
      .finally(() => this.finding.delete(key));
    this.finding.set(key, found);
  }
}
