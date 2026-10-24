import type { AdsAnalysis } from './ads-types';
import type { ReadAd } from './types';

export type AdFilter = Record<string, string>;

const pct = (share: number) => `${Math.round(share * 100)}%`;

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
  pct,
  words: (value: string) => value.replace(/_/g, ' '),
  brandOf,
  labels: Object.keys(LABEL_OF),

  matches(ad: ReadAd, filter: AdFilter, analysis: AdsAnalysis | null): boolean {
    return Object.entries(filter).every(([key, value]) => {
      if (key === 'proven') return (analysis?.proven_ids.includes(ad.id) ?? false) === (value === 'yes');
      if (key === 'angle') return analysis?.angle_of[ad.id] === value;
      if (key === 'brand') return brandOf(ad) === value;
      if (key === 'bucket') return ad.bucket === value;
      if (key === 'ring') return (ad.competitor_id !== null ? 'direct_competitor' : ad.ring) === value;
      if (key === 'ids') return value.split(',').includes(ad.id);
      return LABEL_OF[key]?.(ad).includes(value) ?? true;
    });
  },

  values(ads: ReadAd[], key: string, analysis: AdsAnalysis | null): string[] {
    if (key === 'angle') return analysis?.angles.map((angle) => angle.key) ?? [];
    if (key === 'proven') return ['yes', 'no'];
    if (key === 'brand') return [...new Set(ads.map(brandOf))].sort();
    if (key === 'bucket') return ['winning', 'testing', 'dead'];
    if (key === 'ring') return ['direct_competitor', 'same_problem', 'same_buyer', 'trending_shop'];
    return [...new Set(ads.flatMap((ad) => LABEL_OF[key]?.(ad) ?? []))].sort();
  },

  facts(subject: string, analysis: AdsAnalysis): string | null {
    const angle = analysis.angles.find((a) => a.key === subject);
    if (angle) return `${angle.name}: ${angle.ads} ads, ${angle.proven} proven, ${angle.brands.length} brands, ${angle.launched_60d} launched in 60 days`;
    const brand = analysis.brands.find((b) => b.domain === subject);
    if (brand) return `${brand.domain}: ${brand.ads} kept ads, ${brand.proven} proven, ${brand.launched_60d} launched in 60 days`;
    const [label, value] = subject.split(':');
    const row = analysis.labels.find((l) => l.label === label && l.value === value);
    if (row) return `${label} ${adsShape.words(value ?? '')}: ${pct(row.proven_share)} of proven ads, ${pct(row.rest_share)} of the rest`;
    return null;
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
