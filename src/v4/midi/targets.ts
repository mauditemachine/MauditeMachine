/**
 * Tout ce qu'un controleur MIDI peut piloter (2026-10-05, Mika : "je
 * voudrais que toutes les actions, tous les parametres de toutes les
 * machines puissent etre assignes en MIDI ; j'ai un Roto-Control, je
 * voudrais selectionner un preset de mon Roto-Control, choisir la machine
 * que je veux et avoir les assignations"). Une cible : un parametre (une
 * valeur de 0 a 1, des crans s'il en a), ou une action (un appui ; tenue :
 * appui et relachement, CUE, un pad d'un sampler). Son id est stable (les
 * assignations retenues s'y referent) :
 * - MM-RYTM : rytm:enc:<encodeur>, rytm:voice:<voix>:<parametre> (le
 *   parametre d'une voix sans la choisir ; :mute, la voix coupee, 0 ou 1),
 *   rytm:kit:<tweak>, rytm:pad:<voix>, rytm:step:<0-15>, rytm:run, clear,
 *   random, mute, solo, edit, open ; rytm:running (en marche, 0 ou 1 : un
 *   bouton a bascule dont la LED suit) ; depuis le 2026-10-08 (la refonte
 *   facon Digitakt) rytm:knob:<1-8> (les potards de page A a H : ce que leur
 *   bloc regle sur la page affichee, 0 a 127 comme l'ecran ; une autre page,
 *   leurs valeurs repartent vers les potards motorises), rytm:page:<page>,
 *   rytm:page (six crans) et rytm:home ;
 * - MM-ARP : voy:knob:<potard>, voy:pad:<0-7>, voy:run, clear, random,
 *   edit, open ; voy:running ;
 * - partout : nav:<all|mm808|voy|dj|prev|next>, nav:machines (PLAY/STOP
 *   du MM-RYTM et du MM-ARP ensemble) ;
 * - MM-DECKS (dj:<commande>, et dj:smpl:<platine>:... pour le sampler de
 *   chaque platine, 2026-10-07) : son code arrive a part (state/djload.ts)
 *   et inscrit ses cibles (dj/midi.ts) ; une assignation qui les vise le
 *   charge. Le MM-SMPL (smpl:...) est parti le 2026-10-07 ;
 * - MM-BASS (bass:knob:<potard>, bass:key:<touche>, bass:running,
 *   bass:trig:<0-15>, bass:lock:<0-15> et bass:lock, 2026-10-07) : de meme
 *   (state/bassload.ts, bass/midi.ts).
 */

import { anyDial, anyDialValue, clearPattern, dialRange, dialSteps, editToggle, focusMachine, kitDial, machinesToggle, muteToggle, openToggle, padHit, pageKnobCourse, patternTap, randomPattern, rytmHome, rytmPageKey, rytmShowPage, runToggle, soloToggle, stepMachine, stepToggle, voiceMute, voyClear, voyDial, voyPad, voyRandom, voyRun, type DialId } from '../actions';
import { rytmPage } from '../state/rytmPage';
import { clock } from '../audio/clock';
import { voices as voiceState } from '../state/voices';
import { arp } from '../voyager/arp';
import { KIT_IDS, KIT_LABEL, kit, kitSteps } from '../audio/kit';
import { setVoiceFx } from '../audio/drums';
import { VOICE_PARAMS, voiceFx, type VoiceParam } from '../audio/voicefx';
import type { Stage } from '../scene/renderer';
import { MACHINES, VOYAGER, type MachineId } from '../state/focus';
import { PATTERN_SLOTS, slotName } from '../state/patterns';
import { ENCODERS, PADS, PAGE_KNOB_LETTERS, RYTM_PAGE_KEYS, isVoiceEnc, type Inst } from '../theme';
import { STEP_COUNT } from '../audio/pattern';
import { CHORDS } from '../voyager/chords';
import { VOY_KNOBS, voyParams } from '../voyager/params';

export type TargetScope = MachineId | 'global';

export interface MidiTarget {
  id: string;
  /** la machine qui le porte ; global : la navigation */
  scope: TargetScope;
  /** son nom (le panneau MIDI) */
  label: string;
  /** value : un parametre ; press : une action au premier appui ; hold : appui puis relachement */
  kind: 'value' | 'press' | 'hold';
  /** valeur de 0 a 1 */
  get?: () => number;
  set?: (v: number) => void;
  /** crans (0 : continu) */
  steps?: number;
  /**
   * page : un potard de page (rytm:knob:1-8, 2026-10-08) ; ce qu'il regle,
   * sa course et ses crans suivent la page affichee (le catalogue MIDI le dit
   * au lieu de figer les crans de la page de depart)
   */
  follows?: 'page';
  down?: () => void;
  up?: () => void;
}

let getStage: () => Stage | null = () => null;
/** La scene (pour les actions qui animent une touche de la machine). */
export function attachStage(fn: () => Stage | null): void {
  getStage = fn;
}
export const stageNow = (): Stage | null => getStage();

/* ---------------- les potards : un domaine ramene a 0..1 ---------------- */

function dialTarget(id: string, scope: TargetScope, label: string, dial: DialId): MidiTarget {
  const [lo, hi] = dialRange(dial);
  const span = hi - lo;
  return {
    id,
    scope,
    label,
    kind: 'value',
    // SAMPLE : ses crans suivent la voix selectionnee (un son par cran), lus a chaque fois
    get steps() {
      return dialSteps(dial);
    },
    get: () => (span > 0 ? (anyDialValue(dial) - lo) / span : 0),
    set: (v) => anyDial(dial, dial === 'tempo' ? Math.round(lo + v * span) : lo + v * span),
  };
}

const press = (id: string, scope: TargetScope, label: string, fn: () => void): MidiTarget => ({ id, scope, label, kind: 'press', down: fn });

const VOICE_LABEL: Readonly<Record<VoiceParam, string>> = { level: 'VOLUME', tone: 'TONE', decay: 'DECAY', dist: 'DIST', chorus: 'CHORUS', delay: 'DELAY', reverb: 'REVERB' };

function coreTargets(): MidiTarget[] {
  const out: MidiTarget[] = [];
  // MM-RYTM
  // La rangee VOICE regle la voix choisie (comme sur la machine) ; rytm:voice:... vise une voix sans la choisir
  for (const e of ENCODERS) out.push(dialTarget(`rytm:enc:${e.id}`, 'mm808', isVoiceEnc(e.id) ? `${e.label} (SELECTED VOICE)` : e.label, e.id));
  const voices = PADS.filter((p) => p.kind === 'voice').map((p) => p.id as Inst);
  for (const inst of voices) {
    for (const p of VOICE_PARAMS) {
      const bip = p === 'tone';
      out.push({
        id: `rytm:voice:${inst}:${p}`,
        scope: 'mm808',
        label: `${inst} ${VOICE_LABEL[p]}`,
        kind: 'value',
        get: () => (bip ? (voiceFx.of(inst)[p] + 1) / 2 : voiceFx.of(inst)[p]),
        set: (v) => setVoiceFx(inst, p, bip ? v * 2 - 1 : v),
      });
    }
  }
  // Les mutes directs (2026-10-05, le Roto en live) : 1 la voix se tait, 0 elle revient, sans le mode MUTE
  for (const inst of voices) {
    out.push({
      id: `rytm:voice:${inst}:mute`,
      scope: 'mm808',
      label: `MUTE ${inst}`,
      kind: 'value',
      steps: 2,
      get: () => (voiceState.isMuted(inst) ? 1 : 0),
      set: (v) => voiceMute(inst, v >= 0.5),
    });
  }
  // En marche ou a l'arret (un bouton a bascule : sa LED dit si la machine joue)
  out.push({
    id: 'rytm:running',
    scope: 'mm808',
    label: 'RUN (ON / OFF)',
    kind: 'value',
    steps: 2,
    get: () => (clock.running ? 1 : 0),
    set: (v) => {
      if (v >= 0.5 !== clock.running) void runToggle(getStage());
    },
  });
  for (const k of KIT_IDS) {
    // Ses crans suivent les echantillons du site (audio/samples.ts) : lus a chaque fois
    out.push({
      id: `rytm:kit:${k}`,
      scope: 'mm808',
      label: `TWEAK ${KIT_LABEL[k]}`,
      kind: 'value',
      get steps() {
        return kitSteps(k);
      },
      get: () => kit.value(k),
      set: (v) => kitDial(k, v),
    });
  }
  // Les potards de page (2026-10-08) : relatifs a la page, leur course, leurs crans et leur nom suivent la page
  PAGE_KNOB_LETTERS.forEach((letter, k) => {
    const dial = `p:${k}` as DialId;
    const span = (): [number, number] => dialRange(dial);
    out.push({
      id: `rytm:knob:${k + 1}`,
      scope: 'mm808',
      label: `KNOB ${letter} (PAGE)`,
      kind: 'value',
      follows: 'page',
      get steps() {
        return dialSteps(dial);
      },
      // Un bloc vide, ou rien a regler (pas de voix choisie, pas de pas choisi) : 0, comme son repere sur
      // la face (2026-10-08, revue de R1 : VOL sans voix renvoyait 102, une valeur que l'ecran ne montrait pas)
      get: () => pageKnobCourse(k),
      set: (v) => {
        const [lo, hi] = span();
        anyDial(dial, lo + v * (hi - lo));
      },
    });
  });
  for (const pk of RYTM_PAGE_KEYS) out.push(press(`rytm:page:${pk.id}`, 'mm808', `PAGE ${pk.label}`, () => rytmPageKey(pk.id, getStage())));
  out.push({
    id: 'rytm:page',
    scope: 'mm808',
    label: 'PAGE (TRIG TO FX)',
    kind: 'value',
    steps: RYTM_PAGE_KEYS.length,
    get: () => Math.max(0, RYTM_PAGE_KEYS.findIndex((p) => p.id === rytmPage.get().page)) / (RYTM_PAGE_KEYS.length - 1),
    set: (v) => rytmShowPage(RYTM_PAGE_KEYS[Math.max(0, Math.min(RYTM_PAGE_KEYS.length - 1, Math.round(v * (RYTM_PAGE_KEYS.length - 1))))].id),
  });
  out.push(press('rytm:home', 'mm808', 'HOME / PAGE SCREEN', () => rytmHome()));
  for (const inst of voices) out.push(press(`rytm:pad:${inst}`, 'mm808', `PAD ${inst}`, () => padHit(inst, getStage())));
  for (let i = 0; i < STEP_COUNT; i += 1) out.push(press(`rytm:step:${i}`, 'mm808', `STEP ${i + 1}`, () => void stepToggle(i, getStage())));
  out.push(press('rytm:run', 'mm808', 'RUN/STOP', () => void runToggle(getStage())));
  out.push(press('rytm:clear', 'mm808', 'CLEAR', () => clearPattern(getStage())));
  out.push(press('rytm:random', 'mm808', 'RANDOM', () => randomPattern(getStage())));
  out.push(press('rytm:mute', 'mm808', 'MUTE', () => void muteToggle(getStage())));
  out.push(press('rytm:solo', 'mm808', 'SOLO', () => void soloToggle(getStage())));
  out.push(press('rytm:edit', 'mm808', 'EDIT', () => editToggle('mm808', getStage())));
  out.push(press('rytm:open', 'mm808', 'OPEN', () => void openToggle(getStage(), 'mm808')));
  // Les seize patterns (2026-10-05, state/patterns.ts) : comme un step en EDIT (d'autres dans les deux secondes : la chaine)
  for (let i = 0; i < PATTERN_SLOTS; i += 1) out.push(press(`rytm:ptn:${i}`, 'mm808', `PATTERN ${slotName(i)}`, () => patternTap(i, getStage())));
  // MM-ARP
  if (VOYAGER) {
    for (const k of VOY_KNOBS) {
      const n = k.steps && !k.morph ? k.steps.length : 0;
      out.push({
        id: `voy:knob:${k.id}`,
        scope: 'voy',
        label: k.section === 'tweak' ? `TWEAK ${k.label}` : k.label,
        kind: 'value',
        steps: n,
        get: () => voyParams.of(k.id),
        set: (v) => voyDial(k.id, v),
      });
    }
    CHORDS.forEach((c, i) => out.push(press(`voy:pad:${i}`, 'voy', `CHORD ${c.label}`, () => voyPad(i, getStage()))));
    out.push(press('voy:run', 'voy', 'RUN/STOP', () => void voyRun(getStage())));
    out.push({
      id: 'voy:running',
      scope: 'voy',
      label: 'RUN (ON / OFF)',
      kind: 'value',
      steps: 2,
      get: () => (arp.get().running ? 1 : 0),
      set: (v) => {
        if (v >= 0.5 !== arp.get().running) void voyRun(getStage());
      },
    });
    out.push(press('voy:clear', 'voy', 'CLEAR', () => voyClear(getStage())));
    out.push(press('voy:random', 'voy', 'RANDOM', () => voyRandom(getStage())));
    out.push(press('voy:edit', 'voy', 'EDIT', () => editToggle('voy', getStage())));
    out.push(press('voy:open', 'voy', 'OPEN', () => void openToggle(getStage(), 'voy')));
  }
  // Partout : la navigation, PLAY/STOP des deux machines
  out.push(press('nav:all', 'global', 'MM-STUDIO (ALL THE MACHINES)', () => focusMachine('all')));
  for (const m of MACHINES) out.push(press(`nav:${m}`, 'global', `GO TO ${MACHINE_NAME[m]}`, () => focusMachine(m)));
  out.push(press('nav:prev', 'global', 'PREVIOUS MACHINE', () => void stepMachine(-1)));
  out.push(press('nav:next', 'global', 'NEXT MACHINE', () => void stepMachine(1)));
  out.push(press('nav:machines', 'global', 'PLAY/STOP MACHINES', () => void machinesToggle()));
  return out;
}

export const MACHINE_NAME: Readonly<Record<MachineId, string>> = { mm808: 'MM-RYTM', voy: 'MM-ARP', bass: 'MM-BASS', dj: 'MM-DECKS' };

let core: Map<string, MidiTarget> | null = null;
const coreMap = (): Map<string, MidiTarget> => {
  core ??= new Map(coreTargets().map((t) => [t.id, t]));
  return core;
};

/** Les cibles des machines chargees a part : le MM-DECKS (sa liste suit ses platines), le MM-BASS. */
const lazy = new Map<string, { list: () => MidiTarget[]; find: (id: string) => MidiTarget | undefined }>();
const lazyListeners = new Set<() => void>();

/**
 * Les cibles trouvees des machines chargees a part, gardees (2026-10-08, Mika :
 * "Roto control : des fois ca fonctionne, des fois ca ne fonctionne pas") :
 * le MM-DECKS refaisait sa cible a chaque recherche, et le retour vers le
 * Roto en cherche des centaines toutes les 50 ms. Une cible lit l'etat de sa
 * commande a chaque appel : la garder ne fige rien. Vide a chaque inscription.
 */
const lazyFound = new Map<string, MidiTarget>();

/** Une machine chargee a part inscrit ses cibles (prefixe : dj, bass). */
export function registerTargets(prefix: string, list: () => MidiTarget[], find: (id: string) => MidiTarget | undefined): void {
  lazy.set(prefix, { list, find });
  lazyFound.clear();
  lazyListeners.forEach((fn) => fn());
}
export function onTargetsRegistered(fn: () => void): () => void {
  lazyListeners.add(fn);
  return () => {
    lazyListeners.delete(fn);
  };
}

export const prefixOf = (id: string): string => id.slice(0, id.indexOf(':'));

/** La cible d'un id ; undefined si sa machine n'est pas encore chargee (ou si elle n'existe plus). */
export function targetOf(id: string): MidiTarget | undefined {
  const c = coreMap().get(id);
  if (c) return c;
  const kept = lazyFound.get(id);
  if (kept) return kept;
  const t = lazy.get(prefixOf(id))?.find(id);
  if (t) lazyFound.set(id, t);
  return t;
}

/** Les cibles d'une machine (ou de la navigation), dans l'ordre de la machine. */
export function targetsOf(scope: TargetScope): MidiTarget[] {
  const core = [...coreMap().values()].filter((t) => t.scope === scope);
  const extra = [...lazy.values()].flatMap((l) => l.list()).filter((t) => t.scope === scope);
  return [...core, ...extra];
}

/** La cible d'une commande de la scene (ui/Hotspots.tsx, MIDI LEARN : on la touche, puis on bouge le controleur). */
export function targetIdOfHotspot(h: { kind: string; param?: string; rknob?: string; rpage?: string; inst?: string; index?: number; vpad?: number; vbtn?: string; vknob?: string; dj?: string; bass?: string }): string | null {
  switch (h.kind) {
    case 'encoder':
      return h.param ? `rytm:enc:${h.param}` : null;
    case 'penc':
      return typeof h.index === 'number' ? `rytm:knob:${h.index + 1}` : null;
    case 'pkey':
      return h.rpage ? `rytm:page:${h.rpage}` : null;
    case 'rknob':
      return h.rknob ? `rytm:kit:${h.rknob}` : null;
    case 'pad':
      return h.inst ? `rytm:pad:${h.inst}` : null;
    case 'step':
      return typeof h.index === 'number' ? `rytm:step:${h.index}` : null;
    case 'run':
    case 'clear':
    case 'random':
    case 'mute':
    case 'solo':
    case 'edit':
    case 'open':
      return `rytm:${h.kind}`;
    case 'vknob':
      return h.vknob ? `voy:knob:${h.vknob}` : null;
    case 'vpad':
      return typeof h.vpad === 'number' ? `voy:pad:${h.vpad}` : null;
    case 'vbtn':
      return h.vbtn ? `voy:${h.vbtn}` : null;
    case 'vopen':
      return 'voy:open';
    case 'djknob':
    case 'djfader':
    case 'djkey':
      return h.dj ? `dj:${h.dj}` : null;
    case 'bassknob':
      return h.bass ? `bass:knob:${h.bass}` : null;
    case 'basskey':
      return h.bass ? `bass:key:${h.bass}` : null;
    case 'basstrig':
      return h.bass ? `bass:trig:${h.bass}` : null;
    case 'basslock':
      return h.bass ? `bass:lock:${h.bass}` : null;
    default:
      return null;
  }
}
