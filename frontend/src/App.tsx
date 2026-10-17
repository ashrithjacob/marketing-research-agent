import { useCallback, useEffect, useState } from 'react';

import { auth, type Session } from './api';
import HomePage from './HomePage';
import Login from './Login';
import { Link, paths, useRoute } from './route';
import RunPage from './run/RunPage';

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

  return (
    <div className="app">
      <header>
        <Link to={paths.home()} className="brand">
          Avatar Strategist
        </Link>
        <div className="who">
          {session.auth_required && (
            <span className="chip">
              {session.user} · {session.account}
            </span>
          )}
          {session.auth_required && (
            <button className="ghost" onClick={() => auth.logout().then(() => setSession({ ...session, authenticated: false }))}>
              Sign out
            </button>
          )}
        </div>
      </header>
      {error && (
        <div className="error banner" onClick={() => setError('')}>
          {error}
        </div>
      )}
      <main>
        {route.page === 'home' && <HomePage onError={setError} />}
        {route.page === 'run' && <RunPage key={route.runId} runId={route.runId} onError={setError} />}
      </main>
    </div>
  );
}
