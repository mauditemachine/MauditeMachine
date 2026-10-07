/**
 * Les cibles MIDI du MM-DECKS (2026-10-05, midi/targets.ts) : chaque
 * potard (EQ, FILTER, effets, FX TO, MASTER), chaque fader (voies, pitch)
 * et chaque touche (CUE et PLAY, le sampler, boucles, BEND, SYNC, TIME, ADD
 * DECK...) des platines posees. Une touche tient comme au
 * clavier : appui, puis relachement (CUE ecoute tant qu'on tient). Inscrites
 * au chargement du code du MM-DECKS (state/djload.ts).
 */

import { registerTargets, stageNow, type MidiTarget } from '../midi/targets';
import { faderMin, faderValue, keyDown, keyUp, knobMin, knobSteps, knobValue, setFader, setKnob } from './gestures';
import { DJ_FADERS, DJ_KEYS, DJ_KNOBS, djFader, djKey, djKnob, type DjFaderSpec, type DjKeySpec, type DjKnobSpec } from './layout';
import { faderName, keyName, knobName } from './names';
import { DJ_DECKS, type DjDeck } from './theme';
import { SMPL_KNOBS } from '../sampler/params';
import { samplerOf, type Sampler } from '../sampler/sampler';
import { SMPL_PADS } from '../sampler/slices';

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

/*
 * Le sampler de chaque platine (2026-10-07) : ses douze reglages, ses seize
 * pads (tenus), et ses fonctions de l'ecran (MODE, SLICES, LEN, REV, LOOP,
 * RANDOM, CLEAR, SAVE, STOP) ; SMPL, REC DECK, REC MIX et PLAY sont des
 * touches de la platine (plus haut). Ids : dj:smpl:<platine>:knob:<reglage>,
 * dj:smpl:<platine>:pad:<0-15>, dj:smpl:<platine>:<fonction>.
 */
const SMPL_FNS: readonly { fn: string; label: string; run: (s: Sampler) => void }[] = [
  { fn: 'mode', label: 'MODE', run: (s) => s.modeToggle() },
  { fn: 'slices', label: 'SLICES', run: (s) => s.slicingNext() },
  { fn: 'len', label: 'LEN', run: (s) => s.lenNext() },
  { fn: 'rev', label: 'REV', run: (s) => s.reverseToggle() },
  { fn: 'loop', label: 'LOOP', run: (s) => s.loopToggle() },
  { fn: 'random', label: 'RANDOM', run: (s) => s.random() },
  { fn: 'clear', label: 'CLEAR', run: (s) => s.clear() },
  { fn: 'save', label: 'SAVE', run: (s) => s.save() },
  { fn: 'stop', label: 'STOP', run: (s) => s.stopAll() },
];

function smplTargets(d: DjDeck): MidiTarget[] {
  const D = d.toUpperCase();
  const sm = (): Sampler => samplerOf(d);
  const out: MidiTarget[] = [];
  for (const k of SMPL_KNOBS) {
    out.push({ id: `dj:smpl:${d}:knob:${k.id}`, scope: 'dj', label: `SMPL ${D} ${k.label}`, kind: 'value', steps: k.steps ?? 0, get: () => sm().params.of(k.id), set: (v) => sm().dial(k.id, v) });
  }
  for (const f of SMPL_FNS) out.push({ id: `dj:smpl:${d}:${f.fn}`, scope: 'dj', label: `SMPL ${D} ${f.label}`, kind: 'press', down: () => f.run(sm()) });
  for (let i = 0; i < SMPL_PADS; i += 1) out.push({ id: `dj:smpl:${d}:pad:${i}`, scope: 'dj', label: `SMPL ${D} PAD ${i + 1}`, kind: 'hold', down: () => sm().trig(i, true), up: () => sm().trig(i, false) });
  return out;
}

function findSmpl(id: string): MidiTarget | undefined {
  const d = id.split(':')[2] as DjDeck;
  if (!DJ_DECKS.includes(d)) return undefined;
  return smplTargets(d).find((t) => t.id === id);
}

function find(id: string): MidiTarget | undefined {
  if (id.startsWith('dj:smpl:')) return findSmpl(id);
  const cid = id.slice(3);
  const k = djKnob(cid);
  if (k) return knobTarget(k);
  const f = djFader(cid);
  if (f) return faderTarget(f);
  const key = djKey(cid);
  return key ? keyTarget(key) : undefined;
}

registerTargets('dj', () => [...DJ_KNOBS.map(knobTarget), ...DJ_FADERS.map(faderTarget), ...DJ_KEYS.map(keyTarget), ...DJ_DECKS.flatMap(smplTargets)], find);
