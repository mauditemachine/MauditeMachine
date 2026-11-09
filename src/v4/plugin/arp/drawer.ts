/**
 * Le tiroir des potards du plugin MM-ARP (2026-11-09, plugin/mm-arp) : le plugin n'ouvre pas le capot (ni carte, ni puces
 * du site), mais les TWEAKS de la carte (ACCENT, DRIFT, STACK, GLUE, DLY TIME...) doivent rester a portee : la touche OPEN
 * de la face ouvre a la place, sous la machine, les gros potards de ui/KnobPanel.tsx (toutes les sections, TWEAKS d'abord).
 * Sans dependance : actions/nav.ts (openToggle) et voyager/rig.ts (la lueur d'OPEN) l'importent sans tirer le pont.
 */

let open = false;
const listeners = new Set<() => void>();

export const arpDrawer = {
  get: (): boolean => open,
  set(on: boolean): void {
    if (on === open) return;
    open = on;
    listeners.forEach((fn) => fn());
  },
  toggle(): boolean {
    arpDrawer.set(!open);
    return open;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
