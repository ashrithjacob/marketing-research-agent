import { useState } from 'react';
import { VoiceAnalysis } from './voice/VoiceAnalysis';

/** A review-mining run whose stage 1 has since been rerun: say so, offer product truth on the new one — review mining follows it — and keep the old customer voice folded away. */
export function OutdatedVoice({
  runId,
  finished,
  minedAt,
  newerAt,
}: {
  runId: string;
  finished: boolean;
  minedAt: string;
  newerAt: string;
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
            Stage 1 ran again on {when(newerAt)} and found its own competitors. To mine those, start a plan from the inbox with Product truth and Review mining ticked.
          </div>
        </div>
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
