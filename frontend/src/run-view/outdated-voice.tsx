import { useState } from 'react';
import type { ResearchNode } from '../api';
import { VoiceAnalysis } from './voice/VoiceAnalysis';

/** A review-mining run whose stage 1 has since been rerun: say so, offer stage 2 for the new one, and keep the old customer voice folded away. */
export function OutdatedVoice({
  runId,
  finished,
  minedAt,
  newerAt,
  onRunNode,
}: {
  runId: string;
  finished: boolean;
  minedAt: string;
  newerAt: string;
  onRunNode: (node: ResearchNode) => void;
}) {
  const [showOld, setShowOld] = useState(false);
  const when = (iso: string) => new Date(iso).toLocaleString();
  return (
    <>
      <div className="next-stage">
        <div className="txt">
          <b>Stage 1 was rerun — this customer voice is out of date</b>
          <div className="sub">
            These reviews were mined from the competitors of the stage-1 run of {minedAt ? when(minedAt) : 'an earlier date'}.
            Stage 1 ran again on {when(newerAt)} and found its own competitors; mine those.
          </div>
        </div>
        <button className="primary" onClick={() => onRunNode('review_mining')}>
          Start stage 2 →
        </button>
      </div>
      <button className="ghost" onClick={() => setShowOld((v) => !v)}>
        {showOld ? 'Hide the older customer voice' : 'Show the older customer voice'}
      </button>
      {showOld && (
        <div className="voice-tile">
          <VoiceAnalysis runId={runId} finished={finished} />
        </div>
      )}
    </>
  );
}
