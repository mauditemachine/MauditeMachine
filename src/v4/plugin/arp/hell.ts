/**
 * HELL (2026-11-13, Mika, facon Echobode de Sonic Charge : un delay avec un decaleur de frequence de Bode dans sa boucle,
 * chaque repetition monte ou descend d'un cran : spirales, escalier sans fin). Le DSP : plugin/mm-arp/dsp/Hell.{h,cpp} ;
 * les reglages : extra-params.json, section hell (xHellMix ... xHellTone). Ici : ses lois cote face et sa banque de
 * presets (noms et valeurs a nous).
 *
 * Un preset regle tout HELL sauf MIX (la dose reste celle de Mika) ; si HELL est coupe (MIX a 0), il le met a 35 % pour
 * qu'on l'entende tout de suite.
 */

import spec from '../../../../plugin/mm-arp/extra-params.json';
import { arpExtra } from './extra';

const SYNC: readonly string[] = (spec.params.find((p) => p.id === 'xHellSync')?.steps ?? []) as readonly string[];

/** Les lois (Hell.cpp) en valeurs 0..1, pour ecrire les presets en unites. */
const ms = (t: number): number => Math.log(t / 5) / Math.log(400);
const shift = (hz: number): number => (Math.cbrt(hz / 5000) + 1) / 2;
const lfo = (hz: number): number => Math.log(hz / 0.02) / Math.log(500);
const depth = (hz: number): number => Math.sqrt(hz / 400);
const sync = (name: string): number => {
  const i = SYNC.indexOf(name);
  if (i < 0) throw new Error(`HELL : temps inconnu ${name}`);
  return i / (SYNC.length - 1);
};

export interface HellPreset {
  name: string;
  desc: string;
  v: Readonly<Record<string, number>>;
}

const P = (name: string, desc: string, o: { t: string | number; fb: number; sh: number; ud?: number; sp?: number; lr?: number; ld?: number; tone?: number }): HellPreset => ({
  name,
  desc,
  v: {
    xHellSync: typeof o.t === 'string' ? sync(o.t) : 0,
    xHellTime: typeof o.t === 'number' ? ms(o.t) : 0.5,
    xHellFb: o.fb,
    xHellShift: shift(o.sh),
    xHellUpDown: o.ud ?? 1,
    xHellSpread: o.sp ?? 0,
    xHellLfoRate: lfo(o.lr ?? 0.4),
    xHellLfoDepth: depth(o.ld ?? 0),
    xHellTone: o.tone ?? 0.5,
  },
});

export const HELL_PRESETS: readonly HellPreset[] = [
  P('SLOW ASCENT', 'Each repeat climbs a little: a slow rising spiral', { t: '1/4', fb: 0.72, sh: 35, sp: 0.2 }),
  P('BARBER DOWN', 'Endless falling staircase on sixteenths', { t: '1/16', fb: 0.88, sh: -18, ud: 0, tone: 0.42 }),
  P('TIN CAN', 'Short metallic box, both sidebands', { t: 18, fb: 0.82, sh: 7, ud: 0.5, sp: 0.5, tone: 0.62 }),
  P('HALO', 'Bright shimmer, a fifth-ish up each pass', { t: '1/8.', fb: 0.7, sh: 420, sp: 0.35, lr: 0.3, ld: 20, tone: 0.6 }),
  P('ABYSS', 'Falls deep and dark, repeat after repeat', { t: '1/4.', fb: 0.9, sh: -140, ud: 0, tone: 0.3 }),
  P('CROOKED PONG', 'Left climbs, right falls: a bent ping-pong', { t: '1/8', fb: 0.6, sh: 12, sp: 1 }),
  P('INFERNAL DUB', 'Dub echo that drifts out of tune', { t: '1/4.', fb: 0.85, sh: -6, tone: 0.35, lr: 0.25, ld: 30 }),
  P('SIREN', 'The shift swings with a slow LFO', { t: '1/8T', fb: 0.65, sh: 60, sp: 0.5, lr: 0.4, ld: 250 }),
  P('GHOST CHOIR', 'Barely shifted, both ways: a ghostly chorus', { t: 90, fb: 0.78, sh: 3, ud: 0.5, lr: 0.1, ld: 8, tone: 0.55 }),
  P('BROKEN RADIO', 'Far shift, thin and wide', { t: 45, fb: 0.7, sh: 900, ud: 0.5, sp: 0.7, tone: 0.7 }),
  P('DEEP STAIRS', 'Half notes stepping down', { t: '1/2', fb: 0.8, sh: -55, ud: 0 }),
  P('INIT', 'Plain delay, no shift', { t: '1/8.', fb: 0.5, sh: 0 }),
];

/** Le preset dont les reglages sont ceux du moment (a un millieme pres), sinon null. */
export function hellCurrent(): HellPreset | null {
  const v = arpExtra.get();
  return HELL_PRESETS.find((p) => Object.entries(p.v).every(([k, x]) => Math.abs((v[k] ?? 0) - Math.round(x * 1000) / 1000) < 0.0015)) ?? null;
}

export function hellLoad(p: HellPreset): void {
  for (const [k, x] of Object.entries(p.v)) arpExtra.set(k, x);
  if (arpExtra.of('xHellMix') <= 0) arpExtra.set('xHellMix', 0.35);
}
