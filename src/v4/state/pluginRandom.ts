/**
 * RANDOM dans le plugin (2026-11-13, Mika : "le random doit aussi jouer sur les levels des tracks.. je remarque que par
 * defaut le bd est eteint pour tout.. quand je veux du random je veux vraiment du random sur toutes les fonctions").
 *
 * Le RANDOM du site (actions/patterns.ts randomPattern) ne tirait que les huit premieres voix, et laissait la grosse caisse
 * hors de presque tout : son sample changeait, jamais son niveau, sa hauteur, son DEC ni son panoramique (beats.ts COLOR,
 * "la grosse caisse garde sa couleur") ; il ne touchait ni les pistes 9 a 16 ni le niveau des pistes. Dans le plugin, un
 * RANDOM tire maintenant TOUT, sur les 16 pistes, comme un preset qu'on n'aurait jamais ecrit :
 * - les pas : le motif d'un style pour les huit premieres (beats.ts randomBeat, la recette du site), puis les pistes 9 a
 *   16 selon leur role (un kick fantome, un rim, un shaker, un charley ouvert, un clap, deux percussions, un crash) ;
 * - le son de chaque piste : un sample de son type, dans la banque et les samples perso (jamais un fichier vide) ;
 * - ses reglages : le NIVEAU (son role de mixage, corrige du RMS du sample, plus ou moins quelques dB, le kick compris),
 *   TUNE, DEC, PAN, le filtre, les envois (REVERB, DELAY, CHORUS), DIST ;
 * - les reglages de trig : PROB des fantomes, VAR (les charleys et les percussions qui bougent), uTIME, TLEN (une
 *   percussion sur 3, 5, 6 ou 7 pas), COND (un clap, un charley ouvert, un crash qui reviennent toutes les 2, 4 ou 8
 *   mesures) ;
 * - des P-LOCK : la caisse en retrig 1/32 a la fin d'une phrase, un fill de toms accordes, un ratchet de charley ;
 * - un ou deux LFO (un charley ouvert qui respire, un filtre qui balaie, une percussion qui voyage) ;
 * - les FX de toute la machine : SWING (celui du style), DRIVE, REVERB et sa taille, DELAY, son temps et son retour,
 *   CHORUS, COMP, parfois BIT.
 * Des plages sures, par role : le kick reste devant, rien ne sature, le beat se tient. Le tempo, les scenes et les mutes
 * du pattern restent ceux de Mika. Pur : le hasard (r) et la liste des samples viennent de l'appelant.
 */

import { randomBeat, type BeatStyle, type Rand } from '../audio/beats';
import type { KitFamily } from '../audio/kit';
import { LOCKS_V, type Locks, type StepLock } from '../audio/locks';
import { NEUTRAL_FX, type Fx, type Steps } from '../audio/pattern';
import { TRACK_KEYS, type StoredKit16, type TrackKey } from '../audio/tracks';
import { LEN_STEPS, RATE_DENS, type TrigRow, type TrigSet } from '../audio/trig';
import { FAMS, ROLE_PAN, condIx, trackEntry, type Rate, type TrackSpec } from './pluginFactory';

/** Les fichiers vides de la banque (a nettoyer un jour) : jamais tires. */
const EMPTY: ReadonlySet<string> = new Set(['ch/Ch 14.wav', 'ch/Ch 16.wav']);

/** Les roles des 16 pistes (leur rang dans TRACK_KEYS). */
const KICK = 0;
const SNARES: readonly number[] = [1, 4, 9, 12];
const HATS: readonly number[] = [2, 3, 10, 11];
const PERCS: readonly number[] = [5, 6, 13, 14];

export interface PluginRandom {
  style: BeatStyle;
  steps: Steps;
  fx: Fx;
  trigs: TrigSet;
  locks: Locks | null;
  tracks: StoredKit16;
}

const between = (r: Rand, a: number, b: number): number => a + (b - a) * r();
const r2 = (x: number): number => Math.round(x * 100) / 100;
const chance = (r: Rand, p: number): boolean => r() < p;
const pick = <T>(r: Rand, a: readonly T[]): T => a[Math.min(a.length - 1, Math.floor(r() * a.length))];
const int = (r: Rand, a: number, b: number): number => Math.floor(between(r, a, b + 1));
const sign = (r: Rand): number => (r() < 0.5 ? -1 : 1);
const blank = (): number[] => new Array<number>(16).fill(0);
/** n positions tirees dans cand, sans doublon */
function some<T>(r: Rand, cand: readonly T[], n: number): T[] {
  const pool = [...cand];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}
/** k coups repartis sur n pas (euclidien), tournes de rot */
function euclid(k: number, n: number, rot: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) if (Math.floor(((i + rot) * k) / n) !== Math.floor(((i + rot - 1) * k) / n)) out.push(i);
  return out;
}

/**
 * Un RANDOM complet : current (le motif d'avant, pour s'en eloigner), last (le style d'avant, pour en changer), samples
 * (les cles des samples d'un type, dans l'ordre de la liste), r (le hasard, Math.random par defaut).
 */
export function pluginRandom(current: Steps, last: BeatStyle | null, samples: (f: KitFamily) => readonly string[], r: Rand = Math.random): PluginRandom {
  const beat = randomBeat(current, last, r);
  const rows: number[][] = TRACK_KEYS.map((k) => {
    const s = (beat.steps as Partial<Record<TrackKey, string>>)[k];
    return s && /^[0-9]{16}$/.test(s) ? s.split('').map(Number) : blank();
  });
  const trigs: Partial<Record<TrackKey, TrigRow>> = {};
  const locks: Partial<Record<TrackKey, Record<string, StepLock>>> = {};
  const trig = (i: number, row: TrigRow): void => {
    trigs[TRACK_KEYS[i]] = { ...(trigs[TRACK_KEYS[i]] ?? {}), ...row };
  };
  const lock = (i: number, step: number, l: StepLock): void => {
    const k = TRACK_KEYS[i];
    locks[k] = { ...(locks[k] ?? {}), [String(step)]: l };
  };
  const bd = rows[KICK];

  /* ---- les pistes 9 a 16, chacune son role ---- */
  // T9, le kick fantome : 1 a 3 doubles croches a cote des temps, une fois sur deux ou trois
  if (chance(r, 0.45)) {
    for (const i of some(r, [2, 3, 6, 7, 10, 11, 14, 15].filter((x) => bd[x] === 0), int(r, 1, 3))) rows[8][i] = int(r, 3, 5);
    trig(8, { prob: int(r, 50, 85) });
  }
  // T10, le rim : 2 a 4 coups hors du backbeat
  if (chance(r, 0.55)) {
    for (const i of some(r, [1, 2, 3, 6, 7, 9, 10, 11, 14, 15], int(r, 2, 4))) rows[9][i] = int(r, 3, 6);
    if (chance(r, 0.5)) trig(9, { prob: int(r, 65, 95) });
  }
  // T11, le shaker : les doubles croches, les doubles croches decalees ou les contretemps ; il ne frappe jamais pareil
  if (chance(r, 0.5)) {
    const mode = pick(r, ['16', 'odd', 'off'] as const);
    for (let i = 0; i < 16; i += 1) {
      if (mode === '16') rows[10][i] = i % 2 === 0 ? int(r, 3, 5) : 2;
      else if (mode === 'odd' && i % 2 === 1) rows[10][i] = int(r, 2, 4);
      else if (mode === 'off' && i % 4 === 2) rows[10][i] = int(r, 3, 5);
    }
    trig(10, { vlev: int(r, 25, 40), ...(chance(r, 0.5) ? { vpan: int(r, 10, 25) } : {}), ...(chance(r, 0.4) ? { prob: int(r, 75, 95) } : {}) });
  }
  // T12, un charley ouvert de plus (sur le "et" de 2 ou de 4)
  if (chance(r, 0.25) && rows[10].every((v) => v === 0)) {
    for (const i of pick(r, [[14], [6], [6, 14]])) rows[11][i] = int(r, 5, 6);
    if (chance(r, 0.5)) trig(11, { cond: condIx('2:2') });
  }
  // T13, un clap de relance, toutes les 2 ou 4 mesures
  if (chance(r, 0.35)) {
    for (const i of pick(r, [[15], [7], [11], [7, 15]])) rows[12][i] = int(r, 3, 6);
    const c = pick(r, ['', '2:2', '4:4']);
    if (c) trig(12, { cond: condIx(c) });
  }
  // T14 et T15, deux percussions : sur 3, 5, 6 ou 7 pas (la polymetrie), ou un euclidien sur 16
  for (const i of [13, 14]) {
    if (!chance(r, 0.45)) continue;
    if (chance(r, 0.35)) {
      const n = pick(r, [3, 5, 6, 7]);
      for (const s of some(r, Array.from({ length: n }, (_, x) => x), int(r, 1, 2))) rows[i][s] = int(r, 4, 7);
      trig(i, { tlen: n });
    } else {
      for (const s of euclid(int(r, 2, 5), 16, int(r, 0, 15))) rows[i][s] = int(r, 4, 7);
    }
    trig(i, { vtun: int(r, 2, 6), vlev: int(r, 10, 20) });
  }
  // T16 : le crash d'une phrase de 8, ou une ride sur les contretemps (si CY ne fait rien)
  if (rows[7].every((v) => v === 0)) {
    if (chance(r, 0.5)) {
      rows[15][0] = 7;
      trig(15, { cond: condIx('1:8') });
    } else if (chance(r, 0.3)) {
      for (const i of [2, 6, 10, 14]) rows[15][i] = 5;
      trig(15, { vlev: 20 });
    }
  }

  /* ---- les gestes des huit premieres ---- */
  // Les charleys et les percussions qui bougent ; le clap et la caisse un rien en retard
  if (chance(r, 0.7)) trig(2, { vlev: int(r, 10, 25) });
  for (const i of [5, 6]) if (rows[i].some((v) => v > 0) && chance(r, 0.5)) trig(i, { vtun: int(r, 2, 5) });
  if (chance(r, 0.4)) trig(4, { utime: int(r, 1, 3) });
  if (chance(r, 0.3)) trig(1, { utime: int(r, 1, 2) });
  // La caisse en retrig 1/32 qui monte a la fin d'une phrase de 4 ou de 8
  if (rows[1][12] > 0 && chance(r, 0.3)) {
    rows[1][15] = Math.max(rows[1][15], 4);
    lock(1, 15, { cond: condIx(pick(r, ['4:4', '8:8'])), rtrg: 1, rate: RATE_DENS.indexOf(32), vfad: int(r, 32, 44) });
  }
  // Un fill de toms accordes, toutes les 4 mesures
  if (rows[5].slice(13).every((v) => v === 0) && chance(r, 0.3)) {
    const tunes = pick(r, [[5, 2, -2], [7, 3, 0], [0, -3, -7]]);
    [13, 14, 15].forEach((s, k) => {
      rows[5][s] = 7 - k;
      lock(5, s, { cond: condIx('4:4'), tune: tunes[k] / 24 });
    });
  }
  // Un ratchet de charley une fois sur deux
  if (rows[2][15] > 0 && chance(r, 0.25)) lock(2, 15, { rtrg: 1, rate: RATE_DENS.indexOf(32), vfad: -20, prob: 60, rlen: LEN_STEPS.indexOf(1) });

  /* ---- le son et les reglages de chaque piste ---- */
  const lfoAt = new Map<number, TrackSpec>();
  // Un ou deux LFO : le charley ouvert qui respire, un filtre qui balaie les charleys, une percussion qui voyage
  const lfos = some(r, ['breath', 'sweep', 'pan', 'pitch'] as const, int(r, 0, 2));
  for (const kind of lfos) {
    if (kind === 'breath' && rows[3].some((v) => v > 0)) lfoAt.set(3, { decay: r2(between(r, 0.58, 0.66)), lfo: { d: 'DECAY', r: pick(r, ['1B', '2B', '4B'] as Rate[]), dep: int(r, 8, 14), w: 'SINE' } });
    if (kind === 'sweep') lfoAt.set(2, { ft: 'LP', cut: r2(between(r, 0.84, 0.9)), db: 2, lfo: { d: 'FREQ', r: pick(r, ['2B', '4B'] as Rate[]), dep: int(r, 10, 16), w: 'SINE' } });
    const perc = PERCS.filter((i) => rows[i].some((v) => v > 0));
    if (kind === 'pan' && perc.length > 0) lfoAt.set(pick(r, perc), { lfo: { d: 'PAN', r: pick(r, ['1B', '2B'] as Rate[]), dep: int(r, 16, 30), w: 'SINE' } });
    if (kind === 'pitch' && perc.length > 0) lfoAt.set(pick(r, perc), { lfo: { d: 'PITCH', r: '4B', dep: int(r, 2, 4), w: 'SINE' } });
  }
  const t: NonNullable<StoredKit16['t']> = {};
  TRACK_KEYS.forEach((key, i) => {
    const fam = FAMS[i % 8];
    const list = samples(fam).filter((k) => !EMPTY.has(k));
    if (list.length === 0) return;
    const q: TrackSpec = {};
    const kick = i === KICK;
    const snare = SNARES.includes(i);
    const hat = HATS.includes(i);
    const perc = PERCS.includes(i);
    // Le niveau : son role, plus ou moins quelques dB (le kick aussi, sans jamais passer derriere)
    // (les percussions et les charleys plutot vers le bas : un sample long, accorde plus haut et frappe souvent passe
    // vite devant, mesure au rendu du moteur)
    q.db = r2(kick ? between(r, -2, 1.5) : perc ? between(r, -7, 0) : hat ? between(r, -5, 2) : between(r, -3, 2));
    // La hauteur, en demi-tons
    const range = kick ? 3 : perc ? 7 : snare ? 4 : 3;
    if (chance(r, kick ? 0.4 : perc ? 0.7 : 0.45)) q.tune = sign(r) * int(r, 1, range);
    // DEC : souvent la longueur du sample, sinon plus court
    if (chance(r, kick ? 0.5 : hat ? 0.6 : 0.45)) q.decay = r2(kick ? between(r, 0.7, 0.95) : hat ? between(r, 0.35, 0.9) : between(r, 0.45, 0.92));
    // PAN : le kick au centre, la caisse et le clap presque ; le reste de son cote, ou de l'autre
    if (!kick) q.pan = snare && i !== 9 ? (chance(r, 0.2) ? r2(sign(r) * between(r, 0.05, 0.12)) : 0) : r2(Math.max(-0.7, Math.min(0.7, ROLE_PAN[i] * sign(r) + between(r, -0.15, 0.15))));
    // Le filtre
    if (chance(r, kick ? 0.12 : hat ? 0.3 : perc ? 0.25 : 0.15)) {
      // La caisse et le clap jamais en passe-bande (le backbeat s'y perdait)
      const ft = kick ? 'LP' : hat || snare ? pick(r, ['LP', 'HP'] as const) : pick(r, ['LP', 'HP', 'BP'] as const);
      q.ft = ft;
      q.cut = r2(ft === 'HP' ? between(r, 0.3, snare ? 0.45 : 0.6) : ft === 'BP' ? between(r, 0.5, 0.75) : kick ? between(r, 0.62, 0.85) : between(r, snare ? 0.75 : 0.7, 0.95));
      if (chance(r, 0.5)) q.res = r2(between(r, 0.05, 0.35));
    }
    // Les envois et DIST
    if (kick) {
      if (chance(r, 0.1)) q.reverb = r2(between(r, 0.02, 0.08));
      if (chance(r, 0.3)) q.dist = r2(between(r, 0.05, 0.3));
    } else {
      if (chance(r, 0.45)) q.reverb = r2(between(r, 0.05, 0.35));
      if (chance(r, perc || i === 9 || i === 12 ? 0.45 : 0.25)) q.delay = r2(between(r, 0.08, 0.35));
      if (chance(r, 0.1)) q.chorus = r2(between(r, 0.1, 0.3));
      if (chance(r, snare ? 0.2 : 0.1)) q.dist = r2(between(r, 0.05, 0.25));
    }
    const l = lfoAt.get(i);
    if (l) Object.assign(q, l, { db: r2((q.db ?? 0) + (l.db ?? 0)) });
    t[key] = trackEntry(i, pick(r, list), q);
  });

  /* ---- les FX de toute la machine ---- */
  const fx: Fx = {
    ...NEUTRAL_FX,
    swing: beat.swing,
    drive: r2(between(r, 0, 0.3)),
    reverb: r2(between(r, 0.08, 0.3)),
    rsize: r2(between(r, 0.45, 0.75)),
    delay: r2(between(r, 0, 0.22)),
    dtime: pick(r, [0.2, 0.4, 0.6]),
    dfb: r2(between(r, 0.4, 0.7)),
    chorus: chance(r, 0.4) ? r2(between(r, 0.05, 0.2)) : 0,
    comp: r2(between(r, 0, 0.3)),
    bits: chance(r, 0.15) ? r2(between(r, 0.05, 0.25)) : 0,
  };

  const steps = Object.fromEntries(TRACK_KEYS.map((k, i) => [k, rows[i].map((v) => Math.max(0, Math.min(9, v))).join('')])) as unknown as Steps;
  const anyLock = Object.keys(locks).length > 0;
  return { style: beat.style, steps, fx, trigs, locks: anyLock ? ({ ...locks, v: LOCKS_V } as Locks) : null, tracks: { v: 1, t } };
}
