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
 */

import { context } from '../audio/drums';
import { midiLeader } from './leader';

/** Un message part au plus SEND_AHEAD_S avant son heure (moins que GUARD_S, 30 ms : rien d'envoye n'est annule). */
export const SEND_AHEAD_S = 0.025;
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
  set({ outputs: names, live });
}

/* ---------------- l'heure : celle du son a la sortie ---------------- */

/** L'ecart entre l'heure du contexte et celle de la page (ms) : ses mesures recentes, et l'ecart retenu, lisse. */
const offsets: number[] = [];
let offset = Number.NaN;
let offsetAt = -Infinity;
/** Une mesure au plus toutes les OFFSET_MS ; l'ecart retenu suit la mediane d'au plus OFFSET_STEP ms par mesure. */
const OFFSET_MS = 50;
const OFFSET_KEEP = 31;
const OFFSET_STEP = 0.25;

/**
 * L'ecart du moment (ms) : quand l'echantillon de l'heure t du contexte sort des enceintes, en heure de la page
 * (getOutputTimestamp, comme les LEDs du Roto, midi/seqlink.ts seqPerfOf). Ici la mediane d'une trentaine de mesures,
 * puis un ecart retenu qui ne bouge que doucement (2026-10-22, mesure sur une machine chargee : la mesure brute saute de
 * dizaines de ms quand le fil audio peine, et deux messages partis l'un apres l'autre s'inversaient) ; un autre
 * contexte (plus d'une seconde d'ecart) repart a zero.
 */
function offsetNow(): number {
  const c = context();
  if (!c) return Number.isFinite(offset) ? offset : 0;
  const now = performance.now();
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
    offset = !Number.isFinite(offset) ? med : offset + Math.max(-OFFSET_STEP, Math.min(OFFSET_STEP, med - offset));
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
/** la derniere heure (ms) d'un message parti vers la sortie : STOP et ALL NOTES OFF passent apres */
let lastAt = 0;

const enabled = (): boolean => view.device !== '' && midiLeader.leads();

function insert(e: Ev): void {
  let i = queue.length;
  while (i > 0 && queue[i - 1].t > e.t) i -= 1;
  queue.splice(i, 0, e);
  if (!timer && typeof window !== 'undefined') timer = window.setInterval(flush, TICK_MS);
}

const status = (hi: number): number => hi | ((view.ch - 1) & 0x0f);

/**
 * Un message vers la sortie a l'heure at (ms) ; jamais avant le precedent (l'ordre d'envoi est celui des heures : un
 * relachement ne passe jamais devant l'appui d'une note de la meme hauteur).
 */
function send(o: MIDIOutput, data: number[], at: number): void {
  const now = performance.now();
  const t = Math.max(at, lastAt);
  try {
    if (t > now) o.send(data, t);
    else o.send(data);
  } catch {
    /* sortie partie entre-temps */
  }
  lastAt = Math.max(t, now);
}

/** Vide la file jusqu'a SEND_AHEAD_S devant ; s'arrete quand il n'y a plus rien a attendre. */
function flush(): void {
  const c = context();
  const o = port();
  if (!c || !o || !enabled()) {
    if (queue.length === 0 || !o) stopTimer();
    return;
  }
  const edge = c.currentTime + SEND_AHEAD_S;
  let k = 0;
  while (k < queue.length && queue[k].t <= edge) k += 1;
  if (k === 0) {
    if (queue.length === 0) stopTimer();
    return;
  }
  const due = queue.slice(0, k);
  queue = queue.slice(k);
  const off = offsetNow();
  for (const e of due) {
    const at = e.t * 1000 + off;
    if (e.kind === 'on') {
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
    } else if (e.kind === 'clock') send(o, [0xf8], at);
    else if (e.kind === 'start') send(o, [0xfa], at);
    else if (e.kind === 'continue') send(o, [0xfb], at);
    else if (e.kind === 'spp') send(o, [0xf2, e.pos & 0x7f, (e.pos >> 7) & 0x7f], at);
  }
}

function stopTimer(): void {
  if (!timer) return;
  window.clearInterval(timer);
  timer = 0;
}

/**
 * Tout s'arrete sur la sortie o : la file oubliee, chaque note tenue relachee (apres son appui, s'il est encore a
 * venir), ALL NOTES OFF sur le canal, STOP si l'horloge tournait. clear() d'abord, la ou le navigateur l'a.
 */
function panic(o: MIDIOutput | null, stopClock: boolean): void {
  queue = [];
  if (o) {
    const cleared = typeof (o as MIDIOutput & { clear?: () => void }).clear === 'function';
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
    if (stopClock && clockOn) send(o, [0xfc], end + AFTER_MS);
  }
  sounding.clear();
  if (stopClock) clockOn = false;
  stopTimer();
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
  stopTimer();
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

/** La sortie des notes : son nom, '' pour OFF. L'ancienne relache tout avant. */
export function noteOutSet(device: string): void {
  if (device === view.device) return;
  panic(port(), true);
  set({ device, live: !!device && outputs().some((o) => o.name === device) });
  save();
}

/** Le canal (1 a 16) : les notes tenues sur l'ancien se relachent. */
export function noteOutChannel(ch: number): void {
  if (!Number.isInteger(ch) || ch < 1 || ch > 16 || ch === view.ch) return;
  panic(port(), false);
  set({ ch });
  save();
}

/** L'horloge MIDI, START et STOP. */
export function noteOutClock(on: boolean): void {
  if (on === view.clock) return;
  const o = port();
  if (!on && clockOn && o) send(o, [0xfc], Math.max(performance.now(), lastAt) + AFTER_MS);
  if (!on) {
    clockOn = false;
    queue = queue.filter((e) => e.kind === 'on' || e.kind === 'off');
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
