/**
 * La banque d'usine du VST3 (2026-11-10 ; plugin/mm-arp/presets/factory.json, ecrite par presets/build.mjs) : seule la
 * face du plugin l'importe, le site ne la contient pas. Un preset se charge comme un preset du disque
 * (arpBridge.factoryLoad : potards, suite, progression, reglages du VST3 seul et pistes du sequenceur par pas ; une
 * etape d'UNDO ; QUALITY garde sa valeur). L'onglet LIBRARY du capot (HoodBoard.tsx) la montre.
 */

import bank from '../../../../plugin/mm-arp/presets/factory.json';
import { arpBridge } from './bridge';

export type LibCat = 'DISCO' | 'HYPNOTIC' | 'DARK' | 'TEXTURE';

export interface FactoryPreset {
  name: string;
  cat: LibCat;
  desc: string;
  bpm: number;
  knobs: Record<string, number>;
  seq: unknown;
  prog: number[];
  extra?: Record<string, number>;
  steps?: unknown;
}

export const LIB_PRESETS = (bank as unknown as { presets: FactoryPreset[] }).presets;
export const LIB_CATS: readonly LibCat[] = ['DISCO', 'HYPNOTIC', 'DARK', 'TEXTURE'];
export const libOfCat = (c: LibCat): FactoryPreset[] => LIB_PRESETS.filter((p) => p.cat === c);

/** Le preset charge depuis l'ouverture de la fenetre (son nom ; null : aucun). */
let current: string | null = null;
const listeners = new Set<() => void>();

export const libStore = {
  get: (): string | null => current,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export function libLoad(p: FactoryPreset): void {
  if (!arpBridge.factoryLoad(p)) return;
  current = p.name;
  listeners.forEach((fn) => fn());
}

export const libCurrent = (): FactoryPreset | null => LIB_PRESETS.find((p) => p.name === current) ?? null;

/** Le precedent (-1) ou le suivant (+1), dans toute la banque ; sans preset charge : le premier ou le dernier. */
export function libStep(d: 1 | -1): void {
  const all = LIB_CATS.flatMap(libOfCat);
  if (all.length === 0) return;
  const i = all.findIndex((p) => p.name === current);
  libLoad(all[i < 0 ? (d > 0 ? 0 : all.length - 1) : (i + d + all.length) % all.length]);
}
