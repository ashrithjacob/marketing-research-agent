import type { RunEvent } from '../api';

export const RUN_TAB = 'run';

export type AgentStatus = 'running' | 'complete' | 'incomplete' | 'failed' | 'cancelled';

export interface AgentTab {
  id: string;
  label: string;
  detail: string;
  status: AgentStatus;
  tools: number;
}

const DETAIL: Record<string, string> = {
  champion: 'step 1 · the product everyone measures against',
  product: 'step 2 · product_data',
  competitors: 'step 2 · competitors',
  category: 'step 2 · category_data',
};

function agentOf(event: RunEvent): string {
  const id = (event.payload as Record<string, unknown>).agent_id;
  return typeof id === 'string' ? id : '';
}

/** The run's own milestones, then one tab per agent in the order it started, with how it ended. */
export function agentTabs(events: RunEvent[]): AgentTab[] {
  const tabs = new Map<string, AgentTab>();
  for (const event of events) {
    const id = agentOf(event);
    if (event.kind === 'agent.started') {
      tabs.set(id, { id, label: id, detail: DETAIL[id] ?? '', status: 'running', tools: 0 });
    } else if (event.kind === 'agent.ended') {
      const tab = tabs.get(id);
      if (tab) tab.status = ((event.payload as Record<string, unknown>).status as AgentStatus) ?? 'complete';
    } else if (event.kind === 'tool.completed') {
      const tab = tabs.get(id);
      if (tab) tab.tools += 1;
    }
  }
  const run: AgentTab = { id: RUN_TAB, label: 'run', detail: 'milestones of every agent', status: 'running', tools: 0 };
  return [run, ...tabs.values()];
}

/** The run tab keeps what no single agent owns plus each agent's start, end and checks; an agent's tab keeps only its own events. */
export function eventsFor(events: RunEvent[], tab: string): RunEvent[] {
  if (tab !== RUN_TAB) return events.filter((event) => agentOf(event) === tab);
  const milestone = new Set(['agent.started', 'agent.ended', 'agent.limit_reached', 'packet.checked', 'run.resumed']);
  return events.filter((event) => !agentOf(event) || milestone.has(event.kind));
}
