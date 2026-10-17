import { quotesById, type Avatar, type StagePacket } from '../../api';
import { CitedQuotes } from './QuoteLine';

const BLAME: Record<Avatar['blame'], string> = { outward: 'blames something outside them', inward: 'blames themselves', mixed: 'blames both' };

function AvatarCard({ runId, avatar, subs, packet }: { runId: string; avatar: Avatar; subs: Avatar[]; packet: StagePacket }) {
  const quotes = quotesById(packet);
  return (
    <div className="avatar-card">
      <div className="avatar-head">
        <h4>{avatar.name}</h4>
        <span className="muted small">
          {avatar.proxy ? 'buys for someone else · ' : ''}
          {avatar.provenance}
        </span>
      </div>
      <dl className="avatar-axes">
        <dt>What is happening</dt>
        <dd>{avatar.situation}</dd>
        <dt>What they tried</dt>
        <dd>{avatar.history}</dd>
        <dt>Who they are</dt>
        <dd>{avatar.demographics}</dd>
        <dt>Pains</dt>
        <dd>{avatar.pains.join(' · ')}</dd>
        <dt>Wants</dt>
        <dd>{avatar.outcomes.join(' · ')}</dd>
        {avatar.objections.length > 0 && (
          <>
            <dt>Objections</dt>
            <dd>{avatar.objections.join(' · ')}</dd>
          </>
        )}
        <dt>How they see themselves</dt>
        <dd>{avatar.identity}</dd>
        <dt>What the problem gives them</dt>
        <dd>{avatar.secondary_gain}</dd>
        <dt>Blame</dt>
        <dd>{BLAME[avatar.blame]}</dd>
      </dl>
      <CitedQuotes runId={runId} ids={avatar.quote_ids} quotes={quotes} provenance={avatar.provenance} />
      {subs.length > 0 && (
        <div className="sub-avatars">
          <p className="muted small">Sub-avatars</p>
          {subs.map((sub) => (
            <details key={sub.id} className="sub-avatar">
              <summary>
                <b>{sub.name}</b> <span className="muted small">{sub.situation}</span>
              </summary>
              <p className="small">
                Tried: {sub.history} · Pains: {sub.pains.join(', ')} · Wants: {sub.outcomes.join(', ')}
              </p>
              <CitedQuotes runId={runId} ids={sub.quote_ids} quotes={quotes} provenance={sub.provenance} />
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

/** The avatars, each with its sub-avatars and the customers' words it rests on. */
export function AvatarCards({ runId, packet }: { runId: string; packet: StagePacket }) {
  const avatars = packet.avatars ?? [];
  const top = avatars.filter((a) => !a.parent);
  const proxy = packet.attributes.find((a) => a.node === 'avatars' && a.key === 'proxy_buying');
  if (top.length === 0) return <p className="muted">No avatars were recorded.</p>;
  return (
    <div className="avatar-cards">
      {proxy && <p className="muted small">Buying for someone else: {proxy.value}</p>}
      {top.map((avatar) => (
        <AvatarCard key={avatar.id} runId={runId} avatar={avatar} subs={avatars.filter((a) => a.parent === avatar.id)} packet={packet} />
      ))}
    </div>
  );
}
