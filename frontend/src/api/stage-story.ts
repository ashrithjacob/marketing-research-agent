import type { Source, StagePacket } from './packet';
import type { ProductTruthPacket } from './product-truth';
import type { RunDetail, RunSummary } from './runs';
import { DELIVERED_STATUSES } from './runs';

export type StageNumber = 1 | 2 | 3 | 4 | 5;

/** The order the stages are worked in, and shown: market truth and its gate come before customer voice, which is paid and only worth it once the gate has not said drop; customer truth reads customer voice's reviews. */
export const STAGE_ORDER: readonly StageNumber[] = [1, 2, 4, 3, 5];

export const STAGE_STORY: Record<StageNumber, { title: string; about: string }> = {
  1: { title: 'Market', about: 'The product, its competitors and its category' },
  2: { title: 'Product truth', about: 'Ingredients, doses against studies, what ads may claim, costs' },
  3: { title: 'Customer voice', about: 'What buyers say in their reviews' },
  4: { title: 'Market truth', about: 'Market size, offers, sophistication, breaking point, and whether to go on' },
  5: { title: 'Customer truth', about: 'Who buys, in their own words: avatars, their language, identity and awareness' },
};

const KIND_WORDS: Record<string, string> = {
  first_party: 'own pages',
  competitor_marketing: 'competitor pages',
  marketplace_review: 'marketplace listings',
  review_platform: 'review sites',
  forum: 'forum threads',
  video_comments: 'video comments',
  ad_library: 'ad-library searches',
  trial: 'clinical studies',
  reference: 'reference pages',
  keyword_data: 'search-data pages',
  seo_listicle: 'listicles',
  review_roundup: 'review roundups',
  coa: 'lab certificates',
  ai_generated: 'AI-written pages',
};

/** The run a stage's tile shows: its newest delivered stage run, else its newest stage run of any status. */
export function stageRun(runs: RunSummary[], stage: StageNumber): RunSummary | null {
  const own = runs.filter((r) => r.stage === stage && !r.is_task).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return own.find((r) => DELIVERED_STATUSES.has(r.status)) ?? own[0] ?? null;
}

export interface StageStat {
  label: string;
  value: number;
  warn?: boolean;
}

export type StageTab = { key: string; label: string; count?: number };

/** What a stage's run kept, in one sentence, and what it found, as figures; gaps are the figure to warn on. */
export function stageOverview(stage: StageNumber, run: RunDetail): { read: string; stats: StageStat[] } {
  const packet = run.packet;
  if (!packet) return { read: run.error ? `Stopped: ${run.error}` : 'Nothing kept from this run.', stats: [] };
  const admitted = packet.sources.filter((s) => s.admitted !== false);
  const base = [
    { label: 'sources', value: admitted.length },
    { label: 'sites', value: new Set(admitted.map((s) => host(s.url))).size },
  ];
  const gaps = { label: 'gaps', value: packet.gaps.length, warn: packet.gaps.length > 0 };
  if (stage === 2 && packet.stage === 2) {
    const p = packet as ProductTruthPacket;
    return {
      read: readLine(p.sources),
      stats: [...base, { label: 'actives', value: p.actives.length }, { label: 'doses checked', value: p.doses.length }, { label: 'markets', value: new Set(p.claim_limits.map((c) => c.market)).size }, { label: 'prices', value: p.prices.length }, gaps],
    };
  }
  const p = packet as StagePacket;
  if (stage === 3) return { read: readLine(p.sources), stats: [...base, { label: 'quotes', value: p.excerpts.length }, gaps] };
  if (stage === 5) {
    const top = (p.avatars ?? []).filter((a) => !a.parent).length;
    return { read: `${(p.quotes ?? []).length} customer quotes, copied from their reviews and posts.`, stats: [{ label: 'avatars', value: top }, { label: 'quotes', value: (p.quotes ?? []).length }, { label: 'identity entries', value: (p.identity_entries ?? []).length }, gaps] };
  }
  if (stage === 4) {
    const level = Number(marketWord(p, 'stage'));
    return { read: readLine(p.sources), stats: [...base, ...(level ? [{ label: 'sophistication', value: level }] : []), { label: 'breaking points', value: p.attributes.filter((a) => a.key === 'moments').length }, gaps] };
  }
  return {
    read: readLine(p.sources),
    stats: [
      ...base,
      { label: 'facts', value: p.attributes.filter((a) => a.node === 'product_data').length },
      { label: 'competitors', value: (p.competitors ?? []).length },
      { label: 'figures', value: p.measurements.filter((m) => m.node === 'category_data').length },
      gaps,
    ],
  };
}

/** The tabs a stage's view has: its sections, then every source and every gap. */
export function stageTabs(stage: StageNumber, run: RunDetail | null): StageTab[] {
  const sections: Record<StageNumber, StageTab[]> = {
    1: [
      { key: 'product_data', label: 'Product' },
      { key: 'competitors', label: 'Competitors' },
      { key: 'category_data', label: 'Category' },
    ],
    2: [
      { key: 'mechanism', label: 'Ingredients' },
      { key: 'dose_vs_study', label: 'Doses' },
      { key: 'claim_limits', label: 'Claims' },
      { key: 'cogs_refills', label: 'Economics' },
    ],
    3: [{ key: 'voice', label: 'Customer voice' }],
    4: [
      { key: 'viability', label: 'Verdict' },
      { key: 'tam_sam', label: 'Market size' },
      { key: 'offers', label: 'Offers' },
      { key: 'sophistication', label: 'Sophistication' },
      { key: 'breaking_point', label: 'Breaking point' },
    ],
    5: [
      { key: 'avatars', label: 'Avatars' },
      { key: 'language_bank', label: 'Language bank' },
      { key: 'identity', label: 'Identity' },
      { key: 'awareness', label: 'Awareness' },
    ],
  };
  return [...sections[stage], { key: 'sources', label: 'Sources', count: (run?.packet?.sources ?? []).filter((s) => s.admitted !== false).length }, { key: 'gaps', label: 'Gaps', count: run?.packet?.gaps.length ?? 0 }];
}

export function sourceKindWords(kind: string): string {
  return KIND_WORDS[kind] ?? kind.replace(/_/g, ' ');
}

export function sourceHost(url: string): string {
  return host(url);
}

/** The first word of a market-truth attribute, such as the gate's verdict or the sophistication digit; "" when it is not there. */
export function marketWord(packet: StagePacket, key: string): string {
  const value = packet.attributes.find((a) => a.key === key)?.value ?? '';
  return value.trim().toLowerCase().split(/[^a-z0-9]+/)[0] ?? '';
}

function readLine(sources: Source[]): string {
  const admitted = sources.filter((s) => s.admitted !== false);
  if (admitted.length === 0) return 'Kept no sources.';
  const sites = new Set(admitted.map((s) => host(s.url))).size;
  const kinds = new Map<string, number>();
  for (const s of admitted) kinds.set(s.kind, (kinds.get(s.kind) ?? 0) + 1);
  const top = [...kinds].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([kind, n]) => `${n} ${KIND_WORDS[kind] ?? kind.replace(/_/g, ' ')}`);
  return `${admitted.length} source${admitted.length === 1 ? '' : 's'} from ${sites} site${sites === 1 ? '' : 's'}: ${top.join(', ')}.`;
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
