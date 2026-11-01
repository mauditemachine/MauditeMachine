/**
 * L'etat du MM-RYTM d'un coup (2026-10-27, la phase 3) : ce que le pont MMHW v2 lit a la connexion du boitier (ou apres un
 * trou) pour poser ses moteurs et ses LEDs sans attendre un changement. Lu dans les stores a chaque appel, rien n'est
 * garde ; un objet neuf, simple (JSON), que le pont peut garder.
 */

import { clock } from '../audio/clock';
import { pattern } from '../audio/pattern';
import { faceKnobs, type KnobCause } from '../rytm/faceKnobs';
import type { RytmPageId, RytmScreenId } from '../rytm/pages';
import { sceneCount, type SceneId } from '../rytm/sceneData';
import { muteLeds, trkLeds } from '../rytm/stepLeds';
import { bankLeds, faceLeds, muteLeds16, ptnLeds, rowLeds, trackLeds16, trigLeds, type FaceState, type HwFaceLed, type HwGridLed, type HwRowLed, type HwTrackLed, type HwTrigLeds, type TracksState } from './rowLeds';
import { TRACK_KEYS, TRACK_NAMES, trackIndex } from '../audio/tracks';
import { stageNow } from '../midi/targets/stage';
import { lcdSamples } from '../state/lcdSamples';
import { trigMarks } from '../rytm/trigMarks';
import { fill } from '../state/fill';
import { dtFace } from '../state/dtFace';
import { editor } from '../state/editor';
import { func } from '../state/func';
import { faceTouch, type CtlSrc } from '../state/ctl';
import type { HoldMode } from '../state/holdLatch';
import { presetMode, type PresetStage } from '../state/presetMode';
import { bankGrid, bankName, bankOf, patterns, slotName } from '../state/patterns';
import { rytmPage, type RytmView } from '../state/rytmPage';
import { sceneCtl } from '../state/sceneCtl';
import { tempoSync } from '../state/tempoSync';
import { trk } from '../state/trk';
import { voices } from '../state/voices';
import { DT2_FACE, DT_FACE, DT_HEX_DARK, SCREEN_TOUCH, STEP_LIT, TRK_LIT, type Inst } from '../theme';

export interface HwKnob {
  /** 0 a 7 (CC 20 a 27 du boitier) */
  readonly k: number;
  /** A a H */
  readonly letter: string;
  /** le nom du bloc que tourne le potard sur l'ecran affiche ('' : rien) */
  readonly label: string;
  /** 0 a 1 : la position du moteur */
  readonly value: number;
  /** a zero au centre */
  readonly bipolar: boolean;
  /** ses crans (0 : continu) */
  readonly steps: number;
  /** live : il regle quelque chose ; off, picture, empty : rien a regler (le moteur reste ou il est) */
  readonly state: 'live' | 'off' | 'picture' | 'empty';
  /** pourquoi sa valeur a change en dernier (rytm/faceKnobs.ts) */
  readonly cause: KnobCause;
  /** cause pot : d'ou venait ce tour (hw : le potard du boitier lui-meme) ; null : jamais tourne */
  readonly by: CtlSrc | null;
}

/** Une LED : allumee, clignotante (tenue gardee), son eclat 0 a 1. */
export interface HwLed {
  readonly on: boolean;
  readonly blink: boolean;
  readonly level: number;
}

/** Un pas 1 a 8 en vue TRK : sa couleur (#RRGGBB, la meme pour les huit depuis V.4.2, steps.trkColor), son eclat, la barre MUTE ou SOLO. */
export interface HwStepLed {
  readonly inst: Inst;
  readonly color: string;
  readonly level: number;
  readonly bar: 'mute' | 'solo' | null;
}

/**
 * Les presets du MM-RYTM ouverts (V.4.2, 2026-10-27, state/presetMode.ts). face : la face les mene (l'ecran ne se touche
 * pas, theme.ts SCREEN_TOUCH faux) : un potard fait defiler la liste (pour nommer, A la lettre et B le curseur), les
 * cinq touches VOICE FLTR ENV FX EDIT sont celles de l'ecran (keys, dans cet ordre : LOAD SAVE NAME DEL EXIT, puis
 * OVERWRITE, YES, OK... selon l'etape ; '' une touche vide) ; faux : on les touche a l'ecran.
 */
export interface HwPresets {
  readonly stage: PresetStage;
  /** la ligne du curseur (MIKA/DEEP KICK, ACID), ou le nom en cours a l'etape name */
  readonly name: string;
  readonly keys: readonly string[];
  readonly face: boolean;
}

export interface HwSnapshot {
  readonly page: { readonly page: RytmPageId; readonly tab: number; readonly screen: RytmScreenId; readonly view: RytmView };
  readonly voice: Inst | null;
  /**
   * V.6.0 (cahier dt2 4.5 : "voice garde + track + trackName") : la piste choisie, 0 a 15 (-1 : aucune), et son nom (T1 a
   * T16, '' : aucune). voice reste la cle d'heritage (BD a CY) des pistes 1 a 8.
   */
  readonly track: number;
  readonly trackName: string;
  /** le pattern qui joue (A01 a H16), celui qui attend ; bank : la banque que montre la grille (V.5.2) */
  readonly pattern: { readonly slot: number; readonly name: string; readonly next: number; readonly bank: string };
  readonly tempo: number;
  /**
   * le TEMPO suit la platine MASTER (2026-10-27, revue SEAM-6 : le SYNC du MIXER, state/tempoSync.ts) : tempo est alors
   * le sien, au centieme, et le potard B de la page MASTER y revient s'il est tourne
   */
  readonly sync: boolean;
  /** le TEMPO tel que l'ecran le dit : 124 BPM, ou 124.4 SYNC en suivant (tempoSync.label) */
  readonly tempoLabel: string;
  readonly running: boolean;
  readonly knobs: readonly HwKnob[];
  readonly trk: { readonly mode: HoldMode; readonly holders: readonly string[] };
  readonly scenes: {
    readonly armed: SceneId | null;
    readonly how: 'held' | 'latched' | null;
    readonly count: { readonly a: number; readonly b: number };
    /** le crossfader, 0 (A) a 1 (B) */
    readonly x: number;
    readonly moving: boolean;
  };
  readonly leds: {
    readonly trk: HwLed;
    readonly sceneA: HwLed;
    readonly sceneB: HwLed;
    /** les pas 1 a 8 tant que TRK est engagee (tenue, gardee, en fermeture) ; null : TRK eteinte (les pas montrent le motif) */
    readonly steps: readonly HwStepLed[] | null;
    /**
     * V.5.0 (2026-10-29, la face facon Digitakt du desktop) : les quatorze touches de la rangee, leur couleur et leur eclat
     * (hw/rowLeds.ts ; STOP, YES et NO : leur eclair n'est pas dans l'instantane) ; [] au telephone
     */
    readonly keys: readonly HwRowLed[];
    /** ce que montrent les seize pas : le motif, la vue TRK, le mode MUTE (global, du pattern), la grille PTN */
    readonly view: 'pattern' | 'trk' | 'mute' | 'pmute' | 'ptn' | 'bank';
    /** les seize pas du mode MUTE (vert ou magenta, blanc en solo) et de la vue PTN (rouge, blanc faible) ; null sinon */
    readonly grid: readonly HwGridLed[] | null;
    /**
     * V.5.1 (2026-10-29) : dans la vue du motif, les lock trigs de la voix choisie (en jaune, sans note) et ses pas a COND
     * ou PROB (le point jaune) ; null : une autre vue, aucune voix choisie, le telephone
     */
    readonly trigs: HwTrigLeds | null;
    /**
     * V.6.0 (la face Digitakt II, ?face=dt2) : les 25 touches de la face DT2 dans l'ordre de lecture (hw/rowLeds.ts
     * DT2_KEYS_HW, faceLeds), lues sur la face 3D quand elle est la ; [] sans le drapeau (keys garde les quatorze d'avant)
     */
    readonly face: readonly HwFaceLed[];
    /** V.6.0 : les 8 LED de page (count, shown, playing, levels 0 a 1, 1 a 4 en haut) ; null sans le drapeau */
    readonly pages: { readonly count: number; readonly shown: number; readonly playing: number; readonly levels: readonly number[] } | null;
    /**
     * V.6.0 : les seize pistes tant que TRK est engagee ({ i, name, color, level, bar }) ; 9 a 16 eteintes sans le drapeau
     * (la face V.5.3 n'en a que 8) ; null : TRK eteinte. steps garde les huit d'avant.
     */
    readonly tracks: readonly HwTrackLed[] | null;
  };
  /** V.5.1 : FILL est tenu (YES tenu, rytm:fill) */
  readonly fill: boolean;
  /** les presets ouverts : les potards ne reglent plus leur page (label et value restent ceux de la page cachee) ; null : fermes */
  readonly presets: HwPresets | null;
}

/** Le temoin d'une scene qui a des valeurs : 0.15 + 0.85 x ce qu'on en entend (la regle de scene/rytmFaceKeys.ts SCENE_LED). */
const SCENE_LED_MIN = 0.15;
const SCENE_LED_SPAN = 0.85;

/** La derniere cause de chaque potard (hw/index.ts la tient a jour ; value tant que rien n'est venu). */
export type KnobCauses = readonly KnobCause[];

/**
 * Les couleurs de la face facon Digitakt pour le boitier (V.5.0) : celles de la machine noire (theme.ts DT_HEX_DARK, la revue
 * de D1, R10 : une seule palette), le boitier n'a pas de creme.
 */
const HW_PAL = DT_HEX_DARK;

/** Les marques des trigs de la voix choisie (V.5.1) : le jaune de la machine noire. */
function trigLedsNow(inst: Inst): HwTrigLeds {
  const p = pattern.get();
  const m = trigMarks(p.steps[inst], p.locks, p.trigs, inst);
  return trigLeds(m.ltrg, m.cond, HW_PAL.yellow);
}

/** Les 8 LED de page en V.6.0 (16 pas, une page) : la premiere pleine, les autres eteintes (cahier dt2 2.4). */
const PAGES_60 = { count: 1, shown: 0, playing: -1, levels: [1, 0, 0, 0, 0, 0, 0, 0] } as const;

/**
 * La face DT2 pour le boitier (V.6.0, ?face=dt2) : ce que montre la face 3D (scene/rytmFaceKeys.ts info() : menus, PERFORM,
 * FILL, BANK, REC, verrous de page, LED de page, que B4 et B5 y posent), et les stores tant que la face n'est pas la (un
 * test, le pont avant le premier rendu).
 */
function dt2Leds(ptnOpen: boolean, trkMode: FaceState['trk'], page: string, home: boolean): { face: HwFaceLed[]; pages: HwSnapshot['leds']['pages'] } {
  const fi = stageNow()?.faceKeys?.info() ?? null;
  const menu: FaceState['menu'] = fi?.menu ?? (presetMode.on('mm808') ? 'preset' : lcdSamples.isOpen() ? 'sounds' : null);
  const rec: FaceState['rec'] = fi && fi.recMode !== 'off' ? fi.recMode : dtFace.rec() ? (dtFace.live() ? 'live' : 'grid') : 'off';
  const state: FaceState = {
    func: func.get().mode,
    trk: trkMode,
    ptn: ptnOpen,
    bank: fi?.bank ?? (ptnOpen && dtFace.bank()),
    keyboard: fi?.keyboard ?? false,
    song: fi?.song ?? 'off',
    menu,
    perform: fi?.perform ?? false,
    fill: fi && fi.fill !== 'off' ? fi.fill : fill.on ? 'on' : 'off',
    rec,
    play: clock.running ? 'run' : clock.paused ? 'pause' : 'stop',
    page,
    home,
    pageLocks: fi?.pageLocks ?? [],
  };
  const pl = fi?.pageLeds ?? null;
  return { face: faceLeds(state, HW_PAL), pages: pl ? { count: pl.count, shown: pl.shown, playing: pl.playing, levels: [...pl.levels] } : { ...PAGES_60, levels: [...PAGES_60.levels] } };
}

export function getSnapshot(causes?: KnobCauses): HwSnapshot {
  const p = pattern.get();
  const inst = p.instrument;
  const rp = rytmPage.get();
  const ps = patterns.get();
  const arm = sceneCtl.get();
  const sc = pattern.scenes.get();
  const x = sceneCtl.x();
  const t = trk.get();
  const v = voices.get();
  const na = sceneCount(sc, 'a');
  const nb = sceneCount(sc, 'b');
  const engaged = t.mode !== 'off';
  const pv = presetMode.on('mm808') ? presetMode.view('mm808') : null;
  const knobs: HwKnob[] = faceKnobs.get().map((kv) => ({
    k: kv.k,
    letter: kv.letter,
    label: kv.label,
    value: kv.pos,
    bipolar: kv.bipolar,
    steps: kv.steps,
    state: kv.state,
    cause: causes?.[kv.k] ?? 'value',
    by: causes?.[kv.k] === 'pot' ? faceTouch.lastSrc(kv.k) : null,
  }));
  // V.5.0 : la rangee, et ce que montrent les pas (le mode MUTE et la grille PTN gagnent sur le motif, TRK sur tout)
  const dm = DT_FACE ? dtFace.mute() : 'off';
  const ptnOpen = editor.get() === 'mm808';
  const view: HwSnapshot['leds']['view'] = engaged ? 'trk' : dm === 'global' ? 'mute' : dm === 'pattern' ? 'pmute' : DT_FACE && ptnOpen ? (dtFace.bank() ? 'bank' : 'ptn') : 'pattern';
  const bg = bankGrid(patterns.shown());
  const keys = DT_FACE
    ? rowLeds({ func: func.get().mode, trk: t.mode, ptn: ptnOpen || presetMode.on('mm808'), rec: dtFace.rec(), live: dtFace.live(), play: clock.running ? 'run' : clock.paused ? 'pause' : 'stop', page: rp.page, home: rp.view === 'home' }, HW_PAL)
    : [];
  // V.6.0 : les seize pistes (la face DT2 en montre 16, la V.5.3 8 : 9 a 16 eteintes), lues comme le sequenceur les lit
  const tr: TracksState = {
    cur: inst ? trackIndex(inst) : -1,
    muted: TRACK_KEYS.map((k) => voices.isMuted(k)),
    pmuted: TRACK_KEYS.map((k) => (p.pmutes as readonly string[]).includes(k)),
    solo: TRACK_KEYS.map((k) => voices.isSolo(k)),
    count: DT2_FACE ? 16 : 8,
  };
  const grid =
    view === 'mute' || view === 'pmute'
      ? DT2_FACE
        ? muteLeds16(view === 'mute' ? 'global' : 'pattern', tr, HW_PAL)
        : muteLeds(view === 'mute' ? 'global' : 'pattern', v.muted, p.pmutes, v.solo, HW_PAL).map((l, i) => ({ i, color: l.color, level: l.level, blink: false }))
      : view === 'ptn'
        ? ptnLeds(bg.cur, bg.next, bg.chain, bg.filled, HW_PAL, STEP_LIT.dtEdit)
        : view === 'bank'
          ? bankLeds(bankOf(ps.cur), ps.bank, Array.from({ length: 8 }, (_, b) => patterns.bankFilled(b)), HW_PAL, STEP_LIT.dtEdit)
          : null;
  const dt2 = DT2_FACE ? dt2Leds(ptnOpen, t.mode, rp.page, rp.view === 'home') : null;
  return {
    page: { page: rp.page, tab: rp.tabs[rp.page] ?? 0, screen: rytmPage.screen(inst), view: rp.view },
    voice: inst,
    track: tr.cur,
    trackName: tr.cur >= 0 ? (TRACK_NAMES[tr.cur] ?? '') : '',
    pattern: { slot: ps.cur, name: slotName(ps.cur), next: ps.next, bank: bankName(patterns.shown()) },
    tempo: p.bpm,
    sync: tempoSync.get() !== null,
    tempoLabel: tempoSync.label(p.bpm),
    running: clock.running,
    knobs,
    trk: { mode: t.mode, holders: [...t.holders] },
    scenes: { armed: arm.armed, how: arm.how, count: { a: na, b: nb }, x, moving: sceneCtl.moving() },
    leds: {
      trk: { on: engaged, blink: t.mode === 'latched', level: engaged ? 1 : 0 },
      sceneA: { on: arm.armed === 'a', blink: arm.armed === 'a' && arm.how === 'latched', level: na > 0 ? SCENE_LED_MIN + SCENE_LED_SPAN * (1 - x) : 0 },
      sceneB: { on: arm.armed === 'b', blink: arm.armed === 'b' && arm.how === 'latched', level: nb > 0 ? SCENE_LED_MIN + SCENE_LED_SPAN * x : 0 },
      steps: engaged
        ? // V.5.0 au desktop : le rouge de la Digitakt, la barre verte des voix qui jouent (blanche en solo)
          trkLeds(inst, v.muted, v.solo, TRK_LIT, DT_FACE ? HW_PAL : undefined, DT_FACE ? p.pmutes : [])
            .slice(0, 8)
            .filter((l): l is typeof l & { inst: Inst } => l.inst !== null)
            .map((l) => ({ inst: l.inst, color: l.color, level: l.level, bar: l.bar }))
        : null,
      keys,
      view,
      grid,
      trigs: DT_FACE && view === 'pattern' && inst ? trigLedsNow(inst) : null,
      face: dt2 ? dt2.face : [],
      pages: dt2 ? dt2.pages : null,
      tracks: engaged ? trackLeds16(tr, HW_PAL, TRK_LIT) : null,
    },
    presets: pv ? { stage: pv.stage, name: pv.name, keys: [...pv.keys], face: !SCREEN_TOUCH } : null,
    fill: fill.on,
  };
}
