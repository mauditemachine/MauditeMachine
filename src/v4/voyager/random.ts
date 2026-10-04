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
 */

import { NOTES, RATIOS, type VoyKnobId } from './params';

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
    tune2: weighted(rnd, [0.3, 0.25, 0.15, 0.25, 0.05]),
    osc1,
    osc2,
    fm,
    ratio: fm > 0 ? weighted(rnd, [0.06, 0.24, 0.1, 0.22, 0.16, 0.06, 0.08, 0.04, 0.04]) : 1 / (RATIOS.length - 1),
    fine: between(rnd, 0.1, 0.6),
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
  };
}
