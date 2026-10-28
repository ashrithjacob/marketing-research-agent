import { adsShape, type ReadAd } from '../../api';

export interface Part { key: string; value: number }
export interface BarRow { label: string; parts: Part[]; note?: string }
export interface Heat { rows: string[]; cols: string[]; cells: Map<string, number>; max: number }
export interface Headline { label: string; pct: string }

export const CATEGORIES = ['direct_competitor', 'same_problem', 'same_buyer'];
export const PAGE_KINDS = ['brand', 'community', 'persona', 'authority'];
export const AWARENESS = ['unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware', 'not read'];
export const PROMISES: Record<string, string> = {
  root_cause: "The real cause your treatment can't reach",
  managed_numbers: "Your 'managed' numbers hide the damage",
  better_form: 'The cheap version failed you; this form works',
  replace_ritual: "It's not willpower: replace the ritual",
  forgotten_remedy: 'A suppressed or forgotten remedy',
  off_drugs: 'Get off drugs, devices or surgery',
  brand_notice: 'Brand notice: refunds and counterfeits',
  product_intro: 'Plain product introduction',
};

const NOT_READ = 'Not read';
const UNSORTED = 'Not sorted';
const count = <T,>(items: T[], key: (item: T) => string) => {
  const out = new Map<string, number>();
  for (const item of items) out.set(key(item), (out.get(key(item)) ?? 0) + 1);
  return out;
};
const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
};
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—');
const total = (row: BarRow) => row.parts.reduce((sum, p) => sum + p.value, 0);
const byTotal = (a: BarRow, b: BarRow) => total(b) - total(a);
const top = (rows: BarRow[]): Headline | null => {
  const all = rows.reduce((sum, r) => sum + total(r), 0);
  const first = [...rows].sort(byTotal)[0];
  return first ? { label: first.label, pct: pct(total(first), all) } : null;
};

function split(ads: ReadAd[], label: (ad: ReadAd) => string, keys: string[], keyOf: (ad: ReadAd) => string): BarRow[] {
  const groups = new Map<string, ReadAd[]>();
  for (const ad of ads) groups.set(label(ad), [...(groups.get(label(ad)) ?? []), ad]);
  return [...groups].map(([name, members]) => {
    const counts = count(members, keyOf);
    return { label: name, parts: keys.map((key) => ({ key, value: counts.get(key) ?? 0 })) };
  }).sort(byTotal);
}

export const adDigest = {
  promiseOf: (ad: ReadAd) => (ad.reading?.value_prop ? PROMISES[ad.reading.value_prop] ?? ad.reading.value_prop : NOT_READ),
  segmentOf: (ad: ReadAd) => ad.segment ?? UNSORTED,
  pct,

  of(all: ReadAd[]) {
    const ads = all.filter((ad) => CATEGORIES.includes(adsShape.ringOf(ad) ?? ''));
    const ring = (ad: ReadAd) => adsShape.ringOf(ad) ?? '';
    const client = ads.filter((ad) => ring(ad) !== 'same_buyer');
    const buyer = ads.filter((ad) => ring(ad) === 'same_buyer');
    const clientSegments = split(client, adDigest.segmentOf, CATEGORIES.slice(0, 2), ring);
    const buyerSegments = split(buyer, adDigest.segmentOf, ['same_buyer'], ring);
    const promises = split(ads, adDigest.promiseOf, CATEGORIES, ring);
    const lasting = promises.map((row) => {
      const members = ads.filter((ad) => adDigest.promiseOf(ad) === row.label);
      const days = median(members.map((ad) => ad.days_running ?? 0));
      const dups = median(members.map((ad) => ad.duplicates ?? 0));
      return { label: row.label, parts: [{ key: 'median days', value: days }], note: `${days} days · ${dups} dup. · ${members.length} ads` };
    }).sort(byTotal);
    const cells = count(ads, (ad) => `${adDigest.segmentOf(ad)}|${adDigest.promiseOf(ad)}`);
    const heat: Heat = {
      rows: [...clientSegments, ...buyerSegments].sort(byTotal).map((r) => r.label),
      cols: promises.map((r) => r.label),
      cells,
      max: Math.max(1, ...cells.values()),
    };
    const byCategory = (keys: string[], keyOf: (ad: ReadAd) => string) =>
      CATEGORIES.map((category) => {
        const counts = count(ads.filter((ad) => ring(ad) === category), keyOf);
        return { label: category, parts: keys.map((key) => ({ key, value: counts.get(key) ?? 0 })) };
      });
    return {
      ads: ads.length,
      copies: new Set(ads.map((ad) => ad.copy.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())).size,
      clientAds: client.length,
      buyerAds: buyer.length,
      unsorted: ads.filter((ad) => ad.segment === null).length,
      unread: ads.filter((ad) => ad.reading === null).length,
      takeaway: { client: top(clientSegments), buyer: top(buyerSegments), promise: top(promises) },
      clientSegments,
      buyerSegments,
      promises,
      lasting,
      heat,
      pages: byCategory(PAGE_KINDS, (ad) => ad.page_kind ?? 'unknown'),
      awareness: byCategory(AWARENESS, (ad) => ad.reading?.awareness ?? 'not read'),
    };
  },
};

export type AdDigest = ReturnType<typeof adDigest.of>;
