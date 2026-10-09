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
 * STYLE et DENSITY qui font vraiment quelque chose (2026-10-09, Mika : "je ne
 * vois pas ce que STYLE et DENSITY font") : une ligne a sa recette (une
 * graine, bass/state.ts), et le generateur rend de cette graine seize
 * candidats, chacun avec son seuil de DENSITY (rank : le pas sonne des que
 * DENSITY l'atteint ; 0, il sonne toujours, le squelette du style). Tous les
 * tirages se font dans le meme ordre quelle que soit DENSITY (deux suites,
 * une pour le contenu des pas, une pour leurs seuils) : monter DENSITY ne
 * fait qu'ajouter des notes, la baisser ne fait qu'en retirer, jamais une
 * note qui change de hauteur. Une liaison n'a jamais un seuil plus bas que
 * la note qu'elle continue. regenerate() ne reecrit que les pas libres (ceux
 * du generateur) et garde les pas faits a la main et tous les P-locks.
 * Ce module n'importe rien de bass/state.ts a l'execution (des types
 * seulement) : state.ts s'en sert pour sa ligne de depart.
 */

import type { BassStyle } from './params';
import type { BassStep } from './state';

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
interface Cand {
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
const slideK = (style: BassStyle): number => (style === 'ACID' ? 0.6 : style === 'SUB' ? 0.5 : style === 'HOUSE' ? 0.4 : style === 'EBM' || style === 'PSY PROG' ? 0.05 : 0.18);

/** La graine des options (absente : tiree de rnd, ou du hasard). */
const seedOf = (o: GenOpts): number => (o.seed !== undefined ? o.seed >>> 0 : Math.floor((o.rnd ?? Math.random)() * 4294967296) >>> 0);

/**
 * Les seize candidats d'une graine et d'un style (DENSITY n'y entre pas : elle ne fait que choisir lesquels sonnent).
 * Deux suites : R pour le contenu (huit tirages par pas, seize pour la mesure, toujours tous tires), U pour les seuils.
 */
function candidates(o: GenOpts, seed: number): Cand[] {
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
        if (q === 0) set(i, note(d, 0, false), 0);
        else if (q === 2) set(i, note(d, 1, r[i][3] < o.accents * 0.8), gate(u[i], 0.55, 0.45));
        else if (q === 3) set(i, note(r[i][0] < 0.6 ? d : pickV(W, r[i][1]), 1, false), gate(u[i], 0, 0.5));
        else set(i, note(pickV(W, r[i][1]), 0, false), gate(u[i], 0, 0.25));
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
      for (let i = 0; i < N; i += 1) {
        const m = motif[i % 8];
        if (m) set(i, { ...m.step }, m.rank);
      }
      // La seconde moitie varie a peine : une note de plus sur une place vide, ou une note du motif qui se tait
      if (g[24] < 0.5) {
        const i = 8 + spots[Math.floor(g[25] * 4)];
        if (!motif[i - 8]) set(i, note(0, 0, false), 0.3);
        else set(i, rest(), NEVER);
      }
      break;
    }
    case 'PSY PROG': {
      // Le roulement : la grosse caisse sur le temps, la basse sur les trois doubles croches d'apres (K B B B) ;
      // moins dense : la double croche d'apres le temps reste vide (K . B B, la prog)
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
        set(i, note(deg, r[i][0] < 0.35 ? 1 : r[i][2] < 0.1 * (range - 1) ? 2 : 0, i % 4 !== 0 && r[i][3] < o.accents * 0.7), rh[i] ? 0 : gate(u[i], 0, 0.35));
      }
      break;
    }
    case 'EBM': {
      // Le sequenceur qui martele : toutes les doubles croches, la tonique, un accent par temps, la ligne qui change a mi-mesure
      for (let i = 0; i < N; i += 1) {
        const q = i % 4;
        set(i, note(degAt(i), q === 0 && range >= 2 && r[i][0] < 0.15 ? 1 : 0, q === 0 ? r[i][3] < 0.3 + o.accents : r[i][3] < o.accents * 0.15), q === 1 ? gate(u[i], 0.4, 0.6) : q === 3 ? gate(u[i], 0.6, 0.4) : 0);
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
  // Une liaison ne sonne jamais avant la note qu'elle continue (sinon monter DENSITY changerait une note en liaison)
  for (let i = 1; i < N; i += 1) if (c[i].step.kind === 'tie') c[i].rank = Math.max(c[i].rank, c[i - 1].rank);
  if (c[0].step.kind === 'tie') c[0] = { ...c[0], step: rest(), rank: NEVER };
  return c;
}

/**
 * Un pas libre (2026-10-09) : le generateur peut y mettre une note ou un silence. Un pas du generateur (src gen), ou un
 * pas vide jamais touche (une ligne d'usine, une ligne d'avant la recette) ; jamais un pas fait a la main (src hand :
 * une tape, un glisser, ACCENT, SLIDE, NOTE, OCT), ni une note ou une liaison d'une ligne ecrite a la main (sans src),
 * ni un pas qui porte des P-locks.
 */
export const isFreeStep = (s: BassStep): boolean => !s.locks && (s.src === 'gen' || (s.src === undefined && s.kind === 'off'));

/** Les finitions : une liaison du generateur apres un silence se tait, ses slides vers une note qui suit. */
function finish(out: BassStep[], cands: readonly Cand[], gen: readonly boolean[], o: GenOpts): BassStep[] {
  for (let i = 0; i < N; i += 1) {
    if (!gen[i]) continue;
    const s = out[i];
    const prev = out[(i + N - 1) % N];
    if (s.kind === 'tie' && (i === 0 || prev.kind === 'off')) out[i] = { ...rest(), src: 'gen' };
  }
  const k = slideK(o.style);
  for (let i = 0; i < N; i += 1) {
    if (!gen[i]) continue;
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

/**
 * STYLE, DENSITY et les regles du generateur sur une ligne qui a sa recette (2026-10-09) : seuls les pas libres
 * changent (isFreeStep), les autres restent tels quels avec leurs P-locks. base null (une ligne de GEN) : un pas libre
 * sonne des que DENSITY atteint son seuil. base, un nombre (une ligne faite a la main, une ligne d'usine) : a cette
 * DENSITY la ligne est telle qu'on l'a ecrite (aucune note generee) ; au-dessus, les pas libres recoivent des notes du
 * style, le squelette d'abord, jusqu'a tous a DENSITY 100 ; au-dessous, rien ne s'enleve (les notes sont les tiennes).
 */
export function regenerate(steps: readonly BassStep[], o: GenOpts & { seed: number }, base: number | null): BassStep[] {
  const cands = candidates(o, o.seed >>> 0);
  const d = Math.min(1, Math.max(0, o.density));
  const free = steps.map(isFreeStep);
  let on: boolean[];
  if (base === null) on = cands.map((c) => c.rank <= d);
  else {
    const order = cands
      .map((c, i) => ({ c, i }))
      .filter((x) => free[x.i] && x.c.rank <= 1)
      .sort((a, b) => a.c.rank - b.c.rank || a.i - b.i);
    const k = d <= base ? 0 : Math.round(((d - base) / Math.max(0.02, 1 - base)) * order.length);
    on = steps.map(() => false);
    for (const x of order.slice(0, Math.min(order.length, k))) on[x.i] = true;
  }
  const out = steps.map((s, i): BassStep => {
    if (!free[i]) return s;
    if (on[i]) return candStep(cands[i]);
    // Une ligne a la main : un pas libre qui n'a pas sa note reste vide (le repli en liaison de SUB n'y est pas)
    return base === null ? fallbackStep(cands[i]) : { ...rest(), src: 'gen' };
  });
  return finish(out, cands, free, o);
}

/** MUTATE : quelques pas changent (un degre, un accent, un slide, une note qui apparait ou s'efface). */
export function mutate(steps: readonly BassStep[], o: GenOpts): BassStep[] {
  const rnd = o.rnd ?? Math.random;
  const out = steps.map((s) => ({ ...s }));
  const W = o.degrees === 5 ? W5 : W7;
  const count = 2 + Math.floor(rnd() * 3);
  for (let k = 0; k < count; k += 1) {
    const i = 1 + Math.floor(rnd() * (N - 1));
    const s = out[i];
    const r = rnd();
    if (s.kind === 'note') {
      if (r < 0.45) s.deg = pickV(W, rnd());
      else if (r < 0.65) s.acc = !s.acc;
      else if (r < 0.8) s.slide = !s.slide;
      else if (r < 0.9) s.oct = s.oct === 0 ? 1 : 0;
      else out[i] = rest();
    } else if (s.kind === 'off' && r < 0.6) out[i] = note(pickV(W, rnd()), rnd() < 0.25 ? 1 : 0, rnd() < o.accents * 0.5);
    // Un pas que MUTATE a change est desormais a toi (2026-10-09) : STYLE et DENSITY ne le reecrivent plus
    if (out[i] !== steps[i] && (out[i].kind !== steps[i].kind || out[i].deg !== steps[i].deg || out[i].acc !== steps[i].acc || out[i].slide !== steps[i].slide || out[i].oct !== steps[i].oct)) out[i] = { ...out[i], src: 'hand' };
  }
  return out;
}
