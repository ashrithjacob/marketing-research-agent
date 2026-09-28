import {
  GROUP_LABEL,
  SOURCE_LABEL,
  sliceOf,
  type GroupScope,
  type ProductVoice,
  type ReviewAnalysis,
  type SourceScope,
} from '../../api';
import { Chip } from '../tile';

export interface VoiceFilter {
  source: SourceScope;
  group: GroupScope;
  target: string;
}

const SOURCES: SourceScope[] = ['all', 'amazon', 'other'];
const GROUPS: GroupScope[] = ['product', 'direct', 'indirect'];

export function VoiceFilters({
  analysis,
  filter,
  products,
  onChange,
}: {
  analysis: ReviewAnalysis;
  filter: VoiceFilter;
  products: ProductVoice[];
  onChange: (next: VoiceFilter) => void;
}) {
  const count = (source: SourceScope, group: GroupScope) => sliceOf(analysis, source, group)?.reviews ?? 0;
  const sourceTotal = (source: SourceScope) => GROUPS.reduce((sum, group) => sum + count(source, group), 0);
  return (
    <div className="voice-filters">
      <div className="voice-picker">
        <span className="voice-picker-label">Source</span>
        {SOURCES.map((source) => (
          <Chip key={source} onClick={() => onChange({ ...filter, source, target: '' })} active={filter.source === source}>
            {SOURCE_LABEL[source]} · {sourceTotal(source)}
          </Chip>
        ))}
      </div>
      <div className="voice-picker">
        <span className="voice-picker-label">Products</span>
        {GROUPS.map((group) => (
          <Chip
            key={group}
            onClick={() => onChange({ ...filter, group, target: '' })}
            active={filter.group === group && filter.target === ''}
          >
            {GROUP_LABEL[group]} · {count(filter.source, group)}
          </Chip>
        ))}
      </div>
      {products.length > 1 && (
        <div className="voice-picker">
          <span className="voice-picker-label">One product</span>
          {products.map((p) => (
            <Chip
              key={p.target_id}
              onClick={() => onChange({ ...filter, target: filter.target === p.target_id ? '' : p.target_id })}
              active={filter.target === p.target_id}
            >
              {p.name} · {p.reviews}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
