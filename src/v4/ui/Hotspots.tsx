/**
 * Couche de saisie au-dessus du canvas (spec 6.2, 20.2.3 et 20.7) : un
 * seul element transparent (touch-action none) recoit les pointeurs et
 * interroge la liste explicite des objets interactifs (scene/hit.ts),
 * seulement aux evenements de pointeur et a la molette. La camera orbite
 * (scene/orbit.ts, sur le parent .v4-stage, qui voit chaque evenement
 * APRES cette couche). Regle du brief pour TOUS les objets, pads compris :
 * un objet ne part qu'au relachement, si le pointeur a bouge de moins de
 * 6 px depuis le pointerdown, sans second doigt, et si le relachement tombe
 * sur le meme objet (orbit.isTap) ; un glisser fait tourner la machine et
 * n'active jamais rien. Un appui lent et immobile part aussi (revue de la
 * revision 2, test T1 : la limite de 400 ms ne sert plus qu'a la double
 * tape du fond). Semantique :
 * - pads de voix (le son), pads de page (la section), pad OPEN, touches
 *   trig, RUN/STOP, CLEAR, puces du PCB : la tape ; une puce active son
 *   jumeau (un vrai lien : onglet ou navigation natifs) ;
 * - MASTER et TEMPO, dans l'ecran depuis le 2026-10-19 (lcd-master,
 *   lcd-tempo, kind rdial) : comme un bloc de l'ecran, un glisser de haut en
 *   bas (Maj : fin), la molette, deux tapes ou deux clics les remettent a leur
 *   depart ; tenus, ils se cernent (state/screenDials.ts) ; TEMPO dit sa
 *   valeur au pied de l'ecran (TEMPO 128 BPM), MASTER la sienne (MASTER 102
 *   -3.9 DB) ;
 * - encodeurs (les FX globaux) : un glisser parti
 *   d'eux les tourne et ne fait JAMAIS orbiter la vue (orbit.gate) ; l'axe
 *   dominant au seuil de 6 px decide (vers le haut ou vers la droite =
 *   plus ; TEMPO 100 px = 50 BPM, les autres 150 px = toute la course) ;
 *   au doigt, seulement apres 250 ms de repos sur lui : un glisser rapide
 *   qui en part fait tourner la vue (au telephone les encodeurs couvrent
 *   12 % de la machine, orbiter ne doit pas changer le tempo) ;
 *   molette au-dessus d'eux (1 BPM ou 2 % par cran), ailleurs elle zoome ;
 *   une tape ne change rien, une double tape = valeur de depart ;
 * - fond (ni objet ni machine) : une double tape (ou un double clic)
 *   ramene la vue par defaut.
 * Survol a la souris (jamais pendant une orbite) : curseur, LED du pas
 * survole, pad de page plus lumineux, puce soulevee. Les jumeaux HTML
 * (Twins, plus bas) portent le clavier et les lecteurs d'ecran, un par
 * objet. Un appui au pointeur ne leur donne pas le focus (et retire celui
 * d'un jumeau) : Espace reste RUN/STOP apres un clic, au lieu de rejouer le
 * dernier objet touche (section 19).
 *
 * Les verrous du MM-RYTM (2026-10-08, l'etape R2 des parameter locks, Mika :
 * "quand on clic sur un step on selectionne la partie qu'on veut modifier ...
 * on tourne un encoder sur ce step") :
 * - un pas tenu 350 ms sans glisser passe en LOCK (l'ecran le montre tout de
 *   suite) ; lache sans rien tourner, le LOCK reste (la souris peut ensuite
 *   tourner les potards) ; lache apres un potard tourne ou un glisser de
 *   velocite, il revient a ce qu'il etait (un LOCK momentane) ;
 * - au doigt, tenir un pas et tourner un potard de page d'un autre doigt
 *   verrouille tout de suite (plusieurs pas tenus : tous) ; le pincement ne
 *   prend plus ces pointeurs (orbit.claim) ; le lacher d'un pas qui a recu un
 *   verrou ne le change pas ;
 * - en LOCK, une tape sur un pas deplace le LOCK (le meme pas : il en sort),
 *   deux tapes sur un potard de page retirent son verrou.
 *
 * INFOS du MM-RYTM (2026-10-08, l'etape R4, state/rytmInfos.ts) : la touche i
 * de l'ecran (lcd-i) l'allume ou l'eteint ; allume, la souris survole (le
 * Stage passe la commande au store) et agit comme toujours ; au doigt, une
 * tape montre la carte de la commande au lieu de la jouer (un pad ne sonne
 * pas, un pas ne change pas), un glisser tourne toujours un potard (sa carte
 * suit), la tenue d'un pas ne met pas le LOCK (elle montre la carte du
 * pas) et un glisser sur un pas ne change pas sa velocite ; le pas reste
 * tenu pourtant : un encodeur tourne d'un autre doigt le verrouille (revue de
 * R4, la carte des pas le promet) ; pour naviguer, une touche de page tourne
 * quand meme la page et un pad choisit sa voix, sans un son (actions.ts
 * rytmInfoTap, la feuille de la carte et le Dock aussi : sinon les reglages
 * des autres pages et des autres voix ne se liraient pas au doigt).
 */

import React, { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import {
  anyDial,
  anyDialReset,
  anyDialValue,
  pageKnobReset,
  rytmLockEnter,
  rytmLockToggle,
  dialNudge,
  dialRange,
  dialReadout,
  pageKnobCourse,
  pageKnobLive,
  pageKnobOf,
  pageSlotOf,
  pageFxDetail,
  rytmFxOpen,
  rytmMenu,
  rytmPageKey,
  rytmScreenTab,
  globalDial,
  faceDialOf,
  faceKnob,
  faceKnobReset,
  knobBlock,
  revealPage,
  modeHold,
  MODE_HOLD_MS,
  chipAction,
  clearPattern,
  randomPattern,
  dial,
  dialSteps,
  dialValue,
  soundFamily,
  editToggle,
  presetKey,
  presetFaceKnob,
  focusMachine,
  gesture,
  muteToggle,
  openToggle,
  padHit,
  padMute,
  page,
  resetView,
  runToggle,
  soloToggle,
  stepClear,
  stepHoldHint,
  stepVelocity,
  stepVelocityOf,
  stepToggle,
  trkDown,
  trkStep,
  trkStepMute,
  trkUp,
  dialEdit,
  sceneDown,
  sceneUp,
  rytmInfoTap,
  voyClear,
  voyPad,
  voyPush,
  voyRandom,
  voyRun,
  kitDial,
  kitIdOf,
  lockMode,
  pageTarget,
  soundBrowserClose,
  soundBrowserCursor,
  soundBrowserOpen,
  soundBrowserPick,
  soundBrowserRemove,
  soundBrowserScroll,
  soundBrowserScrollTo,
  soundBrowserStep,
  soundBrowserView,
  soundDrop,
  xfadeGesture,
  xfadeSet,
  xfadeValue,
  type DialId,
} from '../actions';
import { samplesChanged, samplesVersion } from '../audio/samples';
import { BROWSER_ROWS, lcdSamples } from '../state/lcdSamples';
import { trk } from '../state/trk';
import { sceneCtl } from '../state/sceneCtl';
import type { HoldLatch } from '../state/holdLatch';
import { clock } from '../audio/clock';
import { learnPick, midi } from '../midi/midi';
import { targetIdOfHotspot } from '../midi/targets';
import { KIT_ARIA, KIT_PLATE_IDS, isFamily, kit, kitSteps, type KitId } from '../audio/kit';
import { mix } from '../audio/drums';
import { VOICE_FX_DEFAULT, voiceFx } from '../audio/voicefx';
import { BPM, FX_SETTING_IDS, STEP_COUNT, isOn, pattern } from '../audio/pattern';
import type { HotspotKind, HotspotView } from '../scene/hit';
import { quadToUnit } from '../scene/quad';
import type { Stage } from '../scene/renderer';
import { djLoad, type DjModules } from '../state/djload';
import { bassLoad, type BassModules } from '../state/bassload';
import { djView } from '../dj/view';
import { editor } from '../state/editor';
import { patterns, slotName } from '../state/patterns';
import { rytmPage } from '../state/rytmPage';
import { screenDials, type ScreenDialId } from '../state/screenDials';
import { lcdMessage } from '../state/lcdMessage';
import { encUnit } from '../rytm/values';
import { rytmLock } from '../state/rytmLock';
import { faceTouch } from '../state/ctl';
import { lockCount } from '../audio/locks';
import { HOME_MENU, HOME_MENU_LABEL, SCREEN_TITLE, isRytmPage, isRytmScreen, pageLabel } from '../rytm/pages';
import { v127 } from '../rytm/values';
import { PRESET_KEYS_OFF, PRESET_KEYS_ON, presetMode, type PresetKey } from '../state/presetMode';
import { chipsLive, explode } from '../state/explode';
import { MACHINES, focus, VOYAGER } from '../state/focus';
import { MidiLearnLayer } from './MidiPanel';
import { OverviewHelp } from './OverviewHelp';
import { overviewHover } from '../state/overviewHover';
import { section } from '../state/section';
import { view } from '../state/view';
import { voices } from '../state/voices';
import { voyKnob, type VoyKnobId } from '../voyager/params';
import { voyEcho } from '../voyager/echo';
import { voyInfoIdOf } from '../voyager/infoIds';
import { voyInfos } from '../state/voyInfos';
import { rytmInfos } from '../state/rytmInfos';
import { isRytmInfoHotspot } from '../rytm/infoIds';
import { isSwitch } from '../voyager/theme';
import { EXTERNAL_REL } from './ExternalLink';
import { SWIPE, eventTime, isSwipe, mayBeSwipe, swipeable, type SwipeHandBack } from './swipe';
import {
  BLOCKS_ARE_KNOBS,
  BOARD_CHIPS,
  COARSE_QUERY,
  DIAL_FINE,
  DIAL_KEYS,
  ENCODERS,
  FACE_FOLLOWS_PAGE,
  FACE_INERT,
  SCREEN_TOUCH,
  FACE_KNOBS,
  FACE_TITLE,
  GLOBAL_ENCODERS,
  GLOBAL_ENC_LABELS,
  INST_NAMES,
  PAGE_KNOB_IDS,
  PAGE_KNOB_LETTERS,
  RYTM_PAGE_KEYS,
  isPageKnob,
  pageKnobIndex,
  OPEN_ARIA,
  ORBIT,
  PADS,
  PAD_ARIA,
  PAD_DOUBLE_TAP_MS,
  PORTRAIT,
  POT_UI,
  potMin,
  isBipolar,
  isVoiceEnc,
  STEP_HOLD_MS,
  TEMPO_UI,
  TWIN_ARIA,
  XFADE_UI,
  isPage,
  swingRatio,
  type ChipId,
  type EncId,
  type Inst,
  type SectionId,
} from '../theme';

const STEP_INDEXES = Array.from({ length: STEP_COUNT }, (_, i) => i);

interface Props {
  getStage: () => Stage | null;
  /** le Stage monte : la couche y branche la garde des encodeurs (orbit.gate) */
  stage: Stage | null;
}

/** Un pointeur pose : l'objet sous lui au pointerdown (ou le fond), en attente de son relachement. */
interface Down {
  /** id de l'objet, null = le fond */
  id: string | null;
  kind: HotspotKind | null;
  inst?: Inst;
  index?: number;
  section?: SectionId;
  chip?: ChipId;
  /** MM-VOYAGER : pad d'accord, CLEAR ou RANDOM */
  vpad?: number;
  vbtn?: 'run' | 'clear' | 'random' | 'edit';
  /** MM-ARP : le reglage d'un bouton poussoir (SUB OCT, 2026-10-11 ; CHORUS, 2026-10-12) */
  vknob?: VoyKnobId;
  lcd?: PresetKey;
  /** une touche de page du MM-RYTM (2026-10-08) */
  rpage?: string;
  x: number;
  y: number;
  /** encodeur (ou potard du MM-VOYAGER, v:<id>) sous le pointerdown, et sa valeur de depart */
  dial: DialId | null;
  v0: number;
  /** reglage fin (Maj) en cours, et la course a laquelle il a ete pris ou lache */
  fine: boolean;
  a: number;
  /** la garde l'a pris : glisser parti de l'encodeur, qui le tourne */
  turning: boolean;
  /** axe dominant au seuil : y (vers le haut = plus) ou x (vers la droite = plus) */
  axis: 'x' | 'y';
  /** pointeur souris : le curseur suit l'axe pendant qu'il tourne */
  mouse: boolean;
  /**
   * un doigt (pointerType touch, 2026-10-22, la revue) : lui seul peut etre le glisser d'une machine a l'autre parti
   * d'une commande ; un stylet orbite seul (scene/orbit.ts), une commande qui l'attendait laissait tourner la vue
   */
  touch: boolean;
  /** instant du pointerdown (performance.now) */
  t: number;
  /** l'horodatage de l'evenement pointerdown (e.timeStamp) : la tenue d'un pas se mesure d'un evenement a l'autre */
  ts: number;
  /** celui du dernier pointermove (2026-10-21, ui/swipe.ts) : la garde du glisser d'une machine a l'autre le lit */
  moveTs: number;
  /** un autre doigt etait pose (pincement, rotation) : jamais un glisser d'une machine a l'autre */
  multi: boolean;
  /** un pas : sa velocite au pointerdown (0 vide) ; le glisser la change (velDrag) */
  vel0: number;
  velDrag: boolean;
  /**
   * un pas du MM-RYTM tenu (2026-10-08) : tenu dans state/rytmLock.ts ;
   * lockHold, la tenue l'a mis en LOCK ; writes0, les verrous poses avant lui ;
   * prevLock, le LOCK fixe d'avant (-1 aucun), rendu au lacher d'un LOCK momentane
   */
  held: boolean;
  lockHold: boolean;
  /**
   * INFOS du MM-RYTM allume, un doigt sur une de ses commandes (R4) : une tape
   * montre sa carte ; sur un pas, ni LOCK a la tenue ni velocite au glisser
   * (revue de R4), mais le pas reste tenu : deux doigts verrouillent toujours
   */
  info: boolean;
  writes0: number;
  prevLock: number;
  /** un potard : le LOCK au debut de son glisser (un changement le fait repartir de la valeur du moment) */
  lockKey: string;
  /** un potard : la course du dernier mouvement (2026-10-27, la fonction d'un potard de la face qui change sous la main) */
  lastTravel?: number;
  /** V.4.2 (2026-10-27) : les presets ouverts, un potard de la face les fait defiler ; les crans deja partis de ce glisser */
  pstep?: number;
  /** un pas pris par TRK (2026-10-27) : sa voix choisie a l'appui, ni P-LOCK, ni velocite, ni tape au lacher */
  trk?: boolean;
  /** la touche TRK tenue par ce pointeur : sa source ('ptr:<pointerId>'), lachee au pointerup ou perdue */
  trkSrc?: string;
  /** SCENE A ou B tenue par ce pointeur (2026-10-27) : laquelle et sa source, lachee au pointerup ou perdue */
  scene?: 'a' | 'b';
  sceneSrc?: string;
  /**
   * le crossfader pris par ce pointeur (2026-10-27, P2-20) : x au debut, l'axe de sa course a l'ecran (unitaire, de A vers
   * B) et sa longueur en px ; un glisser le long de l'axe le deplace d'autant (relatif : jamais de saut a la prise)
   */
  xf?: { v0: number; ux: number; uy: number; len: number };
  /**
   * un bloc de l'ecran du telephone (2026-10-09), au doigt, glisse a
   * l'horizontale : ce n'est pas encore un reglage (il se regle de haut en
   * bas), peut-etre le glisser d'une machine a l'autre ; il le reste tant
   * qu'il va de cote dans le temps d'un glisser (la garde de l'orbite) ;
   * depuis le 2026-10-21 (audit, ui/swipe.ts) tout potard et tout pas au
   * telephone aussi
   */
  swipe: boolean;
  /** MUTE ou SOLO tenu MODE_HOLD_MS (2026-10-09) : toutes les voix sont revenues, le lacher ne fait rien de plus ; une ligne du navigateur tenue (2026-10-18) : elle est armee pour partir */
  holdFired?: boolean;
  /**
   * le navigateur des sons (2026-10-18) : sa premiere ligne montree au pointerdown et la hauteur d'une ligne a l'ecran
   * (px CSS) ; un glisser la fait defiler d'autant
   */
  sbTop?: number;
  rowPx?: number;
}

/** Un bloc de l'ecran glisse a l'horizontale (1.4 fois plus qu'a la verticale, comme SWIPE) : le glisser de machine. */
const BLOCK_SWIPE_RATIO = 1.4;

/** Tenir un pas du MM-RYTM (2026-10-08) : le LOCK, comme un trig tenu d'une Elektron (et le MM-BASS). */
const LOCK_HOLD_MS = 350;
/**
 * Ce que regle un potard de page en ce moment, pour ceux qui tournent (lu a
 * chaque mouvement) : le LOCK, et depuis la revue du 2026-10-09 la page et la
 * voix (un bloc tenu au telephone pendant qu'un autre doigt, ], le MIDI
 * changent de page ou de voix : il repart de la valeur du nouveau reglage, il
 * ne saute pas a celle de l'ancien plus la course).
 */
const lockKeyNow = (): string => {
  const l = rytmLock.get();
  return `${l.step}|${l.held.join(',')}|${rytmPage.screen(pattern.get().instrument)}|${pattern.get().instrument ?? '-'}`;
};

/**
 * La molette acceleree (2026-10-09, 69-common2 point 1 : "comme un encodeur
 * Elektron") : un cran a la fois quand on tourne doucement, jusqu'a six quand
 * les crans arrivent a moins de 40 ms l'un de l'autre ; Maj : toujours un.
 */
const WHEEL_ACCEL = { fastMs: 40, slowMs: 140, max: 6 } as const;
function wheelGain(dt: number, fine: boolean): number {
  if (fine || !(dt < WHEEL_ACCEL.slowMs)) return 1;
  if (dt <= WHEEL_ACCEL.fastMs) return WHEEL_ACCEL.max;
  const t = (WHEEL_ACCEL.slowMs - dt) / (WHEEL_ACCEL.slowMs - WHEEL_ACCEL.fastMs);
  return Math.max(1, Math.round(1 + t * (WHEEL_ACCEL.max - 1)));
}

/** Une tape sur un bloc ou un encodeur ne compte que si l'appui a dure moins que ca (69-common2 point 1 : un glisser rapide n'en est pas une). */
const TAP_MAX_MS = 320;

/**
 * Le temps tenu depuis le pointerdown : l'horodatage de l'evenement en cours (le pointerup) moins celui de l'appui, sinon
 * l'horloge des gestionnaires (2026-10-27, la revue).
 */
function pressSince(d: { t: number; ts: number }): number {
  const up = typeof window !== 'undefined' ? (window as { event?: Event }).event?.timeStamp : undefined;
  return typeof up === 'number' && up > 0 && up >= d.ts ? up - d.ts : performance.now() - d.t;
}

/** Au doigt, une ligne du navigateur des sons tenue ce temps (un sample de ce navigateur) : REMOVE? TAP AGAIN (2026-10-18). */
const SB_HOLD_MS = 600;

/** INFOS du MM-RYTM allume (R4) et une de ses commandes, sur lui : au doigt, elle montre sa carte. */
const rytmInfoTouch = (id: string): boolean => rytmInfos.isOn() && focus.get() === 'mm808' && isRytmInfoHotspot(id);

/** La velocite d'un pas au glisser : un cran tous les 12 px (souris), 16 px (doigt) ; vers le haut, plus fort. */
const VEL_PX = { mouse: 12, touch: 16 } as const;
/** Un pas vide qu'on glisse part de MID. */
const VEL_FROM_EMPTY = 6;

/*
 * Glisser d'une machine a l'autre au telephone (2026-10-03) : SWIPE et sa garde sur les commandes (2026-10-21, audit :
 * un glisser parti d'un potard, d'un pas, d'une commande du MIXER le prend aussi) dans ui/swipe.ts.
 */

/** Jumeaux montes, par id de hotspot : la couche de saisie active ceux des puces. */
const twinEls = new Map<string, HTMLElement>();

/**
 * Puce touchee sur le canvas : son jumeau est active (LABEL : lien vers la
 * page Bandcamp du label en nouvel onglet ; LIVE, STUDIO et MERCH : boutons de
 * leur section), le geste en cours donne l'activation utilisateur ; sans
 * jumeau, l'action directe.
 */
function activateChip(id: string, chip: ChipId): void {
  const el = twinEls.get(id);
  if (el) el.click();
  else chipAction(chip, id.startsWith('vchip-') ? 'voy' : 'mm808');
}

/** Les jumeaux des puces du MM-VOYAGER s'inscrivent ici aussi (ui/VoyTwins.tsx). */
export function registerTwin(id: string, el: HTMLElement | null): void {
  if (el) twinEls.set(id, el);
  else twinEls.delete(id);
}

const isVoy = (k: DialId): boolean => k.startsWith('v:');
/** Un TWEAK du MM-RYTM (audio/kit.ts, 2026-10-04) : ses potards de 0 a 1, ses choix de son a trois crans. */
const isKit = (k: DialId): boolean => k.startsWith('r:');
/** Crans d'un potard du MM-ARP (0 : continu, le morphing de WAVE aussi) ou d'un TWEAK du MM-RYTM. */
const voySteps = (k: DialId): number => {
  // SAMPLE (2026-10-05) : un cran par son de la voix selectionnee
  if (k === 'vsound') return dialSteps(k);
  const r = kitIdOf(k);
  if (r) return kitSteps(r);
  if (!isVoy(k)) return 0;
  const vk = voyKnob(k.slice(2) as VoyKnobId);
  return vk.morph ? 0 : (vk.steps?.length ?? 0);
};

/**
 * Le potard d'une cible : un encodeur de la 808, un potard du MM-ARP, un
 * TWEAK du MM-RYTM, un bloc de l'ecran du MM-RYTM (lcd-blk-<k> : p:<k>, le
 * bloc k de l'ecran affiche ; au telephone depuis le 2026-10-09, au desktop
 * aussi depuis l'etape 2 du meme jour, Mika : "j'aimerais autant en mobile
 * qu'en desktop pouvoir modifier les choses directement sur l'ecran") ; un
 * encodeur du desktop (penc-<k>) : son FX global a poste fixe (theme.ts
 * GLOBAL_ENCODERS, Mika : "ils ne servent qu'a faire les modifs des FX
 * globaux de la machine").
 */
const dialOf = (h: HotspotView | null | undefined): DialId | null =>
  !h
    ? null
    : (h.kind === 'encoder' || h.kind === 'rdial') && h.param
      ? h.param
      : h.kind === 'penc' && h.index !== undefined
        ? // Les potards de la face (2026-10-27) : au desktop la fonction de la page posee sur leur case (actions.ts
          // faceDialOf, p:<bloc>) ; au telephone leur FX global
          faceDialOf(h.index)
        : h.kind === 'rblock' && h.index !== undefined
          ? (`p:${h.index}` as DialId)
        : h.kind === 'vknob' && h.vknob
          ? (`v:${h.vknob}` as DialId)
          : h.kind === 'rknob' && h.rknob
            ? (`r:${h.rknob}` as DialId)
            : null;

/**
 * Valeur par px de glisser : TEMPO 2 px par BPM, les autres 150 px la course
 * (TONE : 2 unites) ; un potard de page, 150 px la course de ce qu'il regle
 * sur la page affichee (relatif : partie de sa valeur, jamais de saut).
 */
const perPx = (k: DialId): number => {
  if (pageKnobOf(k) >= 0) {
    const [lo, hi] = dialRange(k);
    return (hi - lo) / POT_UI.pxRange;
  }
  return isVoy(k) || isKit(k) ? 1 / POT_UI.pxRange : k === 'tempo' ? 1 / TEMPO_UI.pxPerBpm : (1 - potMin(k as EncId)) / POT_UI.pxRange;
};

/**
 * L'encodeur d'un glisser qui le tient : valeur de depart + ecart sur son
 * axe, depuis le pointerdown. Maj tenue : dix fois plus fin (DIAL_FINE,
 * comme dans Ableton) ; prise ou lachee en cours de geste, la course repart
 * de la valeur du moment, sans saut.
 */
/** Les presets ouverts au desktop (V.4.2) : un potard de la face tourne, un preset par PRESET_PX de glisser. */
const PRESET_PX = 24;

function turnDial(d: Down, dx: number, dy: number, fine: boolean): void {
  if (!d.dial) return;
  const travel = d.axis === 'y' ? -dy : dx;
  // L'ecran ne se touche plus (V.4.2, 2026-10-27) : les presets ouverts, un potard de la face les fait defiler (actions.ts
  // presetFaceKnob), il ne regle pas sa page en cachette
  if (d.kind === 'penc' && d.index !== undefined && !SCREEN_TOUCH && presetMode.on('mm808')) {
    const n = Math.trunc(travel / PRESET_PX);
    if (n !== (d.pstep ?? 0)) {
      presetFaceKnob(d.index, n - (d.pstep ?? 0));
      d.pstep = n;
    }
    return;
  }
  // Le LOCK a change pendant que le potard de page tourne (2026-10-08 : le pas tenu lache avant lui, ou le
  // premier verrou qui met le LOCK) : il repart de la valeur qu'il regle maintenant, sans saut
  const lk = pageKnobOf(d.dial) >= 0 ? lockKeyNow() : d.lockKey;
  // Un potard de la face du desktop (2026-10-27) : la fonction de sa case peut changer sous la main (une touche de page,
  // une voix, le MIDI) ; il repart alors de la valeur de la nouvelle, sans saut
  const pencId = FACE_FOLLOWS_PAGE && d.kind === 'penc' && d.index !== undefined ? faceDialOf(d.index) : null;
  if (pencId && pencId !== d.dial) {
    d.dial = pencId;
    d.lockKey = '';
  }
  if (fine !== d.fine || lk !== d.lockKey) {
    // D'ou repart le glisser : la valeur de la scene armee (2026-10-27), sinon la base (ou le verrou en P-LOCK)
    d.v0 = dialEdit(d.dial);
    // Un potard de la face dont la fonction a change (2026-10-27) : la course repart du dernier mouvement vu, aucun pixel
    // de la main ne se perd
    d.a = pencId && fine === d.fine && d.lastTravel !== undefined ? d.lastTravel : travel;
    d.fine = fine;
    d.lockKey = lk;
  }
  const v = d.v0 + (travel - d.a) * perPx(d.dial) * (fine ? DIAL_FINE.drag : 1);
  d.lastTravel = travel;
  // Un potard de la face : la page au desktop (2026-10-27), son FX global et son popup au telephone
  if (d.kind === 'penc' && d.index !== undefined) faceKnob(d.index, v, 'ptr');
  // MASTER ou TEMPO dans l'ecran (2026-10-19) : la valeur, et TEMPO la dit au pied
  else if (d.kind === 'rdial') screenDialSet(d.dial, v);
  else anyDial(d.dial, v);
}

/**
 * MASTER ou TEMPO regle depuis l'ecran (2026-10-19) : la valeur (MASTER ecrit
 * deja la sienne au pied : MASTER 102 -3.9 DB) ; TEMPO la sienne aussi, TEMPO
 * 128 BPM (son potard d'avant ne disait rien : le nombre etait deja en haut de
 * l'ecran, sous le doigt maintenant).
 */
function screenDialSet(k: DialId, v: number): void {
  anyDial(k, v);
  if (k === 'tempo') lcdMessage.show(`TEMPO ${pattern.get().bpm} BPM`, POT_UI.readoutMs, true);
}

interface Point {
  clientX: number;
  clientY: number;
}

/**
 * Le jumeau d'une touche a tenir ou a taper (2026-10-27, la phase 2 : TRK ; SCENE A et B ensuite) : un bouton aria-pressed.
 * Espace ou Entree l'enfonce (sans repetition) ; son lacher, lu sur la fenetre (le focus peut etre parti, un pas clique a
 * la souris pendant la tenue), la lache, sans clic de synthese. Un clic sans clavier (detail 0 : un lecteur d'ecran, une aide
 * technique) : une tape, la touche se garde. La fenetre qui perd le focus oublie la touche tenue (state/trk.ts la lache).
 */
interface HoldTwinProps {
  id: string;
  twin: string;
  label: string;
  latch: HoldLatch;
  refFn: (el: HTMLElement | null) => void;
  down: (src: string, t: number) => void;
  up: (src: string, t: number) => void;
}
const HOLD_KEYS: ReadonlySet<string> = new Set([' ', 'Enter']);
/** Un clic venu du clavier (Entree, Espace) dans ce delai apres une touche : pas une aide technique. */
const HOLD_CLICK_MS = 500;
function HoldTwin({ id, twin, label, latch, refFn, down, up }: HoldTwinProps): React.ReactElement {
  const pressed = useSyncExternalStore(latch.subscribe, latch.engaged);
  const held = useRef<(() => void) | null>(null);
  const keyAt = useRef(-Infinity);
  useEffect(() => () => held.current?.(), []);
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (!HOLD_KEYS.has(e.key)) return;
    e.preventDefault();
    keyAt.current = performance.now();
    if (e.repeat || held.current) return;
    const key = e.key;
    const onUp = (ev: KeyboardEvent): void => {
      if (ev.key !== key) return;
      ev.preventDefault();
      keyAt.current = performance.now();
      off();
      up('key', ev.timeStamp || performance.now());
    };
    const off = (): void => {
      window.removeEventListener('keyup', onUp, true);
      window.removeEventListener('blur', off);
      held.current = null;
    };
    window.addEventListener('keyup', onUp, true);
    window.addEventListener('blur', off);
    held.current = off;
    down('key', e.timeStamp || performance.now());
  };
  return (
    <button
      ref={refFn}
      type="button"
      className="v4-twin"
      data-twin={twin}
      data-hotspot={id}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onKeyDown={onKeyDown}
      onKeyUp={(e) => {
        if (HOLD_KEYS.has(e.key)) e.preventDefault();
      }}
      onClick={(e) => {
        if (e.detail !== 0 || performance.now() - keyAt.current < HOLD_CLICK_MS) return;
        const t = performance.now();
        down('at', t);
        up('at', t);
      }}
    />
  );
}

/** Ce que dit le jumeau du crossfader (v de 0 a 127) : Scene A, Centre, Scene B, ou ce qu'on entend de chacune. */
export function xfadeText(v: number): string {
  if (v <= 0) return 'Scene A';
  if (v >= 127) return 'Scene B';
  const b = Math.round((v / 127) * 100);
  return b === 50 ? 'Centre' : `A ${100 - b} %, B ${b} %`;
}

/**
 * Le jumeau du crossfader (2026-10-27, P2-20) : un curseur natif de 0 a 127 NON CONTROLE (React ne le rend jamais pendant
 * un geste), entre SCENE A et SCENE B dans l'ordre de tabulation ; ses fleches, Page haut et bas, Debut et Fin sont celles
 * du navigateur. Un input le pose (le geste commence a la premiere valeur), change, keyup et blur le finissent. Les
 * autres sources (le glisser 3D, la molette, le MIDI) le recalent une fois par image, a la main (value, aria-valuetext).
 */
function XfadeTwin({ refFn }: { refFn: (el: HTMLElement | null) => void }): React.ReactElement {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let raf = 0;
    let on = false;
    const show = (): void => {
      const v = Math.round(sceneCtl.x() * 127);
      if (Number(el.value) !== v) el.value = String(v);
      el.setAttribute('aria-valuetext', xfadeText(v));
    };
    show();
    const offX = sceneCtl.onX((_x, src) => {
      if (src === 'twin') {
        el.setAttribute('aria-valuetext', xfadeText(Number(el.value)));
        return;
      }
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        show();
      });
    });
    const end = (): void => {
      if (!on) return;
      on = false;
      xfadeGesture('end', 'twin');
    };
    const onInput = (): void => {
      if (!on) {
        on = true;
        xfadeGesture('start', 'twin');
      }
      xfadeSet(Number(el.value) / 127, 'twin');
    };
    el.addEventListener('input', onInput);
    el.addEventListener('change', end);
    el.addEventListener('keyup', end);
    el.addEventListener('blur', end);
    return () => {
      offX();
      if (raf) cancelAnimationFrame(raf);
      end();
      el.removeEventListener('input', onInput);
      el.removeEventListener('change', end);
      el.removeEventListener('keyup', end);
      el.removeEventListener('blur', end);
    };
  }, []);
  return (
    <input
      ref={(el) => {
        ref.current = el;
        refFn(el);
      }}
      type="range"
      className="v4-twin"
      data-twin="xfade"
      data-hotspot="xfade"
      min={0}
      max={127}
      step={1}
      defaultValue={Math.round(sceneCtl.x() * 127)}
      aria-label={TWIN_ARIA.xfade}
      aria-valuetext={xfadeText(Math.round(sceneCtl.x() * 127))}
      title={FACE_TITLE.xfade}
    />
  );
}

/** Revue : le dernier relachement juge par la couche de saisie. */
/** renders : les rendus React de la couche (2026-10-27, le budget des scenes : aucun par mouvement du crossfader) */
export const hitDebug = { lastUp: { id: null as string | null, tap: false, fired: null as string | null, bg: false }, bgResets: 0, renders: 0 };

export const HitLayer: React.FC<Props> = ({ getStage, stage }) => {
  const ref = useRef<HTMLDivElement>(null);
  hitDebug.renders += 1;

  useEffect(() => {
    const el = ref.current;
    if (!el || !stage) return undefined;
    const coarseMql = window.matchMedia(COARSE_QUERY);
    let disposed = false;
    /** pointerId -> l'objet (ou le fond) sous son pointerdown */
    const downs = new Map<number, Down>();
    let hover: string | null = null;
    /** derniere tape par encodeur (double tape = remise a la valeur de depart) */
    const lastTap = new Map<DialId, number>();
    /** derniere tape du fond (double tape = vue par defaut) */
    let lastBg: { t: number; x: number; y: number } | null = null;
    let wheelAcc = 0;
    let wheelKind: DialId | null = null;
    /** la molette au-dessus du navigateur des sons (2026-10-18) : ses petits deltas s'accumulent */
    let sbWheel = 0;
    /** l'instant du dernier cran de molette (l'acceleration, 2026-10-09) */
    let wheelAt = -Infinity;
    /** vue d'ensemble, ou le bout de la voisine : une machine sous la souris (curseur doigt, un clic zoome) */
    let hoverMachine = false;
    /** sous la souris, la machine qu'on utilise (ou une qui joue) : la vue n'en part pas, curseur normal (2026-10-05) */
    let overLocked = false;
    /** le bout de la machine voisine est survole : il sort un peu */
    let peeking = false;
    const setPeek = (on: boolean): void => {
      if (on === peeking) return;
      peeking = on;
      stage.setPeekHover(on);
    };
    /** Maj tenue au dernier mouvement du pointeur (reglage fin des potards) */
    let shiftHeld = false;
    /** la molette au-dessus du crossfader (P2-20) : ses petits deltas, et la fin du geste 120 ms apres le dernier cran */
    let xfWheel = 0;
    let xfWheelTimer = 0;
    /** la souris glisse le crossfader : le curseur de gauche a droite */
    let turnXf = false;
    // Le rectangle ne change qu'au redimensionnement : pas de lecture de
    // mise en page a la cadence du pointeur
    let rect = el.getBoundingClientRect();
    const ro = new ResizeObserver(() => {
      rect = el.getBoundingClientRect();
    });
    ro.observe(el);

    // Le MM-DECKS : ses commandes prennent le pointeur des le pointerdown (dj/gestures.ts) ;
    // son code arrive a part (state/djload.ts) : les gestes naissent quand le rig est la
    let djg: InstanceType<DjModules['DjGestures']> | null = null;
    const djGestures = (): typeof djg => {
      if (!djg && stage.dj) {
        const m = djLoad.get();
        if (m) djg = new m.DjGestures(stage);
      }
      return djg;
    };
    // Tout type de zone du MM-DECKS (djknob, djfader, djkey, djjog, djscreen...)
    const isDj = (k: HotspotKind): boolean => k.startsWith('dj');
    // Le MM-BASS (2026-10-07) : le meme contrat (bass/gestures.ts), son code arrive a part aussi (state/bassload.ts)
    let bsg: InstanceType<BassModules['BassGestures']> | null = null;
    const bassGestures = (): typeof bsg => {
      if (!bsg && stage.bass) {
        const m = bassLoad.get();
        if (m) bsg = new m.BassGestures(stage);
      }
      return bsg;
    };
    const isBass = (k: HotspotKind): boolean => k.startsWith('bass');
    /** Les gestes de la machine d'une zone (MM-DECKS, MM-BASS), ou null. */
    const gesturesOf = (h: HotspotView | null): typeof djg | typeof bsg => (!h ? null : isDj(h.kind) ? djGestures() : isBass(h.kind) ? bassGestures() : null);
    /** Celui qui tient ce pointeur. */
    const holder = (id: number): typeof djg | typeof bsg => (djg?.holds(id) ? djg : bsg?.holds(id) ? bsg : null);
    // L'ecran de la suite du MM-ARP (2026-10-05, voyager/seqscreen.ts) : le point touche sur son verre (u, v), un dessin suit son pointeur
    const seqDrags = new Set<number>();
    const seqOut = { x: 0, y: 0 };
    const seqUv = (x: number, y: number): { u: number; v: number } | null => {
      const v = stage.voy;
      const sc = v?.seqScreen;
      if (!v || !sc) return null;
      const quad: number[] = [];
      for (const [px, py, pz] of sc.corners()) {
        const p = stage.hit.project(v.lid, px, py, pz, seqOut);
        quad.push(p.x, p.y);
      }
      return quadToUnit(quad, x, y);
    };

    /** La derniere tape au doigt sur un pad de voix (le double tape qui coupe la voix). */
    let lastPad: { inst: Inst; at: number } | null = null;
    const isCoarse = (e: PointerEvent): boolean =>
      e.pointerType === 'touch' || e.pointerType === 'pen' || coarseMql.matches;
    const pickAt = (e: Point, coarse: boolean): HotspotView | null =>
      stage.hit.pick(e.clientX - rect.left, e.clientY - rect.top, coarse);

    /** axe de l'encodeur que la souris tourne, null sinon */
    let turnAxis: 'x' | 'y' | null = null;
    /** la souris glisse un bloc de l'ecran (2026-10-09) : le curseur de haut en bas */
    let turnBlock = false;
    /**
     * Curseur : main ouverte par defaut (CSS), fermee pendant l'orbite,
     * doigt sur un objet, encodeurs compris, survoles ou tournes (2026-10-03,
     * Mika : "comme quand on hover un lien, je veux pas les deux fleches").
     */
    const setCursor = (): void => {
      // L'ecran du MM-BASS se glisse (2026-10-09, l'etape 2 : un bloc qui porte un reglage, le rouleau d'EDIT) : ns-resize ;
      // un bloc de l'ecran du MM-RYTM (2026-10-09, l'ecran est l'editeur) : la fleche de haut en bas, survole ou glisse
      const own = hover !== null && hover.startsWith('bass-') ? stage.bass?.cursor(hover) : null;
      el.style.cursor =
        turnAxis !== null
          ? turnBlock
            ? 'ns-resize'
            : turnXf
              ? 'ew-resize'
              : 'pointer'
          : stage.orbit.dragging
            ? 'grabbing'
            : hover === null
              ? hoverMachine
                ? 'pointer'
                : overLocked
                  ? 'default'
                  : ''
              : hover.startsWith('lcd-blk-') || hover === 'lcd-master' || hover === 'lcd-tempo'
                ? 'ns-resize'
                : // Un potard de la face du desktop (2026-10-27) : la fleche de haut en bas, la fleche seule sur une case vide
                  // ou un dessin (rien a tourner)
                  FACE_FOLLOWS_PAGE && hover.startsWith('penc-')
                  ? faceKnobTurns(Number(hover.slice(5)))
                    ? 'ns-resize'
                    : 'default'
                  : // Le crossfader (P2-20) : la fleche de gauche a droite ; une commande inerte de la face, la fleche
                  hover === 'xfade'
                  ? 'ew-resize'
                  : FACE_INERT.has(hover)
                    ? 'default'
                    : own ?? 'pointer';
    };
    const setHover = (h: HotspotView | null): void => {
      const id = h ? h.id : null;
      if (id !== hover) {
        hover = id;
        stage.setHover(id);
        // L'infobulle de la face V.4.0 du desktop (2026-10-27, Mika : "le nom complet dans l'infobulle") : sur la couche de
        // saisie, le temps du survol (au telephone, FACE_TITLE est vide)
        const tip = id !== null ? FACE_TITLE[id] : undefined;
        if (tip) el.title = tip;
        else if (el.title) el.removeAttribute('title');
      }
      setCursor();
    };

    const capture = (id: number): void => {
      try {
        el.setPointerCapture(id);
      } catch {
        /* evenement synthetique : pas de capture, sans consequence */
      }
    };

    /**
     * La page d'un FX global a ouvrir (2026-10-10, Mika : "quand je touche a un FX, par exemple DELAY, dans l'ecran, ca
     * doit afficher les configurations que je peux avoir pour DELAY") : une tape seule sur son bloc de GLOBAL FX l'ouvre,
     * une fois passe le temps d'une deuxieme tape (deux tapes : la remise, sur place) ; un bloc tenu entre-temps l'annule.
     */
    let fxOpenTimer = 0;
    const fxOpenCancel = (): void => {
      if (fxOpenTimer !== 0) window.clearTimeout(fxOpenTimer);
      fxOpenTimer = 0;
    };

    /** Deux tapes sur un encodeur en moins de 350 ms : sa valeur de depart (penc : l'encodeur k du desktop, son FX global). */
    const tapDial = (k: DialId, pressMs = 0, penc = -1, screenDial = false): void => {
      // Un commutateur (MODE du filtre) passe au cran suivant a chaque tape, et reboucle
      if ((isVoy(k) && isSwitch(k.slice(2) as VoyKnobId)) || (isKit(k) && voySteps(k) > 1)) {
        const n = voySteps(k);
        const i = Math.round(anyDialValue(k) * (n - 1));
        anyDial(k, ((i + 1) % n) / (n - 1));
        return;
      }
      // Un appui long immobile n'est pas une tape (2026-10-09) : il ne compte pas pour les deux tapes de la remise
      if (pressMs > TAP_MAX_MS) {
        lastTap.delete(k);
        return;
      }
      const t = performance.now();
      const pk = pageKnobOf(k);
      if (t - (lastTap.get(k) ?? -Infinity) <= TEMPO_UI.tapMs) {
        lastTap.delete(k);
        fxOpenCancel();
        // Un potard de la face (2026-10-27) : son bloc remis (en LOCK, son verrou s'en va) au desktop ; au telephone son FX
        // global remis comme il tourne, avec son popup GLOBAL a l'ecran (revue du 2026-10-09)
        if (penc >= 0) faceKnobReset(penc);
        // Un potard de page (2026-10-08) : en LOCK, son verrou s'en va ; sinon sa valeur de depart
        else if (pk >= 0) pageKnobReset(pk);
        else if (screenDial) screenDialSet(k, anyDialReset(k));
        else anyDial(k, anyDialReset(k));
      } else {
        lastTap.set(k, t);
        // Un FX de GLOBAL FX qui a sa page (2026-10-10 ; un FX de VOICE FX : sa page sous la voix) : elle s'ouvre si aucune deuxieme tape ne suit
        // (un bloc de l'ecran ; un potard de la face quand l'ecran ne se touche pas, V.4.2 2026-10-27 : sa tape fait ce que
        // faisait celle de son bloc, theme.ts SCREEN_TOUCH ; avant, une tape sur un potard n'ouvrait rien)
        const blockTap = pk >= 0 && (penc < 0 || !SCREEN_TOUCH);
        const fd = blockTap ? pageFxDetail(pk) : null;
        fxOpenCancel();
        if (fd)
          fxOpenTimer = window.setTimeout(() => {
            fxOpenTimer = 0;
            if (disposed || knobHeld() || pageFxDetail(pk) !== fd) return;
            lastTap.delete(k);
            rytmFxOpen(fd);
          }, TEMPO_UI.tapMs + 10);
        // Le nom du son (le bloc SOUND de VOICE, 2026-10-18, Mika : "difficile la selection des samples") : une tape seule
        // ouvre le navigateur des sons, passe le temps d'une deuxieme tape (deux tapes : SOUND revient a son depart)
        else if (blockTap && pageTarget(pk) === 'voice:sound')
          fxOpenTimer = window.setTimeout(() => {
            fxOpenTimer = 0;
            if (disposed || knobHeld() || pageTarget(pk) !== 'voice:sound') return;
            lastTap.delete(k);
            soundBrowserOpen();
          }, TEMPO_UI.tapMs + 10);
      }
    };

    /**
     * Une tape dans le navigateur des sons (2026-10-18) : une ligne joue son son (la ligne armee, REMOVE?, part ; + LOAD
     * A FILE... ouvre le choix des fichiers), le x d'un sample de ce navigateur l'arme puis le retire, PREV et NEXT
     * passent au son voisin ; une ligne tenue au doigt (deja armee) ne fait rien de plus a son lacher.
     */
    const sbTap = (d: Down): void => {
      const id = d.id ?? '';
      if (d.holdFired) return;
      if (id === 'lcd-sb-prev') soundBrowserStep(-1);
      else if (id === 'lcd-sb-next') soundBrowserStep(1);
      else {
        const m = /^lcd-sb-(row|del)-([0-9]+)$/.exec(id);
        const v = soundBrowserView();
        if (m && v) {
          const i = v.top + Number(m[2]);
          if (m[1] === 'del') soundBrowserRemove(i, d.mouse ? 'CLICK' : 'TAP');
          else soundBrowserPick(i);
        } else lcdSamples.touch();
      }
    };

    /** L'objet tape (relache sur lui, tape au sens du brief) part ; renvoie son id. */
    const fire = (d: Down): string | null => {
      // MM-ARP (2026-10-08) : la touche i du grand ecran allume ou eteint INFOS ; INFOS allume, au doigt, une tape montre la carte au lieu de jouer
      if (d.kind === 'vinfo') {
        voyInfos.toggle();
        return d.id;
      }
      if (!d.mouse && d.id && voyInfos.isOn() && voyInfoIdOf(d.id)) {
        voyInfos.show(d.id);
        return d.id;
      }
      // MM-RYTM (R4, 2026-10-08) : la touche i de son ecran ; INFOS allume, au doigt, une tape montre la carte
      if (d.kind === 'rinfo') {
        rytmInfos.toggle();
        return d.id;
      }
      // Le navigateur des sons (2026-10-18) : une ligne, son x, PREV, NEXT ; l'en-tete et le corps gardent la liste ouverte
      if (d.kind === 'sbrowse') {
        sbTap(d);
        return d.id;
      }
      // Un pas pris par TRK (2026-10-27) : sa voix est deja choisie, la tape ne part pas
      if (d.kind === 'step' && d.trk) return d.id;
      // Un pas tenu qui a recu un verrou (deux doigts, INFOS allume aussi) : ni change ni tape, la carte reste celle de l'encodeur
      if (d.kind === 'step' && d.lockHold) return d.id;
      // La carte, et la navigation sans un son (une touche de page tourne la page, un pad choisit sa voix : actions.ts)
      if (!d.mouse && d.id && rytmInfoTouch(d.id) && rytmInfoTap(d.id)) return d.id;
      // Le menu de la voix sous HOME (2026-10-18) : SOUND ouvre la liste des sons, VOICE FLTR ENV FX leur page ; apres la
      // carte (la relecture : INFOS allume, au doigt, une tape montre la carte et la commande n'agit pas)
      if (d.kind === 'rmenu' && d.id) {
        rytmMenu(d.id.slice('lcd-menu-'.length), stage);
        return d.id;
      }
      if (d.kind === 'pad' && d.inst) {
        // Double tape au doigt sur le meme pad (2026-10-10) : la voix se coupe ou revient (la premiere tape l'a choisie)
        const t = performance.now();
        if (!d.mouse && lastPad && lastPad.inst === d.inst && t - lastPad.at <= PAD_DOUBLE_TAP_MS) {
          lastPad = null;
          padMute(d.inst, stage);
        } else {
          lastPad = d.mouse ? null : { inst: d.inst, at: t };
          padHit(d.inst, stage);
        }
      }
      else if (d.kind === 'page' && d.section && isPage(d.section)) page(d.section, stage);
      else if (d.kind === 'open') openToggle(stage, 'mm808');
      else if (d.kind === 'step' && d.index !== undefined) {
        // Appui long : il montrait la velocite (2026-10-05 ; il vidait le pas avant) ; une tape change le pas
        // (en LOCK, elle deplace le LOCK, actions.ts stepToggle) ; une tenue du LOCK (2026-10-08) a deja tout fait
        if (d.lockHold) return d.id;
        if (stage.orbit.lastTap.ms < STEP_HOLD_MS) stepToggle(d.index, stage);
      }
      else if (d.kind === 'run') runToggle(stage);
      else if (d.kind === 'clear') clearPattern(stage);
      // MUTE et SOLO (2026-10-09) : tenus, toutes les voix sont deja revenues ; sinon l'appui suivant de la machine a etats
      else if ((d.kind === 'mute' || d.kind === 'solo') && d.holdFired) return d.id;
      else if (d.kind === 'mute') muteToggle(stage);
      else if (d.kind === 'solo') soloToggle(stage);
      else if (d.kind === 'random') randomPattern(stage);
      else if (d.kind === 'seek') stage.seekAt(d.x, d.y);
      else if ((d.kind === 'chip' || d.kind === 'vchip') && d.chip && d.id) activateChip(d.id, d.chip);
      else if (d.kind === 'vpad' && d.vpad !== undefined) voyPad(d.vpad, stage);
      else if (d.kind === 'vopen') openToggle(stage, 'voy');
      else if (d.kind === 'vbtn' && d.vbtn === 'clear') voyClear(stage);
      else if (d.kind === 'vbtn' && d.vbtn === 'random') voyRandom(stage);
      else if (d.kind === 'vbtn' && d.vbtn === 'run') voyRun(stage);
      else if (d.kind === 'vbtn' && d.vbtn === 'edit') editToggle('voy', stage);
      // Un bouton poussoir (SUB OCT, 2026-10-11 ; CHORUS, 2026-10-12) : le cran suivant, la touche s'enfonce
      else if (d.kind === 'vpush' && d.vknob) voyPush(d.vknob, stage);
      else if (d.kind === 'edit') editToggle('mm808', stage);
      // TRK (2026-10-27, la phase 2 : elle a agi a l'appui et au lacher), SCENE A et B, le crossfader (visibles et inertes) :
      // la tape est prise (pas de double tape du fond) et rien d'autre ne part
      else if (d.kind === 'trk' || d.kind === 'scene' || d.kind === 'xfade') return d.id;
      else if ((d.kind === 'lcd' || d.kind === 'vlcd') && d.lcd) presetKey(d.kind === 'lcd' ? 'mm808' : 'voy', d.lcd);
      // Les presets ouverts au desktop (V.4.2, 2026-10-27, l'ecran ne se touche plus) : la tape d'un potard de la face est
      // prise et ne fait rien (ni la page d'un FX, ni la liste des sons, cachees sous les presets) ; les actions passent par
      // les touches VOICE FLTR ENV FX EDIT (rytm/presetKeys.ts), tourner un potard fait defiler (actions.ts presetFaceKnob)
      else if (d.kind === 'penc' && d.index !== undefined && presetFaceKnob(d.index)) return d.id;
      // Un onglet de l'en-tete de l'ecran (2026-10-09) : son ecran, avant les touches de page (revue : l'onglet MAIN porte
      // l'id voice, qui est aussi une page ; pris pour la touche VOICE, il passait a SYNTH)
      else if (d.kind === 'pkey' && d.rpage && d.id?.startsWith('lcd-tab-') && isRytmScreen(d.rpage)) rytmScreenTab(d.rpage);
      else if (d.kind === 'pkey' && d.rpage && isRytmPage(d.rpage)) rytmPageKey(d.rpage, stage);
      // La tenue d'un potard d'un evenement a l'autre (2026-10-27, la revue : performance.now() lu dans les gestionnaires
      // comptait le fil pris par le premier geste, l'audio qui demarre, et la premiere tape passait pour un appui long)
      else if (d.dial) tapDial(d.dial, pressSince(d), d.kind === 'penc' && d.index !== undefined ? d.index : -1, d.kind === 'rdial');
      else return null;
      return d.id;
    };

    /** La liste glissee (2026-10-18) : elle suit le doigt, une ligne par hauteur de ligne (vers le bas : les lignes d'avant). */
    const sbDrag = (d: Down, dy: number): void => {
      if (!d.rowPx || d.rowPx <= 0) return;
      soundBrowserScrollTo((d.sbTop ?? 0) - Math.round(dy / d.rowPx));
    };

    /** Un pas glisse : sa velocite suit le doigt (vers le haut, plus fort). */
    const dragVelocity = (d: Down, dy: number): void => {
      if (d.index === undefined) return;
      const base = d.vel0 > 0 ? d.vel0 : VEL_FROM_EMPTY;
      const px = d.mouse ? VEL_PX.mouse : VEL_PX.touch;
      stepVelocity(d.index, base + Math.round(-dy / px));
    };

    /**
     * Le glisser d'une machine a l'autre (au telephone) : vers la gauche, la machine suivante ; vers la droite, la
     * precedente. Le MM-DECKS passe d'abord d'un bloc a l'autre (A, MIXER, B). Rend ce qui est parti (hitDebug).
     */
    const machineSwipe = (dx: number): string => {
      const dir = dx < 0 ? 1 : -1;
      const unit = focus.machine() === 'dj' ? djView.next(dir) : null;
      if (unit) {
        djView.set(unit);
        return `swipe-dj-${unit}`;
      }
      const cur = MACHINES.indexOf(focus.machine() ?? 'mm808');
      const to = MACHINES[Math.max(0, Math.min(MACHINES.length - 1, cur + dir))];
      // Vue tournee (2026-10-04) : le glisser l'a fait tourner aussi ; la machine suivante arrive de face
      if (view.get()) stage.orbit.reset();
      focusMachine(to);
      return `swipe-${to}`;
    };

    /** Tape sur le fond : la deuxieme en moins de 300 ms et 30 px ramene la vue par defaut. */
    const tapBackground = (e: PointerEvent): boolean => {
      const t = e.timeStamp || performance.now();
      if (lastBg && t - lastBg.t < ORBIT.bgTapMs && Math.hypot(e.clientX - lastBg.x, e.clientY - lastBg.y) < ORBIT.bgTapPx) {
        lastBg = null;
        hitDebug.bgResets += 1;
        resetView(stage);
        return true;
      }
      lastBg = { t, x: e.clientX, y: e.clientY };
      return false;
    };

    // Garde de l'orbite, appelee quand un pointeur passe 6 px : un glisser
    // parti d'un encodeur le tourne et n'orbite jamais (la couche le garde
    // jusqu'au relachement ; l'axe dominant a ce seuil devient le sien),
    // au doigt comme a la souris (un seul doigt ne tourne plus la vue,
    // 2026-10-01) ; tout le reste fait tourner la machine
    stage.orbit.gate = (pointerId, dx, dy) => {
      const d = downs.get(pointerId);
      // Un glisser parti d'un pas : sa velocite (2026-10-05), jamais l'orbite
      if (d && d.kind === 'step' && d.index !== undefined) {
        // Un pas pris par TRK (2026-10-27) : ni velocite, ni orbite, ni glisser d'une machine a l'autre
        if (d.trk) return false;
        // INFOS du MM-RYTM, au doigt (revue de R4) : une tape un peu glissee montre la carte du pas, sans rien y changer
        if (d.info) {
          if (d.id) rytmInfos.show(d.id);
          return false;
        }
        // Au telephone (2026-10-21, audit) : parti de cote et vite, c'est peut-etre le glisser d'une machine a l'autre
        // (ui/swipe.ts) ; avant, il changeait la velocite du pas, ou en posait un sur un pas vide. Au doigt seulement
        // (2026-10-22, la revue) : un stylet tient le pas, il ne se perd pas dans l'orbite
        if (!d.velDrag && !d.multi && swipeable(d.touch) && mayBeSwipe(dx, dy, d.moveTs - d.ts)) {
          d.swipe = true;
          return true;
        }
        d.swipe = false;
        d.velDrag = true;
        dragVelocity(d, dy);
        return false;
      }
      // Le navigateur des sons (2026-10-18) : un glisser parti de lui le fait defiler (au doigt comme a la souris, jamais
      // l'orbite) ; au doigt, parti a l'horizontale et vite, c'est le glisser d'une machine a l'autre (comme un bloc)
      if (d && d.kind === 'sbrowse') {
        if (!d.mouse && !d.multi && Math.abs(dx) > BLOCK_SWIPE_RATIO * Math.abs(dy) && performance.now() - d.t < SWIPE.ms) return true;
        d.turning = true;
        sbDrag(d, dy);
        if (d.mouse) {
          turnAxis = 'y';
          turnBlock = true;
          setCursor();
        }
        return false;
      }
      // TRK, SCENE A ou B tenue (2026-10-27) : le doigt ou la souris qui la tient ne fait pas tourner la vue
      if (d && (d.kind === 'trk' || d.kind === 'scene')) return false;
      // Le crossfader (P2-20) : le glisser le deplace, jamais l'orbite ; le premier mouvement compte deja (depuis la prise)
      if (d && d.kind === 'xfade') {
        if (!d.xf) return false;
        d.turning = true;
        xfMove(d, d.x + dx, d.y + dy, shiftHeld);
        if (d.mouse) {
          turnAxis = 'x';
          turnXf = true;
          setCursor();
        }
        return false;
      }
      if (!d || !d.dial) return true;
      // Un bloc de l'ecran du telephone (2026-10-09) : de haut en bas seulement, comme un potard ; parti a l'horizontale
      // au doigt, c'est peut-etre le glisser d'une machine a l'autre (le grand ecran couvre le haut de la face, il ne doit
      // pas le bloquer). Revue du 2026-10-09 : la garde le laisse faire tant qu'il reste a l'horizontale et dans le temps
      // d'un glisser (SWIPE.ms) ; sinon il redevient le reglage, repris de la valeur du moment (rien ne saute, et le geste
      // ne se perd plus). A la souris (une fenetre etroite), le chemin des encodeurs plus bas : son axe, son curseur.
      // MASTER et TEMPO dans l'ecran (2026-10-19, rdial) : de meme, ils sont en haut de l'ecran
      // Au doigt seulement, le glisser (2026-10-22, la revue) : au stylet, le bloc se regle tout de suite
      if ((d.kind === 'rblock' || d.kind === 'rdial') && !d.mouse) {
        if (d.touch && !d.multi && Math.abs(dx) > BLOCK_SWIPE_RATIO * Math.abs(dy) && performance.now() - d.t < SWIPE.ms) {
          d.swipe = true;
          return true;
        }
        if (d.swipe) {
          d.swipe = false;
          d.v0 = dialEdit(d.dial);
          d.a = -dy;
        }
        d.turning = true;
        d.axis = 'y';
        turnDial(d, dx, dy, shiftHeld);
        return false;
      }
      // Tout autre potard au doigt, au telephone (2026-10-21, audit : un glisser parti d'un potard du MM-ARP le tournait,
      // osc1, CUTOFF ou DELAY partaient a 0, et la machine ne changeait pas) : la meme garde que les blocs (ui/swipe.ts),
      // puis l'axe dominant, depuis la valeur du moment ; au doigt seulement (2026-10-22, la revue : un stylet qui
      // partait de cote faisait tourner la vue, le potard ne tournait jamais)
      if (!d.multi && swipeable(d.touch) && mayBeSwipe(dx, dy, d.moveTs - d.ts)) {
        d.swipe = true;
        return true;
      }
      const fromSwipe = d.swipe;
      d.swipe = false;
      d.turning = true;
      // Un bloc de l'ecran a la souris (2026-10-09) : de haut en bas seulement (150 px la course), le curseur le dit.
      // Le doigt qui n'est plus le glisser dans son temps (2026-10-22, la revue : reparti a la verticale, ou un deuxieme
      // doigt pose) : de haut en bas aussi, comme les blocs ; l'axe dominant de ce moment etait presque toujours x
      // (l'ecart y est encore de cote), et le geste vertical qui l'avait sorti ne tournait rien. Le temps passe : l'axe
      // dominant, comme avant
      d.axis =
        d.kind === 'rblock' || d.kind === 'rdial' || (fromSwipe && d.moveTs - d.ts < SWIPE.ms) ? 'y' : Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
      if (fromSwipe) {
        d.v0 = dialEdit(d.dial);
        d.a = d.axis === 'y' ? -dy : dx;
      }
      turnDial(d, dx, dy, shiftHeld);
      if (d.mouse) {
        turnAxis = d.axis;
        turnBlock = d.kind === 'rblock' || d.kind === 'rdial';
        setCursor();
      }
      return false;
    };

    const onDown = (e: PointerEvent): void => {
      // Clic droit sur un pad de voix du MM-RYTM (2026-10-10) : la voix se coupe ou revient (actions.ts padMute)
      if (e.pointerType === 'mouse' && e.button === 2) {
        rect = el.getBoundingClientRect();
        const hm = pickAt(e, false);
        if (hm && hm.kind === 'pad' && hm.inst && hm.enabled !== false) padMute(hm.inst, stage);
        // TRK engagee (2026-10-27) : un clic droit sur un pas 1 a 8 coupe sa voix ou la rend, sans la choisir
        else if (hm && hm.kind === 'step' && hm.index !== undefined) trkStepMute(hm.index, stage, e.timeStamp || performance.now());
        return;
      }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      gesture();
      // Le clavier reprend la ou il en etait, mais Espace redevient RUN/STOP
      const a = document.activeElement;
      if (a instanceof HTMLElement && a.classList.contains('v4-twin')) a.blur();
      rect = el.getBoundingClientRect();
      // Chaque pointeur est capture : un glisser continue d'orbiter hors du canvas
      capture(e.pointerId);
      const h = pickAt(e, isCoarse(e));
      // MIDI LEARN (2026-10-05) : la commande touchee attend le message du controleur ; elle ne joue pas. L'ecran intouchable
      // du desktop s'apprend quand meme au clic (2026-10-27, la revue : MASTER, TEMPO, le i et les onglets n'avaient plus
      // que la liste du panneau MIDI)
      const learning = midi.get().learn;
      const hl = learning && !SCREEN_TOUCH ? stage.hit.pick(e.clientX - rect.left, e.clientY - rect.top, isCoarse(e), true) : h;
      const learnId = hl && learning ? targetIdOfHotspot(hl) : null;
      if (learnId) {
        learnPick(learnId);
        try {
          if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        } catch {
          /* pointeur deja inactif */
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      // L'ecran de la suite du MM-ARP : un toucher (un accord, AUTO, EDIT, STEPS, une note), ou un dessin
      if (h && h.kind === 'vseq') {
        if (e.pointerType !== 'mouse' && voyInfos.isOn()) {
          voyInfos.show(h.id);
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        const uv = seqUv(e.clientX - rect.left, e.clientY - rect.top);
        if (uv && stage.voy?.seqScreen?.down(uv.u, uv.v)) seqDrags.add(e.pointerId);
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      // Une commande du MM-DECKS : elle seule voit ce pointeur (ni orbite ni pincement)
      const g = gesturesOf(h);
      if (h && g) {
        // Seul pointeur pose, au doigt, au telephone : ce potard peut encore etre le glisser d'une machine a l'autre (ui/swipe.ts)
        g.down(e.pointerId, h, e.clientX - rect.left, e.clientY - rect.top, isCoarse(e), downs.size === 0 && swipeable(e.pointerType !== 'mouse') ? eventTime(e) : -1);
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      const encoder: DialId | null =
        dialOf(h);
      // Le grand ecran du MM-ARP (2026-10-08) : l'echo du potard tenu reste tant qu'on le tient (une prise par pointeur)
      if (encoder && isVoy(encoder)) {
        voyEcho.hold(e.pointerId, encoder.slice(2) as VoyKnobId);
        // INFOS allume, au doigt : la carte passe au potard qu'on prend, qu'on le tape ou qu'on le tourne (la carte suit)
        if (h && e.pointerType !== 'mouse' && voyInfos.isOn() && voyInfoIdOf(h.id)) voyInfos.show(h.id);
      }
      // INFOS du MM-RYTM (R4), au doigt : la carte passe au potard qu'on prend (page, MASTER, TEMPO, TWEAKS), qu'on le
      // tape ou qu'on le tourne (la carte suit)
      if (encoder && h && e.pointerType !== 'mouse' && rytmInfoTouch(h.id)) rytmInfos.show(h.id);
      // Un deuxieme doigt : ni l'un ni l'autre ne glisse d'une machine a l'autre. Un doigt deja pose qui allait de cote
      // sur une commande (2026-10-22, la revue : il attendait de savoir s'il etait le glisser) sort de tout pincement :
      // a son prochain mouvement, sa commande reprend le geste (la garde, d.multi) ; le nouveau doigt reste seul, il
      // tourne sa commande, ou ne fait rien sur le fond, comme avant le 2026-10-21
      const multi = downs.size > 0;
      if (multi)
        for (const [pid, o] of downs) {
          o.multi = true;
          if (o.swipe) stage.orbit.own(pid);
        }
      downs.set(e.pointerId, {
        id: h ? h.id : null,
        kind: h ? h.kind : null,
        inst: h?.inst,
        index: h?.index,
        section: h?.section,
        chip: h?.chip,
        vpad: h?.vpad,
        vbtn: h?.vbtn,
        vknob: h?.kind === 'vpush' ? h.vknob : undefined,
        lcd: h?.lcd,
        rpage: h?.rpage,
        multi,
        x: e.clientX,
        y: e.clientY,
        dial: encoder,
        v0: encoder ? dialEdit(encoder) : 0,
        fine: false,
        a: 0,
        turning: false,
        axis: 'y',
        mouse: e.pointerType === 'mouse',
        touch: e.pointerType === 'touch',
        t: performance.now(),
        ts: e.timeStamp || performance.now(),
        moveTs: e.timeStamp || performance.now(),
        vel0: h?.kind === 'step' && h.index !== undefined ? stepVelocityOf(h.index) : 0,
        velDrag: false,
        held: false,
        lockHold: false,
        info: !!h && e.pointerType !== 'mouse' && rytmInfoTouch(h.id),
        writes0: rytmLock.get().writes,
        prevLock: rytmLock.get().latched ? rytmLock.get().step : -1,
        lockKey: lockKeyNow(),
        swipe: false,
      });
      // Les pas et les potards de page ne font jamais de pincement (2026-10-08) : tenir un pas d'un doigt et
      // tourner un potard d'un autre doit verrouiller, pas zoomer ; au telephone les blocs de l'ecran aussi (2026-10-09)
      const blockKnob = !!h && h.kind === 'rblock' && h.index !== undefined;
      const screenDial = !!h && h.kind === 'rdial' && !!h.param;
      if (h && (h.kind === 'step' || h.kind === 'penc' || blockKnob || screenDial)) stage.orbit.claim(e.pointerId);
      // Le bloc pris au doigt reste cerne tant qu'on le tient (2026-10-09), meme immobile : on voit ce qu'on regle ; MASTER et
      // TEMPO dans l'ecran aussi (2026-10-19)
      if (blockKnob && h && h.index !== undefined) rytmPage.hold(h.index);
      // Un potard de la face du desktop pris (2026-10-27) : HOME montre sa page, le bloc qu'il tourne reste cerne tant qu'on
      // le tient (le miroir), le potard est tenu (le moteur ne le deplace pas)
      if (FACE_FOLLOWS_PAGE && h && h.kind === 'penc' && h.index !== undefined && !downs.get(e.pointerId)?.info) {
        revealPage();
        rytmPage.hold(knobBlock(h.index) ?? -1);
        faceTouch.down(h.index, 'ptr');
      }
      // TRK (2026-10-27, la phase 2) : enfoncee, ce pointeur la tient ; ni orbite ni pincement. INFOS allume, au doigt : la
      // carte seulement (la tape la montre)
      if (h && h.kind === 'trk') {
        stage.orbit.claim(e.pointerId);
        const d0 = downs.get(e.pointerId);
        if (d0 && !d0.info) {
          d0.trkSrc = `ptr:${e.pointerId}`;
          trkDown(d0.trkSrc, e.timeStamp || performance.now());
          stage.pressFaceKey('trk');
        }
      }
      // SCENE A et B (2026-10-27, la phase 2) : tenue par ce pointeur (enregistre tant qu'on la tient), une tape la garde ;
      // ni orbite ni pincement ; INFOS allume au doigt : la carte seulement
      if (h && h.kind === 'scene' && h.scene) {
        stage.orbit.claim(e.pointerId);
        const d0 = downs.get(e.pointerId);
        if (d0 && !d0.info) {
          d0.scene = h.scene;
          d0.sceneSrc = `ptr:${e.pointerId}`;
          sceneDown(h.scene, d0.sceneSrc, e.timeStamp || performance.now());
          stage.pressFaceKey(h.id);
        }
      }
      // Le crossfader (2026-10-27, P2-20) : pris par ce pointeur, ni orbite ni pincement ; relatif (rien ne bouge a la prise,
      // une tape sur la fente non plus) ; l'axe de sa course projete a l'ecran, a tout angle de la vue
      if (h && h.kind === 'xfade') {
        stage.orbit.claim(e.pointerId);
        const d0 = downs.get(e.pointerId);
        const ax = stage.xfadeAxis();
        if (d0 && !d0.info && ax) {
          const dx = ax.bx - ax.ax;
          const dy = ax.by - ax.ay;
          const len = Math.hypot(dx, dy);
          if (len > 1) {
            d0.xf = { v0: xfadeValue(), ux: dx / len, uy: dy / len, len };
            d0.fine = e.shiftKey;
            xfadeGesture('start', 'ptr');
          }
        }
      }
      if (screenDial && h?.param) screenDials.hold(h.param as ScreenDialId);
      // Le navigateur des sons (2026-10-18) : ni pincement ni orbite ; sa premiere ligne et la hauteur d'une ligne a l'ecran
      // (le corps de la liste, en BROWSER_ROWS lignes), pour un glisser ; au doigt, un de ses samples tenu SB_HOLD_MS : arme
      // pour partir (REMOVE? TAP AGAIN)
      if (h && h.kind === 'sbrowse') {
        stage.orbit.claim(e.pointerId);
        const d0 = downs.get(e.pointerId);
        const body = stage.hit.list().find((x) => x.id === 'lcd-sb-body');
        if (d0) {
          d0.sbTop = soundBrowserView()?.top ?? 0;
          d0.rowPx = (body && body.enabled ? body.bh : h.bh * BROWSER_ROWS) / BROWSER_ROWS;
        }
        const row = /^lcd-sb-row-([0-9]+)$/.exec(h.id);
        if (row && e.pointerType !== 'mouse') {
          const pid = e.pointerId;
          window.setTimeout(() => {
            const d = downs.get(pid);
            if (!d || d !== d0 || disposed || d.turning) return;
            const v = soundBrowserView();
            const i = (v?.top ?? 0) + Number(row[1]);
            if (!v || !v.rows[i]?.user) return;
            d.holdFired = true;
            soundBrowserRemove(i, 'TAP');
          }, SB_HOLD_MS);
        }
      }
      // MUTE ou SOLO tenu (2026-10-09) : MODE_HOLD_MS sans lacher, toutes les voix reviennent (le lacher ne fait rien de plus) ;
      // INFOS allume, au doigt, la tenue lit la carte et ne rend aucune voix (revue : comme la touche du Dock)
      if (h && (h.kind === 'mute' || h.kind === 'solo') && !downs.get(e.pointerId)?.info) {
        const pid = e.pointerId;
        const d0 = downs.get(pid);
        const k = h.kind;
        window.setTimeout(() => {
          const d = downs.get(pid);
          if (!d || d !== d0 || disposed || d.turning) return;
          d.holdFired = true;
          stage.pressButton(k);
          modeHold(k);
        }, MODE_HOLD_MS);
      }
      // Un pas tenu (2026-10-05) : l'ecran dit sa velocite et qu'un glisser la change ; depuis le 2026-10-08,
      // hors EDIT et une voix choisie, 350 ms de tenue sans glisser : le LOCK (les parameter locks)
      // INFOS du MM-RYTM (R4), au doigt : la tenue d'un pas ne met pas le LOCK, sa tape montre la carte du pas ; il reste
      // tenu pourtant (revue de R4) : un encodeur tourne d'un autre doigt le verrouille, comme sa carte le dit
      if (h?.kind === 'step' && h.index !== undefined) {
        const idx = h.index;
        const pid = e.pointerId;
        // TRK engagee (2026-10-27) : le pas choisit sa voix a l'appui, avant EDIT et le P-LOCK ; aucune minuterie. TRK qui
        // se ferme et ne prend pas ce pas (revue B2 : un autre pas que la double tape) : le pas suit son chemin habituel
        const dt = downs.get(pid);
        if (trk.engaged() && dt && !dt.info && trkStep(idx, stage, e.timeStamp || performance.now())) {
          dt.trk = true;
          e.preventDefault();
          return;
        }
        const lockable = editor.get() !== 'mm808' && pattern.get().instrument !== null;
        // La pression de CE pointerdown (revue de R2) : une souris a toujours le pointerId 1, la minuterie d'un
        // clic d'avant ne doit pas prendre le clic suivant pour une tenue (trois clics a la seconde latchaient le LOCK)
        const d0 = downs.get(pid);
        const info = !!d0?.info;
        if (lockable) {
          if (d0) d0.held = true;
          rytmLock.hold(idx);
          window.setTimeout(() => {
            const d = downs.get(pid);
            // Un doigt parti de cote (2026-10-21, ui/swipe.ts) : peut-etre le glisser d'une machine a l'autre, pas une tenue
            if (!d || d !== d0 || d.velDrag || d.swipe || d.info || d.index !== idx || disposed) return;
            // Deja passe en LOCK par un potard tourne pendant la tenue : il y reste jusqu'au lacher
            if (rytmLock.get().writes > d.writes0) {
              d.lockHold = true;
              return;
            }
            if (rytmLockEnter(idx, false)) d.lockHold = true;
          }, LOCK_HOLD_MS);
        } else if (!info) {
          window.setTimeout(() => {
            const d = downs.get(pid);
            if (d && d === d0 && !d.velDrag && !d.swipe && d.index === idx && !disposed) stepHoldHint(idx);
          }, STEP_HOLD_MS);
        }
      }
      // Rien ne part ici : un objet attend la tape (relachement)
      if (h) e.preventDefault();
    };

    /**
     * Le lacher d'un pas du MM-RYTM tenu (2026-10-08) : il n'est plus tenu ;
     * une tenue qui a mis le LOCK le garde si rien n'a tourne pendant (fixe),
     * sinon le LOCK revient a ce qu'il etait (un LOCK momentane) ; un pas qui
     * a recu un verrou (deux doigts) n'est ni change ni tape. Rend true si le
     * lacher est pris (la tape ne part pas).
     */
    const stepUp = (d: Down, upTs = -1): boolean => {
      if (!d.held || d.index === undefined) return false;
      d.held = false;
      rytmLock.release(d.index);
      const turned = rytmLock.get().writes > d.writes0;
      // Une tenue dont la minuterie n'a pas encore parle (revue de R2 : le fil principal gele, le pointerup passe
      // avant elle) : mesuree d'un evenement a l'autre, 350 ms ou plus, c'est la tenue, le LOCK fixe
      // INFOS allume, au doigt : jamais (la tenue montre la carte du pas)
      if (!d.lockHold && !turned && !d.velDrag && !d.swipe && !d.info && upTs >= 0 && upTs - d.ts >= LOCK_HOLD_MS) {
        if (rytmLockEnter(d.index, true)) {
          d.lockHold = true;
          return true;
        }
      }
      if (!d.lockHold && !turned) return false;
      d.lockHold = true;
      if (turned || d.velDrag) {
        // Momentane : le LOCK fixe d'avant revient, ou plus de LOCK
        if (rytmLock.get().held.length > 0) return true;
        // Un potard de page encore tenu (deux doigts, revue de R2 : le doigt du pas leve le premier) : il
        // continue d'ecrire sur ce pas, le LOCK ne revient qu'a son lacher
        if (knobHeld()) {
          // Le plus ancien LOCK fixe attendu gagne (un autre pas tenu entre-temps ne le connaissait plus)
          if (pendingRestore === null) pendingRestore = d.prevLock;
          return true;
        }
        const prev = pendingRestore ?? d.prevLock;
        pendingRestore = null;
        restoreLock(prev);
      } else {
        // Un LOCK fixe tout neuf : plus rien a rendre
        pendingRestore = null;
        rytmLock.latch();
      }
      return true;
    };

    /**
     * Un bloc de l'ecran lache (le telephone, 2026-10-09) : il n'est plus cerne,
     * sauf si un autre doigt en tient un (il passe a celui-la).
     */
    const releaseBlock = (d: Down): void => {
      // MASTER ou TEMPO dans l'ecran (2026-10-19) : cerne tant qu'un pointeur le tient
      if (d.kind === 'rdial') {
        let other: ScreenDialId | null = null;
        for (const o of downs.values()) if (o.kind === 'rdial' && o.dial) other = o.dial as ScreenDialId;
        if (other) screenDials.hold(other);
        else screenDials.release();
        return;
      }
      const penc = FACE_FOLLOWS_PAGE && d.kind === 'penc' && d.index !== undefined;
      if (d.kind !== 'rblock' && !penc) return;
      if (penc && d.index !== undefined && !d.info) faceTouch.up(d.index);
      let other = -1;
      for (const o of downs.values()) {
        if (o.kind === 'rblock' && o.index !== undefined) other = o.index;
        else if (FACE_FOLLOWS_PAGE && o.kind === 'penc' && o.index !== undefined) other = knobBlock(o.index) ?? other;
      }
      if (other >= 0) rytmPage.hold(other);
      else rytmPage.release();
    };

    /** Un potard de page est-il tenu (un doigt, la souris) ? */
    const knobHeld = (): boolean => {
      for (const o of downs.values()) if (o.dial && pageKnobOf(o.dial) >= 0) return true;
      return false;
    };
    /** Le LOCK fixe a rendre au lacher du dernier potard de page (-1 : plus de LOCK), null : rien en attente. */
    let pendingRestore: number | null = null;
    /**
     * La fin d'un LOCK momentane : le LOCK fixe d'avant revient, ou plus de
     * LOCK. Seulement si le LOCK est encore celui de la tenue (revue de R2) :
     * Echap, EDIT ou une autre machine en sont sortis, une tape l'a fixe
     * ailleurs : rien a rendre (jamais un LOCK qui revient dans EDIT).
     */
    const restoreLock = (prev: number): void => {
      const s = rytmLock.get();
      if (s.step < 0 || s.latched) return;
      if (prev >= 0 && editor.get() !== 'mm808') rytmLock.enter(prev, true);
      else rytmLock.leave();
    };
    /** Un pointeur lache : le dernier potard de page parti, le LOCK en attente revient. */
    const flushRestore = (): void => {
      if (pendingRestore === null || knobHeld() || rytmLock.get().held.length > 0) return;
      const prev = pendingRestore;
      pendingRestore = null;
      restoreLock(prev);
    };

    /**
     * Un pointeur perdu (capture perdue, bouton relache hors de la page) :
     * oublie sans rien activer, le curseur quitte l'axe de l'encodeur.
     */
    const forget = (id: number): void => {
      const d = downs.get(id);
      if (!d) return;
      downs.delete(id);
      if (d.dial && isVoy(d.dial)) voyEcho.release(id);
      releaseBlock(d);
      // TRK tenue par ce pointeur perdu : lachee sans garde ; une scene aussi
      if (d.trkSrc) trkUp(d.trkSrc, -1);
      if (d.scene && d.sceneSrc) sceneUp(d.scene, d.sceneSrc, -1);
      if (d.xf) xfadeGesture('end', 'ptr');
      stepUp(d);
      flushRestore();
      try {
        if (el.hasPointerCapture(id)) el.releasePointerCapture(id);
      } catch {
        /* pointeur deja inactif */
      }
      if (d.turning && d.mouse) {
        turnAxis = null;
        turnBlock = false;
        turnXf = false;
        setCursor();
      }
    };

    /**
     * Le crossfader glisse (P2-20) : x suit la projection du deplacement sur l'axe de sa course ; Maj, dix fois plus fin
     * (DIAL_FINE.drag), repris du point du moment quand Maj change (rien ne saute).
     */
    const xfMove = (d: Down, cx: number, cy: number, shift: boolean): void => {
      const f = d.xf;
      if (!f) return;
      if (shift !== d.fine) {
        d.fine = shift;
        f.v0 = xfadeValue();
        d.x = cx;
        d.y = cy;
      }
      const k = shift ? DIAL_FINE.drag : 1;
      xfadeSet(f.v0 + (k * ((cx - d.x) * f.ux + (cy - d.y) * f.uy)) / f.len, 'ptr');
    };

    const onMove = (e: PointerEvent): void => {
      // Lu ici, avant l'orbite (sur le parent) dont la garde prend l'encodeur
      shiftHeld = e.shiftKey;
      if (seqDrags.has(e.pointerId)) {
        const uv = seqUv(e.clientX - rect.left, e.clientY - rect.top);
        if (uv) stage.voy?.seqScreen?.move(uv.u, uv.v);
        e.stopPropagation();
        return;
      }
      const mg = holder(e.pointerId);
      if (mg) {
        mg.move(e.pointerId, e.clientX - rect.left, e.clientY - rect.top, e.shiftKey, eventTime(e));
        e.stopPropagation();
        return;
      }
      const d = downs.get(e.pointerId);
      // L'instant de ce mouvement, avant la garde de l'orbite (elle ecoute le parent) : le glisser se mesure au geste
      if (d) d.moveTs = e.timeStamp || performance.now();
      // Souris sans bouton mais encore tenue ici : son pointerup s'est perdu
      if (d && d.mouse && (e.buttons & 1) === 0) forget(e.pointerId);
      else if (d && d.turning) {
        if (d.kind === 'sbrowse') sbDrag(d, e.clientY - d.y);
        else if (d.xf) xfMove(d, e.clientX, e.clientY, e.shiftKey);
        else turnDial(d, e.clientX - d.x, e.clientY - d.y, e.shiftKey);
        return;
      } else if (d && d.velDrag) {
        dragVelocity(d, e.clientY - d.y);
        return;
      }
      if (e.pointerType !== 'mouse') return;
      // Pendant une orbite : ni survol ni picking
      if (stage.orbit.dragging) {
        if (hover !== null) setHover(null);
        else setCursor();
        return;
      }
      const h = pickAt(e, false);
      // Deux machines : en vue d'ensemble, une machine sous la souris se clique ;
      // une machine utilisee, le bout de l'autre aussi (et il sort un peu)
      const mh = !h && VOYAGER ? stage.hit.machineAt(e.clientX - rect.left, e.clientY - rect.top) : null;
      hoverMachine = mh !== null && mh !== focus.machine();
      // Vue d'ensemble (2026-10-05) : la machine survolee montre son mode d'emploi (ui/OverviewHelp.tsx)
      overviewHover.set(focus.get() === 'all' ? mh : null);
      overLocked = !h && !hoverMachine && stage.orbit.lock(e.clientX, e.clientY, true);
      setPeek(hoverMachine && focus.get() !== 'all');
      // Le rouleau d'EDIT du MM-BASS (2026-10-09) : la colonne sous la souris s'eclaire
      if (h?.id === 'bass-roll' || hover === 'bass-roll') bassGestures()?.hover(h, e.clientX - rect.left, e.clientY - rect.top);
      setHover(h);
    };

    const onUp = (e: PointerEvent): void => {
      if (seqDrags.delete(e.pointerId)) {
        stage.voy?.seqScreen?.up();
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        e.stopPropagation();
        return;
      }
      const mg = holder(e.pointerId);
      if (mg) {
        const over = e.type === 'pointerup' ? pickAt(e, isCoarse(e)) : null;
        const back: SwipeHandBack | null = mg.up(e.pointerId, over ? over.id : null);
        // Un potard du MIXER ou du MM-BASS lache sans avoir tourne, le doigt parti de cote (2026-10-21, ui/swipe.ts) : il
        // rend le geste, peut-etre le glisser d'une machine a l'autre
        if (back && e.type === 'pointerup' && swipeable(e.pointerType !== 'mouse')) {
          const dx = e.clientX - rect.left - back.x0;
          const fired = isSwipe(dx, e.clientY - rect.top - back.y0, eventTime(e) - back.t0) ? machineSwipe(dx) : null;
          hitDebug.lastUp = { id: over ? over.id : null, tap: false, fired, bg: false };
        }
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        e.stopPropagation();
        return;
      }
      const d = downs.get(e.pointerId);
      downs.delete(e.pointerId);
      if (d?.dial && isVoy(d.dial)) voyEcho.release(e.pointerId);
      if (d) releaseBlock(d);
      // TRK lachee (2026-10-27) : une tape la garde, une tenue la lache ; un pointeur annule la lache sans garde ; SCENE A et B
      if (d?.trkSrc) trkUp(d.trkSrc, e.type === 'pointerup' ? e.timeStamp || performance.now() : -1);
      if (d?.scene && d.sceneSrc) sceneUp(d.scene, d.sceneSrc, e.type === 'pointerup' ? e.timeStamp || performance.now() : -1);
      if (d?.xf) xfadeGesture('end', 'ptr');
      if (d && d.turning && d.mouse) {
        turnAxis = null;
        turnBlock = false;
        turnXf = false;
        setCursor();
      }
      // Un pas tenu du MM-RYTM (2026-10-08) : son lacher decide du LOCK (et la tape ne part pas s'il l'a pris)
      if (d) stepUp(d, e.type === 'pointerup' ? e.timeStamp || performance.now() : -1);
      flushRestore();
      // Lu AVANT le pointerup de l'orbite (elle ecoute le parent) : sa fiche existe encore
      if (d && !d.turning && e.type === 'pointerup') {
        const tap = stage.orbit.isTap(e);
        let fired: string | null = null;
        let bg = false;
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        // Le navigateur des sons ouvert (2026-10-18) : une tape hors de lui le ferme, et agit (un pad de voix, non : la liste
        // suit sa voix)
        // (V.4.2 : un potard de la face non plus quand l'ecran ne se touche pas : la tape du potard SOUND la tient ouverte, comme il la tourne ;
        // ni un clic sur l'ecran lui-meme, inerte au desktop : 2026-10-27, la revue, une ligne cliquee fermait la liste)
        if (tap && lcdSamples.isOpen() && d.kind !== 'sbrowse' && d.kind !== 'pad' && !(d.kind === 'penc' && !SCREEN_TOUCH) && !(!SCREEN_TOUCH && stage.hit.onScreen(mx, my))) soundBrowserClose();
        // Une machine touchee hors de ses objets (vue d'ensemble, ou l'autre machine) : on zoome dessus
        const other = VOYAGER && tap && d.id === null ? stage.hit.machineAt(mx, my) : null;
        if (tap && d.id !== null) {
          // Relache sur le meme objet : il part
          if (pickAt(e, isCoarse(e))?.id === d.id) fired = fire(d);
        } else if (other && other !== focus.machine()) {
          fired = `focus-${other}`;
          focusMachine(other);
        } else if (tap && stage.orbit.lastTap.quick && !stage.hit.onMachine(mx, my)) {
          bg = true;
          tapBackground(e);
        } else if (!tap && !d.multi && swipeable(e.pointerType !== 'mouse')) {
          // Au telephone : un glisser horizontal passe d'une machine a l'autre
          if (isSwipe(e.clientX - d.x, e.clientY - d.y, eventTime(e) - d.ts)) fired = machineSwipe(e.clientX - d.x);
        }
        hitDebug.lastUp = { id: d.id, tap, fired, bg };
      }
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (e.pointerType === 'mouse' && e.type === 'pointerup') {
        // L'orbite lache ce pointeur juste apres (son ecouteur est sur le
        // parent) : le survol et le curseur se recalculent une fois
        // l'evenement passe. Une tache, pas une microtache : avec de vrais
        // evenements, les microtaches passent apres CHAQUE ecouteur, donc
        // avant celui de l'orbite, et le curseur restait 'grabbing'
        const px = e.clientX;
        const py = e.clientY;
        window.setTimeout(() => {
          if (!disposed) setHover(stage.hit.pick(px - rect.left, py - rect.top, false));
        }, 0);
      }
    };

    const onWheel = (e: WheelEvent): void => {
      // Ctrl + molette (pincement d'un pave tactile) : le zoom de la vue
      if (e.ctrlKey) return;
      const h = pickAt(e, false);
      // Au-dessus du navigateur des sons (2026-10-18) : la molette le fait defiler, une ligne par cran (vers soi : la suite)
      if (h && h.kind === 'sbrowse') {
        e.preventDefault();
        const delta = e.shiftKey && e.deltaY === 0 ? e.deltaX : e.deltaY;
        sbWheel += delta * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1);
        const n = Math.trunc(sbWheel / POT_UI.wheelPx);
        if (n !== 0) {
          sbWheel -= n * POT_UI.wheelPx;
          soundBrowserScroll(n);
        } else lcdSamples.touch();
        return;
      }
      sbWheel = 0;
      // Au-dessus d'une commande du MM-DECKS : elle prend la molette si elle en veut (sinon la vue zoome)
      const g = gesturesOf(h);
      if (h && g) {
        const delta = e.shiftKey && e.deltaY === 0 ? e.deltaX : e.deltaY;
        if (g.wheel(h, delta * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1), e.shiftKey)) {
          e.preventDefault();
          return;
        }
      }
      // Au-dessus du crossfader (P2-20) : 1/127 par cran (accelere quand les crans se suivent vite, Maj un a la fois), le
      // geste finit 120 ms apres le dernier cran
      if (h && h.kind === 'xfade') {
        e.preventDefault();
        const delta = e.shiftKey && e.deltaY === 0 ? e.deltaX : e.deltaY;
        xfWheel -= delta * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1);
        const n = Math.trunc(xfWheel / POT_UI.wheelPx);
        if (n === 0) return;
        xfWheel -= n * POT_UI.wheelPx;
        const now = e.timeStamp || performance.now();
        const gain = wheelGain(now - wheelAt, e.shiftKey);
        wheelAt = now;
        if (!sceneCtl.moving()) xfadeGesture('start', 'wheel');
        xfadeSet(xfadeValue() + (n * gain) / 127, 'wheel');
        window.clearTimeout(xfWheelTimer);
        xfWheelTimer = window.setTimeout(() => {
          xfWheelTimer = 0;
          xfadeGesture('end', 'wheel');
        }, XFADE_UI.settleMs);
        return;
      }
      xfWheel = 0;
      const k: DialId | null = dialOf(h);
      if (!k) {
        wheelAcc = 0;
        wheelKind = null;
        return;
      }
      // Au-dessus d'un encodeur : il tourne, l'orbite ne zoome pas
      e.preventDefault();
      if (k !== wheelKind) {
        wheelAcc = 0;
        wheelKind = k;
      }
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1;
      // Molette vers le haut = plus ; un cran de 100 px = 1 BPM ou 2 %, les
      // petits deltas d'un pave tactile s'accumulent. Maj : macOS fait de la
      // molette un defilement horizontal (deltaX), lu a sa place
      const delta = e.shiftKey && e.deltaY === 0 ? e.deltaX : e.deltaY;
      wheelAcc -= delta * unit;
      const px = k === 'tempo' ? TEMPO_UI.wheelPx : POT_UI.wheelPx;
      const steps = Math.trunc(wheelAcc / px);
      const pencK = h && h.kind === 'penc' && h.index !== undefined ? h.index : -1;
      if (steps !== 0 && (pageKnobOf(k) >= 0 || pencK >= 0)) {
        // Un bloc de l'ecran (2026-10-08) ou un encodeur du desktop (2026-10-09) : un cran = 1 sur 127 (un cran du reglage
        // s'il en a), accelere quand les crans se suivent vite (wheelGain) ; Maj : un cran a la fois
        wheelAcc -= steps * px;
        const now = e.timeStamp || performance.now();
        const gain = wheelGain(now - wheelAt, e.shiftKey);
        wheelAt = now;
        // Un potard de la face : la page au desktop (2026-10-27 ; le premier cran montre la page sous HOME), son FX global
        // et son popup au telephone ; les presets ouverts (V.4.2, l'ecran ne se touche plus) : un preset par cran
        if (pencK >= 0 && presetFaceKnob(pencK, steps)) return;
        if (pencK >= 0) {
          if (FACE_FOLLOWS_PAGE) revealPage();
          dialNudge(k, steps * gain, (v) => faceKnob(pencK, v, 'wheel'));
        }
        else dialNudge(k, steps * gain);
      } else if (steps !== 0) {
        wheelAcc -= steps * px;
        // Maj : reglage fin, 1 % le cran (TEMPO reste a 1 BPM)
        // Un potard a crans du MM-ARP : un cran par cran de molette (2 % ne le faisaient jamais bouger)
        const n = voySteps(k);
        const step =
          k === 'tempo' ? 1 : n > 1 ? 1 / (n - 1) : e.shiftKey ? DIAL_FINE.wheelStep : !isVoy(k) && !isKit(k) && isBipolar(k as EncId) ? POT_UI.bipolarStep : POT_UI.wheelStep;
        const nv = Math.round((dialEdit(k) + steps * step) * 1000) / 1000;
        // MASTER ou TEMPO dans l'ecran (2026-10-19) : TEMPO dit sa valeur au pied
        if (h && h.kind === 'rdial') screenDialSet(k, nv);
        else anyDial(k, nv);
      }
    };

    const onLost = (e: PointerEvent): void => {
      if (seqDrags.delete(e.pointerId)) stage.voy?.seqScreen?.up();
      holder(e.pointerId)?.up(e.pointerId, null);
      forget(e.pointerId);
    };

    const onLeave = (e: PointerEvent): void => {
      if (e.pointerType === 'mouse' && !stage.orbit.dragging) setHover(null);
      setPeek(false);
      overviewHover.set(null);
    };
    // Appui long : ni menu contextuel ni loupe
    const onMenu = (e: Event): void => e.preventDefault();

    /*
     * Un fichier glisse depuis le disque (2026-10-18, Mika : "glisser-deposer WAV") : au-dessus du MM-RYTM, l'ecran dit
     * DROP ON A PAD (DROP ON BD au-dessus d'un pad) ; lache sur un pad, il devient un sample de sa voix ; ailleurs sur la
     * machine, de la voix choisie (actions.ts soundDrop). Hors du MM-RYTM, refuse (pas de copie) ; jamais la page qui part
     * vers le fichier lache a cote. La face V.4.0 du desktop (2026-10-27) n'a plus de pads : partout sur la machine, la voix
     * choisie (l'ecran dit DROP FOR BD).
     */
    const isFiles = (e: DragEvent): boolean => !!e.dataTransfer && Array.from(e.dataTransfer.types ?? []).includes('Files');
    /** Sous le fichier : la voix d'un pad du MM-RYTM, 'pad' ailleurs sur lui, null hors de lui. */
    const dropAt = (e: DragEvent): Inst | 'pad' | null => {
      rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const h = stage.hit.pick(x, y, false);
      if (h && h.kind === 'pad' && h.inst && (!h.machine || h.machine === 'mm808')) return h.inst;
      if (h?.machine === 'mm808') return 'pad';
      return stage.hit.machineAt(x, y) === 'mm808' ? 'pad' : null;
    };
    const onDragOver = (e: DragEvent): void => {
      if (!isFiles(e)) return;
      e.preventDefault();
      const t = dropAt(e);
      if (e.dataTransfer) e.dataTransfer.dropEffect = t ? 'copy' : 'none';
      lcdSamples.dragOver(t);
    };
    const onDragLeave = (e: DragEvent): void => {
      if (!isFiles(e)) return;
      const to = e.relatedTarget;
      if (!(to instanceof Node) || !el.contains(to)) lcdSamples.dragOver(null);
    };
    const onDrop = (e: DragEvent): void => {
      if (!isFiles(e)) return;
      e.preventDefault();
      const t = dropAt(e);
      lcdSamples.dragOver(null);
      if (!t) return;
      soundDrop(Array.from(e.dataTransfer?.files ?? []), t === 'pad' ? null : t);
    };
    // Un fichier lache a cote de la couche de toucher (l'en-tete, une marge ; 2026-10-21, audit RS-14) : refuse, le
    // navigateur ne part pas vers lui ; ce qu'un autre element a deja pris (cette couche, le TrackBrowser du MM-DECKS)
    // reste a lui
    const onDocOver = (e: DragEvent): void => {
      if (!isFiles(e) || e.defaultPrevented) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
    };
    const onDocDrop = (e: DragEvent): void => {
      if (!isFiles(e) || e.defaultPrevented) return;
      e.preventDefault();
      lcdSamples.dragOver(null);
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('lostpointercapture', onLost);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('contextmenu', onMenu);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('dragenter', onDragOver);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    document.addEventListener('dragover', onDocOver);
    document.addEventListener('drop', onDocDrop);
    return () => {
      disposed = true;
      fxOpenCancel();
      ro.disconnect();
      // Demontee en plein geste : l'echo du MM-ARP ne reste pas tenu par un pointeur parti
      voyEcho.releaseAll();
      downs.clear();
      rytmPage.release();
      screenDials.release();
      rytmLock.releaseAll();
      // TRK, SCENE A et B (2026-10-27) : la couche demontee, elles s'eteignent
      trk.cancel();
      sceneCtl.cancel();
      // Le crossfader (P2-20) : un geste en cours se termine (x reste ou il est)
      window.clearTimeout(xfWheelTimer);
      if (sceneCtl.moving()) xfadeGesture('end', 'ui');
      djg?.release();
      bsg?.release();
      stage.orbit.gate = () => true;
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('lostpointercapture', onLost);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('contextmenu', onMenu);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dragenter', onDragOver);
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
      document.removeEventListener('dragover', onDocOver);
      document.removeEventListener('drop', onDocDrop);
      lcdSamples.dragOver(null);
      el.style.cursor = '';
      getStage()?.setHover(null);
    };
  }, [getStage, stage]);

  return (
    <>
      <div ref={ref} className="v4-hit" aria-hidden="true" />
      <MidiLearnLayer stage={stage} />
      <OverviewHelp stage={stage} />
    </>
  );
};

interface TwinsProps {
  stage: Stage | null;
}

/** Enter tenu ne rejoue pas un jumeau : une frappe, une activation. */
const noRepeat = (e: React.KeyboardEvent): void => {
  if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
};

/**
 * Puce LABEL (un vrai lien) : un lien natif ne part qu'avec Entree ; Espace
 * l'active aussi (spec 8 : Entree et Espace activent tous les jumeaux).
 * keydown est une activation utilisateur : le nouvel onglet reste permis.
 */
const linkSpace = (e: React.KeyboardEvent<HTMLAnchorElement>): void => {
  if (e.key !== ' ' || e.altKey || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  if (!e.repeat) e.currentTarget.click();
};

/** Arrondi au dixieme de px : ce que les jumeaux ecrivent. */
const r1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Encodeur au clavier (jumeau role slider) : fleches 1 BPM ou 2 %, Maj ou
 * Page 5 BPM ou 10 %, Debut et Fin aux butees. Les autres touches passent
 * (A S D F, chiffres, O restent des raccourcis).
 */
const onDialKey =
  (k: EncId) =>
  (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const cfg = k === 'tempo' ? DIAL_KEYS.tempo : DIAL_KEYS.pot;
    const min = k === 'tempo' ? BPM.min : potMin(k);
    const max = k === 'tempo' ? BPM.max : 1;
    // SAMPLE : un cran par son ; TONE et STRETCH : un pas de 0.05 sort du cran du centre (+/-0.04)
    const stops = k === 'vsound' ? dialSteps(k) : 0;
    const step = stops > 1 ? 1 / (stops - 1) : e.shiftKey ? cfg.big : isBipolar(k) ? POT_UI.bipolarStep : cfg.step;
    let v = dialValue(k);
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        v += step;
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        v -= step;
        break;
      case 'PageUp':
        v += cfg.big;
        break;
      case 'PageDown':
        v -= cfg.big;
        break;
      case 'Home':
        v = min;
        break;
      case 'End':
        v = max;
        break;
      default:
        return;
    }
    e.preventDefault();
    // Au centieme : pas de derive de 0.02 en 0.0199999
    dial(k, k === 'tempo' ? v : Math.round(v * 100) / 100);
  };

/**
 * Les fleches sur un potard de page (2026-10-08) : un cran de 1 sur 127 (Maj
 * ou Page : 10), un cran du reglage s'il en a ; Debut et Fin aux butees.
 * set : ce qui pose la valeur (un encodeur du desktop : son FX global et son popup).
 */
/** Le potard k de la face a-t-il un reglage sur sa case (2026-10-27) : ni case vide ni dessin. */
function faceKnobTurns(k: number): boolean {
  const b = knobBlock(k);
  const slot = b === null ? null : pageSlotOf(b);
  return !!slot && !!slot.label && !slot.graph;
}

/**
 * Le nom d'un potard de la face du desktop (2026-10-27, les potards suivent la page) : sa lettre, l'ecran et la fonction
 * de sa case (Knob C, VOICE: PITCH, Bass drum), celle d'un bloc voisin (Knob E, VOICE FX: DIST (same as knob A)), rien
 * (Knob G, nothing on VOICE) ; en P-LOCK, le pas et ce que fait Suppr.
 */
function faceKnobAria(k: number, b: number | null, inst: Inst | null, lockAt: number): string {
  const letter = PAGE_KNOB_LETTERS[k] ?? '?';
  const screen = SCREEN_TITLE[rytmPage.screen(inst)];
  const slot = b === null ? null : pageSlotOf(b);
  if (!slot || !slot.label) return `Knob ${letter}, nothing on ${screen}`;
  const same = b !== null && b !== k ? ` (same as knob ${PAGE_KNOB_LETTERS[b] ?? '?'})` : '';
  if (slot.graph) return `Knob ${letter}, ${screen}: ${slot.label}${same}, a picture, nothing to turn`;
  const voice = slot.scope === 'track' && inst ? `, ${INST_NAMES[inst]}` : '';
  const lock = lockAt >= 0 ? `, P-lock on step ${lockAt + 1}, delete removes its lock` : '';
  return `Knob ${letter}, ${screen}: ${slot.label}${same}${voice}${lock}`;
}

const onPageKnobKey =
  (d: DialId, set: (v: number) => void = (v) => anyDial(d, v)) =>
  (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const big = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        dialNudge(d, big, set);
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        dialNudge(d, -big, set);
        break;
      case 'PageUp':
        dialNudge(d, 10, set);
        break;
      case 'PageDown':
        dialNudge(d, -10, set);
        break;
      case 'Home':
        set(dialRange(d)[0]);
        break;
      case 'End':
        set(dialRange(d)[1]);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

/** Les fleches sur un TWEAK du kit : un centieme (Maj : un dixieme), un cran pour un choix de son. */
const onKitKey =
  (k: KitId) =>
  (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const n = kitSteps(k);
    const step = n > 1 ? 1 / (n - 1) : e.shiftKey ? DIAL_KEYS.pot.big : DIAL_KEYS.pot.step;
    let v = kit.value(k);
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        v += step;
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        v -= step;
        break;
      case 'Home':
        v = 0;
        break;
      case 'End':
        v = 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    kitDial(k, Math.min(1, Math.max(0, Math.round(v * 100) / 100)));
  };

const pct = (v: number): number => Math.round(v * 100);

/** "TRACKS" -> "Tracks" */
const title = (label: string): string => label.charAt(0) + label.slice(1).toLowerCase();

/** Texte lu d'un encodeur : "130 BPM", "80 %", "54 % swing", TONE "+35", STRETCH "-40 %, shorter". */
function dialText(k: EncId, v: number): string {
  if (k === 'tempo') return `${v} BPM`;
  if (k === 'vsound') {
    const f = soundFamily();
    return f ? kit.valueText(f) : 'one sound';
  }
  if (k === 'swing') return `${swingRatio(v)} % swing`;
  if (k === 'tone') {
    const n = pct(v);
    return n === 0 ? '0, centre, bypass' : `${n > 0 ? '+' : ''}${n}`;
  }
  if (k === 'stretch') {
    const n = pct(v);
    return n === 0 ? '0, centre, original length' : `${n > 0 ? '+' : ''}${n} %, ${n > 0 ? 'longer' : 'shorter'}`;
  }
  return `${pct(v)} %`;
}

/**
 * Jumeaux HTML (spec 6.3 et 20.7) : un element transparent par objet
 * interactif, pose sur sa silhouette projetee (rectangle cible de hit.ts :
 * 48 x 48 px au moins au doigt, 32 x 32 a la souris), focusable, nomme par
 * son aria-label ; contour jaune de 2 px au focus clavier. Le clavier et
 * les lecteurs d'ecran passent par eux, le pointeur par la couche de saisie
 * (ils ne prennent aucun pointeur). Ordre du DOM = ordre de tabulation
 * (spec 20.7 et 20.19) : les 4 pads de voix (aria-pressed = instrument
 * selectionne), les 8 pads de navigation en ordre de lecture (pages :
 * aria-expanded et aria-controls ; OPEN : aria-pressed), les puces du PCB
 * juste apres OPEN qui les decouvre (rendues de l'ouverture a la fin de la
 * fermeture, actives pendant l'ouverture et vue ouverte), les six
 * encodeurs (role slider), RUN, CLEAR, les 16 touches trig ; RESET VIEW
 * suit (index.tsx). LABEL est un vrai lien (nouvel onglet, Espace l'active
 * aussi), LIVE et STUDIO des boutons de leur section (aria-expanded,
 * aria-controls) ; le focus clavier d'une puce la souleve comme le survol
 * (LABEL passe aussi au jaune, avec son chevron). RUN et OPEN gardent un
 * nom fixe, leur etat passe par aria-pressed. Positions (spec 20.2.8) : ecrites dans
 * le style sans rendu React, DANS la passe de rendu (stage.onView, juste
 * apres renderer.render) a chaque frame rendue, depuis les rectangles de
 * hit.rects() (projection analytique, sans allocation) : les jumeaux
 * suivent l'orbite et le contour jaune du jumeau qui a le focus reste sur
 * son objet. Seules les valeurs qui ont change (au dixieme de px) sont
 * reecrites ; le montage ecrit tout, onIdle rattrape un rendu hors boucle.
 */
/** Ce que les jumeaux lisent de la page du MM-RYTM : la page, la vue, le pas choisi ; la page d'un FX ouverte (2026-10-10, ses blocs). */
const rytmPageKey3 = (): string => {
  const s = rytmPage.get();
  return `${s.page}|${s.tabs[s.page] ?? 0}|${s.detail ?? ''}|${s.view}|${s.sel}`;
};
/** Ce que les jumeaux lisent du LOCK (2026-10-08) : le pas et s'il est fixe (les verrous poses passent par le motif). */
const rytmLockKey = (): string => {
  const s = rytmLock.get();
  return `${s.step}|${s.latched}`;
};

export const Twins: React.FC<TwinsProps> = ({ stage }) => {
  const s = useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  const p = useSyncExternalStore(pattern.subscribe, pattern.get, pattern.get);
  // EDIT du MM-RYTM (2026-10-05) : les steps sont les patterns
  const ptns = useSyncExternalStore(patterns.subscribe, patterns.get, patterns.get);
  const rytmEdit = useSyncExternalStore(editor.subscribe, editor.get, editor.get) === 'mm808';
  const running = useSyncExternalStore(clock.subscribe, () => clock.running, () => clock.running);
  const v = useSyncExternalStore(voices.subscribe, voices.get, voices.get);
  // INFOS du MM-RYTM (R4) : la touche i de l'ecran
  const rytmInfosOn = useSyncExternalStore(rytmInfos.subscribe, rytmInfos.isOn, rytmInfos.isOn);
  const muteOn = v.muteMode || v.muted.length > 0;
  const open = useSyncExternalStore(section.subscribe, section.get, section.get);
  const stretch = useSyncExternalStore(mix.subscribe, () => mix.stretch, () => mix.stretch);
  const level = useSyncExternalStore(mix.subscribe, () => mix.level, () => mix.level);
  const swing = useSyncExternalStore(mix.subscribe, () => mix.swing, () => mix.swing);
  const drive = useSyncExternalStore(mix.subscribe, () => mix.drive, () => mix.drive);
  const reverb = useSyncExternalStore(mix.subscribe, () => mix.reverb, () => mix.reverb);
  const delay = useSyncExternalStore(mix.subscribe, () => mix.delay, () => mix.delay);
  const chorus = useSyncExternalStore(mix.subscribe, () => mix.chorus, () => mix.chorus);
  // Rangee VOICE : la voix du pad selectionne, sinon ses valeurs de depart
  const vfx = useSyncExternalStore(voiceFx.subscribe, voiceFx.get, voiceFx.get);
  // La page du MM-RYTM (2026-10-08) : les jumeaux des potards et des touches de page la suivent
  // Seulement la page, la vue et le pas choisi (2026-10-08, revue de R1) : le contour d'un bloc tourne (l'echo,
  // a chaque cran) ne refait pas les 240 jumeaux ; les valeurs, elles, ont leurs propres abonnements
  useSyncExternalStore(rytmPage.subscribe, rytmPageKey3, rytmPageKey3);
  const rp = rytmPage.get();
  // Le LOCK (2026-10-08) : les potards de page lisent alors les verrous du pas, les pas disent les leurs
  useSyncExternalStore(rytmLock.subscribe, rytmLockKey, rytmLockKey);
  const lockAt = rytmLock.get().step;
  // Le kit : les potards de page de SRC (K.TUNE, ATTACK...) et SOUND suivent ses valeurs
  useSyncExternalStore(kit.subscribe, kit.get, kit.get);
  const els = useRef(new Map<string, HTMLElement>());
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const stageRef = useRef(stage);
  stageRef.current = stage;
  // Deux machines (2026-10-03) : les jumeaux de la 808 ne repondent que quand on l'utilise
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const edOpen = useSyncExternalStore(editor.subscribe, editor.get, editor.get);
  const pm808 = useSyncExternalStore(presetMode.subscribe, () => presetMode.on('mm808'), () => false);
  // L'etape et le curseur des presets (2026-10-27) : le nom de leurs touches en suit
  useSyncExternalStore(presetMode.subscribe, presetMode.get, presetMode.get);
  const off = VOYAGER && f !== 'mm808';
  const groupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = groupRef.current;
    if (!el) return;
    if (off) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }, [off]);
  const showChips = s !== 'closed';
  const live = chipsLive(s);
  const kitNow = useSyncExternalStore(kit.subscribe, kit.get, kit.get);
  // Le navigateur des sons (2026-10-18) : sa liste (role listbox, une option par son) et ses fleches, tant qu'il est
  // ouvert ; la liste des samples bouge (un ajout, un retrait), ses options aussi
  const sbState = useSyncExternalStore(lcdSamples.subscribe, lcdSamples.get, lcdSamples.get);
  useSyncExternalStore(samplesChanged.subscribe, samplesVersion, samplesVersion);
  const sbView = sbState.open ? soundBrowserView() : null;
  // MASTER et TEMPO a l'ecran (2026-10-19) : sur HOME et la vue PAGE, hors P-LOCK, EDIT, les presets et la liste des sons
  const dialsShown = (rp.view === 'home' || rp.view === 'page') && lockAt < 0 && !rytmEdit && !pm808 && !sbView;
  /** la derniere demande de focus vue (Entree sur le bloc SOUND), et si la liste avait le focus (Echap le rend au bloc SOUND) */
  const sbFocusSeen = useRef(sbState.focus);
  const sbHadFocus = useRef(false);
  const pressed = s === 'opening' || s === 'open';
  const inst = p.instrument;
  const sel = p.instrument ? vfx[p.instrument] : VOICE_FX_DEFAULT;
  const values = {
    tempo: p.bpm,
    level,
    swing,
    stretch,
    dist: drive,
    chorus,
    delay,
    reverb,
    vol: sel.level,
    vsound: ((): number => {
      const f = soundFamily();
      return f ? kit.value(f) : 0;
    })(),
    tone: sel.tone,
    vdecay: sel.decay,
    vdist: sel.dist,
    vchorus: sel.chorus,
    vdelay: sel.delay,
    vreverb: sel.reverb,
    vtune: sel.tune,
    vpan: sel.pan,
    vstart: sel.start,
    // L'etape 2 (2026-10-09) : ENV, FINE, le filtre, DLY TIME et DLY FB
    vatk: sel.atk,
    vhold: sel.hold,
    vfine: sel.fine,
    vftype: sel.ftype,
    vfcut: sel.fcut,
    vfreso: sel.freso,
    vfenv: sel.fenv,
    vfatk: sel.fatk,
    vfdec: sel.fdec,
    dtime: pattern.fx.get().dtime,
    dfb: pattern.fx.get().dfb,
    bits: pattern.fx.get().bits,
    comp: pattern.fx.get().comp,
    ...Object.fromEntries(FX_SETTING_IDS.map((k) => [k, pattern.fx.get()[k]])),
  } as Record<EncId, number>;

  /** Ref stable par id : l'element entre et sort des deux registres. */
  const refFor = (id: string): ((el: HTMLElement | null) => void) => {
    let fn = refs.current.get(id);
    if (!fn) {
      fn = (el) => {
        if (el) {
          els.current.set(id, el);
          twinEls.set(id, el);
        } else {
          els.current.delete(id);
          twinEls.delete(id);
        }
      };
      refs.current.set(id, fn);
    }
    return fn;
  };

  // La pose de tous les jumeaux (l'effet ci-dessous) : un jumeau qui revient (le menu de HOME, la liste des sons) s'y pose tout de suite
  const placeRef = useRef<((force: boolean) => void) | null>(null);
  useLayoutEffect(() => {
    if (!stage) return undefined;
    const ids = stage.hit.ids();
    // Dernieres valeurs ecrites par jumeau (x, y, w, h au dixieme de px) : NaN = a ecrire
    const last = new Float64Array(ids.length * 4).fill(NaN);
    /** Ecrit les jumeaux dont le rectangle a change ; force : tous (montage). */
    const place = (force: boolean): void => {
      const r = stage.hit.rects();
      for (let i = 0; i < ids.length; i += 1) {
        const el = els.current.get(ids[i]);
        if (!el) continue;
        const o = i * 4;
        const x = r1(r[o]);
        const y = r1(r[o + 1]);
        const w = r1(r[o + 2]);
        const h = r1(r[o + 3]);
        if (force || x !== last[o] || y !== last[o + 1]) {
          el.style.transform = `translate(${x}px, ${y}px)`;
          last[o] = x;
          last[o + 1] = y;
        }
        if (force || w !== last[o + 2] || h !== last[o + 3]) {
          el.style.width = `${w}px`;
          el.style.height = `${h}px`;
          last[o + 2] = w;
          last[o + 3] = h;
        }
      }
    };
    // Dans la passe de rendu : les jumeaux suivent l'orbite, frame par frame
    const onView = (): void => place(false);
    // La boucle s'arrete (ou un redimensionnement hors boucle) : recalage
    const onIdle = (): void => place(false);
    place(true);
    placeRef.current = place;
    const offView = stage.onView(onView);
    const offIdle = stage.onIdle(onIdle);
    return () => {
      placeRef.current = null;
      offView();
      offIdle();
    };
  }, [stage, showChips]);

  // Les jumeaux qui ne vivent que sur une vue (le menu de HOME, la liste des sons ; la relecture du 2026-10-18) : remontes,
  // leur rectangle n'a pas change et la pose ordinaire les laissait a 0 x 0 en haut a gauche ; on les pose tout de suite
  useLayoutEffect(() => {
    placeRef.current?.(true);
  }, [rp.view, rytmEdit, pm808, !!sbView, lockAt >= 0]);

  // Le navigateur des sons (2026-10-18) : Entree sur le bloc SOUND, le clavier passe a la liste ; la liste fermee alors
  // qu'elle avait le focus (Echap, la tape d'un autre geste, le repos), il revient au bloc SOUND
  useEffect(() => {
    if (!sbView) {
      if (!sbHadFocus.current) return;
      sbHadFocus.current = false;
      for (const pid of PAGE_KNOB_IDS) {
        const k = pageKnobIndex(pid);
        if (pageTarget(k) === 'voice:sound') {
          els.current.get(`lcd-blk-${k}`)?.focus({ preventScroll: true });
          break;
        }
      }
      return;
    }
    if (sbState.focus === sbFocusSeen.current) return;
    sbFocusSeen.current = sbState.focus;
    els.current.get('lcd-sb-body')?.focus({ preventScroll: true });
  });

  // La vue se referme : un focus clavier sur une puce revient au pad OPEN
  useEffect(() => {
    if (live) return;
    const a = document.activeElement;
    if (a instanceof HTMLElement && a.dataset.twin === 'chip') els.current.get('pad-open')?.focus({ preventScroll: true });
  }, [live]);

  // Les puces : juste apres OPEN, qui les decouvre (motif d'un bouton de divulgation)
  const chips =
    showChips &&
    BOARD_CHIPS.map((c) => {
      const id = `chip-${c.id}`;
      const tab = live ? 0 : -1;
      // Focus clavier (focus-visible) : la puce reagit comme au survol
      const onFocus = (e: React.FocusEvent<HTMLElement>): void => {
        if (e.currentTarget.matches(':focus-visible')) stageRef.current?.setChipFocus(c.id);
      };
      const onBlur = (): void => stageRef.current?.setChipFocus(null);
      return c.href ? (
        <a
          key={id}
          ref={refFor(id)}
          className="v4-twin"
          data-twin="chip"
          data-chip={c.id}
          data-hotspot={id}
          href={c.href}
          target="_blank"
          rel={EXTERNAL_REL}
          aria-label={c.aria}
          tabIndex={tab}
          onKeyDown={linkSpace}
          onFocus={onFocus}
          onBlur={onBlur}
          onClick={(e) => {
            // La vue se referme : plus de lien
            if (!chipsLive(explode.get())) e.preventDefault();
          }}
        />
      ) : (
        <button
          key={id}
          ref={refFor(id)}
          type="button"
          className="v4-twin"
          data-twin="chip"
          data-chip={c.id}
          data-hotspot={id}
          aria-label={c.aria}
          aria-expanded={c.section !== null && open === c.section}
          aria-controls={c.section ? `v4-section-${c.section}` : undefined}
          tabIndex={tab}
          onKeyDown={noRepeat}
          onFocus={onFocus}
          onBlur={onBlur}
          onClick={() => chipAction(c.id)}
        />
      );
    });

  // Les jumeaux d'EDIT et d'OPEN : ceux de leurs pads au telephone, de leurs touches au desktop (2026-10-27), les memes ids ;
  // au desktop, leur nom complet en infobulle (title, vide au telephone) et en tete de l'aria-label (la revue : EDIT ne
  // le portait pas)
  const editTwin = (
    <button
      key="pad-edit"
      ref={refFor('pad-edit')}
      type="button"
      className="v4-twin"
      data-twin="edit"
      data-hotspot="pad-edit"
      aria-label={PORTRAIT ? 'Edit the pattern and its velocities, key E' : `${FACE_TITLE['pad-edit']} and the pattern editor with its velocities, key E`}
      aria-pressed={edOpen === 'mm808'}
      title={FACE_TITLE['pad-edit']}
      onKeyDown={noRepeat}
      onClick={() => editToggle('mm808', stageRef.current)}
    />
  );
  const openTwin = (
    <button
      key="pad-open"
      ref={refFor('pad-open')}
      type="button"
      className="v4-twin"
      data-twin="open"
      data-hotspot="pad-open"
      aria-pressed={pressed}
      aria-label={OPEN_ARIA}
      title={FACE_TITLE['pad-open']}
      onKeyDown={noRepeat}
      onClick={() => openToggle(stageRef.current, 'mm808')}
    />
  );

  const padTwins = PADS.map((pad) => {
    const id = `pad-${pad.id}`;
    if (pad.kind === 'voice') {
      return (
        <button
          key={id}
          ref={refFor(id)}
          type="button"
          className="v4-twin"
          data-twin="pad"
          data-hotspot={id}
          aria-label={PAD_ARIA[pad.id]}
          aria-pressed={inst === pad.id}
          onKeyDown={noRepeat}
          onClick={() => padHit(pad.id, stageRef.current)}
          // La touche menu (ou Maj+F10) sur le jumeau d'une voix (2026-10-21, audit) : elle se coupe ou revient, comme le
          // clic droit sur son pad (les jumeaux ne recoivent jamais la souris : pointer-events none)
          onContextMenu={(e) => {
            e.preventDefault();
            padMute(pad.id, stageRef.current);
          }}
        />
      );
    }
    if (pad.kind === 'page') {
      return (
        <button
          key={id}
          ref={refFor(id)}
          type="button"
          className="v4-twin"
          data-twin="page"
          data-hotspot={id}
          aria-label={`${title(pad.label)}, key ${pad.key}`}
          aria-expanded={open === pad.id}
          aria-controls={`v4-section-${pad.id}`}
          onKeyDown={noRepeat}
          onClick={() => page(pad.id, stageRef.current)}
        />
      );
    }
    if (pad.kind === 'edit') return editTwin;
    return openTwin;
  });

  // Les touches des presets (2026-10-27) : leur nom suit l'etape (LOAD, OVERWRITE, YES, OK...) ; une place vide reste
  // dans la tabulation, inerte (le focus ne tombe pas quand elle se vide sous la main)
  const presetTwins = (pm808 ? PRESET_KEYS_ON : PRESET_KEYS_OFF).map((k) => {
    const aria = presetMode.aria('mm808', k);
    return (
      <button
        key={`lcd-${k}`}
        ref={refFor(`lcd-${k}`)}
        type="button"
        className="v4-twin"
        data-twin="lcd"
        data-hotspot={`lcd-${k}`}
        aria-label={aria || 'Empty key'}
        aria-disabled={aria ? undefined : true}
        onKeyDown={noRepeat}
        onClick={() => {
          if (aria) presetKey('mm808', k);
        }}
      />
    );
  });

  // La touche i de l'ecran (R4, 2026-10-08) : INFOS, l'aide au survol
  const infoKeyTwin = (
    <button
      ref={refFor('lcd-i')}
      type="button"
      className="v4-twin"
      data-twin="rinfo"
      data-hotspot="lcd-i"
      aria-label={rytmInfosOn ? 'INFOS on: hover a control of the MM-RYTM (tap on a phone) to read what it does. Press to turn off' : 'INFOS: hover a control of the MM-RYTM (tap on a phone) to read what it does'}
      aria-pressed={rytmInfosOn}
      onKeyDown={noRepeat}
      onClick={() => rytmInfos.toggle()}
    />
  );

  const tweakTwins =
    showChips &&
    KIT_PLATE_IDS.map((k) => {
      // Les TWEAKS du kit (2026-10-04) : juste apres OPEN qui les decouvre, au clavier comme a la souris ; sans les choix de sons (2026-10-18)
      const id = `rk-${k}`;
      const sw = isFamily(k);
      const v = sw ? kit.value(k) : kitNow.knob[k];
      return (
        <div
          key={id}
          ref={refFor(id)}
          className="v4-twin"
          data-twin="rknob"
          data-hotspot={id}
          role="slider"
          tabIndex={live ? 0 : -1}
          aria-label={KIT_ARIA[k]}
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(v * 100)}
          aria-valuetext={kit.readout(k)}
          onKeyDown={onKitKey(k)}
        />
      );
    });

  const dialTwins =
    dialsShown &&
    (['level', 'tempo'] as const).map((k) => {
      // MASTER et TEMPO dans l'ecran (2026-10-19) : leurs jumeaux poses la ou l'ecran les dessine (lcd-master, lcd-tempo)
      const enc = ENCODERS.find((e) => e.id === k) ?? ENCODERS[0];
      const id = k === 'level' ? 'lcd-master' : 'lcd-tempo';
      const v = values[k];
      const tempo = k === 'tempo';
      return (
        <div
          key={id}
          ref={refFor(id)}
          className="v4-twin"
          data-twin="rdial"
          data-hotspot={id}
          role="slider"
          tabIndex={0}
          aria-label={
            // Le desktop (V.4.2, 2026-10-27) : l'ecran ne se touche plus, MASTER et TEMPO sont les potards A et B de la page
            // MASTER ; le telephone garde son texte
            SCREEN_TOUCH
              ? `${enc.aria}, on the screen: drag up or down, double tap for ${tempo ? '130 BPM' : 'its default'}`
              : `${enc.aria}: knob ${tempo ? 'B' : 'A'} of the MASTER page (press FX three times), or the arrow keys here`
          }
          aria-orientation="vertical"
          aria-valuemin={tempo ? BPM.min : 0}
          aria-valuemax={tempo ? BPM.max : 100}
          aria-valuenow={tempo ? v : pct(v)}
          aria-valuetext={tempo ? dialText(k, v) : `${dialText(k, v)}, ${encUnit('level', v).toLowerCase()}`}
          onKeyDown={onDialKey(k)}
        />
      );
    });

  const knobTwins = FACE_KNOBS.filter((k) => isPageKnob(k.id)).map((fk) => {
    const k = pageKnobIndex(fk.id as (typeof PAGE_KNOB_IDS)[number]);
    const id = `penc-${k}`;
    if (FACE_FOLLOWS_PAGE) {
      // Les potards de la face du desktop (2026-10-27) : la fonction posee sur leur case de l'ecran, comme son bloc
      const b = knobBlock(k);
      const d = faceDialOf(k);
      const live = b !== null && pageKnobLive(b);
      const bipolar = live && dialRange(d)[0] < 0;
      const course = b === null ? 0 : pageKnobCourse(b);
      return (
        <div
          key={id}
          ref={refFor(id)}
          className="v4-twin"
          data-twin="penc"
          data-hotspot={id}
          role="slider"
          tabIndex={0}
          aria-label={faceKnobAria(k, b, inst, lockAt)}
          aria-orientation="vertical"
          aria-valuemin={bipolar ? -64 : 0}
          aria-valuemax={bipolar ? 63 : 127}
          aria-valuenow={v127(course, bipolar)}
          aria-valuetext={dialReadout(d)}
          onKeyDown={(e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
              e.preventDefault();
              faceKnobReset(k);
              return;
            }
            // Le premier cran montre la page sous HOME (knobDial) ; le reglage part de la fonction du moment
            onPageKnobKey(faceDialOf(k), (v) => faceKnob(k, v, 'twin'))(e);
          }}
        />
      );
    }
    // Les encodeurs du telephone (2026-10-09) : leur FX global a poste fixe (theme.ts GLOBAL_ENCODERS), jamais un verrou
    const g = GLOBAL_ENCODERS[k];
    const d = g as DialId;
    const [lo, hi] = dialRange(d);
    const course = hi > lo ? (anyDialValue(d) - lo) / (hi - lo) : 0;
    const bipolar = lo < 0;
    return (
      <div
        key={id}
        ref={refFor(id)}
        className="v4-twin"
        data-twin="penc"
        data-hotspot={id}
        role="slider"
        tabIndex={0}
        aria-label={`Knob ${PAGE_KNOB_LETTERS[k]}, global ${GLOBAL_ENC_LABELS[k].toLowerCase()}, the whole machine, never locked`}
        aria-orientation="vertical"
        aria-valuemin={bipolar ? -64 : 0}
        aria-valuemax={bipolar ? 63 : 127}
        aria-valuenow={v127(course, bipolar)}
        aria-valuetext={dialReadout(d)}
        onKeyDown={(e) => {
          if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            globalDial(k, anyDialReset(d));
            return;
          }
          onPageKnobKey(d, (v) => globalDial(k, v))(e);
        }}
      />
    );
  });

  const blockTwins = PAGE_KNOB_IDS.map((pid) => {
    // Les blocs de l'ecran (2026-10-08 ; l'editeur au desktop aussi depuis le 2026-10-09) : ce qu'ils reglent sur l'ecran
    // affiche, de 0 a 127 ; le jumeau se pose sur le bloc (lcd-blk-<k>), present seulement quand l'ecran le dessine
    const k = pageKnobIndex(pid);
    const id = `lcd-blk-${k}`;
    const d = `p:${k}` as DialId;
    const slot = pageSlotOf(k);
    if (!slot || !slot.label || slot.graph) return null;
    // Le nombre de l'ecran : 0 a 127, -64 a +63 pour TONE et STRETCH (un bloc vide : en bas)
    const bipolar = pageKnobLive(k) && dialRange(d)[0] < 0;
    const course = pageKnobCourse(k);
    const what = slot.label;
    return (
      <div
        key={id}
        ref={refFor(id)}
        className="v4-twin"
        data-twin="penc"
        data-hotspot={id}
        role="slider"
        tabIndex={0}
        aria-label={`Screen value ${PAGE_KNOB_LETTERS[k]}, ${SCREEN_TITLE[rytmPage.screen(inst)]}: ${what}${slot.scope === 'track' && inst ? `, ${INST_NAMES[inst]}` : ''}${lockAt >= 0 ? `, P-lock on step ${lockAt + 1}, delete removes its lock` : ''}${pageFxDetail(k) ? ', enter opens its settings' : ''}${slot.target === 'voice:sound' ? ', enter opens the list of sounds' : ''}`}
        aria-orientation="vertical"
        aria-valuemin={bipolar ? -64 : 0}
        aria-valuemax={bipolar ? 63 : 127}
        aria-valuenow={v127(course, bipolar)}
        aria-valuetext={dialReadout(d)}
        onKeyDown={(e) => {
          // Suppr : le verrou du pas en P-LOCK s'en va (deux tapes au pointeur), sinon la valeur de depart
          if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            pageKnobReset(k);
            return;
          }
          // Le nom du son (2026-10-18) : Entree ouvre le navigateur des sons, le clavier y passe ; hors P-LOCK, haut et
          // bas (droite et gauche) sont PREV et NEXT, la liste ouverte, a l'arret le son s'entend
          if (slot.target === 'voice:sound' && !e.altKey && !e.ctrlKey && !e.metaKey) {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (!e.repeat) soundBrowserOpen(true);
              return;
            }
            if (!lockMode() && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
              e.preventDefault();
              soundBrowserStep(e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : -1);
              return;
            }
          }
          // Entree sur un FX de GLOBAL FX (2026-10-10) : sa page, ses reglages (Echap y revient) ; sur VOICE FX, sa page sous la voix
          const fd = e.key === 'Enter' ? pageFxDetail(k) : null;
          if (fd) {
            e.preventDefault();
            rytmFxOpen(fd);
            return;
          }
          onPageKnobKey(d)(e);
        }}
      />
    );
  });

  const browserTwins = sbView && (
    <>
      {/* Le navigateur des sons (2026-10-18) : PREV et NEXT, puis la liste (les fleches deplacent, Entree choisit, Suppr retire un de tes samples, Echap ferme) */}
      <button
        ref={refFor('lcd-sb-prev')}
        type="button"
        className="v4-twin"
        data-twin="sbprev"
        data-hotspot="lcd-sb-prev"
        aria-label={`Previous sound, ${INST_NAMES[sbView.inst]}${sbView.cur <= 0 ? ', this is the first' : ''}`}
        onKeyDown={noRepeat}
        onClick={() => soundBrowserStep(-1)}
      />
      <button
        ref={refFor('lcd-sb-next')}
        type="button"
        className="v4-twin"
        data-twin="sbnext"
        data-hotspot="lcd-sb-next"
        aria-label={`Next sound, ${INST_NAMES[sbView.inst]}${sbView.cur >= sbView.n - 1 ? ', this is the last' : ''}`}
        onKeyDown={noRepeat}
        onClick={() => soundBrowserStep(1)}
      />
      <div
        ref={refFor('lcd-sb-body')}
        className="v4-twin"
        data-twin="sblist"
        data-hotspot="lcd-sb-body"
        role="listbox"
        tabIndex={0}
        aria-label={`${INST_NAMES[sbView.inst]} sounds, ${sbView.n}${sbView.lock >= 0 ? `, P-lock on step ${sbView.lock + 1}` : ''}. Arrows move, Enter chooses, Delete removes one of yours, Escape closes`}
        aria-activedescendant={`v4-sb-opt-${sbView.cursor}`}
        onFocus={() => {
          sbHadFocus.current = true;
        }}
        onBlur={() => {
          sbHadFocus.current = false;
        }}
        onKeyDown={(e) => {
          if (e.altKey || e.ctrlKey || e.metaKey) return;
          const v = soundBrowserView();
          if (!v) return;
          switch (e.key) {
            case 'ArrowDown':
            case 'ArrowRight':
              soundBrowserCursor(1);
              break;
            case 'ArrowUp':
            case 'ArrowLeft':
              soundBrowserCursor(-1);
              break;
            case 'PageDown':
              soundBrowserCursor(v.visible);
              break;
            case 'PageUp':
              soundBrowserCursor(-v.visible);
              break;
            case 'Home':
              soundBrowserCursor(0, 'home');
              break;
            case 'End':
              soundBrowserCursor(0, 'end');
              break;
            case 'Enter':
            case ' ':
              if (!e.repeat) soundBrowserPick(v.cursor);
              break;
            case 'Delete':
            case 'Backspace':
              if (!e.repeat) soundBrowserRemove(v.cursor, 'DELETE');
              break;
            case 'Escape':
              soundBrowserClose();
              break;
            default:
              return;
          }
          e.preventDefault();
        }}
      >
        {sbView.rows.map((r, i) => (
          <div
            key={`${i}|${r.kind}|${r.key}`}
            id={`v4-sb-opt-${i}`}
            className="v4-sr"
            role="option"
            aria-selected={i === sbView.cur}
            onClick={() => soundBrowserPick(i)}
          >
            {r.kind === 'load'
              ? 'Load a file from this device'
              : `${r.label}${r.kind === 'mach' ? ', synth' : r.user ? ', yours, Delete removes it' : ''}${i === sbView.cur ? ', playing' : ''}${i === sbView.arm ? ', press Delete again to remove it' : ''}`}
          </div>
        ))}
      </div>
    </>
  );

  const menuTwins =
    rp.view === 'home' &&
    !rytmEdit &&
    !pm808 &&
    !sbView &&
    HOME_MENU.map((id) => (
      // Le menu de la voix sous HOME (2026-10-18) : ses touches, posees la ou l'ecran les dessine (lcd-menu-<id>)
      <button
        key={`lcd-menu-${id}`}
        ref={refFor(`lcd-menu-${id}`)}
        type="button"
        className="v4-twin"
        data-twin="rmenu"
        data-hotspot={`lcd-menu-${id}`}
        aria-label={id === 'sound' ? (inst ? `Sound of ${INST_NAMES[inst]}: open the list of sounds` : TWIN_ARIA.soundNoVoice) : `${HOME_MENU_LABEL[id]} page${inst ? ` of ${INST_NAMES[inst]}` : ''}`}
        onKeyDown={noRepeat}
        onClick={() => {
          // Au clavier (la relecture) : SOUND donne le focus a la liste ; une page, a sa touche (le menu part avec HOME)
          if (id === 'sound') {
            soundBrowserOpen(true);
            return;
          }
          rytmMenu(id, stageRef.current);
          els.current.get(`pkey-${id}`)?.focus({ preventScroll: true });
        }}
      />
    ));

  // Les touches de page : au desktop (2026-10-27), sans nom ecrit sur la touche, leur nom complet d'abord (Filter page (FLTR))
  const pkeyTwins = RYTM_PAGE_KEYS.map((pk) => (
    <button
      key={`pkey-${pk.id}`}
      ref={refFor(`pkey-${pk.id}`)}
      type="button"
      className="v4-twin"
      data-twin="pkey"
      data-hotspot={`pkey-${pk.id}`}
      aria-label={`${PORTRAIT ? `${pk.label} page` : `${FACE_TITLE[`pkey-${pk.id}`]} (${pk.label})`}${rp.page === pk.id ? (rp.view === 'page' ? ', shown, press again for its next view or HOME' : ', press for the page view') : ''}`}
      aria-pressed={rp.page === pk.id && rp.view === 'page'}
      title={FACE_TITLE[`pkey-${pk.id}`]}
      onKeyDown={noRepeat}
      onClick={() => rytmPageKey(pk.id, stageRef.current)}
    />
  ));
  const runTwin = (
    <button
      ref={refFor('run')}
      type="button"
      className="v4-twin"
      data-twin="run"
      data-hotspot="run"
      aria-label={TWIN_ARIA.run}
      aria-pressed={running}
      title={FACE_TITLE.run}
      onKeyDown={noRepeat}
      onClick={() => runToggle(stageRef.current)}
    />
  );
  const clearTwin = (
    <button
      ref={refFor('clear')}
      type="button"
      className="v4-twin"
      data-twin="clear"
      data-hotspot="clear"
      aria-label={TWIN_ARIA.clear}
      title={FACE_TITLE.clear}
      onKeyDown={noRepeat}
      onClick={() => clearPattern(stageRef.current)}
    />
  );
  const randomTwin = (
    <button
      ref={refFor('random')}
      type="button"
      className="v4-twin"
      data-twin="random"
      data-hotspot="random"
      aria-label={TWIN_ARIA.random}
      title={FACE_TITLE.random}
      onKeyDown={noRepeat}
      onClick={() => randomPattern(stageRef.current)}
    />
  );
  const muteTwin = (
    <button
      ref={refFor('mute')}
      type="button"
      className="v4-twin"
      data-twin="mute"
      data-hotspot="mute"
      aria-label={TWIN_ARIA.mute}
      aria-pressed={muteOn}
      title={FACE_TITLE.mute}
      onKeyDown={noRepeat}
      onClick={() => muteToggle(stageRef.current)}
    />
  );
  const soloTwin = (
    <button
      ref={refFor('solo')}
      type="button"
      className="v4-twin"
      data-twin="solo"
      data-hotspot="solo"
      aria-label={TWIN_ARIA.solo}
      aria-pressed={v.soloMode || v.solo.length > 0}
      title={FACE_TITLE.solo}
      onKeyDown={noRepeat}
      onClick={() => soloToggle(stageRef.current)}
    />
  );

  const stepTwins = STEP_INDEXES.map((i) => {
    const on = rytmEdit ? i === ptns.cur : inst ? isOn(p.steps, inst, i) : false;
    // Ses verrous (2026-10-08) : combien, et s'il est en LOCK
    const nl = inst && !rytmEdit ? lockCount(p.locks, inst, i) : 0;
    const label = rytmEdit
      ? `Pattern ${slotName(i)}${patterns.filled(i) ? '' : ', empty'}${i === ptns.cur ? ', playing' : ''}. Tap to play it, tap others within two seconds to chain them, hold an empty one to copy the current pattern`
      : inst
        ? `Step ${i + 1}, ${INST_NAMES[inst]} ${on ? 'on' : 'off'}${nl > 0 ? `, ${nl} lock${nl > 1 ? 's' : ''}` : ''}${lockAt === i ? ', in lock mode' : ''}. L: lock mode`
        : `Step ${i + 1}, no instrument selected`;
    return (
      <button
        key={i}
        ref={refFor(`step-${i + 1}`)}
        type="button"
        className="v4-twin"
        data-twin="step"
        data-hotspot={`step-${i + 1}`}
        aria-label={label}
        aria-pressed={on}
        onKeyDown={(e) => {
          // Suppr ou retour arriere : le pas se vide (l'appui long du clavier)
          if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            stepClear(i, stage);
          } else if ((e.key === 'l' || e.key === 'L') && !e.repeat && !rytmEdit) {
            // L (2026-10-08) : ce pas en LOCK, ou hors LOCK s'il y est
            e.preventDefault();
            rytmLockToggle(i);
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            // Haut et bas : sa velocite (2026-10-05), un cran
            e.preventDefault();
            const v = stepVelocityOf(i);
            stepVelocity(i, (v > 0 ? v : 6) + (e.key === 'ArrowUp' ? 1 : -1));
          } else noRepeat(e);
        }}
        onClick={() => stepToggle(i, stage)}
      />
    );
  });

  /*
   * SCENE A et B (2026-10-27, la phase 2) : des touches a tenir ou a taper, comme TRK (HoldTwin, aria-pressed). Le
   * crossfader (P2-20) : un curseur natif actif, non controle (XfadeTwin).
   */
  const sceneTwin = (w: 'a' | 'b'): React.ReactElement => {
    const id = w === 'a' ? 'scene-a' : 'scene-b';
    return <HoldTwin key={id} id={id} twin="scene" label={FACE_TITLE[id]} latch={sceneCtl.latch(w)} refFn={refFor(id)} down={(src, t) => sceneDown(w, src, t)} up={(src, t) => sceneUp(w, src, t)} />;
  };
  const xfadeTwin = <XfadeTwin key="xfade" refFn={refFor('xfade')} />;

  return (
    <div ref={groupRef} className="v4-twins" role="group" aria-label={TWIN_ARIA.group} aria-hidden={off || undefined}>
      {PORTRAIT ? (
        // Le telephone (inchange, phase 5) : les pads, l'ecran, les puces et les TWEAKS, les potards, les touches, les pas
        <>
          {padTwins}
          {presetTwins}
          {infoKeyTwin}
          {chips}
          {tweakTwins}
          {dialTwins}
          {knobTwins}
          {blockTwins}
          {browserTwins}
          {menuTwins}
          {pkeyTwins}
          {runTwin}
          {clearTwin}
          {randomTwin}
          {muteTwin}
          {soloTwin}
          {stepTwins}
        </>
      ) : (
        // La face V.4.0 du desktop (2026-10-27) dans son ordre de lecture : l'ecran (en haut a gauche), les huit potards (a
        // sa droite), la rangee des douze touches de gauche a droite (les puces et les TWEAKS juste apres OPEN qui les
        // decouvre), SCENE A, le crossfader, SCENE B, puis les seize pas, rangee du haut puis du bas
        <>
          {presetTwins}
          {infoKeyTwin}
          {dialTwins}
          {blockTwins}
          {browserTwins}
          {menuTwins}
          {knobTwins}
          {/* TRK (2026-10-27, la phase 2) : tenue ou gardee */}
          <HoldTwin key="trk" id="trk" twin="trk" label={FACE_TITLE.trk} latch={trk} refFn={refFor('trk')} down={trkDown} up={trkUp} />
          {pkeyTwins}
          {editTwin}
          {openTwin}
          {chips}
          {tweakTwins}
          {runTwin}
          {clearTwin}
          {randomTwin}
          {muteTwin}
          {soloTwin}
          {sceneTwin('a')}
          {xfadeTwin}
          {sceneTwin('b')}
          {stepTwins}
        </>
      )}
    </div>
  );
};

export default HitLayer;
