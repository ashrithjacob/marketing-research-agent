import { request } from './client';
import type { Margin } from './product-truth';

/** The owner's landed unit cost for a product, and the gross margin it gives at each price product truth found. */
export interface ProductCostsView {
  costs: { product_id: string; landed_unit_cost: number; currency: string; updated_at: string } | null;
  margins: Margin[];
}

export const productCostsApi = {
  get: (productId: string) => request<ProductCostsView>(`/api/research/products/${productId}/costs`),
  save: (productId: string, landedUnitCost: number, currency: string) =>
    request<ProductCostsView>(`/api/research/products/${productId}/costs`, {
      method: 'POST',
      body: JSON.stringify({ landed_unit_cost: landedUnitCost, currency }),
    }),
};
