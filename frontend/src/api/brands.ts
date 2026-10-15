import { request } from './client';
import type { ProductSummary } from './runs';

export interface BrandFolder {
  key: string;
  label: string;
  image_url: string;
  products: ProductSummary[];
  latest_at: string;
  latest_status: string;
}

export const brandsApi = {
  list: () => request<{ data: BrandFolder[] }>('/api/research/brands'),
  open: (text: string) => request<{ key: string }>('/api/research/brands', { method: 'POST', body: JSON.stringify({ text }) }),
};
