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

import { KIT_MODELS, KIT_MODEL_LABEL, LAYER_FINE_CENTS, kit, layerSt, type KitId, type KitKnob, type Layer, type LayerParam } from '../audio/kit';
import { SAMPLE_START_MAX, sampleLenPart } from '../audio/sampledsp';
import { samplePcm } from '../audio/samples';
import { toneHpHz, toneLpHz } from '../audio/tone';
import { timeFactor } from '../audio/time';
import { FENV_OCT, START_MAX, atkS, cutHz, decayTau, fatkS, fdecTau, fineCents, filterType, holdS, resoQ, tuneSt, voiceGain } from '../audio/voicefx';
import { VEL_GAIN, VEL_MAX, VEL_NAMES, delayDiv, delayFb, fxLaw } from '../audio/pattern';
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

/**
 * TUNE de la voix (2026-10-08) : un reglage a crans, ecrit en demi-tons
 * (+5, -12, 0) comme le TUNE d'une Digitakt ; sa ligne d'unite dit
 * l'intervalle (4TH, OCTAVE, OCT + 5TH).
 */
export function tuneText(v: number): string {
  const st = tuneSt(v);
  return st > 0 ? `+${st}` : String(st);
}
const INTERVALS = ['ROOT', 'MIN 2ND', '2ND', 'MIN 3RD', '3RD', '4TH', 'TRITONE', '5TH', 'MIN 6TH', '6TH', 'MIN 7TH', '7TH', 'OCTAVE'] as const;
export function tuneUnit(v: number): string {
  const a = Math.abs(tuneSt(v));
  if (a <= 12) return INTERVALS[a];
  if (a === 24) return '2 OCTAVES';
  return `OCT + ${INTERVALS[a - 12]}`;
}

/**
 * Le nombre d'un potard de la machine (sa valeur dans son domaine) : 0 a 127,
 * -64 a +63, PITCH en demi-tons ; depuis le 2026-10-09 FINE en cents (+12), le
 * TYPE du filtre par son nom (LP, HP, BP), DLY TIME par sa division (1/8D).
 */
export function encText(id: Exclude<EncId, 'tempo' | 'vsound'>, v: number, course: number, bipolar: boolean): string {
  if (id === 'vtune') return tuneText(v);
  if (id === 'vfine') {
    const c = fineCents(v);
    return c > 0 ? `+${c}` : String(c);
  }
  if (id === 'vftype') return filterType(v);
  if (id === 'dtime') return delayDiv(v).label;
  return v127Text(course, bipolar);
}

/**
 * Le mot d'une velocite de pas (revue de R2 : 'VEL 7' sous 99 melangeait les
 * deux echelles) : HIGH, MID, LOW pour les trois d'un appui, sinon son gain
 * en dB (-2.9 DB) ; OFF a 0.
 */
export function velWord(vel: number): string {
  const v = Math.max(0, Math.min(VEL_MAX, Math.round(vel)));
  const n = VEL_NAMES[v] ?? 'OFF';
  return n.startsWith('VEL') ? db(VEL_GAIN[v] ?? 0) : n;
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

/** Une duree courte, toujours en ms (2026-10-10, l'attaque et le retour du COMP) : 0.1 MS, 3.0 MS, 120 MS. */
function ms(s: number): string {
  const m = s * 1000;
  return `${m < 10 ? m.toFixed(1) : Math.round(m)} MS`;
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
 * - les effets : la part envoyee, en pour cent ;
 * - les reglages des FX globaux (2026-10-10, leurs pages) : les TONE en Hz
 *   (4.5 KHZ ; celui de DIST, OPEN tout en haut), SIZE en secondes, PRE et
 *   DEPTH en ms, RATE du CHORUS en facteur (X1.0), RATE de BIT en diviseur
 *   (OFF, /2 ... /16), ATTACK et RELEASE du COMP en ms.
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
    case 'vtune':
      return tuneUnit(v);
    case 'vpan': {
      // PAN (2026-10-08) : le cote et combien, CENTER au milieu
      const n = Math.round(Math.abs(v) * 100);
      return n === 0 ? 'CENTER' : `${n}% ${v < 0 ? 'LEFT' : 'RIGHT'}`;
    }
    case 'vstart': {
      // START (2026-10-08) : ou le coup commence dans son echantillon (90 % au plus)
      const n = Math.round(Math.max(0, Math.min(1, v)) * START_MAX * 100);
      return n === 0 ? 'FROM TOP' : `${n}% IN`;
    }
    // L'etape 2 (2026-10-09) : l'enveloppe du coup, FINE, le filtre, le DELAY
    case 'vatk':
      return v <= 0 ? 'SNAP' : dur(atkS(v));
    case 'vhold':
      return dur(holdS(v));
    case 'vfine':
      return 'CENTS';
    case 'vftype':
      return filterType(v) === 'LP' ? 'LOW PASS' : filterType(v) === 'HP' ? 'HIGH PASS' : 'BAND PASS';
    case 'vfcut':
      return hz(cutHz(v));
    case 'vfreso':
      return `Q ${resoQ(v).toFixed(1)}`;
    case 'vfenv': {
      const o = Math.round(v * FENV_OCT * 10) / 10;
      return o === 0 ? 'NO ENV' : `${o > 0 ? '+' : ''}${o.toFixed(1)} OCT`;
    }
    case 'vfatk':
      return v <= 0 ? 'SNAP' : dur(fatkS(v));
    case 'vfdec':
      return dur(fdecTau(v) * 3);
    case 'dtime':
      return 'NOTE';
    case 'dfb':
      return `${Math.round(delayFb(v) * 100)}% FB`;
    // BIT : la profondeur (16 a 4 bits), OFF a 0 ; COMP : le rapport (1:1 a 8:1), OFF a 0
    case 'bits':
      return v <= 0 ? 'OFF' : `${Math.round(16 - 12 * Math.min(1, v))} BIT`;
    case 'comp':
      return v <= 0 ? 'OFF' : `${(1 + 7 * Math.min(1, v)).toFixed(1)}:1`;
    // Les reglages des FX globaux (2026-10-10, leurs pages ; les lois de audio/pattern.ts fxLaw, celles du son)
    case 'dtone':
    case 'rtone':
      return hz(fxLaw[id](v));
    case 'xtone':
      // 16 kHz tout en haut : le passe-bas ne s'entend plus, la saturation reste entiere
      return v >= 1 ? 'OPEN' : hz(fxLaw.xtone(v));
    case 'rsize':
      return `${fxLaw.rsize(v).toFixed(1)} S`;
    case 'rpre':
      return `${Math.round(fxLaw.rpre(v) * 1000)} MS`;
    case 'crate': {
      const f = fxLaw.crate(v);
      return `X${f < 1 ? f.toFixed(2) : f.toFixed(1)}`;
    }
    case 'cdepth':
      return `${(fxLaw.cdepth(v) * 1000).toFixed(1)} MS`;
    case 'brate': {
      // L'echantillonnage divise : /1 n'y touche pas (OFF)
      const n = fxLaw.brate(v);
      return n <= 1 ? 'OFF' : `/${n}`;
    }
    case 'catk':
    case 'crel':
      return ms(fxLaw[id](v));
    default:
      return `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
  }
}

/** La ligne d'unite d'un TWEAK du kit (sous le capot, SRC) : 52 HZ, 216 MS, +2 ST ; un potard sans unite, sa part. */
export function kitUnit(id: KitId): string {
  return unitOf(kit.valueText(id));
}
const unitOf = (t: string): string => (/\d/.test(t) && !/[A-Z%]/.test(t) ? `${t}%` : t);

/** La meme ligne pour un potard du kit a la valeur v (un verrou de pas, revue de R2). */
export function kitUnitAt(id: KitKnob, v: number): string {
  return unitOf(kit.knobText(id, v));
}

/* ---------------- les couches SYNTH et SAMPLE (2026-10-08, l'etape R3) ---------------- */

/** Un reglage de couche du MM-RYTM (audio/kit.ts), ou la MACHINE de la couche SYNTH. */
export type LayerDial = LayerParam | 'mach';

/**
 * Le nombre d'un reglage de couche : la MACHINE par son nom (909, MM), TUNE
 * en demi-tons (+5), FINE en cents (+12), REV OFF ou ON, les autres de 0 a 127.
 */
export function layerText(p: LayerDial, v: number): string {
  if (p === 'mach') return KIT_MODEL_LABEL[KIT_MODELS[Math.max(0, Math.min(2, Math.round(v)))]];
  if (p === 'tune') return tuneText(v);
  if (p === 'fine') {
    const c = Math.round(v * LAYER_FINE_CENTS);
    return c > 0 ? `+${c}` : String(c);
  }
  if (p === 'rev') return v >= 0.5 ? 'ON' : 'OFF';
  return v127Text(v);
}

/**
 * Sa ligne d'unite : un niveau en dB (OFF a 0), l'intervalle de TUNE, CENTS,
 * ou commence START, la longueur gardee par LEN (en ms quand l'echantillon
 * est la, sinon en part), le sens de REV.
 */
export function layerUnit(p: LayerDial, v: number, sample?: { key: string; layer: Readonly<Layer> }): string {
  switch (p) {
    case 'mach':
      return 'SYNTH';
    case 'syn':
    case 'lev':
      return v <= 0 ? 'OFF' : db(v * v);
    case 'tune':
      return tuneUnit(v);
    case 'fine':
      return 'CENTS';
    case 'start': {
      const n = Math.round(Math.max(0, Math.min(1, v)) * SAMPLE_START_MAX * 100);
      return n === 0 ? 'FROM TOP' : `${n}% IN`;
    }
    case 'len': {
      const part = sampleLenPart(v);
      const pcm = sample ? samplePcm(sample.key) : undefined;
      if (pcm && sample) {
        // Ce qui sonne vraiment : le fichier apres START, a la hauteur de TUNE et FINE, LEN de sa part
        const l = sample.layer;
        const st = layerSt(l);
        const left = pcm.L.length * (1 - Math.max(0, Math.min(1, l.start)) * SAMPLE_START_MAX);
        return dur(((left / pcm.sr) * part) / Math.pow(2, st / 12));
      }
      return part >= 1 ? 'FULL' : `${Math.round(part * 100)}%`;
    }
    default:
      return v >= 0.5 ? 'BACKWARD' : 'FORWARD';
  }
}
