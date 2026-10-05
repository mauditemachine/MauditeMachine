/**
 * Les cibles MIDI du MM-DECKS (2026-10-05, midi/targets.ts) : chaque
 * potard (EQ, FILTER, effets, FX TO, MASTER), chaque fader (voies, pitch)
 * et chaque touche (CUE et PLAY, hot cues, boucles, BEND, SYNC, TIME, ADD
 * DECK, LOOP > SMPL...) des platines posees. Une touche tient comme au
 * clavier : appui, puis relachement (CUE ecoute tant qu'on tient). Inscrites
 * au chargement du code du MM-DECKS (state/djload.ts).
 */

import { registerTargets, stageNow, type MidiTarget } from '../midi/targets';
import { faderMin, faderValue, keyDown, keyUp, knobMin, knobSteps, knobValue, setFader, setKnob } from './gestures';
import { DJ_FADERS, DJ_KEYS, DJ_KNOBS, djFader, djKey, djKnob, type DjFaderSpec, type DjKeySpec, type DjKnobSpec } from './layout';
import { faderName, keyName, knobName } from './names';

const up = (s: string): string => s.toUpperCase();

function knobTarget(k: DjKnobSpec): MidiTarget {
  const lo = knobMin(k);
  return {
    id: `dj:${k.id}`,
    scope: 'dj',
    label: up(knobName(k)),
    kind: 'value',
    steps: knobSteps(k),
    get: () => {
      const cur = djKnob(k.id) ?? k;
      return (knobValue(cur) - lo) / (1 - lo);
    },
    set: (v) => {
      const cur = djKnob(k.id);
      if (cur) setKnob(cur, lo + v * (1 - lo));
    },
  };
}

function faderTarget(f: DjFaderSpec): MidiTarget {
  const lo = faderMin(f);
  return {
    id: `dj:${f.id}`,
    scope: 'dj',
    label: up(faderName(f)),
    kind: 'value',
    get: () => {
      const cur = djFader(f.id) ?? f;
      return (faderValue(cur) - lo) / (1 - lo);
    },
    set: (v) => {
      const cur = djFader(f.id);
      if (cur) setFader(cur, lo + v * (1 - lo));
    },
  };
}

function keyTarget(k: DjKeySpec): MidiTarget {
  return {
    id: `dj:${k.id}`,
    scope: 'dj',
    label: up(keyName(k)),
    kind: 'hold',
    down: () => {
      const cur = djKey(k.id);
      if (cur) keyDown(cur, stageNow(), false);
    },
    up: () => {
      const cur = djKey(k.id);
      if (cur) keyUp(cur, stageNow(), true);
    },
  };
}

function find(id: string): MidiTarget | undefined {
  const cid = id.slice(3);
  const k = djKnob(cid);
  if (k) return knobTarget(k);
  const f = djFader(cid);
  if (f) return faderTarget(f);
  const key = djKey(cid);
  return key ? keyTarget(key) : undefined;
}

registerTargets('dj', () => [...DJ_KNOBS.map(knobTarget), ...DJ_FADERS.map(faderTarget), ...DJ_KEYS.map(keyTarget)], find);
