import type { AmazonListing, MiningTarget, TargetListing, TrustpilotSummary } from '../api';

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

function trustpilotFacts(summary: TrustpilotSummary | null | undefined): string {
  if (!summary) return 'score not read yet';
  if (summary.error) return `score unavailable (${summary.error})`;
  if (!summary.reviews) return 'no Trustpilot reviews yet';
  return `${summary.stars != null ? `★ ${summary.stars} · ` : ''}${summary.reviews.toLocaleString()} Trustpilot reviews`;
}

export function ListingLine({ target, row, looking }: { target: MiningTarget; row: TargetListing | undefined; looking: boolean }) {
  if (target.note) {
    return (
      <div className="listing-line small mismatch">
        <div className="listing-warn">
          {target.note}
          {target.trustpilot ? ` — mined on Trustpilot (${target.trustpilot}) instead.` : ' — not mined.'}
        </div>
      </div>
    );
  }
  if (target.amazon_url && row?.listing) {
    return (
      <div className="listing-line small">
        <span className="listing-facts">{facts(row.listing).join(' · ')}</span>{' '}
        <a href={row.listing.url} target="_blank" rel="noreferrer" title={row.listing.title}>
          Amazon ↗
        </a>
      </div>
    );
  }
  if (target.trustpilot) {
    return (
      <div className="listing-line small">
        <span className="listing-facts">{trustpilotFacts(row?.trustpilot)}</span>{' '}
        <a href={row?.trustpilot?.url ?? `https://www.trustpilot.com/review/${target.trustpilot}`} target="_blank" rel="noreferrer">
          Trustpilot ↗
        </a>
        <div className="muted">
          {looking && !row ? 'Looking it up on Amazon… ' : 'Not on Amazon — '}mined on Trustpilot ({target.trustpilot}). These
          review the company, often its delivery and refunds, not only the product.
        </div>
      </div>
    );
  }
  return null;
}
