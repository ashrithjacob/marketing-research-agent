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

export type CompetitorRelation = 'direct' | 'indirect';

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
  dose_per_serving?: string;
  positioning_copy?: string;
  price?: string;
  price_per_dose?: string;
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
}

export const VOICE_PER_STAR = 10;

function stableRank(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

/** Up to `perStar` quotes from each star rating, 1★ to 5★ then unrated, picked at random but the same pick every render. */
export function sampleVoice(excerpts: Excerpt[], perStar = VOICE_PER_STAR): Excerpt[] {
  const groups = new Map<number | null, Excerpt[]>();
  for (const excerpt of excerpts) {
    const star = excerpt.star_rating ?? null;
    groups.set(star, [...(groups.get(star) ?? []), excerpt]);
  }
  const order: Array<number | null> = [1, 2, 3, 4, 5, null];
  return order.flatMap((star) =>
    [...(groups.get(star) ?? [])]
      .sort((a, b) => stableRank(a.id) - stableRank(b.id))
      .slice(0, perStar),
  );
}
