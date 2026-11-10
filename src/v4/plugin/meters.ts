/**
 * Les niveaux du moteur (2026-11-10, Mika : "VU-metres", le niveau de sortie reel) : le C++ envoie a 30 Hz la crete de
 * chaque piste (apres ses effets de tranche, a LEVEL) et celle de la sortie L et R (mm_meter, plugin/bridge.ts) ; ici, la
 * balistique d'un VU de console : l'aiguille monte tout de suite et redescend en ~300 ms, un pic tenu 1 s. Les valeurs
 * montrees sont en part de l'echelle (-48 dB a 0 dB). Module sans dependance (le renderer et le mini ecran le lisent).
 */

import { extHead } from './head';

const N = 16;
/** La descente : 20 dB par seconde, comme un PPM doux. */
const FALL_DB_S = 20;
const HOLD_MS = 1000;
const FLOOR_DB = -48;

const db = (v: number): number => (v > 1e-6 ? 20 * Math.log10(v) : -120);
const part = (d: number): number => Math.max(0, Math.min(1, (d - FLOOR_DB) / -FLOOR_DB));

interface Ch {
  /** dB montres */
  d: number;
  /** pic tenu (dB) et son heure */
  pk: number;
  pkAt: number;
}
const mk = (): Ch => ({ d: -120, pk: -120, pkAt: 0 });
const tracks: Ch[] = Array.from({ length: N }, mk);
const master: Ch[] = [mk(), mk()];
let last = 0;
let seen = false;

function fall(c: Ch, dt: number, now: number): void {
  c.d = Math.max(-120, c.d - FALL_DB_S * dt);
  if (now - c.pkAt > HOLD_MS) c.pk = Math.max(c.d, c.pk - FALL_DB_S * 1.5 * dt);
}
function hit(c: Ch, v: number, now: number): void {
  const d = db(v);
  if (d > c.d) c.d = d;
  if (d >= c.pk) {
    c.pk = d;
    c.pkAt = now;
  }
}
function advance(now: number): void {
  const dt = last ? Math.min(0.5, (now - last) / 1000) : 0;
  last = now;
  if (dt <= 0) return;
  for (const c of tracks) fall(c, dt, now);
  for (const c of master) fall(c, dt, now);
}

export interface MeterView {
  /** 16 pistes, 0 a 1 (l'echelle de -48 a 0 dB) */
  t: number[];
  /** leurs pics tenus */
  tp: number[];
  l: number;
  r: number;
  lp: number;
  rp: number;
  /** une sortie au-dessus de -0.5 dB depuis moins d'une seconde */
  clip: boolean;
  /** quelque chose bouge encore (une frame de plus) */
  live: boolean;
}

export const meters = {
  /** Les cretes recues du C++ (lineaires, 1 = 0 dBFS). */
  push(t: readonly number[], l: number, r: number, now: number = performance.now()): void {
    advance(now);
    for (let i = 0; i < N; i += 1) hit(tracks[i], Number(t[i]) || 0, now);
    hit(master[0], l, now);
    hit(master[1], r, now);
    seen = true;
    extHead.wake();
  },
  /** Le C++ a envoye des niveaux (le plugin) : sans eux, le mini ecran n'en montre pas. */
  seen: (): boolean => seen,
  view(now: number = performance.now()): MeterView {
    advance(now);
    const t = tracks.map((c) => part(c.d));
    const tp = tracks.map((c) => part(c.pk));
    const [L, R] = master;
    const live = tracks.some((c) => c.d > FLOOR_DB || c.pk > FLOOR_DB) || L.d > FLOOR_DB || R.d > FLOOR_DB || L.pk > FLOOR_DB || R.pk > FLOOR_DB;
    const clip = (L.pk > -0.5 || R.pk > -0.5) && now - Math.max(L.pkAt, R.pkAt) < HOLD_MS;
    return { t, tp, l: part(L.d), r: part(R.d), lp: part(L.pk), rp: part(R.pk), clip, live };
  },
};
