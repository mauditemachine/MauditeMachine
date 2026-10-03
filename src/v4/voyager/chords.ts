/**
 * Les huit pads du MM-VOYAGER : huit accords de fa diese mineur, la
 * tonalite de Mika (sa reference de production : F# mineur, 123 BPM). Un
 * pad touche entre dans la progression (un accord par mesure, dans l'ordre
 * des tapes), retouche il en sort ; l'arpegiateur joue la progression.
 * Toutes les notes sont dans la gamme : rien ne sonne faux, quoi qu'on
 * touche.
 */

/** Notes MIDI (60 = do 4) ; la racine de chaque accord est posee dans l'octave de fa diese 3. */
const FS3 = 54;

export interface Chord {
  /** serigraphie du pad */
  label: string;
  /** nom lu : "F sharp minor" */
  aria: string;
  /** intervalles depuis la racine */
  tones: readonly number[];
  /** racine, en demi-tons au-dessus de fa diese */
  root: number;
}

export const CHORDS: readonly Chord[] = [
  { label: 'F#m', aria: 'F sharp minor', root: 0, tones: [0, 3, 7] },
  { label: 'D', aria: 'D major', root: 8, tones: [0, 4, 7] },
  { label: 'E', aria: 'E major', root: 10, tones: [0, 4, 7] },
  { label: 'C#m', aria: 'C sharp minor', root: 7, tones: [0, 3, 7] },
  { label: 'Bm', aria: 'B minor', root: 5, tones: [0, 3, 7] },
  { label: 'A', aria: 'A major', root: 3, tones: [0, 4, 7] },
  { label: 'F#m7', aria: 'F sharp minor seven', root: 0, tones: [0, 3, 7, 10] },
  { label: 'Dmaj7', aria: 'D major seven', root: 8, tones: [0, 4, 7, 11] },
];

/**
 * Progressions de RANDOM (indices de CHORDS) : des enchainements qui
 * marchent en indie dance et en psy prog.
 */
export const PROGRESSIONS: readonly (readonly number[])[] = [
  [0, 1, 5, 2],
  [0, 2, 1, 3],
  [4, 0, 1, 2],
  [0, 5, 2, 4],
  [6, 7, 2, 3],
  [0, 0, 1, 2],
  [0, 3, 1, 2],
  [6, 4, 7, 2],
];

/** Notes de l'accord dans une octave : racine ramenee entre fa diese 3 et mi 4, tri montant. */
export function chordNotes(i: number): number[] {
  const c = CHORDS[i];
  if (!c) return [];
  const root = FS3 + c.root;
  return c.tones.map((t) => root + t).sort((a, b) => a - b);
}

export type ArpMode = 0 | 1 | 2 | 3;

/**
 * La suite de l'arpege pour un accord : ses notes sur `oct` octaves, puis
 * l'ordre du mode : montant, descendant, aller-retour (sans repeter les
 * bouts), ou au hasard (tire a chaque note par l'appelant : la suite
 * montante sert de reserve).
 */
export function arpSequence(i: number, oct: number, mode: ArpMode): number[] {
  const base = chordNotes(i);
  const up: number[] = [];
  for (let o = 0; o < oct; o += 1) for (const n of base) up.push(n + 12 * o);
  if (mode === 1) return up.slice().reverse();
  if (mode === 2) return up.length > 2 ? up.concat(up.slice(1, -1).reverse()) : up;
  return up;
}

export const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
