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
 * Le Roto en sequenceur (2026-10-09, le setup BSEQ, midi/seqlink.ts) :
 * bass:seq:<1-8> (les huit pas de la fenetre : taper, tenir, tourner),
 * bass:seq:window, bass:seq:follow, bass:seq:tie (la liaison du pas choisi) ;
 * le MM-BASS s'y inscrit ici (ses pas, son LOCK, les LEDs de ses touches).
 */

import { registerTargets, type MidiTarget } from '../midi/targets';
import { seqFollow, seqPress, seqRegister, seqRelease, seqSetFollow, seqWindow, type SeqMachine } from '../midi/seqlink';
import { bassInfos } from '../state/bassInfos';
import { editor } from '../state/editor';
import { bassDial, bassEditing, bassEncDial, bassEncParam, bassEncValue, bassKnobValue, bassLockEnter, bassLockOff, bassLockTap, bassLockToggle, bassPageSet, bassPatternHold, bassPatternTap, bassRun, bassStepTap, bassStepToggle } from './actions';
import { bassKeyAction } from './gestures';
import { BASS_PAGES, ENC_LETTERS, bassPage } from './pages';
import { BASS_KNOBS, bassKnob } from './params';
import { bassPatterns } from './patterns';
import { bassSeq } from './seq';
import { BASS_STEPS, bassState, isLockable } from './state';
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
  // Le sequenceur du Roto-Control (2026-10-09, midi/seqlink.ts) : les huit pas d'une fenetre (taper, tenir, tourner),
  // la fenetre 1-8 / 9-16, FOLLOW, la liaison du pas choisi
  for (let b = 0; b < 8; b += 1) {
    out.push({ id: `bass:seq:${b + 1}`, scope: 'bass', label: `SEQ STEP ${b + 1}|${b + 9} (TAP, HOLD + TURN)`, kind: 'hold', down: () => seqPress('bass', b), up: () => seqRelease('bass', b) });
  }
  out.push({ id: 'bass:seq:window', scope: 'bass', label: 'SEQ STEPS 1-8 / 9-16', kind: 'press', down: () => seqWindow('bass') });
  out.push({ id: 'bass:seq:follow', scope: 'bass', label: 'SEQ FOLLOW (THE STEPS FOLLOW THE PLAYHEAD)', kind: 'value', steps: 2, get: () => (seqFollow('bass') ? 1 : 0), set: (v) => seqSetFollow('bass', v >= 0.5) });
  out.push({ id: 'bass:seq:tie', scope: 'bass', label: 'TIE (THE CHOSEN STEP)', kind: 'press', down: () => bassTie() });
  return out;
}

const two = (i: number): string => String(i + 1).padStart(2, '0');

/**
 * TIE (2026-10-09, le Roto en sequenceur) : le pas choisi (le pas en LOCK)
 * continue la note d'avant, comme le mode TIME de la 303 ; encore : il redevient
 * une note. Sur le Roto, une tape ne fait que vide ou note : la liaison passe
 * par ici.
 */
function bassTie(): void {
  const st = bassState.get();
  const i = st.lock >= 0 ? st.lock : st.sel;
  const s = st.steps[i];
  if (!s || s.kind === 'off') {
    bassState.say('PICK A NOTE STEP FIRST', 1400);
    return;
  }
  if (s.kind === 'note' && st.steps[(i + BASS_STEPS - 1) % BASS_STEPS].kind === 'off') {
    bassState.say(`STEP ${two(i)}  TIE: A NOTE BEFORE IT`, 1600);
    return;
  }
  const kind = s.kind === 'tie' ? 'note' : 'tie';
  bassState.setStep(i, { kind });
  bassState.say(`STEP ${two(i)}  ${kind === 'tie' ? 'TIE' : 'NOTE'}`, 1400);
}

/** Le pas que reglent ACCENT, SLIDE, TIE : le pas en LOCK, sinon le pas choisi. */
const focusStep = () => {
  const st = bassState.get();
  return st.steps[st.lock >= 0 ? st.lock : st.sel];
};

/** Le MM-BASS pour le sequenceur du Roto (midi/seqlink.ts, le setup BSEQ). */
const seq: SeqMachine = {
  editing: bassEditing,
  lit: (i) => (bassEditing() ? bassPatterns.filled(i) : (bassState.get().steps[i]?.kind ?? 'off') !== 'off'),
  current: () => bassPatterns.get().cur,
  lockStep: () => (bassEditing() ? -1 : bassState.get().lock),
  // Le LOCK du MM-BASS reste toujours au lacher (une tape le quitte)
  latched: () => (bassEditing() ? -1 : bassState.get().lock),
  running: () => bassSeq.running,
  subscribe(fn) {
    const offs = [bassState.subscribe(fn), bassPatterns.subscribe(fn), editor.subscribe(fn)];
    return () => offs.forEach((o) => o());
  },
  onStep: (fn) => bassSeq.onStep(fn),
  context: () => `${bassEditing() ? 'E' : ''}${bassPatterns.get().cur}`,
  tap: (i) => bassStepToggle(i),
  enter(i) {
    bassLockEnter(i);
    return bassState.get().lock === i;
  },
  restore(prev) {
    if (bassState.get().lock < 0) return;
    if (prev >= 0 && !bassEditing()) {
      bassState.set({ lock: prev, sel: prev });
      bassState.say(`LOCK ${two(prev)}`, 1200);
    } else bassLockOff();
  },
  latch: () => undefined,
  patternTap: (i) => bassPatternTap(i),
  patternHold: (i) => bassPatternHold(i),
  // Un encodeur de page, ou un potard du son (CUTOFF... de la page 4) : le pas tenu passe en LOCK avant qu'il tourne
  knobHeld(i, id) {
    const k = /^bass:knob:(.+)$/.exec(id)?.[1];
    if (!k || (!/^[1-8]$/.test(k) && !isLockable(k)) || bassEditing()) return false;
    if (bassState.get().lock !== i) bassLockEnter(i);
    return bassState.get().lock === i;
  },
  led(id) {
    if (id.startsWith('bass:page:')) return bassPage.get() === id.slice('bass:page:'.length) ? 1 : 0;
    if (id === 'bass:lock') return !bassEditing() && bassState.get().lock >= 0 ? 1 : 0;
    if (id === 'bass:key:edit') return bassEditing() ? 1 : 0;
    // ACCENT, SLIDE, TIE : ce qu'a le pas choisi
    if (id === 'bass:key:accent') return focusStep()?.kind === 'note' && focusStep()?.acc ? 1 : 0;
    if (id === 'bass:key:slide') return focusStep()?.kind !== 'off' && focusStep()?.slide ? 1 : 0;
    if (id === 'bass:seq:tie') return focusStep()?.kind === 'tie' ? 1 : 0;
    return null;
  },
  say: (t) => bassState.say(t, 1400),
};

const map = new Map(all().map((t) => [t.id, t]));

registerTargets('bass', () => [...map.values()], (id) => map.get(id));
seqRegister('bass', seq);
