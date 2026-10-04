/**
 * RANDOM du MM-ARP sur tout le patch (2026-10-03, Mika : "que Random puisse
 * changer tous les parametres de l'arp, des oscillators, filtre, adsr,
 * vraiment tout"). Chaque reglage est tire dans une plage qui sonne (un
 * hasard de musicien, pas un tirage aveugle) : arpege surtout en doubles et
 * en croches, filtre ni ferme ni grand ouvert (sa plage suit son MODE, le
 * MOOG deux fois sur trois),
 * attaques le plus souvent courtes, FM et bruit de temps en temps, une
 * modulation (MOD) une fois sur deux, effets doses comme avant. VOLUME ne
 * bouge pas : RANDOM ne doit jamais faire sauter le niveau.
 * TWEAKS (2026-10-04) : la phase libre, un peu d'analogique, les graves
 * souvent au centre ; les basses et l'acid recalent leur phase, derivent
 * peu et gardent leurs graves en mono (BASS MONO 105 a 170 Hz) : elles
 * frappent pareil a chaque note.
 */

import { NOTES, PHASE_FREE, RATIOS, type VoyKnobId } from './params';

type Rnd = () => number;

/** Un cran (index) tire selon ses poids, rendu en valeur 0..1 du potard. */
function weighted(rnd: Rnd, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < weights.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return i / (weights.length - 1);
  }
  return 1;
}

const between = (rnd: Rnd, lo: number, hi: number): number => Math.round((lo + rnd() * (hi - lo)) * 1000) / 1000;
/** Souvent a 0 (off), sinon entre lo et hi. */
const sometimes = (rnd: Rnd, off: number, lo: number, hi: number): number => (rnd() < off ? 0 : between(rnd, lo, hi));
/** Le plus souvent court : le carre d'un tirage, mis a l'echelle. */
const mostlyShort = (rnd: Rnd, hi: number): number => Math.round(rnd() * rnd() * hi * 1000) / 1000;
/** Un morphing : une forme pure une fois sur deux, sinon entre deux formes. */
const morph = (rnd: Rnd, shapes: number): number => (rnd() < 0.5 ? Math.floor(rnd() * shapes) / (shapes - 1) : between(rnd, 0, 1));

/**
 * Les rangees d'oscillateurs (2026-10-04, facon Mini V) : OSC 1 en 8' (la
 * note), OSC 2 par crans musicaux comme l'ancien TUNE 2 : 0 octave dessous,
 * 1 unisson, 2 quinte, 3 octave, 4 deux octaves (RANGE et SEMI) ; les deux
 * allumes.
 */
function oscTune(i: number): Partial<Record<VoyKnobId, number>> {
  const k = Math.max(0, Math.min(4, Math.round(i)));
  return { range1: 3 / 5, semi1: 0.5, on1: 1, range2: [2, 3, 3, 4, 5][k] / 5, semi2: (k === 2 ? 14 : 7) / 14, on2: 1 };
}

/** Le desaccord des deux oscillateurs, de part et d'autre de la note (lo..hi : l'ancien FINE, 0 a 45 cents d'ecart). */
function detune(rnd: Rnd, lo: number, hi: number): Partial<Record<VoyKnobId, number>> {
  const half = (between(rnd, lo, hi) * 45) / 2;
  return { fine1: Math.round((0.5 - half / 100) * 1000) / 1000, fine2: Math.round((0.5 + half / 100) * 1000) / 1000 };
}

export function randomVoyPatch(rnd: Rnd = Math.random): Partial<Record<VoyKnobId, number>> {
  const fm = sometimes(rnd, 0.55, 0.1, 0.7);
  const notes = rnd() < 0.5 ? 0 : (3 + Math.floor(rnd() * 6)) / (NOTES.length - 1);
  // MODE du filtre : le MOOG deux fois sur trois (Mika l'aime) ; BP et HP veulent leur propre plage de coupure (sinon tout disparait)
  const fmode = weighted(rnd, [0.66, 0.12, 0.11, 0.11]);
  const fIdx = Math.round(fmode * 3);
  const cutoff = fIdx === 3 ? between(rnd, 0.15, 0.45) : fIdx === 2 ? between(rnd, 0.35, 0.7) : between(rnd, 0.25, 0.75);
  // Melangeur : OSC 1 toujours la ; OSC 2 seul en renfort, parfois absent (OSC 1 seul, ou la FM d'OSC 2 sans l'entendre)
  const osc1 = between(rnd, 0.6, 0.95);
  const osc2 = rnd() < 0.15 ? 0 : between(rnd, 0.35, 0.95);
  // MOD : une fois sur deux ; une vitesse, une forme, une cible
  const lfoAmt = sometimes(rnd, 0.5, 0.15, 0.7);
  return {
    // Arpegiateur : 1/4 1/8 1/16 1/32, UP DOWN UP/DN RAND, 1 a 3 octaves
    rate: weighted(rnd, [0.08, 0.25, 0.55, 0.12]),
    mode: weighted(rnd, [0.35, 0.2, 0.3, 0.15]),
    range: weighted(rnd, [0.35, 0.45, 0.2]),
    notes,
    gate: between(rnd, 0.25, 0.9),
    // OCTAVE : -1, 0 ou +1 (les crans -2 et +2 restent a la main)
    octave: (1 + weighted(rnd, [0.25, 0.5, 0.25]) * 2) / 4,
    glide: sometimes(rnd, 0.7, 0.05, 0.35),
    // Oscillateurs
    wave1: morph(rnd, 6),
    wave2: morph(rnd, 5),
    ...oscTune(weighted(rnd, [0.3, 0.25, 0.15, 0.25, 0.05]) * 4),
    osc1,
    osc2,
    fm,
    ratio: fm > 0 ? weighted(rnd, [0.06, 0.24, 0.1, 0.22, 0.16, 0.06, 0.08, 0.04, 0.04]) : 1 / (RATIOS.length - 1),
    ...detune(rnd, 0.1, 0.6),
    // Filtre
    cutoff,
    res: between(rnd, 0.05, 0.75),
    envAmt: between(rnd, 0.2, 0.85),
    noise: sometimes(rnd, 0.8, 0.05, 0.3),
    fmode,
    // Enveloppes : attaques surtout courtes
    fA: mostlyShort(rnd, 0.3),
    fD: between(rnd, 0.15, 0.6),
    fS: between(rnd, 0, 0.6),
    fR: between(rnd, 0.15, 0.6),
    aA: mostlyShort(rnd, 0.2),
    aD: between(rnd, 0.2, 0.7),
    aS: between(rnd, 0.3, 0.9),
    aR: between(rnd, 0.15, 0.55),
    // MOD : 1/16 1/8 1/4 1/2 1 BAR 2 BAR 4 BAR ; TRI SAW SQR S&H ; WAVE CUTOFF FM PITCH W+CUT
    lfoRate: weighted(rnd, [0.12, 0.18, 0.2, 0.18, 0.16, 0.1, 0.06]),
    lfoShape: weighted(rnd, [0.35, 0.2, 0.2, 0.25]),
    lfoDest: weighted(rnd, [0.3, 0.3, 0.12, 0.08, 0.2]),
    lfoAmt,
    // Effets (doses d'avant)
    dist: sometimes(rnd, 0.5, 0.08, 0.4),
    chorus: between(rnd, 0.25, 0.85),
    delay: sometimes(rnd, 0.35, 0.15, 0.55),
    reverb: between(rnd, 0.1, 0.5),
    // TWEAKS : phase libre, analogique modere, BASS MONO 80 a 120 Hz six fois sur dix
    phase: 0,
    drift: between(rnd, 0.3, 0.6),
    width: between(rnd, 0.35, 0.75),
    monoLow: sometimes(rnd, 0.4, 0.37, 0.56),
    keyTrack: between(rnd, 0.4, 0.65),
    accent: between(rnd, 0.4, 0.65),
    sync: 0,
  };
}

/* ---------------- les styles de RANDOM (2026-10-04) ---------------- */

/**
 * RANDOM par styles (2026-10-04, Mika : "MM-ARP un peu redondant comme
 * sonorite, il faut quelque chose qui fonctionne plus electro indie dance,
 * peut-etre que les random tapent toujours vers la meme chose ; je voudrais
 * faire aussi des basslines cool"). Chaque reglage tire au hasard dans sa
 * plage donnait des patchs moyens, qui se ressemblaient. RANDOM tire d'abord
 * un style (jamais le meme deux fois de suite), puis un patch qui lui
 * ressemble :
 * - BASSLINE : une a deux octaves sous l'arpege, MOOG ferme, enveloppes
 *   courtes, sous-oscillateur, et une vraie ligne de basse ecrite dans la
 *   suite (EDIT) : roulante (l'octave sur le "a", comme les basses de Mika),
 *   contretemps, galop, rebond, marche, octaves ; un ou deux accords ;
 * - ACID : scie, resonance haute, enveloppe de filtre forte, glissando, une
 *   ligne tiree au hasard (octaves, notes de passage, silences), OVERDRIVE ;
 * - PLUCK : court et brillant, chorus, delay, reverbe ;
 * - LEAD : FM, deux octaves, glissando, vibrato discret, delay ;
 * - DARK : carre, passe-bande, S&H sur la coupure, peu de notes ;
 * - ARP : l'arpege libre d'avant (randomVoyPatch).
 */
export type VoyStyle = 'BASSLINE' | 'ACID' | 'PLUCK' | 'LEAD' | 'DARK' | 'ARP';

const STYLES: readonly { style: VoyStyle; weight: number }[] = [
  { style: 'BASSLINE', weight: 0.26 },
  { style: 'ACID', weight: 0.17 },
  { style: 'PLUCK', weight: 0.17 },
  { style: 'LEAD', weight: 0.12 },
  { style: 'DARK', weight: 0.13 },
  { style: 'ARP', weight: 0.15 },
];

/** Le cran i d'un potard a n crans, en valeur 0..1. */
const at = (i: number, n: number): number => i / (n - 1);
const pickOf = <T>(rnd: Rnd, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rnd() * xs.length))];
const chance = (rnd: Rnd, p: number): boolean => rnd() < p;

type Step = number | null;
const o: Step = null;
/**
 * Les basslines : seize doubles croches, en degres de la gamme au-dessus de
 * la racine de l'accord (7 : l'octave, 4 : la quinte, 2 : la tierce ; null :
 * un silence). L'accent de l'arpegiateur tombe sur le "a" de chaque temps.
 */
const BASSLINES: readonly (readonly Step[])[] = [
  [0, 0, 0, 7, 0, 0, 0, 7, 0, 0, 0, 7, 0, 0, 4, 7],
  [o, o, 0, o, o, o, 0, o, o, o, 0, o, o, o, 0, 7],
  [o, 0, 0, o, o, 0, 0, o, o, 0, 0, o, o, 0, 7, o],
  [0, o, 0, 0, o, 0, 0, o, 0, o, 0, 0, o, 0, 4, o],
  [0, 0, 7, 0, 0, 0, 5, 0, 0, 0, 7, 0, 0, 4, 2, 0],
  [0, 7, 0, 7, 0, 7, 0, 7, 0, 7, 0, 7, 0, 7, 4, 7],
];

/** Une ligne acid : la racine souvent sur le temps, des octaves, des notes de passage, des silences. */
function acidLine(rnd: Rnd): Step[] {
  const pool: readonly Step[] = [0, 0, 0, 7, 7, 1, 2, 3, 4, 5, 9, o, o];
  return Array.from({ length: 16 }, (_, i) => (i % 4 === 0 && chance(rnd, 0.6) ? 0 : pickOf(rnd, pool)));
}

/** Progressions courtes pour les basses et l'acid (indices de CHORDS). */
const SHORT_PROGS: readonly (readonly number[])[] = [[0], [0, 0, 1, 2], [0, 1], [0, 2], [0, 5, 1, 2], [4, 0], [0, 0, 5, 2]];

export interface VoyRandom {
  style: VoyStyle;
  patch: Partial<Record<VoyKnobId, number>>;
  /** une suite EDIT (seize pas au plus) ; null : la suite AUTO */
  seq: Step[] | null;
  /** une progression imposee ; null : au choix de RANDOM (les progressions de chords.ts) */
  prog: readonly number[] | null;
}

function styled(style: VoyStyle, rnd: Rnd): VoyRandom {
  // La base : un patch complet (aucun reglage ne reste du precedent), puis le caractere du style
  const base = randomVoyPatch(rnd);
  const mod = (dest: number, rate: number, shape: number, lo: number, hi: number): Partial<Record<VoyKnobId, number>> => ({
    lfoDest: at(dest, 5),
    lfoRate: at(rate, 7),
    lfoShape: at(shape, 4),
    lfoAmt: between(rnd, lo, hi),
  });
  if (style === 'BASSLINE') {
    const low = chance(rnd, 0.5);
    return {
      style,
      patch: {
        ...base,
        rate: at(2, 4),
        mode: at(0, 4),
        range: 0,
        notes: 0,
        gate: between(rnd, 0.3, 0.6),
        octave: low ? at(0, 5) : at(1, 5),
        glide: sometimes(rnd, 0.6, 0.05, 0.2),
        wave1: pickOf(rnd, [at(2, 6), at(3, 6), at(4, 6), between(rnd, 0.4, 0.6)]),
        wave2: pickOf(rnd, [at(2, 5), at(3, 5)]),
        // Le sous-oscillateur une octave dessous, sauf deja tout en bas
        ...oscTune(!low && chance(rnd, 0.5) ? 0 : 1),
        osc1: between(rnd, 0.75, 0.95),
        osc2: between(rnd, 0.45, 0.8),
        fm: sometimes(rnd, 0.8, 0.05, 0.2),
        ...detune(rnd, 0.1, 0.35),
        cutoff: between(rnd, 0.28, 0.48),
        res: between(rnd, 0.15, 0.55),
        envAmt: between(rnd, 0.35, 0.7),
        noise: 0,
        fmode: chance(rnd, 0.85) ? 0 : at(1, 4),
        fA: 0,
        fD: between(rnd, 0.12, 0.32),
        fS: between(rnd, 0, 0.2),
        fR: between(rnd, 0.1, 0.25),
        aA: 0,
        aD: between(rnd, 0.25, 0.45),
        aS: between(rnd, 0.45, 0.8),
        aR: between(rnd, 0.08, 0.2),
        ...(chance(rnd, 0.4) ? mod(1, chance(rnd, 0.5) ? 5 : 6, 0, 0.1, 0.3) : { lfoAmt: 0 }),
        dist: sometimes(rnd, 0.5, 0.08, 0.3),
        chorus: between(rnd, 0, 0.15),
        delay: sometimes(rnd, 0.85, 0.1, 0.2),
        reverb: between(rnd, 0, 0.1),
        // TWEAKS : la phase recalee a 0 deg, peu de derive, serre, les graves en mono (135 a 170 Hz)
        phase: PHASE_FREE,
        drift: between(rnd, 0.1, 0.3),
        width: between(rnd, 0.1, 0.3),
        monoLow: between(rnd, 0.6, 0.72),
        keyTrack: between(rnd, 0.5, 0.7),
        accent: between(rnd, 0.5, 0.85),
        sync: 0,
      },
      seq: [...pickOf(rnd, BASSLINES)],
      prog: pickOf(rnd, SHORT_PROGS),
    };
  }
  if (style === 'ACID') {
    return {
      style,
      patch: {
        ...base,
        rate: at(2, 4),
        mode: at(0, 4),
        range: 0,
        notes: 0,
        gate: between(rnd, 0.4, 0.75),
        octave: chance(rnd, 0.6) ? at(1, 5) : at(2, 5),
        glide: sometimes(rnd, 0.3, 0.12, 0.3),
        wave1: chance(rnd, 0.7) ? at(2, 6) : at(3, 6),
        wave2: at(2, 5),
        ...oscTune(1),
        osc1: between(rnd, 0.85, 0.95),
        osc2: between(rnd, 0, 0.4),
        fm: 0,
        cutoff: between(rnd, 0.22, 0.42),
        res: between(rnd, 0.6, 0.85),
        envAmt: between(rnd, 0.6, 0.9),
        noise: 0,
        fmode: chance(rnd, 0.7) ? 0 : at(1, 4),
        fA: 0,
        fD: between(rnd, 0.15, 0.4),
        fS: between(rnd, 0, 0.15),
        fR: between(rnd, 0.1, 0.3),
        aA: 0,
        aD: between(rnd, 0.3, 0.5),
        aS: between(rnd, 0.5, 0.8),
        aR: between(rnd, 0.1, 0.2),
        ...(chance(rnd, 0.6) ? mod(1, chance(rnd, 0.5) ? 3 : 4, 0, 0.15, 0.4) : { lfoAmt: 0 }),
        dist: between(rnd, 0.2, 0.5),
        chorus: between(rnd, 0, 0.2),
        delay: sometimes(rnd, 0.5, 0.15, 0.35),
        reverb: between(rnd, 0.05, 0.2),
        // TWEAKS : phase recalee, accents marques, la coupure suit la note (105 a 150 Hz en mono)
        phase: PHASE_FREE,
        drift: between(rnd, 0.15, 0.35),
        width: between(rnd, 0.2, 0.4),
        monoLow: between(rnd, 0.5, 0.65),
        keyTrack: between(rnd, 0.6, 0.85),
        accent: between(rnd, 0.7, 1),
        sync: 0,
      },
      seq: acidLine(rnd),
      prog: pickOf(rnd, SHORT_PROGS),
    };
  }
  if (style === 'PLUCK') {
    return {
      style,
      patch: {
        ...base,
        rate: chance(rnd, 0.7) ? at(2, 4) : at(1, 4),
        mode: pickOf(rnd, [at(0, 4), at(2, 4), at(3, 4)]),
        range: chance(rnd, 0.5) ? at(0, 3) : at(1, 3),
        notes: chance(rnd, 0.5) ? 0 : at(3 + Math.floor(rnd() * 3), 9),
        gate: between(rnd, 0.25, 0.6),
        octave: chance(rnd, 0.6) ? at(2, 5) : at(3, 5),
        glide: 0,
        wave1: pickOf(rnd, [at(2, 6), at(4, 6), at(1, 6), 1]),
        wave2: pickOf(rnd, [at(3, 5), at(2, 5)]),
        ...oscTune(pickOf(rnd, [1, 2, 3])),
        fm: sometimes(rnd, 0.6, 0.1, 0.4),
        cutoff: between(rnd, 0.45, 0.7),
        res: between(rnd, 0.2, 0.5),
        envAmt: between(rnd, 0.4, 0.75),
        fmode: chance(rnd, 0.6) ? 0 : at(1, 4),
        fA: 0,
        fD: between(rnd, 0.08, 0.22),
        fS: between(rnd, 0, 0.1),
        fR: between(rnd, 0.15, 0.35),
        aA: 0,
        // Le pluck garde son attaque par le filtre ; l'ampli tient un peu (sinon 8 dB sous les autres styles)
        aD: between(rnd, 0.25, 0.4),
        aS: between(rnd, 0.25, 0.5),
        aR: between(rnd, 0.2, 0.4),
        osc1: between(rnd, 0.85, 0.95),
        osc2: between(rnd, 0.6, 0.9),
        ...(chance(rnd, 0.5) ? mod(0, 4, 0, 0.15, 0.45) : { lfoAmt: 0 }),
        dist: between(rnd, 0, 0.1),
        chorus: between(rnd, 0.35, 0.75),
        delay: between(rnd, 0.25, 0.5),
        reverb: between(rnd, 0.2, 0.45),
        // TWEAKS : large et vivant
        drift: between(rnd, 0.4, 0.7),
        width: between(rnd, 0.6, 0.9),
        accent: between(rnd, 0.4, 0.7),
      },
      seq: null,
      prog: null,
    };
  }
  if (style === 'LEAD') {
    return {
      style,
      patch: {
        ...base,
        rate: chance(rnd, 0.6) ? at(1, 4) : at(2, 4),
        mode: chance(rnd, 0.5) ? at(2, 4) : at(0, 4),
        range: at(1, 3),
        notes: chance(rnd, 0.5) ? 0 : at(3 + Math.floor(rnd() * 3), 9),
        gate: between(rnd, 0.55, 0.9),
        octave: chance(rnd, 0.5) ? at(2, 5) : at(3, 5),
        glide: between(rnd, 0.12, 0.35),
        wave1: 1,
        // La FM est forte : les oscillateurs un peu en retrait (le niveau ne saute pas d'un style a l'autre)
        osc1: between(rnd, 0.6, 0.78),
        osc2: between(rnd, 0.3, 0.6),
        fm: between(rnd, 0.3, 0.7),
        ratio: at(pickOf(rnd, [1, 3, 4, 6]), 9),
        wave2: pickOf(rnd, [at(2, 5), at(3, 5)]),
        ...oscTune(pickOf(rnd, [2, 3])),
        cutoff: between(rnd, 0.5, 0.8),
        res: between(rnd, 0.2, 0.45),
        envAmt: between(rnd, 0.3, 0.6),
        fmode: 0,
        fA: 0,
        fD: between(rnd, 0.25, 0.5),
        fS: between(rnd, 0.3, 0.6),
        aA: between(rnd, 0, 0.1),
        aD: between(rnd, 0.3, 0.5),
        aS: between(rnd, 0.6, 0.9),
        aR: between(rnd, 0.25, 0.45),
        ...(chance(rnd, 0.5) ? mod(3, chance(rnd, 0.5) ? 0 : 1, 0, 0.1, 0.25) : { lfoAmt: 0 }),
        dist: between(rnd, 0, 0.15),
        chorus: between(rnd, 0.2, 0.5),
        delay: between(rnd, 0.3, 0.55),
        reverb: between(rnd, 0.25, 0.45),
        // TWEAKS : SYNC une fois sur trois (OSC 2 a la quinte ou a l'octave : il crie)
        drift: between(rnd, 0.4, 0.8),
        width: between(rnd, 0.4, 0.7),
        sync: chance(rnd, 0.35) ? 1 : 0,
      },
      seq: null,
      prog: null,
    };
  }
  if (style === 'DARK') {
    const bp = chance(rnd, 0.6);
    return {
      style,
      patch: {
        ...base,
        rate: at(2, 4),
        mode: chance(rnd, 0.6) ? at(0, 4) : at(3, 4),
        range: 0,
        notes: at(chance(rnd, 0.5) ? 3 : 4, 9),
        gate: between(rnd, 0.3, 0.6),
        octave: chance(rnd, 0.6) ? at(1, 5) : at(2, 5),
        glide: sometimes(rnd, 0.7, 0.05, 0.15),
        wave1: pickOf(rnd, [at(3, 6), at(4, 6)]),
        wave2: pickOf(rnd, [at(3, 5), at(4, 5)]),
        ...oscTune(chance(rnd, 0.5) ? 1 : 0),
        fmode: bp ? at(2, 4) : at(1, 4),
        cutoff: bp ? between(rnd, 0.35, 0.6) : between(rnd, 0.3, 0.5),
        res: between(rnd, 0.4, 0.7),
        envAmt: between(rnd, 0.3, 0.6),
        fA: 0,
        fD: between(rnd, 0.15, 0.35),
        fS: between(rnd, 0.1, 0.3),
        aA: 0,
        aD: between(rnd, 0.25, 0.4),
        aS: between(rnd, 0.4, 0.7),
        ...mod(1, chance(rnd, 0.5) ? 0 : 1, 3, 0.25, 0.5),
        dist: between(rnd, 0.1, 0.35),
        chorus: between(rnd, 0, 0.2),
        delay: between(rnd, 0.25, 0.45),
        reverb: between(rnd, 0.15, 0.3),
        // TWEAKS : plus analogique, parfois synchronise
        drift: between(rnd, 0.5, 0.9),
        width: between(rnd, 0.5, 0.8),
        sync: chance(rnd, 0.25) ? 1 : 0,
      },
      seq: null,
      prog: pickOf(rnd, SHORT_PROGS),
    };
  }
  return { style: 'ARP', patch: base, seq: null, prog: null };
}

/** RANDOM : un style au hasard (jamais le meme deux fois de suite), et son patch. */
export function randomVoyStyle(last: VoyStyle | null = null, rnd: Rnd = Math.random): VoyRandom {
  const pool = STYLES.filter((s) => s.style !== last);
  const total = pool.reduce((a, s) => a + s.weight, 0);
  let x = rnd() * total;
  let style = pool[pool.length - 1].style;
  for (const s of pool) {
    x -= s.weight;
    if (x <= 0) {
      style = s.style;
      break;
    }
  }
  return styled(style, rnd);
}
