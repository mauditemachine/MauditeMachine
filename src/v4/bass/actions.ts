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
 * - les potards : bassParams, l'ecran dit leur valeur ;
 * - LOCK (2026-10-07, les boutons au-dessus des pas, les parameter locks des
 *   Elektron) : le pas dont on regle les verrous ; les potards du son ne
 *   changent alors que lui (deux tapes sur un potard : son verrou s'en va ;
 *   CLEAR : tous ceux du pas) ; le meme bouton, Echap ou EDIT en sortent ;
 * - EDIT (2026-10-07) : les seize pas deviennent les seize patterns (taper,
 *   chainer, tenir un vide pour copier, bass/patterns.ts).
 * Une piste SoundCloud du site qui part : la basse se tait (comme RUN).
 */

import { gesture } from '../actions';
import { sc } from '../audio/soundcloud';
import { editor } from '../state/editor';
import { focus } from '../state/focus';
import { bassEngine } from './engine';
import { generate, mutate, type GenOpts } from './gen';
import { BASS_SCALES, BASS_STYLES, SCALE_TONES, bassKnob, bassParams, bassValueText, stepOf, type BassKnobId } from './params';
import { bassPatterns, bassSlotName } from './patterns';
import { bassSeq, midiOf } from './seq';
import { BASS_STEPS, bassState, emptyStep, isLockable } from './state';

const two = (i: number): string => String(i + 1).padStart(2, '0');

/** EDIT est ouvert sur le MM-BASS : les pas sont les patterns. */
export const bassEditing = (): boolean => editor.get() === 'bass';

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
  // En LOCK : les verrous du pas seulement
  const st = bassState.get();
  if (st.lock >= 0) {
    bassState.setStep(st.lock, { locks: undefined });
    bassState.say(`LOCK ${two(st.lock)} CLEARED`, 1400);
    return;
  }
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
    bassEngine.on(midiOf(s), s.acc, false, 0, s.locks ?? null);
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

/** Taper un pas : choisi ; vide, note, liaison (apres une note), vide. En EDIT : son pattern. */
export function bassStepTap(i: number): void {
  gesture();
  if (bassEditing()) {
    bassPatternTap(i);
    return;
  }
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

/** Ce que montre un potard : le verrou du pas en LOCK, sinon sa valeur. */
export function bassKnobValue(id: BassKnobId): number {
  const st = bassState.get();
  if (st.lock >= 0 && isLockable(id)) {
    const v = st.steps[st.lock]?.locks?.[id];
    if (v !== undefined) return v;
  }
  return bassParams.of(id);
}

/** Un potard (0 a 1) ; l'ecran dit sa valeur. En LOCK, un potard du son verrouille le pas. */
export function bassDial(id: BassKnobId, v: number): void {
  const st = bassState.get();
  if (st.lock >= 0 && isLockable(id)) {
    const x = Math.min(1, Math.max(0, v));
    const s = st.steps[st.lock];
    if (s.locks?.[id] === x) return;
    bassState.setStep(st.lock, { locks: { ...(s.locks ?? {}), [id]: x } });
    bassState.say(`LOCK ${two(st.lock)}  ${bassKnob(id).label} ${bassValueText(id, x)}`, 1400);
    return;
  }
  if (!bassParams.set(id, v)) return;
  bassState.say(`${bassKnob(id).label} ${bassValueText(id, bassParams.of(id))}`, 1400);
}

/** Deux tapes sur un potard : en LOCK, son verrou s'en va ; sinon, sa valeur de depart. */
export function bassDialReset(id: BassKnobId): void {
  const st = bassState.get();
  if (st.lock >= 0 && isLockable(id)) {
    const s = st.steps[st.lock];
    if (!s.locks || s.locks[id] === undefined) {
      bassState.say(`LOCK ${two(st.lock)}  ${bassKnob(id).label} NOT LOCKED`, 1400);
      return;
    }
    const { [id]: _gone, ...rest } = s.locks;
    bassState.setStep(st.lock, { locks: Object.keys(rest).length ? rest : undefined });
    bassState.say(`LOCK ${two(st.lock)}  ${bassKnob(id).label} OFF`, 1400);
    return;
  }
  bassDial(id, bassParams.def(id));
}

/* ---------------- LOCK : les boutons au-dessus des pas ---------------- */

/** Un bouton LOCK : ce pas recoit les potards du son (le meme : on sort). */
export function bassLockTap(i: number): void {
  gesture();
  if (i < 0 || i >= BASS_STEPS) return;
  if (bassEditing()) {
    bassState.say('CLOSE EDIT TO LOCK A STEP', 1600);
    return;
  }
  const st = bassState.get();
  if (st.lock === i) {
    bassLockOff();
    return;
  }
  bassState.set({ lock: i, sel: i });
  const n = Object.keys(st.steps[i].locks ?? {}).length;
  bassState.say(`LOCK ${two(i)}  ${n ? `${n} LOCKED` : 'TURN A KNOB'}`, 2000);
}

/** LOCK sur le pas choisi (clavier L, MIDI). */
export function bassLockToggle(): void {
  bassLockTap(bassState.get().sel);
}

export function bassLockOff(): void {
  if (bassState.get().lock < 0) return;
  bassState.set({ lock: -1 });
  bassState.say('LOCK OFF', 1200);
}

/* ---------------- EDIT : les patterns ---------------- */

export function bassEditToggle(): void {
  gesture();
  editor.toggle('bass');
  const on = bassEditing();
  if (on && bassState.get().lock >= 0) bassState.set({ lock: -1 });
  bassState.say(on ? `PATTERNS  ${bassSlotName(bassPatterns.get().cur)}` : 'EDIT CLOSED', 1800);
}

const chainLine = (c: readonly number[]): string => `CHAIN ${c.map(bassSlotName).join(' > ')}`;

export function bassPatternTap(i: number): void {
  const r = bassPatterns.tap(i, bassSeq.running);
  const p = bassPatterns.get();
  if (r === 'chain') bassState.say(chainLine(p.chain), 2600);
  else if (r === 'next') bassState.say(`NEXT ${bassSlotName(i)}: AT THE BAR`, 2000);
  else bassState.say(`PATTERN ${bassSlotName(i)}${bassPatterns.filled(i) ? '' : ' EMPTY'}`, 2000);
}

/** EDIT, un pas tenu : un emplacement vide recoit une copie de la ligne courante. */
export function bassPatternHold(i: number): void {
  const from = bassPatterns.get().cur;
  if (bassPatterns.copyTo(i)) bassState.say(`COPY ${bassSlotName(from)} > ${bassSlotName(i)}`, 2000);
  else bassState.say(i === from ? `${bassSlotName(i)} PLAYS` : !bassPatterns.filled(from) ? `${bassSlotName(from)} IS EMPTY` : 'HOLD AN EMPTY SLOT TO COPY', 2000);
}

// Une autre machine : LOCK se ferme (EDIT aussi, state/editor.ts)
focus.subscribe(() => {
  if (focus.get() !== 'bass' && bassState.get().lock >= 0) bassState.set({ lock: -1 });
});

/** Une piste du site qui part : la basse s'arrete. */
export function bassStop(): void {
  bassSeq.stop();
}

sc.subscribe(() => {
  if (sc.get().status === 'playing') bassSeq.stop();
});
