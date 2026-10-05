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
 *   aux assignations de partout (aller a une machine, PLAY/STOP), puis a
 *   une autre machine qui l'a (un preset du Roto-Control par machine, a ses
 *   propres CC : pas besoin de changer de vue).
 * - Un parametre suit le potard (0 a 127 sur toute sa course, ses crans
 *   s'il en a) ; une note le fait basculer. Une action part a l'appui
 *   (note, ou CC qui passe au-dessus de 63) ; CUE et les pads du MM-SMPL
 *   tiennent jusqu'au relachement.
 * - Retour vers le controleur (les potards motorises du Roto-Control) :
 *   chaque parametre assigne renvoie sa valeur quand elle change (souris,
 *   preset, RANDOM...) et quand on change de machine, les potards prennent
 *   les valeurs de la nouvelle. Seulement vers les sorties des appareils qui
 *   ont servi a apprendre (jamais vers un synthe branche a cote), jamais
 *   pendant qu'on tourne le potard (300 ms).
 * Retenu dans le navigateur (mm.v4.midi.1) ; le panneau exporte et importe
 * les assignations en JSON.
 * - La carte du Roto-Control (2026-10-05, midi/roto.ts) : cinq setups tout
 *   faits (RYTM, ARP, DECK, MIXER, SMPL, chacun son canal) ; allumee, un
 *   message sans assignation apprise va a la cible de la carte, et les
 *   potards motorises de toute sortie dont le nom contient "roto" suivent.
 */

import { djLoad } from '../state/djload';
import { MACHINES, focus, type MachineId } from '../state/focus';
import { smplLoad } from '../state/smplload';
import { rotoFeedbackKeys, rotoSetupOfChannel, rotoTarget, type RotoSetupName } from './roto';
import { prefixOf, targetOf, type MidiTarget, type TargetScope } from './targets';

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
}

export type MidiStatus = 'off' | 'asking' | 'on' | 'denied' | 'unsupported';

export type MidiMaps = Partial<Record<TargetScope, Record<string, string>>>;

export interface MidiView {
  status: MidiStatus;
  inputs: readonly string[];
  /** les appareils qui recoivent le retour des valeurs */
  devices: readonly string[];
  learn: boolean;
  /** la cible choisie en LEARN, en attente d'un message */
  pick: string | null;
  /** le dernier message recu, lisible (CC 21 CH 1) */
  last: string | null;
  maps: MidiMaps;
  /** renvoyer les valeurs vers le controleur */
  feedback: boolean;
  /** la carte du Roto-Control (midi/roto.ts) */
  roto: boolean;
  /** le site montre la machine du setup du Roto qu'on touche (pas LIVE) */
  follow: boolean;
}

const STORE_KEY = 'mm.v4.midi.1';
const FEEDBACK_MS = 50;
const TOUCH_HOLD_MS = 300;

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

interface Saved {
  on: boolean;
  maps: MidiMaps;
  devices: string[];
  feedback: boolean;
  roto: boolean;
  follow: boolean;
}

function readSaved(): Saved {
  const empty: Saved = { on: false, maps: {}, devices: [], feedback: true, roto: true, follow: true };
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? 'null') as Partial<Saved> | null;
    if (!raw || typeof raw !== 'object') return empty;
    return {
      on: raw.on === true,
      maps: cleanMaps(raw.maps),
      devices: Array.isArray(raw.devices) ? raw.devices.filter((d): d is string => typeof d === 'string').slice(0, 16) : [],
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
    if (!['mm808', 'voy', 'smpl', 'dj', 'global'].includes(scope) || !m || typeof m !== 'object') continue;
    const clean: Record<string, string> = {};
    for (const [k, t] of Object.entries(m as Record<string, unknown>)) if (/^(cc|note|pb):\d{1,2}:\d{1,3}$/.test(k) && typeof t === 'string' && t.length < 80) clean[k] = t;
    out[scope as TargetScope] = clean;
  }
  return out;
}

const saved: Saved = typeof window === 'undefined' ? { on: false, maps: {}, devices: [], feedback: true, roto: true, follow: true } : readSaved();
let view: MidiView = { status: 'off', inputs: [], devices: saved.devices, learn: false, pick: null, last: null, maps: saved.maps, feedback: saved.feedback, roto: saved.roto, follow: saved.follow };
const listeners = new Set<() => void>();
let wantOn = saved.on;

function set(next: Partial<MidiView>): void {
  view = { ...view, ...next };
  listeners.forEach((fn) => fn());
}

function save(): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ on: wantOn, maps: view.maps, devices: [...view.devices], feedback: view.feedback, roto: view.roto, follow: view.follow } satisfies Saved));
  } catch {
    /* stockage plein ou refuse : les assignations valent pour la visite */
  }
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
  if (st === 0xb0) handle({ kind: 'cc', ch, num: d[1], value: (d[2] ?? 0) / 127, device });
  else if (st === 0x90) handle({ kind: 'note', ch, num: d[1], value: (d[2] ?? 0) / 127, on: (d[2] ?? 0) > 0, device });
  else if (st === 0x80) handle({ kind: 'note', ch, num: d[1], value: 0, on: false, device });
  else if (st === 0xe0) handle({ kind: 'pb', ch, num: 0, value: (((d[2] ?? 0) << 7) | d[1]) / 16383, device });
}

function wire(): void {
  if (!access) return;
  const names: string[] = [];
  access.inputs.forEach((input) => {
    input.onmidimessage = onMessage;
    if (input.name) names.push(input.name);
  });
  set({ inputs: names });
  resendAll();
}

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
  set({ status: 'asking' });
  try {
    access = await navigator.requestMIDIAccess({ sysex: false });
    access.onstatechange = () => wire();
    wantOn = true;
    save();
    set({ status: 'on' });
    wire();
    startFeedback();
  } catch {
    set({ status: 'denied' });
  }
}

/** OFF : plus d'ecoute ; les assignations restent. */
export function midiDisable(): void {
  if (access) {
    access.inputs.forEach((input) => {
      input.onmidimessage = null;
    });
    access.onstatechange = null;
  }
  access = null;
  wantOn = false;
  save();
  stopFeedback();
  set({ status: supported() ? 'off' : 'unsupported', inputs: [], learn: false, pick: null });
}

/* ---------------- les assignations ---------------- */

const SCOPES: readonly TargetScope[] = ['mm808', 'voy', 'smpl', 'dj', 'global'];

/** Ce qu'on a appris pour un message, pour la vue du moment : la machine regardee, partout, puis une autre machine. */
function resolveLearned(key: string): string | null {
  const f = focus.get();
  const maps = view.maps;
  if (f !== 'all') {
    const own = maps[f]?.[key];
    if (own) return own;
  }
  const g = maps.global?.[key];
  if (g) return g;
  for (const s of SCOPES) {
    if (s === f || s === 'global') continue;
    const t = maps[s]?.[key];
    if (t) return t;
  }
  return null;
}

/** La cible d'un message : ce qu'on a appris, puis la carte du Roto-Control. */
function resolve(key: string): string | null {
  return resolveLearned(key) ?? (view.roto ? rotoTarget(key) : null);
}

/** La machine que montre un setup du Roto (LIVE les pilote toutes : aucune). */
const SETUP_MACHINE: Readonly<Record<RotoSetupName, MachineId | null>> = { RYTM: 'mm808', ARP: 'voy', DECK: 'dj', MIXER: 'dj', SMPL: 'smpl', LIVE: null };

/**
 * FOLLOW (2026-10-05) : un controle d'un setup du Roto (sa carte, rien
 * d'appris) montre sa machine ; le Roto ne dit rien quand on change de
 * setup, le premier geste suffit.
 */
function follow(key: string): void {
  if (!view.roto || !view.follow || resolveLearned(key)) return;
  const ch = Number(key.split(':')[1]);
  const s = rotoSetupOfChannel(ch);
  const m = s ? SETUP_MACHINE[s.name] : null;
  if (!m || focus.get() === m || !MACHINES.includes(m)) return;
  targetOf(`nav:${m}`)?.down?.();
}

/** Une cible d'une machine chargee a part : son code arrive, puis le message repart. */
function withTarget(id: string, fn: (t: MidiTarget) => void): void {
  const t = targetOf(id);
  if (t) {
    fn(t);
    return;
  }
  const p = prefixOf(id);
  const load = p === 'dj' ? djLoad.load() : p === 'smpl' ? smplLoad.load() : null;
  void load?.then(() => {
    const again = targetOf(id);
    if (again) fn(again);
  });
}

/** L'etat appuye d'une cle (un CC au-dessus de 63, une note enfoncee) : une action part au front montant. */
const pressed = new Map<string, boolean>();
/** Dernier message recu par cle (le retour attend que le potard se pose) et derniere valeur envoyee. */
const touchedAt = new Map<string, number>();
const sent = new Map<string, number>();
/** Quand une valeur est partie vers le controleur (un echo qui revient aussitot est ignore). */
const echoAt = new Map<string, number>();
const ECHO_MS = 250;

function apply(t: MidiTarget, m: MidiMsg, key: string): void {
  const isOn = m.kind === 'note' ? m.on === true : m.value > 0.5;
  if (t.kind === 'value') {
    // 64, le cran du milieu du Roto : le neutre exact (0 dB d'un EQ, un filtre ouvert)
    const val = m.kind === 'cc' && Math.round(m.value * 127) === 64 ? 0.5 : m.value;
    if (m.kind === 'note') {
      // Une note fait basculer un parametre (le bas ou le haut de sa course)
      if (!isOn) return;
      t.set?.((t.get?.() ?? 0) < 0.5 ? 1 : 0);
    } else t.set?.(val);
    touchedAt.set(key, performance.now());
    sent.set(key, Math.round(val * 127));
    return;
  }
  const was = pressed.get(key) === true;
  pressed.set(key, isOn);
  if (isOn && !was) t.down?.();
  else if (!isOn && was && t.kind === 'hold') t.up?.();
}

/** Un message MIDI (Web MIDI, ou un test) : appris en LEARN, sinon joue. */
export function handle(m: MidiMsg): void {
  const key = msgKey(m);
  set({ last: keyText(key) });
  if (view.learn && view.pick) {
    // Un relachement de note ou un CC a 0 n'apprend rien : on attend un appui ou un potard qui bouge
    if (m.kind === 'note' && !m.on) return;
    bind(view.pick, key, m.device);
    return;
  }
  // Un echo de ce qu'on vient d'envoyer aux potards motorises : ni joue, ni suivi
  if (m.kind === 'cc' && sent.get(key) === Math.round(m.value * 127) && performance.now() - (echoAt.get(key) ?? -Infinity) < ECHO_MS) return;
  const id = resolve(key);
  if (!id) return;
  follow(key);
  withTarget(id, (t) => apply(t, m, key));
}

/** Assigne une cle a une cible (dans la machine de la cible) ; une cle n'y vise qu'une cible, une cible n'a qu'une cle. */
export function bind(targetId: string, key: string, device?: string): void {
  const t = targetOf(targetId);
  const scope: TargetScope = t?.scope ?? (prefixOf(targetId) === 'dj' ? 'dj' : prefixOf(targetId) === 'smpl' ? 'smpl' : 'global');
  const maps: MidiMaps = { ...view.maps };
  const m = { ...(maps[scope] ?? {}) };
  for (const [k, v] of Object.entries(m)) if (v === targetId) delete m[k];
  m[key] = targetId;
  maps[scope] = m;
  const devices = device && !view.devices.includes(device) ? [...view.devices, device].slice(-8) : view.devices;
  set({ maps, devices, pick: null });
  save();
  sent.delete(key);
}

export function unbind(scope: TargetScope, key: string): void {
  const m = { ...(view.maps[scope] ?? {}) };
  delete m[key];
  set({ maps: { ...view.maps, [scope]: m } });
  save();
}

export function clearScope(scope: TargetScope): void {
  const maps = { ...view.maps };
  delete maps[scope];
  set({ maps });
  save();
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

function outputsForFeedback(): MIDIOutput[] {
  if (!access || !view.feedback) return [];
  const want = new Set(view.devices.map(normName));
  const out: MIDIOutput[] = [];
  access.outputs.forEach((o) => {
    // Les appareils qui ont appris ; avec la carte, le Roto-Control (son nom contient "roto")
    if (o.name && (want.has(normName(o.name)) || (view.roto && /roto/i.test(o.name)))) out.push(o);
  });
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

/** Les valeurs des parametres assignes qui ont change (vers les potards motorises). */
function feedbackTick(): void {
  const outs = outputsForFeedback();
  if (outs.length === 0) return;
  const now = performance.now();
  const keys = new Set<string>();
  for (const s of SCOPES) for (const k of Object.keys(view.maps[s] ?? {})) keys.add(k);
  if (view.roto) for (const k of rotoFeedbackKeys()) keys.add(k);
  for (const key of keys) {
    if (key.startsWith('note:')) continue;
    if (now - (touchedAt.get(key) ?? -Infinity) < TOUCH_HOLD_MS) continue;
    const id = resolve(key);
    const t = id ? targetOf(id) : undefined;
    if (!t || t.kind !== 'value' || !t.get) continue;
    const v7 = Math.max(0, Math.min(127, Math.round(t.get() * 127)));
    if (sent.get(key) === v7) continue;
    sent.set(key, v7);
    echoAt.set(key, now);
    sendValue(outs, key, v7);
  }
}

/** Tout renvoyer (une autre machine, un controleur rebranche) : les potards prennent les valeurs de la vue. */
function resendAll(): void {
  sent.clear();
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
  save();
  resendAll();
}

export function feedbackToggle(on = !view.feedback): void {
  set({ feedback: on });
  save();
  resendAll();
}

/* ---------------- export, import ---------------- */

export function exportMaps(): string {
  return JSON.stringify({ v: 1, maps: view.maps, devices: view.devices }, null, 2);
}

/** Des assignations d'un fichier : elles remplacent celles du navigateur ; false si le fichier ne se lit pas. */
export function importMaps(text: string): boolean {
  try {
    const raw = JSON.parse(text) as { maps?: unknown; devices?: unknown };
    const maps = cleanMaps(raw.maps);
    const devices = Array.isArray(raw.devices) ? raw.devices.filter((d): d is string => typeof d === 'string').slice(0, 16) : view.devices;
    set({ maps, devices });
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

// Une autre machine : ses valeurs repartent vers le controleur ; MIDI deja accepte : il se rallume
if (typeof window !== 'undefined') {
  focus.subscribe(() => resendAll());
  if (!supported()) view = { ...view, status: 'unsupported' };
  else if (wantOn) void midiEnable();
}
