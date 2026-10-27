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
import { trkLeds } from '../rytm/stepLeds';
import { faceTouch, type CtlSrc } from '../state/ctl';
import type { HoldMode } from '../state/holdLatch';
import { patterns, slotName } from '../state/patterns';
import { rytmPage, type RytmView } from '../state/rytmPage';
import { sceneCtl } from '../state/sceneCtl';
import { trk } from '../state/trk';
import { voices } from '../state/voices';
import { TRK_LIT, type Inst } from '../theme';

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

/** Un pas 1 a 8 en vue TRK : la couleur de sa voix (#RRGGBB), son eclat, la barre MUTE ou SOLO. */
export interface HwStepLed {
  readonly inst: Inst;
  readonly color: string;
  readonly level: number;
  readonly bar: 'mute' | 'solo' | null;
}

export interface HwSnapshot {
  readonly page: { readonly page: RytmPageId; readonly tab: number; readonly screen: RytmScreenId; readonly view: RytmView };
  readonly voice: Inst | null;
  readonly pattern: { readonly slot: number; readonly name: string; readonly next: number };
  readonly tempo: number;
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
  };
}

/** Le temoin d'une scene qui a des valeurs : 0.15 + 0.85 x ce qu'on en entend (la regle de scene/rytmFaceKeys.ts SCENE_LED). */
const SCENE_LED_MIN = 0.15;
const SCENE_LED_SPAN = 0.85;

/** La derniere cause de chaque potard (hw/index.ts la tient a jour ; value tant que rien n'est venu). */
export type KnobCauses = readonly KnobCause[];

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
  return {
    page: { page: rp.page, tab: rp.tabs[rp.page] ?? 0, screen: rytmPage.screen(inst), view: rp.view },
    voice: inst,
    pattern: { slot: ps.cur, name: slotName(ps.cur), next: ps.next },
    tempo: p.bpm,
    running: clock.running,
    knobs,
    trk: { mode: t.mode, holders: [...t.holders] },
    scenes: { armed: arm.armed, how: arm.how, count: { a: na, b: nb }, x, moving: sceneCtl.moving() },
    leds: {
      trk: { on: engaged, blink: t.mode === 'latched', level: engaged ? 1 : 0 },
      sceneA: { on: arm.armed === 'a', blink: arm.armed === 'a' && arm.how === 'latched', level: na > 0 ? SCENE_LED_MIN + SCENE_LED_SPAN * (1 - x) : 0 },
      sceneB: { on: arm.armed === 'b', blink: arm.armed === 'b' && arm.how === 'latched', level: nb > 0 ? SCENE_LED_MIN + SCENE_LED_SPAN * x : 0 },
      steps: engaged
        ? trkLeds(inst, v.muted, v.solo, TRK_LIT)
            .slice(0, 8)
            .filter((l): l is typeof l & { inst: Inst } => l.inst !== null)
            .map((l) => ({ inst: l.inst, color: l.color, level: l.level, bar: l.bar }))
        : null,
    },
  };
}
