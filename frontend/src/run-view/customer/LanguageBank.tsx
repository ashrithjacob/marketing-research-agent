import { FUNCTION_WORDS, type Quote, type StagePacket } from '../../api';
import { QuoteLine } from './QuoteLine';

/** Customers' own words, sorted by what they do, each as they wrote it. */
export function LanguageBank({ runId, packet }: { runId: string; packet: StagePacket }) {
  const quotes = packet.quotes ?? [];
  const functions = Object.keys(FUNCTION_WORDS) as Quote['function'][];
  return (
    <div className="language-bank">
      {functions.map((fn) => {
        const kept = quotes.filter((q) => q.function === fn);
        return (
          <section key={fn}>
            <h4>
              {FUNCTION_WORDS[fn]} <span className="muted small">{kept.length}</span>
            </h4>
            {kept.length === 0 ? <p className="muted small">None recorded.</p> : kept.map((q) => <QuoteLine key={q.id} runId={runId} quote={q} />)}
          </section>
        );
      })}
    </div>
  );
}
