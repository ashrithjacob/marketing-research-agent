import { useEffect, useState } from 'react';

import { api, type Config } from './api';
import { BrandMark } from './BrandTile';
import ChatPanel from './ChatPanel';
import { navigate, paths, type Route } from './route';
import ProductStages from './stage-tiles/ProductStages';
import StageView from './stage-tiles/StageView';
import { useBrands } from './use-brands';
import { useWorkspace } from './use-workspace';

const CHAT_OPEN = 'mra:chat-open';

function readChatOpen(): boolean {
  try {
    return localStorage.getItem(CHAT_OPEN) !== '0';
  } catch {
    return true;
  }
}

export default function BrandPage({ brandKey, stage, onError }: { brandKey: string; stage: Extract<Route, { page: 'brand' }>['stage']; onError: (message: string) => void }) {
  const brands = useBrands(onError);
  const { chat, board, connected } = useWorkspace(brandKey);
  const [config, setConfig] = useState<Config | null>(null);
  const [draft, setDraft] = useState({ text: '', n: 0 });
  const [chatOpen, setChatOpen] = useState(() => readChatOpen());
  const showChat = (open: boolean) => {
    setChatOpen(open);
    try {
      localStorage.setItem(CHAT_OPEN, open ? '1' : '0');
    } catch {
      return;
    }
  };
  useEffect(() => {
    api.config().then(setConfig).catch(() => undefined);
  }, []);
  const brand = brands?.find((b) => b.key === brandKey) ?? null;
  const label = brand?.label ?? brandKey.replace(/^(site|product):/, '');
  const products = brand?.products ?? [];
  const cards = (board?.cards ?? []).filter((card) => [brandKey, ''].includes(board?.card_brands[card.id] ?? ''));
  return (
    <div className={`home${chatOpen ? '' : ' chat-hidden'}`}>
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
              onAsk={(text) => (setDraft((d) => ({ text, n: d.n + 1 })), showChat(true))}
              onError={onError}
            />
          ))}
      </div>
      {chatOpen ? (
        <ChatPanel brand={brandKey} chat={chat} cards={cards} connected={connected} draft={draft} onHide={() => showChat(false)} onError={onError} />
      ) : (
        <button className="primary chat-open-btn" onClick={() => showChat(true)}>
          Chat{cards.filter((c) => c.status === 'open').length > 0 && <span className="chat-badge">{cards.filter((c) => c.status === 'open').length} waiting</span>}
        </button>
      )}
    </div>
  );
}
