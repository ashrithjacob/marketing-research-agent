import { useState } from 'react';

import { factText, marketWord, type AttributeRecord, type StagePacket } from '../../api';
import { FactValue } from '../fact-value';
import { MarginInput } from './MarginInput';

const CRITERIA: { key: string; label: string; asks: string }[] = [
  { key: 'size', label: 'Market size', asks: 'Is the reachable market big enough?' },
  { key: 'margin', label: 'Margin', asks: 'Does the margin leave room to win customers?' },
  { key: 'mechanism_availability', label: 'Angle', asks: 'Is there an angle not already taken?' },
  { key: 'claim_room', label: 'Claims', asks: 'Can ads still say something worth saying?' },
  { key: 'structural_churn', label: 'Churn', asks: 'Does a bottle last until it works?' },
];

const VERDICTS: Record<string, { word: string; means: string }> = {
  go: { word: 'Go', means: 'Worth going on, as the product is positioned now.' },
  reposition: { word: 'Reposition', means: 'Worth going on only with a change: a different customer, form, or way of framing the problem.' },
  drop: { word: 'Drop', means: 'Not worth going on in this market as it stands.' },
};

const shown = (row: AttributeRecord) => row.reads_as || row.value;
const firstWord = (value: string) => value.trim().toLowerCase().split(/[^a-z]+/)[0] ?? '';
const reasonOf = (value: string) => value.replace(/^\s*\w+\s*[—:,.-]*\s*/, '');
const firstSentence = (value: string) => {
  const text = factText(reasonOf(value)).preview;
  const cut = text.search(/[.;](\s|$)/);
  const sentence = cut > 0 ? text.slice(0, cut + 1) : text;
  return sentence.length > 180 ? `${sentence.slice(0, 177)}…` : sentence;
};

/** The viability gate at a glance: the verdict and what it means, which criteria pass, fail or are unknown, each in one line, with the full reasoning and its sources one click away. */
export function VerdictPanel({ runId, productId, packet }: { runId: string; productId: string; packet: StagePacket }) {
  const row = (key: string) => packet.attributes.find((a) => a.node === 'viability' && a.key === key);
  const verdict = row('verdict');
  const word = marketWord(packet, 'verdict');
  const [open, setOpen] = useState<string | null>(null);
  const judged = CRITERIA.map((c) => ({ ...c, found: row(c.key), result: row(c.key) ? firstWord(row(c.key)!.value) : '' }));
  const named = (result: string) => judged.filter((c) => c.result === result).map((c) => c.label.toLowerCase());
  const summary = [
    named('fail').length ? `Fails on ${named('fail').join(', ')}.` : '',
    named('unknown').length ? `Not known yet: ${named('unknown').join(', ')}.` : '',
    named('pass').length ? `Passes: ${named('pass').join(', ')}.` : '',
  ].filter(Boolean);
  return (
    <div className="verdict-panel">
      <div className={`verdict-head ${word}`}>
        <span className={`verdict big ${word}`}>{VERDICTS[word]?.word ?? 'No verdict'}</span>
        <div>
          <p className="verdict-means">{VERDICTS[word]?.means ?? 'The gate gave no verdict; see what it could not find below.'}</p>
          {summary.length > 0 && <p className="muted small">{summary.join(' ')}</p>}
        </div>
      </div>
      {verdict && (
        <details className="verdict-why" open={Boolean(verdict.sections?.length)}>
          <summary>Why the agent decided this</summary>
          <div className="verdict-why-body">
            {verdict.sections?.length ? (
              verdict.sections.map((section) => (
                <section key={section.title} className="verdict-section">
                  <h5>{section.title}</h5>
                  <FactValue value={section.text} runId={runId} sources={packet.sources} />
                </section>
              ))
            ) : (
              <FactValue value={reasonOf(shown(verdict))} runId={runId} sources={packet.sources} />
            )}
          </div>
        </details>
      )}
      <div className="criteria">
        {judged.map((c) => (
          <div key={c.key} className={`criterion-card ${c.result || 'none'}${open === c.key ? ' on' : ''}`}>
            <div className="criterion-top">
              <b>{c.label}</b>
              <span className={`criterion ${c.result || 'none'}`}>{c.result || 'not judged'}</span>
            </div>
            <p className="muted small">{c.asks}</p>
            {c.found && <p className="criterion-line">{firstSentence(shown(c.found))}</p>}
            {c.found && (
              <button className="linkish" onClick={() => setOpen(open === c.key ? null : c.key)}>
                {open === c.key ? 'Close ▴' : 'Read the reasoning ▾'}
              </button>
            )}
            {c.key === 'margin' && <MarginInput productId={productId} />}
          </div>
        ))}
      </div>
      {judged
        .filter((c) => c.key === open && c.found)
        .map((c) => (
          <div key={c.key} className="criterion-open">
            <h4>
              {c.label} <span className={`criterion ${c.result || 'none'}`}>{c.result}</span>
            </h4>
            <FactValue value={reasonOf(shown(c.found!))} runId={runId} sources={packet.sources} />
          </div>
        ))}
    </div>
  );
}
