/**
 * Le generateur de basslines du MM-BASS (2026-10-07, Mika : "un generateur
 * de bassline ; MM-ARP fait des melodies, je veux un generateur de bassline
 * qui peut descendre super bas", inspire du Torso T-1 : des regles plutot
 * que des notes). Quatre styles, a la maniere de ce que Mika joue (dark
 * disco, indie dance, minimal hypnotique) :
 * - ACID : des doubles croches de 303, la tonique et ses voisines (quinte,
 *   tierce mineure, septieme), des sauts d'octave, des accents plutot a
 *   contretemps, des slides vers la note suivante ;
 * - DISCO : l'octave qui saute, basse sur le temps, haute sur le "et", des
 *   notes de passage en fin de mesure ;
 * - ROLL : la basse qui roule entre les grosses caisses (le temps laisse
 *   vide), trois doubles croches sur quatre, presque toujours la tonique ;
 * - SUB : de longues notes basses liees (TIE), qui changent une a quatre
 *   fois par mesure, glissent parfois.
 * DENSITY : combien de notes (ou de changements en SUB) ; SLIDES et ACCENTS :
 * leurs chances ; RANGE : l'etendue en octaves. Fonctions pures (le hasard
 * se passe en argument : elles se testent hors du navigateur).
 */

import type { BassStyle } from './params';
import { BASS_STEPS, type BassStep } from './state';

export interface GenOpts {
  style: BassStyle;
  density: number;
  slides: number;
  accents: number;
  /** 1, 2 ou 3 octaves */
  range: number;
  /** le nombre de degres de la gamme (7, 5 en pentatonique) */
  degrees: number;
  rnd?: () => number;
}

/** Les poids des degres d'une gamme a sept notes (la tonique et la quinte d'abord) ; a cinq : la pentatonique mineure. */
const W7 = [6, 0.6, 2.2, 1.4, 3.4, 1, 2.2];
const W5 = [6, 2.2, 1.4, 3.4, 2.2];

function pick(weights: readonly number[], rnd: () => number): number {
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * sum;
  for (let i = 0; i < weights.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 0;
}

const note = (deg: number, oct = 0, acc = false, slide = false): BassStep => ({ kind: 'note', deg, oct, acc, slide });
const rest = (): BassStep => ({ kind: 'off', deg: 0, oct: 0, acc: false, slide: false });
const tie = (): BassStep => ({ kind: 'tie', deg: 0, oct: 0, acc: false, slide: false });

/** La quinte de la gamme (son degre). */
const fifthOf = (degrees: number): number => (degrees === 5 ? 3 : 4);
const seventhOf = (degrees: number): number => (degrees === 5 ? 4 : 6);

export function generate(o: GenOpts): BassStep[] {
  const rnd = o.rnd ?? Math.random;
  const W = o.degrees === 5 ? W5 : W7;
  const out: BassStep[] = [];
  const up = (): number => (o.range >= 2 && rnd() < 0.18 * (o.range - 1) ? 1 : 0) + (o.range >= 3 && rnd() < 0.08 ? 1 : 0);
  if (o.style === 'ACID') {
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const p = 0.32 + 0.55 * o.density + (i % 4 === 0 ? 0.2 : 0);
      if (i > 0 && rnd() > p) {
        out.push(rest());
        continue;
      }
      // Une liaison de temps en temps (la note d'avant tient)
      if (i > 0 && out[i - 1].kind !== 'off' && rnd() < 0.06) {
        out.push(tie());
        continue;
      }
      const deg = i === 0 ? 0 : pick(W, rnd);
      const oct = i === 0 ? 0 : rnd() < 0.22 ? 1 : up() > 0 ? 1 : 0;
      const acc = rnd() < o.accents * (i % 2 === 1 ? 0.7 : 0.45) || (i === 0 && o.accents > 0.2);
      out.push(note(deg, oct, acc));
    }
  } else if (o.style === 'DISCO') {
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const q = i % 4;
      if (q === 0) out.push(note(0, 0, false));
      else if (q === 2) out.push(note(0, 1, rnd() < o.accents * 0.8));
      else if (rnd() < o.density * (q === 3 ? 0.55 : 0.3)) out.push(note(q === 3 && rnd() < 0.5 ? 0 : pick(W, rnd), q === 3 ? 1 : 0, false));
      else out.push(rest());
    }
    // La fin de la mesure : une note de passage (la quinte, la septieme)
    if (rnd() < 0.5 + 0.4 * o.density) out[14] = note(rnd() < 0.5 ? fifthOf(o.degrees) : seventhOf(o.degrees), 0, false);
  } else if (o.style === 'ROLL') {
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const q = i % 4;
      // Le temps : la place de la grosse caisse
      if (q === 0 && o.density < 0.85) {
        out.push(rest());
        continue;
      }
      if (rnd() > 0.55 + 0.45 * o.density) {
        out.push(rest());
        continue;
      }
      const varied = q === 3 && rnd() < 0.3;
      const deg = varied ? (rnd() < 0.5 ? seventhOf(o.degrees) : fifthOf(o.degrees)) : 0;
      const oct = q === 3 && o.range >= 2 && rnd() < 0.25 ? 1 : 0;
      out.push(note(deg, oct, q === 2 && rnd() < o.accents));
    }
  } else {
    // SUB : de longues notes liees ; DENSITY : combien par mesure (1 a 4)
    const n = 1 + Math.round(o.density * 3);
    const len = BASS_STEPS / n;
    const choices = [0, fifthOf(o.degrees), seventhOf(o.degrees), o.degrees === 5 ? 2 : 5, o.degrees === 5 ? 1 : 3];
    for (let k = 0; k < n; k += 1) {
      const deg = k === 0 ? 0 : choices[pick([1, 3, 2, 1.5, 1.5], rnd)];
      for (let j = 0; j < len; j += 1) out.push(j === 0 ? note(deg, -1, false) : tie());
    }
  }
  // Les slides : vers une note qui suit, selon SLIDES (moins en DISCO et en ROLL)
  const slideK = o.style === 'ACID' ? 0.6 : o.style === 'SUB' ? 0.5 : 0.2;
  for (let i = 0; i < BASS_STEPS; i += 1) {
    const s = out[i];
    if (s.kind === 'off') continue;
    // La derniere case d'une note (avant une note neuve)
    const next = out[(i + 1) % BASS_STEPS];
    if (next.kind === 'note' && i < BASS_STEPS - 1 && rnd() < o.slides * slideK) out[i] = { ...s, slide: true };
  }
  return out;
}

/** MUTATE : quelques pas changent (un degre, un accent, un slide, une note qui apparait ou s'efface). */
export function mutate(steps: readonly BassStep[], o: GenOpts): BassStep[] {
  const rnd = o.rnd ?? Math.random;
  const out = steps.map((s) => ({ ...s }));
  const W = o.degrees === 5 ? W5 : W7;
  const count = 2 + Math.floor(rnd() * 3);
  for (let k = 0; k < count; k += 1) {
    const i = 1 + Math.floor(rnd() * (BASS_STEPS - 1));
    const s = out[i];
    const r = rnd();
    if (s.kind === 'note') {
      if (r < 0.45) s.deg = pick(W, rnd);
      else if (r < 0.65) s.acc = !s.acc;
      else if (r < 0.8) s.slide = !s.slide;
      else if (r < 0.9) s.oct = s.oct === 0 ? 1 : 0;
      else out[i] = rest();
    } else if (s.kind === 'off' && r < 0.6) out[i] = note(pick(W, rnd), rnd() < 0.25 ? 1 : 0, rnd() < o.accents * 0.5);
  }
  return out;
}
