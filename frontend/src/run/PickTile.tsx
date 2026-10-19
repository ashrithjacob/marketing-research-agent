import type { BrandVisual } from '../api';
import BrandMark, { domainOf } from '../BrandMark';

export default function PickTile({ brand, name, url, visual, selected, note, onToggle }: { brand: string; name: string; url: string; visual: BrandVisual | undefined; selected: boolean; note?: string; onToggle: () => void }) {
  return (
    <li className={`pick-tile ${selected ? 'selected' : ''}`} title={note}>
      <button className="pick-body" onClick={onToggle} aria-pressed={selected}>
        <span className="pick-image">
          <BrandMark name={brand} src={visual?.image_url ?? null} size={132} shape="square" />
          <span className="pick-check">{selected ? '✓' : ''}</span>
        </span>
        <span className="title-line">
          <BrandMark name={brand} src={visual?.logo_url ?? null} size={18} />
          <strong>{brand}</strong>
        </span>
        <span className="pick-name small">{name}</span>
      </button>
      <a className="pick-link small" href={url} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>
        {domainOf(url)} ↗
      </a>
    </li>
  );
}
