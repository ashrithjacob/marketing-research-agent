/** The stage-2 plan: what stage 1 found, and what mining it costs. Mirrors the server's `/stage2/plan`. */

export interface MiningTarget {
  id: string;
  name: string;
  relation: 'product' | 'direct' | 'indirect';
  form: string;
  actives: string[];
  url: string;
  brand: string;
  amazon_url: string;
}

export interface BestsellerRank {
  rank: number;
  category: string;
}

export interface AmazonListing {
  asin: string;
  title: string;
  url: string;
  brand: string;
  marketplace: string;
  price: number | null;
  currency: string;
  stars: number | null;
  stars_breakdown: Record<string, number> | null;
  reviews_count: number | null;
  bought_past_month: string;
  bestseller_ranks: BestsellerRank[];
  amazon_choice: boolean;
  thumbnail: string;
}

export interface TargetListing {
  source_run_id: string;
  target_id: string;
  query: string;
  strategy: string;
  listing: AmazonListing | null;
  matches: boolean;
  mismatch: string;
  error: string;
  fetched_at: string;
}

export interface StageTwoEstimate {
  targets: number;
  reviews_per_target: number;
  bands: number;
  reviews: number;
  amazon_usd: number;
  trustpilot_usd: number;
  cost_usd: number;
  arithmetic: string;
}

export interface StageTwoPlan {
  source_run_id: string;
  subject: MiningTarget;
  targets: MiningTarget[];
  estimate: StageTwoEstimate;
}

export interface StageTwoPlanResponse {
  ready: boolean;
  detail?: string;
  plan?: StageTwoPlan;
  listings?: TargetListing[];
  lookup_available?: boolean;
}

export const RELATION_LABEL: Record<MiningTarget['relation'], string> = {
  product: 'champion product',
  direct: 'direct',
  indirect: 'indirect',
};
