import type { ReactNode } from 'react';

import type { Competitor, Price, Product, ReadAd, ReviewCoverage } from '../api';

const RELATIONSHIP: Record<string, string> = { direct: 'Direct', indirect: 'Indirect', other: 'Other' };

function price(value: Price | null): string {
  return value ? new Intl.NumberFormat(undefined, { style: 'currency', currency: value.currency }).format(value.amount) : '—';
}

function Tile({ value, label, note, title, children }: { value: string | number; label: string; note?: string; title: string; children: ReactNode }) {
  return (
    <div className="tile" tabIndex={0}>
      <span className="value">{value}</span>
      <span className="label">{label}</span>
      {note && <span className="note">{note}</span>}
      <div className="tile-pop" role="tooltip">
        <strong className="tile-pop-title">{title}</strong>
        {children}
      </div>
    </div>
  );
}

function Rows({ rows, empty }: { rows: [string, string][]; empty: string }) {
  if (rows.length === 0) return <p className="dim small">{empty}</p>;
  return (
    <table className="tile-pop-rows">
      <tbody>
        {rows.map(([left, right], i) => (
          <tr key={`${left}-${i}`}>
            <td>{left}</td>
            <td>{right}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function reviewRows(coverage: ReviewCoverage[], competitors: Competitor[]): [string, string][] {
  const byTarget = new Map<string, { reviews: number; stars: number; rated: number }>();
  for (const row of coverage) {
    const name = row.competitor_id === null ? 'Your product' : competitors.find((c) => c.id === row.competitor_id)?.brand ?? 'Competitor';
    const seen = byTarget.get(name) ?? { reviews: 0, stars: 0, rated: 0 };
    const count = Number(row.reviews);
    seen.reviews += count;
    if (row.average_rating !== null) {
      seen.stars += Number(row.average_rating) * count;
      seen.rated += count;
    }
    byTarget.set(name, seen);
  }
  return [...byTarget.entries()]
    .sort((a, b) => (a[0] === 'Your product' ? -1 : b[0] === 'Your product' ? 1 : b[1].reviews - a[1].reviews))
    .map(([name, seen]) => [name, `${seen.reviews} reviews${seen.rated > 0 ? ` · ${(seen.stars / seen.rated).toFixed(1)}★` : ''}`]);
}

function adRows(ads: ReadAd[]): [string, string][] {
  const buckets: [string, string][] = (['winning', 'testing', 'dead'] as const).map((bucket) => [bucket === 'winning' ? 'Winning' : bucket === 'testing' ? 'Still testing' : 'Stopped early', String(ads.filter((ad) => ad.bucket === bucket).length)]);
  const byAdvertiser = new Map<string, number>();
  for (const ad of ads) byAdvertiser.set(ad.advertiser, (byAdvertiser.get(ad.advertiser) ?? 0) + 1);
  const top = [...byAdvertiser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]): [string, string] => [`Top advertiser: ${name}`, `${count} ads`]);
  const longest = Math.max(0, ...ads.map((ad) => ad.days_running ?? 0));
  return [...buckets, ...top, ...(longest > 0 ? [['Longest-running ad', `${longest} days`] as [string, string]] : [])];
}

export default function HeaderTiles({ product, competitors, coverage, ads }: { product: Product | null; competitors: Competitor[]; coverage: ReviewCoverage[]; ads: ReadAd[] }) {
  const reviews = coverage.reduce((sum, row) => sum + Number(row.reviews), 0);
  const winning = ads.filter((ad) => ad.bucket === 'winning').length;
  const ingredients = product?.ingredients ?? [];
  return (
    <div className="tiles">
      <Tile value={competitors.length} label="competitors" note={`${competitors.filter((c) => c.relationship === 'direct').length} direct`} title="Who you compete with">
        <Rows rows={competitors.map((c) => [c.brand, `${RELATIONSHIP[c.relationship ?? ''] ?? 'Unclassified'} · ${price(c.price)}`])} empty="Competitors appear once you confirm them." />
        <p className="tile-pop-foot">Direct: same key ingredient and form. Indirect: solves the same problem another way.</p>
      </Tile>
      <Tile value={reviews} label="reviews" title="Customer reviews read">
        <Rows rows={reviewRows(coverage, competitors)} empty="Reviews are collected in stage 2." />
        <p className="tile-pop-foot">Real buyers' words: the raw material for the buyer groups.</p>
      </Tile>
      <Tile value={ads.length} label="long-form ads" note={ads.length > 0 ? `${winning} winning` : undefined} title="Competitor long-form ads">
        <Rows rows={ads.length > 0 ? adRows(ads) : []} empty="Ads are collected in stage 3." />
        <p className="tile-pop-foot">Winning: running about 30 days or more, duplicated, or still growing its reach. Advertisers keep ads that pay.</p>
      </Tile>
      <Tile value={ingredients.length} label="ingredients" title="What is in your product">
        <Rows rows={ingredients.map((i) => [i.name, i.dose !== null ? `${i.dose}${i.unit ? ` ${i.unit}` : ''}` : 'dose not stated'])} empty="Read from your product page in stage 1." />
      </Tile>
    </div>
  );
}
