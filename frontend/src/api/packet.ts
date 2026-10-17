import type { Brief, ResearchNode } from './runs';

export interface Source {
  id: string;
  url: string;
  title?: string;
  kind: string;
  publisher?: string;
  fetched_at?: string;
  first_seen?: string | null;
  marketing?: boolean;
  admitted: boolean;
  admission_reason?: string;
  archived?: boolean;
  node: ResearchNode;
}

export interface Excerpt {
  id: string;
  source_id: string;
  text: string;
  captured_at?: string;
  node: ResearchNode;
  star_rating?: number | null;
  posted_at?: string;
  axis?: 'why_bought' | 'why_stayed' | 'why_quit' | null;
  themes?: string[];
}

export interface Measurement {
  id: string;
  node: ResearchNode;
  metric: string;
  value: number | string;
  unit?: string;
  period?: string;
  source_id: string;
}

export interface AttributeRecord {
  id: string;
  node: ResearchNode;
  key: string;
  value: string;
  source_id: string;
  reads_as?: string;
  sections?: { title: string; text: string }[];
}

export interface SaturationPoint {
  source_id: string;
  new_themes: number;
  cumulative_themes: number;
}

export interface Saturation {
  node: ResearchNode;
  /** Competitors only: discovery saturates per class. */
  class?: CompetitorRelation | null;
  curve: SaturationPoint[];
  stopped_because?: string;
}

export interface NodeStatus {
  node: ResearchNode;
  status: 'complete' | 'incomplete';
  done_criterion_met: boolean;
  why?: string;
}

export interface Gap {
  node: ResearchNode;
  missing: string;
  would_need?: string;
  blocking?: boolean;
}

/** `direct` shares an active in the champion's form; `indirect_form` shares one in another form; `indirect_active` shares none. */
export type CompetitorRelation = 'direct' | 'indirect_form' | 'indirect_active';

export interface ActiveIngredient {
  name_as_printed: string;
  name_normalised: string;
  dose?: string;
  unit?: string;
  per?: string;
  standardisation?: string;
}

/** The champion product competitors are measured against — the genre's most-bought, as read off its own page. */
export interface CompetitorReference {
  name: string;
  form: string;
  form_as_printed?: string;
  actives: string[];
  source_id: string;
  reviews_count?: number;
  runner_up_name?: string;
  runner_up_reviews?: number;
}

/** Mirrors `competitorSchema` in `server/src/domain/packet.ts`. */
export interface Competitor {
  id: string;
  name: string;
  brand?: string;
  url: string;
  relation: CompetitorRelation;
  form: string;
  form_as_printed?: string;
  active_ingredients: ActiveIngredient[];
  shared_actives: string[];
  icp_as_printed?: string;
  dose_per_serving?: string;
  positioning_copy?: string;
  price?: string;
  price_per_dose?: string;
  market?: string;
  source_id: string;
  ad_source_ids?: string[];
}

export interface StagePacket {
  contract_version: string;
  stage: number;
  brief: Brief;
  sources: Source[];
  excerpts: Excerpt[];
  measurements: Measurement[];
  attributes: AttributeRecord[];
  competitor_reference?: CompetitorReference | null;
  competitors?: Competitor[];
  saturation: Saturation[];
  nodes: NodeStatus[];
  gaps: Gap[];
  element_shares?: ElementShare[];
  buyer_stage_shares?: BuyerStageShare[];
  quotes?: Quote[];
  identity_entries?: IdentityEntry[];
  pain_profiles?: PainProfile[];
  avatars?: Avatar[];
  awareness?: Awareness[];
}

/** A customer's own words, copied by code from a mined review or an archived page. */
export interface Quote {
  id: string;
  review_ref: string;
  source_id: string;
  text: string;
  star: number | null;
  posted_at: string;
  function: 'pain' | 'outcome' | 'objection' | 'proof';
  buyer_stage: BuyerStageShare['stage'] | null;
}

type Provenanced = { quote_ids: string[]; provenance: 'evidenced' | 'inferred' };

export type IdentityEntry = Provenanced & { kind: 'label_self' | 'label_others' | 'guilt' | 'loss' | 'feared_identity'; summary: string };

export type PainProfile = Provenanced & { pain: string; emotion: string; intensity: string; duration: string; social: string };

export type Avatar = Provenanced & {
  id: string;
  parent: string | null;
  name: string;
  proxy: boolean;
  situation: string;
  history: string;
  demographics: string;
  pains: string[];
  outcomes: string[];
  objections: string[];
  identity: string;
  secondary_gain: string;
  blame: 'outward' | 'inward' | 'mixed';
};

export type AwarenessLevel = 'unaware' | 'problem_aware' | 'solution_aware' | 'product_aware' | 'most_aware';

export type Awareness = Provenanced & { avatar_id: string; channel: string; weights: Record<AwarenessLevel, number>; entry: AwarenessLevel; why: string };

/** How many of the customer voices a run read stand at one buyer stage. */
export interface BuyerStageShare {
  stage: 'beginner' | 'explorer' | 'researcher' | 'skeptic' | 'hopeless';
  voices: number;
  of: number;
}

/** How many of the tagged competitor brands use one persuasion element; the stage is the most advanced one at least half use. */
export interface ElementShare {
  element: 'claim' | 'amplifier' | 'mechanism' | 'proof' | 'identity';
  brands: number;
  of: number;
}
