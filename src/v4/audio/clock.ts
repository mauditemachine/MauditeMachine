/**
 * Horloge du sequenceur (spec 9) : ordonnancement par anticipation sur
 * l'horloge AUDIO. Un setInterval de 25 ms reveille l'ordonnanceur, qui
 * programme sur ctx.currentTime chaque pas tombant dans l'horizon (300 ms
 * depuis le 2026-10-05, audio/sched.ts ; 100 ms avant).
 * La grille est exacte : nextTime = ancre + n x stepDur, jamais une
 * mesure du temps ecoule ni une somme de pas (revue de la revision 2 : la
 * somme derivait de 1e-8 ms par minute, en flottants), et un pas programme
 * ne bouge plus. Le minuteur ne donne jamais l'heure (pas de setTimeout
 * seul) : un reveil en retard programme plus pres de l'echeance, il ne
 * decale rien.
 *
 * Le rendu (LED, flash des pads, Dock) suit la position AUDIO avec
 * entryAt(ctx.currentTime), pas l'instant de programmation qui la precede
 * de l'horizon au plus. onStep() previent a chaque pas programme (reveil de la
 * boucle de rendu). CLEAR vide le motif sans arreter la lecture. STOP
 * annule les coups deja programmes qui n'ont pas encore sonne : un RUN
 * juste apres ne les entend pas par-dessus son premier pas, et une piste
 * SoundCloud qui demarre n'a pas de batterie sur ses premieres notes.
 *
 * SWING (revision 2, spec 20.8) : les pas pairs (2, 4 ... 16, index
 * impairs) partent en retard de swing x un tiers de pas, sur le temps
 * programme lui-meme (jamais un minuteur) ; la grille attendue du journal
 * (expected) porte le meme retard, drift() se mesure donc contre la grille
 * swinguee. La valeur est lue a chaque pas programme.
 *
 * L'avance (2026-10-05, audio/sched.ts ; Mika : "des que je fais un petit
 * truc le son se coupe") : 300 ms devant (450 au telephone) au lieu de 100,
 * et une re-programmation a chaque changement (un pas, un mute ou un solo,
 * un son du kit, un reglage de voix, TONE, STRETCH, le tempo, le swing) :
 * les coups pas encore partis (au-dela de 30 ms) sont annules et refaits,
 * on entend le changement au pas suivant. Un tempo part du premier pas
 * re-programme (plus d'attente de l'horizon). Les pas d'une mesure deja
 * finie gardent leur motif (la chaine des patterns change de pattern au
 * debut de la mesure suivante, avant que ses pas soient programmes), et le
 * debut d'une mesure ne previent qu'une fois (onBar), meme re-programme ou
 * saute.
 *
 * Les verrous (2026-10-08, l'etape R2 des parameter locks, audio/locks.ts) :
 * chaque coup programme recoit les verrous de son pas (trigger(..., lock)) ;
 * un pas d'une mesure finie re-programme garde le motif ET les verrous
 * d'alors (Snap), comme ses pas. Poser un verrou pendant la lecture
 * re-programme (le store du motif change) : on l'entend au pas suivant.
 *
 * Le sequenceur des trigs (V.5.1, 2026-10-29, l'etape D2 facon Digitakt, audio/seq.ts) : chaque pas passe par seqStep
 * (COND, PROB, uTIME, LEN, RTRG, les lock trigs, les LFO), le meme calcul que le rendu hors ligne ; son etat (le dernier
 * resultat de chaque voix, ses retrigs, l'ancre de ses LFO, le tirage de PROB) est copie a chaque pas programme, une
 * re-programmation repart de celui de son premier pas. Le compteur de passages (A:B, 1ST) vit ici : 1 a RUN et a chaque
 * changement de pattern (resetPass, state/patterns.ts), +1 a chaque debut de mesure ; la pause le garde, STOP le remet a 1.
 * Un uTIME negatif avance l'horizon d'autant : le coup du pas 1 tombe a la fin de la mesure d'avant, jamais en retard.
 */

import { voices } from '../state/voices';
import { sceneCtl } from '../state/sceneCtl';
import { DT_FACE, PORTRAIT, SWING, XFADE_UI, type Inst } from '../theme';
import { voiceFx } from './voicefx';
import { kit } from './kit';
import { cancelVoice, context, lockTrig, mix, trigger, type HitSeq, type Voice } from './drums';
import { shots } from './shots';
import { INSTRUMENTS, STEP_COUNT, pattern, type Steps } from './pattern';
import type { Locks } from './locks';
import { cloneSeq, earliestShift, seqLast, seqState, seqStep, type SeqState } from './seq';
import { liveNeeds } from './seqhit';
import type { TrigSet } from './trig';
import { LFO_PARAMS } from './lfo';
import { fill } from '../state/fill';
import { morph } from './morph';
import type { SceneSet } from '../rytm/sceneData';
import { DROP_AFTER_S, GUARD_S, TICK_MS, askReschedule, askRescheduleAll, extraGrid, horizon, registerScheduler, type Scheduler } from './sched';

export { LOOKAHEAD_S, TICK_MS } from './sched';
/** Premier pas 50 ms apres RUN : le debut se programme proprement. */
const START_DELAY_S = 0.05;
/** Garde-fou d'une boucle de programmation (une reserve de 4 s a 200 BPM tient dedans). */
const MAX_PER_TICK = 96;
const RING = 64;

/** Un pas programme. */
export interface StepEvent {
  /** numero global croissant */
  seq: number;
  /** 0 a 15 */
  step: number;
  /** instant programme, temps du contexte (la grille, swing compris) */
  when: number;
  /** grille ideale : ancre + n x duree du pas + retard du swing */
  expected: number;
  /** ctx.currentTime au moment de la programmation */
  at: number;
  /** instruments joues : bit k = INSTRUMENTS[k] */
  mask: number;
  /** retard du swing (s) : 0 sur les pas impairs (1, 3 ... 15) */
  off: number;
}

export interface Drift {
  /** ecart |when - expected| : max et moyenne, en ms, depuis RUN (ou resetStats) */
  maxMs: number;
  meanMs: number;
  /** pas programmes apres leur echeance (at > when) : 0 dans un onglet au premier plan */
  lateMs: number;
  lateCount: number;
  /** pas programmes et pas sautes (DROP_AFTER_S) */
  count: number;
  dropped: number;
  /** avance minimale d'une programmation (when - at), en ms */
  minLeadMs: number;
  /** plus long intervalle entre deux reveils, en ms */
  maxTickGapMs: number;
  ticks: number;
}

export const stepDuration = (bpm: number): number => 60 / bpm / 4;

let running = false;
let timer = 0;
let bpm = pattern.get().bpm;
let stepDur = stepDuration(bpm);
/** nouvelle duree en attente de la prochaine frontiere de pas ; 0 = aucune */
let pendingDur = 0;
let anchor = 0;
let n = 0;
let nextTime = 0;
let step = 0;
let seq = 0;
/** le numero du pas depuis RUN (jamais remis a zero par un tempo) */
let abs = 0;
/** le dernier debut de mesure annonce (onBar) : une fois chacun */
let barAbs = -1;
/** onBar en cours : le pattern qu'il pose ne re-programme rien (il vaut pour la mesure qui commence) */
let inBar = false;
/** l'heure audio de la mesure annoncee (2026-10-27, barAt : les scenes d'un pattern arrivent sur son temps fort) */
let barTime = 0;
/** premier seq de la lecture en cours */
let runFirst = 0;
/** le journal des pas programmes, du plus ancien au plus recent (RING au plus) */
const journal: StepEvent[] = [];
/** voix programmees par la lecture en cours, pas encore toutes parties */
const pending: Voice[] = [];

/** Le motif d'un pas programme : ses pas et leurs verrous (2026-10-08). */
interface Snap {
  steps: Steps;
  locks: Readonly<Locks>;
  /** ses scenes A et B (2026-10-27) : un pas rejoue d'une mesure finie garde celles de son pattern, au x du moment */
  scenes: SceneSet;
  /** ses reglages de trig (V.5.1) et le passage du pattern ou il joue (le compteur de passages) */
  trigs: Readonly<TrigSet>;
  pass: number;
}

/** Un pas programme qui n'a peut-etre pas encore sonne : de quoi le refaire. */
interface Planned {
  abs: number;
  step: number;
  /** la grille (sans le swing) et l'instant programme */
  grid: number;
  when: number;
  voices: Voice[];
  /** le motif qui l'a joue, ses verrous compris (une mesure finie garde le sien) */
  snap: Snap;
  seq: number;
  /** V.5.1 : l'etat du sequenceur des trigs juste avant ce pas ; le premier et le dernier instant de ses coups (uTIME, RTRG) */
  seqBefore: SeqState;
  first: number;
  last: number;
}
const plan: Planned[] = [];
/** re-programmation en cours : le motif (et ses verrous) des pas d'une mesure deja finie */
const replay = new Map<number, Snap>();
/** Aucune voix coupee par le pattern (le telephone, V.5.0). */
const NO_PM: readonly Inst[] = [];
/** repli sans WebGL affiche : plus de machine, RUN refuse (index.tsx) */
let locked = false;
/**
 * La pause de PLAY (V.5.0, 2026-10-29, la face facon Digitakt) : le pas ou la lecture reprendra (-1 : pas en pause). STOP,
 * RUN/STOP et un RUN frais l'oublient ; PLAY en pause reprend a ce pas.
 */
let resumeAt = -1;
/** Le dernier pas entendu avant la pause (-1 : aucun) : la tete de lecture y reste (la revue de D1, R6). */
let pausedAt = -1;
/** le RUN qui attend le son est une reprise de pause (onCtxState la garde) */
let wantResume = false;
/** Le sequenceur des trigs (V.5.1, audio/seq.ts) : son etat, et celui du pas ou une pause reprendra. */
let seqSt: SeqState = seqState(1);
let resumeSeq: SeqState | null = null;
/** Le compteur de passages du pattern (V.5.1) : 1 au lancement ; celui d'avant le dernier debut de mesure (unbar). */
let passN = 1;
let passBefore = 1;
/** La condition LST (V.5.1) : un changement de pattern est-il prevu a la fin de la mesure (state/patterns.ts) */
let lastFn: (() => boolean) | null = null;
/**
 * Une grille a rejoindre au depart (2026-10-03) : l'arpegiateur du
 * MM-VOYAGER qui joue deja (voyager/arp.ts). RUN part alors sur sa
 * prochaine frontiere de pas, avec son numero : memes temps, memes mesures.
 */
let follow: ((t: number) => { time: number; step: number } | null) | null = null;
/**
 * La platine qui mene (2026-10-27, le SYNC du MIXER, dj/actions.ts) : son prochain temps a t ou apres (temps du
 * contexte) et la duree d'un temps des machines, ou null (rien ne mene : l'horloge a sa propre grille, comme avant).
 */
let lead: ((t: number) => { time: number; period: number } | null) | null = null;
/** le pas (abs) dont la fin de mesure a ete recalee sur la platine qui mene : une fois chacun, meme re-programme */
let leadAt = -1;
/** l'ancre posee par ce recalage : avant elle, la grille n'est pas la meme (gridAfter lit alors les pas programmes) */
let leadAnchor = -1;

const stats = {
  count: 0,
  maxDrift: 0,
  sumDrift: 0,
  maxLate: 0,
  lateCount: 0,
  dropped: 0,
  minLead: Infinity,
  ticks: 0,
  maxGap: 0,
  lastTick: 0,
  /** voix annulees par STOP depuis le chargement (jamais remis a zero) */
  cancelled: 0,
  /** re-programmations (un changement pendant la lecture) depuis le chargement */
  rescheduled: 0,
  /** demandes de re-programmation (2026-10-27), comptees avant le test de la lecture : un test a l'arret les mesure */
  asks: 0,
  /** fins de mesure recalees sur la platine qui mene (2026-10-27, leadRealign) */
  leadShifts: 0,
};

const runListeners = new Set<() => void>();
const stepListeners = new Set<(e: StepEvent) => void>();
/**
 * Le debut d'une mesure (2026-10-05, les patterns et la chaine du MM-RYTM,
 * state/patterns.ts) : appele juste avant de programmer le premier pas,
 * pour que le pattern suivant soit pose avant que ses coups partent ; first :
 * la premiere mesure de la lecture.
 */
const barListeners = new Set<(first: boolean) => void>();
/**
 * La pause de PLAY avant qu'un debut de mesure deja annonce ne s'entende (V.5.0, la revue de D1, G3) : bar() a deja avance
 * la chaine des patterns, ses ecouteurs la ramenent (state/patterns.ts unbar) ; sinon la reprise jouait la fin de la mesure
 * dans le pattern suivant, puis en sautait un.
 */
const unbarListeners = new Set<() => void>();
let firstBar = false;

function resetStats(): void {
  stats.count = 0;
  stats.maxDrift = 0;
  stats.sumDrift = 0;
  stats.maxLate = 0;
  stats.lateCount = 0;
  stats.dropped = 0;
  stats.minLead = Infinity;
  stats.ticks = 0;
  stats.maxGap = 0;
  stats.lastTick = 0;
}

function push(e: StepEvent): void {
  journal.push(e);
  if (journal.length > RING) journal.shift();
}

/** i = 0 : le pas le plus recemment programme. */
function recent(i: number): StepEvent | undefined {
  return journal[journal.length - 1 - i];
}

/** Le debut d'une mesure : annonce une seule fois (meme re-programme, meme saute). */
function bar(): void {
  if (abs <= barAbs) return;
  barAbs = abs;
  const first = firstBar;
  firstBar = false;
  // Le passage suivant (V.5.1) ; un changement de pattern dans les ecouteurs le remet a 1 (resetPass)
  passBefore = passN;
  passN = first ? 1 : passN + 1;
  inBar = true;
  try {
    barListeners.forEach((fn) => fn(first));
  } finally {
    inBar = false;
  }
}

/** Programme un pas : les voix a `when`, l'entree du journal, les ecouteurs. */
function schedule(s: number, when: number, expected: number, now: number, off: number, grid: number): void {
  if (s === 0) {
    barTime = grid;
    bar();
  }
  // Un pas d'une mesure deja finie, re-programme : son motif d'alors (la chaine a pu changer de pattern depuis)
  const cur = pattern.get();
  const snap: Snap = (abs < barAbs ? replay.get(abs) : undefined) ?? { steps: cur.steps, locks: cur.locks, scenes: pattern.scenes.get(), trigs: cur.trigs, pass: passN };
  const vs: Voice[] = [];
  let mask = 0;
  // Le mute du pattern (V.5.0, 2026-10-29) : coupee si la machine ou le pattern la coupe (le solo passe avant) ; au desktop
  // seulement (la revue de D1, K5 : le telephone ne le montre ni ne le defait, il joue comme avant ; le mute reste garde)
  const pm = DT_FACE ? cur.pmutes : NO_PM;
  const seqBefore = cloneSeq(seqSt);
  // Les coups du pas (V.5.1, audio/seq.ts) : au depart, une voix apres l'autre, un coup par pas a velocite (1 a 3 ; les
  // charleys du sequenceur toujours fermes), a l'heure du pas, avec ses verrous (null sans verrou, le coup d'avant) ;
  // MUTE et SOLO (state/voices.ts) retirent la voix
  const out = seqStep(seqSt, {
    s,
    pos: abs,
    when,
    grid,
    dur: stepDur,
    steps: snap.steps,
    locks: snap.locks,
    trigs: snap.trigs,
    ctx: { pass: snap.pass, fill: fill.on, last: lastFn ? lastFn() : false },
    plays: (inst) => voices.plays(inst, pm),
    fxOf: (inst) => voiceFx.of(inst),
  });
  for (const h of out.hits) {
    mask |= 1 << INSTRUMENTS.indexOf(h.inst);
    const live = liveNeeds(snap.locks, h.inst);
    const sq: HitSeq | undefined = h.len !== null || h.lfo || h.roll || live ? { len: h.len, lfo: h.lfo, roll: h.roll, rep: h.rep, prev: seqSt.v[h.inst].last as Voice | null, live } : undefined;
    const n0 = vs.length;
    if (trigger(h.inst, h.t, false, vs, h.vel, h.lock, snap.scenes, sq) && vs.length > n0) seqLast(seqSt, h.inst, vs[vs.length - 1]);
  }
  for (const lt of out.locks) {
    const pv = lockTrig(lt.inst, lt.t, lt.lock, lt.last as Voice | null, lt.anchor);
    if (pv) vs.push(pv);
  }
  let first = when;
  let last = when;
  for (const v of vs) {
    if (v.when < first) first = v.when;
    if (v.when > last) last = v.when;
  }
  for (const v of vs) pending.push(v);
  plan.push({ abs, step: s, grid, when, voices: vs, snap, seq, seqBefore, first, last });
  const e: StepEvent = { seq, step: s, when, expected, at: now, mask, off };
  seq += 1;
  push(e);
  const drift = Math.abs(when - expected);
  stats.count += 1;
  stats.sumDrift += drift;
  if (drift > stats.maxDrift) stats.maxDrift = drift;
  const late = now - when;
  if (late > 0) {
    stats.lateCount += 1;
    if (late > stats.maxLate) stats.maxLate = late;
  }
  if (-late < stats.minLead) stats.minLead = -late;
  stepListeners.forEach((fn) => fn(e));
}

/** Oublie les voix deja parties et les pas passes (compactage sur place, aucune allocation). */
function prune(now: number): void {
  let k = 0;
  for (let i = 0; i < pending.length; i += 1) {
    if (pending[i].when >= now) pending[k++] = pending[i];
  }
  pending.length = k;
  k = 0;
  // Un pas dont un coup n'a pas encore sonne (uTIME positif, une repetition de retrig) reste (V.5.1)
  for (let i = 0; i < plan.length; i += 1) {
    if (plan[i].last >= now) plan[k++] = plan[i];
  }
  plan.length = k;
}

/** L'avance d'un uTIME negatif (V.5.1), en secondes : l'horizon s'allonge d'autant (cache par motif). */
let leadKey: { trigs: unknown; locks: unknown } = { trigs: null, locks: null };
let leadSteps = 0;
function seqLead(): number {
  const p = pattern.get();
  if (leadKey.trigs !== p.trigs || leadKey.locks !== p.locks) {
    leadKey = { trigs: p.trigs, locks: p.locks };
    leadSteps = -earliestShift(p.trigs, p.locks);
  }
  return leadSteps * stepDur;
}

function tick(): void {
  if (!running) return;
  const c = context();
  if (!c) return;
  const p = performance.now();
  if (stats.lastTick > 0 && p - stats.lastTick > stats.maxGap) stats.maxGap = p - stats.lastTick;
  stats.lastTick = p;
  stats.ticks += 1;
  // Contexte suspendu (onglet cache) : currentTime est fige, rien ne part
  const now = c.currentTime;
  prune(now);
  const until = horizon(now) + seqLead();
  for (let guard = 0; nextTime < until && guard < MAX_PER_TICK; guard += 1) {
    // Nouveau tempo : il part de cette frontiere de pas, la grille s'y reancre
    if (pendingDur > 0) {
      stepDur = pendingDur;
      pendingDur = 0;
      anchor = nextTime;
      n = 0;
    }
    // La fin de la mesure se recale sur la platine qui mene (le SYNC du MIXER) ; le pas d'apres repasse par la boucle
    if (lead && step === STEP_COUNT - 2 && leadRealign(now)) continue;
    if (nextTime < now - DROP_AFTER_S) {
      stats.dropped += 1;
      // Saute, le debut de mesure compte quand meme : la chaine des patterns ne prend pas de retard
      if (step === 0) {
        barTime = nextTime;
        bar();
      }
    } else {
      // SWING : un pas pair (index impair) part plus tard, jamais au-dela d'un tiers de pas
      // Le SWING joue (2026-10-27) : celui des scenes au x du moment ; sans scene, celui du store
      const off = (step & 1) === 1 ? morph.fx().swing * SWING.maxDelay * stepDur : 0;
      schedule(step, nextTime + off, anchor + n * stepDur + off, now, off, nextTime);
    }
    // Depuis l'ancre, pas par addition : aucune erreur qui s'accumule
    n += 1;
    abs += 1;
    nextTime = anchor + n * stepDur;
    step = (step + 1) % STEP_COUNT;
  }
}

/**
 * Un changement (pas, mute, son, reglage, tempo, swing) : les pas
 * programmes qui n'ont pas encore sonne (au-dela de GUARD_S) sont annules,
 * du dernier au premier (les etouffements de charley se defont dans
 * l'ordre), et refaits tout de suite avec ce qui vaut maintenant ; un
 * tempo en attente part du premier d'entre eux.
 */
function reschedule(): void {
  if (!running) return;
  const c = context();
  if (!c) return;
  const now = c.currentTime;
  prune(now);
  const edge = now + GUARD_S;
  // Le premier pas dont aucun coup n'est parti (son plus en avance : un uTIME negatif)
  const i = plan.findIndex((x) => x.first > edge);
  if (i < 0) return;
  const first = plan[i];
  // Le sequenceur des trigs repart de son etat d'avant ce pas (V.5.1)
  seqSt = first.seqBefore;
  const dead = new Set<Voice>();
  for (let k = plan.length - 1; k >= i; k -= 1) {
    const x = plan[k];
    for (let j = x.voices.length - 1; j >= 0; j -= 1) {
      cancelVoice(x.voices[j]);
      dead.add(x.voices[j]);
    }
    replay.set(x.abs, x.snap);
  }
  let w = 0;
  for (let k = 0; k < pending.length; k += 1) if (!dead.has(pending[k])) pending[w++] = pending[k];
  pending.length = w;
  plan.length = i;
  while (journal.length > 0 && journal[journal.length - 1].seq >= first.seq) journal.pop();
  // La grille repart du premier pas annule (le tempo en attente aussi)
  abs = first.abs;
  // Une fin de mesure recalee sur la platine qui mene (leadRealign) et rejouee : le recalage se refait
  if (abs <= leadAt) leadAt = -1;
  step = first.step;
  anchor = first.grid;
  nextTime = first.grid;
  n = 0;
  if (pendingDur > 0) {
    stepDur = pendingDur;
    pendingDur = 0;
  }
  stats.rescheduled += 1;
  tick();
  replay.clear();
}

/**
 * Le SYNC du MIXER (2026-10-27, Mika : "je voudrais un bouton sync qui fait que c'est sync avec le bpm des cdj quand
 * ces derniers sont sync aussi" ; dj/actions.ts : la platine MASTER mene) : a la fin de chaque mesure, au moment de
 * programmer son pas 14, la barre qui vient se pose sur le temps de la platine le plus proche (au plus un demi-temps
 * plus tot ou plus tard), au tempo exact de la platine ; les pas 14 et 15 se posent sur sa grille, celui qui tomberait
 * sur le precedent (a moins d'un demi-pas) ou deja dans le tampon saute. Jamais au milieu d'une mesure, aucun coup
 * deja programme n'est deplace ; l'arpege et la basse suivent la grille (re-programmation des autres). Deja cale
 * (moins d'une demi-milliseconde, le meme tempo) : rien ne bouge. Rend true si la grille a change.
 */
function leadRealign(now: number): boolean {
  if (!lead || abs === leadAt) return false;
  leadAt = abs;
  const q = 4 * stepDur;
  const barAt = nextTime + 2 * stepDur;
  const b = lead(barAt - q / 2);
  if (!b || !(b.period > 0)) return false;
  const dur = b.period / 4;
  if (Math.abs(b.time - barAt) < 0.0005 && Math.abs(dur - stepDur) < stepDur * 1e-4) return false;
  // Le pas 13 tel qu'il joue (2026-10-27, revue SYNC-REALIGN-SWING-FLAM : au SWING, un pas impair part plus tard, la
  // garde lisait sa grille, les pas 13 et 14 tombaient a 31 ms) ; saute, sa grille
  const last = plan[plan.length - 1];
  const prev = last && last.abs === abs - 1 ? last.when : nextTime - stepDur;
  const edge = now + GUARD_S;
  let k = 2;
  while (k > 0 && (b.time - k * dur < prev + 0.5 * dur || b.time - k * dur < edge)) k -= 1;
  // Les pas sautes comptent (la mesure, la chaine des patterns), comme un pas rate
  abs += 2 - k;
  step = (step + 2 - k) % STEP_COUNT;
  stepDur = dur;
  pendingDur = 0;
  anchor = b.time - k * dur;
  leadAnchor = anchor;
  nextTime = anchor;
  n = 0;
  stats.leadShifts += 1;
  askRescheduleAll(me);
  return true;
}

const me: Scheduler = { tick, reschedule, order: 0 };
registerScheduler(me);
const ask = (): void => {
  stats.asks += 1;
  if (running && !inBar) askReschedule(me);
};

const emit = (): void => runListeners.forEach((fn) => fn());

function setBpm(b: number): void {
  if (b === bpm) return;
  bpm = b;
  const d = stepDuration(b);
  // En lecture : a la prochaine frontiere de pas ; a l'arret : tout de suite
  if (running) pendingDur = d;
  else stepDur = d;
}

/*
 * Seulement ce qui change un coup (2026-10-21, audit F9 : chaque mouvement d'un potard d'effet, REVERB, DELAY, COMP,
 * DIST ou CHORUS, global ou de voix, annulait et refaisait tous les coups des 300 ms a venir, 222 coups crees pour 17
 * joues en 1.3 s de glisser, du calcul et du ramasse-miettes au telephone) : des FX globaux, le SWING seul (comme le
 * MM-BASS et le MM-ARP) ; d'une voix, les reglages que lit le coup (hitParams : sa hauteur, son enveloppe, son filtre,
 * son PAN, son START) et son VOL quand un verrou VOL de la voix s'y rapporte ou pour le kick (la velocite du
 * SIDECHAIN). DIST, CHORUS, DELAY, REVERB et le VOL d'une voix sans verrou vont a sa tranche, sans re-programmer.
 */
const HIT_PARAMS = ['tone', 'decay', 'tune', 'pan', 'start', 'atk', 'hold', 'fine', 'ftype', 'fcut', 'freso', 'fenv', 'fatk', 'fdec'] as const;
/**
 * Le VOL de la voix est-il fige dans ses coups ? Un verrou VOL s'y rapporte ; un verrou TONE aussi (2026-10-22, revue
 * R3 : son coup passe apres le LEVEL de la tranche, drums.ts hitEntry, et porte le VOL de la voix dans son gain ;
 * sans re-programmer, VOL a 0 laissait ces coups sonner plein pot jusqu'a 450 ms).
 */
const levelBaked = (inst: Inst, locks: Readonly<Locks>): boolean => {
  const row = locks[inst];
  return !!row && Object.values(row).some((l) => l.level !== undefined || l.tone !== undefined);
};
function hitKey(): string {
  const locks = pattern.get().locks;
  return INSTRUMENTS.map((inst) => {
    const v = voiceFx.of(inst);
    const k = `${HIT_PARAMS.map((p) => v[p]).join(',')}|${lfoKey(inst)}`;
    return inst === 'BD' || levelBaked(inst, locks) ? `${k},${v.level}` : k;
  }).join(';');
}

// Les LFO d'une voix (V.5.1) changent ses coups : ils comptent dans la cle
const lfoKey = (inst: Inst): string => {
  const v = voiceFx.of(inst);
  return LFO_PARAMS.map((p) => v[p] ?? '').join(',');
};
// Le tempo suit le store du motif (TEMPO, tests, rechargement) ; tout ce qui change un coup le re-programme. Choisir une
// voix ne change aucun coup (2026-10-27, TRK et A S D F en lecture) : pas de re-programmation ; le tempo, les pas et les
// verrous, si (PatternState : bpm, steps, instrument, locks ; setBpm ne fait que garder pendingDur, ask l'applique)
let lastSteps = pattern.get().steps;
let lastLocks = pattern.get().locks;
let lastBpm = pattern.get().bpm;
let lastPmutes = pattern.get().pmutes;
let lastTrigs = pattern.get().trigs;
pattern.subscribe(() => {
  const p = pattern.get();
  setBpm(p.bpm);
  if (p.steps === lastSteps && p.locks === lastLocks && p.bpm === lastBpm && p.pmutes === lastPmutes && p.trigs === lastTrigs) return;
  lastSteps = p.steps;
  lastLocks = p.locks;
  lastBpm = p.bpm;
  lastPmutes = p.pmutes;
  lastTrigs = p.trigs;
  ask();
});
// FILL (V.5.1, tenir YES) : les pas a venir l'entendent tout de suite
fill.subscribe(ask);
let lastSwing = pattern.fx.get().swing;
pattern.fx.subscribe(() => {
  const sw = pattern.fx.get().swing;
  if (sw === lastSwing) return;
  lastSwing = sw;
  ask();
});
voices.subscribe(ask);
let lastHitKey = hitKey();
voiceFx.subscribe(() => {
  const k = hitKey();
  if (k === lastHitKey) return;
  lastHitKey = k;
  ask();
});
kit.subscribe(ask);
// Le coup d'un nouveau son arrive (2026-10-21, audit RS-2) : les pas deja programmes avec un remplacant sont refaits
shots.onReady(ask);

/*
 * Les coups suivent le crossfader (2026-10-27, la phase 2) : aucune re-programmation par mouvement (le pic de calcul du
 * 2026-10-21, F9, reviendrait) ; les coups programmes gardent les valeurs de leur programmation, en retard de l'avance
 * (300 ms, 450 au telephone) pendant un balayage, exacts au repos. A la fin d'un geste, UNE re-programmation si les
 * valeurs jouees des cles de coup et de hauteur (morph.hitSig, au 1/1024) ont change ; en option, pendant un geste a la
 * souris (pointeur fin, pas au telephone), une au plus toutes les XFADE_UI.resyncMs si elles ont change. Les demandes
 * se comptent avant la garde de RUN (morph.stats.reschedAsks : un test a l'arret les mesure).
 */
let bakedSig = morph.hitSig();
const resync = { on: true };
let resyncTimer = 0;
const finePointer = (): boolean => !PORTRAIT && typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches;
function hitAsk(): void {
  const sig = morph.hitSig();
  if (sig === bakedSig) return;
  bakedSig = sig;
  morph.stats.reschedAsks += 1;
  ask();
}
function stopResync(): void {
  if (resyncTimer) window.clearInterval(resyncTimer);
  resyncTimer = 0;
}
if (typeof window !== 'undefined') {
  morph.subscribe((c) => {
    // Une valeur de coup ou de hauteur ecrite dans la scene qu'on entend (2026-10-27, revue F5) : les coups deja
    // programmes sont refaits, comme pour un potard de base (une demande par rafale, seulement si ce qui joue change) ;
    // un changement de pattern a la mesure non : ses coups lisent deja les scenes de leur banque
    if (c.cause === 'scenes') hitAsk();
    else if (c.cause === 'switch') bakedSig = morph.hitSig();
    else if (c.cause === 'settle') {
      stopResync();
      hitAsk();
    }
  });
  sceneCtl.onGesture((on) => {
    stopResync();
    if (!on || !resync.on || !finePointer()) return;
    const h = morph.has();
    if (!h.hit && !h.pitch) return;
    resyncTimer = window.setInterval(hitAsk, XFADE_UI.resyncMs);
  });
}
let mixKey = '';
mix.subscribe(() => {
  const k = `${mix.tone}|${mix.stretch}`;
  if (k === mixKey) return;
  mixKey = k;
  ask();
});

/**
 * RUN pendant que le contexte dort (2026-10-08, Mika : "Roto control : des
 * fois ca fonctionne, des fois ca ne fonctionne pas") : un RUN du Roto juste
 * apres le chargement, sans clic sur la page, trouvait le contexte
 * 'suspended' (la regle d'autoplay du navigateur) ; l'horloge se disait en
 * marche, le temps etait gele, rien ne sonnait. Desormais elle attend : RUN
 * part quand le contexte tourne (le premier clic sur la page le reveille),
 * dans les 20 s ; d'ici la, running reste faux (la LED du Roto ne ment pas),
 * et un deuxieme RUN ou STOP annule l'attente.
 */
let waitCtx: AudioContext | null = null;
let waitTimer = 0;
const WAIT_MS = 20000;

function cancelWait(): void {
  if (!waitCtx) return;
  waitCtx.removeEventListener('statechange', onCtxState);
  waitCtx = null;
  window.clearTimeout(waitTimer);
}

function onCtxState(): void {
  const c = waitCtx;
  if (!c) return;
  if (c.state === 'closed') cancelWait();
  if (c.state !== 'running') return;
  cancelWait();
  start(wantResume);
}

/** RUN ; fromPause (V.5.0) : la reprise de la pause de PLAY, au pas de la pause (sans elle : du pas 1, comme avant). */
function start(fromPause = false): boolean {
  if (running) return true;
  if (locked) return false;
  const c = context();
  if (!c || c.state === 'closed') return false;
  if (c.state !== 'running') {
    wantResume = fromPause;
    if (waitCtx !== c) {
      cancelWait();
      waitCtx = c;
      c.addEventListener('statechange', onCtxState);
      waitTimer = window.setTimeout(cancelWait, WAIT_MS);
    }
    return false;
  }
  cancelWait();
  wantResume = false;
  const from = fromPause ? resumeAt : -1;
  resumeAt = -1;
  // Le sequenceur des trigs (V.5.1) : une reprise repart de l'etat de son pas ; un RUN frais, de zero (le compteur de
  // passages a 1, un nouveau tirage de PROB)
  seqSt = from >= 0 && resumeSeq ? resumeSeq : seqState((Math.random() * 4294967296) >>> 0);
  resumeSeq = null;
  if (from < 0) {
    passN = 1;
    passBefore = 1;
  }
  bpm = pattern.get().bpm;
  stepDur = stepDuration(bpm);
  pendingDur = 0;
  // L'arpege qui joue deja, sinon la basse seule (audio/sched.ts extraGrid, 2026-10-21) ; sinon, le SYNC du MIXER
  // (2026-10-27) : le prochain temps de la platine qui mene, a son tempo, la mesure qui commence
  const g = (follow ? follow(c.currentTime + START_DELAY_S) : null) ?? extraGrid(c.currentTime + START_DELAY_S);
  const lb = g || !lead ? null : lead(c.currentTime + START_DELAY_S);
  if (lb && lb.period > 0) stepDur = lb.period / 4;
  anchor = g ? g.time : lb ? lb.time : c.currentTime + START_DELAY_S;
  // La reprise d'une pause (V.5.0) : au pas de la pause, tout de suite (la grille de la platine ou de l'arpege se rattrape a
  // la fin de la mesure)
  if (from >= 0) anchor = c.currentTime + START_DELAY_S;
  nextTime = anchor;
  n = 0;
  step = from >= 0 ? from : g ? g.step : 0;
  leadAt = -1;
  abs = 0;
  barAbs = -1;
  plan.length = 0;
  runFirst = seq;
  // Une reprise n'est pas une premiere mesure : la chaine des patterns continue ou elle en etait
  firstBar = from < 0;
  resetStats();
  running = true;
  timer = window.setInterval(tick, TICK_MS);
  tick();
  emit();
  return true;
}

/**
 * STOP : les coups programmes qui n'ont pas encore sonne (l'horizon au plus)
 * sont annules. Ceux qui partent dans le quantum de rendu en cours (moins
 * de 3 ms) jouent jusqu'au bout : les couper net ferait un clic.
 */
function stop(): void {
  cancelWait();
  wantResume = false;
  // STOP oublie la pause (V.5.0) : la prochaine lecture repart du pas 1 ; le compteur de passages revient a 1 (V.5.1)
  const hadPause = resumeAt >= 0;
  resumeAt = -1;
  resumeSeq = null;
  passN = 1;
  passBefore = 1;
  if (!running) {
    if (hadPause) emit();
    return;
  }
  running = false;
  window.clearInterval(timer);
  timer = 0;
  const c = context();
  if (c) {
    const edge = c.currentTime + 128 / c.sampleRate;
    // Du dernier au premier, comme reschedule() (2026-10-08) : un kick annule rend la main au kick qu'il
    // coupait ; dans l'autre ordre, le kick d'apres STOP ne coupait plus la queue de celui qui sonnait encore
    for (let i = pending.length - 1; i >= 0; i -= 1) {
      if (pending[i].when > edge) {
        cancelVoice(pending[i]);
        stats.cancelled += 1;
      }
    }
  }
  pending.length = 0;
  plan.length = 0;
  emit();
}

/**
 * La pause de PLAY (V.5.0, 2026-10-29) : la lecture s'arrete comme STOP (les coups programmes partent), le pas d'apres
 * celui qu'on vient d'entendre est retenu ; false a l'arret.
 */
function pause(): boolean {
  if (!running) return false;
  const c = context();
  const e = c ? entryAt(c.currentTime) : null;
  const at = e ? (e.step + 1) % STEP_COUNT : (plan[0]?.step ?? step);
  // Un pas 1 programme mais pas encore entendu : sa mesure est annoncee (bar), la chaine a avance pour rien
  const unheard = !!c && plan.some((p) => p.step === 0 && p.when > c.currentTime);
  // Le sequenceur des trigs du pas de la reprise (V.5.1) et le compteur de passages : la pause les garde
  const rs = c ? plan.find((p) => p.when > c.currentTime)?.seqBefore ?? null : null;
  const pass = unheard ? passBefore : passN;
  stop();
  passN = pass;
  if (unheard) unbarListeners.forEach((fn) => fn());
  resumeSeq = rs;
  resumeAt = at;
  pausedAt = e ? e.step : -1;
  emit();
  return true;
}

/** Le dernier pas de la lecture en cours dont l'instant est passe a t (temps du contexte). */
function entryAt(t: number): StepEvent | null {
  if (!running) return null;
  for (let i = 0; i < journal.length; i += 1) {
    const e = recent(i);
    if (!e || e.seq < runFirst) return null;
    if (e.when <= t) return e;
  }
  return null;
}

/**
 * La grille de la lecture en cours (2026-10-03, l'arpegiateur du
 * MM-VOYAGER s'y cale) : la premiere frontiere de pas a t ou apres
 * (temps du contexte, sans le retard du swing) et son numero (0 a 15) ;
 * un tempo en attente compte a partir de sa frontiere. null a l'arret.
 */
function gridAfter(t: number): { time: number; step: number; dur: number } | null {
  if (!running) return null;
  if (pendingDur > 0 && t > nextTime) {
    const k = Math.ceil((t - nextTime) / pendingDur - 1e-9);
    return { time: nextTime + k * pendingDur, step: (step + k) % STEP_COUNT, dur: pendingDur };
  }
  // Avant une fin de mesure recalee sur la platine qui mene (2026-10-27, leadRealign) : la grille d'avant, telle que ses
  // pas sont programmes (l'arpege qui s'y cale ne compte pas un pas fantome en arriere de la nouvelle ancre)
  if (anchor === leadAnchor && t < anchor - 1e-9) {
    const i = plan.findIndex((x) => x.grid >= t - 1e-9);
    if (i >= 0 && plan[i].grid < anchor - 1e-9) return { time: plan[i].grid, step: plan[i].step, dur: (plan[i + 1]?.grid ?? anchor) - plan[i].grid };
  }
  const k = Math.ceil((t - anchor) / stepDur - 1e-9);
  const idx = (((step + (k - n)) % STEP_COUNT) + STEP_COUNT) % STEP_COUNT;
  return { time: anchor + k * stepDur, step: idx, dur: stepDur };
}

function drift(): Drift {
  const ms = (s: number): number => s * 1000;
  return {
    maxMs: ms(stats.maxDrift),
    meanMs: stats.count > 0 ? ms(stats.sumDrift / stats.count) : 0,
    lateMs: ms(stats.maxLate),
    lateCount: stats.lateCount,
    count: stats.count,
    dropped: stats.dropped,
    minLeadMs: stats.minLead === Infinity ? 0 : ms(stats.minLead),
    maxTickGapMs: stats.maxGap,
    ticks: stats.ticks,
  };
}

export const clock = {
  get running(): boolean {
    return running;
  },
  get bpm(): number {
    return bpm;
  },
  /** RUN : exige le contexte (cree par le geste qui appelle) ; false sinon. */
  start: (): boolean => start(false),
  stop,
  /** PLAY en lecture (V.5.0) : la pause ; le pas de la reprise est retenu. */
  pause,
  /** PLAY en pause (V.5.0) : la reprise au pas de la pause ; false s'il n'y a pas de pause (ou deja en lecture). */
  resume: (): boolean => (resumeAt >= 0 && !running ? start(true) : false),
  /** En pause (V.5.0) : PLAY reprendra au pas de la pause, son temoin clignote. */
  get paused(): boolean {
    return resumeAt >= 0 && !running;
  },
  /** Le pas de la reprise (-1 : pas en pause). */
  get resumeStep(): number {
    return running ? -1 : resumeAt;
  },
  /** En pause, le dernier pas entendu (la tete de lecture y reste, V.5.0) ; -1 sinon. */
  get pausedStep(): number {
    return running || resumeAt < 0 ? -1 : pausedAt;
  },
  /**
   * Repli sans WebGL (perte de contexte, erreur) : STOP, et RUN refuse tant
   * qu'il est affiche ; la page de repli n'a aucune commande de transport.
   */
  lock(on: boolean): void {
    locked = on;
    if (on) stop();
  },
  /** La grille qu'un RUN rejoint si elle joue deja (l'arpegiateur du MM-VOYAGER). */
  follow(fn: (t: number) => { time: number; step: number } | null): void {
    follow = fn;
  },
  /** La platine qui mene (2026-10-27, le SYNC du MIXER) : RUN part sur son temps, chaque fin de mesure s'y recale (leadRealign). */
  lead(fn: ((t: number) => { time: number; period: number } | null) | null): void {
    lead = fn;
  },
  /** RUN/STOP ; renvoie le nouvel etat (un RUN qui attend le son : un deuxieme appui l'annule). */
  toggle(): boolean {
    if (running) stop();
    else if (waitCtx) cancelWait();
    else start(false);
    return running;
  },
  /** Un RUN attend que le contexte tourne (2026-10-08). */
  get waiting(): boolean {
    return waitCtx !== null;
  },
  /** CLEAR : vide les quatre rangees, la lecture continue (spec 7.2). */
  clear(): void {
    pattern.clear();
  },
  entryAt,
  gridAfter,
  /** Le pas sous la tete de lecture a t (temps du contexte), -1 a l'arret ou avant le premier. */
  currentStep(t: number): number {
    return entryAt(t)?.step ?? -1;
  },
  /** RUN et STOP. */
  subscribe(fn: () => void): () => void {
    runListeners.add(fn);
    return () => {
      runListeners.delete(fn);
    };
  },
  /**
   * L'heure audio de la mesure annoncee (2026-10-27) : valable pendant les ecouteurs de onBar (un pattern pose y arrive a
   * cette heure), 0 ailleurs (tout de suite).
   */
  barAt: (): number => (inBar ? barTime : 0),
  /** Le compteur de passages du pattern (V.5.1, les conditions A:B et 1ST) : 1 au premier passage. */
  get pass(): number {
    return passN;
  },
  /** Un changement de pattern (V.5.1, state/patterns.ts) : le compteur de passages repart a 1. */
  resetPass(): void {
    passN = 1;
  },
  /** La condition LST (V.5.1) : state/patterns.ts dit si un changement de pattern est prevu a la fin de la mesure. */
  lastPass(fn: (() => boolean) | null): void {
    lastFn = fn;
  },
  /** Re-programme les pas a venir (V.5.1 : la condition LST a change) ; rien a l'arret. */
  refresh(): void {
    ask();
  },
  /** Le debut de chaque mesure, avant que son premier pas soit programme ; rend de quoi se desabonner. */
  /** La pause avant un debut de mesure deja annonce (V.5.0) : ce que onBar a avance revient. */
  onUnbar(fn: () => void): () => void {
    unbarListeners.add(fn);
    return () => {
      unbarListeners.delete(fn);
    };
  },
  onBar(fn: (first: boolean) => void): () => void {
    barListeners.add(fn);
    return () => {
      barListeners.delete(fn);
    };
  },
  /** Chaque pas programme, a l'instant de programmation (jusqu'a l'horizon avant l'echeance ; un pas re-programme previent de nouveau). */
  onStep(fn: (e: StepEvent) => void): () => void {
    stepListeners.add(fn);
    return () => {
      stepListeners.delete(fn);
    };
  },
  drift,
  /** Nouvelle fenetre de mesure pour drift(), sans toucher a la lecture. */
  resetStats,
};

/* ---------------- debug (window.__v4.clock) ---------------- */

export interface ClockDebug {
  readonly running: boolean;
  readonly bpm: number;
  readonly stepDur: number;
  /** les 64 derniers pas programmes, du plus ancien au plus recent */
  readonly scheduled: StepEvent[];
  drift(): Drift;
  resetStats(): void;
  /** le pas sous la tete de lecture maintenant (-1 a l'arret) */
  currentStep(): number;
  /** voix programmees pas encore parties ; voix annulees par STOP (total) ; re-programmations (total) */
  readonly pending: number;
  readonly cancelled: number;
  readonly rescheduled: number;
  /** demandes de re-programmation depuis le chargement (2026-10-27), lecture ou arret */
  readonly asks: number;
  /** le resync borne des coups pendant un geste du crossfader (2026-10-27, pointeur fin) : on, a couper pour un test */
  readonly resync: { on: boolean };
  /** RUN refuse (repli sans WebGL affiche) */
  readonly locked: boolean;
  /** fins de mesure recalees sur la platine qui mene (2026-10-27, le SYNC du MIXER) */
  readonly leadShifts: number;
}

export const clockDebug: ClockDebug = {
  get running() {
    return running;
  },
  get bpm() {
    return bpm;
  },
  get stepDur() {
    return stepDur;
  },
  get scheduled() {
    return journal.map((e) => ({ ...e }));
  },
  drift,
  resetStats,
  currentStep() {
    const c = context();
    return c ? clock.currentStep(c.currentTime) : -1;
  },
  get pending() {
    return pending.length;
  },
  get cancelled() {
    return stats.cancelled;
  },
  get asks() {
    return stats.asks;
  },
  resync,
  get rescheduled() {
    return stats.rescheduled;
  },
  get locked() {
    return locked;
  },
  get leadShifts() {
    return stats.leadShifts;
  },
};
