/**
 * La machine sous la souris en vue d'ensemble (2026-10-05, Mika : "quand on
 * hover sur une machine avant de cliquer, on devrait avoir une description
 * de comment l'utiliser, en vraiment court") : ui/Hotspots.tsx la pose,
 * ui/OverviewHelp.tsx montre son mode d'emploi.
 */

import type { MachineId } from './focus';

let current: MachineId | null = null;
const listeners = new Set<() => void>();

export const overviewHover = {
  get: (): MachineId | null => current,
  set(m: MachineId | null): void {
    if (m === current) return;
    current = m;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
