import { useCallback, useEffect, useState } from 'react';

import { api, type Session } from './api';
import AlwaysOnSwitch from './AlwaysOnSwitch';
import BrandPage from './BrandPage';
import DraftPage from './DraftPage';
import HomePage from './HomePage';
import Login from './Login';
import LogsPage from './LogsPage';
import { Link, paths, useRoute } from './route';

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [who, setWho] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const route = useRoute();

  const loadSession = useCallback(() => {
    api
      .session()
      .then((s) => {
        setWho(s);
        setAuthed(s.authenticated);
      })
      .catch(() => setAuthed(false));
  }, []);

  useEffect(loadSession, [loadSession]);

  if (authed === null) return <div className="boot">Loading…</div>;
  if (!authed) return <Login onSuccess={loadSession} />;
  if (route.page === 'logs') return <LogsPage runId={route.runId} />;

  return (
    <div className="app">
      <header>
        <Link to={paths.home()} className="brand">
          marketing agent
        </Link>
        <div className="subject">
          <AlwaysOnSwitch onError={setError} />
          {who?.auth_required && (
            <span className="chip" title="Signed in as, in workspace">
              {who.user} · {who.workspace}
            </span>
          )}
          <button
            className="ghost"
            title="Sign out"
            onClick={async () => {
              await api.logout();
              setAuthed(false);
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <div className="error banner" onClick={() => setError('')}>
          {error}
        </div>
      )}

      {route.page === 'home' && <HomePage onError={setError} />}
      {route.page === 'brand' && <BrandPage key={route.key} brandKey={route.key} stage={route.stage} onError={setError} />}
      {route.page === 'draft' && <DraftPage draftId={route.draftId} onError={setError} />}
    </div>
  );
}
