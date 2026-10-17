import type { Competitor, Product, Relationship } from '../api';
import { Source } from './badges';

const GROUPS: { key: Relationship; title: string; note: string }[] = [
  { key: 'direct', title: 'Direct', note: 'same key active, same form' },
  { key: 'indirect', title: 'Indirect', note: 'same key active, another form' },
  { key: 'other', title: 'Context only', note: 'no key active on the label' },
];

function Card({ competitor }: { competitor: Competitor }) {
  return (
    <li className="competitor">
      <div className="competitor-head">
        <strong>{competitor.brand}</strong>
        {competitor.form_factor && <span className="badge">{competitor.form_factor.replace('_', ' ')}</span>}
        {competitor.platform && <span className="badge faint">{competitor.platform}</span>}
      </div>
      <div className="dim small">{competitor.product_name}</div>
      {competitor.positioning && <p className="small">{competitor.positioning}</p>}
      <div className="small">
        {competitor.price && (
          <>
            {competitor.price.amount} {competitor.price.currency} ·{' '}
          </>
        )}
        {competitor.key_active && <>lists {competitor.key_active} · </>}
        <Source url={competitor.url} label="product page" />
      </div>
    </li>
  );
}

export default function Competitors({ product, competitors }: { product: Product; competitors: Competitor[] }) {
  if (competitors.length === 0) return null;
  const unprofiled = competitors.filter((c) => c.relationship === null);
  return (
    <section className="panel">
      <h2>Competitors</h2>
      <p className="dim small">Classified by code from what each product page shows, against {product.key_active} in {product.form_factor?.replace('_', ' ')}.</p>
      <div className="groups">
        {GROUPS.map((group) => {
          const members = competitors.filter((c) => c.relationship === group.key);
          return (
            <div key={group.key} className="group">
              <h3>
                {group.title} <span className="dim small">({members.length}, {group.note})</span>
              </h3>
              <ul className="cards">
                {members.map((c) => (
                  <Card key={c.id} competitor={c} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {unprofiled.length > 0 && (
        <p className="small dim">
          Not profiled yet: {unprofiled.map((c) => c.brand).join(', ')}
        </p>
      )}
    </section>
  );
}
