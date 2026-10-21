export interface Price {
  amount: number;
  currency: string;
  source_url: string;
}
export interface PricePoint extends Price {
  label: string;
  units: number;
  subscription: boolean;
}
export interface Pack {
  net_contents: { amount: number; unit: string } | null;
  serving_size: { amount: number; unit: string } | null;
  servings_per_container: number | null;
  servings_per_day: number | null;
  directions_as_printed: string | null;
  source_url: string;
}
export interface Product {
  id: string;
  url: string;
  brand: string;
  name: string;
  category: string;
  form_factor: string | null;
  key_active: string;
  price: Price | null;
  offer: { bundles: string[]; subscription: string | null; guarantee: string | null; source_url: string } | null;
  price_points: PricePoint[];
  subscription_terms: { frequency: string | null; minimum_orders: number | null; how_to_cancel: string | null; source_url: string } | null;
  pack: Pack | null;
  ingredients: { name: string; dose: number | null; unit: string | null; form?: string | null; standardisation?: string | null; in_proprietary_blend?: boolean; source_url: string }[];
  claims_on_page: { text: string; source_url: string }[];
  coa_url: string | null;
  miscellaneous: { label: string; value: string; source_url: string }[];
  image_url: string | null;
  logo_url: string | null;
  traction: ShopTraction | null;
}
export interface ShopTraction {
  shop_id: string;
  domain: string;
  monthly_sales_usd: number | null;
  monthly_sales_min_usd: number | null;
  monthly_sales_max_usd: number | null;
  units_sold: number | null;
  monthly_visits: number | null;
  visits_growth_30d: number | null;
  active_ads: number | null;
  products_count: number | null;
  product_rank: number | null;
  ranked_within: number;
  single_product: boolean;
  fetched_at: string;
}
