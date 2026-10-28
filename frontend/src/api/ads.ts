import type { ReadAd } from './types';

export type AdFilter = Record<string, string>;

const LABEL_OF: Record<string, (ad: ReadAd) => string[]> = {
  awareness: (ad) => (ad.reading ? [ad.reading.awareness] : []),
  claim_type: (ad) => (ad.reading ? [ad.reading.claim_type] : []),
  proof: (ad) => ad.reading?.proof_kinds ?? [],
  offer: (ad) => ad.reading?.offer_kinds ?? [],
  emotion: (ad) => (ad.reading?.emotion_kind ? [ad.reading.emotion_kind] : []),
  landing: (ad) => (ad.reading?.landing_kind ? [ad.reading.landing_kind] : []),
  structure: (ad) => (ad.reading?.copy_structure ? [ad.reading.copy_structure] : []),
};

const brandOf = (ad: ReadAd) => (ad.landing_domain || ad.advertiser).replace(/^www\./, '').toLowerCase();

export const adsShape = {
  words: (value: string) => value.replace(/_/g, ' '),
  brandOf,
  labels: Object.keys(LABEL_OF),

  rings: ['direct_competitor', 'same_problem', 'same_buyer', 'general'],

  pages: { brand: 'brand page · bottom of funnel', community: 'community page · upper funnel', persona: 'persona page · top of funnel', authority: 'authority page · top of funnel' } as Record<string, string>,

  ringOf: (ad: ReadAd) => ad.ring ?? (ad.competitor_id !== null ? 'direct_competitor' : null),

  matches(ad: ReadAd, filter: AdFilter): boolean {
    return Object.entries(filter).every(([key, value]) => {
      if (key === 'brand') return brandOf(ad) === value;
      if (key === 'bucket') return ad.bucket === value;
      if (key === 'ring') return adsShape.ringOf(ad) === value;
      if (key === 'page') return ad.page_kind === value;
      return LABEL_OF[key]?.(ad).includes(value) ?? true;
    });
  },

  values(ads: ReadAd[], key: string): string[] {
    if (key === 'brand') return [...new Set(ads.map(brandOf))].sort();
    if (key === 'bucket') return ['winning', 'testing', 'dead'];
    if (key === 'ring') return adsShape.rings;
    if (key === 'page') return Object.keys(adsShape.pages);
    return [...new Set(ads.flatMap((ad) => LABEL_OF[key]?.(ad) ?? []))].sort();
  },

  readFilter(): AdFilter {
    const raw = new URLSearchParams(window.location.search).get('ads');
    if (!raw) return {};
    return Object.fromEntries(raw.split(';').map((pair) => pair.split('=') as [string, string]).filter(([key, value]) => key && value));
  },

  writeFilter(filter: AdFilter) {
    const params = new URLSearchParams(window.location.search);
    const raw = Object.entries(filter).map(([key, value]) => `${key}=${value}`).join(';');
    if (raw) params.set('ads', raw);
    else params.delete('ads');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  },
};
