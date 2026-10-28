import type { StoredAvatar } from '../api';
import StackedBar from './StackedBar';

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

function Row({ avatar, subs, max, onOpen }: { avatar: StoredAvatar; subs: StoredAvatar[]; max: number; onOpen: (id: string) => void }) {
  const own = Math.max(0, avatar.review_count - subs.reduce((n, s) => n + s.review_count, 0));
  return (
    <li className={`avatar-row standing-${avatar.standing}`}>
      <button className="avatar-name" onClick={() => onOpen(avatar.id)}>
        <strong>{avatar.name}</strong>
        <span className="small dim">{avatar.review_count} reviews{avatar.standing === 'emerging' ? ' · emerging' : ''}</span>
      </button>
      <StackedBar
        blocks={subs.length > 0 ? subs.map((sub) => ({ id: sub.id, label: sub.name, count: sub.review_count, emerging: sub.standing === 'emerging', onClick: () => onOpen(sub.id) })) : [{ id: avatar.id, label: avatar.name, count: avatar.review_count, onClick: () => onOpen(avatar.id) }]}
        width={avatar.review_count / max}
        rest={subs.length > 0 ? own : 0}
        restLabel="reviews in no sub-avatar"
        chips={subs.length > 0}
      />
      <div className="avatar-stats small">
        <span><strong>{pct(avatar.demand_share)}</strong> of reviews</span>
        <span><strong>{avatar.ad_count}</strong> ads · win {pct(avatar.win_rate)}</span>
      </div>
    </li>
  );
}

export default function AvatarOverview({ tops, subsOf, onOpen }: { tops: StoredAvatar[]; subsOf: (id: string) => StoredAvatar[]; onOpen: (id: string) => void }) {
  const sorted = [...tops].sort((a, b) => b.review_count - a.review_count);
  const max = Math.max(1, ...sorted.map((a) => a.review_count));
  const subCount = tops.reduce((n, a) => n + subsOf(a.id).length, 0);
  return (
    <section className="panel">
      <h2>Avatars from reviews</h2>
      <p className="small dim">
        {tops.length} buyer groups, {subCount} sub-avatars inside them. Bar length is reviews; each blue block is a sub-avatar, grey is reviews in none; one solid bar is an avatar without sub-avatars. Click a group, block or name to open it.
      </p>
      <ol className="avatar-bars">
        {sorted.map((avatar) => (
          <Row key={avatar.id} avatar={avatar} subs={subsOf(avatar.id)} max={max} onOpen={onOpen} />
        ))}
      </ol>
    </section>
  );
}
