import { Fragment } from 'react';
import type { Excerpt, Judgement, RunDetail, StagePacket } from '../api';
import { NODE_LABELS } from '../StageRail';

function Card({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`card ${tone ?? ''}`}>
      <div className="v">{value}</div>
      <div className="l">{label}</div>
    </div>
  );
}

const AWARENESS = ['Unaware', 'Problem', 'Solution', 'Product', 'Most'];

export function RightRail({
  run,
  packet,
  unarchived,
  voice,
  judgements,
}: {
  run: RunDetail;
  packet: StagePacket | null;
  unarchived: number;
  voice: Excerpt[];
  judgements: Judgement[];
}) {
  return (
  <div className="right">
    <div className="cards">
      <Card label="Sources" value={run.counts.sources} />
      <Card label="Excerpts" value={run.counts.excerpts} />
      <Card label="Measurements" value={run.counts.measurements} />
      <Card label="Gaps" value={run.counts.gaps} tone="gap" />
    </div>

    {unarchived > 0 && (
      <div className="warn">
        {unarchived} admitted source{unarchived === 1 ? '' : 's'} not archived —
        those spans cannot be checked against the page they came from.
      </div>
    )}

    <section>
      <h3>
        Angle map <span className="n">avatar × awareness</span>
      </h3>
      <div className="grid">
        <div />
        {AWARENESS.map((a) => (
          <div key={a} className="gh">
            {a}
          </div>
        ))}
        {[0, 1, 2, 3].map((row) => (
          <Fragment key={row}>
            <div className="rh">—</div>
            {AWARENESS.map((_, col) => (
              <div key={col} className="cell no" />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="legend">
        <span>
          <i className="sw" style={{ background: 'rgba(74,222,128,.5)' }} />
          evidenced
        </span>
        <span>
          <i className="sw" style={{ background: 'rgba(192,132,252,.5)' }} />
          inferred
        </span>
        <span>
          <i className="sw" style={{ background: '#1b2130' }} />
          empty
        </span>
      </div>
      <p className="muted">
        Stage-4 output, rendered empty here for the same reason the rail
        shows stages 2–5 greyed out: an accurate picture of where this is.
      </p>
    </section>

    <section>
      <h3>
        Voice of customer <span className="n">verbatim, never paraphrased</span>
      </h3>
      {voice.length === 0 && <p className="muted">Nothing yet.</p>}
      {voice.slice(0, 25).map((excerpt) => (
        <div key={excerpt.id} className="item">
          <div className="q">
            “{excerpt.text}”
            {excerpt.star_rating != null && (
              <span className="pill star">{excerpt.star_rating}★</span>
            )}
          </div>
          <div className="src">
            {NODE_LABELS[excerpt.node]}
            {excerpt.axis ? ` · ${excerpt.axis.replace('why_', 'why ')}` : ''}
            {excerpt.posted_at ? ` · ${excerpt.posted_at}` : ''}
          </div>
        </div>
      ))}
    </section>

    <section>
      <h3>
        Gaps <span className="n">{run.counts.gaps}</span>
      </h3>
      {(packet?.gaps ?? []).length === 0 && (
        <p className="muted">
          Nothing yet. An empty gap list on a finished run means the run
          stopped looking, and the packet is rejected for it.
        </p>
      )}
      {(packet?.gaps ?? []).map((gap, index) => (
        <div key={index} className="item">
          <div className="q">{gap.missing}</div>
          <div className="src">
            {NODE_LABELS[gap.node]}
            {gap.would_need ? ` · needs: ${gap.would_need}` : ''}
          </div>
        </div>
      ))}
    </section>

    <section>
      <h3>
        Standing judgements <span className="n">{judgements.length}</span>
      </h3>
      {judgements.length === 0 && (
        <p className="muted">None yet. “Step in” to correct the agent.</p>
      )}
      {judgements.map((judgement) => (
        <div key={judgement.id} className="judge">
          <div className="w">{judgement.kind.replace('_', ' ')}</div>
          <div>{judgement.text}</div>
          <div className="used">
            applied {judgement.applied_count} time
            {judgement.applied_count === 1 ? '' : 's'}
          </div>
        </div>
      ))}
    </section>
  </div>
  );
}
