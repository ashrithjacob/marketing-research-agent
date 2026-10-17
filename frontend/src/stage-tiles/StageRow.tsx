import { marketWord, STAGE_STORY, stageOverview, type RunDetail, type RunSummary, type StageNumber, type StagePacket } from '../api';
import StageStats from './StageStats';

const VERDICTS: Record<string, string> = { go: 'Go', reposition: 'Reposition', drop: 'Drop' };

export function Verdict({ word }: { word: string }) {
  if (!VERDICTS[word]) return null;
  return <span className={`verdict ${word}`}>{VERDICTS[word]}</span>;
}

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function StageRow({ stage, summary, run, onOpen, onAsk }: { stage: StageNumber; summary: RunSummary | null; run: RunDetail | null; onOpen: () => void; onAsk: () => void }) {
  const story = STAGE_STORY[stage];
  if (!summary) {
    return (
      <div className="stage-row-card empty">
        <div className="stage-row-main">
          <div className="stage-row-top">
            <span className="stage-title">{story.title}</span>
            <span className="muted small">Not run yet</span>
          </div>
          <p className="muted small">{story.about}.</p>
        </div>
        <button className="ghost" onClick={onAsk}>
          Run in chat
        </button>
      </div>
    );
  }
  return (
    <button className="stage-row-card" onClick={onOpen}>
      <div className="stage-row-main">
        <div className="stage-row-top">
          <span className="stage-title">{story.title}</span>
          <span className={`status ${summary.status}`}>{summary.status}</span>
          {stage === 4 && run?.packet && <Verdict word={marketWord(run.packet as StagePacket, 'verdict')} />}
          <span className="muted small">{when(summary.created_at)}</span>
        </div>
        {run ? <StageStats stats={stageOverview(stage, run).stats} /> : <p className="muted small">Loading…</p>}
      </div>
      <span className="stage-chevron" aria-hidden>
        ›
      </span>
    </button>
  );
}
