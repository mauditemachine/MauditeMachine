/**
 * Le pont de la face du MM-ARP et de son plugin (2026-11-09, plugin/mm-arp), sur le modele de celui du MM-RYTM
 * (plugin/bridge.ts).
 *
 * Le plugin joue le son (C++), fenetre fermee et pendant un export d'Ableton : la face n'est que la face.
 *
 * Programme v2 (2026-11-09, Mika : "tous les potards automatisables et pilotables en MIDI dans Ableton") : les 53 potards
 * (voyager/params.ts VOY_KNOBS) sont des parametres du VST3, aux memes ids, de 0 a 1. Le C++ fait lui-meme le moteur, les
 * effets et les notes de l'arpege a partir de leurs valeurs brutes. La face ne lui envoie plus que ce qui n'est pas un
 * potard (la suite, la progression, le tempo et le swing de l'horloge interne) dans mm_program, et chaque potard qu'on
 * tourne dans mm_param (au plus 60 fois par seconde et par potard, la derniere valeur part toujours), entre deux
 * mm_gesture (debut et fin d'un geste : Ableton enregistre l'automation proprement). Les potards que bougent
 * l'automation ou le MIDI d'Ableton reviennent par mm_knobs, appliques sans echo.
 *
 * Les gestes, sans toucher au code des potards (les potards 3D de la face et de la carte, la molette, le clavier) : un potard qui change
 * pendant qu'un pointeur est enfonce ouvre son geste, le pointeur relache le ferme ; sans pointeur (clavier, molette,
 * RANDOM, un preset, UNDO), le geste se ferme 350 ms apres son dernier changement.
 *
 * Dans l'autre sens : la position du C++ (mm_transport) fait running et la tete de lecture (voyager/arp.ts arpExternal :
 * l'ecran, les pads, la suite). Le son du navigateur est coupe (FLAGS.mute), son arpegiateur ne programme rien.
 *
 * Protocole (window.__JUCE__.backend, sans la bibliotheque JS de JUCE) :
 *   face -> C++ : mm_ready {}, mm_program {program}, mm_param {id, v}, mm_gesture {id, on}, mm_state {ls}, mm_run {on},
 *                 mm_log {where, msg}, mm_preset_save {name, preset}, mm_preset_open {}, mm_preset_list {},
 *                 mm_preset_load {path}
 *                 mm_drag_midi {cycles}, mm_save_mid {cycles}, mm_learn {id}, mm_unmap {cc, ch}, mm_unmap_all {},
 *                 mm_midimap_get {}
 *   C++ -> face : mm_transport {playing, internal, seq, slot, pos, len, chord, midi}, mm_knobs {values},
 *                 mm_preset {name, preset}, mm_presets {items}, mm_saved {ok, name, path?, cancelled?},
 *                 mm_drag_status {ok, msg}, mm_midimap {items: {cc, ch, id}[], learn}
 *
 * Le capot (2026-11-09, plugin/arp/HoodPanel.tsx) : DRAG MIDI (mm_drag_midi part une fois, des que le pointeur enfonce sur
 * la poignee a bouge de 4 px : le C++ lance le glisser natif du fichier depuis l'evenement souris en cours), SAVE .MID, et
 * MIDI LEARN (plugin/arp/midimap.ts) : le mode LEARN du site (midi/midi.ts learnToggle) fait choisir un potard d'un clic
 * (ui/Hotspots.tsx : il ne bouge pas), le pont l'arme chez le C++ (mm_learn) ; LEARN ou Echap l'eteint (mm_learn {id: ''}).
 * (pas de mm_note : la face du MM-ARP ne joue aucune note en direct, un pad ajoute ou retire un accord de la progression)
 *
 * SOUND+ (2026-11-10, plugin/arp/extra.ts : les 14 reglages du VST3 seul, plugin/mm-arp/extra-params.json) : les MEMES
 * evenements que les potards, a leurs ids (xQuality, xLfo2Rate...) : mm_param {id, v}, mm_gesture {id, on}, et mm_knobs
 * {values} dans l'autre sens (sans echo). mm_program porte extra: { [id]: v } (comme knobs : pour une instance neuve) ;
 * le preset du disque aussi (un preset sans extra remet leurs valeurs de depart, sauf xQuality qui reste). MIDI LEARN :
 * un clic sur un reglage SOUND+ l'arme (learnArm : mm_learn {id}).
 */

import { pattern } from '../../audio/pattern';
import { learnPick, learnToggle, midi } from '../../midi/midi';
import { FLAGS } from '../../state/flags';
import { apply, capture, presets } from '../../state/presets';
import { undo } from '../../state/undo';
import { SWING } from '../../theme';
import { arp, arpExternal, type ArpExtHead } from '../../voyager/arp';
import { CHORDS } from '../../voyager/chords';
import { voyMsg } from '../../voyager/msg';
import { VOY_KNOB_IDS, VOY_STORAGE_KEY, voyParams, type VoyKnobId } from '../../voyager/params';
import { seq, type SeqStep } from '../../voyager/seq';
import { extHead } from '../head';
import { STATE_PREFIX } from '../restore';
import { arpDisk, DISK_FORMAT, type DiskItem } from './disk';
import { arpExtra, EXTRA_IDS, isExtra } from './extra';
import { arpMidi, type MidiMapItem } from './midimap';

/* ---------------- le programme (lu par plugin/mm-arp/src) ---------------- */

export interface ArpProgram {
  v: 2;
  kind: 'arp';
  /** le tempo de la face (l'horloge interne quand Ableton est arrete) */
  bpm: number;
  /** le retard des doubles croches impaires, en part de pas (SWING x 1/3) */
  swing: number;
  /** la suite (voyager/seq.ts) : EDIT ou AUTO, ses 16 pas (des degres, null : un silence), les len premiers jouent */
  seq: { edit: boolean; len: number; buf: SeqStep[] };
  /** la progression (indices de CHORDS), un accord par mesure */
  prog: number[];
  /** tous les potards (0 a 1), pour la compatibilite : ils vivent dans les parametres du plugin (mm_param, mm_knobs) */
  knobs: Record<string, number>;
  /** les reglages du VST3 seul (plugin/arp/extra.ts, 0 a 1), comme knobs : ils vivent dans les parametres du plugin */
  extra: Record<string, number>;
}

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;

function compile(): ArpProgram {
  const s = seq.get();
  return {
    v: 2,
    kind: 'arp',
    bpm: pattern.get().bpm,
    swing: r6(pattern.fx.get().swing * SWING.maxDelay),
    seq: { edit: s.edit, len: s.len, buf: [...s.buf] },
    prog: [...arp.get().prog],
    knobs: { ...voyParams.get() },
    extra: { ...arpExtra.get() },
  };
}

/* ---------------- JUCE ---------------- */

interface JuceBackend {
  addEventListener(id: string, fn: (o: unknown) => void): unknown;
  emitEvent(id: string, o: unknown): void;
}

const backend = (): JuceBackend | null => {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { __JUCE__?: { backend?: JuceBackend } }).__JUCE__?.backend ?? null;
};

function send(id: string, o: unknown): void {
  try {
    backend()?.emitEvent(id, o);
  } catch {
    /* le plugin est parti (fenetre fermee) : rien a faire */
  }
}

/* ---------------- le transport du C++ ---------------- */

let internal = false;

const num = (x: unknown, d: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);

function onTransport(o: unknown): void {
  if (!o || typeof o !== 'object') return;
  const x = o as Record<string, unknown>;
  internal = x.internal === true;
  const chord = num(x.chord, -1);
  const h: ArpExtHead = {
    playing: x.playing === true,
    seq: num(x.seq, -1),
    slot: num(x.slot, -1),
    pos: num(x.pos, -1),
    len: Math.max(0, num(x.len, 0)),
    chord: chord >= 0 && chord < CHORDS.length ? chord : -1,
    midi: num(x.midi, -1),
  };
  arpExternal.head(h);
  // Les boucles de rendu se reveillent (scene/renderer.ts : extHead.onWake)
  extHead.wake();
}

/* ---------------- l'etat (les cles du site) ---------------- */

/**
 * La progression (le site ne la garde pas : chaque visite repart sans accord) : le plugin la garde dans le projet, avec le
 * reste ; remise au chargement (arp.load : sans lancer ni arreter l'arpege).
 */
const PROG_KEY = 'mm.v4.plugin.arp.prog';

function saveProg(): void {
  try {
    window.localStorage.setItem(PROG_KEY, JSON.stringify(arp.get().prog));
  } catch {
    /* stockage refuse : rien */
  }
}

function loadProg(): void {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PROG_KEY) ?? 'null') as unknown;
    if (Array.isArray(raw) && raw.length > 0) arp.load(raw.filter((k): k is number => typeof k === 'number'));
  } catch {
    /* illisible : sans accord */
  }
}

function snapshotLs(): Record<string, string> {
  const ls: Record<string, string> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(STATE_PREFIX)) {
        const v = window.localStorage.getItem(k);
        if (v !== null) ls[k] = v;
      }
    }
  } catch {
    /* stockage refuse : rien */
  }
  return ls;
}

/* ---------------- les potards : mm_param, mm_gesture, mm_knobs ---------------- */

/** Au plus 60 mm_param par seconde et par potard ; la derniere valeur part toujours. */
const PARAM_MS = 1000 / 60;
/** Un geste sans pointeur (clavier, molette, RANDOM, un preset) se ferme apres ce repos. */
const GESTURE_IDLE_MS = 350;

const isKnob = (id: string): id is VoyKnobId => (VOY_KNOB_IDS as readonly string[]).includes(id);

/** Les valeurs que le C++ connait (ce qu'on lui a envoye, ce qu'il nous a envoye) : seul un ecart part. */
let known: Record<string, number> = {};
/** > 0 : on applique des valeurs du C++ (mm_knobs) : rien ne repart. */
let fromHost = 0;
const lastSent = new Map<string, number>();
const pending = new Map<string, number>();
/** Les gestes ouverts : le minuteur de fermeture (0 : tenu par le pointeur). */
const gestures = new Map<string, number>();
let pointerHeld = false;

/** La valeur du moment d'un parametre : un potard du site, ou un reglage SOUND+. */
const valueOf = (id: string): number | null => (isKnob(id) ? voyParams.of(id) : isExtra(id) ? arpExtra.of(id) : null);

function sendParam(id: string): void {
  const v = valueOf(id);
  if (v === null) return;
  lastSent.set(id, performance.now());
  send('mm_param', { id, v });
}

function flushParam(id: string): void {
  const t = pending.get(id);
  if (t === undefined) return;
  window.clearTimeout(t);
  pending.delete(id);
  sendParam(id);
}

function endGesture(id: string): void {
  const t = gestures.get(id);
  if (t === undefined) return;
  if (t) window.clearTimeout(t);
  gestures.delete(id);
  // La derniere valeur d'abord, puis la fin du geste
  flushParam(id);
  send('mm_gesture', { id, on: false });
}

function endAllGestures(): void {
  for (const id of [...gestures.keys()]) endGesture(id);
}

function touchGesture(id: string): void {
  const t = gestures.get(id);
  if (t === undefined) send('mm_gesture', { id, on: true });
  else if (t) window.clearTimeout(t);
  gestures.set(id, pointerHeld ? 0 : window.setTimeout(() => endGesture(id), GESTURE_IDLE_MS));
}

function paramOut(id: string): void {
  touchGesture(id);
  if (pending.has(id)) return;
  const wait = PARAM_MS - (performance.now() - (lastSent.get(id) ?? -1e9));
  if (wait <= 0) sendParam(id);
  else
    pending.set(
      id,
      window.setTimeout(() => {
        pending.delete(id);
        sendParam(id);
      }, wait)
    );
}

/** voyParams a change : chaque potard qui s'ecarte de ce que le C++ connait part (sauf s'il vient du C++). */
function knobsChanged(): void {
  const v = voyParams.get();
  for (const id of VOY_KNOB_IDS) {
    if (v[id] === known[id]) continue;
    known[id] = v[id];
    if (!fromHost) paramOut(id);
  }
}

/** Les reglages SOUND+ (plugin/arp/extra.ts) : comme les potards. */
function extraChanged(): void {
  const v = arpExtra.get();
  for (const id of EXTRA_IDS) {
    if (v[id] === known[id]) continue;
    known[id] = v[id];
    if (!fromHost) paramOut(id);
  }
}

/** mm_knobs : l'automation ou le MIDI d'Ableton (ou toutes les valeurs, au mm_ready). */
function onKnobs(o: unknown): void {
  const values = o && typeof o === 'object' ? (o as { values?: unknown }).values : null;
  if (!values || typeof values !== 'object') return;
  fromHost += 1;
  try {
    for (const [id, v] of Object.entries(values as Record<string, unknown>)) {
      const knob = isKnob(id);
      if ((!knob && !isExtra(id)) || typeof v !== 'number' || !Number.isFinite(v)) continue;
      // Une valeur de la face en attente ne doit pas ecraser celle d'Ableton
      const t = pending.get(id);
      if (t !== undefined) {
        window.clearTimeout(t);
        pending.delete(id);
      }
      if (knob) {
        voyParams.set(id, v);
        known[id] = voyParams.of(id);
      } else {
        arpExtra.set(id, v);
        known[id] = arpExtra.of(id);
      }
    }
  } finally {
    fromHost -= 1;
  }
  extHead.wake();
}

/* ---------------- les presets sur le disque ---------------- */

const str = (x: unknown): string => (typeof x === 'string' ? x : '');

/** Le preset du moment au format du site (state/presets.ts capture('voy')), marque pour le disque. */
function diskPreset(name: string): string {
  const d = capture('voy') as { knobs: Record<string, number>; seq: unknown; prog: number[] };
  const user = presets.user();
  return JSON.stringify({ format: DISK_FORMAT, v: 1, name, ...(user ? { user } : {}), at: Date.now(), knobs: d.knobs, seq: d.seq, prog: d.prog, extra: { ...arpExtra.get() } });
}

/**
 * Les reglages SOUND+ d'un preset : ceux qu'il porte ; ceux qu'il ne porte pas (un preset du site, ou d'avant) reviennent
 * a leur valeur de depart (le son du site), sauf xQuality qui reste ou il est.
 */
function applyExtra(raw: unknown): void {
  const x = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  for (const id of EXTRA_IDS) {
    const v = x[id];
    if (typeof v === 'number' && Number.isFinite(v)) arpExtra.set(id, v);
    else if (id !== 'xQuality') arpExtra.set(id, arpExtra.def(id));
  }
}

/**
 * Un preset ouvert depuis le disque : applique comme un preset du site (state/presets.ts apply('voy') et ses migrations :
 * les potards, la suite, la progression), une etape d'UNDO a lui, le son d'avant mis de cote s'il n'etait garde nulle
 * part (YOUR SOUND). Les potards repartent au C++ en mm_param, la suite et la progression en mm_program.
 * Accepte aussi un preset du site tel quel ({ data: { knobs, seq, prog } }). false : illisible.
 */
function applyDiskPreset(name: string, text: string): boolean {
  let o: unknown;
  try {
    o = JSON.parse(text);
  } catch {
    return false;
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  const top = o as Record<string, unknown>;
  const d = (top.data && typeof top.data === 'object' ? top.data : top) as Record<string, unknown>;
  if (!d.knobs || typeof d.knobs !== 'object' || Array.isArray(d.knobs)) return false;
  const data = {
    knobs: d.knobs as Record<string, number>,
    seq: (d.seq && typeof d.seq === 'object' ? d.seq : { edit: false }) as ReturnType<typeof seq.get>,
    // Sans progression : celle du moment
    prog: Array.isArray(d.prog) ? (d.prog.filter((k) => typeof k === 'number') as number[]) : [...arp.get().prog],
  };
  presets.setAside('voy');
  undo.boundary('voy', 'preset');
  apply('voy', data);
  applyExtra(d.extra);
  voyMsg.show(`LOADED ${(name || str(top.name) || 'PRESET').toUpperCase()}`, 1800);
  return true;
}

function onPreset(o: unknown): void {
  if (!o || typeof o !== 'object') return;
  const x = o as Record<string, unknown>;
  const name = str(x.name);
  if (!applyDiskPreset(name, str(x.preset))) {
    voyMsg.show('PRESET UNREADABLE', 1800);
    arpBridge.log('preset', `illisible : ${name}`);
    return;
  }
  if (typeof x.path === 'string') arpDisk.set({ current: x.path });
}

function onPresets(o: unknown): void {
  const raw = o && typeof o === 'object' ? (o as { items?: unknown }).items : null;
  const items: DiskItem[] = Array.isArray(raw)
    ? raw.filter((i): i is DiskItem => !!i && typeof i === 'object' && typeof (i as DiskItem).name === 'string' && typeof (i as DiskItem).path === 'string').map((i) => ({ name: i.name, path: i.path }))
    : [];
  arpDisk.set({ items });
}

function onSaved(o: unknown): void {
  if (!o || typeof o !== 'object') return;
  const x = o as Record<string, unknown>;
  const name = str(x.name).toUpperCase();
  if (x.ok === true) {
    voyMsg.show(`SAVED TO DISK ${name}`.trim(), 1800);
    if (typeof x.path === 'string') arpDisk.set({ current: x.path });
    send('mm_preset_list', {});
  } else if (x.cancelled !== true) voyMsg.show(`NOT SAVED ${name}`.trim(), 2400);
}

/* ---------------- le capot : DRAG MIDI, MIDI LEARN ---------------- */

/** Le temps de lire un message de DRAG MIDI ou SAVE .MID. */
const STATUS_MS = 3200;
let statusTimer = 0;

function onDragStatus(o: unknown): void {
  if (!o || typeof o !== 'object') return;
  const x = o as Record<string, unknown>;
  const msg = str(x.msg);
  if (!msg) return;
  if (statusTimer) window.clearTimeout(statusTimer);
  arpMidi.set({ status: { ok: x.ok === true, msg } });
  statusTimer = window.setTimeout(() => {
    statusTimer = 0;
    arpMidi.set({ status: null });
  }, STATUS_MS);
}

function onMidimap(o: unknown): void {
  if (!o || typeof o !== 'object') return;
  const x = o as Record<string, unknown>;
  const items: MidiMapItem[] = Array.isArray(x.items)
    ? x.items
        .filter((i): i is MidiMapItem => !!i && typeof i === 'object' && typeof (i as MidiMapItem).cc === 'number' && typeof (i as MidiMapItem).ch === 'number' && typeof (i as MidiMapItem).id === 'string')
        .map((i) => ({ cc: i.cc, ch: i.ch, id: i.id }))
    : [];
  arpMidi.set({ items, armed: str(x.learn) });
}

/** Le mode LEARN (la face) : allume, un clic sur un potard l'arme ; eteint, le potard arme ne l'est plus. */
function learnMode(on: boolean): void {
  const s = arpMidi.get();
  if (on === s.learning) return;
  arpMidi.set({ learning: on, armed: '' });
  if (midi.get().learn !== on) learnToggle(on);
  if (!on || s.armed) send('mm_learn', { id: '' });
}

/** Le potard choisi en LEARN (ui/Hotspots.tsx learnPick) : arme chez le C++ ; le choix se vide, pour le prochain clic. */
function onLearnPick(): void {
  const m = midi.get();
  if (!m.learn && arpMidi.get().learning) {
    learnMode(false);
    return;
  }
  const pick = m.pick;
  if (!pick) return;
  learnPick(null);
  if (!arpMidi.get().learning) return;
  const id = pick.startsWith('voy:knob:') ? pick.slice('voy:knob:'.length) : '';
  if (!isKnob(id)) {
    voyMsg.show('MIDI LEARN : KNOBS ONLY', 1600);
    return;
  }
  arpMidi.set({ armed: id });
  send('mm_learn', { id });
}

/** Un reglage SOUND+ clique en LEARN (SoundPlus.tsx) : arme chez le C++, comme un potard. false : le mode est eteint. */
function learnArm(id: string): boolean {
  if (!arpMidi.get().learning || !isExtra(id)) return false;
  arpMidi.set({ armed: id });
  send('mm_learn', { id });
  return true;
}

/* ---------------- le pont ---------------- */

let started = false;
let progTimer = 0;
let stateTimer = 0;
let lastProgram = '';
let lastProg = '';

function sendProgram(): void {
  progTimer = 0;
  let json: string;
  let key: string;
  try {
    const p = compile();
    json = JSON.stringify(p);
    // Les potards ne relancent pas le programme (ils passent par mm_param) : la cle les laisse de cote
    key = JSON.stringify({ ...p, knobs: null, extra: null });
  } catch (err) {
    arpBridge.log('compile', String(err));
    return;
  }
  if (key === lastProgram) return;
  lastProgram = key;
  send('mm_program', { program: json });
}

function sendState(): void {
  stateTimer = 0;
  // Les ecritures du site sont retardees (300 a 400 ms) : on les force avant de lire
  try {
    pattern.flush();
    window.localStorage.setItem(VOY_STORAGE_KEY, JSON.stringify({ v: 1, knobs: voyParams.get() }));
  } catch {
    /* rien */
  }
  saveProg();
  arpExtra.flush();
  send('mm_state', { ls: JSON.stringify({ v: 1, ls: snapshotLs() }) });
}

function stateChanged(): void {
  if (stateTimer) window.clearTimeout(stateTimer);
  stateTimer = window.setTimeout(sendState, 900);
}

function changed(): void {
  if (!progTimer) progTimer = window.setTimeout(sendProgram, 50);
  stateChanged();
}

export const arpBridge = {
  /** Le plugin est-il la (window.__JUCE__) ? */
  present: (): boolean => backend() !== null,
  start(): void {
    if (started) return;
    started = true;
    // Le son vient du plugin : le navigateur se tait, son arpegiateur ne programme rien (voyager/arp.ts arpExternal)
    FLAGS.mute = true;
    arpExternal.set({ run: (on) => send('mm_run', { on }) });
    loadProg();
    lastProg = JSON.stringify(arp.get().prog);
    known = { ...voyParams.get(), ...arpExtra.get() };
    const be = backend();
    be?.addEventListener('mm_transport', onTransport);
    be?.addEventListener('mm_knobs', onKnobs);
    be?.addEventListener('mm_preset', onPreset);
    be?.addEventListener('mm_presets', onPresets);
    be?.addEventListener('mm_saved', onSaved);
    be?.addEventListener('mm_drag_status', onDragStatus);
    be?.addEventListener('mm_midimap', onMidimap);
    midi.subscribe(onLearnPick);
    // Echap eteint MIDI LEARN d'abord (avant hooks/useKeys : le capot reste ouvert), sauf pendant le nom d'un preset
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape' || !arpMidi.get().learning || arpDisk.get().naming !== null) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        learnMode(false);
      },
      true
    );
    // Les potards : mm_param (et l'etat, pour la fenetre suivante) ; ils ne relancent plus le programme
    voyParams.subscribe(knobsChanged);
    voyParams.subscribe(stateChanged);
    arpExtra.subscribe(extraChanged);
    arpExtra.subscribe(stateChanged);
    seq.subscribe(changed);
    // La progression (running aussi passe par la : le programme identique ne repart pas)
    arp.subscribe(() => {
      const k = JSON.stringify(arp.get().prog);
      if (k === lastProg) return;
      lastProg = k;
      changed();
    });
    // Le tempo et le swing (le reste du motif du MM-RYTM ne change rien : le programme identique ne repart pas)
    pattern.subscribe(changed);
    pattern.fx.subscribe(changed);
    presets.subscribe(stateChanged);
    // Les gestes : un pointeur enfonce tient le geste des potards qui changent, relache il le ferme
    const opts = { capture: true, passive: true } as const;
    window.addEventListener('pointerdown', (e) => {
      if (e.button === 0 || e.pointerType !== 'mouse') pointerHeld = true;
    }, opts);
    const release = (): void => {
      if (!pointerHeld) return;
      pointerHeld = false;
      endAllGestures();
    };
    window.addEventListener('pointerup', release, opts);
    window.addEventListener('pointercancel', release, opts);
    window.addEventListener('blur', release);
    send('mm_ready', {});
    sendProgram();
    sendState();
    send('mm_preset_list', {});
  },
  /** Le transport du C++ est-il l'horloge interne (Ableton arrete) ? */
  internal: (): boolean => internal,
  log(where: string, msg: string): void {
    send('mm_log', { where, msg });
  },
  /** SAVE TO DISK : le preset du moment, sous ce nom (le C++ l'ecrit dans le dossier des presets ; reponse mm_saved). */
  diskSave(name: string): void {
    send('mm_preset_save', { name, preset: diskPreset(name) });
  },
  /** OPEN FROM DISK : la boite de dialogue du systeme (le C++ ; reponse mm_preset). */
  diskOpen(): void {
    send('mm_preset_open', {});
  },
  /** La liste du dossier des presets (reponse mm_presets). */
  diskList(): void {
    send('mm_preset_list', {});
  },
  /** Un preset de la liste (reponse mm_preset). */
  diskLoad(path: string): void {
    arpDisk.set({ current: path });
    send('mm_preset_load', { path });
  },
  /**
   * Un preset de la banque d'usine du VST3 (LIBRARY, Library.tsx ; plugin/mm-arp/presets/factory.json) : applique
   * exactement comme un mm_preset venu du disque (potards, suite, progression, SOUND+ ; une etape d'UNDO, mm_param vers le
   * C++), sauf QUALITY qui garde la valeur du moment.
   */
  factoryLoad(p: { name: string; knobs: unknown; seq: unknown; prog: unknown; extra?: unknown }): boolean {
    const extra = p.extra && typeof p.extra === 'object' && !Array.isArray(p.extra) ? { ...(p.extra as Record<string, unknown>) } : {};
    delete extra.xQuality;
    const ok = applyDiskPreset(p.name, JSON.stringify({ name: p.name, knobs: p.knobs, seq: p.seq, prog: p.prog, extra }));
    if (ok) arpDisk.set({ current: null });
    return ok;
  },
  /** DRAG MIDI : le glisser natif du clip (le C++, depuis l'evenement souris en cours ; reponse mm_drag_status). */
  dragMidi(cycles: number): void {
    send('mm_drag_midi', { cycles });
  },
  /** SAVE .MID : la boite de dialogue du systeme (le C++ ; reponse mm_drag_status). */
  saveMid(cycles: number): void {
    send('mm_save_mid', { cycles });
  },
  /** MIDI LEARN : le mode (LEARN, Echap). */
  learnMode,
  /** MIDI LEARN : un reglage SOUND+ arme (mm_learn {id}). */
  learnArm,
  /** Une assignation de moins ; toutes (CLEAR ALL). La table revient par mm_midimap. */
  unmap(cc: number, ch: number): void {
    send('mm_unmap', { cc, ch });
  },
  unmapAll(): void {
    send('mm_unmap_all', {});
  },
  /** La table des CC (reponse mm_midimap). */
  midimapGet(): void {
    send('mm_midimap_get', {});
  },
  /** Pour les essais (Chromium) : le programme tel qu'il partirait, et le preset tel que SAVE l'enverrait. */
  compile,
  diskPreset,
};
