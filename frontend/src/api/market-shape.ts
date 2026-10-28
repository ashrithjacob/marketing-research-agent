import { runs } from './runs';
import type { ClaimCensus, EvidenceItem, MarketAssessment } from './market-types';
import type { ReadAd } from './types';

export interface AdCopy {
  id: string;
  url: string | null;
  first_seen: string | null;
}

export interface EvidenceGroup {
  id: string;
  kind: EvidenceItem['kind'];
  text: string;
  brand: string | null;
  awareness: string | null;
  volume: number | null;
  url: string | null;
  landing_url: string | null;
  copies: AdCopy[];
}

export type WhyPart = { text: string } | { cited: EvidenceItem[]; missing: string[]; label: string };

export interface Span {
  text: string;
  kind: 'plain' | 'date' | 'claim';
}

export interface StepEvidence {
  stage: number;
  ads: number;
  brands: number;
  claims: number;
  first_seen: string | null;
}

const KIND_OF_PREFIX: Record<string, string> = { ws: 'page snapshot', al: 'Amazon listing', gq: 'Google search', aq: 'Amazon search', rd: 'Reddit post', lp: 'landing page' };
const ID = /^(?:[a-z]{2}-\d+|facebook_\d+|[0-9a-f]{32})$/;
const isAd = (kind: string) => kind === 'stage_ad' || kind === 'history_ad';
const libraryUrl = (trendtrackId: string | undefined) => (trendtrackId?.startsWith('facebook_') ? `https://www.facebook.com/ads/library/?id=${trendtrackId.slice('facebook_'.length)}` : null);

function kindOf(id: string, item: EvidenceItem | undefined): string {
  if (item) return isAd(item.kind) ? 'ad' : (KIND_OF_PREFIX[id.slice(0, 2)] ?? item.kind.replace(/_/g, ' '));
  return KIND_OF_PREFIX[id.slice(0, 2)] ?? 'ad';
}

function citationLabel(ids: string[], byId: Map<string, EvidenceItem>): string {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(kindOf(id, byId.get(id)), (counts.get(kindOf(id, byId.get(id))) ?? 0) + 1);
  return [...counts.entries()].map(([kind, n]) => (n === 1 ? kind : `${n} ${kind}s`)).join(', ');
}

export const marketShape = {
  async load(runId: string): Promise<{ market: MarketAssessment | null; ads: ReadAd[] }> {
    const [{ market }, { ads }] = await Promise.all([runs.market(runId), runs.ads(runId)]);
    return { market, ads };
  },

  groups(evidence: EvidenceItem[], ads: ReadAd[]): EvidenceGroup[] {
    const trendtrack = new Map(ads.map((ad) => [ad.id, ad.trendtrack_ad_id]));
    const groups = new Map<string, EvidenceGroup>();
    for (const item of evidence) {
      const key = isAd(item.kind) ? `ad:${item.text.trim()}` : item.id;
      const copy = { id: item.id, url: libraryUrl(item.kind === 'history_ad' ? item.id : trendtrack.get(item.id)), first_seen: item.date };
      const group = groups.get(key);
      if (group) group.copies.push(copy);
      else groups.set(key, { id: item.id, kind: item.kind, text: item.text, brand: item.brand, awareness: item.awareness, volume: item.volume, url: isAd(item.kind) ? null : item.url, landing_url: isAd(item.kind) ? item.url : null, copies: isAd(item.kind) ? [copy] : [] });
    }
    for (const group of groups.values()) group.copies.sort((a, b) => (a.first_seen ?? '').localeCompare(b.first_seen ?? ''));
    return [...groups.values()];
  },

  why(text: string, evidence: EvidenceItem[]): WhyPart[] {
    const byId = new Map(evidence.map((item) => [item.id, item]));
    const parts: WhyPart[] = [];
    let at = 0;
    for (const match of text.matchAll(/\s*\(([^()]+)\)/g)) {
      const tokens = match[1]!.split(/,\s*/).map((token) => token.trim());
      const ids = tokens.filter((token) => ID.test(token) || byId.has(token));
      if (ids.length === 0) continue;
      const words = tokens.filter((token) => !ids.includes(token));
      parts.push({ text: text.slice(at, match.index) + (words.length > 0 ? ` (${words.join(', ')})` : '') });
      parts.push({ cited: ids.flatMap((id) => byId.get(id) ?? []), missing: ids.filter((id) => !byId.has(id)), label: citationLabel(ids, byId) });
      at = match.index! + match[0].length;
    }
    parts.push({ text: text.slice(at) });
    return parts;
  },

  lines(parts: WhyPart[]): WhyPart[][] {
    const lines: WhyPart[][] = [[]];
    for (const part of parts) {
      if (!('text' in part)) {
        lines.at(-1)!.push(part);
        continue;
      }
      part.text.split(/(?<=[.!?])\s+(?=[A-Z])/).forEach((sentence, i) => {
        if (i > 0) lines.push([]);
        if (sentence.trim()) lines.at(-1)!.push({ text: sentence });
      });
    }
    return lines.filter((line) => line.some((part) => !('text' in part) || part.text.trim()));
  },

  spans(text: string): Span[] {
    const pattern = /((?:mid-|early |late )?\b(?:19|20)\d{2}(?:-\d{2}){0,2}\b)|(?<=^|[\s(—])'([^']{4,}?)'(?=[\s).,;:—]|$)/g;
    const spans: Span[] = [];
    let at = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index! > at) spans.push({ text: text.slice(at, match.index), kind: 'plain' });
      spans.push(match[1] ? { text: match[1], kind: 'date' } : { text: match[2]!, kind: 'claim' });
      at = match.index! + match[0].length;
    }
    if (at < text.length) spans.push({ text: text.slice(at), kind: 'plain' });
    return spans;
  },

  steps(claims: ClaimCensus[]): StepEvidence[] {
    const ofType = (types: string[], stage: number): StepEvidence => {
      const picked = claims.filter((claim) => types.includes(claim.claim_type));
      const dates = picked.map((claim) => claim.first_seen).filter((date): date is string => Boolean(date)).sort();
      return { stage, ads: picked.reduce((n, claim) => n + claim.ads, 0), brands: new Set(picked.flatMap((claim) => claim.brands)).size, claims: picked.length, first_seen: dates[0] ?? null };
    };
    const mechanism = ofType(['mechanism'], 4);
    return [ofType(['plain'], 1), ofType(['bigger'], 2), ofType(['mechanism'], 3), mechanism.claims >= 2 ? mechanism : { ...mechanism, ads: 0, brands: 0, claims: 0, first_seen: null }, ofType(['identity'], 5)];
  },
};
