/**
 * Le sequenceur des trigs du MM-RYTM (V.5.1, 2026-10-29, l'etape D2 facon Digitakt, docs/v4/digitakt-d2-spec.md
 * sections 2 et 3) : ce que fait un pas, voix par voix, d'apres ses velocites, ses verrous et les reglages de trig du
 * pattern. Le MEME calcul pour l'horloge (audio/clock.ts schedule) et le rendu hors ligne (audio/drums.ts renderOffline) :
 * ce que les tests mesurent est ce qu'on entend.
 * - COND et PROB : une COND autre que NONE gagne sur PROB ; le resultat evalue (une PROB tiree aussi) devient celui de la
 *   voix (PRE) et de sa voisine (NEI, la voix d'avant dans l'ordre des pads ; BD n'en a pas) ; un trig sans COND ni PROB
 *   ne le change pas. PROB tire dans son propre generateur (jamais Math.random : le rendu hors ligne le fixe pour la
 *   rotation des variantes, l'identite audio en depend).
 * - uTIME : l'heure du coup decalee de n / 24 de pas.
 * - RTRG : les repetitions a RATE pendant RLEN, une fenetre de pas a la fois (chaque pas programme emet celles qui
 *   tombent dans sa duree) ; elles s'arretent au trig suivant de la voix qui joue, au mute de la voix, a la fin de RLEN.
 * - Lock trig : un pas sans velocite dont le verrou ltrg vaut 1 ; il ne joue pas, ses verrous vont au coup de la voix qui
 *   sonne encore (audio/drums.ts lockTrig).
 * - LFO.T : le trig (note ou lock) relance les LFO de la voix (leur ancre).
 * A tous les reglages au depart, chaque pas rend exactement les coups d'avant : memes voix, memes heures, memes
 * velocites, memes verrous (l'identite audio de la section 0). Pur : aucun store, aucun moteur ; l'appelant execute.
 */

import type { Inst } from '../theme';
import { INSTRUMENTS, VEL_GAIN, velocity, type Steps } from './pattern';
import { hitLock, lockOf, type Locks, type StepLock } from './locks';
import { CONDS, condTrue, rtrgGain, trigNow, makeRng, type CondCtx, type TrigSet } from './trig';
import { activeLfos, type Lfo } from './lfo';

/** Un retrig en cours sur une voix. */
interface Retrig {
  /** la position du trig (en pas depuis PLAY, swing et uTIME compris) */
  pos: number;
  /** l'ecart des repetitions, en pas */
  every: number;
  /** la fin (position) ; Infinity : RLEN INF, jusqu'au trig suivant */
  end: number;
  /** la duree sur laquelle VFAD mene la velocite, en pas */
  span: number;
  vfad: number;
  /** la velocite du trig, en gain */
  vel: number;
  lock: Readonly<StepLock> | null;
  /** LEN en pas ; null : INF */
  len: number | null;
  lfos: Lfo[];
}

/** Ce que le sequenceur garde d'une voix d'un pas a l'autre. */
export interface SeqVoice {
  /** le dernier resultat evalue (PRE, et NEI pour la voix d'apres) ; null : aucun */
  pre: boolean | null;
  /** la position du dernier trig qui a relance ses LFO (0 : PLAY) */
  anchor: number;
  rt: Retrig | null;
  /** le dernier coup programme de la voix (opaque ici : la voix de audio/drums.ts), celui qu'un lock trig touche */
  last: unknown;
}

export interface SeqState {
  v: Record<Inst, SeqVoice>;
  /** l'etat du generateur de PROB */
  rng: number;
}

export function seqState(seed: number): SeqState {
  const v = {} as Record<Inst, SeqVoice>;
  for (const inst of INSTRUMENTS) v[inst] = { pre: null, anchor: 0, rt: null, last: null };
  return { v, rng: seed >>> 0 };
}

/** Une copie (l'horloge en garde une par pas programme : une re-programmation repart de celle de son premier pas). */
export function cloneSeq(s: SeqState): SeqState {
  const v = {} as Record<Inst, SeqVoice>;
  for (const inst of INSTRUMENTS) v[inst] = { ...s.v[inst] };
  return { v, rng: s.rng };
}

/** Les LFO d'un coup : leur liste, la position du coup et l'ancre (en pas), la duree d'un pas (s). */
export interface HitLfo {
  list: Lfo[];
  pos: number;
  anchor: number;
  dur: number;
}

/** Un coup a jouer. */
export interface SeqHit {
  inst: Inst;
  /** son heure (temps du contexte) */
  t: number;
  /** sa velocite, en gain */
  vel: number;
  /** ses verrous tels que le coup les lit (sans ceux du sequenceur) */
  lock: Readonly<StepLock> | null;
  /** LEN en secondes ; null : INF (rien ne coupe) */
  len: number | null;
  lfo: HitLfo | null;
  /** une repetition d'un retrig (ou le trig qui en lance un) : la repetition d'apres le coupe (une voix, un coup a la fois) */
  roll: boolean;
  /** le pas (0 a 15) */
  step: number;
  rep: boolean;
}

/** Un lock trig a appliquer. */
export interface SeqLockTrig {
  inst: Inst;
  t: number;
  /** ses verrous (sans ceux du sequenceur) ; null : aucun */
  lock: Readonly<StepLock> | null;
  /** le coup qui sonne (la voix de drums.ts) ; null : aucun */
  last: unknown;
  /** la nouvelle ancre des LFO (LFO.T ON), en pas ; null : pas de relance */
  anchor: number | null;
  step: number;
}

export interface SeqIn {
  /** le pas (0 a 15) et sa position depuis PLAY (en pas) */
  s: number;
  pos: number;
  /** son heure (swing compris) et sa grille ; la duree d'un pas (s) */
  when: number;
  grid: number;
  dur: number;
  steps: Steps;
  locks: Readonly<Locks> | null | undefined;
  trigs: Readonly<TrigSet> | null | undefined;
  ctx: CondCtx;
  /** la voix joue-t-elle (MUTE, SOLO, le mute du pattern) */
  plays(inst: Inst): boolean;
  /** les reglages de LFO de la voix (ses reglages de voix) */
  fxOf(inst: Inst): Readonly<Partial<Record<string, number>>> | null;
}

export interface SeqOut {
  hits: SeqHit[];
  locks: SeqLockTrig[];
}

const EPS = 1e-9;

/** Les repetitions du retrig rt dans la fenetre [from, to) (positions), avant `before` ; anchor : l'ancre des LFO de la voix. */
function repeats(inst: Inst, rt: Retrig, inp: SeqIn, from: number, to: number, before: number, anchor: number, out: SeqHit[]): boolean {
  let k = Math.max(1, Math.ceil((from - rt.pos) / rt.every - EPS));
  for (; ; k += 1) {
    const rp = rt.pos + k * rt.every;
    if (rp >= to - EPS || rp >= before - EPS) return true;
    if (rp >= rt.end - EPS) return false;
    out.push({
      inst,
      t: inp.grid + (rp - inp.pos) * inp.dur,
      vel: rtrgGain(rt.vel, rt.vfad, (rp - rt.pos) / rt.span),
      lock: rt.lock,
      len: rt.len === null ? null : rt.len * inp.dur,
      lfo: rt.lfos.length > 0 ? { list: rt.lfos, pos: rp, anchor, dur: inp.dur } : null,
      roll: true,
      step: inp.s,
      rep: true,
    });
  }
}

/**
 * Un pas : ses coups et ses lock trigs, voix par voix dans l'ordre des pads (au depart : exactement la boucle d'avant,
 * un coup par voix dont le pas a une velocite).
 */
export function seqStep(st: SeqState, inp: SeqIn): SeqOut {
  const hits: SeqHit[] = [];
  const locks: SeqLockTrig[] = [];
  const rng = makeRng(st.rng);
  let drew = false;
  let prev: Inst | null = null;
  const end = inp.pos + 1;
  for (const inst of INSTRUMENTS) {
    const sv = st.v[inst];
    const nei = prev ? st.v[prev].pre : null;
    prev = inst;
    const vel = velocity(inp.steps, inst, inp.s);
    const raw = lockOf(inp.locks, inst, inp.s);
    const lockTrig = vel === 0 && raw?.ltrg === 1;
    const plays = inp.plays(inst);
    // Le mute de la voix arrete son retrig
    if (!plays) sv.rt = null;
    if (vel === 0 && !lockTrig) {
      if (sv.rt && !repeats(inst, sv.rt, inp, inp.pos, end, Infinity, sv.anchor, hits)) sv.rt = null;
      continue;
    }
    const tn = trigNow(inp.trigs, inst, raw);
    // La condition : une COND gagne sur PROB ; un trig sans l'une ni l'autre ne change pas le resultat de la voix
    let ok = true;
    if (tn.cond !== 0) {
      ok = condTrue(CONDS[tn.cond], inp.ctx, sv.pre, nei);
      sv.pre = ok;
    } else if (tn.prob < 100) {
      ok = rng.next() * 100 < tn.prob;
      drew = true;
      sv.pre = ok;
    }
    const swing = (inp.when - inp.grid) / inp.dur;
    const pos = inp.pos + swing + tn.shift;
    const t = tn.shift === 0 ? inp.when : inp.when + tn.shift * inp.dur;
    if (lockTrig) {
      if (sv.rt && !repeats(inst, sv.rt, inp, inp.pos, end, Infinity, sv.anchor, hits)) sv.rt = null;
      if (!ok) continue;
      if (tn.lfot) sv.anchor = pos;
      const lk = hitLock(raw);
      if (lk || tn.lfot) locks.push({ inst, t, lock: lk, last: sv.last, anchor: tn.lfot ? pos : null, step: inp.s });
      continue;
    }
    if (!ok || !plays) {
      if (sv.rt && !repeats(inst, sv.rt, inp, inp.pos, end, Infinity, sv.anchor, hits)) sv.rt = null;
      continue;
    }
    // Le trig joue : le retrig d'avant s'arrete a son heure (ses repetitions d'avant lui partent)
    if (sv.rt) {
      repeats(inst, sv.rt, inp, inp.pos, end, pos, sv.anchor, hits);
      sv.rt = null;
    }
    if (tn.lfot) sv.anchor = pos;
    const fx = inp.fxOf(inst);
    const lfos = fx || raw ? activeLfos(fx, raw) : [];
    const lk = hitLock(raw);
    const g = VEL_GAIN[vel];
    hits.push({
      inst,
      t,
      vel: g,
      lock: lk,
      len: tn.len === null ? null : tn.len * inp.dur,
      lfo: lfos.length > 0 ? { list: lfos, pos, anchor: sv.anchor, dur: inp.dur } : null,
      roll: tn.rtrg,
      step: inp.s,
      rep: false,
    });
    if (tn.rtrg) {
      const rt: Retrig = { pos, every: tn.every, end: tn.rlen === null ? Infinity : pos + tn.rlen, span: tn.rlen ?? 16, vfad: tn.vfad, vel: g, lock: lk, len: tn.len, lfos };
      sv.rt = rt;
      if (!repeats(inst, rt, inp, pos, end, Infinity, sv.anchor, hits)) sv.rt = null;
    }
  }
  if (drew) st.rng = rng.state;
  return { hits, locks };
}

/** Le dernier coup d'une voix (l'appelant le pose apres l'avoir joue) : un lock trig plus loin s'y applique. */
export function seqLast(st: SeqState, inst: Inst, v: unknown): void {
  st.v[inst].last = v;
}

/** Le premier instant d'un pas (le plus en avance de ses coups : uTIME negatif) : l'horloge l'anticipe d'autant. */
export function earliestShift(trigs: Readonly<TrigSet> | null | undefined, locks: Readonly<Locks> | null | undefined): number {
  let m = 0;
  for (const inst of INSTRUMENTS) {
    const d = trigs?.[inst]?.utime;
    if (typeof d === 'number' && d < m) m = d;
    const row = locks?.[inst];
    if (!row) continue;
    for (const l of Object.values(row)) {
      const u = l.utime;
      if (typeof u === 'number' && u < m) m = u;
    }
  }
  return m / 24;
}
