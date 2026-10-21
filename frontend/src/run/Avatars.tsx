import { useEffect, useState } from 'react';

import { runs, type AvatarQuote, type StoredAvatar } from '../api';
import AvatarMap from './AvatarMap';
import type { BarOf } from './StageBar';

function List({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="small">
      <span className="dim">{label}:</span> {items.join(' · ')}
    </div>
  );
}

const SKEPTICISM: Record<number, string> = { 1: 'beginner', 2: 'explorer', 3: 'researcher', 4: 'skeptic', 5: 'hopeless' };

function ChannelCounts({ counts }: { counts: StoredAvatar['profile']['awareness_by_channel'] | undefined }) {
  const rows = Object.entries(counts ?? {}).filter(([, levels]) => levels && Object.keys(levels).length > 0);
  if (rows.length === 0) return null;
  return (
    <div className="small">
      <span className="dim">Awareness:</span>{' '}
      {rows.map(([channel, levels]) => `${channel === 'meta_ads' ? 'its ads open' : 'its reviews'} ${Object.entries(levels ?? {}).map(([level, n]) => `${n} ${level.replace('_', ' ')}`).join(', ')}`).join(' · ')}
    </div>
  );
}

function AvatarCard({ avatar, children, quotes }: { avatar: StoredAvatar; children: StoredAvatar[]; quotes: AvatarQuote[] }) {
  const share = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
  return (
    <li id={`avatar-${avatar.id}`} className={`avatar standing-${avatar.standing}`}>
      <div className="competitor-head">
        <strong>{avatar.name}</strong>
        {avatar.standing === 'emerging' && <span className="badge">emerging</span>}
        {avatar.awareness && <span className="badge faint">{avatar.awareness.replace('_', ' ')}</span>}
        {avatar.confidence && <span className="badge faint">{avatar.confidence} confidence</span>}
      </div>
      <p className="small">{avatar.description}</p>
      <div className="small dim">
        {avatar.review_count} reviews ({share(avatar.demand_share)} of demand) · {avatar.ad_count} ads ({share(avatar.supply_share)} of supply) · win rate {share(avatar.win_rate)}
      </div>
      <List label="Pains" items={avatar.profile.pains} />
      <List label="Desires" items={avatar.profile.desires} />
      <List label="Triggers" items={avatar.profile.triggers} />
      <List label="Tried before" items={avatar.profile.prior_solutions} />
      <List label="Objections" items={avatar.profile.objections} />
      <List label="Angles" items={avatar.profile.angles} />
      {avatar.profile.best_competitor_angle && <div className="small"><span className="dim">Competitors' best angle:</span> {avatar.profile.best_competitor_angle}</div>}
      {avatar.profile.skepticism !== null && avatar.profile.skepticism !== undefined && (
        <div className="small"><span className="dim">Skepticism:</span> {avatar.profile.skepticism} of 5, {SKEPTICISM[avatar.profile.skepticism]}</div>
      )}
      <ChannelCounts counts={avatar.profile.awareness_by_channel} />
      {quotes.length > 0 && (
        <ul className="quotes">
          {quotes.slice(0, 4).map((quote) => (
            <li key={quote.review_id} className="small">“{quote.body}” <span className="dim">{quote.rating}★ {quote.source === 'judgeme' ? 'Judge.me' : 'Amazon'}</span></li>
          ))}
        </ul>
      )}
      {children.length > 0 && <div className="small dim">Sub-avatars: {children.map((c) => `${c.name} (${c.review_count})`).join(', ')}</div>}
    </li>
  );
}

export default function Avatars({ runId, version, bar, onError }: { runId: string; version: string; bar: BarOf; onError: (message: string) => void }) {
  const [avatars, setAvatars] = useState<StoredAvatar[]>([]);
  const [quotes, setQuotes] = useState<AvatarQuote[]>([]);

  useEffect(() => {
    if (version !== 'completed') return;
    runs.avatars(runId).then((r) => {
      setAvatars(r.avatars);
      setQuotes(r.quotes);
    }, (e: Error) => onError(e.message));
  }, [runId, version, onError]);

  if (avatars.length === 0) return bar([]);
  const tops = avatars.filter((a) => a.parent_id === null);
  const share = (v: number | null) => (v === null ? '' : ` · ${Math.round(v * 100)}% of demand`);
  return (
    <>
      {bar(tops.map((avatar) => ({ label: avatar.name, value: `${avatar.review_count} reviews${share(avatar.demand_share)}`, target: `avatar-${avatar.id}` })))}
      <section className="panel">
        <h2>Avatars</h2>
        <AvatarMap avatars={avatars} />
        <ul className="cards avatars">
          {tops.map((avatar) => (
            <AvatarCard key={avatar.id} avatar={avatar} children={avatars.filter((a) => a.parent_id === avatar.id)} quotes={quotes.filter((q) => q.avatar_id === avatar.id)} />
          ))}
        </ul>
      </section>
    </>
  );
}
