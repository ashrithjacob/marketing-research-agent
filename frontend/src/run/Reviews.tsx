import { useEffect, useRef, useState } from 'react';

import { runs, type Competitor, type Product, type ReviewCoverage, type StoredReview } from '../api';
import BrandMark from '../BrandMark';
import type { BarOf } from './StageBar';

function Stars({ rating }: { rating: number }) {
  return <span className="stars">{'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}</span>;
}

export default function Reviews({ runId, product, competitors, coverage, bar, onError }: { runId: string; product: Product; competitors: Competitor[]; coverage: ReviewCoverage[]; bar: BarOf; onError: (message: string) => void }) {
  const [target, setTarget] = useState<string | null | undefined>(undefined);
  const [reviews, setReviews] = useState<StoredReview[] | null>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (target === undefined) return;
    setReviews(null);
    list.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    let live = true;
    runs.reviews(runId, target, 30).then(
      (r) => {
        if (live) setReviews(r.reviews);
      },
      (e: Error) => {
        if (!live) return;
        setReviews([]);
        onError(e.message);
      },
    );
    return () => {
      live = false;
    };
  }, [runId, target, onError]);

  if (coverage.length === 0) return bar([]);
  const name = (competitorId: string | null) => {
    if (competitorId === null) return `${product.brand || product.name} (yours)`;
    const owner = competitors.find((c) => c.id === competitorId);
    return owner ? `${owner.brand} · ${owner.product_name}` : competitorId;
  };
  const logo = (competitorId: string | null) => {
    const owner = competitorId === null ? product : competitors.find((c) => c.id === competitorId);
    return owner?.logo_url ?? owner?.image_url ?? null;
  };
  const total = coverage.reduce((sum, row) => sum + Number(row.reviews), 0);
  const owners = [...new Set(coverage.map((row) => row.competitor_id))];
  const chips = owners.map((owner) => ({
    label: owner === null ? 'yours' : (competitors.find((c) => c.id === owner)?.brand ?? owner),
    value: coverage.filter((row) => row.competitor_id === owner).reduce((sum, row) => sum + Number(row.reviews), 0),
    onClick: () => setTarget(owner),
  }));

  return (
    <>
      {bar(chips)}
      <section className="panel">
        <h2>Reviews</h2>
        <p className="dim small">{total} reviews stored, lowest ratings first when you open a product.</p>
        <table className="coverage">
          <thead>
            <tr>
              <th>Product</th>
              <th>Source</th>
              <th>Reviews</th>
              <th>Average</th>
            </tr>
          </thead>
          <tbody>
            {coverage.map((row) => (
              <tr key={`${row.competitor_id}-${row.source}`} className={target === row.competitor_id ? 'selected' : ''} onClick={() => setTarget(row.competitor_id)}>
                <td>
                  <span className="title-line">
                    <BrandMark name={name(row.competitor_id)} src={logo(row.competitor_id)} size={20} />
                    {name(row.competitor_id)}
                  </span>
                </td>
                <td>{row.source === 'judgeme' ? 'Judge.me' : 'Amazon'}</td>
                <td>{row.reviews}</td>
                <td>{row.average_rating !== null ? Number(row.average_rating).toFixed(2) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div ref={list} className="review-list-head">
          {target === undefined ? (
            <p className="dim small">Click a product above to read its reviews.</p>
          ) : (
            <h3>
              Reviews of {name(target)} <span className="dim small">{reviews === null ? 'loading…' : `lowest rating first, ${reviews.length} shown`}</span>
            </h3>
          )}
        </div>
        {reviews !== null && (
          <ul className="review-list">
            {reviews.map((review) => (
              <li key={review.id}>
                <div className="small">
                  <Stars rating={review.rating} /> {review.title && <strong>{review.title}</strong>}{' '}
                  <span className="dim">
                    {review.source === 'judgeme' ? 'Judge.me' : 'Amazon'} · {review.review_date ?? 'undated'}
                    {review.verified ? ' · verified' : ''}
                    {review.helpful_votes > 0 ? ` · ${review.helpful_votes} found helpful` : ''}
                  </span>
                </div>
                <p>{review.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
