/**
 * La tete de lecture du plugin (2026-11-08, plugin/mm-rytm) : le C++ joue, la face montre ou il en est. Sans source
 * (le site), le renderer lit l'horloge du navigateur comme avant ; avec une source (plugin/bridge.ts), il lit celle-ci.
 * Module sans dependance : scene/renderer.ts l'importe sans tirer le pont.
 */

export interface HeadEntry {
  /** numero du pas joue, croissant (le renderer ne repeint qu'a un nouveau numero) */
  seq: number;
  /** le pas du motif (0 a 127) */
  step: number;
  /** les voix qui ont frappe a ce pas, bit k : INSTRUMENTS[k] (les huit premieres pistes) */
  mask: number;
}

type Source = () => HeadEntry | null;

let source: Source | null = null;
const wakers = new Set<() => void>();

export const extHead = {
  /** Une source est-elle branchee (le plugin) ? */
  active: (): boolean => source !== null,
  /** Le pas sous la tete, null a l'arret. */
  get: (): HeadEntry | null => (source ? source() : null),
  set(fn: Source | null): void {
    source = fn;
    extHead.wake();
  },
  /** Une nouvelle position est arrivee : les boucles de rendu se reveillent. */
  wake(): void {
    wakers.forEach((fn) => fn());
  },
  onWake(fn: () => void): () => void {
    wakers.add(fn);
    return () => {
      wakers.delete(fn);
    };
  },
};
