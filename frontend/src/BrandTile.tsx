import { useState } from 'react';

import type { BrandFolder } from './api';

export function BrandMark({ brand, size }: { brand: Pick<BrandFolder, 'label' | 'image_url'>; size: 'tile' | 'head' }) {
  const [broken, setBroken] = useState(false);
  if (brand.image_url && !broken) return <img className={`brand-mark ${size}`} src={brand.image_url} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  return <div className={`brand-mark ${size} letter`}>{brand.label.replace(/^https?:\/\//, '').charAt(0).toUpperCase()}</div>;
}

export default function BrandTile({ brand, onOpen }: { brand: BrandFolder; onOpen: () => void }) {
  return (
    <button className="brand-tile" onClick={onOpen}>
      <BrandMark brand={brand} size="tile" />
      <span className="brand-tile-name">{brand.label}</span>
      <span className="muted small">
        {brand.products.length === 0 ? 'chat only' : `${brand.products.length} product${brand.products.length === 1 ? '' : 's'}`}
        {brand.latest_status && <span className={`status ${brand.latest_status}`}>{brand.latest_status}</span>}
      </span>
    </button>
  );
}
