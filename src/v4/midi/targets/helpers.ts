/** Les cibles MIDI : les fabriques partagees par les groupes (potards, appuis, touches tenues, crossfader, noms). Deplace de midi/targets.ts en P0. */

import { anyDial, funcDrop, dialEdit, sceneTakeId, dialRange, dialSteps, xfadeGesture, xfadeSet, type DialId } from '../../actions';
import { sceneCtl } from '../../state/sceneCtl';
import { TRIG_PARAMS, TRIG_RANGE, trigValue, type TrigParam } from '../../audio/trig';
import { lfoParts, lfoRange, type LfoParam } from '../../audio/lfo';
import { lfoOf, voiceFx, type VoiceParam } from '../../audio/voicefx';
import { type Inst } from '../../theme';
import { pattern } from '../../audio/pattern';
import type { MidiTarget, TargetScope } from './types';
import { stageNow as getStage } from './stage';

/* ---------------- les potards : un domaine ramene a 0..1 ---------------- */

export function dialTarget(id: string, scope: TargetScope, label: string, dial: DialId): MidiTarget {
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
    // Une scene armee (2026-10-27) : get lit la valeur de la scene (un Roto motorise reste ou on l'a tourne), set y ecrit
    // (anyDial, sceneTake) ; sinon ce qu'on entend (2026-10-28 : la base, ou la scene entendue qui suit le potard)
    get: () => (span > 0 ? (dialEdit(dial) - lo) / span : 0),
    set: (v) => anyDial(dial, dial === 'tempo' ? Math.round(lo + v * span) : lo + v * span),
  };
}

/**
 * Une cible a appui. Une cible du MM-RYTM (V.5.0, la revue de D1, G2) : une FUNC gardee pour une touche s'en va apres elle si
 * elle ne s'en est pas servie (rytm:clear, rytm:open, rytm:pad...) ; celles qui la lisent (rytm:play, rytm:rec...) l'ont deja
 * consommee.
 */
export const press = (id: string, scope: TargetScope, label: string, fn: () => void): MidiTarget => ({
  id,
  scope,
  label,
  kind: 'press',
  down:
    scope === 'mm808'
      ? () => {
          fn();
          funcDrop();
        }
      : fn,
});

/* ---------------- la phase 3 (2026-10-27) : TRK, SCENE A et B, le crossfader ---------------- */

/** Le crossfader en MIDI : le geste finit XFADE_MIDI_SETTLE_MS apres la derniere valeur (le reglage qui attend le repos s'applique). */
const XFADE_MIDI_SETTLE_MS = 150;
let xfMidiTimer = 0;
/** le MIDI a ouvert le geste en cours (un glisser de la souris deja en route garde le sien : le MIDI ne le ferme pas) */
let xfMidiOwns = false;

/** rytm:xfade : le debut du geste a la premiere valeur, x (0 A, 1 B), la fin 150 ms apres la derniere. */
export function xfadeMidi(v: number): void {
  if (xfMidiTimer) window.clearTimeout(xfMidiTimer);
  else if (!sceneCtl.moving()) {
    xfadeGesture('start', 'midi');
    xfMidiOwns = true;
  }
  xfadeSet(v, 'midi');
  xfMidiTimer = window.setTimeout(() => {
    xfMidiTimer = 0;
    if (xfMidiOwns) xfadeGesture('end', 'midi');
    xfMidiOwns = false;
  }, XFADE_MIDI_SETTLE_MS);
}

/** Une touche tenue de la face (TRK, SCENE A et B) : enfoncee par le MIDI, elle s'enfonce aussi a l'ecran. */
export const faceHold = (id: string, label: string, hotspot: string, down: () => void, up: () => void): MidiTarget => ({
  id,
  scope: 'mm808',
  label,
  kind: 'hold',
  gate: 'nonzero',
  down: () => {
    down();
    getStage()?.pressFaceKey(hotspot);
  },
  up,
});

// Les reglages de l'etape 2 (2026-10-09) : ENV ATK et HOLD, VOICE FINE, le filtre de FLTR ; leurs cibles rytm:voice:<voix>:<reglage> s'ajoutent
export const VOICE_LABEL: Readonly<Record<VoiceParam, string>> = {
  level: 'VOLUME',
  tone: 'TONE',
  decay: 'DECAY',
  dist: 'DIST',
  chorus: 'CHORUS',
  delay: 'DELAY',
  reverb: 'REVERB',
  tune: 'TUNE',
  pan: 'PAN',
  start: 'START',
  atk: 'ATTACK',
  hold: 'HOLD',
  fine: 'FINE',
  ftype: 'FILTER TYPE',
  fcut: 'FILTER FREQ',
  freso: 'FILTER RESO',
  fenv: 'FILTER ENV',
  fatk: 'FILTER ATTACK',
  fdec: 'FILTER DECAY',
};

/** Les noms des reglages de trig et des LFO (V.5.1) dans la liste du MIDI. */
export const TRIG_LABEL: Readonly<Record<TrigParam, string>> = {
  len: 'TRIG LENGTH',
  prob: 'TRIG PROBABILITY',
  cond: 'TRIG CONDITION',
  utime: 'TRIG MICRO TIMING',
  lfot: 'TRIG LFO RESTART',
  rtrg: 'RETRIG ON',
  rate: 'RETRIG RATE',
  vfad: 'RETRIG VELOCITY FADE',
  rlen: 'RETRIG LENGTH',
};
export const LFO_LABEL: Readonly<Record<string, string>> = { spd: 'SPEED', mul: 'MULTIPLIER', fad: 'FADE', dst: 'DESTINATION', wav: 'WAVE', phs: 'PHASE', mod: 'MODE', dep: 'DEPTH' };

/**
 * Un reglage de trig ou d'un LFO d'une voix (V.5.1) : sa course 0 a 1 sur ses crans (des entiers) ; il regle la voix sans la
 * choisir, comme rytm:voice:<voix>:<reglage> de toujours. Une scene armee : NO SCENE (sceneTakeId, le role noscene).
 */
export function seqTarget(inst: Inst, p: TrigParam | LfoParam): MidiTarget {
  const trig = (TRIG_PARAMS as readonly string[]).includes(p);
  const [lo, hi] = trig ? TRIG_RANGE[p as TrigParam] : lfoRange(p as LfoParam);
  const id = `rytm:voice:${inst}:${p}`;
  const label = trig ? `${inst} ${TRIG_LABEL[p as TrigParam]}` : `${inst} LFO${lfoParts(p as LfoParam).n} ${LFO_LABEL[lfoParts(p as LfoParam).key]}`;
  const now = (): number => (trig ? trigValue(pattern.get().trigs, inst, p as TrigParam) : lfoOf(voiceFx.of(inst), p as LfoParam));
  return {
    id,
    scope: 'mm808',
    label,
    kind: 'value',
    steps: hi - lo + 1,
    get: () => (hi > lo ? (now() - lo) / (hi - lo) : 0),
    set: (v) => {
      if (sceneTakeId(id, v)) return;
      const x = Math.round(lo + Math.max(0, Math.min(1, v)) * (hi - lo));
      if (trig) pattern.setTrig(inst, p as TrigParam, x);
      else voiceFx.setLfo(inst, p as LfoParam, x);
    },
  };
}
