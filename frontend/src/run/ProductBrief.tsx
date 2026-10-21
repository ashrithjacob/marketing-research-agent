import type { Pack, Product } from '../api';
import { Source } from './badges';

function packLine(pack: Pack): string {
  return [
    pack.net_contents && `${pack.net_contents.amount} ${pack.net_contents.unit}`,
    pack.serving_size && `${pack.serving_size.amount} ${pack.serving_size.unit} a serving`,
    pack.servings_per_container !== null && `${pack.servings_per_container} servings`,
    pack.servings_per_day !== null && `${pack.servings_per_day} a day`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function Prices({ product }: { product: Product }) {
  if (product.price_points.length === 0) return null;
  const servings = product.pack?.servings_per_container ?? null;
  return (
    <>
      <h3 id="brief-prices">Prices</h3>
      <table className="ingredients">
        <tbody>
          {product.price_points.map((point) => (
            <tr key={`${point.label}-${point.amount}`}>
              <td>
                {point.label} {point.subscription && <span className="badge faint">subscription</span>}
              </td>
              <td>{point.units === 1 ? '1 container' : `${point.units} containers`}</td>
              <td>
                {point.amount} {point.currency}
              </td>
              <td className="dim">{servings ? `${(point.amount / (point.units * servings)).toFixed(2)} a serving` : ''}</td>
              <td>
                <Source url={point.source_url} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function ProductBrief({ product }: { product: Product }) {
  if (!product.key_active) return null;
  const terms = product.subscription_terms;
  return (
    <section className="panel brief">
      <h2>Product brief</h2>
      <p className="dim">
        {product.category} · {product.form_factor?.replace('_', ' ')} · key active: <strong>{product.key_active}</strong>
      </p>
      <dl className="facts">
        <dt>Price</dt>
        <dd>{product.price ? <>{product.price.amount} {product.price.currency} <Source url={product.price.source_url} /></> : <span className="dim">not shown on any page read</span>}</dd>
        <dt>Pack</dt>
        <dd>{product.pack ? <>{packLine(product.pack) || <span className="dim">not printed</span>} <Source url={product.pack.source_url} /></> : <span className="dim">not found</span>}</dd>
        {product.pack?.directions_as_printed && (
          <>
            <dt>Directions</dt>
            <dd>“{product.pack.directions_as_printed}”</dd>
          </>
        )}
        <dt>Offer</dt>
        <dd>
          {product.offer && [...product.offer.bundles, product.offer.subscription, product.offer.guarantee].filter(Boolean).join(' · ')}
          {product.offer && <Source url={product.offer.source_url} />}
        </dd>
        {terms && (
          <>
            <dt>Subscription</dt>
            <dd>
              {[terms.frequency, terms.minimum_orders !== null && `at least ${terms.minimum_orders} orders`, terms.how_to_cancel && `cancel: ${terms.how_to_cancel}`].filter(Boolean).join(' · ')} <Source url={terms.source_url} />
            </dd>
          </>
        )}
        <dt>Lab test</dt>
        <dd>{product.coa_url ? <Source url={product.coa_url} label="certificate of analysis" /> : <span className="dim">no certificate of analysis found</span>}</dd>
      </dl>
      <Prices product={product} />
      <h3 id="brief-ingredients">Ingredients</h3>
      <table className="ingredients">
        <tbody>
          {product.ingredients.map((ingredient) => (
            <tr key={ingredient.name}>
              <td>
                {ingredient.name} {ingredient.in_proprietary_blend && <span className="badge faint">in a blend</span>}
                {(ingredient.form || ingredient.standardisation) && <div className="dim small">{[ingredient.form, ingredient.standardisation].filter(Boolean).join(' · ')}</div>}
              </td>
              <td>{ingredient.dose !== null ? `${ingredient.dose} ${ingredient.unit ?? ''}` : <span className="dim">dose not printed</span>}</td>
              <td>
                <Source url={ingredient.source_url} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 id="brief-claims">Claims on the page</h3>
      <ul className="claims">
        {product.claims_on_page.map((claim) => (
          <li key={claim.text}>
            “{claim.text}” <Source url={claim.source_url} />
          </li>
        ))}
      </ul>
      {product.miscellaneous.length > 0 && (
        <>
          <h3 id="brief-other">Also on the page</h3>
          <dl className="facts wide">
            {product.miscellaneous.map((fact) => (
              <div key={`${fact.label}-${fact.value}`} className="contents">
                <dt>{fact.label}</dt>
                <dd>
                  {fact.value} <Source url={fact.source_url} />
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
