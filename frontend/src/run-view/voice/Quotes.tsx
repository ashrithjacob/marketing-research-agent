import type { IssueQuote } from '../../api';

export function Quotes({ quotes }: { quotes: IssueQuote[] }) {
  if (quotes.length === 0) return <p className="muted">No quotes.</p>;
  return (
    <div className="voice-quotes">
      {quotes.map((quote) => (
        <div key={quote.ref} className="item">
          <div className="q">
            {quote.star != null && <span className="pill star">{quote.star}★</span>}{' '}
            {quote.title && <b>{quote.title}. </b>}“{quote.text}”
          </div>
          <div className="src">
            {quote.platform}
            {/^https?:\/\//.test(quote.locator) && (
              <>
                {' · '}
                <a href={quote.locator} target="_blank" rel="noreferrer">
                  open review ↗
                </a>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
