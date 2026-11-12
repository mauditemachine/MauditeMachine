/**
 * PERFORM, le live (2026-11-12, le plugin, Mika : "le bouton PERFORM, j'aimerais qu'il serve vraiment pour le live, trouve
 * des fonctions interessantes, des cuts..."). Menu PERFORM ouvert, les 16 touches de pas deviennent des pads tenus (comme le
 * PERFORMANCE de l'Analog Rytm) : appuye, l'effet part ; relache, tout revient. Maj + clic garde un pad (un autre Maj + clic
 * le rend). Le moteur C++ les joue (dsp/Fx.cpp Perf, Engine::setPerf) ; la face ne fait que dire ce qui est tenu.
 *
 * Rangee du haut (1 a 8) : CUT, la piste imprimee sur la touche et sa jumelle (BD coupe BD et BD2...).
 * Rangee du bas (9 a 16) : le beat repeat 1/4 1/8 1/16 1/32 (cale sur la grille, le dernier tenu gagne), LOW CUT (les
 * basses tuees), DELAY et REVERB (tout le mix jete dans l'effet, ses queues restent), TAPE (la bande ralentit jusqu'a
 * l'arret).
 *
 * Et le FILTER (un filtre DJ sur tout le mix, -1 passe-bas ... 0 ouvert ... 1 passe-haut) : le parametre FILTER du plugin,
 * qu'Ableton automatise et mappe ; la face le suit. Module sans dependance du moteur : plugin/bridge.ts l'ecoute.
 */

export type PerfKind = 'cut' | 'repeat' | 'lowcut' | 'throwD' | 'throwR' | 'tape';
export interface PerfPad {
  /** le nom sur la touche (sa legende orange, PERFORM ouvert) */
  label: string;
  /** ce que dit l'ecran quand on le tient */
  say: string;
  kind: PerfKind;
  /** cut : les pistes (bit t) ; repeat : la division (1 a 4 : 1/4 1/8 1/16 1/32) */
  arg: number;
}

const ROW1 = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'];
export const PERF_PADS: readonly PerfPad[] = [
  ...ROW1.map((n, k): PerfPad => ({ label: `CUT ${n}`, say: `CUT ${n} + ${n}2`, kind: 'cut', arg: (1 << k) | (1 << (k + 8)) })),
  { label: 'RPT 1/4', say: 'REPEAT 1/4', kind: 'repeat', arg: 1 },
  { label: 'RPT 1/8', say: 'REPEAT 1/8', kind: 'repeat', arg: 2 },
  { label: 'RPT 1/16', say: 'REPEAT 1/16', kind: 'repeat', arg: 3 },
  { label: 'RPT 1/32', say: 'REPEAT 1/32', kind: 'repeat', arg: 4 },
  { label: 'LOW CUT', say: 'LOW CUT: NO BASS', kind: 'lowcut', arg: 0 },
  { label: 'DELAY', say: 'DELAY THROW', kind: 'throwD', arg: 0 },
  { label: 'REVERB', say: 'REVERB WASH', kind: 'throwR', arg: 0 },
  { label: 'TAPE', say: 'TAPE STOP', kind: 'tape', arg: 0 },
];

/** Les bits des drapeaux du moteur (dsp/Engine.h PERF_*) ; 0 a 2 : le beat repeat. */
export const PERF_FLAG = { lowcut: 8, throwD: 16, throwR: 32, tape: 64 } as const;

/** Les pads tenus, dans l'ordre de l'appui (le dernier repeat gagne) ; ceux gardes par Maj + clic. */
let held: number[] = [];
const latched = new Set<number>();
let filterV = 0;
let sideV = 0;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((fn) => fn());

/** Les pads actifs : les gardes, puis les tenus dans l'ordre de l'appui (le dernier repeat tenu gagne). */
const on = (): number[] => [...[...latched].filter((i) => !held.includes(i)), ...held];

export const perform = {
  /** un pad appuye (0 a 15) */
  down(i: number): void {
    if (i < 0 || i >= PERF_PADS.length || held.includes(i)) return;
    held = [...held, i];
    emit();
  },
  /** un pad relache (un pad garde le reste) */
  up(i: number): void {
    if (!held.includes(i)) return;
    held = held.filter((x) => x !== i);
    emit();
  },
  /** Maj + clic : garde le pad, ou le rend ; true : garde maintenant */
  latch(i: number): boolean {
    if (i < 0 || i >= PERF_PADS.length) return false;
    if (latched.has(i)) latched.delete(i);
    else latched.add(i);
    emit();
    return latched.has(i);
  },
  /** tout relache (PERFORM se ferme, la fenetre perd la main, STOP) */
  releaseAll(): void {
    if (held.length === 0 && latched.size === 0) return;
    held = [];
    latched.clear();
    emit();
  },
  isOn: (i: number): boolean => held.includes(i) || latched.has(i),
  isLatched: (i: number): boolean => latched.has(i),
  /** ce qui part au moteur : les pistes coupees et les drapeaux */
  state(): { cut: number; flags: number } {
    let cut = 0;
    let flags = 0;
    let rep = 0;
    for (const i of on()) {
      const p = PERF_PADS[i];
      if (p.kind === 'cut') cut |= p.arg;
      else if (p.kind === 'repeat') rep = p.arg;
      else flags |= PERF_FLAG[p.kind];
    }
    return { cut, flags: flags | rep };
  },
  /** le FILTER : -1 passe-bas ... 0 ouvert ... 1 passe-haut */
  filter: (): number => filterV,
  setFilter(v: number): void {
    const x = Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0));
    const snapped = Math.abs(x) < 0.02 ? 0 : Math.round(x * 1000) / 1000;
    if (snapped === filterV) return;
    filterV = snapped;
    filterHook?.(snapped);
    emit();
  },
  /** le SIDECHAIN (2026-11-12) : 0 a 1, le mix (sauf le kick) pompe a chaque temps */
  side: (): number => sideV,
  setSide(v: number): void {
    const x = Math.round(Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0)) * 1000) / 1000;
    if (x === sideV) return;
    sideV = x;
    sideHook?.(x);
    emit();
  },
  /** le SIDECHAIN mene par Ableton : la face le suit sans le renvoyer */
  hostSide(v: number): void {
    const x = Math.max(0, Math.min(1, v));
    if (Math.abs(x - sideV) < 1e-4) return;
    sideV = x;
    emit();
  },
  /** le FILTER mene par Ableton (son automation) : la face le suit sans le renvoyer */
  hostFilter(v: number): void {
    const x = Math.max(-1, Math.min(1, v));
    if (Math.abs(x - filterV) < 1e-4) return;
    filterV = x;
    emit();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/** Le pont (plugin/bridge.ts) : le FILTER tourne sur la face, il part au parametre FILTER du plugin. */
let filterHook: ((v: number) => void) | null = null;
export function setFilterHook(fn: ((v: number) => void) | null): void {
  filterHook = fn;
}
/** Le pont : le SIDECHAIN tourne sur la face, il part au parametre SIDECHAIN du plugin. */
let sideHook: ((v: number) => void) | null = null;
export function setSideHook(fn: ((v: number) => void) | null): void {
  sideHook = fn;
}
