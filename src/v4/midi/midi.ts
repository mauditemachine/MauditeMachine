/**
 * Le MIDI des machines (2026-10-05, Mika : "je voudrais que toutes les
 * actions, tous les parametres de toutes les machines puissent etre
 * assignes en MIDI ; j'ai un Roto-Control, je voudrais selectionner un
 * preset de mon Roto-Control, choisir la machine que je veux et avoir les
 * assignations"). Web MIDI (Chrome, Edge, Opera, Firefox ; pas Safari),
 * demande au premier CONNECT puis rallume aux visites suivantes.
 *
 * - MIDI LEARN : on touche une commande d'une machine (ou on la choisit
 *   dans la liste du panneau), puis on bouge un potard ou on appuie sur un
 *   bouton du controleur : le message (CC, note ou pitch bend, sur son
 *   canal) est assigne. Les assignations sont rangees par machine : le
 *   meme potard du controleur peut regler CUTOFF sur le MM-ARP et un EQ
 *   sur le MM-DECKS. Un message va d'abord a la machine qu'on regarde, puis
 *   aux assignations de partout (aller a une machine, PLAY/STOP), puis a la
 *   carte du Roto, puis a une autre machine qui l'a (un preset du
 *   Roto-Control par machine, a ses propres CC : pas besoin de changer de vue).
 * - Un parametre suit le potard (0 a 127 sur toute sa course, ses crans
 *   s'il en a) ; une note le fait basculer. Une action part a l'appui
 *   (note, ou CC qui passe au-dessus de 63) ; CUE et les pads des samplers
 *   tiennent jusqu'au relachement.
 * - Retour vers le controleur (les potards motorises du Roto-Control) :
 *   chaque parametre assigne renvoie sa valeur quand elle change (souris,
 *   preset, RANDOM...). Seulement vers les sorties des appareils qui ont
 *   servi a apprendre (jamais vers un synthe branche a cote), jamais
 *   pendant qu'on tourne le potard (300 ms).
 * Retenu dans le navigateur (mm.v4.midi.1) ; le panneau exporte et importe
 * les assignations en JSON.
 * - La carte du Roto-Control (2026-10-05, midi/roto.ts) : des setups tout
 *   faits (RYTM, ARP, BASS, DECK, MIXER, LIVE, chacun son canal) ; allumee, un
 *   message sans assignation apprise va a la cible de la carte, et les
 *   potards motorises de toute sortie dont le nom contient "roto" suivent.
 *
 * La fiabilite (2026-10-08, Mika : "Roto control : des fois ca fonctionne,
 * des fois ca ne fonctionne pas" ; 14 pannes reproduites avec un faux port
 * Web MIDI) :
 * - FOLLOW ne part qu'a l'appui ou quand un potard bouge, jamais au
 *   relachement ni pour la navigation : PREV/NEXT MACHINE et MM-STUDIO
 *   restaient sur la machine du setup (le relachement y ramenait) ;
 * - un bouton TOGGLE du Roto fait basculer sa cible a chaque message (le
 *   Roto envoie 127 puis 0 de lui-meme : apres un changement fait sur la
 *   page, son etat etait faux et le premier appui ne faisait rien) ;
 * - la carte du Roto ne repond qu'aux entrees dont le nom contient "roto",
 *   une assignation apprise qu'a l'appareil qui l'a apprise ; un meme
 *   message arrive d'une deuxieme entree en moins de 3 ms est ignore ; le
 *   retour de la carte part vers le Roto seulement, celui des assignations
 *   vers leur appareil seulement ;
 * - l'ordre : appris dans la machine regardee, appris partout, la carte du
 *   Roto, puis appris dans une autre machine (une vieille assignation d'une
 *   autre machine ne vole plus un controle du Roto) ;
 * - les messages vers une machine chargee a part (MM-DECKS, MM-BASS)
 *   attendent son code dans l'ordre (une file par machine ; d'un potard, on
 *   garde le dernier) ;
 * - pas de RUN muet : sans clic sur la page, le navigateur garde le son
 *   endormi ; l'ecran le dit (CLICK PAGE FOR SOUND) et l'horloge part quand
 *   le son tourne (audio/clock.ts) ;
 * - la connexion se voit et se reprend : l'autorisation du navigateur, 8 s
 *   sans reponse rendent CONNECT, RESCAN, les sorties du retour, un appareil
 *   debranche relache ses touches, l'onglet qui revient renvoie tout ;
 * - un seul onglet pilote (midi/leader.ts) ;
 * - un changement de setup sur le Roto (il ne le dit pas) : le premier
 *   geste d'un potard qui saute loin de la valeur du site ne compte pas, le
 *   moteur y retourne, et les potards et LEDs de ce setup sont renvoyes ;
 * - plus de rafale de 214 messages a chaque changement de machine : seules
 *   les cles qui dependent de la machine sont renvoyees, 48 messages au plus
 *   par tick ;
 * - le panneau dit ce que chaque message a fait (une fois par image).
 *
 * Le Roto en sequenceur (2026-10-09, les setups RSEQ et BSEQ, midi/seqlink.ts) :
 * les LEDs de ses pas partent de seqlink, a l'heure du pas (seqAttach : les
 * sorties Roto seulement) ; ses autres touches (une page, une voix, LOCK,
 * EDIT) ont une LED qui suit le site (seqLed, par le tick) ; un bouton de ces
 * setups qui parle voit sa LED renvoyee (un PUSH s'allume sous le doigt), son
 * echo n'est filtre que 3 ms (une tape sur la lumiere qui passe compte) ;
 * leurs potards attendent les moteurs 150 ms apres un LOCK.
 */

import { context } from '../audio/drums';
import { bassLoad } from '../state/bassload';
import { djLoad } from '../state/djload';
import { MACHINES, focus, type Focus, type MachineId } from '../state/focus';
import { lcdMessage } from '../state/lcdMessage';
import { midiLeader } from './leader';
import { isSeqSetup, rotoFeedbackKeys, rotoIsToggle, rotoKeyInfo, rotoKeysOfSetup, rotoTarget, type RotoKeyInfo, type RotoSetupName } from './roto';
import { seqAttach, seqCancelAll, seqInvalidate, seqKnobGuard, seqKnobTurn, seqLed, seqMsgAt, seqOwns, seqSeen } from './seqlink';
import { MACHINE_NAME, prefixOf, targetOf, type MidiTarget, type TargetScope } from './targets';

export type MidiKind = 'cc' | 'note' | 'pb';
export interface MidiMsg {
  kind: MidiKind;
  /** canal 1 a 16 */
  ch: number;
  /** CC ou note (0 a 127) ; 0 pour le pitch bend */
  num: number;
  /** 0 a 1 (CC /127, velocite, pitch bend /16383) */
  value: number;
  /** une note : enfoncee */
  on?: boolean;
  /** l'appareil d'ou il vient */
  device?: string;
  /** son heure d'arrivee (performance.now, MIDIMessageEvent.timeStamp) : une tape reste une tape quand le fil principal gele */
  at?: number;
}

export type MidiStatus = 'off' | 'asking' | 'on' | 'denied' | 'unsupported';
/** L'autorisation MIDI du navigateur (navigator.permissions) ; unknown : il ne la dit pas. */
export type MidiPermission = 'granted' | 'prompt' | 'denied' | 'unknown';

export type MidiMaps = Partial<Record<TargetScope, Record<string, string>>>;

export interface MidiView {
  status: MidiStatus;
  inputs: readonly string[];
  /** les appareils qui recoivent le retour des valeurs */
  devices: readonly string[];
  learn: boolean;
  /** la cible choisie en LEARN, en attente d'un message */
  pick: string | null;
  /** le dernier message recu et ce qu'il a fait (CC 17 CH 12 -> PLAY A (MM-DECKS, Roto map MIXER)) */
  last: string | null;
  maps: MidiMaps;
  /** l'appareil qui a appris chaque cle (2026-10-08 : elle ne repond qu'a lui) */
  from: Readonly<Record<string, string>>;
  /** renvoyer les valeurs vers le controleur */
  feedback: boolean;
  /** la carte du Roto-Control (midi/roto.ts) */
  roto: boolean;
  /** le site montre la machine du setup du Roto qu'on touche (pas LIVE) */
  follow: boolean;
  /** l'autorisation du navigateur */
  permission: MidiPermission;
  /** les sorties qui recoivent le retour (Roto-Control (Roto map)) */
  outputs: readonly string[];
  /** cet onglet pilote le MIDI (midi/leader.ts) */
  leader: boolean;
  /** un message passager (CLICK THE PAGE ONCE FOR SOUND) */
  hint: string | null;
  /** ce qui s'est passe a la connexion (pas de reponse du navigateur) */
  notice: string | null;
}

const STORE_KEY = 'mm.v4.midi.1';
const FEEDBACK_MS = 50;
const TOUCH_HOLD_MS = 300;
/** 2026-10-08 : au plus 48 messages par tick (le reste au suivant), plus de rafale de 214 CC */
const MAX_SENDS_PER_TICK = 48;
/** 2026-10-08 : sans reponse du navigateur apres 8 s, CONNECT revient */
const ASK_MS = 8000;
/** Le meme message d'une deuxieme entree (le Roto branche deux fois) */
const DUP_MS = 3;
/** Un potard du Roto qu'on n'a pas touche depuis 1 s et qui saute de plus de 12 : le setup a change */
const IDLE_MS = 1000;
const JUMP = 12;
const HINT_MS = 4000;
export const SOUND_HINT = 'CLICK THE PAGE ONCE FOR SOUND';
/** l'ecran du MM-RYTM a 20 colonnes */
const SOUND_HINT_LCD = 'CLICK PAGE FOR SOUND';

export const msgKey = (m: { kind: MidiKind; ch: number; num: number }): string => `${m.kind}:${m.ch}:${m.num}`;

/** Une cle lisible : CC 21 CH 1, NOTE 36 CH 10, PITCH CH 2. */
export function keyText(key: string): string {
  const [kind, ch, num] = key.split(':');
  if (kind === 'cc') return `CC ${num} CH ${ch}`;
  if (kind === 'note') return `NOTE ${num} CH ${ch}`;
  return `PITCH CH ${ch}`;
}

const normName = (n: string): string =>
  n
    .toLowerCase()
    .replace(/\b(in|out|input|output|port)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const ROTO_NAME = /roto/i;
/** Le meme appareil (son entree et sa sortie ; deux noms de Roto sont le meme Roto) */
const sameDevice = (a: string, b: string): boolean => normName(a) === normName(b) || (ROTO_NAME.test(a) && ROTO_NAME.test(b));
/** La destination du retour : 'roto' pour un Roto, sinon le nom de l'appareil ; un message sans appareil (un test) : le Roto */
const destOf = (device?: string): string => (device === undefined || ROTO_NAME.test(device) ? 'roto' : normName(device));
const skey = (dest: string, key: string): string => `${dest}|${key}`;

interface Saved {
  on: boolean;
  maps: MidiMaps;
  devices: string[];
  from: Record<string, string>;
  feedback: boolean;
  roto: boolean;
  follow: boolean;
}

const KEY_RE = /^(cc|note|pb):\d{1,2}:\d{1,3}$/;

function cleanFrom(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, d] of Object.entries(raw as Record<string, unknown>)) if (KEY_RE.test(k) && typeof d === 'string' && d.length < 80) out[k] = d;
  return out;
}

function readSaved(): Saved {
  const empty: Saved = { on: false, maps: {}, devices: [], from: {}, feedback: true, roto: true, follow: true };
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? 'null') as Partial<Saved> | null;
    if (!raw || typeof raw !== 'object') return empty;
    return {
      on: raw.on === true,
      maps: cleanMaps(raw.maps),
      devices: Array.isArray(raw.devices) ? raw.devices.filter((d): d is string => typeof d === 'string').slice(0, 16) : [],
      from: cleanFrom(raw.from),
      feedback: raw.feedback !== false,
      roto: raw.roto !== false,
      follow: raw.follow !== false,
    };
  } catch {
    return empty;
  }
}

/** Des assignations lues (stockage, fichier importe) : seulement des chaines bien formees. */
function cleanMaps(raw: unknown): MidiMaps {
  const out: MidiMaps = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [scope, m] of Object.entries(raw as Record<string, unknown>)) {
    if (!['mm808', 'voy', 'bass', 'dj', 'global'].includes(scope) || !m || typeof m !== 'object') continue;
    const clean: Record<string, string> = {};
    for (const [k, t] of Object.entries(m as Record<string, unknown>)) if (KEY_RE.test(k) && typeof t === 'string' && t.length < 80) clean[k] = t;
    out[scope as TargetScope] = clean;
  }
  return out;
}

const saved: Saved = typeof window === 'undefined' ? { on: false, maps: {}, devices: [], from: {}, feedback: true, roto: true, follow: true } : readSaved();
let view: MidiView = {
  status: 'off',
  inputs: [],
  devices: saved.devices,
  learn: false,
  pick: null,
  last: null,
  maps: saved.maps,
  from: saved.from,
  feedback: saved.feedback,
  roto: saved.roto,
  follow: saved.follow,
  permission: 'unknown',
  outputs: [],
  leader: midiLeader.leads(),
  hint: null,
  notice: null,
};
const listeners = new Set<() => void>();
let wantOn = saved.on;

function set(next: Partial<MidiView>): void {
  view = { ...view, ...next };
  listeners.forEach((fn) => fn());
}

function save(): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ on: wantOn, maps: view.maps, devices: [...view.devices], from: { ...view.from }, feedback: view.feedback, roto: view.roto, follow: view.follow } satisfies Saved));
  } catch {
    /* stockage plein ou refuse : les assignations valent pour la visite */
  }
}

/* ---------------- le dernier message, ce qu'il a fait ---------------- */

/*
 * 2026-10-08 : le panneau dit ce que chaque message a fait (CC 17 CH 12 ->
 * PLAY A (MM-DECKS, Roto map MIXER)), l'outil de Mika pour voir lui-meme un
 * setup du Roto trop vieux ou une assignation qui passe devant. Le store
 * n'est mis a jour qu'une fois par image (chaque CC refaisait tout le panneau).
 */
let lastText: string | null = null;
let lastQueued = false;

function note(text: string): void {
  lastText = text;
  if (lastQueued) return;
  lastQueued = true;
  const flush = (): void => {
    if (!lastQueued) return;
    lastQueued = false;
    if (view.last !== lastText) set({ last: lastText });
  };
  // L'image suivante ; un minuteur au cas ou les images s'arretent (fenetre cachee, machine chargee)
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush);
  window.setTimeout(flush, 50);
}

/* ---------------- Web MIDI ---------------- */

let access: MIDIAccess | null = null;
const supported = (): boolean => typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';

function onMessage(this: MIDIInput, e: MIDIMessageEvent): void {
  const d = e.data;
  if (!d || d.length < 2) return;
  const st = d[0] & 0xf0;
  const ch = (d[0] & 0x0f) + 1;
  const device = this.name ?? '';
  const at = Number.isFinite(e.timeStamp) && e.timeStamp > 0 ? e.timeStamp : undefined;
  if (st === 0xb0) handle({ kind: 'cc', ch, num: d[1], value: (d[2] ?? 0) / 127, device, at });
  else if (st === 0x90) handle({ kind: 'note', ch, num: d[1], value: (d[2] ?? 0) / 127, on: (d[2] ?? 0) > 0, device });
  else if (st === 0x80) handle({ kind: 'note', ch, num: d[1], value: 0, on: false, device });
  else if (st === 0xe0) handle({ kind: 'pb', ch, num: 0, value: (((d[2] ?? 0) << 7) | d[1]) / 16383, device });
}

/** Les sorties qui recoivent le retour, lisibles (le panneau). */
function outputNames(): string[] {
  if (!access) return [];
  const out: string[] = [];
  const learned = learnedDevices();
  access.outputs.forEach((o) => {
    if (!o.name || o.state === 'disconnected') return;
    const roto = ROTO_NAME.test(o.name);
    if (roto && view.roto) out.push(`${o.name} (Roto map)`);
    else if (learned.some((d) => sameDevice(d, o.name ?? ''))) out.push(`${o.name} (learned)`);
  });
  return out;
}

function wire(): void {
  if (!access) return;
  const names: string[] = [];
  access.inputs.forEach((input) => {
    input.onmidimessage = onMessage;
    if (input.name && input.state !== 'disconnected') names.push(input.name);
  });
  set({ inputs: names, outputs: outputNames() });
}

/**
 * Un port qui change (2026-10-08) : un appareil debranche relache ce qu'il
 * tenait (sinon son prochain appui etait perdu, la touche restait "enfoncee"),
 * une sortie qui arrive recoit tout ; le reste ne renvoie rien (une rafale
 * de 213 CC a chaque changement d'etat).
 */
function onState(e: MIDIConnectionEvent): void {
  wire();
  const port = e.port;
  if (!port) {
    resendAll();
    return;
  }
  if (port.type === 'input' && port.state === 'disconnected') releaseDevice(port.name ?? '');
  if (port.type === 'output' && port.state === 'connected') resendAll();
}

/** L'autorisation du navigateur (Chrome 124 : toute demande MIDI passe par une invite), suivie. */
function watchPermission(): void {
  try {
    const q = navigator.permissions?.query?.({ name: 'midi' as PermissionName });
    void q
      ?.then((st) => {
        const read = (): void => set({ permission: st.state === 'granted' || st.state === 'prompt' || st.state === 'denied' ? st.state : 'unknown' });
        read();
        st.onchange = read;
      })
      .catch(() => undefined);
  } catch {
    /* le navigateur ne dit pas l'autorisation */
  }
}

let askTimer = 0;
/** Une demande en cours devient caduque si on se deconnecte entre-temps. */
let offGen = 0;

/** CONNECT : demande l'acces (une fois), ecoute toutes les entrees. */
export async function midiEnable(): Promise<void> {
  if (!supported()) {
    set({ status: 'unsupported' });
    return;
  }
  if (access) {
    set({ status: 'on' });
    return;
  }
  const gen = offGen;
  set({ status: 'asking', notice: null });
  window.clearTimeout(askTimer);
  // Une invite ignoree laissait 'asking' pour toujours, CONNECT grise
  askTimer = window.setTimeout(() => {
    if (view.status === 'asking' && !access) set({ status: 'off', notice: 'No answer from the browser after 8 s. Look for the MIDI prompt next to the address bar, or press CONNECT again.' });
  }, ASK_MS);
  try {
    const a = await navigator.requestMIDIAccess({ sysex: false });
    window.clearTimeout(askTimer);
    if (gen !== offGen || access) return;
    access = a;
    a.onstatechange = onState;
    wantOn = true;
    save();
    set({ status: 'on', notice: null });
    wire();
    resendAll();
    startFeedback();
  } catch {
    window.clearTimeout(askTimer);
    if (gen === offGen && !access) set({ status: 'denied' });
  }
}

function dropAccess(): void {
  offGen += 1;
  window.clearTimeout(askTimer);
  if (access) {
    access.inputs.forEach((input) => {
      input.onmidimessage = null;
    });
    access.onstatechange = null;
  }
  access = null;
  releaseAll();
}

/** OFF : plus d'ecoute ; les assignations restent. */
export function midiDisable(): void {
  dropAccess();
  wantOn = false;
  save();
  stopFeedback();
  set({ status: supported() ? 'off' : 'unsupported', inputs: [], outputs: [], learn: false, pick: null, notice: null });
}

/**
 * RESCAN (2026-10-08) : une nouvelle demande au navigateur, les ports tels
 * qu'a l'instant (apres une mise en veille, un Roto rebranche ailleurs) ;
 * MIDI reste voulu.
 */
export function midiRescan(): void {
  dropAccess();
  set({ inputs: [], outputs: [] });
  void midiEnable();
}

/* ---------------- les assignations ---------------- */

const SCOPES: readonly TargetScope[] = ['mm808', 'voy', 'bass', 'dj', 'global'];

/** Une cle apprise repond-elle a cet appareil ? Celui qui l'a apprise ; une ancienne (sans appareil) : les appareils appris, ou tous s'il n'y en a pas. */
function learnedFrom(key: string, device?: string): boolean {
  if (device === undefined) return true;
  const want = view.from[key];
  if (want) return sameDevice(want, device);
  return view.devices.length === 0 || view.devices.some((d) => sameDevice(d, device));
}

/** Le retour d'une cle apprise vers un appareil : seulement celui qui l'a apprise (ou un appareil appris). */
function feedbackTo(key: string, device: string): boolean {
  const want = view.from[key];
  if (want) return sameDevice(want, device);
  return view.devices.some((d) => sameDevice(d, device));
}

/** Les appareils des assignations apprises. */
function learnedDevices(): string[] {
  return [...new Set([...view.devices, ...Object.values(view.from)])];
}

type Source = 'focus' | 'global' | 'roto' | 'other';
interface Route {
  id: string;
  src: Source;
  /** la machine de l'assignation apprise (null : la carte du Roto) */
  scope: TargetScope | null;
}

/**
 * La cible d'un message (2026-10-08) : ce qu'on a appris pour la machine
 * regardee, puis partout, puis la carte du Roto (un message du Roto), puis
 * ce qu'on a appris pour une autre machine. Une assignation apprise ne
 * repond qu'a son appareil, la carte qu'aux entrees "roto".
 */
function route(key: string, device?: string): Route | null {
  const f = focus.get();
  const maps = view.maps;
  const ok = learnedFrom(key, device);
  if (ok && f !== 'all') {
    const own = maps[f]?.[key];
    if (own) return { id: own, src: 'focus', scope: f };
  }
  if (ok) {
    const g = maps.global?.[key];
    if (g) return { id: g, src: 'global', scope: 'global' };
  }
  if (view.roto && (device === undefined || ROTO_NAME.test(device))) {
    const r = rotoTarget(key);
    if (r) return { id: r, src: 'roto', scope: null };
  }
  if (ok) {
    for (const s of SCOPES) {
      if (s === f || s === 'global') continue;
      const t = maps[s]?.[key];
      if (t) return { id: t, src: 'other', scope: s };
    }
  }
  return null;
}

/** La machine que montre un setup du Roto (LIVE les pilote toutes : aucune). */
const SETUP_MACHINE: Readonly<Record<RotoSetupName, MachineId | null>> = { RYTM: 'mm808', ARP: 'voy', BASS: 'bass', DECK: 'dj', MIXER: 'dj', LIVE: null, RSEQ: 'mm808', BSEQ: 'bass' };

/**
 * FOLLOW (2026-10-05) : un controle d'un setup du Roto (resolu par sa carte)
 * montre sa machine ; le Roto ne dit rien quand on change de setup, le
 * premier geste suffit. Depuis le 2026-10-08, handle() ne l'appelle qu'a un
 * appui ou un potard qui bouge, jamais au relachement ni pour nav:*.
 */
function follow(ri: RotoKeyInfo): void {
  if (!view.roto || !view.follow) return;
  const m = SETUP_MACHINE[ri.setup];
  if (!m || focus.get() === m || !MACHINES.includes(m)) return;
  targetOf(`nav:${m}`)?.down?.();
}

/*
 * Les machines chargees a part (2026-10-08) : tant que leur code n'est pas
 * la, ou que leur file n'est pas vide, un message attend dans la file de sa
 * machine, meme si sa cible est deja inscrite (dj/midi.ts s'inscrit avant la
 * fin du chargement : les messages recents passaient avant les anciens, le
 * fader finissait sur une valeur perimee). D'un potard du Roto, seul le
 * dernier message reste dans la file.
 */
interface Queued {
  id: string;
  key: string;
  coalesce: boolean;
  fn: (t: MidiTarget) => void;
}
const queues = new Map<string, Queued[]>();

const lazyOf = (p: string): typeof djLoad | typeof bassLoad | null => (p === 'dj' ? djLoad : p === 'bass' ? bassLoad : null);

function withTarget(id: string, key: string, coalesce: boolean, fn: (t: MidiTarget) => void): void {
  const p = prefixOf(id);
  const lz = lazyOf(p);
  if (!lz || (lz.get() && !queues.has(p))) {
    const t = targetOf(id);
    if (t) fn(t);
    return;
  }
  let q = queues.get(p);
  if (!q) {
    const load = lz.load();
    if (!load) return;
    q = [];
    queues.set(p, q);
    void load.then(
      () => flush(p),
      () => queues.delete(p)
    );
  }
  if (coalesce) {
    const i = q.findIndex((e) => e.coalesce && e.key === key);
    if (i >= 0) q.splice(i, 1);
  }
  q.push({ id, key, coalesce, fn });
}

function flush(p: string): void {
  const q = queues.get(p) ?? [];
  queues.delete(p);
  for (const e of q) {
    const t = targetOf(e.id);
    if (t) e.fn(t);
  }
}

/** L'etat appuye d'une cle (un CC au-dessus de 63, une note enfoncee) : une action part au front montant. */
const pressed = new Map<string, boolean>();
/** Qui tient une cle, et sa cible (un appareil debranche la relache). */
const pressedBy = new Map<string, { device: string; id: string }>();
/** Par destination et cle : le dernier geste (le retour attend que le potard se pose), la derniere valeur envoyee ou recue. */
const touchedAt = new Map<string, number>();
const sent = new Map<string, number>();
/** Quand une valeur est partie vers le controleur (un echo qui revient aussitot est ignore). */
const echoAt = new Map<string, number>();
const ECHO_MS = 250;
/**
 * Un bouton TOGGLE n'a pas le filtre d'echo (le Roto envoie 127 ou 0 : la
 * valeur qu'on vient de lui envoyer est un vrai appui) ; seul un retour en
 * moins de 15 ms est un echo (garde-fou si le Roto renvoyait ce qu'il recoit).
 */
const TOGGLE_ECHO_MS = 15;
/**
 * Un bouton d'un sequenceur (2026-10-09) : sa LED change a chaque pas (la tete
 * de lecture) ; on tape justement sur la lumiere qui passe. Seul un retour en
 * moins de 3 ms de l'heure du message est un echo (un vrai echo USB revient en
 * 1 a 2 ms) : une tape sur la lumiere compte.
 */
const SEQ_ECHO_MS = 3;
/** Le dernier message par cle (un meme message d'une deuxieme entree), et le dernier geste par cle (un potard au repos). */
const lastIn = new Map<string, { device: string; sig: string; t: number }>();
const lastAt = new Map<string, number>();
/** Le setup du Roto du dernier message de la carte (le Roto ne dit pas quand on en change). */
let lastSetup: RotoSetupName | null = null;

function apply(t: MidiTarget, m: MidiMsg, key: string, sk: string, toggle: boolean): void {
  const isOn = m.kind === 'note' ? m.on === true : m.value > 0.5;
  if (t.kind === 'value') {
    if (toggle) {
      // TOGGLE du Roto (2026-10-08) : chaque message bascule, le tick suivant renvoie le vrai etat a la LED
      t.set?.((t.get?.() ?? 0) >= 0.5 ? 0 : 1);
      sent.delete(sk);
      return;
    }
    // 64, le cran du milieu du Roto : le neutre exact (0 dB d'un EQ, un filtre ouvert)
    const val = m.kind === 'cc' && Math.round(m.value * 127) === 64 ? 0.5 : m.value;
    if (m.kind === 'note') {
      // Une note fait basculer un parametre (le bas ou le haut de sa course)
      if (!isOn) return;
      t.set?.((t.get?.() ?? 0) < 0.5 ? 1 : 0);
    } else t.set?.(val);
    touchedAt.set(sk, performance.now());
    sent.set(sk, Math.round(val * 127));
    return;
  }
  const was = pressed.get(key) === true;
  pressed.set(key, isOn);
  if (isOn) pressedBy.set(key, { device: m.device ?? '', id: t.id });
  else pressedBy.delete(key);
  if (isOn && !was) t.down?.();
  else if (!isOn && was && t.kind === 'hold') t.up?.();
}

/** Tout relacher (deconnexion, un autre onglet prend la main) : CUE et les pads tenus remontent. */
function releaseAll(): void {
  // Les pas tenus du Roto en sequenceur remontent sans jouer (ni tape, ni LOCK qui reste)
  seqCancelAll();
  for (const [key, p] of pressedBy) {
    if (pressed.get(key)) {
      const t = targetOf(p.id);
      if (t?.kind === 'hold') t.up?.();
    }
  }
  pressed.clear();
  pressedBy.clear();
  touchedAt.clear();
}

/** Un appareil debranche : ce qu'il tenait remonte, ses potards ne retiennent plus le retour. */
function releaseDevice(name: string): void {
  if ([...pressedBy.values()].some((p) => sameDevice(p.device, name))) seqCancelAll();
  for (const [key, p] of [...pressedBy]) {
    if (!sameDevice(p.device, name)) continue;
    if (pressed.get(key)) {
      const t = targetOf(p.id);
      if (t?.kind === 'hold') t.up?.();
    }
    pressed.delete(key);
    pressedBy.delete(key);
  }
  const d = `${destOf(name)}|`;
  for (const k of [...touchedAt.keys()]) if (k.startsWith(d)) touchedAt.delete(k);
}

/* ---------------- le son endormi ---------------- */

let hintAt = -Infinity;
let hintTimer = 0;

/**
 * Pas de RUN muet (2026-10-08) : un message MIDI n'est pas un geste pour le
 * navigateur ; sans clic sur la page, le son reste endormi (Chrome) et RUN
 * partait sans rien faire entendre. L'ecran du MM-RYTM et le bouton MIDI
 * le disent ; l'horloge, elle, attend que le son tourne (audio/clock.ts).
 */
function soundCheck(id: string): void {
  if (id.startsWith('nav:') && id !== 'nav:machines') return;
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  const c = context();
  const asleep = (ua ? !ua.hasBeenActive : false) || (!!c && c.state !== 'running');
  if (!asleep) return;
  const now = performance.now();
  if (now - hintAt < 2000) return;
  hintAt = now;
  // Apres l'action (elle ecrit souvent sa propre valeur a l'ecran)
  window.setTimeout(() => lcdMessage.show(SOUND_HINT_LCD, 2500), 0);
  set({ hint: SOUND_HINT });
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => set({ hint: null }), HINT_MS);
}

/* ---------------- un message ---------------- */

const SCOPE_OF_PREFIX: Readonly<Record<string, TargetScope>> = { rytm: 'mm808', voy: 'voy', bass: 'bass', dj: 'dj', nav: 'global' };
const scopeName = (s: TargetScope | undefined): string => (!s ? 'UNKNOWN' : s === 'global' ? 'EVERYWHERE' : MACHINE_NAME[s]);

/** Ce qu'a fait un message, pour le panneau. */
function describe(key: string, r: Route, ri: RotoKeyInfo | null): string {
  const t = targetOf(r.id);
  const where = scopeName(t?.scope ?? SCOPE_OF_PREFIX[prefixOf(r.id)]);
  if (r.src === 'roto') return `${keyText(key)} -> ${ri?.ctl?.n ?? t?.label ?? r.id} (${where}, Roto map ${ri?.setup ?? ''})`;
  const label = t?.label ?? r.id;
  if (rotoTarget(key) && view.roto) return `${keyText(key)} -> ${label} (learned, overrides the Roto map)`;
  return `${keyText(key)} -> ${label} (learned, ${where})`;
}

/** Pourquoi un message n'a rien fait. */
function nothing(key: string, device?: string): string {
  const ch = Number(key.split(':')[1]);
  let why = '';
  if (rotoTarget(key) && !view.roto) why = 'the ROTO-CONTROL map is off';
  else if (rotoTarget(key) && device !== undefined && !ROTO_NAME.test(device)) why = `not from a Roto input: ${device}`;
  else if (SCOPES.some((s) => view.maps[s]?.[key])) why = 'learned with another device';
  // 2026-10-09 : les huit setups prennent les seize canaux (RSEQ 7 et 15, BSEQ 8 et 16)
  else if (key.startsWith('cc:') && ch >= 1 && ch <= 16) why = 'not in the Roto setups of this version (setups 11 to 18): re-import them?';
  return `${keyText(key)} -> nothing${why ? ` (${why})` : ''}`;
}

/** Le potard du Roto saute-t-il loin de la valeur du site (setup change, moteur pas a sa place) ? */
function jumped(t: MidiTarget | undefined, ri: RotoKeyInfo, v7: number): number | null {
  if (!t || t.kind !== 'value' || !t.get) return null;
  const site = Math.max(0, Math.min(127, Math.round(t.get() * 127)));
  const n = ri.ctl?.steps?.length ?? 0;
  // Un potard a crans saute d'un cran a chaque geste : la limite est un cran et demi
  const limit = n >= 2 ? Math.max(JUMP, (1.5 * 127) / (n - 1)) : JUMP;
  return Math.abs(v7 - site) > limit ? site : null;
}

/** Une sortie Roto branchee (sans elle, son moteur ne peut pas revenir : on ne retient rien). */
function rotoOut(): boolean {
  let ok = false;
  access?.outputs.forEach((o) => {
    if (o.name && o.state !== 'disconnected' && ROTO_NAME.test(o.name)) ok = true;
  });
  return ok;
}

/** Les potards et LEDs d'un setup du Roto repartent au tick suivant (on vient d'y passer). */
function refreshSetup(name: RotoSetupName): void {
  for (const k of rotoKeysOfSetup(name)) sent.delete(skey('roto', k));
  // Les LEDs des pas d'un sequenceur (midi/seqlink.ts) aussi
  seqInvalidate(name);
}

/** Un message MIDI (Web MIDI, ou un test) : appris en LEARN, sinon joue. */
export function handle(m: MidiMsg): void {
  const key = msgKey(m);
  const now = performance.now();
  const dev = m.device;
  // Un seul onglet pilote (midi/leader.ts)
  if (!midiLeader.leads()) {
    note(`${keyText(key)} -> nothing (MIDI is used by another tab)`);
    return;
  }
  // Le meme message, d'une deuxieme entree, aussitot (le Roto en USB et par une interface) : une seule fois
  const sig = `${m.value}|${m.on === true ? 1 : 0}`;
  const prev = lastIn.get(key);
  lastIn.set(key, { device: dev ?? '', sig, t: now });
  if (prev && prev.device !== (dev ?? '') && prev.sig === sig && now - prev.t < DUP_MS) return;
  if (view.learn && view.pick) {
    // Un relachement de note ou un CC a 0 n'apprend rien : on attend un appui ou un potard qui bouge
    if (m.kind === 'note' && !m.on) return;
    const t = targetOf(view.pick);
    note(`${keyText(key)} -> learned for ${t?.label ?? view.pick}`);
    bind(view.pick, key, dev);
    return;
  }
  const r = route(key, dev);
  if (!r) {
    note(nothing(key, dev));
    return;
  }
  const ri = r.src === 'roto' ? rotoKeyInfo(key) : null;
  const toggle = r.src === 'roto' && rotoIsToggle(key);
  // Un bouton d'un sequenceur (2026-10-09) : sa LED change a chaque pas, le filtre d'echo le plus court (SEQ_ECHO_MS)
  const seqBtn = !!ri && ri.button && isSeqSetup(ri.setup);
  const sk = skey(destOf(dev), key);
  const v7 = Math.round(m.value * 127);
  // Un echo de ce qu'on vient d'envoyer aux potards motorises : ni joue, ni suivi (une LED envoyee d'avance ne compte qu'a son heure)
  const ea = echoAt.get(sk) ?? -Infinity;
  if (m.kind === 'cc' && sent.get(sk) === v7 && now >= ea - 1 && now - ea < (toggle ? TOGGLE_ECHO_MS : seqBtn ? SEQ_ECHO_MS : ECHO_MS)) return;
  // Un potard d'un sequenceur juste apres un LOCK (2026-10-09) : les moteurs vont aux valeurs du pas, on attend
  if (ri && !ri.button && m.kind === 'cc' && !seqKnobGuard(ri.setup, key)) {
    note(`${keyText(key)} -> ${ri.ctl?.n ?? r.id}: ignored for 150 ms, the motors go to the LOCK values`);
    return;
  }
  const idle = now - (lastAt.get(key) ?? -Infinity) > IDLE_MS;
  lastAt.set(key, now);
  let jump: number | null = null;
  if (ri) {
    // Un autre setup du Roto (il ne dit rien quand on en change) : ses potards et LEDs repartent
    const switched = lastSetup !== null && lastSetup !== ri.setup;
    lastSetup = ri.setup;
    if (switched) refreshSetup(ri.setup);
    // FOLLOW : a l'appui ou quand un potard bouge, jamais au relachement ni pour la navigation
    const release = m.kind === 'note' ? !m.on : ri.button && !toggle && m.value <= 0.5;
    if (!release && !r.id.startsWith('nav:')) follow(ri);
    if (!ri.button && m.kind === 'cc' && view.feedback && (switched || idle) && rotoOut()) jump = jumped(targetOf(r.id), ri, v7);
  }
  if (jump !== null) {
    // Le premier geste d'un potard qui saute ne compte pas : le moteur retourne a la valeur du site
    sendNow(sk, key, jump);
    note(`${keyText(key)} -> ${ri?.ctl?.n ?? r.id}: the knob jumped (${v7}, the site is at ${jump}), its motor goes back. Turn it again.`);
    return;
  }
  // Un potard d'un sequenceur qui tourne : un pas tenu le prend (le MM-BASS passe en LOCK avant, midi/seqlink.ts)
  if (ri && !ri.button && m.kind === 'cc') seqKnobTurn(ri.setup, key, r.id);
  // L'heure d'arrivee du message : un pas du sequenceur mesure sa tenue d'un message a l'autre
  if (seqBtn) seqMsgAt(m.at);
  withTarget(r.id, key, !!ri && !ri.button && m.kind === 'cc', (t) => apply(t, m, key, sk, toggle));
  if (seqBtn) seqMsgAt(undefined);
  // Un bouton d'un sequenceur a parle : le Roto a peut-etre change sa LED tout seul (un PUSH sous le doigt), elle repart
  if (seqBtn && !seqSeen(key)) sent.delete(sk);
  soundCheck(r.id);
  note(describe(key, r, ri));
}

/** Assigne une cle a une cible (dans la machine de la cible) ; une cle n'y vise qu'une cible, une cible n'a qu'une cle. */
export function bind(targetId: string, key: string, device?: string): void {
  const t = targetOf(targetId);
  const scope: TargetScope = t?.scope ?? (prefixOf(targetId) === 'dj' ? 'dj' : prefixOf(targetId) === 'bass' ? 'bass' : 'global');
  const maps: MidiMaps = { ...view.maps };
  const m = { ...(maps[scope] ?? {}) };
  for (const [k, v] of Object.entries(m)) if (v === targetId) delete m[k];
  m[key] = targetId;
  maps[scope] = m;
  const devices = device && !view.devices.includes(device) ? [...view.devices, device].slice(-8) : view.devices;
  const from = { ...view.from };
  if (device) from[key] = device;
  set({ maps, devices, from: pruneFrom(maps, from), pick: null });
  set({ outputs: outputNames() });
  save();
  for (const k of [...sent.keys()]) if (k.endsWith(`|${key}`)) sent.delete(k);
}

/** L'appareil des cles qui ne sont plus apprises nulle part s'oublie. */
function pruneFrom(maps: MidiMaps, from: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, d] of Object.entries(from)) if (SCOPES.some((s) => maps[s]?.[k])) out[k] = d;
  return out;
}

export function unbind(scope: TargetScope, key: string): void {
  const m = { ...(view.maps[scope] ?? {}) };
  delete m[key];
  const maps = { ...view.maps, [scope]: m };
  set({ maps, from: pruneFrom(maps, { ...view.from }) });
  set({ outputs: outputNames() });
  save();
  // La carte du Roto reprend peut-etre cette cle : sa valeur repart
  for (const k of [...sent.keys()]) if (k.endsWith(`|${key}`)) sent.delete(k);
}

export function clearScope(scope: TargetScope): void {
  const maps = { ...view.maps };
  delete maps[scope];
  set({ maps, from: pruneFrom(maps, { ...view.from }) });
  set({ outputs: outputNames() });
  save();
  resendAll();
}

/** Une cle apprise qui est aussi une cle de la carte du Roto (elle passe devant, ou derriere si elle est d'une autre machine). */
export interface RotoConflict {
  scope: TargetScope;
  key: string;
  /** la cible apprise */
  id: string;
  /** la cible de la carte */
  roto: string;
}

/** Les assignations apprises sur une cle de la carte du Roto (2026-10-08 : souvent d'un MIDI LEARN fait avant la carte). */
export function rotoConflicts(maps: MidiMaps = view.maps): RotoConflict[] {
  const out: RotoConflict[] = [];
  for (const s of SCOPES) {
    for (const [key, id] of Object.entries(maps[s] ?? {})) {
      const roto = rotoTarget(key);
      if (roto) out.push({ scope: s, key, id, roto });
    }
  }
  return out;
}

/** REMOVE CONFLICTS WITH THE ROTO MAP : ces assignations partent, la carte reprend ses cles ; renvoie leur nombre. */
export function removeRotoConflicts(): number {
  const c = rotoConflicts();
  if (c.length === 0) return 0;
  const maps: MidiMaps = { ...view.maps };
  for (const { scope, key } of c) {
    const m = { ...(maps[scope] ?? {}) };
    delete m[key];
    maps[scope] = m;
  }
  set({ maps, from: pruneFrom(maps, { ...view.from }) });
  set({ outputs: outputNames() });
  save();
  resendAll();
  return c.length;
}

/** La cle d'une cible (pour l'afficher), ou null. */
export function keyOfTarget(targetId: string): string | null {
  for (const s of SCOPES) {
    const m = view.maps[s];
    if (!m) continue;
    for (const [k, v] of Object.entries(m)) if (v === targetId) return k;
  }
  return null;
}

/* ---------------- LEARN ---------------- */

export function learnToggle(on = !view.learn): void {
  set({ learn: on, pick: on ? view.pick : null });
}

/** La cible du prochain message (une commande touchee sur la machine, ou choisie dans la liste). */
export function learnPick(targetId: string | null): void {
  set({ pick: targetId });
}

/* ---------------- retour vers le controleur ---------------- */

let timer = 0;

/** Une destination du retour : le Roto (sa carte, ce qu'on a appris avec lui), ou un autre appareil appris. */
interface Dest {
  id: string;
  device: string;
  outs: MIDIOutput[];
  keys: string[];
}

function dests(): Dest[] {
  if (!access || !view.feedback) return [];
  const by = new Map<string, Dest>();
  access.outputs.forEach((o) => {
    if (!o.name || o.state === 'disconnected') return;
    const id = destOf(o.name);
    let d = by.get(id);
    if (!d) {
      d = { id, device: o.name, outs: [], keys: [] };
      by.set(id, d);
    }
    d.outs.push(o);
  });
  const learned = new Set<string>();
  for (const s of SCOPES) for (const k of Object.keys(view.maps[s] ?? {})) learned.add(k);
  const out: Dest[] = [];
  for (const d of by.values()) {
    const keys = new Set<string>();
    if (d.id === 'roto' && view.roto) for (const k of rotoFeedbackKeys()) keys.add(k);
    for (const k of learned) if (feedbackTo(k, d.device)) keys.add(k);
    d.keys = [...keys];
    if (d.keys.length > 0) out.push(d);
  }
  return out;
}

function sendValue(outs: readonly MIDIOutput[], key: string, v7: number): void {
  const [kind, chS, numS] = key.split(':');
  const ch = Math.max(0, Math.min(15, Number(chS) - 1));
  const num = Number(numS) & 0x7f;
  const data = kind === 'cc' ? [0xb0 | ch, num, v7] : kind === 'pb' ? [0xe0 | ch, (v7 << 7) & 0x7f, v7] : null;
  if (!data) return;
  for (const o of outs) {
    try {
      o.send(data);
    } catch {
      /* sortie partie entre-temps */
    }
  }
}

/** Tout de suite vers une destination (le moteur d'un potard qui a saute). */
function sendNow(sk: string, key: string, v7: number): void {
  const dest = sk.slice(0, sk.indexOf('|'));
  const d = dests().find((x) => x.id === dest);
  if (!d) return;
  sent.set(sk, v7);
  echoAt.set(sk, performance.now());
  sendValue(d.outs, key, v7);
}

/**
 * Le Roto en sequenceur (2026-10-09, midi/seqlink.ts) : un CC vers les sorties
 * Roto seulement (jamais un autre appareil), de l'onglet qui pilote, la carte
 * et le retour allumes ; at : l'heure ou il doit partir (performance.now, le
 * pas de la tete de lecture), la file MIDI du navigateur l'y joue. false :
 * rien n'est parti (pas de Roto).
 */
function rotoSendAt(key: string, v7: number, at?: number): boolean {
  if (!access || !view.feedback || !view.roto || !midiLeader.leads()) return false;
  const outs: MIDIOutput[] = [];
  access.outputs.forEach((o) => {
    if (o.name && o.state !== 'disconnected' && ROTO_NAME.test(o.name)) outs.push(o);
  });
  if (outs.length === 0) return false;
  const [kind, chS, numS] = key.split(':');
  if (kind !== 'cc') return false;
  const data = [0xb0 | Math.max(0, Math.min(15, Number(chS) - 1)), Number(numS) & 0x7f, v7 & 0x7f];
  const now = performance.now();
  const later = at !== undefined && at > now;
  const sk = skey('roto', key);
  sent.set(sk, v7);
  echoAt.set(sk, later ? (at as number) : now);
  for (const o of outs) {
    try {
      if (later) o.send(data, at);
      else o.send(data);
    } catch {
      /* sortie partie entre-temps */
    }
  }
  return true;
}

/** Les potards d'un setup repartent vers les moteurs au tick suivant (apres un LOCK, midi/seqlink.ts). */
function refreshKnobs(name: RotoSetupName): void {
  for (const k of rotoKeysOfSetup(name)) if (!rotoKeyInfo(k)?.button) sent.delete(skey('roto', k));
}

/** Les valeurs des parametres assignes qui ont change (vers les potards motorises), 48 messages au plus. */
function feedbackTick(): void {
  if (!midiLeader.leads()) return;
  const ds = dests();
  if (ds.length === 0) return;
  const now = performance.now();
  let budget = MAX_SENDS_PER_TICK;
  for (const d of ds) {
    for (const key of d.keys) {
      if (key.startsWith('note:')) continue;
      const sk = skey(d.id, key);
      if (now - (touchedAt.get(sk) ?? -Infinity) < TOUCH_HOLD_MS) continue;
      // Les pas d'un sequenceur du Roto : leurs LEDs partent de midi/seqlink.ts, a l'heure du pas
      if (d.id === 'roto' && seqOwns(key)) continue;
      const r = route(key, d.device);
      const t = r ? targetOf(r.id) : undefined;
      if (!t || !r) continue;
      let v7: number;
      if (t.kind === 'value' && t.get) v7 = Math.max(0, Math.min(127, Math.round(t.get() * 127)));
      else {
        // Une touche d'un sequenceur (2026-10-09) : sa LED dit l'etat du site (la page, la voix, LOCK, EDIT)
        const led = d.id === 'roto' && r.src === 'roto' ? seqLed(key, r.id) : null;
        if (led === null) continue;
        v7 = led ? 127 : 0;
      }
      if (sent.get(sk) === v7) continue;
      if (budget <= 0) return;
      budget -= 1;
      sent.set(sk, v7);
      echoAt.set(sk, now);
      sendValue(d.outs, key, v7);
    }
  }
}

/** Tout renvoyer (un controleur rebranche, l'onglet qui revient) : les potards prennent les valeurs du site. */
function resendAll(): void {
  sent.clear();
  seqInvalidate(null);
}

/**
 * Une autre machine (2026-10-08) : seules les cles apprises dans une machine
 * changent de cible ; la carte du Roto ne depend pas de la machine regardee.
 */
function resendFocusKeys(): void {
  const dep = new Set<string>();
  for (const s of SCOPES) if (s !== 'global') for (const k of Object.keys(view.maps[s] ?? {})) dep.add(k);
  if (dep.size === 0) return;
  for (const sk of [...sent.keys()]) if (dep.has(sk.slice(sk.indexOf('|') + 1))) sent.delete(sk);
}

function startFeedback(): void {
  if (timer || typeof window === 'undefined') return;
  timer = window.setInterval(feedbackTick, FEEDBACK_MS);
}

function stopFeedback(): void {
  window.clearInterval(timer);
  timer = 0;
}

/** FOLLOW : le site montre la machine du setup du Roto qu'on touche. */
export function followToggle(on = !view.follow): void {
  set({ follow: on });
  save();
}

/** La carte du Roto-Control, allumee ou eteinte. */
export function rotoToggle(on = !view.roto): void {
  set({ roto: on });
  set({ outputs: outputNames() });
  save();
  resendAll();
}

export function feedbackToggle(on = !view.feedback): void {
  set({ feedback: on });
  save();
  resendAll();
}

/** USE MIDI HERE : cet onglet prend le MIDI (un autre l'avait). */
export function midiClaim(): void {
  midiLeader.claim();
}

/* ---------------- export, import ---------------- */

export function exportMaps(): string {
  return JSON.stringify({ v: 1, maps: view.maps, devices: view.devices, from: view.from }, null, 2);
}

/** Des assignations d'un fichier : elles remplacent celles du navigateur ; false si le fichier ne se lit pas. */
export function importMaps(text: string): boolean {
  try {
    const raw = JSON.parse(text) as { maps?: unknown; devices?: unknown; from?: unknown };
    const maps = cleanMaps(raw.maps);
    const devices = Array.isArray(raw.devices) ? raw.devices.filter((d): d is string => typeof d === 'string').slice(0, 16) : view.devices;
    set({ maps, devices, from: pruneFrom(maps, cleanFrom(raw.from)) });
    set({ outputs: outputNames() });
    save();
    resendAll();
    return true;
  } catch {
    return false;
  }
}

/* ---------------- le store ---------------- */

export const midi = {
  get: (): MidiView => view,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  supported,
};

// Une autre machine : ses cles apprises repartent vers le controleur ; MIDI deja accepte : il se rallume
if (typeof window !== 'undefined') {
  let shown: Focus = focus.get();
  focus.subscribe(() => {
    // focus previent aussi quand le cadrage arrive : seulement un vrai changement de machine
    if (focus.get() === shown) return;
    shown = focus.get();
    resendFocusKeys();
  });
  // L'onglet qui revient : les potards reprennent les valeurs du site (elles ont pu changer ailleurs)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resendAll();
  });
  // Un autre onglet prend la main : on relache tout ; on la reprend : tout repart vers le Roto
  midiLeader.subscribe(() => {
    const lead = midiLeader.leads();
    set({ leader: lead });
    if (lead) resendAll();
    else releaseAll();
  });
  // Le Roto en sequenceur (2026-10-09) : ses LEDs passent par ici, vers les sorties Roto seulement
  seqAttach({ send: rotoSendAt, ready: () => !!access && view.feedback && view.roto && midiLeader.leads() && rotoOut(), refresh: refreshKnobs });
  if (!supported()) view = { ...view, status: 'unsupported' };
  else {
    watchPermission();
    if (wantOn) void midiEnable();
  }
}
