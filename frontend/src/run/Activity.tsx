import type { RunEvent } from '../api';

function describe(event: RunEvent): string | null {
  const p = event.payload;
  if (event.kind === 'tool.called') {
    const args = p.args as Record<string, unknown>;
    const what = args.url ?? args.query ?? '';
    return `${p.agent_id}: ${p.tool} ${String(what)}`;
  }
  if (event.kind === 'agent.started') return `${p.agent_id} started`;
  if (event.kind === 'agent.ended') return `${p.agent_id} ${p.status}${p.error ? `: ${p.error}` : ''}`;
  if (event.kind === 'agent.resumed') return `resumed after: ${p.error}`;
  if (event.kind === 'stage.changed') return `stage ${p.stage}: ${p.status}`;
  if (event.kind === 'reviews.collected') return `reviews: ${p.target}, ${p.collected} collected, ${p.saved} new`;
  if (event.kind === 'avatars.memory') return `avatars after batch ${p.batch}: ${(p.avatars as { key: string; reviews: number }[]).map((a) => `${a.key} ${a.reviews}`).join(', ')}`;
  if (event.kind === 'traction.collected') return `shop traction: ${p.found} of ${p.of}${(p.failures as string[] | undefined)?.length ? `, failed: ${(p.failures as string[]).join('; ')}` : ''}`;
  if (event.kind === 'run.resolved') return `resolved, ${p.competitors} competitors proposed`;
  if (event.kind === 'run.ended') return `run ${p.status}`;
  return null;
}

export default function Activity({ events }: { events: RunEvent[] }) {
  const lines = events.map((event) => ({ id: event.id, at: event.created_at, text: describe(event) })).filter((line) => line.text !== null);
  if (lines.length === 0) return null;
  return (
    <section className="panel activity">
      <h2>Live activity</h2>
      <ol>
        {lines.slice(-30).reverse().map((line) => (
          <li key={line.id}>
            <span className="dim small">{new Date(line.at).toLocaleTimeString()}</span> {line.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
