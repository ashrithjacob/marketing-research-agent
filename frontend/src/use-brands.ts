import { useEffect, useState } from 'react';

import { brandsApi, type BrandFolder } from './api';

/** Every brand of the workspace, read again every few seconds so a new graphic or a new run shows without a reload. */
export function useBrands(onError: (message: string) => void): BrandFolder[] | null {
  const [brands, setBrands] = useState<BrandFolder[] | null>(null);
  useEffect(() => {
    let current = true;
    const read = () =>
      brandsApi
        .list()
        .then(({ data }) => current && setBrands(data))
        .catch((e: Error) => onError(e.message));
    void read();
    const timer = setInterval(read, 5000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [onError]);
  return brands;
}
