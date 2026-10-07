/**
 * Les cibles MIDI du MM-BASS (2026-10-07, midi/targets.ts) : ses dix-huit
 * potards (bass:knob:<id>), ses onze touches (bass:key:<touche>, EDIT
 * compris), RUN en bascule (bass:running, la LED suit), ses seize pas
 * (bass:trig:<0-15> : comme un appui sur le pas ; en EDIT, un pattern), leurs
 * seize LOCK (bass:lock:<0-15>) et LOCK sur le pas choisi (bass:lock), comme
 * sur une Elektron : un potard du son tourne pendant un LOCK ne change que
 * ce pas. Inscrites au chargement de son code (state/bassload.ts).
 */

import { registerTargets, type MidiTarget } from '../midi/targets';
import { bassDial, bassKnobValue, bassLockTap, bassLockToggle, bassRun, bassStepTap } from './actions';
import { bassKeyAction } from './gestures';
import { BASS_KNOBS } from './params';
import { bassSeq } from './seq';
import { BASS_STEPS } from './state';
import { BASS_KEYS } from './theme';

function all(): MidiTarget[] {
  const out: MidiTarget[] = [];
  for (const k of BASS_KNOBS) {
    out.push({ id: `bass:knob:${k.id}`, scope: 'bass', label: k.label, kind: 'value', steps: k.steps ?? 0, get: () => bassKnobValue(k.id), set: (v) => bassDial(k.id, v) });
  }
  for (const k of BASS_KEYS) out.push({ id: `bass:key:${k.kind}`, scope: 'bass', label: k.kind === 'run' ? 'RUN/STOP' : k.label, kind: 'press', down: () => bassKeyAction(k.kind) });
  out.push({
    id: 'bass:running',
    scope: 'bass',
    label: 'RUN (ON / OFF)',
    kind: 'value',
    steps: 2,
    get: () => (bassSeq.running ? 1 : 0),
    set: (v) => {
      if (v >= 0.5 !== bassSeq.running) bassRun();
    },
  });
  for (let i = 0; i < BASS_STEPS; i += 1) out.push({ id: `bass:trig:${i}`, scope: 'bass', label: `STEP ${i + 1}`, kind: 'press', down: () => bassStepTap(i) });
  for (let i = 0; i < BASS_STEPS; i += 1) out.push({ id: `bass:lock:${i}`, scope: 'bass', label: `LOCK ${i + 1}`, kind: 'press', down: () => bassLockTap(i) });
  out.push({ id: 'bass:lock', scope: 'bass', label: 'LOCK (CHOSEN STEP)', kind: 'press', down: () => bassLockToggle() });
  return out;
}

const map = new Map(all().map((t) => [t.id, t]));

registerTargets('bass', () => [...map.values()], (id) => map.get(id));
