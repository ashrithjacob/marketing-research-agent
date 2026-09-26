import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';

export type Route =
  | { page: 'products' }
  | { page: 'product'; productId: string; runId: string | null }
  | { page: 'logs'; runId: string }
  | { page: 'missing' };

export const paths = {
  products: () => '/',
  product: (productId: string) => `/products/${productId}`,
  run: (productId: string, runId: string) => `/products/${productId}/runs/${runId}`,
};

const NAVIGATED = 'mra:navigated';

export function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { page: 'products' };
  const logs = path.match(/^\/runs\/([0-9a-f]+)\/logs$/);
  if (logs) return { page: 'logs', runId: logs[1] };
  const product = path.match(/^\/products\/([0-9a-f]+)(?:\/runs\/([0-9a-f]+))?$/);
  if (product) return { page: 'product', productId: product[1], runId: product[2] ?? null };
  return { page: 'missing' };
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
