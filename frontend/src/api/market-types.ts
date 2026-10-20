export interface EvidenceItem {
  id: string;
  kind: 'stage_ad' | 'history_ad' | 'snapshot' | 'google_query' | 'amazon_query' | 'amazon_listing' | 'reddit' | 'review' | 'landing_page';
  text: string;
  url: string | null;
  brand: string | null;
  date: string | null;
  days_running: number | null;
  active: boolean | null;
  volume: number | null;
  awareness: string | null;
}

export interface ClaimCensus {
  key: string;
  claim: string;
  claim_type: string;
  ads: number;
  brands: string[];
  first_seen: string | null;
  longest_days: number | null;
  active: number;
}

export interface ChannelAwareness {
  channel: string;
  items: number;
  weighted_by_volume: boolean;
  shares: Partial<Record<string, number>>;
}

export interface MarketAssessment {
  run_id: string;
  sophistication_stage: number;
  confidence: string;
  why: string;
  claims: ClaimCensus[];
  awareness: ChannelAwareness[];
  evidence: EvidenceItem[];
  snapshot_ids: string[];
}
