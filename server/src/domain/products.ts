import { Trace } from "../trace/index.js";

export interface RunHead {
  id: string;
  product_id: string;
  stage: number;
  status: string;
  created_at: string;
}

export interface Product {
  id: string;
  key: string;
  label: string;
  review_count: number;
  created_at: string;
}

export interface ProductSummary extends Product {
  run_count: number;
  latest_at: string;
  latest_status: string;
  default_run_id: string;
}

/** One folder per stored product: its runs, and the run it opens on. */
export class ProductFolders {
  static summaries(products: readonly Product[], heads: readonly RunHead[]): ProductSummary[] {
    Trace.line(import.meta.url, "ProductFolders.summaries", { products, heads });
    return products
      .flatMap((product) => {
        const runs = ProductFolders.runsOf(heads, product.id);
        const [newest] = runs;
        if (!newest) return [];
        return [
          {
            ...product,
            run_count: runs.length,
            latest_at: newest.created_at,
            latest_status: newest.status,
            default_run_id: (runs.find((r) => r.status === "completed") ?? newest).id,
          },
        ];
      })
      .sort((a, b) => b.latest_at.localeCompare(a.latest_at));
  }

  static runIds(heads: readonly RunHead[], productId: string): string[] {
    Trace.line(import.meta.url, "ProductFolders.runIds", { heads, productId });
    return ProductFolders.runsOf(heads, productId).map((head) => head.id);
  }

  private static runsOf(heads: readonly RunHead[], productId: string): RunHead[] {
    Trace.line(import.meta.url, "ProductFolders.runsOf", { heads, productId });
    return heads
      .filter((head) => head.product_id === productId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}
