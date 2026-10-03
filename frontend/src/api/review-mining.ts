import type { CompetitorRelation } from './packet';

/** The review-mining plan: what stage 1 found, and what mining it costs. Mirrors the server's `/review-mining/plan`. */

export interface MiningTarget {
  id: string;
  name: string;
  relation: 'product' | CompetitorRelation;
  form: string;
  actives: string[];
  url: string;
  brand: string;
  amazon_url: string;
  /** Its own domain, mined on Trustpilot when it has no matched Amazon listing. */
  trustpilot: string;
  /** Why its Amazon listing is not mined, e.g. two targets matched the same one. */
  note: string;
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

/** A company's Trustpilot header, read before mining: its score and how many reviews it has. */
export interface TrustpilotSummary {
  domain: string;
  url: string;
  stars: number | null;
  reviews: number | null;
  error: string;
  fetched_at: string;
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
  trustpilot?: TrustpilotSummary | null;
}

export interface ReviewMiningEstimate {
  targets: number;
  reviews_per_target: number;
  bands: number;
  reviews: number;
  amazon_usd: number;
  trustpilot_usd: number;
  cost_usd: number;
  arithmetic: string;
}

export interface ReviewMiningPlan {
  source_run_id: string;
  subject: MiningTarget;
  /** Every target review mining can mine: a matched Amazon listing, else its own Trustpilot domain. */
  offered: MiningTarget[];
  targets: MiningTarget[];
  estimate: ReviewMiningEstimate;
}

export interface ReviewMiningPlanResponse {
  ready: boolean;
  detail?: string;
  plan?: ReviewMiningPlan;
  listings?: TargetListing[];
  lookup_available?: boolean;
  lookup_needed?: boolean;
}

export const RELATION_LABEL: Record<MiningTarget['relation'], string> = {
  product: 'champion product',
  direct: 'direct',
  indirect_form: 'indirect, by form',
  indirect_active: 'indirect, by active',
};
