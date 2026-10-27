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
 */

import { voices } from '../state/voices';
import { sceneCtl } from '../state/sceneCtl';
import { PORTRAIT, SWING, XFADE_UI, type Inst } from '../theme';
import { voiceFx } from './voicefx';
import { kit } from './kit';
import { cancelVoice, context, mix, trigger, type Voice } from './drums';
import { shots } from './shots';
import { INSTRUMENTS, STEP_COUNT, VEL_GAIN, pattern, velocity, type Steps } from './pattern';
import { lockOf, type Locks } from './locks';
import { morph } from './morph';
import type { SceneSet } from '../rytm/sceneData';
import { DROP_AFTER_S, GUARD_S, TICK_MS, askReschedule, extraGrid, horizon, registerScheduler, type Scheduler } from './sched';

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
}
const plan: Planned[] = [];
/** re-programmation en cours : le motif (et ses verrous) des pas d'une mesure deja finie */
const replay = new Map<number, Snap>();
/** repli sans WebGL affiche : plus de machine, RUN refuse (index.tsx) */
let locked = false;
/**
 * Une grille a rejoindre au depart (2026-10-03) : l'arpegiateur du
 * MM-VOYAGER qui joue deja (voyager/arp.ts). RUN part alors sur sa
 * prochaine frontiere de pas, avec son numero : memes temps, memes mesures.
 */
let follow: ((t: number) => { time: number; step: number } | null) | null = null;

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
  const snap: Snap = (abs < barAbs ? replay.get(abs) : undefined) ?? { steps: cur.steps, locks: cur.locks, scenes: pattern.scenes.get() };
  const steps = snap.steps;
  const vs: Voice[] = [];
  let mask = 0;
  for (let k = 0; k < INSTRUMENTS.length; k += 1) {
    const inst = INSTRUMENTS[k];
    // Velocite 1 a 3 (0 : rien) ; les coups du sequenceur sont toujours des
    // charleys fermes ; MUTE et SOLO (state/voices.ts) retirent la voix
    const vel = velocity(steps, inst, s);
    if (vel > 0 && voices.plays(inst)) {
      mask |= 1 << k;
      // Les verrous du pas (2026-10-08) : null sans verrou, le coup d'avant
      trigger(inst, when, false, vs, VEL_GAIN[vel], lockOf(snap.locks, inst, s), snap.scenes);
    }
  }
  for (const v of vs) pending.push(v);
  plan.push({ abs, step: s, grid, when, voices: vs, snap, seq });
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
  for (let i = 0; i < plan.length; i += 1) {
    if (plan[i].when >= now) plan[k++] = plan[i];
  }
  plan.length = k;
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
  const until = horizon(now);
  for (let guard = 0; nextTime < until && guard < MAX_PER_TICK; guard += 1) {
    // Nouveau tempo : il part de cette frontiere de pas, la grille s'y reancre
    if (pendingDur > 0) {
      stepDur = pendingDur;
      pendingDur = 0;
      anchor = nextTime;
      n = 0;
    }
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
  const i = plan.findIndex((x) => x.when > edge);
  if (i < 0) return;
  const first = plan[i];
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
    const k = HIT_PARAMS.map((p) => v[p]).join(',');
    return inst === 'BD' || levelBaked(inst, locks) ? `${k},${v.level}` : k;
  }).join(';');
}

// Le tempo suit le store du motif (TEMPO, tests, rechargement) ; tout ce qui change un coup le re-programme. Choisir une
// voix ne change aucun coup (2026-10-27, TRK et A S D F en lecture) : pas de re-programmation ; le tempo, les pas et les
// verrous, si (PatternState : bpm, steps, instrument, locks ; setBpm ne fait que garder pendingDur, ask l'applique)
let lastSteps = pattern.get().steps;
let lastLocks = pattern.get().locks;
let lastBpm = pattern.get().bpm;
pattern.subscribe(() => {
  const p = pattern.get();
  setBpm(p.bpm);
  if (p.steps === lastSteps && p.locks === lastLocks && p.bpm === lastBpm) return;
  lastSteps = p.steps;
  lastLocks = p.locks;
  lastBpm = p.bpm;
  ask();
});
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
  start();
}

function start(): boolean {
  if (running) return true;
  if (locked) return false;
  const c = context();
  if (!c || c.state === 'closed') return false;
  if (c.state !== 'running') {
    if (waitCtx !== c) {
      cancelWait();
      waitCtx = c;
      c.addEventListener('statechange', onCtxState);
      waitTimer = window.setTimeout(cancelWait, WAIT_MS);
    }
    return false;
  }
  cancelWait();
  bpm = pattern.get().bpm;
  stepDur = stepDuration(bpm);
  pendingDur = 0;
  // L'arpege qui joue deja, sinon la basse seule (audio/sched.ts extraGrid, 2026-10-21)
  const g = (follow ? follow(c.currentTime + START_DELAY_S) : null) ?? extraGrid(c.currentTime + START_DELAY_S);
  anchor = g ? g.time : c.currentTime + START_DELAY_S;
  nextTime = anchor;
  n = 0;
  step = g ? g.step : 0;
  abs = 0;
  barAbs = -1;
  plan.length = 0;
  runFirst = seq;
  firstBar = true;
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
  if (!running) return;
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
  start,
  stop,
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
  /** RUN/STOP ; renvoie le nouvel etat (un RUN qui attend le son : un deuxieme appui l'annule). */
  toggle(): boolean {
    if (running) stop();
    else if (waitCtx) cancelWait();
    else start();
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
  /** Le debut de chaque mesure, avant que son premier pas soit programme ; rend de quoi se desabonner. */
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
};
