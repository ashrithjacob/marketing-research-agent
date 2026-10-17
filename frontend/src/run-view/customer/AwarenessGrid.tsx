import { CHANNEL_WORDS, LEVEL_WORDS, type AwarenessLevel, type StagePacket } from '../../api';

const LEVELS = Object.keys(LEVEL_WORDS) as AwarenessLevel[];

/** Per avatar, how aware they are when they arrive from each channel: the spread across the five levels, and the level to write for in bold. */
export function AwarenessGrid({ packet }: { packet: StagePacket }) {
  const rows = packet.awareness ?? [];
  const avatars = (packet.avatars ?? []).filter((a) => !a.parent);
  if (rows.length === 0) return <p className="muted">No awareness was recorded.</p>;
  return (
    <div className="awareness-grid">
      {avatars.map((avatar) => (
        <section key={avatar.id}>
          <h4>{avatar.name}</h4>
          <table className="small">
            <thead>
              <tr>
                <th>Arrives from</th>
                {LEVELS.map((level) => (
                  <th key={level}>{LEVEL_WORDS[level]}</th>
                ))}
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => r.avatar_id === avatar.id)
                .map((r) => (
                  <tr key={r.channel}>
                    <td>{CHANNEL_WORDS[r.channel] ?? r.channel}</td>
                    {LEVELS.map((level) => (
                      <td key={level} className={level === r.entry ? 'entry-level' : ''}>
                        {Math.round(r.weights[level] * 100)}%
                      </td>
                    ))}
                    <td className="muted">
                      {r.why}
                      {r.provenance === 'inferred' ? ' (inferred)' : ''}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
