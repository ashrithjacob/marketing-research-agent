import type { ShopTraction } from '../api';
import { compact, usd } from '../format';

export function salesOf(traction: ShopTraction | null): number {
  return traction?.monthly_sales_usd ?? -1;
}

export default function Traction({ traction }: { traction: ShopTraction | null }) {
  if (!traction) return <span className="dim small">no shop data</span>;
  const sales = traction.monthly_sales_usd;
  const range = traction.monthly_sales_min_usd !== null && traction.monthly_sales_max_usd !== null ? `estimate ${usd(traction.monthly_sales_min_usd)}–${usd(traction.monthly_sales_max_usd)}` : 'estimate';
  const rank =
    traction.single_product
      ? 'its only product'
      : traction.product_rank !== null
        ? `#${traction.product_rank} of ${traction.products_count} products`
        : `not in the shop's top ${traction.ranked_within}`;
  return (
    <span className="traction" title={`TrendTrack sales tracker, last 30 days; ${range}. Sales are for the whole shop.`}>
      <span className="value">{sales !== null ? `${usd(sales)}/mo` : 'not tracked'}</span>
      <span className="label">{traction.single_product ? 'product sales' : 'shop sales'} · {rank}</span>
      {traction.monthly_visits !== null && <span className="label">{compact(traction.monthly_visits)} visits/mo</span>}
    </span>
  );
}
