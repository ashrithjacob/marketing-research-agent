import { api, type Quote } from '../../api';

/** One customer's words as they wrote them, with where they came from: a review's stars and date, or a link to the page it was copied from. */
export function QuoteLine({ runId, quote }: { runId: string; quote: Quote }) {
  const where = quote.review_ref
    ? `review${quote.star ? `, ${quote.star}★` : ''}${quote.posted_at ? `, ${quote.posted_at.slice(0, 10)}` : ''}`
    : null;
  return (
    <blockquote className="customer-quote">
      <p>“{quote.text}”</p>
      <footer className="muted small">
        {where ?? (
          <a href={api.sourceUrl(runId, quote.source_id)} target="_blank" rel="noreferrer">
            the page it was copied from ↗
          </a>
        )}
        {quote.buyer_stage && <span> · {quote.buyer_stage}</span>}
      </footer>
    </blockquote>
  );
}

/** The quotes a row cites, or, for a row no voice states, a plain note that it is a hypothesis. */
export function CitedQuotes({ runId, ids, quotes, provenance }: { runId: string; ids: string[]; quotes: Map<string, Quote>; provenance: 'evidenced' | 'inferred' }) {
  const found = ids.map((id) => quotes.get(id)).filter((q): q is Quote => Boolean(q));
  if (found.length === 0) return provenance === 'inferred' ? <p className="muted small">Inferred: no customer says this in so many words.</p> : null;
  return (
    <div className="cited-quotes">
      {found.map((q) => (
        <QuoteLine key={q.id} runId={runId} quote={q} />
      ))}
    </div>
  );
}
