import { IDENTITY_WORDS, quotesById, type StagePacket } from '../../api';
import { CitedQuotes } from './QuoteLine';

/** What sits under the words: labels, guilt, loss and feared identity, each with the voices that show it; then each major pain's emotional profile. */
export function IdentityLayer({ runId, packet }: { runId: string; packet: StagePacket }) {
  const quotes = quotesById(packet);
  const entries = packet.identity_entries ?? [];
  const profiles = packet.pain_profiles ?? [];
  return (
    <div className="identity-layer">
      {Object.entries(IDENTITY_WORDS).map(([kind, title]) => {
        const kept = entries.filter((e) => e.kind === kind);
        if (kept.length === 0) return null;
        return (
          <section key={kind}>
            <h4>{title}</h4>
            {kept.map((entry, i) => (
              <div key={i} className="identity-entry">
                <p>{entry.summary}</p>
                <CitedQuotes runId={runId} ids={entry.quote_ids} quotes={quotes} provenance={entry.provenance} />
              </div>
            ))}
          </section>
        );
      })}
      {profiles.length > 0 && (
        <section>
          <h4>How each major pain feels</h4>
          <table className="pain-profiles small">
            <thead>
              <tr>
                <th>Pain</th>
                <th>Emotion</th>
                <th>Intensity</th>
                <th>How long</th>
                <th>Who sees it</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.pain}>
                  <td>{p.pain}</td>
                  <td>{p.emotion}</td>
                  <td>{p.intensity}</td>
                  <td>{p.duration}</td>
                  <td>{p.social}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
