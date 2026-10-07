/**
 * Ce que font les commandes du MM-BASS (2026-10-07), pour la machine 3D, ses
 * jumeaux, le clavier et le MIDI :
 * - RUN : la sequence part sur la grille du MM-RYTM (ou du MM-ARP), ou s'arrete ;
 * - GEN : une nouvelle ligne du generateur (STYLE, DENSITY, SLIDES, ACCENTS,
 *   RANGE ; la gamme) ; elle part si rien ne jouait ;
 * - MUTATE : quelques pas changent ; CLEAR : plus rien ;
 * - un pas (TRIG) : il est choisi ; taper le fait passer de vide a note, de
 *   note a liaison (TIE, s'il suit une note), de liaison a vide ; a l'arret,
 *   on entend sa note ;
 * - ACCENT, SLIDE, NOTE - +, OCT - + : sur le pas choisi ;
 * - les potards : bassParams, l'ecran dit leur valeur.
 * Une piste SoundCloud du site qui part : la basse se tait (comme RUN).
 */

import { gesture } from '../actions';
import { sc } from '../audio/soundcloud';
import { bassEngine } from './engine';
import { generate, mutate, type GenOpts } from './gen';
import { BASS_SCALES, BASS_STYLES, SCALE_TONES, bassKnob, bassParams, bassValueText, stepOf, type BassKnobId } from './params';
import { bassSeq, midiOf } from './seq';
import { BASS_STEPS, bassState, emptyStep } from './state';

const genOpts = (): GenOpts => {
  const v = bassParams.get();
  return {
    style: BASS_STYLES[stepOf('style', v.style)],
    density: v.density,
    slides: v.slides,
    accents: v.accents,
    range: stepOf('range', v.range) + 1,
    degrees: SCALE_TONES[BASS_SCALES[stepOf('scale', v.scale)]].length,
  };
};

export function bassRun(): void {
  gesture();
  if (bassSeq.running) {
    bassSeq.stop();
    return;
  }
  void bassEngine.ensure().then(() => bassSeq.start());
}

/** GEN : une ligne neuve ; elle part si la basse ne jouait pas. */
export function bassGenerate(): void {
  gesture();
  const o = genOpts();
  bassState.set({ steps: generate(o), gen: bassState.get().gen + 1, sel: 0 });
  bassState.say(`${o.style} LINE`, 1600);
  if (!bassSeq.running) void bassEngine.ensure().then(() => bassSeq.start());
}

export function bassMutate(): void {
  gesture();
  bassState.set({ steps: mutate(bassState.get().steps, genOpts()), gen: bassState.get().gen + 1 });
  bassState.say('MUTATED', 1200);
}

export function bassClear(): void {
  bassState.set({ steps: Array.from({ length: BASS_STEPS }, emptyStep) });
  bassState.say('CLEARED', 1200);
}

/** A l'arret : on entend la note d'un pas qu'on regle. */
function audition(i: number): void {
  if (bassSeq.running) return;
  const s = bassState.get().steps[i];
  if (s.kind !== 'note') return;
  gesture();
  void bassEngine.ensure().then(() => {
    bassEngine.on(midiOf(s), s.acc, false);
    const c = bassEngine.ctx;
    bassEngine.off(c ? c.currentTime + 0.22 : 0);
  });
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const noteName = (midi: number): string => `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

function sayStep(i: number): void {
  const s = bassState.get().steps[i];
  const what = s.kind === 'off' ? 'OFF' : s.kind === 'tie' ? 'TIE' : `${noteName(midiOf(s))}${s.acc ? '  ACC' : ''}${s.slide ? '  SLIDE' : ''}`;
  bassState.say(`STEP ${String(i + 1).padStart(2, '0')}  ${what}`, 1600);
}

/** Taper un pas : choisi ; vide, note, liaison (apres une note), vide. */
export function bassStepTap(i: number): void {
  gesture();
  const st = bassState.get();
  if (i < 0 || i >= BASS_STEPS) return;
  const s = st.steps[i];
  const prev = st.steps[(i + BASS_STEPS - 1) % BASS_STEPS];
  if (st.sel !== i && s.kind !== 'off') {
    // Un pas plein qu'on choisit : seulement choisi (on l'entend), un second appui le change
    bassState.set({ sel: i });
    sayStep(i);
    audition(i);
    return;
  }
  const kind = s.kind === 'off' ? 'note' : s.kind === 'note' && prev.kind !== 'off' ? 'tie' : 'off';
  bassState.set({ sel: i });
  bassState.setStep(i, { kind, ...(kind === 'note' && s.kind === 'off' ? { deg: 0, oct: 0 } : {}) });
  sayStep(i);
  audition(i);
}

/** Glisser sur un pas : sa note dans la gamme (un pas vide devient une note). */
export function bassStepDeg(i: number, deg: number): void {
  const st = bassState.get();
  const s = st.steps[i];
  if (!s) return;
  const d = Math.max(0, Math.min(20, deg));
  if (s.kind === 'note' && s.deg === d && st.sel === i) return;
  bassState.set({ sel: i });
  bassState.setStep(i, { kind: 'note', deg: d });
  sayStep(i);
  audition(i);
}

export function bassAccent(): void {
  const st = bassState.get();
  const s = st.steps[st.sel];
  if (s.kind === 'off') {
    bassState.say('PICK A NOTE STEP FIRST', 1400);
    return;
  }
  bassState.setStep(st.sel, { acc: !s.acc });
  sayStep(st.sel);
}

export function bassSlide(): void {
  const st = bassState.get();
  const s = st.steps[st.sel];
  if (s.kind === 'off') {
    bassState.say('PICK A NOTE STEP FIRST', 1400);
    return;
  }
  bassState.setStep(st.sel, { slide: !s.slide });
  sayStep(st.sel);
}

/** NOTE - + : un degre de la gamme ; OCT - + : une octave. */
export function bassNote(dir: -1 | 1): void {
  const st = bassState.get();
  const s = st.steps[st.sel];
  if (s.kind !== 'note') {
    bassState.say('PICK A NOTE STEP FIRST', 1400);
    return;
  }
  bassState.setStep(st.sel, { deg: Math.max(0, Math.min(20, s.deg + dir)) });
  sayStep(st.sel);
  audition(st.sel);
}

export function bassOct(dir: -1 | 1): void {
  const st = bassState.get();
  const s = st.steps[st.sel];
  if (s.kind !== 'note') {
    bassState.say('PICK A NOTE STEP FIRST', 1400);
    return;
  }
  bassState.setStep(st.sel, { oct: Math.max(-1, Math.min(2, s.oct + dir)) });
  sayStep(st.sel);
  audition(st.sel);
}

/** Un potard (0 a 1) ; l'ecran dit sa valeur. */
export function bassDial(id: BassKnobId, v: number): void {
  if (!bassParams.set(id, v)) return;
  bassState.say(`${bassKnob(id).label} ${bassValueText(id, bassParams.of(id))}`, 1400);
}

/** Une piste du site qui part : la basse s'arrete. */
export function bassStop(): void {
  bassSeq.stop();
}

sc.subscribe(() => {
  if (sc.get().status === 'playing') bassSeq.stop();
});
