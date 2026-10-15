import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';

export type Route = { page: 'home' } | { page: 'brand'; key: string; stage: { productId: string; n: 1 | 2 | 3; tab: string } | null } | { page: 'logs'; runId: string } | { page: 'draft'; draftId: string };

export const paths = {
  home: () => '/',
  brand: (key: string) => `/brands/${encodeURIComponent(key)}`,
  stage: (key: string, productId: string, n: number, tab = '') => `/brands/${encodeURIComponent(key)}/products/${productId}/stages/${n}${tab ? `/${tab}` : ''}`,
  draft: (draftId: string) => `/drafts/${draftId}`,
};

const NAVIGATED = 'mra:navigated';

export function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  const draft = path.match(/^\/drafts\/([0-9a-f]+)$/);
  if (draft) return { page: 'draft', draftId: draft[1] };
  const stage = path.match(/^\/brands\/([^/]+)\/products\/([0-9a-f]+)\/stages\/([123])(?:\/([a-z_]+))?$/);
  if (stage) return { page: 'brand', key: decodeURIComponent(stage[1]), stage: { productId: stage[2], n: Number(stage[3]) as 1 | 2 | 3, tab: stage[4] ?? '' } };
  const brand = path.match(/^\/brands\/([^/]+)$/);
  if (brand) return { page: 'brand', key: decodeURIComponent(brand[1]), stage: null };
  const logs = path.match(/^\/runs\/([0-9a-f]+)\/logs$/);
  if (logs) return { page: 'logs', runId: logs[1] };
  return { page: 'home' };
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

export function Link({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
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
