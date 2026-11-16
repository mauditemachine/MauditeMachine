/**
 * L'arc lumineux des potards modules (2026-11-16, Mika, la maquette A : "un arc ambre discret montre la plage du LFO,
 * une comete orange suit la valeur reelle"). Le C++ envoie, 30 fois par seconde, la valeur modulee (0..1) des reglages
 * que quelque chose module (mm_mod {ids, v} : PluginEditor.cpp, PluginProcessor publishMod, Voyager::modView) ; un
 * evenement vide quand plus rien ne l'est. Ici : la valeur montree, lissee a chaque image (requestAnimationFrame), sa
 * plage (le plus bas et le plus haut des dernieres secondes, qui se resserrent doucement) et sa traine (les dernieres
 * images). La boucle ne tourne que tant qu'un reglage est module. Rien hors du plugin (bridge.ts seul l'alimente).
 */

export interface ModShown {
  /** la valeur montree (0..1) */
  v: number;
  /** la plage balayee */
  lo: number;
  hi: number;
  /** les valeurs des images precedentes, la plus recente d'abord */
  trail: readonly number[];
}

interface Track {
  target: number;
  v: number;
  lo: number;
  hi: number;
  trail: number[];
}

const TRAIL = 10;
/** le lissage de la valeur (s) et le resserrement de la plage (s) */
const SMOOTH_S = 0.035;
const RANGE_S = 1.6;

const tracks = new Map<string, Track>();
let shown: ReadonlyMap<string, ModShown> = new Map();
const listeners = new Set<() => void>();
let raf = 0;
let last = 0;

function publish(): void {
  const m = new Map<string, ModShown>();
  for (const [id, t] of tracks) m.set(id, { v: t.v, lo: t.lo, hi: t.hi, trail: t.trail.slice() });
  shown = m;
  listeners.forEach((fn) => fn());
}

function frame(now: number): void {
  raf = 0;
  if (tracks.size === 0) return;
  const dt = Math.min(0.1, Math.max(0, (now - (last || now)) / 1000));
  last = now;
  const a = 1 - Math.exp(-dt / SMOOTH_S);
  const r = 1 - Math.exp(-dt / RANGE_S);
  for (const t of tracks.values()) {
    t.v += (t.target - t.v) * a;
    t.lo = Math.min(t.v, t.lo + (t.v - t.lo) * r);
    t.hi = Math.max(t.v, t.hi + (t.v - t.hi) * r);
    t.trail.unshift(t.v);
    if (t.trail.length > TRAIL) t.trail.length = TRAIL;
  }
  publish();
  raf = window.requestAnimationFrame(frame);
}

export const arpMod = {
  /** mm_mod du C++ : {ids: string[], v: number[]} */
  receive(o: unknown): void {
    const ev = o && typeof o === 'object' ? (o as { ids?: unknown; v?: unknown }) : {};
    const ids = Array.isArray(ev.ids) ? ev.ids : [];
    const vs = Array.isArray(ev.v) ? ev.v : [];
    const seen = new Set<string>();
    ids.forEach((id, i) => {
      const v = vs[i];
      if (typeof id !== 'string' || typeof v !== 'number' || !Number.isFinite(v)) return;
      const x = Math.min(1, Math.max(0, v));
      seen.add(id);
      const t = tracks.get(id);
      if (t) t.target = x;
      else tracks.set(id, { target: x, v: x, lo: x, hi: x, trail: [x] });
    });
    let gone = false;
    for (const id of [...tracks.keys()])
      if (!seen.has(id)) {
        tracks.delete(id);
        gone = true;
      }
    if (gone || tracks.size === 0) publish();
    if (tracks.size > 0 && !raf) {
      last = 0;
      raf = window.requestAnimationFrame(frame);
    }
  },
  get: (): ReadonlyMap<string, ModShown> => shown,
  of: (id: string): ModShown | undefined => shown.get(id),
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/* ---------------- le dessin (commun a la face et a OPEN) ---------------- */

export const MOD_ORANGE = '#ff6a2a';
export const MOD_HEAD = '#ffd2a8';

/**
 * L'arc d'un potard en SVG : at(v) donne le point (x, y) de la valeur v sur le cercle de l'arc ; w l'epaisseur, r le
 * rayon de la tete. Rend la chaine des elements (la plage, la traine, la tete).
 */
export function modArcPaths(m: ModShown, at: (v: number) => readonly [number, number], w: number): { range: string; trail: { d: string; o: number }[]; head: readonly [number, number] } {
  const path = (a: number, b: number): string => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const n = Math.max(2, Math.ceil((hi - lo) * 90));
    let d = '';
    for (let i = 0; i <= n; i += 1) {
      const [x, y] = at(lo + ((hi - lo) * i) / n);
      d += `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return d;
  };
  const trail: { d: string; o: number }[] = [];
  for (let i = 0; i < m.trail.length - 1; i += 1) {
    const p0 = m.trail[i];
    const p1 = m.trail[i + 1];
    if (Math.abs(p1 - p0) < 0.0008) continue;
    trail.push({ d: path(p0, p1), o: (1 - i / m.trail.length) * 0.9 });
  }
  void w;
  return { range: path(m.lo, m.hi), trail, head: at(m.v) };
}
