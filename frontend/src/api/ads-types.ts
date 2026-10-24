export interface AdFinding {
  step: number;
  subjects: string[];
  headline: string;
  ad_ids: string[];
}

export interface AngleHook {
  ad_id: string;
  advertiser: string;
  hook: string;
  days_running: number | null;
}

export interface AngleRow {
  key: string;
  name: string;
  description: string;
  ads: number;
  proven: number;
  brands: string[];
  median_days: number | null;
  longest_days: number | null;
  duplicates: number;
  earliest: string | null;
  launched_30d: number;
  launched_60d: number;
  trend: 'rising' | 'steady' | 'fading';
  risk_share: number | null;
  fit: 'supported' | 'needs_new_claim' | 'does_not_apply' | null;
  fit_claims: string[];
  fit_why: string | null;
  hooks: AngleHook[];
}

export interface LabelRow {
  label: string;
  value: string;
  proven: number;
  rest: number;
  proven_share: number;
  rest_share: number;
  difference: number;
  ranked: boolean;
}

export interface BrandRow {
  domain: string;
  advertiser: string;
  competitor: boolean;
  ads: number;
  proven: number;
  launched_60d: number;
  cells: Record<string, { ads: number; proven: number }>;
}

export interface AdsAnalysis {
  as_of: string;
  read: number;
  proven: number;
  proven_ids: string[];
  angle_of: Record<string, string>;
  angles: AngleRow[];
  labels: LabelRow[];
  brands: BrandRow[];
  findings: AdFinding[];
}
