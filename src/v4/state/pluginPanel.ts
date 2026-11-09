/**
 * Le panneau OPEN du plugin (2026-11-09, Mika : "Je veux garder le bouton OPEN (et je veux pouvoir fermer aussi pour avoir
 * la facade avant). Dans OPEN je veux tous les settings et les choses plus pointues, le fine tuning") : ouvert ou ferme. OPEN
 * (la touche, le clavier, le logo) le bascule dans le plugin a la place du capot du site (actions/nav.ts openToggle) ;
 * plugin/OpenPanel.tsx le dessine.
 */
let open = false;
const listeners = new Set<() => void>();

export const pluginPanel = {
  get: (): boolean => open,
  set(v: boolean): void {
    if (open === v) return;
    open = v;
    listeners.forEach((fn) => fn());
  },
  toggle(): void {
    pluginPanel.set(!open);
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
