/**
 * Les cibles MIDI du MM-BASS (2026-10-07, midi/targets.ts) : ses potards
 * (bass:knob:<id>, ceux de la plaque sous le capot compris depuis le
 * 2026-10-08), ses touches (bass:key:<touche>, EDIT et OPEN compris), INFOS
 * (bass:infos), RUN en bascule (bass:running, la LED suit), ses seize pas
 * (bass:trig:<0-15> : comme un appui sur le pas ; en EDIT, un pattern), leurs
 * seize LOCK (bass:lock:<0-15>) et LOCK sur le pas choisi (bass:lock), comme
 * sur une Elektron : un potard du son tourne pendant un LOCK ne change que
 * ce pas. Inscrites au chargement de son code (state/bassload.ts).
 * La machine Elektron (2026-10-08) : les huit encodeurs de la page allumee
 * (bass:knob:1 a 8, les memes que MIDI LEARN sur un encodeur de la face ; un
 * cran du controleur = un cran de l'ecran, cc / 127), les pages
 * (bass:page:voice, filter, env, fx, et bass:page en quatre crans), la
 * touche "i" (bass:key:i) ; les reglages des pages ont aussi leur cible
 * directe (bass:knob:pw, bass:knob:delay...). Les ids d'avant restent.
 */

import { registerTargets, type MidiTarget } from '../midi/targets';
import { bassInfos } from '../state/bassInfos';
import { bassDial, bassEncDial, bassEncParam, bassEncValue, bassKnobValue, bassLockTap, bassLockToggle, bassPageSet, bassRun, bassStepTap } from './actions';
import { bassKeyAction } from './gestures';
import { BASS_PAGES, ENC_LETTERS, bassPage } from './pages';
import { BASS_KNOBS, bassKnob } from './params';
import { bassSeq } from './seq';
import { BASS_STEPS } from './state';
import { BASS_KEYS } from './theme';

function all(): MidiTarget[] {
  const out: MidiTarget[] = [];
  for (const k of BASS_KNOBS) {
    out.push({ id: `bass:knob:${k.id}`, scope: 'bass', label: k.label, kind: 'value', steps: k.steps ?? 0, get: () => bassKnobValue(k.id), set: (v) => bassDial(k.id, v) });
  }
  // Les encodeurs de la page allumee : leurs crans suivent le reglage qu'ils tiennent
  for (let i = 0; i < 8; i += 1) {
    out.push({
      id: `bass:knob:${i + 1}`,
      scope: 'bass',
      label: `ENCODER ${ENC_LETTERS[i]} (PAGE)`,
      kind: 'value',
      get steps() {
        const id = bassEncParam(i);
        return id ? bassKnob(id).steps ?? 0 : 0;
      },
      get: () => bassEncValue(i),
      set: (v) => bassEncDial(i, v),
    });
  }
  for (const p of BASS_PAGES) out.push({ id: `bass:page:${p.id}`, scope: 'bass', label: `PAGE ${p.label}`, kind: 'press', down: () => bassPageSet(p.id) });
  out.push({
    id: 'bass:page',
    scope: 'bass',
    label: 'PAGE (VOICE FILTER ENV FX)',
    kind: 'value',
    steps: BASS_PAGES.length,
    get: () => BASS_PAGES.findIndex((p) => p.id === bassPage.get()) / (BASS_PAGES.length - 1),
    set: (v) => bassPageSet(BASS_PAGES[Math.max(0, Math.min(BASS_PAGES.length - 1, Math.round(v * (BASS_PAGES.length - 1))))].id),
  });
  out.push({ id: 'bass:key:i', scope: 'bass', label: 'INFOS (THE i OF THE SCREEN)', kind: 'press', down: () => void bassInfos.toggle() });
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
  out.push({ id: 'bass:infos', scope: 'bass', label: 'INFOS (HELP ON HOVER)', kind: 'press', down: () => void bassInfos.toggle() });
  return out;
}

const map = new Map(all().map((t) => [t.id, t]));

registerTargets('bass', () => [...map.values()], (id) => map.get(id));
