import { useState } from 'react';

import type { AvatarQuote, StoredAvatar } from '../api';
import ProfileList from './ProfileList';

const SKEPTICISM: Record<number, string> = { 1: 'beginner', 2: 'explorer', 3: 'researcher', 4: 'skeptic', 5: 'hopeless' };
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="tile">
      <strong className="tile-value">{value}</strong>
      <span className="small dim">{label}</span>
    </div>
  );
}

function SubAvatars({ subs, total, onOpen }: { subs: StoredAvatar[]; total: number; onOpen: (id: string) => void }) {
  return (
    <section className="detail-block">
      <h3>Sub-avatars</h3>
      <ul className="sub-rows">
        {subs.map((sub) => (
          <li key={sub.id}>
            <button className={`sub-row standing-${sub.standing}`} onClick={() => onOpen(sub.id)}>
              <span className="sub-name">{sub.name}{sub.standing === 'emerging' && <span className="badge">emerging</span>}</span>
              <span className="gap-bar"><span style={{ width: pct(sub.review_count / Math.max(1, total)), background: 'var(--series-1)' }} /></span>
              <span className="small dim">{sub.review_count} reviews</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Quotes({ quotes }: { quotes: AvatarQuote[] }) {
  const [all, setAll] = useState(false);
  const own = quotes.filter((q) => q.kind === 'quote');
  if (own.length === 0) return null;
  return (
    <section className="detail-block">
      <h3>In their words</h3>
      <ul className="quotes">
        {(all ? own : own.slice(0, 2)).map((quote) => (
          <li key={quote.review_id} className="small">“{quote.body}” <span className="dim">{quote.rating}★ {quote.source === 'judgeme' ? 'Judge.me' : 'Amazon'}</span></li>
        ))}
      </ul>
      {own.length > 2 && <button className="link small" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `+${own.length - 2} more quotes`}</button>}
    </section>
  );
}

function More({ avatar }: { avatar: StoredAvatar }) {
  const channels = Object.entries(avatar.profile.awareness_by_channel ?? {}).filter(([, levels]) => levels && Object.keys(levels).length > 0);
  if (!avatar.profile.best_competitor_angle && channels.length === 0 && avatar.profile.outcomes.length === 0) return null;
  return (
    <details className="detail-block">
      <summary>More: outcomes, competitors' best angle, awareness counts</summary>
      <ProfileList label="Outcomes" items={avatar.profile.outcomes} />
      {avatar.profile.best_competitor_angle && <p className="small"><span className="dim">Competitors' best angle:</span> {avatar.profile.best_competitor_angle}</p>}
      {channels.map(([channel, levels]) => (
        <p key={channel} className="small">
          <span className="dim">{channel === 'meta_ads' ? 'Its ads open' : 'Its reviews'}:</span> {Object.entries(levels ?? {}).map(([level, n]) => `${n} ${level.replace('_', ' ')}`).join(', ')}
        </p>
      ))}
    </details>
  );
}

export default function AvatarDetail({ avatar, parent, subs, quotes, onOpen, onBack }: { avatar: StoredAvatar; parent: StoredAvatar | null; subs: StoredAvatar[]; quotes: AvatarQuote[]; onOpen: (id: string) => void; onBack: () => void }) {
  const skepticism = avatar.profile.skepticism;
  return (
    <section className="panel avatar-detail">
      <nav className="crumbs small" aria-label="Breadcrumb">
        <button className="link" onClick={onBack}>All avatars</button>
        {parent && <> › <button className="link" onClick={() => onOpen(parent.id)}>{parent.name}</button></>}
        {' › '}<span>{avatar.name}</span>
      </nav>
      <div className="competitor-head">
        <h2>{avatar.name}</h2>
        {avatar.standing === 'emerging' && <span className="badge">emerging</span>}
        {avatar.awareness && <span className="badge faint">{avatar.awareness.replace('_', ' ')}</span>}
        {avatar.confidence && <span className="badge faint">{avatar.confidence} confidence</span>}
      </div>
      <p>{avatar.description}</p>
      <div className="tiles">
        <Stat value={avatar.review_count} label={`reviews, ${pct(avatar.demand_share)} of demand`} />
        <Stat value={avatar.ad_count} label={`ads, ${pct(avatar.supply_share)} of supply`} />
        <Stat value={pct(avatar.win_rate)} label="of its ads winning" />
        <Stat value={skepticism ? `${skepticism}/5` : '—'} label={skepticism ? `skepticism, ${SKEPTICISM[skepticism]}` : 'skepticism'} />
      </div>
      {subs.length > 0 && <SubAvatars subs={subs} total={avatar.review_count} onOpen={onOpen} />}
      <div className="profile-grid">
        <ProfileList label="Pains" items={avatar.profile.pains} />
        <ProfileList label="Desires" items={avatar.profile.desires} />
        <ProfileList label="Triggers" items={avatar.profile.triggers} />
        <ProfileList label="Objections" items={avatar.profile.objections} />
        <ProfileList label="Tried before" items={avatar.profile.prior_solutions} />
        <ProfileList label="Angles" items={avatar.profile.angles} />
      </div>
      <Quotes quotes={quotes} />
      <More avatar={avatar} />
    </section>
  );
}
