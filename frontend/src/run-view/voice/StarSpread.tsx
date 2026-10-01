import type { ProductVoice } from '../../api';

const STAR_COLOURS = ['#dc2626', '#f97316', '#d97706', '#65a30d', '#059669'];

export function StarSpread({ products }: { products: ProductVoice[] }) {
  return (
    <div className="star-spread">
      {products.map((product) => {
        const total = product.stars.reduce((sum, n) => sum + n, 0);
        return (
          <div key={product.target_id} className="star-row">
            <span className="grid-name" title={product.name}>
              {product.name}
            </span>
            <span className="star-bar">
              {product.stars.map((count, index) =>
                count > 0 ? (
                  <i
                    key={index}
                    style={{ width: `${(count / Math.max(total, 1)) * 100}%`, background: STAR_COLOURS[index] }}
                    title={`${index + 1}★ · ${count} review${count === 1 ? '' : 's'}`}
                  >
                    {count / Math.max(total, 1) >= 0.08 ? `${index + 1}★` : ''}
                  </i>
                ) : null,
              )}
            </span>
            <span className="issue-count">{total}</span>
          </div>
        );
      })}
      <p className="muted">
        Share of each product's kept reviews at each star rating. Review mining asks for a fixed number
        per star, so this is the spread of what was mined, not of the listing.
      </p>
    </div>
  );
}
