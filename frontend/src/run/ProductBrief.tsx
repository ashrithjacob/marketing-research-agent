import type { Product } from '../api';
import { Source } from './badges';

export default function ProductBrief({ product }: { product: Product }) {
  if (!product.key_active) return null;
  return (
    <section className="panel brief">
      <h2>Product brief</h2>
      <p className="dim">
        {product.category} · {product.form_factor?.replace('_', ' ')} · key active: <strong>{product.key_active}</strong>
      </p>
      <dl className="facts">
        <dt>Price</dt>
        <dd>{product.price ? <>{product.price.amount} {product.price.currency} <Source url={product.price.source_url} /></> : <span className="dim">not shown on any page read</span>}</dd>
        <dt>Offer</dt>
        <dd>
          {product.offer && [...product.offer.bundles, product.offer.subscription, product.offer.guarantee].filter(Boolean).join(' · ')}
          {product.offer && <Source url={product.offer.source_url} />}
        </dd>
      </dl>
      <h3>Ingredients</h3>
      <table className="ingredients">
        <tbody>
          {product.ingredients.map((ingredient) => (
            <tr key={ingredient.name}>
              <td>{ingredient.name}</td>
              <td>{ingredient.dose !== null ? `${ingredient.dose} ${ingredient.unit ?? ''}` : <span className="dim">dose not printed</span>}</td>
              <td>
                <Source url={ingredient.source_url} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Claims on the page</h3>
      <ul className="claims">
        {product.claims_on_page.map((claim) => (
          <li key={claim.text}>
            “{claim.text}” <Source url={claim.source_url} />
          </li>
        ))}
      </ul>
    </section>
  );
}
