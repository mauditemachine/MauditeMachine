/**
 * v31 (Mika : "je viens de freez mon cpu, va falloir que tu mettes un compteur de cpu en haut a droite du plugin") : la
 * charge de CETTE instance du MM-ARP, envoyee par l'editeur (PluginEditor.cpp, evenement mm_cpu, 10 fois par seconde) :
 * le temps de processBlock rapporte a la duree du bloc, en % d'un coeur, lisse sur 250 ms, par etage (PluginProcessor.h
 * CpuStage), le pic du total tenu 1 s, les voix qui sonnent, le surechantillonnage du moteur (8 : QUALITY HQ). Sans
 * plugin (le site, les essais), rien n'arrive : le compteur montre --.
 */

export const CPU_STAGES = ['ENGINE', 'DISTO', 'DELAY', 'REVERB', 'HELL', 'EQ + RACK', 'OTHER'] as const;
export const CPU_TOTAL = 7;
/** les seuils du compteur : l'accent au-dela de 50 %, le rouge au-dela de 80 % */
export const CPU_HOT = 50;
export const CPU_OVER = 80;

export interface CpuFrame {
  /** % par etage (CPU_STAGES), puis le total (CPU_TOTAL) */
  s: number[];
  /** le pic du total, tenu 1 s */
  pk: number;
  os: number;
  voices: number;
  /** v34 : le moteur PRO (sinon CLASSIC) */
  pro: boolean;
  sr: number;
  block: number;
  /** performance.now() a la reception */
  at: number;
}

let cur: CpuFrame | null = null;
const listeners = new Set<() => void>();
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export const cpuStore = {
  get: (): CpuFrame | null => cur,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** l'evenement mm_cpu du plugin */
  receive(o: unknown): void {
    if (!o || typeof o !== 'object') return;
    const r = o as Record<string, unknown>;
    const s = Array.isArray(r.s) ? r.s.map((v) => num(v)) : [];
    if (s.length <= CPU_TOTAL) return;
    cur = { s, pk: num(r.pk), os: num(r.os, 1), voices: num(r.voices), pro: r.pro === true, sr: num(r.sr), block: num(r.block), at: performance.now() };
    listeners.forEach((fn) => fn());
  },
};

/** Le niveau du compteur : 'ok', 'hot' (l'accent), 'over' (rouge). */
export const cpuLevel = (pc: number): 'ok' | 'hot' | 'over' => (pc >= CPU_OVER ? 'over' : pc >= CPU_HOT ? 'hot' : 'ok');

/** 12.4 -> "12" ; sous 10 : une decimale ("4.6") */
export const cpuText = (pc: number): string => (pc >= 9.95 ? String(Math.round(pc)) : pc.toFixed(1));
