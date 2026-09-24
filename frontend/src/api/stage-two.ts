/** The stage-2 plan: what stage 1 found, and what mining it costs. Mirrors the server's `/stage2/plan`. */

export interface MiningTarget {
  id: string;
  name: string;
  relation: 'product' | 'direct' | 'indirect';
  form: string;
  actives: string[];
  url: string;
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
}

export const RELATION_LABEL: Record<MiningTarget['relation'], string> = {
  product: 'champion product',
  direct: 'direct',
  indirect: 'indirect',
};
