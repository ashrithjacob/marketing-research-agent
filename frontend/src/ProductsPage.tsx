import type { ProductSummary } from './api';
import { Link, paths } from './route';

export default function ProductsPage({ products }: { products: ProductSummary[] | null }) {
  if (products === null) return <div className="empty">Loading products…</div>;
  if (products.length === 0) {
    return (
      <div className="empty intro">
        <h2>No products yet</h2>
        <p>
          Press <b>Start run</b>. A product name and a market is the whole brief — finding the
          URLs is the agent&apos;s job. Every run of the same product lands in one folder here.
        </p>
      </div>
    );
  }
  return (
    <div className="products-page">
      <h2>Products</h2>
      <div className="product-grid">
        {products.map((p) => (
          <Link key={p.id} to={paths.product(p.id)} className="product-card">
            <div className="product-card-top">
              <span className="product-card-title">{p.label}</span>
              <span className={`status ${p.latest_status}`}>{p.latest_status}</span>
            </div>
            <div className="product-card-stats">
              <span>
                <b>{p.run_count}</b> run{p.run_count === 1 ? '' : 's'}
              </span>
              <span>
                <b>{p.review_count}</b> review{p.review_count === 1 ? '' : 's'}
              </span>
            </div>
            <div className="product-card-when">
              last run {new Date(p.latest_at).toLocaleString()}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
