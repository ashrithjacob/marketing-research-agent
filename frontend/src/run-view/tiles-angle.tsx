import { Fragment } from 'react';
import { Chip, Tile } from './tile';

const AWARENESS = ['Unaware', 'Problem', 'Solution', 'Product', 'Most'];

export function AngleMapTile() {
  return (
    <Tile
      label="Angle map"
      sub="avatar × awareness — stage 4"
      chips={<Chip tone="dim">not built</Chip>}
    >
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
          <i className="sw" style={{ background: 'rgba(5, 150, 105, 0.4)' }} />
          evidenced
        </span>
        <span>
          <i className="sw" style={{ background: 'rgba(124, 58, 237, 0.4)' }} />
          inferred
        </span>
        <span>
          <i className="sw" style={{ background: 'var(--panel-2)' }} />
          empty
        </span>
      </div>
      <p className="muted">
        Fills in when stage 4 is built — the same reason stages 2–5 sit greyed
        out on the rail.
      </p>
    </Tile>
  );
}
