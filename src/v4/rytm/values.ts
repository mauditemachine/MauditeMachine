/**
 * Les valeurs du MM-RYTM comme une machine Elektron (2026-10-08, Mika :
 * "les valeurs de knobs sont a l'ecran, pas sur les encodeurs, de 0 a
 * 127") : un nombre entier de 0 a 127 (de -64 a +63 pour un reglage a zero
 * au centre, TONE et STRETCH), le meme que celui du MIDI (la course x 127),
 * et une petite ligne d'unite dessous, ce que le nombre veut dire pour
 * l'oreille (216 MS, -3.2 DB, +2.1 ST, 58%). Les reglages a crans (SOUND,
 * GATE) gardent leur nom. Pur : rien que les lois des moteurs (voicefx,
 * tone, time, kit) ; actions.ts, l'ecran, le Dock et le MIDI le lisent.
 */

import { kit, type KitId } from '../audio/kit';
import { toneHpHz, toneLpHz } from '../audio/tone';
import { timeFactor } from '../audio/time';
import { decayTau, voiceGain } from '../audio/voicefx';
import { VEL_MAX } from '../audio/pattern';
import { swingRatio, type EncId } from '../theme';

/** Le nombre 0 a 127 d'une course 0 a 1 ; a zero au centre : -64 a +63 (le centre exact vaut 0). */
export function v127(course: number, bipolar = false): number {
  const c = Number.isFinite(course) ? Math.max(0, Math.min(1, course)) : 0;
  const n = Math.round(c * 127);
  return bipolar ? n - 64 : n;
}

/** Le meme, ecrit : 64, +12, -30, 0. */
export function v127Text(course: number, bipolar = false): string {
  const n = v127(course, bipolar);
  return bipolar && n > 0 ? `+${n}` : String(n);
}

/** La velocite d'un pas (0 a 9, l'echelle des pas) en 0 a 127. */
export const velTo127 = (vel: number): number => Math.round((Math.max(0, Math.min(VEL_MAX, vel)) / VEL_MAX) * 127);

/** Des decibels : -INF, -3.2 DB, +1.9 DB. */
function db(gain: number): string {
  if (!(gain > 1e-5)) return '-INF DB';
  const d = 20 * Math.log10(gain);
  const r = Math.round(d * 10) / 10;
  return `${r > 0 ? '+' : ''}${r === 0 ? '0.0' : r.toFixed(1)} DB`;
}

/** Une frequence : 120 HZ, 2.1 KHZ, 18 KHZ. */
function hz(f: number): string {
  if (f < 1000) return `${Math.round(f)} HZ`;
  const k = f / 1000;
  return `${k < 10 ? k.toFixed(1) : Math.round(k)} KHZ`;
}

/** Une duree : 83 MS, 1.2 S. */
function dur(s: number): string {
  return s < 1 ? `${Math.round(s * 1000)} MS` : `${(Math.round(s * 10) / 10).toFixed(1)} S`;
}

/**
 * La ligne d'unite d'un potard de la machine (sa valeur dans son domaine :
 * 0 a 1, -1 a 1 pour TONE et STRETCH) :
 * - VOLUME (vol) : le gain de la voix en dB, 0.0 DB au depart (80 %) ;
 * - MASTER : de meme (le gain suit le carre) ;
 * - DEC (vdecay) : la longueur de la queue a -60 dB, FULL au bout (la queue
 *   entiere, pas d'enveloppe) ;
 * - TONE : son filtre, passe-bas a gauche (LP 2.1 KHZ), passe-haut a droite
 *   (HP 120 HZ), FLAT au centre (la hauteur bascule avec, +/-7 demi-tons) ;
 * - STRETCH : le facteur des durees (x0.25 a x4) ;
 * - SWING : le rapport des doubles croches (50 % droit, 67 % triolet) ;
 * - les effets : la part envoyee, en pour cent.
 */
export function encUnit(id: Exclude<EncId, 'tempo' | 'vsound'>, v: number): string {
  switch (id) {
    case 'vol':
      return db(voiceGain(v));
    case 'level':
      return db(v * v);
    case 'vdecay': {
      const tau = decayTau(v);
      return tau === null ? 'FULL' : dur(tau * Math.log(1000));
    }
    case 'tone': {
      // Sur FLTR, le cote filtre (2026-10-08, revue de R1 : '0 ST' sur une page de filtre) : le passe-bas
      // vers la gauche, le passe-haut vers la droite (la hauteur suit, +/-7 demi-tons aux butees)
      if (v === 0) return 'FLAT';
      return v < 0 ? `LP ${hz(toneLpHz(v, 24000))}` : `HP ${hz(toneHpHz(v))}`;
    }
    case 'stretch':
      return `X${timeFactor(v).toFixed(2)}`;
    case 'swing':
      return `${swingRatio(v)}%`;
    default:
      return `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
  }
}

/** La ligne d'unite d'un TWEAK du kit (sous le capot, SRC) : 52 HZ, 216 MS, +2 ST ; un potard sans unite, sa part. */
export function kitUnit(id: KitId): string {
  const t = kit.valueText(id);
  return /\d/.test(t) && !/[A-Z%]/.test(t) ? `${t}%` : t;
}
