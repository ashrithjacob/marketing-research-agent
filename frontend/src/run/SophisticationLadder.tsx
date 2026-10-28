import type { StepEvidence } from '../api';

export const STAGES: Record<number, { name: string; note: string }> = {
  1: { name: 'Plain claim', note: 'few competitors, plain benefit claims' },
  2: { name: 'Bigger claim', note: 'the same claim enlarged with numbers, speed, strength' },
  3: { name: 'Mechanism', note: 'ads explain a reason why it works' },
  4: { name: 'Mechanism war', note: 'rival named mechanisms, each made bigger' },
  5: { name: 'Identity', note: 'buyers tired of claims; story and identity win' },
};

const month = (date: string | null) => (date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : null);

function seen(step: StepEvidence): string {
  if (step.claims === 0) return 'no ads making this claim';
  const ads = `${step.ads} ad${step.ads === 1 ? '' : 's'}`;
  if (step.stage === 4) return `${step.claims} rival mechanisms · ${step.brands} brand${step.brands === 1 ? '' : 's'} · ${ads}`;
  return [ads, `${step.brands} brand${step.brands === 1 ? '' : 's'}`, month(step.first_seen) ? `since ${month(step.first_seen)}` : null].filter(Boolean).join(' · ');
}

export default function SophisticationLadder({ current, steps }: { current: number; steps: StepEvidence[] }) {
  return (
    <>
      <p className="small dim">
        Markets climb these five steps as competitors outbid each other's claims. The market sits on the highest step its ads have reached; the earlier steps are the history it climbed through, with the ads still making those claims today.
      </p>
      <ol className="soph-scale">
        {steps.map((step) => {
          const state = step.stage === current ? 'current' : step.stage < current ? 'passed' : 'ahead';
          return (
            <li key={step.stage} className={`soph-step ${state}`} title={STAGES[step.stage]!.note}>
              <span className="soph-name">{step.stage}. {STAGES[step.stage]!.name}</span>
              <span className="soph-state">{state === 'current' ? 'the market is here' : state === 'passed' ? 'passed' : 'not reached'}</span>
              <span className="soph-seen">{seen(step)}</span>
            </li>
          );
        })}
      </ol>
    </>
  );
}
