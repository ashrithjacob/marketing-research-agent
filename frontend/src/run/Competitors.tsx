import type { Competitor, Product, ReadAd, Relationship, ReviewCoverage } from '../api';
import BrandMark, { domainOf } from '../BrandMark';
import { Source } from './badges';
import Traction, { salesOf } from './Traction';

const GROUPS: { key: Relationship; title: string; note: string }[] = [
  { key: 'direct', title: 'Direct', note: 'same key active, same form' },
  { key: 'indirect', title: 'Indirect', note: 'same key active, another form' },
  { key: 'other', title: 'Context only', note: 'no key active on the label' },
];

function Row({ competitor, reviews, ads }: { competitor: Competitor; reviews: number; ads: ReadAd[] }) {
  const winning = ads.filter((ad) => ad.bucket === 'winning').length;
  return (
    <li className="competitor-row">
      <BrandMark name={competitor.brand} src={competitor.image_url} size={64} shape="square" />
      <div className="who">
        <div className="title-line">
          <BrandMark name={competitor.brand} src={competitor.logo_url} size={20} />
          <strong>{competitor.brand}</strong>
          {competitor.form_factor && <span className="badge">{competitor.form_factor.replace('_', ' ')}</span>}
        </div>
        <div className="small">{competitor.product_name}</div>
        <div className="dim small">
          <Source url={competitor.url} label={domainOf(competitor.url)} />
          {competitor.platform && ` · ${competitor.platform}`}
        </div>
      </div>
      <p className="small positioning">{competitor.positioning || <span className="dim">not profiled yet</span>}</p>
      <div className="metric">
        <span className="value">{competitor.price ? `${competitor.price.amount} ${competitor.price.currency}` : '—'}</span>
        <span className="label">price</span>
      </div>
      <Traction traction={competitor.traction} />
      <div className="metric">
        <span className="value">{reviews}</span>
        <span className="label">reviews</span>
      </div>
      <div className="metric">
        <span className="value">{ads.length}</span>
        <span className="label">{ads.length > 0 ? `ads · ${winning} winning` : 'ads'}</span>
      </div>
      <div className="ad-strip">
        {ads.filter((ad) => ad.media_url).slice(0, 3).map((ad) => (
          <img key={ad.id} src={ad.media_url!} alt="" loading="lazy" referrerPolicy="no-referrer" title={ad.reading?.avatar ?? ad.advertiser} />
        ))}
      </div>
    </li>
  );
}

export default function Competitors({ product, competitors, coverage, ads }: { product: Product; competitors: Competitor[]; coverage: ReviewCoverage[]; ads: ReadAd[] }) {
  if (competitors.length === 0) return null;
  const reviewsOf = (id: string) => coverage.filter((row) => row.competitor_id === id).reduce((sum, row) => sum + Number(row.reviews), 0);
  const unprofiled = competitors.filter((c) => c.relationship === null);
  return (
    <section id="competitors" className="panel flush">
      <div className="panel-head">
        <h2>Competitors</h2>
        <span className="dim small">Classified by code from each product page, against {product.key_active || 'the key active'} in {product.form_factor?.replace('_', ' ') ?? 'its form'}. Ordered by TrendTrack's estimated monthly sales; Amazon listings have none.</span>
      </div>
      {GROUPS.map((group) => {
        const members = competitors.filter((c) => c.relationship === group.key).sort((a, b) => salesOf(b.traction) - salesOf(a.traction) || (b.traction?.monthly_visits ?? -1) - (a.traction?.monthly_visits ?? -1));
        if (members.length === 0) return null;
        return (
          <div key={group.key} className="group">
            <h3 className="pad">
              {group.title} <span className="dim small">({members.length}, {group.note})</span>
            </h3>
            <ul className="competitor-rows">
              {members.map((c) => (
                <Row key={c.id} competitor={c} reviews={reviewsOf(c.id)} ads={ads.filter((ad) => ad.competitor_id === c.id)} />
              ))}
            </ul>
          </div>
        );
      })}
      {unprofiled.length > 0 && (
        <>
          <h3 id="competitors-unprofiled" className="pad">Not profiled yet</h3>
          <ul className="competitor-rows">
            {unprofiled.map((c) => (
              <Row key={c.id} competitor={c} reviews={reviewsOf(c.id)} ads={ads.filter((ad) => ad.competitor_id === c.id)} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
