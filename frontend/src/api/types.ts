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
  known_competitors: string[];
  brand_constraints: string;
  price_offer: string;
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

export interface Price {
  amount: number;
  currency: string;
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
  ingredients: { name: string; dose: number | null; unit: string | null; source_url: string }[];
  claims_on_page: { text: string; source_url: string }[];
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
}

export interface RunView {
  run: Run;
  product: Product | null;
  competitors: Competitor[];
}

export interface RunEvent {
  id: number;
  run_id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
}
