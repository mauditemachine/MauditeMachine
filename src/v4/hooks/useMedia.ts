/** matchMedia observe en direct (mise en page, pointeur). */

import { useCallback, useMemo, useSyncExternalStore } from 'react';

export function useMedia(query: string): boolean {
  const mql = useMemo(() => window.matchMedia(query), [query]);
  // Abonnement stable : sans useCallback, React le refait a chaque rendu
  const subscribe = useCallback(
    (cb: () => void) => {
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    [mql]
  );
  return useSyncExternalStore(subscribe, () => mql.matches, () => false);
}
