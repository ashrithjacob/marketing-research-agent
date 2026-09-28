import { useState } from 'react';
import { productIssue, quotesFor, type Issue, type ProductVoice, type ReviewAnalysis } from '../../api';
import { Quotes } from './Quotes';

export function IssueGrid({
  analysis,
  products,
  columns,
}: {
  analysis: ReviewAnalysis;
  products: ProductVoice[];
  columns: Issue[];
}) {
  const [picked, setPicked] = useState<{ product: string; issue: string } | null>(null);
  const maxShare = Math.max(
    ...products.flatMap((product) =>
      columns.map((issue) => productIssue(product, issue.id)?.share ?? 0),
    ),
    0,
  );
  if (columns.length === 0) return <p className="muted">No complaints to compare.</p>;
  const pickedProduct = products.find((p) => p.target_id === picked?.product);
  const pickedIssue = columns.find((c) => c.id === picked?.issue);
  const pickedCell = pickedProduct && pickedIssue ? productIssue(pickedProduct, pickedIssue.id) : undefined;

  return (
    <div className="issue-grid-wrap">
      <div className="issue-grid" style={{ gridTemplateColumns: `minmax(120px, 1.3fr) repeat(${columns.length}, minmax(64px, 1fr))` }}>
        <span />
        {columns.map((issue) => (
          <span key={issue.id} className="grid-col" title={issue.description}>
            {issue.label}
          </span>
        ))}
        {products.map((product) => (
          <div key={product.target_id} className="grid-row">
            <span className="grid-name" title={product.name}>
              {product.name}
              <small>{product.relation === 'product' ? 'main product' : product.relation}</small>
            </span>
            {columns.map((issue) => {
              const cell = productIssue(product, issue.id);
              const share = cell?.share ?? 0;
              const active = picked?.product === product.target_id && picked.issue === issue.id;
              const strength = maxShare > 0 ? share / maxShare : 0;
              return (
                <button
                  key={issue.id}
                  className={`grid-cell ${active ? 'active' : ''} ${strength > 0.55 ? 'strong' : ''}`}
                  style={{ background: `rgba(0, 82, 255, ${0.04 + strength * 0.8})` }}
                  disabled={!cell}
                  onClick={() => setPicked(active ? null : { product: product.target_id, issue: issue.id })}
                  title={cell ? `${cell.mentions} of ${product.complaints} complaints` : 'not raised'}
                >
                  {Math.round(share * 100)}%
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="muted">
        Each cell is that issue's share of the product's complaints. Darker means a bigger share.
        Click a cell for the reviews behind it.
      </p>
      {pickedProduct && pickedIssue && pickedCell && (
        <div className="grid-quotes">
          <b>
            {pickedProduct.name} · {pickedIssue.label}
          </b>{' '}
          <span className="muted">
            {pickedCell.mentions} of {pickedProduct.complaints} complaints
          </span>
          <Quotes quotes={quotesFor(analysis, pickedCell.quotes)} />
        </div>
      )}
    </div>
  );
}
