import { useEffect, useState } from 'react';

import { workspaceApi, type Plan } from './api';
import ChatPanel from './ChatPanel';
import PlanCard from './PlanCard';
import { useWorkspace } from './use-workspace';

export default function PlanPage({ planId, onError }: { planId: string; onError: (message: string) => void }) {
  const { chat, board, connected } = useWorkspace();
  const [fetched, setFetched] = useState<Plan | null>(null);

  useEffect(() => {
    workspaceApi.plan(planId).then(setFetched).catch((err: Error) => onError(err.message));
  }, [planId, onError]);

  const plan = board?.plans.find((p) => p.id === planId) ?? fetched;
  return (
    <div className="plan-page">
      {plan ? <PlanCard plan={plan} tasks={board?.tasks ?? []} onError={onError} /> : <div className="empty">Loading plan…</div>}
      <ChatPanel chat={chat} planId={planId} connected={connected} onError={onError} />
    </div>
  );
}
