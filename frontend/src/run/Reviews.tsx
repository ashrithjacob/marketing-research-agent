import { useEffect, useState } from 'react';

import { runs, type Competitor, type Product, type ReviewCoverage, type StoredReview } from '../api';

function Stars({ rating }: { rating: number }) {
  return <span className="stars">{'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}</span>;
}

export default function Reviews({ runId, product, competitors, version, onError }: { runId: string; product: Product; competitors: Competitor[]; version: string; onError: (message: string) => void }) {
  const [coverage, setCoverage] = useState<ReviewCoverage[]>([]);
  const [target, setTarget] = useState<string | null | undefined>(undefined);
  const [reviews, setReviews] = useState<StoredReview[]>([]);

  useEffect(() => {
    runs.reviews(runId, null, 1).then((r) => setCoverage(r.coverage), (e: Error) => onError(e.message));
  }, [runId, version, onError]);

  useEffect(() => {
    if (target === undefined) return;
    runs.reviews(runId, target, 30).then((r) => setReviews(r.reviews), (e: Error) => onError(e.message));
  }, [runId, target, onError]);

  if (coverage.length === 0) return null;
  const name = (competitorId: string | null) => (competitorId === null ? `${product.name} (yours)` : (competitors.find((c) => c.id === competitorId)?.brand ?? competitorId));
  const total = coverage.reduce((sum, row) => sum + row.reviews, 0);

  return (
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
              <td>{name(row.competitor_id)}</td>
              <td>{row.source === 'judgeme' ? 'Judge.me' : 'Amazon'}</td>
              <td>{row.reviews}</td>
              <td>{row.average_rating !== null ? Number(row.average_rating).toFixed(2) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {target !== undefined && (
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
  );
}
