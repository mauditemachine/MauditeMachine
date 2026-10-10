/**
 * Le generateur de basslines du MM-BASS (2026-10-07, Mika : "un generateur
 * de bassline ; MM-ARP fait des melodies, je veux un generateur de bassline
 * qui peut descendre super bas", inspire du Torso T-1 : des regles plutot
 * que des notes). Onze styles de musique electronique (2026-10-07, Mika :
 * "des styles de musique electro differents, et pas juste Disco"), ceux que
 * Mika joue d'abord (dark disco, indie dance, minimal hypnotique, rolling) :
 * - ACID : des doubles croches de 303, la tonique et ses voisines, des sauts
 *   d'octave, des accents plutot a contretemps, des slides ;
 * - DARK DISCO : l'octave qui saute (basse sur le temps, haute sur le "et"),
 *   la ligne qui descend a mi-mesure ;
 * - INDIE DANCE : des croches qui poussent, l'octave a contretemps, des
 *   doubles croches fantomes ;
 * - MINIMAL : peu de notes, a cote des temps, une figure de huit pas repetee ;
 * - ROLLING : le roulement (K B B B, ou K . B B plus clair) ;
 * - TECHNO : la basse sur le contretemps, un grondement autour ;
 * - HOUSE : des rythmes qui chaloupent, des notes tenues, des notes en plus
 *   quand DENSITY monte ;
 * - ELECTRO : la syncope 3 + 3 + 2, les sauts d'octave ;
 * - EBM : toutes les doubles croches, martelees ;
 * - ITALO : l'octave en doubles croches, l'accord qui change ;
 * - SUB : de longues notes basses liees (TIE), qui changent une a quatre
 *   fois par mesure, glissent parfois.
 * DENSITY : combien de notes (ou de changements en SUB) ; SLIDES et ACCENTS :
 * leurs chances ; RANGE : l'etendue en octaves. Fonctions pures (le hasard
 * se passe en argument : elles se testent hors du navigateur).
 *
 * Les candidats (2026-10-09) : une graine rend seize candidats, chacun avec son
 * rang (0, il sonne toujours, le squelette du style ; puis ses seuils, dans
 * leur ordre). Tous les tirages se font dans le meme ordre : le meme style et
 * la meme graine rendent toujours les memes notes. Une liaison n'a jamais un
 * rang plus bas que la note qu'elle continue.
 * Les prises et NOTES (2026-10-09, Mika : "Je trouve Style et Density
 * complexe a utiliser") : plus de DENSITY continue ni de regenerate ; une
 * ligne est une prise numerotee et une echelle de seize barreaux (voir plus
 * bas, genLadder, curatedLadder, render), NOTES compte les notes, un cran
 * pour une note. Ce module n'importe rien de bass/state.ts a l'execution
 * (des types seulement).
 */

import type { BassStyle } from './params';
import type { BassLadder, BassRung, BassStep } from './state';

/** Les seize pas (bass/state.ts BASS_STEPS, recopie : pas d'import a l'execution, voir plus haut). */
const N = 16;

export interface GenOpts {
  style: BassStyle;
  density: number;
  slides: number;
  accents: number;
  /** 1, 2 ou 3 octaves */
  range: number;
  /** le nombre de degres de la gamme (7, 5 en pentatonique) */
  degrees: number;
  /** la graine de la ligne (2026-10-09) ; absente, rnd en tire une */
  seed?: number;
  rnd?: () => number;
}

/** Les poids des degres d'une gamme a sept notes (la tonique et la quinte d'abord) ; a cinq : la pentatonique mineure. */
const W7 = [6, 0.6, 2.2, 1.4, 3.4, 1, 2.2];
const W5 = [6, 2.2, 1.4, 3.4, 2.2];

/** Un degre tire selon ses poids, d'une valeur de 0 a 1. */
function pickV(weights: readonly number[], v: number): number {
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = v * sum;
  for (let i = 0; i < weights.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 0;
}

const note = (deg: number, oct = 0, acc = false, slide = false): BassStep => ({ kind: 'note', deg, oct, acc, slide });
const rest = (): BassStep => ({ kind: 'off', deg: 0, oct: 0, acc: false, slide: false });

/** La quinte de la gamme (son degre). */
const fifthOf = (degrees: number): number => (degrees === 5 ? 3 : 4);
const seventhOf = (degrees: number): number => (degrees === 5 ? 4 : 6);

/** Le second accord d'une mesure (le degre ou la ligne monte a mi-chemin) : la sixte, la quarte, la septieme. */
const turnOf = (degrees: number, v: number): number => (degrees === 5 ? [2, 3, 4][Math.floor(v * 3)] : [5, 3, 6, 4][Math.floor(v * 4)]);

/** Un tirage qu'on peut refaire (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un pas qui ne sonne jamais (son seuil passe 1). */
const NEVER = 2;

/**
 * Un candidat : ce que le pas joue quand il sonne, et a partir de quelle DENSITY (rank). Sous son seuil, il se tait
 * (fallback off) ou continue la note d'avant (tie : les changements de SUB qui ne sont pas encore la). slideU : son
 * tirage pour SLIDE PROB.
 */
export interface Cand {
  step: BassStep;
  rank: number;
  fallback: 'off' | 'tie';
  slideU: number;
}

/** Le seuil d'un pas qui sonne si u < a + b x DENSITY : 0 s'il sonne toujours, NEVER s'il ne sonne jamais. */
function gate(u: number, a: number, b: number): number {
  if (u < a) return 0;
  if (b <= 0) return NEVER;
  const r = (u - a) / b;
  return r > 1 ? NEVER : r;
}

/** Les slides : l'acid et le sub glissent le plus. */
export const slideK = (style: BassStyle): number => (style === 'ACID' ? 0.6 : style === 'SUB' ? 0.5 : style === 'HOUSE' ? 0.4 : style === 'EBM' || style === 'ROLLING' ? 0.05 : 0.18);

/** La graine des options (absente : tiree de rnd, ou du hasard). */
const seedOf = (o: GenOpts): number => (o.seed !== undefined ? o.seed >>> 0 : Math.floor((o.rnd ?? Math.random)() * 4294967296) >>> 0);

/**
 * Les seize candidats d'une graine et d'un style (DENSITY n'y entre pas : elle ne fait que choisir lesquels sonnent).
 * Deux suites : R pour le contenu (huit tirages par pas, seize pour la mesure, toujours tous tires), U pour les seuils.
 */
export function candidates(o: GenOpts, seed: number): Cand[] {
  const R = seeded(seed);
  const U = seeded((seed ^ 0x51ed270b) >>> 0);
  const r: number[][] = Array.from({ length: N }, () => Array.from({ length: 8 }, R));
  const g: number[] = Array.from({ length: 32 }, R);
  const u: number[] = Array.from({ length: N }, U);
  const W = o.degrees === 5 ? W5 : W7;
  const fifth = fifthOf(o.degrees);
  const seventh = seventhOf(o.degrees);
  const range = Math.max(1, Math.min(3, Math.round(o.range)));
  const up = (i: number): number => (range >= 2 && r[i][5] < 0.18 * (range - 1) ? 1 : 0) + (range >= 3 && r[i][6] < 0.08 ? 1 : 0);
  // La moitie de la mesure ou la ligne change de degre (une fois sur deux ; DENSITY n'y entre plus : une note ne change
  // jamais de hauteur quand DENSITY bouge)
  const turn = g[0] < 0.55 ? turnOf(o.degrees, g[1]) : 0;
  const degAt = (i: number): number => (i >= 8 ? turn : 0);
  const c: Cand[] = Array.from({ length: N }, (_, i): Cand => ({ step: rest(), rank: NEVER, fallback: 'off', slideU: r[i][7] }));
  const set = (i: number, step: BassStep, rank: number): void => {
    c[i].step = step;
    c[i].rank = rank;
  };
  const tieAt = (i: number, rank: number): void => set(i, { kind: 'tie', deg: 0, oct: 0, acc: false, slide: false }, rank);
  const pickRhythm = (list: readonly string[], v: number): boolean[] => [...list[Math.min(list.length - 1, Math.floor(v * list.length))]].map((x) => x === 'x');
  switch (o.style) {
    case 'ACID': {
      // Des doubles croches de 303 : la tonique et ses voisines, des sauts d'octave, des accents a contretemps
      for (let i = 0; i < N; i += 1) {
        const rank = i === 0 ? 0 : gate(u[i], 0.32 + (i % 4 === 0 ? 0.2 : 0), 0.55);
        if (i > 0 && r[i][0] < 0.06) {
          tieAt(i, rank);
          continue;
        }
        const deg = i === 0 ? 0 : pickV(W, r[i][1]);
        const oct = i === 0 ? 0 : r[i][2] < 0.22 ? 1 : up(i) > 0 ? 1 : 0;
        const acc = r[i][3] < o.accents * (i % 2 === 1 ? 0.7 : 0.45) || (i === 0 && o.accents > 0.2);
        set(i, note(deg, oct, acc), rank);
      }
      break;
    }
    case 'DARK DISCO': {
      // L'octave qui saute (basse sur le temps, haute sur le "et"), sombre : la ligne descend a la sixte a mi-mesure
      for (let i = 0; i < N; i += 1) {
        const q = i % 4;
        const d = degAt(i);
        // (2026-10-09, la revue : plus de pas qui dependent de DENSITY, de 5 a 12 notes, pour qu'elle se voie sur toute sa course)
        if (q === 0) set(i, note(d, 0, false), 0);
        else if (q === 2) set(i, note(d, 1, r[i][3] < o.accents * 0.8), gate(u[i], 0.3, 0.7));
        else if (q === 3) set(i, note(r[i][0] < 0.6 ? d : pickV(W, r[i][1]), 1, false), gate(u[i], 0, 0.7));
        else set(i, note(pickV(W, r[i][1]), 0, false), gate(u[i], 0, 0.4));
      }
      if (g[2] < 0.7) set(14, note(g[3] < 0.5 ? fifth : seventh, 0, false), 0);
      break;
    }
    case 'INDIE DANCE': {
      // Des croches qui poussent, l'octave sur le contretemps, des doubles croches fantomes, la quinte en fin de mesure
      for (let i = 0; i < N; i += 1) {
        const q = i % 4;
        const d = degAt(i);
        if (q === 0 || q === 2) set(i, note(d, q === 2 && r[i][0] < 0.45 ? 1 : 0, q === 2 && r[i][3] < o.accents * 0.7), q === 0 ? 0 : gate(u[i], 0.6, 0.4));
        else set(i, note(q === 3 && r[i][0] < 0.3 ? fifth : d, q === 3 && r[i][2] < 0.3 ? 1 : 0, r[i][3] < o.accents * 0.3), gate(u[i], 0, 0.55));
      }
      if (g[2] < 0.6) set(15, note(g[3] < 0.5 ? fifth : seventh, 0, true), 0);
      break;
    }
    case 'MINIMAL': {
      // Peu de notes, a cote des temps, et une figure de huit pas repetee (l'hypnose) : 1 a 4 notes selon DENSITY, les
      // premieres tirees d'abord (la quatrieme n'arrive qu'en haut de DENSITY)
      const spots = [2, 3, 6, 7, 1, 5];
      const motif: (Cand | null)[] = Array.from({ length: 8 }, () => null);
      for (let k = 0; k < 4; k += 1) {
        const [v, w, x, y, z] = g.slice(2 + k * 5, 7 + k * 5);
        const at = spots[Math.min(spots.length - 1, Math.floor(v * Math.min(spots.length, 3 + k)))];
        if (motif[at]) continue;
        motif[at] = { step: note(w < 0.75 ? 0 : x < 0.5 ? fifth : seventh, y < 0.15 * (range - 1) ? 1 : 0, z < o.accents * 0.5), rank: k === 0 ? 0 : (k - 0.5) / 3, fallback: 'off', slideU: 1 };
      }
      // La copie de la seconde moitie arrive un cran apres celle de la premiere (2026-10-09, la revue : DENSITY ne
      // changeait la ligne que trois fois sur toute sa course) : la figure se complete, puis se repete
      for (let i = 0; i < N; i += 1) {
        const m = motif[i % 8];
        if (m) set(i, { ...m.step }, i >= 8 && m.rank > 0 ? Math.min(1, m.rank + 1 / 6) : m.rank);
      }
      // La seconde moitie varie a peine : une note de plus sur une place vide, ou une note du motif qui se tait
      if (g[24] < 0.5) {
        const i = 8 + spots[Math.floor(g[25] * 4)];
        if (!motif[i - 8]) set(i, note(0, 0, false), 0.3);
        else set(i, rest(), NEVER);
      }
      break;
    }
    case 'ROLLING': {
      // Le roulement : la grosse caisse sur le temps, la basse sur les trois doubles croches d'apres (K B B B) ;
      // moins dense : la double croche d'apres le temps reste vide (K . B B, plus clair)
      for (let i = 0; i < N; i += 1) {
        const q = i % 4;
        if (q === 0) continue;
        const end = i >= 13 && r[i][0] < 0.35;
        const deg = end ? (r[i][1] < 0.5 ? seventh : fifth) : degAt(i) === 0 ? 0 : r[i][2] < 0.5 ? degAt(i) : 0;
        set(i, note(deg, end && range >= 2 && r[i][4] < 0.4 ? 1 : 0, q === 2 && r[i][3] < o.accents * 0.5), q === 1 ? Math.min(NEVER, (u[i] + 0.1) / 1.1) : 0);
      }
      break;
    }
    case 'TECHNO': {
      // La basse sur le contretemps (le "et"), un grondement de doubles croches autour, la septieme a la fin
      for (let i = 0; i < N; i += 1) {
        const q = i % 4;
        if (q === 2) set(i, note(degAt(i) && r[i][0] < 0.5 ? degAt(i) : 0, 0, r[i][3] < o.accents * 0.8), 0);
        else if (q !== 0) set(i, note(0, 0, false), gate(u[i], 0, 0.55));
        else set(i, note(0, -1, false), r[i][0] < 0.3 ? 0.86 : NEVER);
      }
      if (g[2] < 0.4) set(14, note(seventh, 0, true), 0);
      break;
    }
    case 'HOUSE': {
      // Une ligne qui chaloupe : des rythmes de house, des notes tenues (liaisons), l'octave et la quinte ; DENSITY
      // (2026-10-09) ajoute des notes entre celles du rythme (avant, elle ne changeait que les liaisons)
      const rh = pickRhythm(['x..x..x...x.x...', '...x..x...xx..x.', 'x.x...x..x..x.x.', '..x..x..x.x...x.'], g[2]);
      const degOf = (i: number): number => {
        const v = r[i][1];
        return v < 0.5 ? degAt(i) : v < 0.7 ? fifth : v < 0.85 ? seventh : pickV(W, r[i][2]);
      };
      for (let i = 0; i < N; i += 1) {
        if (rh[i]) set(i, note(degOf(i), r[i][0] < 0.2 + 0.1 * range ? 1 : 0, r[i][3] < o.accents * 0.5), 0);
        else if (i > 0 && r[i][4] < 0.45) tieAt(i, 0);
        else set(i, note(degOf(i), 0, false), 0.35 + 0.65 * u[i]);
      }
      break;
    }
    case 'ELECTRO': {
      // Syncope 3 + 3 + 2, des sauts d'octave robotiques, des accents sur les syncopes
      const rh = pickRhythm(['x..x..x.x..x..x.', 'x..x..x...x.x.x.', 'x.xx..x.x..x..xx'], g[2]);
      for (let i = 0; i < N; i += 1) {
        const v = r[i][1];
        const deg = v < 0.55 ? degAt(i) : v < 0.75 ? fifth : v < 0.9 ? (o.degrees === 5 ? 1 : 2) : seventh;
        // Hors du rythme, plus de notes possibles (2026-10-09, la revue : 0.35 -> 0.6, DENSITY ne changeait la ligne que trois fois)
        set(i, note(deg, r[i][0] < 0.35 ? 1 : r[i][2] < 0.1 * (range - 1) ? 2 : 0, i % 4 !== 0 && r[i][3] < o.accents * 0.7), rh[i] ? 0 : gate(u[i], 0, 0.6));
      }
      break;
    }
    case 'EBM': {
      // Le sequenceur qui martele : toutes les doubles croches, la tonique, un accent par temps, la ligne qui change a mi-mesure
      for (let i = 0; i < N; i += 1) {
        const q = i % 4;
        // Les doubles croches entre les croches dependent de DENSITY (2026-10-09, la revue : de 9 a 16 notes, plus de 12 a 16)
        set(i, note(degAt(i), q === 0 && range >= 2 && r[i][0] < 0.15 ? 1 : 0, q === 0 ? r[i][3] < 0.3 + o.accents : r[i][3] < o.accents * 0.15), q === 1 ? gate(u[i], 0.1, 0.9) : q === 3 ? gate(u[i], 0.2, 0.8) : 0);
      }
      break;
    }
    case 'ITALO': {
      // L'octave en doubles croches (grave, aigue, grave, aigue), l'accord qui change a mi-mesure
      for (let i = 0; i < N; i += 1) set(i, note(degAt(i), i % 2, i % 4 === 2 && r[i][3] < o.accents * 0.6), i % 2 === 1 ? gate(u[i], 0.3, 0.7) : 0);
      break;
    }
    default: {
      // SUB : de longues notes liees ; DENSITY : combien de changements par mesure (1 a 4), poses l'un dans l'autre (le
      // temps 1, le temps 3, puis le 4 ou le 2) : un changement de plus coupe une note longue, jamais ne la deplace
      const choices = [0, fifth, seventh, o.degrees === 5 ? 2 : 5, o.degrees === 5 ? 1 : 3];
      const third = g[2] < 0.5 ? 12 : 4;
      const at = [0, 8, third, third === 12 ? 4 : 12];
      for (let i = 0; i < N; i += 1) tieAt(i, 0);
      at.forEach((p, k) => {
        set(p, note(k === 0 ? 0 : choices[pickV([1, 3, 2, 1.5, 1.5], g[3 + k])], -1, false), k === 0 ? 0 : (k - 0.5) / 3);
        c[p].fallback = 'tie';
      });
    }
  }
  // Une liaison ne sonne jamais avant la note qu'elle continue (sinon monter DENSITY changerait une note en liaison) ;
  // elle continue un pas qui se replie en liaison (les changements de SUB) : sous son seuil, elle reste une liaison
  // aussi (2026-10-09, la revue : en SUB, la note longue se taisait de 3 a 11 pas sous DENSITY 83)
  for (let i = 1; i < N; i += 1) {
    if (c[i].step.kind !== 'tie') continue;
    c[i].rank = Math.max(c[i].rank, c[i - 1].rank);
    if (c[i - 1].fallback === 'tie') c[i].fallback = 'tie';
  }
  if (c[0].step.kind === 'tie') c[0] = { ...c[0], step: rest(), rank: NEVER };
  // La resolution de DENSITY (2026-10-09, la revue : un balayage entier ne changeait la ligne que 2 a 5 fois, la moitie
  // de la course a plat) : les seuils de la graine, dans leur ordre, repartis a egale distance sur la course. L'ordre ne
  // change pas (DENSITY reste monotone) ; des seuils egaux le restent (une note et sa liaison, la figure de MINIMAL).
  const ranks = [...new Set(c.map((x) => x.rank).filter((r) => r > 0 && r <= 1))].sort((a, b) => a - b);
  if (ranks.length) for (const x of c) if (x.rank > 0 && x.rank <= 1) x.rank = (ranks.indexOf(x.rank) + 1) / (ranks.length + 1);
  return c;
}

/**
 * Un pas libre (2026-10-09) : le generateur peut y mettre une note ou un silence. Un pas du generateur (src gen), ou un
 * pas vide jamais touche (une ligne d'usine, une ligne d'avant la recette) ; jamais un pas fait a la main (src hand :
 * une tape, un glisser, ACCENT, SLIDE, NOTE, OCT), ni une note ou une liaison d'une ligne ecrite a la main (sans src),
 * ni un pas qui porte des P-locks.
 */
export const isFreeStep = (s: BassStep): boolean => !s.locks && (s.src === 'gen' || (s.src === undefined && s.kind === 'off'));

/**
 * Les finitions : une liaison du generateur apres un silence se tait (gen : les pas que le generateur a ecrits), les
 * notes tirees des candidats glissent vers une note qui suit selon SLIDE PROB (cand ; une note de la ligne d'usine garde
 * son slide tel qu'ecrit).
 */
function finish(out: BassStep[], cands: readonly Cand[], gen: readonly boolean[], o: GenOpts, cand: readonly boolean[] = gen): BassStep[] {
  for (let i = 0; i < N; i += 1) {
    if (!gen[i]) continue;
    const s = out[i];
    const prev = out[(i + N - 1) % N];
    if (s.kind === 'tie' && (i === 0 || prev.kind === 'off')) out[i] = { ...rest(), src: 'gen' };
  }
  const k = slideK(o.style);
  for (let i = 0; i < N; i += 1) {
    if (!gen[i] || !cand[i]) continue;
    const s = out[i];
    if (s.kind === 'off') continue;
    const slide = i < N - 1 && out[i + 1].kind === 'note' && cands[i].slideU < o.slides * k;
    if (s.slide !== slide) out[i] = { ...s, slide };
  }
  return out;
}

const candStep = (c: Cand): BassStep => ({ ...c.step, src: 'gen' });
const fallbackStep = (c: Cand): BassStep => (c.fallback === 'tie' ? { kind: 'tie', deg: 0, oct: 0, acc: false, slide: false, src: 'gen' } : { ...rest(), src: 'gen' });

/** GEN : une ligne entiere du generateur (chaque pas a src gen). */
export function generate(o: GenOpts): BassStep[] {
  const cands = candidates(o, seedOf(o));
  const d = Math.min(1, Math.max(0, o.density));
  const out = cands.map((c) => (c.rank <= d ? candStep(c) : fallbackStep(c)));
  return finish(out, cands, out.map(() => true), o);
}

/* ---------------- les prises, l'echelle des notes (2026-10-09) ---------------- */

/*
 * STYLE et NOTES simples (2026-10-09, Mika : "je ne vois pas ce que Style et density font", puis "Je trouve Style et
 * Density complexe a utiliser") : une ligne est une PRISE d'un style (ACID 07), et une ECHELLE de seize barreaux, un
 * par pas, dans un ordre fixe (le squelette du style d'abord, les ornements a la fin). NOTES = n : les premiers
 * barreaux jouent jusqu'a ce que la mesure ait n notes ; un cran de plus, le barreau suivant entre ; un cran de moins,
 * le dernier qui joue sort. Un barreau ne change jamais de hauteur quand NOTES bouge. Tes notes (pins : une tape, un
 * glisser, ACCENT, SLIDE, NOTE, OCT, un P-lock) restent par-dessus, telles quelles. Les prises 01 a k d'un style sont
 * les lignes de ses presets d'usine (state/factory.ts bassCuratedLines, dans leur ordre), les suivantes viennent du
 * generateur (la graine STYLE#n). Fonctions pures, sans etat : bass/line.ts les applique a la ligne qui joue.
 */

/** La classe d'un pas : le 1, puis les temps (5, 9, 13), les "et" (3, 7, 11, 15), les autres. */
export const beatClass = (i: number): number => (i === 0 ? 0 : i % 4 === 0 ? 1 : i % 2 === 0 ? 2 : 3);

/** Un style lie (SUB) : un pas libre apres un pas qui sonne le continue, sauf un silence ecrit. */
export const isLegato = (style: BassStyle): boolean => style === 'SUB';

/** FNV-1a, le hachage de state/factory.ts seedOfName ; h0, l'etat de depart (un prefixe deja hache). */
export function fnv1a(s: string, h0 = 0x811c9dc5): number {
  let h = h0 >>> 0;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}

/**
 * Le hachage du nom d'un style renomme (2026-10-10) : celui de son nom d'avant, pour que ses prises gardent leurs
 * notes (ROLLING 05 joue la meme ligne qu'avant le nouveau nom). Les autres styles : leur nom.
 */
const SEED_PREFIX: Partial<Record<BassStyle, number>> = { ROLLING: 0x33cddadd };

/** La graine d'une prise (ACID 07 : ACID#7), la meme pour tout le monde, a chaque visite. */
export const takeSeed = (style: BassStyle, take: number): number => fnv1a(`#${take}`, SEED_PREFIX[style] ?? fnv1a(style));

/** Ce qui joue sur une echelle : le style (ses slides), SLIDE PROB et ACC PROB (0 a 1), RANGE (1 a 3 octaves). */
export interface LineOpts {
  style: BassStyle;
  slides: number;
  accents: number;
  range: number;
}

/** Tes pas (pins), par pas ; null : un pas libre (la machine y joue). */
export type Pins = readonly (BassStep | null)[];
export const pinsOf = (steps: readonly BassStep[]): (BassStep | null)[] => steps.map((s) => (isFreeStep(s) ? null : s));

/** La resolution du tirage d'ACC PROB garde sur un barreau (accU) : 1/32 de la course. */
const ACC_GRID = 32;

/**
 * Les seize barreaux d'une graine et leur cle d'ordre : le rang du candidat (0, le squelette ; puis ses seuils), puis
 * la classe du pas, puis le pas ; les pas ou le style ne joue jamais en dernier (la tonique, sans accent). Chaque note
 * du generateur garde ses tirages (slideU, accU : le seuil d'ACC PROB au-dessus duquel elle est accentuee, octR : son
 * octave a RANGE 1, 2, 3) : SLIDE PROB, ACC PROB et RANGE agissent en direct sur les notes de la machine.
 */
function seedRungs(style: BassStyle, degrees: number, seed: number): { rungs: BassRung[]; key: number[] } {
  const o = (range: number, accents: number): GenOpts => ({ style, density: 1, slides: 0, accents, range, degrees });
  const c = candidates(o(2, 0), seed);
  const octs = [1, 2, 3].map((r) => candidates(o(r, 0), seed));
  const accU: number[] = Array.from({ length: N }, () => 2);
  for (let k = ACC_GRID; k >= 0; k -= 1) {
    const a = candidates(o(2, k / ACC_GRID), seed);
    for (let i = 0; i < N; i += 1) if (a[i].step.kind === 'note' && a[i].step.acc) accU[i] = k === 0 ? -1 : (k - 0.5) / ACC_GRID;
  }
  const fill = style === 'SUB' ? -1 : 0;
  const key: number[] = [];
  const rungs: BassRung[] = [];
  for (let i = 0; i < N; i += 1) {
    const s = c[i].step;
    if (s.kind === 'note') {
      const holds: number[] = [];
      for (let j = i + 1; j < N && c[j].step.kind === 'tie'; j += 1) holds.push(j);
      rungs.push({ step: i, deg: s.deg, oct: s.oct, acc: false, slide: false, holds, slideU: c[i].slideU, accU: accU[i], octR: [octs[0][i].step.oct, octs[1][i].step.oct, octs[2][i].step.oct] });
      key.push(c[i].rank <= 1 ? c[i].rank : 3 + beatClass(i) * 0.1);
    } else {
      rungs.push({ step: i, deg: 0, oct: fill, acc: false, slide: false, holds: [] });
      key.push(3 + beatClass(i) * 0.1);
    }
  }
  rungs.sort((a, b) => key[a.step] - key[b.step] || beatClass(a.step) - beatClass(b.step) || a.step - b.step);
  return { rungs, key };
}

/** L'echelle d'une prise generee (ACID 04 et plus, 2026-10-09). */
export function genLadder(style: BassStyle, take: number, degrees: number): BassLadder {
  return { rungs: seedRungs(style, degrees, takeSeed(style, take)).rungs, rests: [], legato: isLegato(style) };
}

/**
 * L'echelle d'une prise ecrite (une ligne d'usine) : ses notes d'abord (le rang du style a ce pas, accentuees avant les
 * autres, la classe, le pas), puis les candidats du style sur les autres pas (la graine de la prise), puis les pas ou il
 * ne joue jamais ; ses silences ecrits restent des silences (rests). A son compte (on), la ligne est telle qu'ecrite.
 */
export function curatedLadder(style: BassStyle, line: readonly BassStep[], take: number, degrees: number): { ladder: BassLadder; on: number } {
  const { rungs, key } = seedRungs(style, degrees, takeSeed(style, take));
  const written: BassRung[] = [];
  for (let i = 0; i < N; i += 1) {
    const w = line[i];
    if (!w || w.kind !== 'note') continue;
    const holds: number[] = [];
    for (let j = i + 1; j < N && line[j]?.kind === 'tie'; j += 1) holds.push(j);
    written.push({ step: i, deg: w.deg, oct: w.oct, acc: w.acc, slide: w.slide, holds });
  }
  written.sort((a, b) => key[a.step] - key[b.step] || Number(b.acc) - Number(a.acc) || beatClass(a.step) - beatClass(b.step) || a.step - b.step);
  const used = new Set(written.map((r) => r.step));
  const rests: number[] = [];
  for (let i = 0; i < N; i += 1) if (line[i]?.kind === 'off') rests.push(i);
  return { ladder: { rungs: [...written, ...rungs.filter((r) => !used.has(r.step))], rests, legato: isLegato(style) }, on: written.length };
}

/** Ce que joue un barreau actif (ses tirages lus au reglage du moment ; ses slides tires apres, render). */
function play(r: BassRung, o: LineOpts): BassStep {
  const range = Math.max(1, Math.min(3, Math.round(o.range)));
  return { kind: 'note', deg: r.deg, oct: r.octR ? r.octR[range - 1] : r.oct, acc: r.accU !== undefined ? r.accU < o.accents : r.acc, slide: r.slideU !== undefined ? false : r.slide, src: 'gen' };
}

/**
 * La ligne qui joue (2026-10-09) : tes pas copies tels quels ; un barreau actif (les on premiers) joue sa note ; un pas
 * libre juste apres un pas qui sonne est une liaison s'il est tenu par un barreau actif (holds), ou si le style est lie
 * et que ce n'est pas un silence ecrit ; sinon un vide. Une liaison ne passe jamais du pas 16 au pas 1. Les slides des
 * notes de la machine : leur tirage sous SLIDE PROB x le style, vers une note (comme finish).
 */
export function render(L: BassLadder, on: number, pins: Pins, o: LineOpts): BassStep[] {
  const act = new Map<number, BassRung>();
  for (const r of L.rungs.slice(0, Math.max(0, Math.min(N, on)))) act.set(r.step, r);
  const owner = new Set<number>();
  for (const r of act.values()) for (const t of r.holds) owner.add(t);
  const rests = new Set(L.rests);
  const out: BassStep[] = [];
  for (let i = 0; i < N; i += 1) {
    const pin = pins[i];
    if (pin) {
      out.push(pin);
      continue;
    }
    const r = act.get(i);
    if (r) {
      out.push(play(r, o));
      continue;
    }
    const sounding = i > 0 && out[i - 1].kind !== 'off';
    if (sounding && (owner.has(i) || (L.legato && !rests.has(i)))) out.push({ kind: 'tie', deg: 0, oct: 0, acc: false, slide: false, src: 'gen' });
    else out.push({ kind: 'off', deg: 0, oct: 0, acc: false, slide: false, src: 'gen' });
  }
  const k = slideK(o.style);
  for (const r of act.values()) {
    if (r.slideU === undefined || pins[r.step]) continue;
    const i = r.step;
    if (i < N - 1 && out[i + 1].kind === 'note' && r.slideU < o.slides * k) out[i] = { ...out[i], slide: true };
  }
  return out;
}

/** Le nombre de notes de la mesure (ce qu'on entend : les liaisons ne comptent pas). */
export const noteCount = (steps: readonly BassStep[]): number => steps.reduce((n, s) => n + (s.kind === 'note' ? 1 : 0), 0);

/** NOTES + 1 : le on qui ajoute exactement une note (les barreaux sur tes pas passent) ; null au plafond. */
export function notesUp(L: BassLadder, on: number, pins: Pins, o: LineOpts): number | null {
  const c0 = noteCount(render(L, on, pins, o));
  for (let k = on + 1; k <= N; k += 1) if (noteCount(render(L, k, pins, o)) > c0) return k;
  return null;
}

/**
 * NOTES - 1 : le on qui retire exactement une note ; le pas en P-LOCK (lock, une note de la machine) ne sort pas : son
 * barreau change de place avec celui d'avant (sortir du P-LOCK ne change rien a l'oreille). null au plancher.
 */
export function notesDown(L: BassLadder, on: number, pins: Pins, o: LineOpts, lock = -1): { on: number; ladder: BassLadder } | null {
  const c0 = noteCount(render(L, on, pins, o));
  const rungs = L.rungs.slice();
  let k = Math.min(N, on);
  while (k > 0) {
    if (lock >= 0 && !pins[lock] && rungs[k - 1].step === lock) {
      if (k < 2) return null;
      [rungs[k - 1], rungs[k - 2]] = [rungs[k - 2], rungs[k - 1]];
    }
    k -= 1;
    const next = { ...L, rungs };
    const c = noteCount(render(next, k, pins, o));
    if (c < c0) {
      // Le plus petit on de ce compte (les barreaux sur tes pas passent aussi en descendant) : la ligne a n notes est
      // la meme en montant et en descendant
      while (k > 0 && rungs[k - 1].step !== lock && noteCount(render(next, k - 1, pins, o)) === c) k -= 1;
      return { on: k, ladder: next };
    }
  }
  return null;
}

/** Le plancher (tes notes) et le plafond (tout ce que l'echelle peut jouer autour de tes pas). */
export const notesFloor = (L: BassLadder, pins: Pins, o: LineOpts): number => noteCount(render(L, 0, pins, o));
export const notesCeiling = (L: BassLadder, pins: Pins, o: LineOpts): number => noteCount(render(L, N, pins, o));

/** Le plus petit on qui donne n notes (ou le plus proche par en dessous, au plafond) : GEN garde le compte. */
export function onForCount(L: BassLadder, n: number, pins: Pins, o: LineOpts): number {
  let best = 0;
  for (let k = 0; k <= N; k += 1) {
    const c = noteCount(render(L, k, pins, o));
    if (c === n) return k;
    if (c < n) best = k;
  }
  return best;
}

/**
 * Adopter une ligne (2026-10-09, une ligne d'avant les prises, une ligne reparee) : ses notes de la machine (src gen,
 * sans P-lock) deviennent les premiers barreaux, dans l'ordre de base (une prise ecrite) ou de l'echelle du style ; ses
 * liaisons de la machine suivent la note qu'elles continuent (une note a toi aussi : son barreau joue, sans compter) ;
 * les autres pas gardent les barreaux de l'echelle du style ; un style lie garde ses vides. La ligne rendue est celle
 * d'entree.
 */
export function adopt(steps: readonly BassStep[], style: BassStyle, degrees: number, seed: number, base?: BassLadder): { ladder: BassLadder; on: number } {
  const ref = base ?? { rungs: seedRungs(style, degrees, seed).rungs, rests: [], legato: isLegato(style) };
  const order = new Map(ref.rungs.map((r, i) => [r.step, i]));
  const holds = new Map<number, number[]>();
  for (let i = 1; i < N; i += 1) {
    const s = steps[i];
    if (s.kind !== 'tie' || !isFreeStep(s)) continue;
    let j = i - 1;
    while (j > 0 && steps[j].kind === 'tie') j -= 1;
    if (steps[j].kind !== 'note') continue;
    let list = holds.get(j);
    if (!list) {
      list = [];
      holds.set(j, list);
    }
    list.push(i);
  }
  const of = (i: number): BassRung => ({ step: i, deg: steps[i].deg, oct: steps[i].oct, acc: steps[i].acc, slide: steps[i].slide, holds: holds.get(i) ?? [] });
  const free = steps.map((s, i) => (s.kind === 'note' && isFreeStep(s) ? i : -1)).filter((i) => i >= 0);
  const pinned = [...holds.keys()].filter((j) => !isFreeStep(steps[j]));
  free.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  const used = new Set([...free, ...pinned]);
  const rungs = [...pinned.map(of), ...free.map(of), ...ref.rungs.filter((r) => !used.has(r.step))];
  const rests = new Set(ref.rests);
  if (ref.legato) steps.forEach((s, i) => s.kind === 'off' && isFreeStep(s) && rests.add(i));
  return { ladder: { rungs, rests: [...rests].sort((a, b) => a - b), legato: ref.legato }, on: pinned.length + free.length };
}

/**
 * MUTATE (2026-10-09) : 2 ou 3 notes de la machine qui jouent (jamais les tiennes, jamais le pas en P-LOCK) changent :
 * une autre hauteur de la gamme (45 %, les poids de W7 / W5, jamais le meme degre, jamais celle du pas 1), l'octave
 * (15 %), l'accent (15 %), le slide (10 %, vers une note), un pas vers un voisin libre du meme temps (15 %). Le compte
 * ne change pas, chaque barreau garde sa place. null : aucune note de la machine.
 */
export function mutateLadder(L: BassLadder, on: number, pins: Pins, o: LineOpts, degrees: number, lock: number, rnd: () => number): { ladder: BassLadder; changed: number } | null {
  const out = render(L, on, pins, o);
  const c0 = noteCount(out);
  const pool: number[] = [];
  for (let k = 0; k < Math.min(on, L.rungs.length); k += 1) {
    const s = L.rungs[k].step;
    if (!pins[s] && s !== lock && out[s].kind === 'note') pool.push(k);
  }
  if (!pool.length) return null;
  const W = degrees === 5 ? W5 : W7;
  for (let tries = 0; tries < 6; tries += 1) {
    const rungs = L.rungs.map((r) => ({ ...r }));
    const pick = pool.slice();
    const n = Math.min(pick.length, rnd() < 0.5 ? 2 : 3);
    for (let m = 0; m < n; m += 1) {
      const ri = pick.splice(Math.floor(rnd() * pick.length), 1)[0];
      const r = rungs[ri];
      const cur = out[r.step];
      const x = rnd();
      const acc = (): void => {
        r.acc = !cur.acc;
        delete r.accU;
      };
      if (x < 0.45 && r.step !== 0) {
        const d0 = ((cur.deg % degrees) + degrees) % degrees;
        let d = d0;
        for (let t = 0; t < 12 && d === d0; t += 1) d = pickV(W, rnd());
        if (d === d0) d = (d0 + 1) % degrees;
        r.deg = d + degrees * Math.floor(cur.deg / degrees);
      } else if (x < 0.6) {
        r.oct = cur.oct >= 1 ? cur.oct - 1 : cur.oct + 1;
        delete r.octR;
      } else if (x < 0.75) acc();
      else if (x < 0.85) {
        if (r.step < N - 1 && out[r.step + 1].kind === 'note') {
          r.slide = !cur.slide;
          delete r.slideU;
        } else acc();
      } else {
        const s = r.step;
        const near = [s - 1, s + 1].filter((t) => s !== 0 && t > 0 && t < N && Math.floor(t / 4) === Math.floor(s / 4) && !pins[t] && t !== lock && out[t].kind === 'off');
        if (!near.length) {
          acc();
          continue;
        }
        const t = near[Math.floor(rnd() * near.length)];
        const ti = rungs.findIndex((q) => q.step === t);
        if (ti >= 0) rungs[ti] = { ...rungs[ti], step: s, holds: [] };
        r.step = t;
        r.holds = [];
      }
    }
    const ladder = { ...L, rungs };
    if (noteCount(render(ladder, on, pins, o)) === c0) return { ladder, changed: n };
  }
  return null;
}
