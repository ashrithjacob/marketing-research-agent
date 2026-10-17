import type { Quote, StagePacket } from './packet';

/** A customer-truth packet's quotes by id, so every row that cites one can show the words. */
export function quotesById(packet: StagePacket): Map<string, Quote> {
  return new Map((packet.quotes ?? []).map((q) => [q.id, q]));
}

export const FUNCTION_WORDS: Record<Quote['function'], string> = {
  pain: 'How they describe the pain',
  outcome: 'The outcome they want',
  objection: 'What they object to',
  proof: 'The proof they demand',
};

export const IDENTITY_WORDS: Record<string, string> = {
  label_self: 'What they call themselves',
  label_others: 'Labels others gave them',
  guilt: 'Guilt and shame',
  loss: 'What it has cost them',
  feared_identity: 'Who they fear becoming',
};

export const CHANNEL_WORDS: Record<string, string> = {
  cold_social: 'Cold social ads',
  category_search: 'Category search',
  branded_search: 'Branded search',
  marketplace: 'Marketplace',
  retargeting: 'Retargeting',
};

export const LEVEL_WORDS: Record<string, string> = {
  unaware: 'Unaware',
  problem_aware: 'Problem aware',
  solution_aware: 'Solution aware',
  product_aware: 'Product aware',
  most_aware: 'Most aware',
};
