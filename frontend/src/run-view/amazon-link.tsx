import type { TargetListing } from '../api';

const WHY: Record<string, string> = {
  brand: 'the top results were other brands',
  active: 'no listing of this brand names its active',
  form: 'no listing of this brand is in this form',
};

export function AmazonLink({ row }: { row: TargetListing | undefined }) {
  if (!row) return null;
  const listing = row.listing;
  if (row.matches && listing) {
    const facts = [
      listing.stars != null ? `★ ${listing.stars}` : '',
      listing.reviews_count != null ? `${listing.reviews_count.toLocaleString()} reviews` : '',
    ].filter(Boolean);
    return (
      <span className="comp-amazon">
        <a href={listing.url} target="_blank" rel="noreferrer" title={listing.title}>
          Amazon ↗
        </a>
        {facts.length > 0 && ` ${facts.join(' · ')}`}
      </span>
    );
  }
  const why = listing ? WHY[row.mismatch] ?? 'no matching listing' : 'no Amazon result';
  return <span className="comp-amazon muted">not on Amazon — {why}</span>;
}
