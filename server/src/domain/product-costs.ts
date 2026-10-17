import { z } from "zod";

/** The owner's own figure for a product, typed on the Margin card: what one unit costs landed. It is theirs to give, never research. */
export const productCostsInputSchema = z
  .object({
    landed_unit_cost: z.number().positive(),
    currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  })
  .strict();
export type ProductCostsInput = z.infer<typeof productCostsInputSchema>;

export interface ProductCosts extends ProductCostsInput {
  product_id: string;
  updated_at: string;
}

/** Each workspace's figures per product: products are shared across workspaces, costs are not. */
export interface ProductCostBook {
  get(workspaceId: string, productId: string): Promise<ProductCosts | null>;
  put(workspaceId: string, productId: string, costs: ProductCostsInput): Promise<ProductCosts>;
}
