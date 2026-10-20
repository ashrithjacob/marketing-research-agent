import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { auth, type Session } from './api';
import HomePage from './HomePage';
import Login from './Login';
import { useRoute } from './route';
import RunPage from './run/RunPage';
import Shell from './Shell';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');
  const route = useRoute();

  const load = useCallback(() => {
    auth.session().then(setSession, () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (!session && !failed) return <div className="boot">Loading…</div>;
  if (!session?.authenticated) return <Login onSuccess={load} />;

  const frame = (nav: ReactNode, body: ReactNode) => (
    <Shell session={session} home={route.page === 'home'} nav={nav} error={error} onClearError={() => setError('')} onSignOut={() => auth.logout().then(() => setSession({ ...session, authenticated: false }))}>
      {body}
    </Shell>
  );

  if (route.page === 'run') return <RunPage key={route.runId} runId={route.runId} section={route.section} frame={frame} onError={setError} />;
  return frame(null, <HomePage onError={setError} />);
}
