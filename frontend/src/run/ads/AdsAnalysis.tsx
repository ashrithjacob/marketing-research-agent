import type { ReadAd } from '../../api';
import { adDigest, AWARENESS, CATEGORIES, PAGE_KINDS } from './ad-digest';
import HeatGrid from './HeatGrid';
import StackedBars, { Legend, type Series } from './StackedBars';

const CATEGORY_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];
const series = (keys: string[], colors: string[]): Series[] => keys.map((key, i) => ({ key, color: colors[i]! }));

function Card({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="dg-card">
      <h3>{title}</h3>
      <p className="dg-note">{note}</p>
      {children}
    </div>
  );
}

export default function AdsAnalysis({ ads }: { ads: ReadAd[] }) {
  const d = adDigest.of(ads);
  const { client, buyer, promise } = d.takeaway;
  const categories = series(CATEGORIES, CATEGORY_COLORS);
  return (
    <div className="dg">
      <section className="panel dg-head">
        <p className="dg-take">
          {client && <>Lung-market ads speak mostly to <b>{client.label}</b> ({client.pct} of them). </>}
          {buyer && <>Same-buyer ads are led by <b>{buyer.label}</b> ({buyer.pct}). </>}
          {promise && <>The most used promise is “<b>{promise.label}</b>” ({promise.pct} of all).</>}
        </p>
        <div className="dg-tiles">
          <div><b>{d.ads}</b><span>ads analysed</span></div>
          <div><b>{d.copies}</b><span>distinct copies</span></div>
          <div><b>{d.clientAds}</b><span>direct competitor and same problem</span></div>
          <div><b>{d.buyerAds}</b><span>same buyer, other problems</span></div>
        </div>
        <p className="dg-note">General ads are left out. Bars count ads, not copies, so a copy run many times weighs more.{d.unread > 0 && ` ${d.unread} ads were not read and show as "Not read".`}{d.unsorted > 0 && ` ${d.unsorted} ads have no audience segment and show as "Not sorted".`}</p>
      </section>

      <h2 className="dg-h">Who the ads are written for</h2>
      <div className="dg-grid">
        <Card title="Lung market" note="The person each ad speaks to, split by whether it sells the same product or another one for the same problem.">
          <Legend series={categories.slice(0, 2)} />
          <StackedBars rows={d.clientSegments} series={categories.slice(0, 2)} labelOf={(r) => r.label} />
        </Card>
        <Card title="Same buyer, other problems" note="The condition each ad leads with. These are formats to borrow, aimed at the same age and awareness, not competition.">
          <StackedBars rows={d.buyerSegments} series={categories.slice(2)} labelOf={(r) => r.label} />
        </Card>
      </div>

      <h2 className="dg-h">What they promise</h2>
      <div className="dg-grid">
        <Card title="Value proposition" note="Each copy's one leading promise, the reason the reader should believe this product is different.">
          <Legend series={categories} />
          <StackedBars rows={d.promises} series={categories} labelOf={(r) => r.label} />
        </Card>
        <Card title="What lasts" note="Median days running of the ads behind each promise, then median duplicates. Advertisers keep running and copying what pays.">
          <StackedBars rows={d.lasting} series={[{ key: 'median days', color: 'var(--series-4)' }]} labelOf={(r) => r.label} />
        </Card>
      </div>
      <Card title="Audience × promise" note="Ads in each pairing. Darker means more ads; an empty cell is a pairing nobody runs.">
        <HeatGrid heat={d.heat} />
      </Card>

      <h2 className="dg-h">How they speak</h2>
      <div className="dg-grid">
        <Card title="Who is speaking" note="The Facebook page running the ad: the brand itself, a made-up community or outlet, a private person, or someone with a credential.">
          <Legend series={series(PAGE_KINDS, ['var(--series-1)', 'var(--series-5)', 'var(--series-3)', 'var(--series-4)'])} />
          <StackedBars rows={d.pages} series={series(PAGE_KINDS, ['var(--series-1)', 'var(--series-5)', 'var(--series-3)', 'var(--series-4)'])} share />
        </Card>
        <Card title="What the opening assumes" note="The awareness level the first lines assume, as stage 3's reader recorded it.">
          <Legend series={series(AWARENESS, ['var(--series-6)', 'var(--series-2)', 'var(--series-1)', 'var(--series-3)', 'var(--series-4)', 'var(--faint)'])} />
          <StackedBars rows={d.awareness} series={series(AWARENESS, ['var(--series-6)', 'var(--series-2)', 'var(--series-1)', 'var(--series-3)', 'var(--series-4)', 'var(--faint)'])} share />
        </Card>
      </div>
    </div>
  );
}
