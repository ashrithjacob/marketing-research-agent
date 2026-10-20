import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';

export type Route = { page: 'home' } | { page: 'run'; runId: string; section: string | null };

export const paths = {
  home: () => '/',
  run: (runId: string, section: string | null = null) => `/runs/${runId}${section ? `/${section}` : ''}`,
};

const NAVIGATED = 'mra:navigated';

export function parseRoute(pathname: string): Route {
  const run = pathname.match(/^\/runs\/([0-9a-f]+)(?:\/([a-z_]+))?\/?$/);
  return run ? { page: 'run', runId: run[1], section: run[2] ?? null } : { page: 'home' };
}

export function navigate(path: string) {
  if (path === window.location.pathname) return;
  window.history.pushState(null, '', path);
  window.dispatchEvent(new Event(NAVIGATED));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  useEffect(() => {
    const update = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', update);
    window.addEventListener(NAVIGATED, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(NAVIGATED, update);
    };
  }, []);
  return route;
}

export function Link({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  const follow = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} className={className} onClick={follow}>
      {children}
    </a>
  );
}
