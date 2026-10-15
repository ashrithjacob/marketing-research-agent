import { useState, type FormEvent } from 'react';

import { brandsApi } from './api';
import { navigate, paths } from './route';

export default function NewBrandTile({ onError }: { onError: (message: string) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function start(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { key } = await brandsApi.open(text.trim());
      navigate(paths.brand(key));
    } catch (err) {
      onError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="brand-tile new" onSubmit={start}>
      <div className="brand-mark tile letter">+</div>
      <input placeholder="Paste a brand's site, or name a product" value={text} onChange={(e) => setText(e.target.value)} disabled={busy} />
      <button className="primary" type="submit" disabled={busy || !text.trim()}>
        Start
      </button>
    </form>
  );
}
