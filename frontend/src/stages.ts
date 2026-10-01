import type { ResearchNode } from './api';

export type CollectingStage = 1 | 2 | 3;

export const NODE_LABELS: Record<ResearchNode, string> = {
  product_data: 'Product data',
  competitors: 'Competitors',
  category_data: 'Category data',
  mechanism: 'Mechanism',
  dose_vs_study: 'Dose vs study',
  claim_limits: 'Claim limits',
  cogs_refills: 'COGS & refills',
  review_mining: 'Review mining',
};

/** Which nodes each collecting stage owns. Mirrors `STAGE_NODES` in `server/src/domain/nodes.ts`. */
export const STAGE_NODES: Record<CollectingStage, ResearchNode[]> = {
  1: ['product_data', 'competitors', 'category_data'],
  2: ['mechanism', 'dose_vs_study', 'claim_limits', 'cogs_refills'],
  3: ['review_mining'],
};

export const STAGE_NAMES: Record<CollectingStage, string> = {
  1: 'Raw material',
  2: 'Product truth',
  3: 'Review mining',
};

export const NODE_ORDER: ResearchNode[] = [...STAGE_NODES[1], ...STAGE_NODES[2], ...STAGE_NODES[3]];

/** The stage a node is collected in. */
export function stageOfNode(node: ResearchNode): CollectingStage {
  return STAGE_NODES[2].includes(node) ? 2 : STAGE_NODES[3].includes(node) ? 3 : 1;
}

/** "Product data" for one node; a stage's name, or "Whole stage" for stage 1, for all of a stage's nodes. */
export function scopeLabel(nodes: readonly ResearchNode[]): string {
  if (nodes.length === 0) return 'Whole stage';
  const stage = stageOfNode(nodes[0]);
  if (nodes.length === STAGE_NODES[stage].length) return stage === 1 ? 'Whole stage' : STAGE_NAMES[stage];
  return nodes.map((n) => NODE_LABELS[n]).join(' + ');
}
