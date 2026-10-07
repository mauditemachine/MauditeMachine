/**
 * Le generateur de basslines du MM-BASS (2026-10-07, Mika : "un generateur
 * de bassline ; MM-ARP fait des melodies, je veux un generateur de bassline
 * qui peut descendre super bas", inspire du Torso T-1 : des regles plutot
 * que des notes). Onze styles de musique electronique (2026-10-07, Mika :
 * "des styles de musique electro differents, et pas juste Disco"), ceux que
 * Mika joue d'abord (dark disco, indie dance, minimal hypnotique, psy prog) :
 * - ACID : des doubles croches de 303, la tonique et ses voisines, des sauts
 *   d'octave, des accents plutot a contretemps, des slides ;
 * - DARK DISCO : l'octave qui saute (basse sur le temps, haute sur le "et"),
 *   la ligne qui descend a mi-mesure ;
 * - INDIE DANCE : des croches qui poussent, l'octave a contretemps, des
 *   doubles croches fantomes ;
 * - MINIMAL : peu de notes, a cote des temps, une figure de huit pas repetee ;
 * - PSY PROG : le roulement (K B B B, ou K . B B plus clair) ;
 * - TECHNO : la basse sur le contretemps, un grondement autour ;
 * - HOUSE : des rythmes qui chaloupent, des notes tenues ;
 * - ELECTRO : la syncope 3 + 3 + 2, les sauts d'octave ;
 * - EBM : toutes les doubles croches, martelees ;
 * - ITALO : l'octave en doubles croches, l'accord qui change ;
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

/** Un rythme parmi d'autres (x : une note, . : rien), lu sur seize pas. */
const pickRhythm = (list: readonly string[], rnd: () => number): boolean[] => [...list[Math.floor(rnd() * list.length)]].map((c) => c === 'x');

/** Le second accord d'une mesure (le degre ou la ligne monte a mi-chemin) : la sixte, la quarte, la septieme. */
const turnOf = (degrees: number, rnd: () => number): number => (degrees === 5 ? [2, 3, 4][Math.floor(rnd() * 3)] : [5, 3, 6, 4][Math.floor(rnd() * 4)]);

export function generate(o: GenOpts): BassStep[] {
  const rnd = o.rnd ?? Math.random;
  const W = o.degrees === 5 ? W5 : W7;
  const fifth = fifthOf(o.degrees);
  const seventh = seventhOf(o.degrees);
  const out: BassStep[] = [];
  const up = (): number => (o.range >= 2 && rnd() < 0.18 * (o.range - 1) ? 1 : 0) + (o.range >= 3 && rnd() < 0.08 ? 1 : 0);
  // La moitie de la mesure ou la ligne change de degre (selon DENSITY), 0 : elle reste
  const turn = rnd() < 0.25 + 0.5 * o.density ? turnOf(o.degrees, rnd) : 0;
  const degAt = (i: number): number => (i >= 8 ? turn : 0);
  switch (o.style) {
    case 'ACID': {
      // Des doubles croches de 303 : la tonique et ses voisines, des sauts d'octave, des accents a contretemps
      for (let i = 0; i < BASS_STEPS; i += 1) {
        const p = 0.32 + 0.55 * o.density + (i % 4 === 0 ? 0.2 : 0);
        if (i > 0 && rnd() > p) {
          out.push(rest());
          continue;
        }
        if (i > 0 && out[i - 1].kind !== 'off' && rnd() < 0.06) {
          out.push(tie());
          continue;
        }
        const deg = i === 0 ? 0 : pick(W, rnd);
        const oct = i === 0 ? 0 : rnd() < 0.22 ? 1 : up() > 0 ? 1 : 0;
        const acc = rnd() < o.accents * (i % 2 === 1 ? 0.7 : 0.45) || (i === 0 && o.accents > 0.2);
        out.push(note(deg, oct, acc));
      }
      break;
    }
    case 'DARK DISCO': {
      // L'octave qui saute (basse sur le temps, haute sur le "et"), sombre : la ligne descend a la sixte a mi-mesure
      for (let i = 0; i < BASS_STEPS; i += 1) {
        const q = i % 4;
        const d = degAt(i);
        if (q === 0) out.push(note(d, 0, false));
        else if (q === 2) out.push(note(d, 1, rnd() < o.accents * 0.8));
        else if (rnd() < o.density * (q === 3 ? 0.5 : 0.25)) out.push(note(q === 3 && rnd() < 0.6 ? d : pick(W, rnd), q === 3 ? 1 : 0, false));
        else out.push(rest());
      }
      if (rnd() < 0.5 + 0.4 * o.density) out[14] = note(rnd() < 0.5 ? fifth : seventh, 0, false);
      break;
    }
    case 'INDIE DANCE': {
      // Des croches qui poussent, l'octave sur le contretemps, des doubles croches fantomes, la quinte en fin de mesure
      for (let i = 0; i < BASS_STEPS; i += 1) {
        const q = i % 4;
        const d = degAt(i);
        if (q === 0 || q === 2) out.push(note(d, q === 2 && rnd() < 0.45 ? 1 : 0, q === 2 && rnd() < o.accents * 0.7));
        else if (rnd() < o.density * 0.4) out.push(note(q === 3 && rnd() < 0.3 ? fifth : d, q === 3 && rnd() < 0.3 ? 1 : 0, rnd() < o.accents * 0.3));
        else out.push(rest());
      }
      if (rnd() < 0.6) out[15] = note(rnd() < 0.5 ? fifth : seventh, 0, true);
      break;
    }
    case 'MINIMAL': {
      // Peu de notes, a cote des temps, et une figure de huit pas repetee (l'hypnose)
      const motif: BassStep[] = Array.from({ length: 8 }, rest);
      const spots = [2, 3, 6, 7, 1, 5];
      const count = 1 + Math.round(o.density * 3);
      for (let k = 0; k < count; k += 1) {
        const at = spots[Math.min(spots.length - 1, Math.floor(rnd() * Math.min(spots.length, 3 + k)))];
        motif[at] = note(rnd() < 0.75 ? 0 : rnd() < 0.5 ? fifth : seventh, rnd() < 0.15 * (o.range - 1) ? 1 : 0, rnd() < o.accents * 0.5);
      }
      for (let i = 0; i < BASS_STEPS; i += 1) out.push({ ...motif[i % 8] });
      // La seconde moitie varie a peine : une note qui bouge
      if (rnd() < 0.5) {
        const i = 8 + spots[Math.floor(rnd() * 4)];
        out[i] = out[i].kind === 'off' ? note(0, 0, false) : rest();
      }
      break;
    }
    case 'PSY PROG': {
      // Le roulement : la grosse caisse sur le temps, la basse sur les trois doubles croches d'apres (K B B B) ;
      // moins dense : la double croche d'apres le temps reste vide (K . B B, la prog)
      for (let i = 0; i < BASS_STEPS; i += 1) {
        const q = i % 4;
        if (q === 0 || (q === 1 && rnd() > o.density * 1.1 - 0.1)) {
          out.push(rest());
          continue;
        }
        const end = i >= 13 && rnd() < 0.35;
        out.push(note(end ? (rnd() < 0.5 ? seventh : fifth) : degAt(i) === 0 ? 0 : rnd() < 0.5 ? degAt(i) : 0, end && o.range >= 2 && rnd() < 0.4 ? 1 : 0, q === 2 && rnd() < o.accents * 0.5));
      }
      break;
    }
    case 'TECHNO': {
      // La basse sur le contretemps (le "et"), un grondement de doubles croches autour, la septieme a la fin
      for (let i = 0; i < BASS_STEPS; i += 1) {
        const q = i % 4;
        if (q === 2) out.push(note(degAt(i) && rnd() < 0.5 ? degAt(i) : 0, 0, rnd() < o.accents * 0.8));
        else if (q !== 0 && rnd() < o.density * 0.55) out.push(note(0, 0, false));
        else if (q === 0 && o.density > 0.85 && rnd() < 0.3) out.push(note(0, -1, false));
        else out.push(rest());
      }
      if (rnd() < 0.4) out[14] = note(seventh, 0, true);
      break;
    }
    case 'HOUSE': {
      // Une ligne qui chaloupe : des rythmes de house, des notes tenues (liaisons), l'octave et la quinte
      const rh = pickRhythm(['x..x..x...x.x...', '...x..x...xx..x.', 'x.x...x..x..x.x.', '..x..x..x.x...x.'], rnd);
      for (let i = 0; i < BASS_STEPS; i += 1) {
        if (!rh[i]) {
          out.push(i > 0 && out[i - 1].kind !== 'off' && rnd() < 0.35 + 0.3 * (1 - o.density) ? tie() : rest());
          continue;
        }
        const r = rnd();
        const deg = r < 0.5 ? degAt(i) : r < 0.7 ? fifth : r < 0.85 ? seventh : pick(W, rnd);
        out.push(note(deg, rnd() < 0.2 + 0.1 * o.range ? 1 : 0, rnd() < o.accents * 0.5));
      }
      break;
    }
    case 'ELECTRO': {
      // Syncope 3 + 3 + 2, des sauts d'octave robotiques, des accents sur les syncopes
      const rh = pickRhythm(['x..x..x.x..x..x.', 'x..x..x...x.x.x.', 'x.xx..x.x..x..xx'], rnd);
      for (let i = 0; i < BASS_STEPS; i += 1) {
        if (!rh[i] && rnd() > o.density * 0.2) {
          out.push(rest());
          continue;
        }
        const r = rnd();
        const deg = r < 0.55 ? degAt(i) : r < 0.75 ? fifth : r < 0.9 ? (o.degrees === 5 ? 1 : 2) : seventh;
        out.push(note(deg, rnd() < 0.35 ? 1 : rnd() < 0.1 * (o.range - 1) ? 2 : 0, i % 4 !== 0 && rnd() < o.accents * 0.7));
      }
      break;
    }
    case 'EBM': {
      // Le sequenceur qui martele : toutes les doubles croches, la tonique, un accent par temps, la ligne qui change a mi-mesure
      for (let i = 0; i < BASS_STEPS; i += 1) {
        const q = i % 4;
        if (q === 1 && rnd() > 0.4 + 0.6 * o.density) {
          out.push(rest());
          continue;
        }
        out.push(note(degAt(i), q === 0 && o.range >= 2 && rnd() < 0.15 ? 1 : 0, q === 0 ? rnd() < 0.3 + o.accents : rnd() < o.accents * 0.15));
      }
      break;
    }
    case 'ITALO': {
      // L'octave en doubles croches (grave, aigue, grave, aigue), l'accord qui change a mi-mesure
      for (let i = 0; i < BASS_STEPS; i += 1) {
        if (i % 2 === 1 && rnd() > 0.55 + 0.45 * o.density) {
          out.push(rest());
          continue;
        }
        out.push(note(degAt(i), i % 2, i % 4 === 2 && rnd() < o.accents * 0.6));
      }
      break;
    }
    default: {
      // SUB : de longues notes liees ; DENSITY : combien par mesure (1 a 4)
      const n = 1 + Math.round(o.density * 3);
      const choices = [0, fifth, seventh, o.degrees === 5 ? 2 : 5, o.degrees === 5 ? 1 : 3];
      for (let k = 0; k < n; k += 1) {
        const deg = k === 0 ? 0 : choices[pick([1, 3, 2, 1.5, 1.5], rnd)];
        // Des longueurs entieres (trois notes : 5, 6, 5 pas), seize pas en tout
        const len = Math.round(((k + 1) * BASS_STEPS) / n) - Math.round((k * BASS_STEPS) / n);
        for (let j = 0; j < len; j += 1) out.push(j === 0 ? note(deg, -1, false) : tie());
      }
    }
  }
  // Les slides : vers une note qui suit, selon SLIDES (l'acid et le sub glissent le plus)
  const slideK = o.style === 'ACID' ? 0.6 : o.style === 'SUB' ? 0.5 : o.style === 'HOUSE' ? 0.4 : o.style === 'EBM' || o.style === 'PSY PROG' ? 0.05 : 0.18;
  for (let i = 0; i < BASS_STEPS; i += 1) {
    const s = out[i];
    if (s.kind === 'off') continue;
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
