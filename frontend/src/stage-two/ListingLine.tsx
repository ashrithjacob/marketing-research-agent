import type { AmazonListing, MiningTarget, TargetListing } from '../api';

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

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function reviewPlaces(target: MiningTarget): Array<{ label: string; href: string }> {
  const domain = domainOf(target.url);
  const who = [target.brand, target.name].filter((part) => part !== '').join(' ');
  return [
    target.url ? { label: 'its own product page', href: target.url } : null,
    domain ? { label: 'Trustpilot', href: `https://www.trustpilot.com/review/${domain}` } : null,
    { label: 'Reddit', href: `https://www.reddit.com/search/?q=${encodeURIComponent(who)}` },
  ].filter((place): place is { label: string; href: string } => place !== null);
}

function NotOnAmazon({ target, searched }: { target: MiningTarget; searched: string }) {
  return (
    <div className="listing-line small mismatch">
      <div className="listing-warn">
        Not listed on Amazon — no match from this company {searched}. Look for its customer reviews on{' '}
        {reviewPlaces(target).map((place, index, all) => (
          <span key={place.label}>
            <a href={place.href} target="_blank" rel="noreferrer">
              {place.label} ↗
            </a>
            {index < all.length - 1 ? ' · ' : '.'}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ListingLine({
  row,
  looking,
  target,
}: {
  row: TargetListing | undefined;
  looking: boolean;
  target: MiningTarget;
}) {
  if (!row) {
    return (
      <div className="listing-line muted small">
        {looking ? 'Looking it up on Amazon…' : 'Amazon lookup failed — reopen this to retry.'}
      </div>
    );
  }
  const listing = row.listing;
  const store = listing?.marketplace.replace(/^www\./, '') ?? 'Amazon';
  if (!listing || (!row.matches && row.mismatch !== 'form')) {
    return <NotOnAmazon target={target} searched={`in the top results on ${store}`} />;
  }
  return (
    <div className={`listing-line small ${row.matches ? '' : 'mismatch'}`}>
      {!row.matches && (
        <div className="listing-warn">
          This company's listing on {store} is a different form ("{listing.title}"), not {target.form} — shown for
          reference, never mined.
        </div>
      )}
      <span className="listing-facts">{facts(listing).join(' · ')}</span>{' '}
      <a href={listing.url} target="_blank" rel="noreferrer" title={listing.title}>
        Amazon ↗
      </a>
    </div>
  );
}
