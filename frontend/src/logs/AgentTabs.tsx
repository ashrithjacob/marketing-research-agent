import type { AgentStatus, AgentTab } from './agents';

const MARK: Record<AgentStatus, string> = {
  running: '…',
  complete: '✓',
  incomplete: '◐',
  failed: '✗',
  cancelled: '■',
};

/** One tab for the run's milestones, then one per agent that has started. */
export function AgentTabs({
  tabs,
  selected,
  onSelect,
}: {
  tabs: AgentTab[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="agent-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === selected}
          className={`agent-tab ${tab.status}${tab.id === selected ? ' on' : ''}`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.id !== 'run' && <span className="agent-tab-mark">{MARK[tab.status]}</span>}
          <b>{tab.label}</b>
          <span className="agent-tab-detail">
            {tab.detail}
            {tab.tools ? ` · ${tab.tools} tool${tab.tools === 1 ? '' : 's'}` : ''}
          </span>
        </button>
      ))}
    </div>
  );
}
