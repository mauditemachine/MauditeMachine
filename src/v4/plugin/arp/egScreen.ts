/**
 * v52 (2026-11-24, Mika sur la colonne FILTER EG / AMP EG de la face : "ya beaucoup d'espace ici non ? que pouvons-nous
 * rajouter qui est en rapport ?", puis l'option C de la maquette) : l'ecran des enveloppes, sans React ni three.js :
 * - la loi, celle du moteur (dsp/Voyager.cpp, la boucle des voix ; voyager/params.ts attackS, decayS, releaseS) :
 *   l'attaque monte vers 1.3 avec une constante A / 1.466 et s'arrete a 1 (atteint en A), la decroissance va vers
 *   SUSTAIN en D / 4.6 (a 1 % pres au bout de D), le relachement vers 0 en R / 4.6. tests/modview_test.cpp compare le
 *   moteur a cette loi (4e-5 pres) ;
 * - l'axe du temps, commun aux deux enveloppes et lineaire : la plus longue attaque + decroissance, un maintien dessine
 *   (HOLD de la largeur, la touche tenue), la fin du gate commune, puis le plus long relachement ;
 * - le dessin du verre (une toile : le fond, les reperes, FILTER a l'accent sur un degrade, AMP en blanc casse pointille,
 *   la legende) ; il ne se refait que quand un potard d'enveloppe ou la couleur d'accent change ;
 * - la voix jouee (mm_tick.e du C++ : PluginEditor.cpp, Voyager::egView) : ses deux niveaux, leurs etapes, le temps
 *   depuis le depart de la note et la fin de son gate ; entre deux ticks, la face avance la meme loi (egPredict) : le
 *   point glisse a 30 images par seconde tant qu'une voix sonne, et rien ne tourne au repos.
 * Le plugin seul (bridge.ts l'alimente) ; le site ne l'importe pas.
 */

import { attackS, decayS, releaseS, type VoyValues } from '../../voyager/params';

/* ---------------- la loi ---------------- */

/** Une enveloppe en unites du moteur : attaque, decroissance, relachement (s) ; maintien (0..1). */
export interface EgSeg {
  A: number;
  D: number;
  S: number;
  R: number;
}

/** Les deux enveloppes des potards (FILTER EG, AMP EG). */
export function egOf(v: Readonly<VoyValues>): { f: EgSeg; a: EgSeg } {
  return {
    f: { A: attackS(v.fA), D: decayS(v.fD), S: v.fS, R: releaseS(v.fR) },
    a: { A: attackS(v.aA), D: decayS(v.aD), S: v.aS, R: releaseS(v.aR) },
  };
}

const tauA = (e: EgSeg): number => e.A / 1.466;
const tauD = (e: EgSeg): number => e.D / 4.6;
const tauR = (e: EgSeg): number => e.R / 4.6;
/** Le haut de l'attaque (depuis 0) : la ou elle touche 1 (A, a 2e-4 pres). */
const topOf = (e: EgSeg): number => tauA(e) * Math.log(1.3 / 0.3);

/** Le niveau d'une enveloppe partie de 0, t secondes apres le depart, son gate fini a g. */
export function egLevel(e: EgSeg, t: number, g: number): number {
  const held = (x: number): number => {
    const t1 = topOf(e);
    return x < t1 ? 1.3 * (1 - Math.exp(-x / tauA(e))) : e.S + (1 - e.S) * Math.exp(-(x - t1) / tauD(e));
  };
  if (t <= 0) return 0;
  return t < g ? held(t) : held(g) * Math.exp(-(t - g) / tauR(e));
}

/** La part de la largeur du verre que prend le maintien dessine (la touche tenue). */
export const EG_HOLD = 0.22;

/** L'axe du temps commun : la fin du gate dessine et la duree dessinee (s). */
export interface EgAxis {
  tGate: number;
  T: number;
}
export function egAxis(f: EgSeg, a: EgSeg): EgAxis {
  const tAD = Math.max(topOf(f) + f.D, topOf(a) + a.D);
  const tR = Math.max(f.R, a.R);
  const hold = (EG_HOLD / (1 - EG_HOLD)) * (tAD + tR);
  return { tGate: tAD + hold, T: tAD + hold + tR };
}

/* ---------------- le verre : la zone des courbes (unites du panneau, depuis le coin haut gauche du verre) ---------------- */

/** Les marges des courbes dans le verre : a gauche, a droite, en haut (niveau 1), en bas (niveau 0). */
export const EG_PAD = { l: 0.07, r: 0.07, t: 0.085, b: 0.055 } as const;

/** Le point (u, v) du verre (unites, v vers le bas) d'un temps dessine et d'un niveau. */
export function egPoint(gw: number, gd: number, ax: EgAxis, t: number, level: number): { u: number; v: number } {
  const w = gw - EG_PAD.l - EG_PAD.r;
  const h = gd - EG_PAD.t - EG_PAD.b;
  const x = Math.min(1, Math.max(0, t / ax.T));
  return { u: EG_PAD.l + x * w, v: gd - EG_PAD.b - Math.min(1, Math.max(0, level)) * h };
}

/** Les temps de la courbe : un pas regulier, plus les coudes (le haut de chaque attaque, la fin du gate). */
function egTimes(f: EgSeg, a: EgSeg, ax: EgAxis, n: number): number[] {
  const ts = new Set<number>();
  for (let i = 0; i <= n; i += 1) ts.add((ax.T * i) / n);
  for (const e of [f, a]) {
    const t1 = topOf(e);
    if (t1 < ax.T) ts.add(t1);
  }
  ts.add(ax.tGate);
  return [...ts].sort((x, y) => x - y);
}

/** Une couleur #rrggbb a l'opacite a. */
const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/**
 * Le verre entier dans sa toile (W x H px pour gw x gd unites) : le fond sombre et son ombre interieure, les reperes
 * (la ligne du zero, le haut de l'attaque et la fin de la decroissance du filtre, la fin du gate), AMP en blanc casse
 * pointille, FILTER a l'accent (un degrade dessous, un halo), la legende en haut a droite. font : la police de la face.
 */
export function drawEgGlass(g: CanvasRenderingContext2D, W: number, H: number, gw: number, gd: number, v: Readonly<VoyValues>, accent: string, font: string): void {
  const U = W / gw;
  const { f, a } = egOf(v);
  const ax = egAxis(f, a);
  const P = (t: number, l: number): [number, number] => {
    const p = egPoint(gw, gd, ax, t, l);
    return [p.u * U, p.v * U];
  };
  g.clearRect(0, 0, W, H);
  // le verre : un noir chaud qui fonce vers le bas, son ombre interieure, un filet noir
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d0c0c');
  bg.addColorStop(1, '#060505');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const sh = 0.05 * U;
  const top = g.createLinearGradient(0, 0, 0, sh);
  top.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
  top.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = top;
  g.fillRect(0, 0, W, sh);
  for (const [x0, dir] of [
    [0, 1],
    [W, -1],
  ] as const) {
    const side = g.createLinearGradient(x0, 0, x0 + dir * sh * 0.7, 0);
    side.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    side.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = side;
    g.fillRect(dir > 0 ? 0 : W - sh * 0.7, 0, sh * 0.7, H);
  }
  // un reflet tres doux en haut du verre
  const gl = g.createLinearGradient(0, 0, 0, H * 0.5);
  gl.addColorStop(0, 'rgba(255, 250, 240, 0.035)');
  gl.addColorStop(1, 'rgba(255, 250, 240, 0)');
  g.fillStyle = gl;
  g.fillRect(0, 0, W, H * 0.5);
  const px = U / 107; // un pixel CSS de la face (a la taille de depart de la fenetre)
  // les reperes
  const [, yZero] = P(0, 0);
  const [, yOne] = P(0, 1);
  g.fillStyle = 'rgba(246, 241, 231, 0.07)';
  for (const t of [topOf(f), topOf(f) + f.D, ax.tGate]) {
    const [x] = P(t, 0);
    g.fillRect(Math.round(x - 0.4 * px), yOne - 0.02 * U, Math.max(1, 0.8 * px), yZero - yOne + 0.02 * U);
  }
  g.fillStyle = 'rgba(246, 241, 231, 0.14)';
  g.fillRect(P(0, 0)[0] - 0.03 * U, yZero - 0.4 * px, (gw - EG_PAD.l - EG_PAD.r + 0.06) * U, Math.max(1, 0.8 * px));
  const times = egTimes(f, a, ax, 480);
  const path = (e: EgSeg): [number, number][] => times.map((t) => P(t, egLevel(e, t, ax.tGate)));
  const line = (pts: [number, number][]): void => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  };
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // AMP : blanc casse, pointille
  const pa = path(a);
  line(pa);
  g.setLineDash([3 * px, 2.5 * px]);
  g.strokeStyle = 'rgba(246, 241, 231, 0.72)';
  g.lineWidth = 1.3 * px;
  g.stroke();
  g.setLineDash([]);
  // FILTER : le degrade dessous, puis le trait a l'accent et son halo
  const pf = path(f);
  line(pf);
  g.lineTo(pf[pf.length - 1][0], yZero);
  g.lineTo(pf[0][0], yZero);
  g.closePath();
  const fill = g.createLinearGradient(0, yOne, 0, yZero);
  fill.addColorStop(0, rgba(accent, 0.32));
  fill.addColorStop(1, rgba(accent, 0));
  g.fillStyle = fill;
  g.fill();
  line(pf);
  g.save();
  g.shadowColor = rgba(accent, 0.6);
  g.shadowBlur = 3 * px;
  g.strokeStyle = accent;
  g.lineWidth = 1.5 * px;
  g.stroke();
  g.restore();
  // la legende : FILTER a l'accent, AMP au blanc casse et son petit pointille
  const cap = 0.038 * U;
  g.font = `600 ${Math.round(cap * 1.38)}px ${font}`;
  (g as unknown as { letterSpacing: string }).letterSpacing = `${(cap * 0.2).toFixed(1)}px`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  const ly = 0.07 * U;
  const parts: { t: string; c: string }[] = [
    { t: 'FILTER', c: rgba(accent, 0.9) },
    { t: '  ·  ', c: 'rgba(246, 241, 231, 0.4)' },
    { t: 'AMP', c: 'rgba(246, 241, 231, 0.7)' },
  ];
  const dash = 0.075 * U;
  const widths = parts.map((p) => g.measureText(p.t).width);
  let x = W - EG_PAD.r * U - dash - 0.02 * U - widths.reduce((s, w) => s + w, 0);
  parts.forEach((p, i) => {
    g.fillStyle = p.c;
    g.fillText(p.t, x, ly);
    x += widths[i];
  });
  g.strokeStyle = 'rgba(246, 241, 231, 0.7)';
  g.lineWidth = 1.2 * px;
  g.setLineDash([2.4 * px, 2 * px]);
  g.beginPath();
  g.moveTo(x + 0.02 * U, ly);
  g.lineTo(x + 0.02 * U + dash, ly);
  g.stroke();
  g.setLineDash([]);
}

/* ---------------- la voix jouee (mm_tick.e) ---------------- */

/**
 * Le dernier etat recu : les niveaux et les etapes des deux enveloppes (1 attaque, 2 decroissance / maintien,
 * 3 relachement), le temps depuis le depart de la note et la fin de son gate (-1 : tenue), l'heure de reception ; relAt :
 * le moment du relachement depuis le depart (la fin du gate, ou, pour une voix coupee avant, le premier tick qui l'a vu).
 */
export interface EgTick {
  fV: number;
  aV: number;
  fSt: number;
  aSt: number;
  tOn: number;
  tOff: number;
  at: number;
  relAt: number;
}

/** Sous ce niveau d'amplitude, la voix est tue (dsp/Voyager.cpp VOICE_OFF). */
export const EG_OFF = 0.0005;

let cur: EgTick | null = null;
const liveL = new Set<() => void>();
const tickL = new Set<() => void>();

export const arpEg = {
  /** mm_tick.e : [fV, aV, fStage, aStage, tOn, tOff], ou [] quand plus rien ne sonne. */
  receive(o: unknown, now: number = performance.now()): void {
    const was = cur !== null;
    const x = Array.isArray(o) && o.length >= 6 && o.slice(0, 6).every((n) => typeof n === 'number' && Number.isFinite(n)) ? (o as number[]) : null;
    if (!x) {
      cur = null;
      if (was) liveL.forEach((fn) => fn());
      return;
    }
    const [fV, aV, fSt, aSt, tOn, tOff] = x;
    // une note neuve : son temps repart en arriere
    const same = cur !== null && tOn >= cur.tOn - 1e-4;
    let relAt = Infinity;
    if (aSt === 3) relAt = tOff >= 0 && tOff <= tOn + 1e-3 ? tOff : same && cur && Number.isFinite(cur.relAt) && cur.aSt === 3 ? cur.relAt : tOn;
    else if (tOff >= 0) relAt = tOff;
    cur = { fV, aV, fSt, aSt, tOn, tOff, at: now, relAt };
    if (!was) liveL.forEach((fn) => fn());
    tickL.forEach((fn) => fn());
  },
  get: (): EgTick | null => cur,
  /** une voix a montrer ? */
  live: (): boolean => cur !== null,
  /** quand une voix apparait ou se tait */
  subscribe(fn: () => void): () => void {
    liveL.add(fn);
    return () => {
      liveL.delete(fn);
    };
  },
  /** a chaque tick recu */
  onTick(fn: () => void): () => void {
    tickL.add(fn);
    return () => {
      tickL.delete(fn);
    };
  },
};

/** Ou en sont les enveloppes a l'heure now : les niveaux, le relachement (et depuis quand), le temps depuis le depart. */
export interface EgNow {
  fV: number;
  aV: number;
  tOn: number;
  rel: boolean;
  tRel: number;
  /** plus rien ne bouge d'ici le prochain tick (une note tenue, au maintien) */
  still: boolean;
}

/** Une enveloppe tenue (etape 1 ou 2) avancee de dt secondes. */
function advance(L: number, st: number, dt: number, e: EgSeg): { L: number; st: number } {
  let t = dt;
  let l = L;
  if (st === 1) {
    if (l < 1) {
      const need = tauA(e) * Math.log((1.3 - l) / 0.3);
      if (t < need) return { L: 1.3 - (1.3 - l) * Math.exp(-t / tauA(e)), st: 1 };
      t -= need;
    }
    l = 1;
  }
  return { L: e.S + (l - e.S) * Math.exp(-t / tauD(e)), st: 2 };
}

/** L'etat du dernier tick avance jusqu'a now par la loi du moteur (les potards du moment). */
export function egPredict(s: EgTick, now: number, f: EgSeg, a: EgSeg, ax: EgAxis): EgNow {
  const dt = Math.max(0, Math.min(1, (now - s.at) / 1000));
  const tOn = s.tOn + dt;
  let fV = s.fV;
  let aV = s.aV;
  let rel = s.aSt === 3;
  if (rel) {
    fV *= Math.exp(-dt / tauR(f));
    aV *= Math.exp(-dt / tauR(a));
  } else {
    const d1 = Math.min(dt, Math.max(0, s.relAt - s.tOn));
    const nf = advance(fV, s.fSt, d1, f);
    const na = advance(aV, s.aSt, d1, a);
    fV = nf.L;
    aV = na.L;
    if (dt > d1) {
      rel = true;
      fV *= Math.exp(-(dt - d1) / tauR(f));
      aV *= Math.exp(-(dt - d1) / tauR(a));
    }
  }
  const tRel = rel ? Math.max(0, tOn - (Number.isFinite(s.relAt) ? s.relAt : s.tOn)) : 0;
  const still = !rel && !Number.isFinite(s.relAt) && tOn >= ax.tGate && Math.abs(fV - f.S) < 1e-4 && Math.abs(aV - a.S) < 1e-4;
  return { fV, aV, tOn, rel, tRel, still };
}

/** Le temps dessine (l'axe commun) ou poser le point : la note tenue attend au bout du maintien, puis son relachement. */
export const egAxisTime = (n: EgNow, ax: EgAxis): number => Math.min(ax.T, n.rel ? ax.tGate + n.tRel : Math.min(n.tOn, ax.tGate));
