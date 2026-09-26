import { useCallback, useEffect, useState } from 'react';
import { api, type ProductSummary, type RunSummary } from './api';

/** Every product, newest activity first. */
export function useProducts(enabled: boolean, onError: (message: string) => void) {
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [rev, setRev] = useState(0);
  const reload = useCallback(() => setRev((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    api
      .products()
      .then(({ data }) => current && setProducts(data))
      .catch((e: Error) => onError(e.message));
    return () => {
      current = false;
    };
  }, [enabled, rev, onError]);

  return { products, reload };
}

/** One product and every run of it. */
export function useProduct(productId: string | null, onError: (message: string) => void) {
  const [loaded, setLoaded] = useState<{
    id: string;
    product: ProductSummary;
    runs: RunSummary[];
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const reload = useCallback(() => setRev((n) => n + 1), []);

  useEffect(() => {
    if (!productId) return;
    let current = true;
    Promise.all([api.product(productId), api.productRuns(productId)])
      .then(([product, { data }]) => current && setLoaded({ id: productId, product, runs: data }))
      .catch((e: Error) => {
        if (current) setFailed(productId);
        onError(e.message);
      });
    return () => {
      current = false;
    };
  }, [productId, rev, onError]);

  const mine = loaded && loaded.id === productId ? loaded : null;
  return {
    product: mine?.product ?? null,
    runs: mine?.runs ?? [],
    missing: !mine && productId !== null && failed === productId,
    reload,
  };
}
