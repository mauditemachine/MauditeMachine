/**
 * Les calculs du MM-DECKS (2026-10-04), sans son ni ecran : repris des
 * Decks de sonaa.ca (src/platines/calculs.ts), ou ils sont testes. Ce qui
 * transforme une position de commande en grandeur (pitch en vitesse,
 * filtre en frequence, fader en gain) vit ici, pour que la table, la scene
 * et les jumeaux lisent la meme regle.
 */

/* ---------- tonalite : la roue de Camelot (Mika, 2026-10-03 : "je prefere 9A") ---------- */

const NOTES: Readonly<Record<string, string>> = {
  c: 'C',
  'c sharp': 'C#',
  'd flat': 'Db',
  d: 'D',
  'd sharp': 'D#',
  'e flat': 'Eb',
  e: 'E',
  f: 'F',
  'f sharp': 'F#',
  'g flat': 'Gb',
  g: 'G',
  'g sharp': 'G#',
  'a flat': 'Ab',
  a: 'A',
  'a sharp': 'A#',
  'b flat': 'Bb',
  b: 'B',
};
const ENHARMONIC: Readonly<Record<string, string>> = { 'C#': 'Db', 'D#': 'Eb', Gb: 'F#', 'G#': 'Ab', 'A#': 'Bb' };
const CAMELOT_MINOR: Readonly<Record<string, string>> = {
  Ab: '1A',
  Eb: '2A',
  Bb: '3A',
  F: '4A',
  C: '5A',
  G: '6A',
  D: '7A',
  A: '8A',
  E: '9A',
  B: '10A',
  'F#': '11A',
  Db: '12A',
};
const CAMELOT_MAJOR: Readonly<Record<string, string>> = {
  B: '1B',
  'F#': '2B',
  Db: '3B',
  Ab: '4B',
  Eb: '5B',
  Bb: '6B',
  F: '7B',
  C: '8B',
  G: '9B',
  D: '10B',
  A: '11B',
  E: '12B',
};

/** Audius ecrit "D flat minor", les fichiers "Am", "F#m", "C maj" ou deja "8A" : la reponse en Camelot. */
export function camelot(key: string | null | undefined): string | null {
  const s = key ?? '';
  let note = '';
  let minor = false;
  const long = /^\s*([a-g](?:\s+(?:flat|sharp))?)\s+(major|minor)\s*$/i.exec(s);
  const cam = /^\s*(1[0-2]|[1-9])\s*([ab])\s*$/i.exec(s);
  const short = /^\s*([a-g])\s*([#b\u266f\u266d])?\s*(m|min|minor|maj|major)?\s*$/i.exec(s);
  if (cam) return `${cam[1]}${(cam[2] ?? '').toUpperCase()}`;
  if (long) {
    note = NOTES[(long[1] ?? '').toLowerCase().replace(/\s+/g, ' ')] ?? '';
    minor = (long[2] ?? '').toLowerCase() === 'minor';
  } else if (short) {
    const acc = short[2] === '\u266f' ? '#' : short[2] === '\u266d' ? 'b' : (short[2] ?? '');
    note = `${(short[1] ?? '').toUpperCase()}${acc}`;
    const mode = short[3] ?? '';
    minor = mode === 'm' || /^min/i.test(mode);
  }
  if (!note) return null;
  const canon = ENHARMONIC[note] ?? note;
  return (minor ? CAMELOT_MINOR : CAMELOT_MAJOR)[canon] ?? null;
}

/* ---------- pitch ---------- */

/** Vitesse de lecture pour un pitch en pour cent. */
export const speedOf = (pitchPct: number): number => 1 + pitchPct / 100;

/* ---------- filtre : un seul potard par voie, facon Xone ---------- */

/** Au milieu rien ; a gauche un passe-bas, a droite un passe-haut ; course exponentielle. */
export function filterOf(v: number): { type: 'none' | 'low' | 'high'; freq: number } {
  if (Math.abs(v) < 0.03) return { type: 'none', freq: 0 };
  const x = Math.min(1, Math.abs(v));
  if (v < 0) return { type: 'low', freq: 20000 * (150 / 20000) ** x };
  return { type: 'high', freq: 20 * (6000 / 20) ** x };
}

/* ---------- egaliseur : un isolateur de club ---------- */

/** De -1 a +1 : la gauche coupe presque tout (-26 dB), la droite pousse de 6 dB. */
export const eqDb = (v: number): number => (v < 0 ? v * 26 : v * 6);
export const dbToGain = (db: number): number => 10 ** (db / 20);
/** Le bout de course a gauche coupe net la bande (kill). */
export const KILL = -0.97;
export const bandGain = (v: number): number => (v <= KILL ? 0 : dbToGain(eqDb(v)));
/** Coupures de l'isolateur (ADR-097 de Sonaa, confirmees par Mika le 2026-10-03). */
export const CROSSOVER = { low: 250, high: 2500 } as const;

/* ---------- faders ---------- */

/** Courbe douce de la voie : le haut du fader garde l'essentiel du volume. */
export const faderGain = (x: number): number => Math.max(0, Math.min(1, x)) ** 2;

/** Crossfader a puissance constante : un enchainement ne creuse pas au milieu. */
export function xfaderGains(x: number): { a: number; b: number } {
  const t = (Math.max(-1, Math.min(1, x)) + 1) / 2;
  return { a: Math.cos((t * Math.PI) / 2), b: Math.sin((t * Math.PI) / 2) };
}

/* ---------- temps et effets ---------- */

/** Duree d'un nombre de temps a un tempo : ce que lisent le delay et le gate. */
export const beatsToSeconds = (bpm: number, beats: number): number => (60 / (bpm > 0 ? bpm : 120)) * beats;

/**
 * La dose d'un effet : la disto, le crush et le trans remplacent le son sec
 * a mesure qu'on monte ; le chorus et le flanger s'y melangent ; le delay et
 * la reverb s'y ajoutent, le son sec reste entier.
 */
export function fxMix(id: string, dose: number): { dry: number; wet: number } {
  const d = Math.max(0, Math.min(1, dose));
  if (id === 'delay') return { dry: 1, wet: d * 0.8 };
  if (id === 'reverb') return { dry: 1, wet: d * 0.9 };
  if (id === 'chorus' || id === 'flanger') return { dry: 1 - d * 0.5, wet: d * 0.8 };
  return { dry: 1 - d, wet: d };
}

/* ---------- forme d'onde ---------- */

/** Le maximum absolu par tranche, sur tous les canaux. */
export function peaks(channels: readonly Float32Array[], slices: number): Float32Array {
  const len = channels[0]?.length ?? 0;
  const out = new Float32Array(Math.max(0, slices));
  if (len === 0 || slices <= 0) return out;
  const step = len / slices;
  for (let i = 0; i < slices; i += 1) {
    const a = Math.floor(i * step);
    const b = Math.min(len, Math.floor((i + 1) * step));
    let max = 0;
    // Un echantillon sur plusieurs dans les longues tranches : juste a l'oeil, rapide au telephone
    const skip = Math.max(1, Math.floor((b - a) / 256));
    for (const c of channels) {
      for (let j = a; j < b; j += skip) {
        const v = Math.abs(c[j] ?? 0);
        if (v > max) max = v;
      }
    }
    out[i] = max;
  }
  return out;
}

/* ---------- VU ---------- */

/** Segments allumes pour une crete lineaire : -36 dB pour le premier, 0 dB pour le dernier. */
export function vuLeds(peak: number, segments = 15): number {
  if (!(peak > 0)) return 0;
  const part = (20 * Math.log10(peak) + 36) / 36;
  return Math.max(0, Math.min(segments, Math.ceil(part * segments)));
}

/* ---------- BPM d'un fichier ---------- */

/**
 * Le tempo d'un fichier sans BPM : l'enveloppe d'attaques (l'amplitude, pas
 * son logarithme) se ressemble a elle-meme decalee d'un temps ; on cherche
 * ce decalage entre 78 et 180 BPM, sur une minute au milieu du morceau, et
 * on cale a l'entier quand il en est tout proche.
 */
export function estimateBpm(signal: Float32Array, rate: number): number | null {
  const hop = Math.max(1, Math.round(rate / 200));
  const frames = Math.floor(signal.length / hop);
  if (frames < 400) return null;
  const start = Math.max(0, Math.floor(frames / 2) - 6000);
  const end = Math.min(frames, start + 12000);
  const energy = new Float32Array(end - start);
  for (let k = 0; k < energy.length; k += 1) {
    let e = 0;
    const o = (start + k) * hop;
    for (let i = 0; i < hop; i += 1) {
      const v = signal[o + i] ?? 0;
      e += v * v;
    }
    energy[k] = Math.sqrt(e / hop);
  }
  const onset = new Float32Array(energy.length);
  for (let k = 1; k < energy.length; k += 1) onset[k] = Math.max(0, (energy[k] ?? 0) - (energy[k - 1] ?? 0));
  const fps = rate / hop;
  const lagMin = Math.floor((60 / 180) * fps);
  const lagMax = Math.ceil((60 / 78) * fps);
  const score = new Float32Array(lagMax + 2);
  for (let d = lagMin - 1; d <= lagMax + 1; d += 1) {
    let s = 0;
    for (let k = d; k < onset.length; k += 1) s += (onset[k] ?? 0) * (onset[k - d] ?? 0);
    score[d] = s / (onset.length - d);
  }
  let best = -1;
  for (let d = lagMin; d <= lagMax; d += 1) if (best < 0 || (score[d] ?? 0) > (score[best] ?? 0)) best = d;
  if (best < 0 || !((score[best] ?? 0) > 0)) return null;
  const a = score[best - 1] ?? 0;
  const b = score[best] ?? 0;
  const c = score[best + 1] ?? 0;
  const curve = a - 2 * b + c;
  const lag = best + (curve !== 0 ? (0.5 * (a - c)) / curve : 0);
  const bpm = (60 * fps) / lag;
  const round = Math.round(bpm);
  return Math.abs(bpm - round) < 0.3 ? round : Math.round(bpm * 10) / 10;
}
