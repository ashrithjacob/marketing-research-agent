import type { ReactNode } from 'react';

import { adsShape, type AdFilter, type AdsAnalysis } from '../../api';

export interface StepInfo {
  step: number;
  title: string;
  question: string;
}

export const STEPS: StepInfo[] = [
  { step: 1, title: 'Who this market pays to reach', question: 'Which buyers the ads chase, against who actually buys' },
  { step: 2, title: 'Proven, not just popular', question: 'Angles whose ads still run after a month and get duplicated' },
  { step: 3, title: 'What competitors are doubling down on', question: 'Angles brands keep launching new ads on' },
  { step: 4, title: 'What proven ads do that the rest don\'t', question: 'Proof, offer, landing page and structure, proven against the rest' },
  { step: 5, title: 'Can you run it', question: 'Each angle against the claims you already make' },
  { step: 6, title: 'What to test next', question: 'Test cards built from the steps above' },
];

export default function StepHead({ info, analysis, onFilter, waiting, children }: { info: StepInfo; analysis: AdsAnalysis; onFilter: (filter: AdFilter) => void; waiting?: string; children?: ReactNode }) {
  const finding = analysis.findings.find((f) => f.step === info.step);
  return (
    <section id={`ads-step-${info.step}`} className="panel ads-step">
      <h2>
        <span className="step-n">{info.step}</span> {info.title}
      </h2>
      <p className="dim small">{info.question}</p>
      {waiting && <p className="dim">{waiting}</p>}
      {finding && (
        <div className="finding">
          <p className="finding-headline">{finding.headline}</p>
          <ul className="finding-facts small">
            {finding.subjects.map((subject) => {
              const facts = adsShape.facts(subject, analysis);
              return facts ? <li key={subject}>{facts}</li> : null;
            })}
          </ul>
          {finding.ad_ids.length > 0 && (
            <button className="ghost small" onClick={() => onFilter({ ids: finding.ad_ids.join(',') })}>
              See the {finding.ad_ids.length} ads behind this
            </button>
          )}
        </div>
      )}
      {!finding && !waiting && <p className="dim small">No finding written for this step yet: the counts below are the evidence.</p>}
      {children}
    </section>
  );
}
