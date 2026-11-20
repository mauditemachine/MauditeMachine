/**
 * MAQUETTES v44 (2026-11-20, Mika : DELAY "la page entiere doit etre optimisee", REVERB "c'est vraiment tres leger",
 * HELL "la botte secrete de tout le plugin") : les pages DELAY, REVERB et HELL refaites, en deux options A et B chacune,
 * pour les images a montrer a Mika AVANT tout code definitif.
 *
 * - La variante vient de l'adresse : ?fx2=A ou ?fx2=B (sinon : null, les pages d'avant, rien ne change). Le VST3 n'a pas
 *   ce parametre dans son adresse : dans le plugin publie, ces maquettes ne s'affichent jamais.
 * - Les reglages qui n'existent pas encore cote DSP (l'EQ de la reverbe, WIDTH, les cercles de HELL...) sont des
 *   reglages de maquette (mockParam) : une valeur en memoire, un texte, aucun son, jamais envoyes au C++. Ils sont
 *   rendus par les vraies pieces (pcbui.tsx, via registerVirtual) pour que l'image soit celle de la face.
 */

import { pattern } from '../../audio/pattern';
import { voyParams } from '../../voyager/params';
import { arpExtra } from './extra';
import { registerVirtual } from './pcbui';

export type Fx2Variant = 'A' | 'B';

export const FX2: Fx2Variant | null = (() => {
  try {
    const v = new URLSearchParams(window.location.search).get('fx2');
    return v === 'A' || v === 'B' ? v : null;
  } catch {
    return null;
  }
})();

/** Le tempo du moment (120 sans transport). */
export const bpmNow = (): number => {
  const b = pattern.get().bpm;
  return typeof b === 'number' && b > 0 ? b : 120;
};

/* ---------------- les reglages de maquette (aucun son) ---------------- */

interface MockDef {
  def: number;
  text: (v: number) => string;
  steps?: readonly string[];
  name: string;
}

const mockVals = new Map<string, number>();
const mockDefs = new Map<string, MockDef>();
const mockL = new Set<() => void>();
let mockGen = 0;

export const mockStore = {
  get: (): number => mockGen,
  of: (id: string): number => mockVals.get(id) ?? mockDefs.get(id)?.def ?? 0,
  set(id: string, v: number): void {
    const d = mockDefs.get(id);
    let t = Math.min(1, Math.max(0, v));
    if (d?.steps && d.steps.length > 1) t = Math.round(t * (d.steps.length - 1)) / (d.steps.length - 1);
    if (mockVals.get(id) === t) return;
    mockVals.set(id, t);
    mockGen += 1;
    mockL.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    mockL.add(fn);
    return () => {
      mockL.delete(fn);
    };
  },
};

/** Un reglage de maquette : rendu par les pieces de la face (PcbKnob, PcbStep...), sans son. */
export function mockParam(id: string, name: string, def: number, text: (v: number) => string, steps?: readonly string[]): string {
  if (!mockDefs.has(id)) {
    mockDefs.set(id, { def, text, steps, name });
    registerVirtual(id, { of: () => mockStore.of(id), def: () => def, set: (v) => mockStore.set(id, v), text, steps, name });
  }
  return id;
}

/** Le texte d'un pas : le nom du cran. */
export const stepText = (steps: readonly string[]) => (v: number): string => steps[Math.max(0, Math.min(steps.length - 1, Math.round(v * (steps.length - 1))))];
export const stepIdx = (v: number, n: number): number => Math.max(0, Math.min(n - 1, Math.round(v * (n - 1))));
export const pct = (v: number): string => (v <= 0 ? 'OFF' : `${Math.round(v * 100)} %`);
export const hzText = (f: number): string => (f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)} KHZ` : `${Math.round(f)} HZ`);

/** Les captures des maquettes (Chromium muet) : poser un etat de page sans geste (seulement avec ?fx2). */
if (FX2 && typeof window !== 'undefined')
  (window as unknown as { __fx2?: unknown }).__fx2 = {
    mock: (id: string, v: number) => mockStore.set(id, v),
    extra: (id: string, v: number) => arpExtra.set(id, v),
    voy: (id: string, v: number) => voyParams.set(id as never, v),
  };
