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

/** v31 : l'arc se redessine a 30 images par seconde au plus (FRAME_MS) ; la trainee garde sa duree (5 images de 33 ms,
 *  10 de 16.7 ms avant) */
const FRAME_MS = 33;
const TRAIL = 5;
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

/** v49 : sous ce seuil (1 / 10 000 de la course du potard, invisible) une piste est posee. */
const SETTLE = 1e-4;
const settled = (t: Track): boolean =>
  Math.abs(t.target - t.v) < SETTLE && t.v - t.lo < SETTLE && t.hi - t.v < SETTLE && t.trail.every((x) => Math.abs(x - t.v) < SETTLE);

function frame(): void {
  raf = 0;
  if (tracks.size === 0) return;
  // l'horloge reelle (l'heure passee au rAF est celle du debut de l'image, en retard apres un minuteur)
  const now = performance.now();
  if (last && now - last < FRAME_MS - 6) {
    // sous le plafond : un minuteur jusqu'a l'image suivante (raf reste non nul : rien d'autre ne relance la boucle)
    raf = -1;
    window.setTimeout(() => {
      raf = window.requestAnimationFrame(frame);
    }, Math.max(1, FRAME_MS - (now - last) - 4));
    return;
  }
  const dt = Math.min(0.1, Math.max(0, (now - (last || now)) / 1000));
  last = now;
  const a = 1 - Math.exp(-dt / SMOOTH_S);
  const r = 1 - Math.exp(-dt / RANGE_S);
  let moving = false;
  for (const t of tracks.values()) {
    t.v += (t.target - t.v) * a;
    t.lo = Math.min(t.v, t.lo + (t.v - t.lo) * r);
    t.hi = Math.max(t.v, t.hi + (t.v - t.hi) * r);
    t.trail.unshift(t.v);
    if (t.trail.length > TRAIL) t.trail.length = TRAIL;
    if (!moving && !settled(t)) moving = true;
  }
  publish();
  // v49 : tout est pose (la valeur sur sa cible, la plage et la traine resserrees) : la boucle s'arrete ; le prochain
  // mm_mod qui change quelque chose la relance (le C++ n'envoie plus que ce qui change)
  if (!moving) {
    raf = 0;
    last = 0;
    return;
  }
  // la suivante au plafond : directement sous un minuteur
  raf = -1;
  window.setTimeout(() => {
    raf = window.requestAnimationFrame(frame);
  }, FRAME_MS - 4);
}

export const arpMod = {
  /** mm_mod du C++ : {ids: string[], v: number[]} */
  receive(o: unknown): void {
    const ev = o && typeof o === 'object' ? (o as { ids?: unknown; v?: unknown }) : {};
    const ids = Array.isArray(ev.ids) ? ev.ids : [];
    const vs = Array.isArray(ev.v) ? ev.v : [];
    const seen = new Set<string>();
    // v49 : la boucle ne repart que si quelque chose a change (une piste de plus, une cible qui bouge)
    let moved = false;
    ids.forEach((id, i) => {
      const v = vs[i];
      if (typeof id !== 'string' || typeof v !== 'number' || !Number.isFinite(v)) return;
      const x = Math.min(1, Math.max(0, v));
      seen.add(id);
      const t = tracks.get(id);
      if (t) {
        if (t.target !== x) moved = true;
        t.target = x;
      } else {
        tracks.set(id, { target: x, v: x, lo: x, hi: x, trail: [x] });
        moved = true;
      }
    });
    let gone = false;
    for (const id of [...tracks.keys()])
      if (!seen.has(id)) {
        tracks.delete(id);
        gone = true;
      }
    if (gone || tracks.size === 0) publish();
    if (tracks.size > 0 && !raf && (moved || gone)) {
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

// v31 : la couleur d'accent reglable (accent.ts) : en variables CSS, posees en style (pas en attribut SVG)
export const MOD_ORANGE = 'var(--mm-accent)';
export const MOD_HEAD = 'color-mix(in srgb, var(--mm-accent) 22%, #fff8ee)';

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
