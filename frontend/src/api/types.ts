import type { Price, Product, ShopTraction } from './product-types';

export type StageStatus = 'pending' | 'running' | 'completed' | 'invalid' | 'failed' | 'cancelled' | 'skipped' | 'not_built';
export type RunStatus = 'resolving' | 'awaiting_confirmation' | 'running' | 'stopping' | 'completed' | 'invalid' | 'failed' | 'cancelled';
export type Relationship = 'direct' | 'indirect' | 'other';

export interface StageState {
  status: StageStatus;
  started_at: string;
  ended_at: string;
  error: string;
  summary: string;
}

export interface StageInfo {
  name: string;
  number: number;
  title: string;
  needs: string[];
  built: boolean;
  reruns: string[];
}

export interface Config {
  model: string;
  markets: string[];
  stages: StageInfo[];
}

export interface AnalysisInput {
  product_url: string | null;
  product_name: string | null;
  markets: string[];
}

export interface CompetitorPick {
  brand: string;
  product_name: string;
  url: string;
}

export interface Resolution {
  product: { brand: string; name: string; url: string };
  alternatives: { name: string; url: string }[];
  competitors: (CompetitorPick & { why: string })[];
}

export interface Run {
  id: string;
  account_id: string;
  product_id: string | null;
  status: RunStatus;
  input: AnalysisInput;
  resolution: Resolution | null;
  stage_status: Record<string, StageState>;
  model: string;
  error: string;
  cost_usd: number | null;
  created_at: string;
  updated_at: string;
  ended_at: string;
}

export interface Competitor {
  id: string;
  brand: string;
  product_name: string;
  url: string;
  domain: string;
  platform: string | null;
  relationship: Relationship | null;
  form_factor: string | null;
  has_key_active: boolean | null;
  key_active: string | null;
  price: Price | null;
  positioning: string;
  sources: string[];
  image_url: string | null;
  logo_url: string | null;
  traction: ShopTraction | null;
}

export interface ShopSignals {
  domain: string;
  shop_id: string;
  monthly_visits: number | null;
  active_ads: number | null;
}

export interface BrandVisual {
  image_url: string | null;
  logo_url: string | null;
}

export interface RunView {
  run: Run;
  product: Product | null;
  competitors: Competitor[];
  visuals: Record<string, BrandVisual>;
  signals: Record<string, ShopSignals>;
}

export interface RunEvent {
  id: number;
  run_id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ReviewCoverage {
  competitor_id: string | null;
  source: string;
  reviews: number;
  average_rating: number | null;
}

export interface StoredReview {
  id: string;
  competitor_id: string | null;
  source: string;
  rating: number;
  title: string;
  body: string;
  review_date: string | null;
  verified: boolean | null;
  helpful_votes: number;
}

export interface AdReading {
  avatar: string;
  claim_type: string;
  awareness: string;
  mechanism: string | null;
  proof_types: string[];
  offer: string | null;
  objections_handled: string[];
  emotion: string;
  risk_flags: string[];
}

export interface ReadAd {
  id: string;
  competitor_id: string | null;
  advertiser: string;
  landing_url: string;
  landing_domain: string;
  status: string;
  copy: string;
  media_url: string | null;
  first_seen: string | null;
  days_running: number | null;
  duplicates: number | null;
  bucket: 'winning' | 'testing' | 'dead' | null;
  bucket_why: string | null;
  audience: { age_min: number | null; age_max: number | null; gender: string | null } | null;
  ring: 'direct_competitor' | 'same_problem' | 'same_buyer' | 'trending_shop' | null;
  ring_why: string | null;
  reading: AdReading | null;
}

export interface StoredAvatar {
  id: string;
  parent_id: string | null;
  key: string;
  name: string;
  description: string;
  demand_share: number;
  supply_share: number | null;
  win_rate: number | null;
  review_count: number;
  ad_count: number;
  awareness: string | null;
  confidence: string | null;
  standing: string;
  profile: {
    pains: string[];
    desires: string[];
    triggers: string[];
    prior_solutions: string[];
    objections: string[];
    outcomes: string[];
    angles: string[];
    best_competitor_angle: string | null;
    skepticism: number | null;
    skepticism_review_ids: string[];
    awareness_by_channel: Partial<Record<'meta_ads' | 'reviews', Partial<Record<string, number>>>>;
  };
}

export interface AvatarQuote {
  avatar_id: string;
  review_id: string;
  rating: number;
  body: string;
  source: string;
}

export interface RunSummary extends Run {
  product: { name: string; brand: string; image_url: string | null; logo_url: string | null } | null;
  competitors: { brand: string; image_url: string | null; logo_url: string | null; relationship: Relationship | null }[];
  review_count: number;
  ad_count: number;
  avatar_count: number;
}
