/**
 * TONE (revision 5) : de -1 a +1 (-100 a +100 a l'ecran), 0 au centre.
 * Deux effets doses ensemble sur le bus de batterie :
 *
 *   - la hauteur : +/-7 demi-tons au maximum, appliquee par drums.ts a la
 *     programmation de chaque coup (f x 2^(demi-tons / 12) sur les
 *     frequences des voix ; aucune lecture de tampon a vitesse modifiee) ;
 *   - le filtre : vers la droite un passe-haut de 20 a 180 Hz (le son ne
 *     devient pas boueux en montant), vers la gauche un passe-bas de 20 kHz
 *     a 900 Hz (il s'assombrit en descendant).
 *
 * A 0 : bypass reel (audio/insert.ts), les filtres sont hors du graphe et
 * le facteur de hauteur vaut exactement 1. En service, le filtre inutilise
 * d'un cote reste a sa borne neutre (passe-haut a 20 Hz, passe-bas a
 * 20 kHz), jamais a 0 Hz ni a Nyquist : a ces valeurs les navigateurs
 * basculent sur une fonction identite, et un etat de filtre ancien (pole
 * tout pres de 1) sautait d'un coup au passage (clic mesure au glisser).
 */

import { glide } from './fx';
import { Insert, type InsertInfo } from './insert';

export const TONE = {
  /** demi-tons a +/-1 */
  semitones: 7,
  hp: { from: 20, to: 180 },
  lp: { from: 20000, to: 900 },
  /** accrochage au centre : |v| sous ce seuil vaut 0 (4 sur 100) */
  snap: 0.04,
} as const;

export const clampTone = (v: number): number => (Number.isFinite(v) ? (v < -1 ? -1 : v > 1 ? 1 : v) : 0);

/** Valeur accrochee au centre : entre -4 et +4 (sur 100), elle colle a 0. */
export const snapTone = (v: number): number => {
  const c = clampTone(v);
  return Math.abs(c) < TONE.snap ? 0 : c;
};

/** Demi-tons de la hauteur : lineaire, +/-7 aux butees. */
export const toneSemitones = (v: number): number => TONE.semitones * clampTone(v);

/** Facteur des frequences : exactement 1 a 0. */
export const pitchFactor = (v: number): number => (v === 0 ? 1 : Math.pow(2, toneSemitones(v) / 12));

/** Coupure du passe-haut : 20 Hz a 180 Hz vers la droite, 20 Hz a gauche. */
export const toneHpHz = (v: number): number => (v > 0 ? TONE.hp.from * Math.pow(TONE.hp.to / TONE.hp.from, v) : TONE.hp.from);

/** Coupure du passe-bas : 20 kHz a 900 Hz vers la gauche, 20 kHz a droite (sous Nyquist). */
export const toneLpHz = (v: number, nyquist: number): number =>
  Math.min(v < 0 ? TONE.lp.from * Math.pow(TONE.lp.to / TONE.lp.from, -v) : TONE.lp.from, nyquist * 0.95);

export interface ToneInfo {
  value: number;
  semitones: number;
  hpHz: number;
  lpHz: number;
  insert: InsertInfo;
}

export interface ToneStage {
  /** entree du stage (le bus apres DIST) */
  input: AudioNode;
  set(v: number): void;
  reset(): void;
  info(): ToneInfo;
}

export function buildTone(c: BaseAudioContext, out: AudioNode, v0: number): ToneStage {
  const input = c.createGain();
  input.gain.value = 1;
  const nyq = c.sampleRate / 2;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.Q.value = Math.SQRT1_2;
  hp.frequency.value = toneHpHz(0);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = Math.SQRT1_2;
  lp.frequency.value = toneLpHz(0, nyq);
  hp.connect(lp);
  const insert = new Insert(c, input, out);
  insert.setBranch(hp, lp);
  let value = 0;

  const set = (v: number): void => {
    const t = clampTone(v);
    if (t === value) return;
    value = t;
    if (t === 0) {
      insert.release();
      return;
    }
    glide(hp.frequency, toneHpHz(t), c);
    glide(lp.frequency, toneLpHz(t, nyq), c);
    insert.engage(0, 1);
  };

  set(v0);

  return {
    input,
    set,
    reset: () => insert.reset(),
    info: () => ({
      value,
      semitones: toneSemitones(value),
      hpHz: Math.round(toneHpHz(value) * 10) / 10,
      lpHz: Math.round(toneLpHz(value, nyq)),
      insert: insert.info(),
    }),
  };
}
