/**
 * L'analyseur de la page SOUND (v27, 2026-11-17) : le C++ (dsp/ParamEq.h SpecAnalyzer, PluginEditor.cpp) envoie 15 fois
 * par seconde 96 bandes en dB (20 Hz a 20 kHz, mm_spec {b}), seulement quand la face dit que la page est visible
 * (mm_view {spec}) : leger, rien n'est calcule page fermee. Ici : la derniere image, et qui la regarde.
 */

export const SPEC_BINS = 96;
let bins: readonly number[] = [];
let viewers = 0;
const listeners = new Set<() => void>();
let viewFn: ((on: boolean) => void) | null = null;

export const arpSpec = {
  get: (): readonly number[] => bins,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** mm_spec du C++ : {b: number[]} (dB entiers). */
  receive(o: unknown): void {
    const b = o && typeof o === 'object' ? (o as { b?: unknown }).b : null;
    if (!Array.isArray(b)) return;
    bins = b.map((x) => (typeof x === 'number' && Number.isFinite(x) ? x : -100));
    listeners.forEach((fn) => fn());
  },
  /** La page SOUND s'affiche (+1) ou se cache (-1) : le C++ calcule tant qu'un ecran la montre. */
  watch(d: 1 | -1): void {
    const was = viewers > 0;
    viewers = Math.max(0, viewers + d);
    const on = viewers > 0;
    if (on !== was) {
      if (!on) {
        bins = [];
        listeners.forEach((fn) => fn());
      }
      viewFn?.(on);
    }
  },
  /** Le pont (bridge.ts) : comment le dire au C++. */
  onView(fn: (on: boolean) => void): void {
    viewFn = fn;
  },
  watching: (): boolean => viewers > 0,
};
