import AlwaysOnPanel from './AlwaysOnPanel';
import Cards from './Cards';
import ChatPanel from './ChatPanel';
import FeedbackLog from './FeedbackLog';
import MemoryList from './MemoryList';
import PlanCard from './PlanCard';
import ProductPanels from './ProductPanels';
import { Link, paths } from './route';
import { useWorkspace } from './use-workspace';
import WatchPanel from './WatchPanel';

export default function InboxPage({ onError }: { onError: (message: string) => void }) {
  const { chat, board, connected } = useWorkspace();
  if (!board) return <div className="empty">Loading…</div>;
  const plans = board.plans.slice(0, 3);
  return (
    <div className="plan-page">
      <div className="plan-main inbox">
        <Cards cards={board.cards} today={board.cards_today} onError={onError} />
        {board.cards.length === 0 && <div className="muted small">Nothing is waiting for you.</div>}
        <h2>Plans</h2>
        {plans.length === 0 && <p className="muted small">No plan yet. Press Start, name a product or paste its page, and review what it proposes.</p>}
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} tasks={board.tasks} onError={onError} />
        ))}
        <ProductPanels onError={onError} />
        {board.drafts.length > 0 && (
          <section className="feedback-log">
            <h2>Drafts</h2>
            <ul>
              {board.drafts.map((draft) => (
                <li key={draft.id}>
                  <span className="when">{new Date(draft.created_at).toLocaleString()}</span>
                  <Link to={paths.draft(draft.id)} className="what">
                    {draft.playbook.replace(/_/g, ' ')}, version {draft.version}
                  </Link>
                  <span className="d">{draft.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <AlwaysOnPanel status={board.always_on} schedules={board.schedules} onError={onError} />
        <WatchPanel onError={onError} />
        <MemoryList entries={board.memory} onError={onError} />
        <FeedbackLog feedback={board.feedback} />
      </div>
      <ChatPanel chat={chat} planId={plans[0]?.id ?? ''} connected={connected} onError={onError} />
    </div>
  );
}
