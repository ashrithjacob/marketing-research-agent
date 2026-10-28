export interface Block {
  id: string;
  label: string;
  count: number;
  emerging?: boolean;
  onClick?: () => void;
}

function Segment({ block, shade }: { block: Block; shade: number }) {
  const props = { className: `seg shade-${shade}`, style: { flexGrow: block.count }, title: `${block.label}: ${block.count}` };
  return block.onClick ? <button {...props} aria-label={`${block.label}, ${block.count}`} onClick={block.onClick} /> : <span {...props} />;
}

function Chip({ block }: { block: Block }) {
  const body = <>{block.label} <span className="dim">{block.count}</span></>;
  const className = `chip${block.emerging ? ' standing-emerging' : ''}`;
  return block.onClick ? <button className={className} onClick={block.onClick}>{body}</button> : <span className={className}>{body}</span>;
}

export default function StackedBar({ blocks, width, rest = 0, restLabel = '', chips = true, maxChips = 6 }: { blocks: Block[]; width: number; rest?: number; restLabel?: string; chips?: boolean; maxChips?: number }) {
  return (
    <div className="avatar-cell">
      <div className="avatar-track" style={{ width: `${Math.max(4, width * 100)}%` }}>
        {blocks.map((block, i) => <Segment key={block.id} block={block} shade={i % 2} />)}
        {rest > 0 && <span className="seg rest" style={{ flexGrow: rest }} title={`${rest} ${restLabel}`} />}
      </div>
      {chips && blocks.length > 0 && (
        <div className="sub-chips">
          {blocks.slice(0, maxChips).map((block) => <Chip key={block.id} block={block} />)}
          {blocks.length > maxChips && <span className="chip more">+{blocks.length - maxChips} more</span>}
        </div>
      )}
    </div>
  );
}
