import type { ReactNode } from 'react';

import type { Session } from './api';
import { Link, paths } from './route';

export default function Shell({ session, home, nav, error, onClearError, onSignOut, children }: { session: Session; home: boolean; nav: ReactNode; error: string; onClearError: () => void; onSignOut: () => void; children: ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to={paths.home()} className="sidebar-brand">
          <span className="sidebar-logo">A</span>
          Avatar Strategist
        </Link>
        <nav className="sidebar-nav">
          <div className="sidebar-group">Overview</div>
          <Link to={paths.home()} className={`sidebar-item ${home ? 'active' : ''}`}>
            <span className="sidebar-icon">⌂</span>
            <span className="sidebar-label">Analyses</span>
          </Link>
          {nav}
        </nav>
        {session.auth_required && (
          <div className="sidebar-foot">
            <span className="sidebar-avatar">{(session.user ?? '?').slice(0, 1).toUpperCase()}</span>
            <span className="sidebar-who">
              <strong>{session.user}</strong>
              <span>{session.account}</span>
            </span>
            <button className="sidebar-signout" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        )}
      </aside>
      <main>
        {error && (
          <div className="error banner" onClick={onClearError}>
            {error}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
