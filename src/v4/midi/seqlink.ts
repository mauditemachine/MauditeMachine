/**
 * Le Roto-Control en sequenceur (2026-10-09, Mika : "on fait le sequenceur
 * sur le Roto maintenant" ; le 2026-10-08 : "pense tu que ya moyen de faire
 * un sequenceur qui se suit genre comme un vrai sequenceur et j'ajoute mes
 * steps etc.. ? meme pour les parameters lock je trouve ca tellement cool
 * comme ca j'appuis sur une touche et je tourne un encoder !"). Les setups
 * RSEQ (MM-RYTM) et BSEQ (MM-BASS) de midi/roto.ts : huit boutons de pas, une
 * fenetre de huit sur les seize pas, que le site fait defiler (le Roto ne
 * dit pas sa page et le site ne peut pas la changer). Ici :
 * - la fenetre (1 a 8, 9 a 16) : STEPS 9-16 la change ; STEP FOLLOW (par
 *   defaut) la fait suivre la tete de lecture en marche, comme le page follow
 *   d'une Elektron : la lumiere court sur les seize pas avec huit boutons
 *   (STEP FOLLOW, pas FOLLOW : la case FOLLOW du panneau MIDI est autre
 *   chose, la revue du 2026-10-09). Elle s'arrete sur place tant qu'un pas
 *   est tenu (le bouton garde son pas), en LOCK (elle montre le pas en LOCK,
 *   meme pose sur la face) et dans EDIT (elle s'y ouvre sur le pattern qui
 *   joue, puis ne bouge plus quand la chaine avance) ; STEPS 9-16 en marche
 *   coupe STEP FOLLOW (sinon elle repartirait aussitot). Un appui se lit dans
 *   la fenetre de son heure (MIDIMessageEvent.timeStamp) : la tete de
 *   lecture garde ses 250 dernieres ms, un appui fait juste avant le passage
 *   a 9-16 mais traite apres (une image lourde) reste sur 1 a 8 ;
 * - les gestes d'un pas (des PUSH : 127 a l'appui, 0 au lacher), ceux de la
 *   face : la tape (moins de 350 ms, rien tourne) pose un coup ou le retire
 *   (MM-RYTM : la voix choisie, fort comme une tape ; MM-BASS : une note, la
 *   tonique) ; la tenue (350 ms) met le LOCK sur le pas, les moteurs vont a
 *   ses valeurs ; un encodeur tourne pendant la tenue le verrouille (un pas
 *   vide recoit un coup, comme sur la face), le lacher sort alors du LOCK
 *   (momentane, le LOCK fixe d'avant la premiere tenue revient) ; un encodeur
 *   vide de la page tourne compte aussi (le geste est momentane) ; lache sans
 *   rien tourner, le LOCK reste (une tape sur le meme pas en sort, une tape
 *   sur un autre l'y deplace) ; plusieurs pas tenus sur le MM-RYTM : un
 *   encodeur les verrouille tous. Dans EDIT, les pas sont les patterns (la
 *   tape le choisit ou le chaine, la tenue d'un vide y copie), comme sur la
 *   face ; EDIT ouvert ou ferme pendant une tenue : le lacher ne joue rien.
 *   Les boutons en TOGGLE (la case du panneau MIDI, si les LEDs des PUSH ne
 *   suivent pas le site) : chaque message est une tape (seqTap) ;
 * - les LEDs des pas : allumee un coup, eteinte un pas vide, la tete de
 *   lecture en negatif sur son pas (deux etats par LED, ses deux couleurs
 *   fixees dans le setup), le pas en LOCK qui clignote (4 Hz), un pas tenu
 *   allume ; dans EDIT, les patterns remplis, celui qui joue clignote ; la
 *   LED de STEPS 9-16 : la fenetre 9 a 16. La tete de lecture part a
 *   l'heure : chaque changement part d'avance (150 ms) avec l'heure du pas
 *   (MIDIOutput.send(data, timestamp)), calee sur ce que la sortie son joue
 *   (AudioContext.getOutputTimestamp), pas au tick de 50 ms du retour ; deux
 *   messages par pas (le pas d'avant, le nouveau), les huit quand la fenetre
 *   change, la voix, EDIT ou le pattern. Un changement entre-temps (un coup
 *   pose, STOP, un LOCK) corrige les messages deja partis : un message juste
 *   apres a la meme heure ;
 * - apres un changement de LOCK, les potards du setup sont ignores 150 ms
 *   (les moteurs bougent ; sauf celui qu'on tourne), puis leurs valeurs
 *   repartent vers les moteurs.
 * midi/midi.ts envoie pour lui (seqAttach : vers les sorties Roto seulement,
 * de l'onglet qui pilote, le retour allume ; rien sans Roto branche) et
 * l'appelle (seqKnobGuard, seqKnobTurn, seqSeen, seqLed). Le MM-BASS, charge
 * a part, s'inscrit a son arrivee (seqRegister, bass/midi.ts).
 */

import { clock } from '../audio/clock';
import { context } from '../audio/drums';
import { INSTRUMENTS, VEL_NAMES, pattern, velocity } from '../audio/pattern';
import { gesture, patternHold, patternTap, rytmLockEnter, rytmLockTap, tuneVoice } from '../actions';
import type { Stage } from '../scene/renderer';
import { editor } from '../state/editor';
import { lcdMessage } from '../state/lcdMessage';
import { patterns } from '../state/patterns';
import { rytmLock } from '../state/rytmLock';
import { rytmPage } from '../state/rytmPage';
import type { Inst } from '../theme';
import { rotoKeyInfo, rotoKeysOfSetup, type RotoSetupName } from './roto';

export type SeqId = 'rytm' | 'bass';

/** Ce qu'une machine dit et fait pour le sequenceur du Roto. */
export interface SeqMachine {
  /** EDIT : les pas sont les patterns */
  editing(): boolean;
  /** le pas i allume : un coup (une note, une liaison) ; dans EDIT, un pattern rempli */
  lit(i: number): boolean;
  /** dans EDIT : le pattern qui joue */
  current(): number;
  /** le pas en LOCK (-1 : aucun) */
  lockStep(): number;
  /** le LOCK fixe (il reste au lacher) : son pas, -1 */
  latched(): number;
  running(): boolean;
  /** ce qui change les LEDs : les pas, la voix, le LOCK, EDIT, RUN */
  subscribe(fn: () => void): () => void;
  /**
   * chaque pas programme : son rang, son heure (temps du contexte audio, swing
   * compris) et sa grille (la meme sans le swing) ; un pas re-programme
   * previent de nouveau, a partir du premier pas annule
   */
  onStep(fn: (step: number, when: number, grid: number) => void): () => void;
  /** elle change : les huit LEDs repartent (la voix, EDIT, le pattern) */
  context(): string;
  /** les verrous poses (un compteur) ; absent : les encodeurs tournes pendant la tenue comptent */
  writes?(): number;
  /** un pas enfonce, lache (le MM-RYTM tient ses pas : un encodeur les verrouille) */
  press?(i: number): void;
  unpress?(i: number): void;
  /** la tape : un coup pose ou retire (en LOCK : comme sur la face) */
  tap(i: number, stage: Stage | null): void;
  /** LOCK sur le pas (latched : fixe) ; false s'il n'a pas pu */
  enter(i: number, latched: boolean): boolean;
  /** la fin d'un LOCK momentane : le LOCK fixe d'avant (prev), sinon plus de LOCK */
  restore(prev: number): void;
  /** le LOCK momentane devient fixe */
  latch(): void;
  /** dans EDIT : un pattern tape, tenu */
  patternTap(i: number, stage: Stage | null): void;
  patternHold(i: number): void;
  /** un encodeur tourne pendant que le pas i est tenu : true s'il le verrouille (le MM-BASS y met le LOCK avant) */
  knobHeld?(i: number, targetId: string): boolean;
  /** la LED d'une touche du setup qui n'est pas un pas (une page, LOCK, EDIT...) ; null : pas de LED */
  led(id: string): number | null;
  /** une ligne a l'ecran de la machine */
  say(text: string): void;
}

/** Ce que midi/midi.ts fait pour nous. */
export interface SeqLink {
  /** un CC vers les sorties Roto ; at : l'heure (performance.now), absente : tout de suite ; false : rien n'est parti */
  send(key: string, v7: number, at?: number): boolean;
  /** un Roto branche, cet onglet pilote, le retour et la carte allumes */
  ready(): boolean;
  /** les potards d'un setup repartent vers les moteurs (au tick suivant) */
  refresh(setup: RotoSetupName): void;
}

/** les huit pas, puis la touche STEPS 9-16 */
const N = 9;
/** La tenue qui met le LOCK (comme la face), celle qui copie un pattern dans EDIT. */
const HOLD_MS = 350;
const EDIT_HOLD_MS = 500;
/**
 * Les LEDs partent d'avance, avec leur heure, et le reveil qui les envoie :
 * 150 ms devant (une image lourde de la scene 3D gele le fil principal plus
 * de 60 ms : la lumiere serait partie en retard), les corrections rattrapent
 * ce qui change entre-temps.
 */
const AHEAD_MS = 150;
/** Le reveil : 25 ms suffisent, les messages partent 150 ms devant (la revue : 100 reveils par seconde pour rien) */
const TICK_MS = 25;
/** La tete de lecture garde ses pas joues depuis moins que ca : un appui traite en retard se lit a son heure. */
const HISTORY_MS = 250;
/** Le pas en LOCK clignote a 4 Hz (125 ms allume, 125 eteint). */
const BLINK_MS = 125;
/** Apres un changement de LOCK : les potards ignores (les moteurs bougent). */
const GUARD_MS = 150;
/** Un potard touche depuis moins que ca : on le tourne (il n'est pas ignore). */
const TOUCH_MS = 300;
/** Un LOCK change si vite apres un potard : c'est lui qui l'a fait (deux doigts), rien a ignorer. */
const KNOB_CAUSE_MS = 30;

interface Head {
  /** l'heure du pas (performance.now) */
  at: number;
  /** son heure audio */
  when: number;
  /** sa grille (l'heure audio sans le swing) : une re-programmation annule les pas a partir de la sienne */
  grid: number;
  step: number;
}

/** Des messages partis d'avance, pas encore joues ; fix : une correction (juste apres un message deja parti). */
interface Future {
  at: number;
  msgs: Map<number, number>;
  fix: boolean;
}

interface Down {
  i: number;
  t0: number;
  timer: number;
  /** la tenue a mis le LOCK (timerLock : la minuterie des 350 ms) */
  lockHold: boolean;
  timerLock: boolean;
  writes0: number;
  /** les potards du setup tournes pendant la tenue (un encodeur vide compte : le geste est momentane) */
  turns: number;
  /** dans EDIT (un pattern) */
  edit: boolean;
  /** EDIT : la tenue a copie */
  held: boolean;
  /** un appareil debranche, un autre onglet : le lacher ne joue pas */
  cancelled: boolean;
}

interface Lane {
  id: SeqId;
  setup: RotoSetupName;
  /** les cles du Roto : les huit pas, STEPS 9-16 */
  keys: (string | null)[];
  m: SeqMachine | null;
  off: (() => void) | null;
  follow: boolean;
  /** la fenetre (0 : 1 a 8, 1 : 9 a 16) hors FOLLOW, et celle de FOLLOW au dernier reveil */
  win: number;
  following: boolean;
  lock: number;
  ctx: string;
  /** EDIT au dernier passage : la fenetre s'y ouvre sur le pattern qui joue, une fois */
  edit: boolean;
  run: boolean;
  /**
   * le LOCK fixe d'avant la premiere tenue (pris quand aucun pas n'est tenu) :
   * le dernier pas lache d'un geste momentane le rend, meme si une autre
   * tenue a deplace le LOCK entre-temps
   */
  prev: number;
  /** le pas (0 a 15) que chaque bouton a pris a son dernier appui : le panneau MIDI le dit */
  hit: number[];
  heads: Head[];
  future: Future[];
  /** l'etat des LEDs du Roto a l'instant (-1 : inconnu, a renvoyer) */
  shown: number[];
  /** jusqu'ou les messages d'avance sont partis */
  until: number;
  downs: Map<number, Down>;
  guard: number;
  guardTimer: number;
  exempt: Set<string>;
  knobAt: Map<string, number>;
  knobT: number;
  queued: boolean;
}

let link: SeqLink | null = null;
let timer = 0;

function makeLane(id: SeqId, setup: RotoSetupName): Lane {
  const keys: (string | null)[] = Array.from({ length: N }, () => null);
  const re = new RegExp(`^${id}:seq:([1-8])$`);
  for (const k of rotoKeysOfSetup(setup)) {
    const inf = rotoKeyInfo(k);
    const t = inf?.ctl?.t;
    if (!inf?.button || !t) continue;
    const mm = re.exec(t);
    if (mm) keys[Number(mm[1]) - 1] = k;
    else if (t === `${id}:seq:window`) keys[8] = k;
  }
  return {
    id,
    setup,
    keys,
    m: null,
    off: null,
    follow: true,
    win: 0,
    following: false,
    lock: -1,
    ctx: '',
    edit: false,
    run: false,
    prev: -1,
    hit: Array.from({ length: 8 }, (_, b) => b),
    heads: [],
    future: [],
    shown: Array.from({ length: N }, () => -1),
    until: 0,
    downs: new Map(),
    guard: 0,
    guardTimer: 0,
    exempt: new Set(),
    knobAt: new Map(),
    knobT: -Infinity,
    queued: false,
  };
}

const lanes: Record<SeqId, Lane> = { rytm: makeLane('rytm', 'RSEQ'), bass: makeLane('bass', 'BSEQ') };
const LANES: readonly Lane[] = [lanes.rytm, lanes.bass];
/** Les cles tenues ici (les pas, STEPS 9-16) : leur LED part d'ici, pas du tick de midi.ts. */
const owned = new Map<string, { lane: Lane; b: number }>();
for (const l of LANES) l.keys.forEach((k, b) => k && owned.set(k, { lane: l, b }));

const laneOf = (setup: RotoSetupName | null | undefined): Lane | null => (setup === 'RSEQ' ? lanes.rytm : setup === 'BSEQ' ? lanes.bass : null);

/* ---------------- l'heure ---------------- */

/**
 * L'ecart entre l'heure audio et performance.now (ms) : la mediane des neuf
 * dernieres mesures de la sortie son (une a chaque pas). Elle avance par blocs
 * et une mesure peut tomber loin (une machine chargee) : la mediane l'ignore,
 * et suit un vrai changement (une autre sortie son) en quelques pas.
 */
const offsets: number[] = [];

/** L'heure (performance.now) ou l'on entend l'instant audio `when` : getOutputTimestamp, sinon currentTime et la latence de sortie. */
export function seqPerfOf(when: number): number {
  const c = context();
  if (!c) return performance.now();
  let off = Number.NaN;
  try {
    const ts = c.getOutputTimestamp?.();
    if (ts && typeof ts.performanceTime === 'number' && typeof ts.contextTime === 'number' && ts.performanceTime > 0 && ts.contextTime > 0) off = ts.performanceTime - ts.contextTime * 1000;
  } catch {
    /* le navigateur ne la dit pas */
  }
  if (!Number.isFinite(off)) off = performance.now() - c.currentTime * 1000 + ((c.outputLatency || 0) + (c.baseLatency || 0)) * 1000;
  // Un autre contexte audio (son heure repart de zero) : les mesures d'avant ne valent plus
  if (offsets.length > 0 && Math.abs(off - offsets[offsets.length - 1]) > 1000) offsets.length = 0;
  offsets.push(off);
  if (offsets.length > 9) offsets.shift();
  const sorted = [...offsets].sort((a, b) => a - b);
  return when * 1000 + sorted[sorted.length >> 1];
}

const phaseOn = (t: number): boolean => (Math.floor(t / BLINK_MS) & 1) === 0;

/* ---------------- la fenetre, la tete de lecture ---------------- */

function playAt(l: Lane, t: number): number {
  if (!l.m || !l.m.running()) return -1;
  let s = -1;
  for (const h of l.heads) {
    if (h.at <= t) s = h.step;
    else break;
  }
  return s;
}

/** FOLLOW agit-il : en marche, hors EDIT, hors LOCK, aucun pas tenu. */
function following(l: Lane): boolean {
  const m = l.m;
  return !!m && l.follow && m.running() && !m.editing() && m.lockStep() < 0 && l.downs.size === 0;
}

/** La fenetre a l'heure t (FOLLOW : celle de la tete de lecture). */
function winAt(l: Lane, t: number): number {
  if (following(l)) {
    const p = playAt(l, t);
    if (p >= 0) return p >> 3;
  }
  return l.win;
}

/** Un pas tenu (allume tant qu'on le tient). */
function heldStep(l: Lane, i: number): boolean {
  for (const d of l.downs.values()) if (d.i === i && !d.cancelled) return true;
  return false;
}

/** Une LED clignote dans la fenetre (le pas en LOCK, le pattern qui joue dans EDIT). */
function blinks(l: Lane, t: number): boolean {
  const m = l.m;
  if (!m) return false;
  const w = winAt(l, t);
  if (m.editing()) return m.current() >> 3 === w;
  const lk = m.lockStep();
  return lk >= 0 && lk >> 3 === w && !heldStep(l, lk);
}

/** Les LEDs voulues a l'heure t (0 ou 1) : les huit pas, puis STEPS 9-16. */
function desired(l: Lane, t: number): number[] {
  const m = l.m as SeqMachine;
  const out = Array.from({ length: N }, () => 0);
  const w = winAt(l, t);
  const ed = m.editing();
  const lk = ed ? -1 : m.lockStep();
  const p = ed ? -1 : playAt(l, t);
  const on = phaseOn(t);
  const cur = ed ? m.current() : -1;
  for (let b = 0; b < 8; b += 1) {
    const i = w * 8 + b;
    let v: boolean;
    if (heldStep(l, i)) v = true;
    else if (ed) v = i === cur ? on : m.lit(i);
    else if (i === lk) v = on;
    else {
      v = m.lit(i);
      // La tete de lecture en negatif (deux etats par LED, comme une Elektron)
      if (i === p) v = !v;
    }
    out[b] = v ? 1 : 0;
  }
  out[8] = w === 1 ? 1 : 0;
  return out;
}

/** L'etat du Roto a l'heure t : celui d'a present, puis les messages partis d'avance jusqu'a t. */
function folded(l: Lane, t: number): number[] {
  const s = l.shown.slice();
  for (const f of l.future) {
    if (f.at > t) break;
    for (const [b, v] of f.msgs) s[b] = v;
  }
  return s;
}

function send(l: Lane, b: number, v: number, at?: number): void {
  const k = l.keys[b];
  if (k && link) link.send(k, v ? 127 : 0, at);
}

function addFuture(l: Lane, f: Future): void {
  const same = l.future.find((x) => x.at === f.at);
  if (same) {
    for (const [b, v] of f.msgs) same.msgs.set(b, v);
    return;
  }
  let i = l.future.length;
  while (i > 0 && l.future[i - 1].at > f.at) i -= 1;
  l.future.splice(i, 0, f);
}

/** Les messages d'avance joues : l'etat du Roto avance. */
function pass(l: Lane, now: number): void {
  while (l.future.length > 0 && l.future[0].at <= now) {
    const f = l.future.shift() as Future;
    for (const [b, v] of f.msgs) l.shown[b] = v;
  }
  // La tete de lecture : le pas qui jouait il y a 250 ms et les suivants restent (un appui traite en retard, une image
  // lourde, se lit a l'heure de son message : la fenetre qu'il voyait, revue du 2026-10-09), les plus vieux partent
  const old = now - HISTORY_MS;
  let k = 0;
  while (k + 1 < l.heads.length && l.heads[k + 1].at <= old) k += 1;
  if (k > 0) l.heads.splice(0, k);
}

/**
 * Les messages d'avance de (from, to] : a chaque heure ou les LEDs changent
 * (un pas de la tete de lecture, un clignotement), ce qui differe de l'etat
 * prevu du Roto part avec cette heure ; une heure deja partie recoit une
 * correction juste apres (le meme instant + 0.5 ms : la file MIDI la joue
 * apres). La fenetre qui change : les neuf LEDs.
 */
function dispatch(l: Lane, from: number, to: number): void {
  const m = l.m;
  if (!m || to <= from) return;
  const times = new Set<number>();
  for (const h of l.heads) if (h.at > from && h.at <= to) times.add(h.at);
  for (const f of l.future) if (!f.fix && f.at > from && f.at <= to) times.add(f.at);
  if (blinks(l, from) || blinks(l, to)) for (let k = Math.floor(from / BLINK_MS) + 1; k * BLINK_MS <= to; k += 1) times.add(k * BLINK_MS);
  const list = [...times].sort((a, b) => a - b);
  for (const t of list) {
    const old = l.future.some((f) => f.at === t && !f.fix);
    const at = old ? t + 0.5 : t;
    const want = desired(l, t);
    const have = folded(l, at);
    const flip = !old && winAt(l, t) !== winAt(l, t - 0.5);
    const msgs = new Map<number, number>();
    for (let b = 0; b < N; b += 1) if (flip || want[b] !== have[b]) msgs.set(b, want[b]);
    if (msgs.size === 0) continue;
    for (const [b, v] of msgs) send(l, b, v, at);
    addFuture(l, { at, msgs, fix: old });
  }
  l.until = Math.max(l.until, to);
}

/** Tout ce qui a change : les LEDs d'a present, puis les messages d'avance refaits (corriges). */
function resync(l: Lane): void {
  const m = l.m;
  if (!m) return;
  const now = performance.now();
  const ctx = m.context();
  if (ctx !== l.ctx) {
    l.ctx = ctx;
    // Une autre voix, EDIT, un autre pattern : les huit LEDs repartent
    l.shown.fill(-1);
  }
  const ed = m.editing();
  if (ed !== l.edit) {
    l.edit = ed;
    // EDIT s'ouvre sur la fenetre du pattern qui joue, une fois : ensuite la chaine qui avance (A01 > A10) ne la tire
    // plus d'une moitie a l'autre a chaque mesure (sous un doigt qui tient un pattern pour la copie), revue du 2026-10-09
    if (ed) l.win = m.current() >> 3;
  }
  const run = m.running();
  if (run !== l.run) {
    l.run = run;
    if (!run) l.heads = [];
  }
  // FOLLOW s'arrete (un pas tenu, LOCK, EDIT, STOP) : la fenetre reste ou elle etait
  const f = following(l);
  if (l.following && !f) l.win = winAt2(l, now);
  l.following = f;
  const lk = m.lockStep();
  if (lk !== l.lock) {
    l.lock = lk;
    // LOCK (pose ici ou sur la face) : la fenetre montre son pas, qui clignote
    if (lk >= 0) l.win = lk >> 3;
    lockChanged(l, now);
  }
  pass(l, now);
  if (!link || !link.ready()) {
    // Pas de Roto : rien ne part ; il revient, tout repart
    l.shown.fill(-1);
    l.future = [];
    l.until = now;
    arm();
    return;
  }
  const want = desired(l, now);
  for (let b = 0; b < N; b += 1) {
    if (want[b] === l.shown[b]) continue;
    send(l, b, want[b]);
    l.shown[b] = want[b];
  }
  dispatch(l, now, Math.max(l.until, now + AHEAD_MS));
  arm();
}

/** La fenetre de FOLLOW a l'instant, depuis la tete de lecture (la fenetre d'avant si elle ne joue pas). */
function winAt2(l: Lane, t: number): number {
  let s = -1;
  for (const h of l.heads) {
    if (h.at <= t) s = h.step;
    else break;
  }
  return s >= 0 ? s >> 3 : l.win;
}

function queue(l: Lane): void {
  if (l.queued) return;
  l.queued = true;
  queueMicrotask(() => {
    l.queued = false;
    resync(l);
  });
}

/** Le reveil : les messages d'avance des 150 ms qui viennent. */
function tick(): void {
  const now = performance.now();
  for (const l of LANES) {
    if (!l.m) continue;
    pass(l, now);
    if (following(l)) l.win = winAt(l, now);
    if (!link || !link.ready()) {
      l.shown.fill(-1);
      l.future = [];
      l.until = now;
      continue;
    }
    // Un reveil en retard rattrape (des heures passees partent tout de suite), jamais plus de 200 ms
    dispatch(l, Math.max(l.until, now - 200), now + AHEAD_MS);
  }
  arm();
}

function arm(): void {
  const need = !!link && link.ready() && LANES.some((l) => !!l.m && (l.m.running() || l.future.length > 0 || blinks(l, performance.now())));
  if (need && !timer && typeof window !== 'undefined') timer = window.setInterval(tick, TICK_MS);
  else if (!need && timer) {
    window.clearInterval(timer);
    timer = 0;
  }
}

/**
 * Un pas programme (l'horloge du MM-RYTM, la sequence du MM-BASS). Une
 * re-programmation (un pas edite, le tempo, le swing) repart du premier pas
 * annule, avec sa grille : les pas d'avant sonnent encore et restent, ceux a
 * partir de cette grille s'en vont. La grille et pas l'heure swinguee (la
 * revue du 2026-10-09 : le MM-BASS decide sur la grille ; un pas impair
 * dont la grille est sous la garde de 30 ms mais l'heure swinguee au-dela
 * sonnait encore et perdait sa lumiere, la tete de lecture sautait un pas).
 */
function onHead(l: Lane, step: number, when: number, grid: number): void {
  const at = seqPerfOf(when);
  const last = l.heads[l.heads.length - 1];
  if (last && last.grid >= grid - 1e-4) l.heads = l.heads.filter((h) => h.grid < grid - 1e-4);
  let i = l.heads.length;
  while (i > 0 && l.heads[i - 1].at > at) i -= 1;
  l.heads.splice(i, 0, { at, when, grid, step });
  queue(l);
}

/** Un changement de LOCK : les potards du setup attendent les moteurs (sauf celui qu'on tourne), puis repartent. */
function lockChanged(l: Lane, now: number): void {
  if (now - l.knobT < KNOB_CAUSE_MS) return;
  l.guard = now + GUARD_MS;
  l.exempt = new Set([...l.knobAt].filter(([, t]) => now - t < TOUCH_MS).map(([k]) => k));
  window.clearTimeout(l.guardTimer);
  l.guardTimer = window.setTimeout(() => {
    l.guard = 0;
    link?.refresh(l.setup);
  }, GUARD_MS);
}

/* ---------------- les gestes (les cibles rytm:seq:<1-8>, bass:seq:<1-8>) ---------------- */

/**
 * L'heure d'arrivee du message en cours (MIDIMessageEvent.timeStamp, midi.ts) :
 * la tenue d'un pas se mesure d'un message a l'autre (une image lourde de la
 * scene qui gele le fil principal entre l'appui et le lacher ne fait pas
 * d'une tape un LOCK) ; absente (un test), l'heure du traitement.
 */
let msgAt: number | null = null;
export function seqMsgAt(t: number | undefined): void {
  msgAt = t !== undefined && Number.isFinite(t) && t > 0 && t <= performance.now() + 5 ? t : null;
}
const eventNow = (): number => msgAt ?? performance.now();

/** Les pas tenus qui comptent (hors EDIT, pas annules). */
const active = (l: Lane): Down[] => [...l.downs.values()].filter((x) => !x.edit && !x.cancelled);

/** Un potard tourne pendant la tenue (un verrou pose, ou un encodeur vide de la page) : le geste est momentane. */
const turnedOf = (m: SeqMachine, d: Down): boolean => d.turns > 0 || (!!m.writes && m.writes() > d.writes0);

/** Un bouton de pas enfonce (b : 0 a 7, sa place dans la fenetre). */
export function seqPress(id: SeqId, b: number): void {
  const l = lanes[id];
  const m = l.m;
  if (!m || b < 0 || b > 7 || l.downs.has(b)) return;
  const now = eventNow();
  // Le pas de la fenetre a l'heure du message (la tete de lecture garde ses 250 dernieres ms) ; elle s'arrete tant que
  // le bouton est tenu (il garde son pas)
  const w = winAt(l, now);
  l.win = w;
  l.following = false;
  const i = w * 8 + b;
  l.hit[b] = i;
  const ed = m.editing();
  // Le LOCK fixe d'avant le geste : pris au premier pas tenu, rendu par le dernier lache (revue du 2026-10-09 : chaque
  // tenue prenait le sien, une deuxieme tenue apres le LOCK momentane de la premiere perdait le LOCK fixe)
  if (!ed && active(l).length === 0) l.prev = m.latched();
  const d: Down = { i, t0: now, timer: 0, lockHold: false, timerLock: false, writes0: m.writes?.() ?? 0, turns: 0, edit: ed, held: false, cancelled: false };
  l.downs.set(b, d);
  if (ed) {
    d.timer = window.setTimeout(() => {
      // EDIT ferme pendant la tenue : rien a copier
      if (l.downs.get(b) !== d || d.cancelled || !m.editing()) return;
      d.held = true;
      m.patternHold(i);
    }, EDIT_HOLD_MS);
  } else {
    m.press?.(i);
    d.timer = window.setTimeout(() => {
      if (l.downs.get(b) !== d || d.lockHold || d.cancelled || m.editing()) return;
      // Deja en LOCK par un encodeur tourne pendant la tenue : il y reste jusqu'au lacher
      if (turnedOf(m, d)) {
        d.lockHold = true;
        return;
      }
      if (m.enter(i, false)) {
        d.lockHold = true;
        d.timerLock = true;
      }
    }, HOLD_MS);
  }
  queue(l);
}

/** Un bouton de pas lache : la tape, la fin d'un LOCK momentane, ou le LOCK qui reste. */
export function seqRelease(id: SeqId, b: number, stage: Stage | null = null): void {
  const l = lanes[id];
  const m = l.m;
  const d = l.downs.get(b);
  if (!m || !d) return;
  l.downs.delete(b);
  window.clearTimeout(d.timer);
  if (d.edit) {
    if (!d.held && !d.cancelled && m.editing()) m.patternTap(d.i, stage);
    queue(l);
    return;
  }
  m.unpress?.(d.i);
  const turned = turnedOf(m, d);
  // Le dernier pas tenu du geste : c'est lui qui rend le LOCK fixe d'avant
  const last = active(l).length === 0;
  // La minuterie a mis le LOCK pendant que le fil principal gelait, mais le lacher etait arrive avant les 350 ms
  // (l'heure des messages le dit) : c'etait une tape
  const stalled = d.timerLock && !turned && msgAt !== null && eventNow() - d.t0 < HOLD_MS;
  if (d.cancelled || m.editing()) {
    // Rien ne joue (un appareil debranche, un autre onglet ; EDIT ouvert pendant la tenue : une tape y poserait un coup
    // dans le pattern, revue du 2026-10-09) ; un LOCK de la tenue s'en va
    if ((d.lockHold || turned) && last) m.restore(l.prev);
  } else if (stalled) {
    m.restore(l.prev);
    m.tap(d.i, stage);
  } else if (!d.lockHold && !turned && eventNow() - d.t0 >= HOLD_MS) {
    // Une tenue dont la minuterie n'a pas parle (le fil principal gele) : mesuree d'un message a l'autre, le LOCK fixe
    m.enter(d.i, true);
  } else if (!d.lockHold && !turned) m.tap(d.i, stage);
  else if (turned) {
    // Momentane : le LOCK fixe d'avant revient, ou plus de LOCK ; d'autres pas tenus continuent (le dernier lache decide)
    if (last) m.restore(l.prev);
  } else if (last) m.latch();
  // Une tenue lachee pendant qu'un autre pas reste tenu ne fixe rien : le dernier lache decide (sinon le LOCK fixe
  // ainsi bloquait le retour du LOCK d'avant quand on tourne ensuite avec l'autre pas, la revue du 2026-10-09)
  queue(l);
}

/**
 * Un pas tape d'un coup (2026-10-09, les boutons des pas en TOGGLE : la case
 * du panneau MIDI, si les LEDs des PUSH ne suivent pas le site) : un bouton
 * TOGGLE envoie un message par appui (127 puis 0 a l'appui suivant), chacun
 * est une tape ; la tenue n'existe plus (LOCK : la touche LOCK, page 4).
 */
export function seqTap(id: SeqId, b: number, stage: Stage | null = null): void {
  seqPress(id, b);
  seqRelease(id, b, stage);
}

/** STEPS 9-16 : l'autre fenetre (en marche avec STEP FOLLOW, il se coupe : sinon elle repartirait aussitot). */
export function seqWindow(id: SeqId): void {
  const l = lanes[id];
  const m = l.m;
  if (!m) return;
  const now = performance.now();
  const w = 1 - winAt(l, now);
  const stop = following(l);
  if (stop) l.follow = false;
  l.win = w;
  l.following = false;
  l.shown.fill(-1);
  m.say(`ROTO STEPS ${w ? '9-16' : '1-8'}${stop ? '  STEP FOLLOW OFF' : ''}`);
  queue(l);
}

export const seqFollow = (id: SeqId): boolean => lanes[id].follow;

/** STEP FOLLOW (une bascule du Roto, sa LED suit) : la fenetre suit la tete de lecture. */
export function seqSetFollow(id: SeqId, on: boolean): void {
  const l = lanes[id];
  if (l.follow === on) return;
  l.follow = on;
  l.m?.say(`ROTO STEP FOLLOW ${on ? 'ON' : 'OFF'}`);
  queue(l);
}

/** La voix des pas (RSEQ, page 3) : choisie sans la jouer, jamais retiree ; l'ecran dit ce qu'elle change sur le Roto : ses huit pas. */
export function seqVoice(inst: Inst): void {
  if (pattern.get().instrument !== inst) tuneVoice(inst);
  // 1.6 s (pas les 0.8 s d'un message) : la touche se presse sur le Roto, les yeux y sont, l'ecran doit encore le dire
  lcdMessage.show(`ROTO STEPS > ${inst}`, 1600);
}

/* ---------------- ce que midi/midi.ts appelle ---------------- */

/** midi/midi.ts : de quoi envoyer. */
export function seqAttach(l: SeqLink): void {
  link = l;
  for (const x of LANES) {
    x.shown.fill(-1);
    queue(x);
  }
}

/** Une cle dont la LED part d'ici (les pas, STEPS 9-16) : le tick de midi.ts la laisse. */
export const seqOwns = (key: string): boolean => owned.has(key);

/**
 * La LED d'une touche des setups sequenceurs qui n'est pas un pas (une
 * page, une voix, LOCK, EDIT, ACCENT...) ; null : pas de LED (une action),
 * ou une cle d'un autre setup.
 */
export function seqLed(key: string, id: string): number | null {
  if (owned.has(key)) return null;
  const inf = rotoKeyInfo(key);
  if (!inf || !inf.button) return null;
  const l = laneOf(inf.setup);
  if (!l) return null;
  // Une touche de l'autre machine dans ce setup (aucune aujourd'hui) : sa machine la dit
  const m = id.startsWith('rytm:') ? lanes.rytm.m : id.startsWith('bass:') ? lanes.bass.m : null;
  return m ? m.led(id) : null;
}

/** Un potard d'un setup sequenceur : false pendant que les moteurs vont aux valeurs du LOCK (150 ms, sauf celui qu'on tourne). */
export function seqKnobGuard(setup: RotoSetupName, key: string): boolean {
  const l = laneOf(setup);
  if (!l) return true;
  return !(performance.now() < l.guard && !l.exempt.has(key));
}

/**
 * Un potard d'un setup sequenceur va tourner : un pas tenu le prend (le
 * MM-BASS passe en LOCK dessus avant ; le MM-RYTM verrouille les pas tenus
 * lui-meme, rytmLock.held). Un encodeur vide de la page (C sur FLTR) compte
 * aussi : on a tourne, le lacher sort du LOCK (la revue du 2026-10-09 : il
 * laissait le LOCK fixe, alors que le panneau promet un verrou momentane).
 */
export function seqKnobTurn(setup: RotoSetupName, key: string, id: string): void {
  const l = laneOf(setup);
  const m = l?.m;
  if (!l || !m) return;
  const now = performance.now();
  l.knobAt.set(key, now);
  l.knobT = now;
  const downs = active(l);
  if (downs.length === 0) return;
  if (m.knobHeld) {
    if (!m.knobHeld(downs[0].i, id)) return;
    downs[0].lockHold = true;
  }
  for (const x of downs) x.turns += 1;
}

/**
 * Un bouton d'un setup sequenceur a parle (l'appui, le lacher) : le Roto a
 * peut-etre change sa LED tout seul (un PUSH s'allume sous le doigt), le site
 * la renvoie. true : une cle d'ici ; false : a midi.ts de la renvoyer.
 */
export function seqSeen(key: string): boolean {
  const o = owned.get(key);
  if (!o) return false;
  o.lane.shown[o.b] = -1;
  queue(o.lane);
  return true;
}

/** Tout renvoyer (un Roto rebranche, un autre setup sur le Roto, l'onglet qui revient) ; setup : celui-la seulement. */
export function seqInvalidate(setup: RotoSetupName | null = null): void {
  for (const l of LANES) {
    if (setup && l.setup !== setup) continue;
    l.shown.fill(-1);
    queue(l);
  }
}

let againTimer = 0;
/**
 * Tout renvoyer, deux fois (l'onglet qui prend la main, le retour rallume) :
 * les LEDs parties d'avance d'un autre onglet, ou de celui-ci avant qu'il
 * perde la main, jouent encore jusqu'a 150 ms et ecraseraient le renvoi
 * (Chrome n'a pas MIDIOutput.clear) ; la deuxieme fois les recouvre (la
 * revue du 2026-10-09).
 */
export function seqResendAll(): void {
  seqInvalidate(null);
  if (typeof window === 'undefined') return;
  window.clearTimeout(againTimer);
  againTimer = window.setTimeout(() => seqInvalidate(null), AHEAD_MS + 20);
}

/** Une cle d'un des huit pas (pas STEPS 9-16). */
export const seqIsStep = (key: string): boolean => (owned.get(key)?.b ?? 8) < 8;

/** Le pas (1 a 16) que ce bouton a pris a son dernier appui (le panneau MIDI le dit) ; null : pas un bouton de pas. */
export function seqStepOf(key: string): number | null {
  const o = owned.get(key);
  // Dans EDIT le bouton est un pattern, pas un pas
  return o && o.b < 8 && !o.lane.m?.editing() ? o.lane.hit[o.b] + 1 : null;
}

/** Un appui qui etait un echo du Roto (midi.ts l'apprend apres coup) : le pas remonte sans jouer, le LOCK de sa tenue s'en va. */
export function seqDrop(key: string): void {
  const o = owned.get(key);
  if (!o || o.b > 7) return;
  const d = o.lane.downs.get(o.b);
  if (!d) return;
  d.cancelled = true;
  seqRelease(o.lane.id, o.b);
}

/** Un appareil debranche, un autre onglet prend le MIDI : les pas tenus remontent sans jouer (a leur lacher, que midi.ts fait). */
export function seqCancelAll(): void {
  for (const l of LANES) for (const d of l.downs.values()) d.cancelled = true;
}

/** Les pas tenus remontent tout de suite, sans jouer (les pas passent en TOGGLE : leur lacher ne viendra pas). */
export function seqDropAll(): void {
  for (const l of LANES) {
    for (const [b, d] of [...l.downs]) {
      d.cancelled = true;
      seqRelease(l.id, b);
    }
  }
}

/** Une machine s'inscrit (le MM-RYTM ici, le MM-BASS a l'arrivee de son code). */
export function seqRegister(id: SeqId, m: SeqMachine): void {
  const l = lanes[id];
  l.off?.();
  l.m = m;
  const a = m.subscribe(() => queue(l));
  const b = m.onStep((step, when, grid) => onHead(l, step, when, grid));
  l.off = () => {
    a();
    b();
  };
  l.ctx = '';
  l.edit = m.editing();
  l.lock = m.lockStep();
  l.run = m.running();
  queue(l);
}

/** Pour les tests et le panneau : l'etat d'un sequenceur. */
export function seqDebug(id: SeqId): {
  registered: boolean;
  keys: readonly (string | null)[];
  win: number;
  follow: boolean;
  following: boolean;
  play: number;
  heads: readonly Head[];
  future: readonly { at: number; msgs: [number, number][]; fix: boolean }[];
  shown: readonly number[];
  downs: readonly { i: number; lockHold: boolean; turns: number }[];
  guard: number;
  prev: number;
  hit: readonly number[];
} {
  const l = lanes[id];
  const now = performance.now();
  return {
    registered: !!l.m,
    keys: [...l.keys],
    win: winAt(l, now),
    follow: l.follow,
    following: following(l),
    play: playAt(l, now),
    heads: l.heads.map((h) => ({ ...h })),
    future: l.future.map((f) => ({ at: f.at, msgs: [...f.msgs], fix: f.fix })),
    shown: [...l.shown],
    downs: [...l.downs.values()].map((d) => ({ i: d.i, lockHold: d.lockHold, turns: d.turns })),
    guard: l.guard,
    prev: l.prev,
    hit: [...l.hit],
  };
}

/* ---------------- le MM-RYTM ---------------- */

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));
const rytmEditing = (): boolean => editor.get() === 'mm808';

const rytm: SeqMachine = {
  editing: rytmEditing,
  lit(i) {
    if (rytmEditing()) return patterns.filled(i);
    const p = pattern.get();
    // Sans voix choisie : tout le pattern (les pas ou une voix joue)
    return p.instrument ? velocity(p.steps, p.instrument, i) > 0 : INSTRUMENTS.some((x) => velocity(p.steps, x, i) > 0);
  },
  current: () => patterns.get().cur,
  lockStep: () => (rytmEditing() ? -1 : rytmLock.get().step),
  latched: () => (rytmLock.get().latched ? rytmLock.get().step : -1),
  running: () => clock.running,
  subscribe(fn) {
    const offs = [pattern.subscribe(fn), rytmLock.subscribe(fn), editor.subscribe(fn), patterns.subscribe(fn), clock.subscribe(fn)];
    return () => offs.forEach((o) => o());
  },
  onStep: (fn) => clock.onStep((e) => fn(e.step, e.when, e.when - e.off)),
  context: () => `${pattern.get().instrument ?? '-'}|${rytmEditing() ? 'E' : ''}${patterns.get().cur}`,
  writes: () => rytmLock.get().writes,
  // Tenu (comme un doigt sur la face) : un encodeur de page tourne pendant la tenue le verrouille tout de suite
  press(i) {
    if (!rytmEditing() && pattern.get().instrument) rytmLock.hold(i);
  },
  unpress: (i) => rytmLock.release(i),
  tap(i, stage) {
    gesture();
    stage?.pressStep(i);
    const inst = pattern.get().instrument;
    if (!inst) {
      lcdMessage.show('PICK A VOICE FIRST');
      return;
    }
    // En LOCK : le meme pas en sort, un autre y deplace le LOCK (comme une tape sur la face)
    if (rytmLock.get().step >= 0) {
      rytmLockTap(i);
      return;
    }
    // Un geste, un etat (un trig d'Elektron) : vide, un coup a la VEL des nouveaux pas de la voix (HIGH au depart,
    // sans bloc depuis le 2026-10-10 ; comme la face, le Dock et le clavier) ; un coup, vide
    const on = velocity(pattern.get().steps, inst, i) === 0;
    const vel = rytmPage.tapVel(inst);
    if (on) pattern.set(inst, i, vel);
    else pattern.clearStep(inst, i);
    rytmPage.select(i);
    lcdMessage.show(`STEP ${two(i + 1)} ${inst} ${VEL_NAMES[on ? vel : 0]}  HOLD: LOCK`);
  },
  enter: (i, latched) => rytmLockEnter(i, latched),
  restore(prev) {
    const s = rytmLock.get();
    if (s.step < 0 || s.latched) return;
    if (prev >= 0 && !rytmEditing()) rytmLock.enter(prev, true);
    else rytmLock.leave();
  },
  latch: () => rytmLock.latch(),
  patternTap: (i, stage) => patternTap(i, stage),
  patternHold: (i) => patternHold(i),
  led(id) {
    if (id.startsWith('rytm:page:')) return rytmPage.get().page === id.slice('rytm:page:'.length) ? 1 : 0;
    if (id.startsWith('rytm:seq:voice:')) return pattern.get().instrument === id.slice('rytm:seq:voice:'.length) ? 1 : 0;
    if (id === 'rytm:lock') return !rytmEditing() && rytmLock.get().step >= 0 ? 1 : 0;
    if (id === 'rytm:edit') return rytmEditing() ? 1 : 0;
    return null;
  },
  say: (t) => lcdMessage.show(t),
};

if (typeof window !== 'undefined') seqRegister('rytm', rytm);
