/**
 * HELL et la DIST facon Decapitator dans OPEN, onglet FX (2026-11-13, le plugin). Mika : "je veux une 2e page dans OPEN pour
 * afficher des parametres de FX type Echobode, pour avoir des choses vraiment pointues" ; "tu peux appeler cet effet Hell" ;
 * "pour la disto, des sous-parametres a la Decapitator".
 *
 * Ici : ce que l'ecran dit de chaque reglage (les memes lois que le moteur, dsp/Fx.cpp FxLaws hell*, distLowHz, DistX), les
 * crans des choix, la courbe de la DIST (pour son dessin) et les presets des deux sous-pages. Les reglages eux-memes sont des
 * effets du pattern (audio/pattern.ts LAB_FX : 0 a 1). Pur : aucun store.
 */

import { LAB_FX, fxLaw, type Fx, type LabFxId } from '../audio/pattern';

/* ---------------- HELL ---------------- */

/** TIME en SYNC : 1/128 a 1/2 mesure (en doubles croches) ; leurs noms. */
export const HELL_DIVS: readonly { steps: number; label: string }[] = [
  { steps: 0.125, label: '1/128' },
  { steps: 0.25, label: '1/64' },
  { steps: 0.5, label: '1/32' },
  { steps: 1, label: '1/16' },
  { steps: 4 / 3, label: '1/8T' },
  { steps: 1.5, label: '1/16D' },
  { steps: 2, label: '1/8' },
  { steps: 8 / 3, label: '1/4T' },
  { steps: 3, label: '1/8D' },
  { steps: 4, label: '1/4' },
  { steps: 6, label: '1/4D' },
  { steps: 8, label: '1/2' },
];
/** Un tour du decaleur (RANGE SYNC) ou du LFO (SYNC) : 8 mesures a 1/64. */
export const HELL_CYCLES: readonly { steps: number; label: string }[] = [
  { steps: 128, label: '8 BARS' },
  { steps: 64, label: '4 BARS' },
  { steps: 32, label: '2 BARS' },
  { steps: 16, label: '1 BAR' },
  { steps: 8, label: '1/2' },
  { steps: 4, label: '1/4' },
  { steps: 2, label: '1/8' },
  { steps: 1, label: '1/16' },
  { steps: 0.5, label: '1/32' },
  { steps: 0.25, label: '1/64' },
];
export const HELL_RANGES = ['FINE', 'WIDE', 'SYNC'] as const;
export const HELL_TARGETS = ['OFF', 'FREQ', 'PHASE', 'DELAY'] as const;
export const DIST_STYLES = ['MM', 'TAPE', 'DESK', 'IRON', 'TUBE', 'PENT'] as const;
/** Ce que chaque STYLE de DIST imite (l'infobulle) */
export const DIST_STYLE_TEXT: Readonly<Record<(typeof DIST_STYLES)[number], string>> = {
  MM: 'MM: the distortion of the MM-RYTM, as before',
  TAPE: 'TAPE: a soft, round tape saturation',
  DESK: 'DESK: a pushed console, bright and asymmetric',
  IRON: 'IRON: a transformer, a round knee and weight',
  TUBE: 'TUBE: a triode, even harmonics, warm',
  PENT: 'PENT: a pentode, a hard knee, aggressive',
};

/** Le cran d'un choix (n crans sur 0 a 1). */
export const notch = (v: number, n: number): number => Math.max(0, Math.min(n - 1, Math.round(Math.max(0, Math.min(1, v)) * (n - 1))));
const spsOf = (bpm: number): number => (Math.max(1, bpm) / 60) * 4;

/** Le decalage (Hz) : dsp/Fx.cpp hellShiftHz. */
export function hellShiftHz(f: Readonly<Fx>, bpm: number): number {
  const u = Math.max(-1, Math.min(1, 2 * f.hfreq - 1));
  const sg = u < 0 ? -1 : 1;
  const a = Math.abs(u);
  const r = notch(f.hrange, 3);
  if (r === 1) return sg * 20000 * a * a * a;
  if (r === 2) {
    if (a < 1e-3) return 0;
    const k = Math.min(HELL_CYCLES.length - 1, Math.floor(a * HELL_CYCLES.length));
    return (sg * spsOf(bpm)) / HELL_CYCLES[k].steps;
  }
  return sg * 200 * a * a;
}
/** Le temps (s) : dsp/Fx.cpp hellSeconds. */
export function hellSeconds(f: Readonly<Fx>, bpm: number): number {
  const t = Math.max(0, Math.min(1, f.htime));
  if (f.hsync >= 0.5) return Math.min(2, HELL_DIVS[notch(t, HELL_DIVS.length)].steps / spsOf(bpm));
  return Math.min(2, 0.00002 * Math.pow(50000, t));
}
export const hellFilterHz = (v: number): number => 100 * Math.pow(200, Math.max(0, Math.min(1, v)));
export function hellRateHz(f: Readonly<Fx>, bpm: number): number {
  if (f.hlsync >= 0.5) return spsOf(bpm) / HELL_CYCLES[notch(f.hrate, HELL_CYCLES.length)].steps;
  return 0.02 * Math.pow(1000, Math.max(0, Math.min(1, f.hrate)));
}
export const distLowHz = (v: number): number => (v < 0.005 ? 0 : 30 * Math.pow(500 / 30, Math.max(0, Math.min(1, v))));

const hz = (v: number): string => {
  const a = Math.abs(v);
  return a >= 1000 ? `${(a / 1000).toFixed(a >= 10000 ? 1 : 2)} KHZ` : a >= 100 ? `${a.toFixed(0)} HZ` : a >= 10 ? `${a.toFixed(1)} HZ` : `${a.toFixed(2)} HZ`;
};
const ms = (s: number): string => (s >= 1 ? `${s.toFixed(2)} S` : s * 1000 >= 10 ? `${(s * 1000).toFixed(0)} MS` : `${(s * 1000).toFixed(2)} MS`);
const pc = (v: number): string => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
const onOff = (v: number): string => (v >= 0.5 ? 'ON' : 'OFF');

/** Un reglage de l'onglet : son nom, ses crans (0 : continu), ce que l'ecran en dit (la valeur, sa ligne d'unite). */
export interface LabKnob {
  id: LabFxId | 'drive' | 'xtone';
  label: string;
  steps: number;
  read(f: Readonly<Fx>, bpm: number): string;
  unit(f: Readonly<Fx>, bpm: number): string;
  tip: string;
}

export const HELL_SHIFT: readonly LabKnob[] = [
  { id: 'hrange', label: 'RANGE', steps: 3, read: (f) => HELL_RANGES[notch(f.hrange, 3)], unit: (f) => ['+/-200 HZ', '+/-20 KHZ', 'TO THE BEAT'][notch(f.hrange, 3)], tip: 'FINE: up to 200 Hz, for spirals; WIDE: up to 20 kHz, for metal and sirens; SYNC: one turn per division of the beat' },
  {
    id: 'hfreq',
    label: 'FREQ',
    steps: 0,
    read: (f, bpm) => {
      const v = hellShiftHz(f, bpm);
      if (notch(f.hrange, 3) === 2) {
        const a = Math.abs(2 * f.hfreq - 1);
        return a < 1e-3 ? '0' : `${v < 0 ? '-' : '+'}${HELL_CYCLES[Math.min(HELL_CYCLES.length - 1, Math.floor(a * HELL_CYCLES.length))].label}`;
      }
      return v === 0 ? '0' : `${v < 0 ? '-' : '+'}${Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(1) + 'K' : Math.abs(v) >= 10 ? Math.abs(v).toFixed(0) : Math.abs(v).toFixed(1)}`;
    },
    unit: (f, bpm) => {
      const v = hellShiftHz(f, bpm);
      return v === 0 ? 'NO SHIFT' : `${hz(v)} ${v > 0 ? 'UP' : 'DOWN'}`;
    },
    tip: 'The shift: every repeat moves by this many Hz (not a pitch: the spectrum slides, the harmonics stop being harmonic)',
  },
  { id: 'hphase', label: 'PHASE', steps: 0, read: (f) => `${Math.round(f.hphase * 360)}`, unit: () => 'DEGREES', tip: 'The phase of the shifter: at 0 Hz or in SYNC, it moves the notches of the comb' },
  { id: 'hside', label: 'BAND', steps: 0, read: (f) => (f.hside >= 0.99 ? 'UP' : f.hside <= 0.01 ? 'DOWN' : `${Math.round(f.hside * 100)}`), unit: (f) => (f.hside >= 0.99 || f.hside <= 0.01 ? 'ONE BAND' : 'BOTH BANDS'), tip: 'Which band of the shifter: the upper one, the lower one, or both (both: a ring modulator, a tremolo in SYNC)' },
  { id: 'hanti', label: 'ANTI', steps: 0, read: (f) => pc(f.hanti), unit: () => 'NO FOLDING', tip: 'ANTI: cuts what would fold below 0 Hz when the shift goes down (cleaner spirals; at 0 the folding stays, harsher)' },
];
export const HELL_ECHO: readonly LabKnob[] = [
  { id: 'htime', label: 'TIME', steps: 0, read: (f, bpm) => (f.hsync >= 0.5 ? HELL_DIVS[notch(f.htime, HELL_DIVS.length)].label : ms(hellSeconds(f, bpm))), unit: (f, bpm) => (f.hsync >= 0.5 ? ms(hellSeconds(f, bpm)) : 'FREE'), tip: 'The time of the echo: very short (a few ms) for phasers and metal, long for repeats that climb' },
  { id: 'hsync', label: 'SYNC', steps: 2, read: (f) => onOff(f.hsync), unit: (f) => (f.hsync >= 0.5 ? 'TO THE TEMPO' : 'IN MS'), tip: 'TIME on the tempo (1/128 to 1/2 bar), or free (0.02 ms to 1 s)' },
  { id: 'hfb', label: 'FEEDBK', steps: 0, read: (f) => pc(f.hfb), unit: (f) => (f.hfb > 0.9 ? 'ENDLESS' : 'REPEATS'), tip: 'How much comes back into the loop: each repeat is shifted again' },
  { id: 'hfilt', label: 'FILTER', steps: 0, read: (f) => (f.hfilt >= 0.995 ? 'OPEN' : hz(hellFilterHz(f.hfilt)).replace(' HZ', '').replace(' KHZ', 'K')), unit: (f) => (f.hfilt >= 0.995 ? '20 KHZ' : hz(hellFilterHz(f.hfilt))), tip: 'A low-pass before the shifter, inside the loop: darker repeats' },
  { id: 'hcross', label: 'CROSS', steps: 2, read: (f) => onOff(f.hcross), unit: (f) => (f.hcross >= 0.5 ? 'PING PONG' : 'L AND R'), tip: 'Left and right swap at every repeat: a ping pong' },
  { id: 'hsmear', label: 'SMEAR', steps: 0, read: (f) => pc(f.hsmear), unit: () => 'DIFFUSION', tip: 'Scrambles the phase in the loop: splashy, reverb-like tails' },
];
export const HELL_LFO: readonly LabKnob[] = [
  { id: 'hlfo', label: 'TARGET', steps: 4, read: (f) => HELL_TARGETS[notch(f.hlfo, 4)], unit: () => 'LFO SINE', tip: 'What the LFO moves: the shift (FREQ), the phase, or the echo time (DELAY: chorus, flanger, tape)' },
  {
    id: 'hrate',
    label: 'RATE',
    steps: 0,
    read: (f, bpm) => (f.hlsync >= 0.5 ? HELL_CYCLES[notch(f.hrate, HELL_CYCLES.length)].label : hz(hellRateHz(f, bpm)).replace(' HZ', '')),
    unit: (f, bpm) => (f.hlsync >= 0.5 ? hz(hellRateHz(f, bpm)) : 'HZ'),
    tip: 'The speed of the LFO: free (0.02 to 20 Hz) or a division of the beat (8 bars to 1/64)',
  },
  { id: 'hlsync', label: 'SYNC', steps: 2, read: (f) => onOff(f.hlsync), unit: () => 'LFO', tip: 'The LFO on the beat (the same at every playback) or free' },
  { id: 'hamt', label: 'AMOUNT', steps: 0, read: (f) => pc(f.hamt), unit: () => 'DEPTH', tip: 'The depth of the LFO' },
  { id: 'hstereo', label: 'STEREO', steps: 2, read: (f) => onOff(f.hstereo), unit: (f) => (f.hstereo >= 0.5 ? 'R INVERTED' : 'SAME L R'), tip: 'The LFO upside down on the right: the two sides move apart' },
];
export const HELL_OUT: readonly LabKnob[] = [{ id: 'hmix', label: 'MIX', steps: 0, read: (f) => pc(f.hmix), unit: () => 'RETURN', tip: 'The level of HELL in the mix (each track sends into it with HELL on its FX page); the Hell Mix parameter in Ableton' }];

export const DIST_DRIVE: readonly LabKnob[] = [
  { id: 'xstyle', label: 'STYLE', steps: 6, read: (f) => DIST_STYLES[notch(f.xstyle, 6)], unit: () => 'CIRCUIT', tip: 'The saturation circuit: MM (as before), TAPE, DESK, IRON, TUBE, PENT' },
  { id: 'drive', label: 'DRIVE', steps: 0, read: (f) => pc(f.drive), unit: () => 'MASTER DIST', tip: 'The DIST of the whole machine (each track has its own DIST on its FX page; both use this character)' },
  { id: 'xpunish', label: 'PUNISH', steps: 2, read: (f) => onOff(f.xpunish), unit: () => '+20 DB', tip: 'Twenty more dB into the saturation' },
  { id: 'xauto', label: 'AUTO', steps: 2, read: (f) => onOff(f.xauto), unit: () => 'LEVEL', tip: 'The output level follows the input: push the drive without it getting louder' },
  { id: 'xout', label: 'OUTPUT', steps: 0, read: (f) => { const d = (2 * f.xout - 1) * 12; return `${d > 0.05 ? '+' : ''}${d.toFixed(1)}`; }, unit: () => 'DB', tip: 'The output level, -12 to +12 dB' },
  { id: 'xmix', label: 'MIX', steps: 0, read: (f) => pc(f.xmix), unit: () => 'WET', tip: 'The saturated part: below 100%, the clean sound comes back under it (parallel)' },
];
export const DIST_TONE: readonly LabKnob[] = [
  { id: 'xlow', label: 'LOW CUT', steps: 0, read: (f) => (distLowHz(f.xlow) === 0 ? 'OFF' : `${Math.round(distLowHz(f.xlow))}`), unit: (f) => (distLowHz(f.xlow) === 0 ? 'ALL THE LOWS' : 'HZ, BEFORE'), tip: 'The lows cut before the saturation (a tight kick, a cleaner low end)' },
  { id: 'xthump', label: 'THUMP', steps: 0, read: (f) => pc(f.xthump), unit: () => 'BUMP', tip: 'A bump right at the LOW CUT frequency' },
  { id: 'xtilt', label: 'TONE', steps: 0, read: (f) => { const t = 2 * f.xtilt - 1; return Math.abs(t) < 0.02 ? 'FLAT' : `${t < 0 ? 'DARK' : 'BRIGHT'} ${Math.round(Math.abs(t) * 100)}`; }, unit: () => 'BEFORE', tip: 'Dark: more lows, fewer highs into the saturation; bright: the opposite' },
  { id: 'xtone', label: 'HIGH CUT', steps: 0, read: (f) => (f.xtone >= 1 ? 'OPEN' : hz(fxLaw.xtone(f.xtone)).replace(' HZ', '').replace(' KHZ', 'K')), unit: (f) => (f.xtone >= 1 ? 'NO CUT' : 'AFTER'), tip: 'A low-pass after the saturation (the TONE of the DIST page)' },
  { id: 'xsteep', label: 'STEEP', steps: 2, read: (f) => onOff(f.xsteep), unit: (f) => (f.xsteep >= 0.5 ? '36 DB/OCT' : '12 DB/OCT'), tip: 'The HIGH CUT much steeper' },
];

/** La courbe de la DIST pour son dessin : la sortie d'un signal x (-1 a 1), comme dsp/Fx.cpp (sans filtres ni AUTO). */
export function distCurve(f: Readonly<Fx>, x: number): number {
  const d = Math.max(0, Math.min(1, f.drive));
  const m = 0.85 * d;
  const k = Math.pow(10, (-9 * d) / 20);
  const pre = ((1 + 12 * d) / 8) * (f.xpunish >= 0.5 ? 10 : 1);
  const u = pre * x;
  let s: number;
  switch (notch(f.xstyle, 6)) {
    case 1:
      s = Math.atan(6 * u) * (2 / Math.PI);
      break;
    case 2:
      s = Math.tanh(5 * u + 0.25) - Math.tanh(0.25);
      break;
    case 3: {
      const v = Math.max(-1.5, Math.min(1.5, 4 * u));
      s = v - (4 / 27) * v * v * v;
      break;
    }
    case 4: {
      const v = Math.max(-16, Math.min(16, 4 * u));
      s = Math.tanh(v + 0.3 * v * Math.abs(v));
      break;
    }
    case 5: {
      const v = Math.max(-64, Math.min(64, 8 * u));
      s = v / Math.pow(1 + Math.pow(Math.abs(v), 6), 1 / 6);
      break;
    }
    default:
      s = Math.tanh(8 * Math.max(-1, Math.min(1, u)));
  }
  const y = d > 0 ? k * (1 - m) * x + k * m * s : x;
  const mix = Math.max(0, Math.min(1, f.xmix));
  return ((1 - mix) * x + mix * y) * Math.pow(10, ((2 * f.xout - 1) * 12) / 20);
}

/* ---------------- les presets des deux sous-pages ---------------- */

type Patch = Partial<Record<LabFxId | 'drive' | 'xtone', number>>;
export interface LabPreset {
  name: string;
  tip: string;
  set: Patch;
}
/** Les reglages de HELL d'un preset : ceux du preset, le reste a leur depart. */
const HELL_IDS = (Object.keys(LAB_FX) as LabFxId[]).filter((k) => k.startsWith('h'));
const DIST_IDS = (Object.keys(LAB_FX) as LabFxId[]).filter((k) => k.startsWith('x'));
export function presetPatch(p: LabPreset, which: 'hell' | 'dist'): Patch {
  const base: Patch = {};
  for (const k of which === 'hell' ? HELL_IDS : DIST_IDS) base[k] = LAB_FX[k];
  if (which === 'dist') base.xtone = 1;
  return { ...base, ...p.set };
}
/** FREQ pour un decalage voulu (FINE : +/-200 Hz ; WIDE : +/-20 kHz) */
const fine = (hzV: number): number => 0.5 + (Math.sign(hzV) * Math.sqrt(Math.min(1, Math.abs(hzV) / 200))) / 2;
const wide = (hzV: number): number => 0.5 + (Math.sign(hzV) * Math.cbrt(Math.min(1, Math.abs(hzV) / 20000))) / 2;
/** TIME libre (s), en SYNC (le cran de HELL_DIVS) ; FILTER (Hz) ; RATE libre (Hz), en SYNC (le cran de HELL_CYCLES) */
const tFree = (s: number): number => Math.log(s / 0.00002) / Math.log(50000);
const tDiv = (label: string): number => HELL_DIVS.findIndex((d) => d.label === label) / (HELL_DIVS.length - 1);
const fHz = (v: number): number => Math.log(v / 100) / Math.log(200);
const rFree = (v: number): number => Math.log(v / 0.02) / Math.log(1000);
const rDiv = (label: string): number => HELL_CYCLES.findIndex((d) => d.label === label) / (HELL_CYCLES.length - 1);
const r3 = (v: number): number => Math.round(v * 1000) / 1000;
const P = (o: Patch): Patch => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, r3(v as number)])) as Patch;

export const HELL_PRESETS: readonly LabPreset[] = [
  { name: 'SPIRAL UP', tip: 'Eighth-note echoes, each one a little higher', set: P({ hfreq: fine(6), htime: tDiv('1/8'), hsync: 1, hfb: 0.72, hfilt: fHz(6000), hmix: 0.7 }) },
  { name: 'SPIRAL DN', tip: 'Eighth-note echoes, each one a little lower', set: P({ hfreq: fine(-6), htime: tDiv('1/8'), hsync: 1, hfb: 0.72, hfilt: fHz(6000), hmix: 0.7 }) },
  { name: 'METAL', tip: 'A 3 ms loop shifted by 40 Hz: drums turn into metal', set: P({ hfreq: fine(40), htime: tFree(0.003), hsync: 0, hfb: 0.65, hmix: 0.6 }) },
  { name: 'BARBER', tip: 'A phaser that climbs forever', set: P({ hfreq: fine(0.5), htime: tFree(0.0005), hsync: 0, hfb: 0.55, hmix: 0.55 }) },
  { name: 'AM 1/16', tip: 'Both bands on the beat: a tremolo in sixteenths', set: P({ hrange: 1, hfreq: 0.875, hside: 0.5, htime: 0, hsync: 0, hfb: 0, hmix: 0.8 }) },
  { name: 'RING', tip: 'A ring modulator at 150 Hz, no echo', set: P({ hfreq: fine(150), hside: 0.5, htime: 0, hsync: 0, hfb: 0, hmix: 0.6 }) },
  { name: 'DUB SIREN', tip: 'A dotted echo, the shift swept by the LFO, ping pong, dark', set: P({ hfreq: fine(2), htime: tDiv('1/8D'), hsync: 1, hfb: 0.78, hfilt: fHz(2000), hcross: 1, hlfo: 1 / 3, hrate: rDiv('1/2'), hlsync: 1, hamt: 0.5, hmix: 0.75 }) },
  { name: 'PING SHIFT', tip: 'A ping pong that climbs at every bounce', set: P({ hfreq: fine(12), htime: tDiv('1/8'), hsync: 1, hfb: 0.6, hfilt: fHz(8000), hcross: 1, hmix: 0.7 }) },
  { name: 'GHOST', tip: 'Long tails that sink and blur', set: P({ hfreq: fine(-15), htime: tDiv('1/2'), hsync: 1, hfb: 0.6, hfilt: fHz(2000), hsmear: 0.5, hmix: 0.6 }) },
  { name: 'WASH', tip: 'SMEAR to the max: a splashy reverb that drifts', set: P({ hfreq: fine(1), htime: tFree(0.03), hsync: 0, hfb: 0.85, hfilt: fHz(6000), hsmear: 1, hmix: 0.6 }) },
  { name: 'CHORUS', tip: 'No shift, the LFO on the time, in stereo: a wide chorus', set: P({ hfreq: 0.5, htime: tFree(0.008), hsync: 0, hfb: 0.2, hlfo: 1, hrate: rFree(0.3), hlsync: 0, hamt: 0.35, hstereo: 1, hmix: 0.6 }) },
  { name: 'INFERNO', tip: 'Everything at once: wide shift, endless loop, smear, ping pong', set: P({ hrange: 0.5, hfreq: wide(600), htime: tDiv('1/16'), hsync: 1, hfb: 0.9, hsmear: 0.4, hcross: 1, hlfo: 1 / 3, hrate: rDiv('1 BAR'), hlsync: 1, hamt: 0.4, hstereo: 1, hfilt: fHz(5000), hmix: 0.6 }) },
];

export const DIST_PRESETS: readonly LabPreset[] = [
  { name: 'MM', tip: 'The distortion of the MM-RYTM, as before', set: P({ drive: 0.3 }) },
  { name: 'TAPE WARM', tip: 'Soft tape, a little dark, the level held', set: P({ xstyle: 0.2, xtilt: 0.4, xauto: 1, drive: 0.35 }) },
  { name: 'DESK PUSH', tip: 'A console pushed, a little bright', set: P({ xstyle: 0.4, xtilt: 0.6, xauto: 1, drive: 0.45 }) },
  { name: 'IRON THUMP', tip: 'Transformer, the lows cut at 80 Hz with a bump', set: P({ xstyle: 0.6, xlow: 0.35, xthump: 0.7, xtilt: 0.45, xauto: 1, drive: 0.4 }) },
  { name: 'TUBE GLOW', tip: 'A triode in parallel: warm, even harmonics', set: P({ xstyle: 0.8, xtilt: 0.55, xmix: 0.7, xauto: 1, drive: 0.5 }) },
  { name: 'PENT SMASH', tip: 'Pentode, PUNISH, a steep high cut', set: P({ xstyle: 1, xpunish: 1, xtone: 0.75, xsteep: 1, xauto: 1, drive: 0.6, xmix: 0.8 }) },
  { name: 'LO-FI', tip: 'Dark tape, the highs cut steep, the lows cut', set: P({ xstyle: 0.2, xtilt: 0.3, xtone: 0.55, xsteep: 1, xlow: 0.5, drive: 0.5, xauto: 1 }) },
  { name: 'CRUNCH', tip: 'A bright console in parallel, crunchy', set: P({ xstyle: 0.4, xtilt: 0.8, xlow: 0.3, drive: 0.55, xmix: 0.6, xauto: 1 }) },
];
