import { useEffect, useState } from 'react';

import { api, type Config } from './api';
import { BrandMark } from './BrandTile';
import ChatPanel from './ChatPanel';
import { navigate, paths, type Route } from './route';
import ProductStages from './stage-tiles/ProductStages';
import StageView from './stage-tiles/StageView';
import { useBrands } from './use-brands';
import { useWorkspace } from './use-workspace';

export default function BrandPage({ brandKey, stage, onError }: { brandKey: string; stage: Extract<Route, { page: 'brand' }>['stage']; onError: (message: string) => void }) {
  const brands = useBrands(onError);
  const { chat, board, connected } = useWorkspace(brandKey);
  const [config, setConfig] = useState<Config | null>(null);
  const [draft, setDraft] = useState({ text: '', n: 0 });
  useEffect(() => {
    api.config().then(setConfig).catch(() => undefined);
  }, []);
  const brand = brands?.find((b) => b.key === brandKey) ?? null;
  const label = brand?.label ?? brandKey.replace(/^(site|product):/, '');
  const products = brand?.products ?? [];
  const cards = (board?.cards ?? []).filter((card) => [brandKey, ''].includes(board?.card_brands[card.id] ?? ''));
  return (
    <div className="home">
      <div className="side">
        <div className="brand-head">
          <button className="ghost" onClick={() => navigate(stage ? paths.brand(brandKey) : paths.home())}>
            ← {stage ? label : 'All brands'}
          </button>
          {brand && <BrandMark brand={brand} size="head" />}
          <h1>{label}</h1>
        </div>
        {stage && <StageView brandKey={brandKey} brandLabel={label} productId={stage.productId} stage={stage.n} tab={stage.tab} requiredFields={config?.required_fields ?? {}} onError={onError} />}
        {!stage && !brands && <p className="muted small">Loading…</p>}
        {!stage && brands && products.length === 0 && <p className="muted small">Nothing researched yet. Ask in the chat for this brand's market research.</p>}
        {!stage &&
          products.map((product) => (
            <ProductStages
              key={product.id}
              product={product}
              showLabel={products.length > 1}
              onOpen={(n) => navigate(paths.stage(brandKey, product.id, n))}
              onAsk={(text) => setDraft((d) => ({ text, n: d.n + 1 }))}
              onError={onError}
            />
          ))}
      </div>
      <ChatPanel brand={brandKey} chat={chat} cards={cards} connected={connected} draft={draft} onError={onError} />
    </div>
  );
}
