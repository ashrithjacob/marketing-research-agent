import type { Gap, NodeStatus, Source } from './packet';
import type { Brief } from './runs';

/** Mirrors `server/src/domain/product-truth-packet.ts` and `product-truth-rows.ts`. */
export interface Active {
  name: string;
  amount: number | null;
  unit: string;
  form: string;
  in_blend: boolean;
  source_id: string;
}

export interface Regimen {
  servings_per_day: number | null;
  servings_per_container: number | null;
  directions_as_printed: string;
  source_id: string;
}

export interface Mechanism {
  active: string;
  pathway: string;
  time_to_effect: { value: number; unit: 'hours' | 'days' | 'weeks' | 'months' } | null;
  magnitude: string;
  story_weight: 'carrier' | 'supporting';
  source_id: string;
}

export type DoseClass = 'at_dose' | 'partial' | 'under_dose' | 'unassessable';

export interface DoseAssessment {
  active: string;
  our_daily_dose: number | null;
  studied_daily_dose: number | null;
  unit: string;
  ratio: number | null;
  class: DoseClass;
  why: string;
  studied_form: string;
  form_match: string;
  study: string;
  source_id: string;
}

export interface ClaimLimit {
  market: string;
  platform: 'meta' | 'google_ads';
  permitted: string[];
  forbidden: string[];
  disclaimers: string[];
  evidence_standard: string;
  source_ids: string[];
}

export interface PricePoint {
  label: string;
  amount: number;
  currency: string;
  units: number;
  subscription: boolean;
  market: string;
  source_id: string;
}

export interface OperatorInput {
  landed_unit_cost: number | null;
  currency: string;
  moq: number | null;
  lead_time_days: number | null;
}

export interface Margin {
  label: string;
  subscription: boolean;
  unit_price: number;
  currency: string;
  margin: number | null;
  why: string;
  source_id: string;
}

export interface Economics {
  operator: OperatorInput | null;
  days_of_supply: number | null;
  days_why: string;
  churn: {
    mismatch: boolean | null;
    why: string;
    carriers: { active: string; time_to_effect_days: number | null; runs_out_first: boolean | null }[];
  };
  margins: Margin[];
}

export interface ProductTruthPacket {
  contract_version: string;
  stage: 2;
  run_id: string;
  source_run_id: string;
  brief: Brief;
  guard: string;
  sources: Source[];
  actives: Active[];
  regimen: Regimen | null;
  mechanisms: Mechanism[];
  doses: DoseAssessment[];
  claim_limits: ClaimLimit[];
  prices: PricePoint[];
  economics: Economics;
  nodes: NodeStatus[];
  gaps: Gap[];
}

/** What the operator types when starting product truth; mirrors `productTruthInputsSchema`. */
export interface ProductTruthInputs {
  landed_unit_cost: number | null;
  currency: string;
  moq: number | null;
  lead_time_days: number | null;
  prices: { label: string; amount: number; currency: string; units: number; subscription: boolean }[];
}
