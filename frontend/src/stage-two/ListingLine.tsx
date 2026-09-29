import type { AmazonListing, TargetListing } from '../api';

function money(listing: AmazonListing): string {
  return listing.price == null ? '' : `${listing.currency || '$'}${listing.price.toFixed(2)}`;
}

function facts(listing: AmazonListing): string[] {
  const rank = [...listing.bestseller_ranks].sort((a, b) => a.rank - b.rank)[0];
  const three = listing.stars_breakdown?.['3'];
  return [
    listing.stars != null ? `★ ${listing.stars}` : '',
    listing.reviews_count != null ? `${listing.reviews_count.toLocaleString()} reviews` : '',
    three != null ? `${Math.round(three * 100)}% 3★` : '',
    listing.bought_past_month,
    rank ? `#${rank.rank.toLocaleString()} in ${rank.category}` : '',
    money(listing),
    listing.amazon_choice ? "Amazon's Choice" : '',
  ].filter((fact) => fact !== '');
}

function warning(row: TargetListing, listing: AmazonListing, form: string): string {
  const store = listing.marketplace.replace(/^www\./, '');
  const tail = ' — shown for reference, never mined.';
  if (row.mismatch === 'form') return `This brand's listing on ${store} is a different form ("${listing.title}"), not ${form}${tail}`;
  return `No listing from this brand in the top results on ${store}. Most popular hit was ${listing.brand || 'another brand'}${tail}`;
}

export function ListingLine({ row, looking, form }: { row: TargetListing | undefined; looking: boolean; form: string }) {
  if (!row) {
    return <div className="listing-line muted small">{looking ? 'Looking it up on Amazon…' : 'Amazon lookup failed — reopen this to retry.'}</div>;
  }
  const listing = row.listing;
  if (!listing) return <div className="listing-line muted small">Not found on Amazon ({row.query}).</div>;
  return (
    <div className={`listing-line small ${row.matches ? '' : 'mismatch'}`}>
      {!row.matches && <div className="listing-warn">{warning(row, listing, form)}</div>}
      <span className="listing-facts">{facts(listing).join(' · ')}</span>{' '}
      <a href={listing.url} target="_blank" rel="noreferrer" title={listing.title}>
        Amazon ↗
      </a>
    </div>
  );
}
