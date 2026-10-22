/**
 * MIDI OUT du MM-ARP (2026-10-22, l'etude VST3, Mika : "le MM-ARP en VST3 pour
 * Ableton" ; le gain rapide en attendant le plugin) : les notes que joue
 * l'arpegiateur (voyager/arp.ts) partent aussi vers une sortie Web MIDI choisie
 * dans le panneau MIDI (le bus IAC de macOS vers une piste MIDI d'Ableton, un
 * synthe branche...), avec leur force (l'accent de l'arpege en velocite) sur le
 * canal choisi, et si on le veut l'horloge MIDI (24 impulsions par noire),
 * START (ou la position et CONTINUE quand l'arpege part en cours de mesure, sur
 * la grille du MM-RYTM) et STOP. Rien ne part tant qu'aucune sortie n'est
 * choisie (OFF au depart) ; le choix est garde dans le navigateur
 * (mm.v4.midiout.1). Seul l'onglet qui pilote le MIDI envoie (midi/leader.ts).
 *
 * Le piege : l'arpege programme ses notes jusqu'a 300 ms d'avance et en annule
 * a chaque reglage (voyager/arp.ts reschedule, synthCancel), alors qu'une note
 * MIDI envoyee avec une heure future ne se reprend plus (Chromium n'a pas
 * MIDIOutput.clear()). Ici, chaque message attend dans une file et ne part
 * qu'au dernier moment, dans les SEND_AHEAD_S qui precedent son heure : une
 * fenetre plus courte que GUARD_S (audio/sched.ts), que l'arpege ne
 * reprogramme jamais. Un minuteur de TICK_MS vide la file ; l'heure de chaque
 * message est celle ou le son de la note sort des enceintes (perfOf, comme les
 * LEDs du Roto). Les relachements aussi passent par la file : une note qui
 * repart sur la meme hauteur avant la fin de la precedente la relache juste
 * avant (Ableton ne coupe plus la seconde) ; un relachement n'est jamais
 * oublie. Au STOP de l'arpege, a un changement de sortie et quand la page se
 * ferme : les notes en cours sont relachees (jamais avant leur depart deja
 * programme), puis ALL NOTES OFF (CC 123) ; STOP de l'horloge. La page qui se
 * cache relache seulement les notes tenues (son minuteur peut ralentir).
 *
 * La relecture (2026-10-22, test sans appareil, flux d'octets compare a ce que
 * l'arpege demande) :
 * - MIDI OFF (DISCONNECT) pendant que l'arpege joue laissait la note en cours
 *   tenue dans Ableton : l'acces part maintenant apres le relachement
 *   (noteOutRelease, midi/midi.ts) ;
 * - l'horloge (et START, la position, CONTINUE) part jusqu'a CLOCK_AHEAD_S
 *   avant son heure : un fil principal occupe 25 ms (une scene qui se charge, un
 *   panneau qui s'ouvre) la retardait, Ableton qui la suit vacillait ; ce qui est
 *   deja parti n'est jamais renvoye quand l'arpege se re-programme ;
 * - un changement de canal ou de sortie ne perd plus les notes deja programmees
 *   (300 ms) ni, pour le canal, l'horloge ;
 * - l'ecart entre l'heure du contexte et celle de la page suit d'abord ses
 *   mesures (sa premiere pouvait etre fausse de 10 a 30 ms, rattrapee a 5 ms
 *   par seconde : les premieres secondes en decalage, l'horloge qui derivait).
 *
 * La deuxieme relecture (2026-10-22, banc sans appareil : un esclave d'horloge
 * modele compte les impulsions, comme Ableton) :
 * - sans sortie branchee (CONNECT pas encore fait, acces refuse, MIDI OFF, port
 *   debranche), rien n'entre plus dans la file : elle grossissait toute la
 *   course, et au retour de la sortie START ou la position partaient perimes,
 *   tout de suite (Ableton cale n'importe ou dans la mesure). La sortie
 *   revenue, l'horloge repart au pas suivant, a sa position (SPP, CONTINUE) ;
 *   un START, une position ou un CONTINUE en retard ne part plus.
 */

import { context } from '../audio/drums';
import { DROP_AFTER_S } from '../audio/sched';
import { midiLeader } from './leader';

/** Un message part au plus SEND_AHEAD_S avant son heure (moins que GUARD_S, 30 ms : rien d'envoye n'est annule). */
export const SEND_AHEAD_S = 0.025;
/**
 * L'horloge, START, la position et CONTINUE (2026-10-22, la relecture) : jusqu'a CLOCK_AHEAD_S avant leur heure. Ils
 * ne dependent pas des reglages : une re-programmation les refait aux memes heures (ceux deja partis sont sautes,
 * clockSent), un tempo qui change les refait apres le dernier parti.
 */
export const CLOCK_AHEAD_S = 0.1;
/** Le minuteur de la file (ms). */
const TICK_MS = 10;
/** Un relachement force passe 1 ms apres l'appui deja programme (jamais avant lui). */
const AFTER_MS = 1;
const STORE_KEY = 'mm.v4.midiout.1';

export interface NoteOutView {
  /** la sortie choisie (son nom) ; '' : OFF */
  device: string;
  /** le canal, 1 a 16 */
  ch: number;
  /** l'horloge MIDI, START et STOP */
  clock: boolean;
  /** les sorties branchees (leurs noms) */
  outputs: readonly string[];
  /** la sortie choisie est branchee */
  live: boolean;
  /** les notes parties depuis l'ouverture de la page */
  sent: number;
}

interface Saved {
  device: string;
  ch: number;
  clock: boolean;
}

function readSaved(): Saved {
  const none: Saved = { device: '', ch: 1, clock: false };
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? 'null') as Partial<Saved> | null;
    if (!raw || typeof raw !== 'object') return none;
    const ch = Number(raw.ch);
    return {
      device: typeof raw.device === 'string' && raw.device.length < 120 ? raw.device : '',
      ch: Number.isInteger(ch) && ch >= 1 && ch <= 16 ? ch : 1,
      clock: raw.clock === true,
    };
  } catch {
    return none;
  }
}

const saved: Saved = typeof window === 'undefined' ? { device: '', ch: 1, clock: false } : readSaved();
let view: NoteOutView = { device: saved.device, ch: saved.ch, clock: saved.clock, outputs: [], live: false, sent: 0 };
const listeners = new Set<() => void>();

function set(next: Partial<NoteOutView>): void {
  view = { ...view, ...next };
  listeners.forEach((fn) => fn());
}

function save(): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ device: view.device, ch: view.ch, clock: view.clock } satisfies Saved));
  } catch {
    /* stockage plein ou refuse : le choix vaut pour la visite */
  }
}

/* ---------------- les sorties (midi/midi.ts donne l'acces Web MIDI) ---------------- */

let accessOf: () => MIDIAccess | null = () => null;

/** midi/midi.ts : l'acces Web MIDI, a lire au moment d'envoyer ; ses ports qui changent : noteOutPorts. */
export function noteOutAttach(get: () => MIDIAccess | null): void {
  accessOf = get;
  noteOutPorts();
}

function outputs(): MIDIOutput[] {
  const a = accessOf();
  const out: MIDIOutput[] = [];
  a?.outputs.forEach((o) => {
    if (o.name && o.state !== 'disconnected') out.push(o);
  });
  return out;
}

/** La sortie choisie, branchee (null : OFF, ou partie). */
function port(): MIDIOutput | null {
  if (!view.device) return null;
  return outputs().find((o) => o.name === view.device) ?? null;
}

/** Les ports ont change (un appareil branche, debranche, CONNECT, RESCAN) : la liste et l'etat. */
export function noteOutPorts(): void {
  const names = outputs().map((o) => o.name as string);
  const live = !!view.device && names.includes(view.device);
  // La sortie partie : ce qui y jouait est perdu pour elle ; la file se vide (rien ne doit partir ailleurs)
  if (view.live && !live) drop();
  // La sortie revenue (2026-10-22) : l'horloge repart de la position du pas suivant
  else if (!view.live && live) resetClock();
  set({ outputs: names, live });
}

/* ---------------- l'heure : celle du son a la sortie ---------------- */

/** L'ecart entre l'heure du contexte et celle de la page (ms) : ses mesures recentes, et l'ecart retenu, lisse. */
const offsets: number[] = [];
let offset = Number.NaN;
let offsetAt = -Infinity;
/**
 * Une mesure au plus toutes les OFFSET_MS ; l'ecart retenu suit la mediane d'au plus OFFSET_STEP ms par mesure, une
 * fois OFFSET_FAST mesures faites (avant : la mediane telle quelle, 2026-10-22) ; plus de mesure depuis OFFSET_STALE_MS
 * (l'arpege arrete) : elles repartent de zero.
 */
const OFFSET_MS = 50;
const OFFSET_KEEP = 31;
const OFFSET_STEP = 0.25;
const OFFSET_FAST = 8;
const OFFSET_STALE_MS = 2000;

/**
 * L'ecart du moment (ms) : quand l'echantillon de l'heure t du contexte sort des enceintes, en heure de la page
 * (getOutputTimestamp, comme les LEDs du Roto, midi/seqlink.ts seqPerfOf). Ici la mediane d'une trentaine de mesures,
 * puis un ecart retenu qui ne bouge que doucement (2026-10-22, mesure sur une machine chargee : la mesure brute saute de
 * dizaines de ms quand le fil audio peine, et deux messages partis l'un apres l'autre s'inversaient) ; un autre
 * contexte (plus d'une seconde d'ecart) repart a zero. Les OFFSET_FAST premieres mesures : la mediane telle quelle
 * (2026-10-22 : la premiere mesure apres un depart pouvait etre fausse de 10 a 30 ms).
 */
function offsetNow(): number {
  const c = context();
  // Un contexte arrete (pas encore lance, suspendu) : son heure ne bouge pas, rien a mesurer (2026-10-22)
  if (!c || c.state !== 'running') return Number.isFinite(offset) ? offset : 0;
  const now = performance.now();
  if (now - offsetAt > OFFSET_STALE_MS) {
    offsets.length = 0;
    offset = Number.NaN;
  }
  if (now - offsetAt >= OFFSET_MS || !Number.isFinite(offset)) {
    offsetAt = now;
    let off = Number.NaN;
    try {
      const ts = c.getOutputTimestamp?.();
      if (ts && typeof ts.performanceTime === 'number' && typeof ts.contextTime === 'number' && ts.performanceTime > 0 && ts.contextTime > 0) off = ts.performanceTime - ts.contextTime * 1000;
    } catch {
      /* le navigateur ne la dit pas */
    }
    if (!Number.isFinite(off)) off = now - c.currentTime * 1000 + ((c.outputLatency || 0) + (c.baseLatency || 0)) * 1000;
    if (offsets.length > 0 && Math.abs(off - offsets[offsets.length - 1]) > 1000) {
      offsets.length = 0;
      offset = Number.NaN;
    }
    offsets.push(off);
    if (offsets.length > OFFSET_KEEP) offsets.shift();
    const sorted = [...offsets].sort((a, b) => a - b);
    const med = sorted[sorted.length >> 1];
    offset = !Number.isFinite(offset) || offsets.length < OFFSET_FAST ? med : offset + Math.max(-OFFSET_STEP, Math.min(OFFSET_STEP, med - offset));
  }
  return offset;
}

/** L'heure (performance.now, ms) ou sort des enceintes l'echantillon de `when` (temps du contexte). */
export function perfOf(when: number): number {
  return when * 1000 + offsetNow();
}

/* ---------------- la file ---------------- */

type Kind = 'on' | 'off' | 'clock' | 'start' | 'spp' | 'continue';
interface Ev {
  /** l'heure (temps du contexte) */
  t: number;
  kind: Kind;
  note: number;
  vel: number;
  /** la note : son appui et son relachement partagent leur numero */
  id: number;
  /** SPP : la position en doubles croches */
  pos: number;
}

/** Ce qui attend, dans l'ordre des heures (a egalite : dans l'ordre d'arrivee). */
let queue: Ev[] = [];
/** Les notes dont l'appui est parti et pas encore le relachement : leur numero, leur hauteur, l'heure de leur appui (ms). */
const sounding = new Map<number, { note: number; onAt: number }>();
let nextId = 1;
let timer = 0;
/** l'horloge tourne (START parti, pas encore STOP) */
let clockOn = false;
/** la derniere heure (ms) d'un message de canal parti (notes, CC) : ALL NOTES OFF passe apres */
let lastAt = 0;
/** la derniere heure (ms) d'un message d'horloge parti (2026-10-22 : son propre fil, il part plus tot que les notes) */
let lastClockAt = 0;
/** l'heure (ms) du dernier START ou CONTINUE parti : STOP passe apres (jamais un STOP devant un START deja programme) */
let startAt = 0;
/** l'heure (temps du contexte) du dernier message parti de chaque sorte d'horloge : refait par l'arpege, il ne repart pas */
let clockSent: Partial<Record<Kind, number>> = {};

const isClock = (k: Kind): boolean => k === 'clock' || k === 'start' || k === 'spp' || k === 'continue';

/** Rien n'entre dans la file sans sortie branchee (2026-10-22 : sans acces ni port, elle grossissait toute la course). */
const enabled = (): boolean => view.device !== '' && midiLeader.leads() && port() !== null;

function insert(e: Ev): void {
  let i = queue.length;
  while (i > 0 && queue[i - 1].t > e.t) i -= 1;
  queue.splice(i, 0, e);
  if (!timer && typeof window !== 'undefined') timer = window.setInterval(flush, TICK_MS);
}

const status = (hi: number): number => hi | ((view.ch - 1) & 0x0f);

/** Un message vers la sortie a l'heure at (ms), tout de suite si elle est passee. */
function sendRaw(o: MIDIOutput, data: number[], at: number, now: number): void {
  try {
    if (at > now) o.send(data, at);
    else o.send(data);
  } catch {
    /* sortie partie entre-temps */
  }
}

/**
 * Un message vers la sortie a l'heure at (ms) ; jamais avant le precedent de son fil (l'ordre d'envoi est celui des
 * heures : un relachement ne passe jamais devant l'appui d'une note de la meme hauteur). Deux fils (2026-10-22) : les
 * messages de canal, et l'horloge, qui part plus tot (CLOCK_AHEAD_S) ; le navigateur les range a leur heure.
 */
function send(o: MIDIOutput, data: number[], at: number, clk = false): void {
  const now = performance.now();
  const t = Math.max(at, clk ? lastClockAt : lastAt);
  sendRaw(o, data, t, now);
  if (clk) lastClockAt = Math.max(t, now);
  else {
    lastAt = Math.max(t, now);
    keepEcho(data, Math.max(t, now));
  }
}

/* ---------------- l'echo du bus IAC ---------------- */

/**
 * L'echo (2026-10-22, la relecture) : le bus IAC de macOS (comme loopMIDI sous Windows) rend sur son entree tout ce qui
 * part sur sa sortie, et le site ecoute toutes les entrees (midi/midi.ts) : les notes de l'arpege revenaient comme si
 * un clavier les jouait. En MIDI LEARN, la note suivante de l'arpege (ou le ALL NOTES OFF d'un STOP) s'apprenait pour
 * le potard choisi a la place du geste de Mika, et la ligne du dernier message ne montrait plus que ces notes. Chaque
 * message de canal parti est garde ECHO_MS autour de son heure : le meme, sur l'entree du meme nom, a cette heure-la,
 * est son echo, ignore (une seule fois). Un autre message de cette entree (un CC d'Ableton) passe.
 */
const ECHO_MS = 1000;
const ECHO_KEEP = 512;
const echoes: { k: number; at: number }[] = [];
const echoKey = (d: ArrayLike<number>): number => ((d[0] & 0xff) << 16) | ((d[1] & 0x7f) << 8) | ((d.length > 2 ? d[2] : 0) & 0x7f);

function keepEcho(data: number[], at: number): void {
  // Les plus vieux s'en vont (au-dela de leur fenetre, ou de la place)
  const old = at - 2 * ECHO_MS;
  let n = 0;
  while (n < echoes.length && (echoes[n].at < old || echoes.length - n >= ECHO_KEEP)) n += 1;
  if (n > 0) echoes.splice(0, n);
  echoes.push({ k: echoKey(data), at });
}

/**
 * midi/midi.ts, a chaque message recu : celui-ci est-il l'echo d'un message parti vers cette sortie (le meme nom), a
 * ECHO_MS pres de son heure (at : son arrivee, l'heure de la page) ? S'il l'est, il est oublie ici et ignore la-bas.
 */
export function noteOutEcho(device: string, d: ArrayLike<number>, at: number): boolean {
  if (echoes.length === 0 || !device || device !== view.device || d.length < 2) return false;
  const hi = d[0] & 0xf0;
  if (hi !== 0x80 && hi !== 0x90 && hi !== 0xb0) return false;
  const k = echoKey(d);
  for (let i = 0; i < echoes.length; i += 1) {
    const e = echoes[i];
    if (e.k === k && Math.abs(e.at - at) <= ECHO_MS) {
      echoes.splice(i, 1);
      return true;
    }
  }
  return false;
}

/** STOP de l'horloge : tout de suite, ou juste apres un START (CONTINUE) deja programme ; les impulsions deja parties suivent, sans effet. */
function sendStop(o: MIDIOutput): void {
  const now = performance.now();
  const at = Math.max(now, startAt) + AFTER_MS;
  sendRaw(o, [0xfc], at, now);
  lastClockAt = Math.max(lastClockAt, at);
}

/**
 * Vide la file : les notes jusqu'a SEND_AHEAD_S devant, l'horloge jusqu'a CLOCK_AHEAD_S ; s'arrete quand il n'y a plus
 * rien a attendre. Un appui (ou une impulsion d'horloge) en retard de plus de DROP_AFTER_S (le fil principal bloque,
 * 2026-10-22) ne part plus, comme le pas que l'arpege saute : pas de rafale.
 */
function flush(): void {
  const c = context();
  const o = port();
  if (!c || !o || !enabled()) {
    if (queue.length === 0 || !o) stopTimer();
    return;
  }
  if (queue.length === 0) {
    stopTimer();
    return;
  }
  const ct = c.currentTime;
  const edge = ct + SEND_AHEAD_S;
  const edgeClock = ct + CLOCK_AHEAD_S;
  if (queue[0].t > edgeClock) return;
  const due: Ev[] = [];
  const keep: Ev[] = [];
  let i = 0;
  for (; i < queue.length && queue[i].t <= edgeClock; i += 1) {
    const e = queue[i];
    if (e.t <= edge || isClock(e.kind)) due.push(e);
    else keep.push(e);
  }
  if (due.length === 0) return;
  queue = i < queue.length ? keep.concat(queue.slice(i)) : keep;
  const off = offsetNow();
  const late = ct - DROP_AFTER_S;
  for (const e of due) {
    const at = e.t * 1000 + off;
    if (e.kind === 'on') {
      if (e.t < late) {
        // Trop tard : la note ne part pas, son relachement non plus
        queue = queue.filter((x) => !(x.kind === 'off' && x.id === e.id));
        continue;
      }
      // La meme hauteur encore tenue : relachee juste avant (son propre relachement, plus tard, ne part plus)
      for (const [id, s] of sounding) {
        if (s.note !== e.note) continue;
        send(o, [status(0x80), e.note, 0], Math.max(at, s.onAt + AFTER_MS));
        sounding.delete(id);
        queue = queue.filter((x) => !(x.kind === 'off' && x.id === id));
      }
      send(o, [status(0x90), e.note, e.vel], at);
      sounding.set(e.id, { note: e.note, onAt: at });
      set({ sent: view.sent + 1 });
    } else if (e.kind === 'off') {
      const s = sounding.get(e.id);
      if (!s) continue;
      send(o, [status(0x80), e.note, 0], Math.max(at, s.onAt + AFTER_MS));
      sounding.delete(e.id);
    } else {
      // L'horloge : deja partie a cette heure (l'arpege s'est re-programme), ou une impulsion trop en retard : sautee
      const last = clockSent[e.kind];
      if (last !== undefined && e.t <= last + 1e-6) continue;
      if (e.t < late) {
        // START, la position ou CONTINUE en retard (2026-10-22, le fil bloque) : perime, la position repart au pas suivant
        if (e.kind !== 'clock') clockOn = false;
        continue;
      }
      clockSent[e.kind] = e.t;
      const data = e.kind === 'clock' ? [0xf8] : e.kind === 'start' ? [0xfa] : e.kind === 'continue' ? [0xfb] : [0xf2, e.pos & 0x7f, (e.pos >> 7) & 0x7f];
      send(o, data, at, true);
      if (e.kind === 'start' || e.kind === 'continue') startAt = Math.max(startAt, at);
    }
  }
}

function stopTimer(): void {
  if (!timer) return;
  window.clearInterval(timer);
  timer = 0;
}

/**
 * Ce qui sonne s'arrete sur la sortie o : chaque note tenue relachee (apres son appui, s'il est encore a venir), ALL
 * NOTES OFF sur le canal, STOP si l'horloge tournait (stopClock). clear() d'abord, la ou le navigateur l'a (pas pour un
 * changement de canal : l'horloge deja partie reste). La file : tout s'oublie (STOP de l'arpege, page fermee, MIDI
 * OFF) ; keepNotes (2026-10-22, un changement de canal ou de sortie) : les notes a venir restent, elles partiront sur le
 * nouveau canal ou la nouvelle sortie ; l'horloge reste si elle ne s'arrete pas.
 */
function panic(o: MIDIOutput | null, stopClock: boolean, keepNotes = false): void {
  const wasClock = clockOn;
  queue = queue.filter((e) => {
    if (isClock(e.kind)) return !stopClock;
    if (!keepNotes) return false;
    return !(e.kind === 'off' && sounding.has(e.id));
  });
  if (o) {
    const cleared = stopClock && typeof (o as MIDIOutput & { clear?: () => void }).clear === 'function';
    if (cleared) {
      try {
        (o as MIDIOutput & { clear: () => void }).clear();
      } catch {
        /* rien a vider */
      }
    }
    const now = performance.now();
    let end = now;
    for (const s of sounding.values()) {
      const at = cleared ? now : Math.max(now, s.onAt + AFTER_MS);
      send(o, [status(0x80), s.note, 0], at);
      end = Math.max(end, at);
    }
    if (!cleared) end = Math.max(end, lastAt);
    send(o, [status(0xb0), 123, 0], end + AFTER_MS);
    if (stopClock && wasClock) sendStop(o);
  }
  sounding.clear();
  if (stopClock) {
    clockOn = false;
    clockSent = {};
  }
  if (queue.length === 0) stopTimer();
}

/**
 * La page qui se cache (2026-10-22) : son minuteur peut ralentir (Chrome, un onglet en arriere-plan) ; les notes tenues
 * se relachent tout de suite (apres leur appui), la suite de la file reste (l'arpege continue).
 */
function releaseSounding(o: MIDIOutput | null): void {
  if (!o || sounding.size === 0) return;
  const now = performance.now();
  for (const [id, s] of sounding) {
    send(o, [status(0x80), s.note, 0], Math.max(now, s.onAt + AFTER_MS));
    queue = queue.filter((x) => !(x.kind === 'off' && x.id === id));
  }
  sounding.clear();
}

/** La sortie partie : rien a lui envoyer, tout s'oublie. */
function drop(): void {
  queue = [];
  sounding.clear();
  clockOn = false;
  clockSent = {};
  stopTimer();
}

/**
 * La sortie revenue (2026-10-22) : l'horloge repart au pas suivant, de sa position (SPP, CONTINUE). Les notes restent
 * (une note partie entre l'arrivee du port et cet appel doit encore se relacher).
 */
function resetClock(): void {
  queue = queue.filter((e) => !isClock(e.kind));
  clockOn = false;
  clockSent = {};
}

/**
 * L'acces MIDI qui s'en va (MIDI OFF, 2026-10-22, midi/midi.ts dropAccess) : avant lui, tout se relache sur la sortie
 * (avant, la note en cours restait tenue dans Ableton), STOP de l'horloge.
 */
export function noteOutRelease(): void {
  panic(port(), true);
}

/* ---------------- ce que l'arpegiateur dit (voyager/arp.ts) ---------------- */

/** La velocite d'un accent (0.3 a 1.35 environ ; 1 : 100). */
export const velOf = (accent: number): number => Math.max(1, Math.min(127, Math.round(100 * accent)));

export const arpOut = {
  /** Une note a `when` (temps du contexte), tenue `gate` s, de force accent. */
  note(midi: number, when: number, gate: number, accent: number): void {
    if (!enabled() || !Number.isFinite(when) || !Number.isFinite(gate)) return;
    const note = Math.round(midi);
    if (note < 0 || note > 127) return;
    const id = nextId;
    nextId += 1;
    insert({ t: when, kind: 'on', note, vel: velOf(accent), id, pos: 0 });
    insert({ t: when + Math.max(0.001, gate), kind: 'off', note, vel: 0, id, pos: 0 });
  },
  /**
   * Un pas de l'arpege a `time`, de duree `dur` (s) ; pos16 : sa place en doubles croches depuis le debut de la
   * premiere mesure ; opening : le premier pas d'un RUN. L'horloge : six impulsions par pas ; au premier pas, START (ou
   * la position et CONTINUE en cours de mesure) ; l'horloge allumee pendant que l'arpege joue : la position et CONTINUE
   * au pas suivant.
   */
  step(time: number, dur: number, pos16: number, opening: boolean): void {
    if (!view.clock || !enabled() || !Number.isFinite(time) || !(dur > 0)) return;
    if (opening || !clockOn) {
      const pos = Math.max(0, Math.round(pos16)) % 16384;
      if (pos === 0) insert({ t: time, kind: 'start', note: 0, vel: 0, id: 0, pos: 0 });
      else {
        insert({ t: time, kind: 'spp', note: 0, vel: 0, id: 0, pos });
        insert({ t: time, kind: 'continue', note: 0, vel: 0, id: 0, pos: 0 });
      }
      clockOn = true;
    }
    for (let k = 0; k < 6; k += 1) insert({ t: time + (k * dur) / 6, kind: 'clock', note: 0, vel: 0, id: 0, pos: 0 });
  },
  /**
   * La re-programmation de l'arpege (synthCancel) : ce qui n'est pas encore parti a partir de `from` s'oublie (les
   * appuis, leurs relachements, l'horloge) ; le relachement d'une note deja partie reste.
   */
  cancel(from: number): void {
    if (queue.length === 0) return;
    const gone = new Set<number>();
    for (const e of queue) if (e.kind === 'on' && e.t >= from) gone.add(e.id);
    queue = queue.filter((e) => {
      if (e.kind === 'on' || e.kind === 'off') return !gone.has(e.id);
      // START ou la position d'un premier pas re-programme : il revient avec son pas
      if (e.t >= from && (e.kind === 'clock' || e.kind === 'start' || e.kind === 'spp' || e.kind === 'continue')) {
        if (e.kind !== 'clock') clockOn = false;
        return false;
      }
      return true;
    });
  },
  /** STOP de l'arpege : tout se relache, STOP de l'horloge. */
  stop(): void {
    if (!view.device) return;
    panic(port(), true);
  },
};

/* ---------------- le panneau MIDI (ui/MidiPanel.tsx) ---------------- */

/**
 * La sortie des notes : son nom, '' pour OFF. L'ancienne relache tout avant ; les notes deja programmees partent sur
 * la nouvelle (2026-10-22 : avant, 300 ms de notes perdues), son horloge reprend au pas suivant (la position, CONTINUE).
 */
export function noteOutSet(device: string): void {
  if (device === view.device) return;
  panic(port(), true, device !== '');
  set({ device, live: !!device && outputs().some((o) => o.name === device) });
  save();
}

/** Le canal (1 a 16) : les notes tenues sur l'ancien se relachent, les suivantes partent sur le nouveau, l'horloge continue. */
export function noteOutChannel(ch: number): void {
  if (!Number.isInteger(ch) || ch < 1 || ch > 16 || ch === view.ch) return;
  panic(port(), false, true);
  set({ ch });
  save();
}

/** L'horloge MIDI, START et STOP. */
export function noteOutClock(on: boolean): void {
  if (on === view.clock) return;
  const o = port();
  if (!on && clockOn && o) sendStop(o);
  if (!on) {
    clockOn = false;
    clockSent = {};
    queue = queue.filter((e) => !isClock(e.kind));
  }
  set({ clock: on });
  save();
}

export const noteOut = {
  get: (): NoteOutView => view,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/** Tests sans appareil (window.__v4.midiOut) : la file, les notes tenues. */
export const noteOutDebug = {
  get queued(): number {
    return queue.length;
  },
  get sounding(): number {
    return sounding.size;
  },
  get clockOn(): boolean {
    return clockOn;
  },
};

if (typeof window !== 'undefined') {
  // La page se cache ou se ferme : les notes en cours se relachent (un onglet cache peut voir son minuteur ralenti)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') releaseSounding(port());
  });
  window.addEventListener('pagehide', () => panic(port(), true));
  // Un autre onglet prend le MIDI : celui-ci relache tout et se tait
  midiLeader.subscribe(() => {
    if (!midiLeader.leads()) panic(port(), true);
  });
}
