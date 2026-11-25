/**
 * v50 : le menu deroule d'une fenetre de verre noir de l'encart d'EDIT (SOURCE, DESTINATION de la matrice ; STEPS, RATE
 * de la page SQ). L'encart (encart50.ts) l'ouvre au clic d'une fenetre ; Encart50Overlay.tsx le dessine en HTML au-dessus
 * de la scene, accroche a la zone de prise de la fenetre (son id). Un seul ouvert a la fois.
 */

export interface MenuItem {
  label: string;
  on: boolean;
  pick: () => void;
}

export type MenuSpec =
  | { kind: 'list'; anchor: string; title: string; items: readonly MenuItem[]; cols: number }
  | { kind: 'dest'; anchor: string; title: string; current: number; pick: (code: number) => void };

let open: MenuSpec | null = null;
const listeners = new Set<() => void>();

export const modMenu = {
  get: (): MenuSpec | null => open,
  open(m: MenuSpec): void {
    open = m;
    listeners.forEach((fn) => fn());
  },
  close(): void {
    if (open === null) return;
    open = null;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
