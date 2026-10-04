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

/** On lit "D flat minor", "Am", "F#m", "C maj" ou deja "8A" (SoundCloud, tags des fichiers) : la reponse en Camelot. */
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
 * La dose d'un effet : le crush et le trans remplacent le son sec a mesure
 * qu'on monte ; l'overdrive prend tout le son des qu'il est ouvert, sa dose
 * dit combien il sature (engine.ts) : le surechantillonnage du navigateur le
 * retarde de quelques millisecondes, et melange au son sec il le creuserait ; le chorus et le flanger s'y melangent ; le delay et
 * la reverb s'y ajoutent, le son sec reste entier.
 */
export function fxMix(id: string, dose: number): { dry: number; wet: number } {
  const d = Math.max(0, Math.min(1, dose));
  if (id === 'delay') return { dry: 1, wet: d * 0.8 };
  if (id === 'reverb') return { dry: 1, wet: d * 0.9 };
  if (id === 'chorus' || id === 'flanger') return { dry: 1 - d * 0.5, wet: d * 0.8 };
  if (id === 'overdrive') return d > 0 ? { dry: 0, wet: 1 } : { dry: 1, wet: 0 };
  return { dry: 1 - d, wet: d };
}

/* ---------- forme d'onde ---------- */

/**
 * L'energie par tranche (2026-10-04) pour les ecrans des platines : la
 * moyenne quadratique, pas la crete. Un morceau masterise touche le
 * plafond presque partout : en cretes, l'onde est un bloc ; en energie, les
 * grosses caisses et les breaks se lisent comme sur une CDJ. Normalisee :
 * la tranche la plus forte vaut 1.
 */
export function energy(channels: readonly Float32Array[], slices: number): Float32Array {
  const len = channels[0]?.length ?? 0;
  const out = new Float32Array(Math.max(0, slices));
  if (len === 0 || slices <= 0) return out;
  const step = len / slices;
  let top = 0;
  for (let i = 0; i < slices; i += 1) {
    const a = Math.floor(i * step);
    const b = Math.min(len, Math.floor((i + 1) * step));
    const skip = Math.max(1, Math.floor((b - a) / 128));
    let sum = 0;
    let n = 0;
    for (const c of channels) {
      for (let j = a; j < b; j += skip) {
        const v = c[j] ?? 0;
        sum += v * v;
        n += 1;
      }
    }
    const e = n > 0 ? Math.sqrt(sum / n) : 0;
    out[i] = e;
    if (e > top) top = e;
  }
  if (top > 0) for (let i = 0; i < slices; i += 1) out[i] /= top;
  return out;
}

/* ---------- VU ---------- */

/**
 * La loi des vumetres, en dBFS (2026-10-04, Mika : "je veux que ce soit
 * precis par rapport au volume de chacun ; le rouge, c'est la
 * saturation") : le seuil de chaque segment, du bas vers le haut. Un
 * segment s'allume quand la crete atteint son seuil. Quinze segments :
 * - jaune de -36 a -7.5 dBFS (dix segments, plus serres en montant) ;
 * - orange de -6 a -2 dBFS (quatre segments) ;
 * - rouge seulement a -1 dBFS et au-dessus : le vrai risque d'ecretage.
 */
export const VU_DB: readonly number[] = [-36, -30, -26, -22, -19, -16, -13, -11, -9, -7.5, -6, -4.5, -3, -2, -1];
/** La couleur d'un segment selon son seuil. */
export const vuZone = (db: number): 'yellow' | 'orange' | 'red' => (db >= -1 ? 'red' : db >= -6 ? 'orange' : 'yellow');
/** Une crete lineaire (0 a 1 et plus) en dBFS ; -Infinity pour le silence. */
export const toDbfs = (peak: number): number => (peak > 0 ? 20 * Math.log10(peak) : -Infinity);
/** Combien de segments s'allument pour un niveau en dBFS. */
export function vuLit(db: number): number {
  let n = 0;
  while (n < VU_DB.length && db >= VU_DB[n]) n += 1;
  return n;
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

/**
 * La grille des temps d'un morceau (2026-10-04, Mika : "continue avec le
 * calage des temps au SYNC") : le premier temps (secondes, de 0 a une
 * periode) et le BPM affine au centieme autour de celui qu'on connait.
 *
 * L'enveloppe des basses (un passe-bas a un pole vers 150 Hz : les grosses
 * caisses), 400 trames par seconde, compressee (log), puis ses montees
 * (onset). Pour chaque tempo essaye (le BPM connu, a plus ou moins 0.6, par
 * pas de 0.02 : estimateBpm arrondit a l'entier a 0.3 pres), chaque trame est rangee selon sa phase dans le temps : au
 * bon tempo, les montees s'empilent dans une meme case tout le long du
 * morceau ; a cote, elles s'etalent. Le tempo garde est celui dont la case
 * la plus pleine pese le plus ; a 0.06 d'un entier, l'entier (la plupart
 * des morceaux de club). Le premier temps est le milieu de cette case.
 * null : morceau trop court, ou pas de BPM de depart.
 */
export function beatGrid(signal: Float32Array, rate: number, guess: number | null): { bpm: number; offset: number } | null {
  if (!guess || !(guess > 0)) return null;
  const fps = 400;
  const hop = rate / fps;
  const frames = Math.floor(signal.length / hop);
  if (frames < fps * 8) return null;
  const a = 1 - Math.exp((-2 * Math.PI * 150) / rate);
  const env = new Float32Array(frames);
  let y = 0;
  let i = 0;
  for (let f = 0; f < frames; f += 1) {
    const end = Math.floor((f + 1) * hop);
    let e = 0;
    let n = 0;
    for (; i < end; i += 1) {
      y += a * ((signal[i] ?? 0) - y);
      e += y * y;
      n += 1;
    }
    env[f] = Math.log1p((1000 * e) / Math.max(1, n));
  }
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f += 1) onset[f] = Math.max(0, env[f] - env[f - 1]);

  /** La phase la plus chargee pour un tempo : son poids (part du total) et sa place (trames, depuis 0). */
  const fold = (bpm: number): { score: number; at: number } => {
    const period = (fps * 60) / bpm;
    const bins = Math.max(8, Math.floor(period));
    const k = bins / period;
    const hist = new Float32Array(bins);
    let total = 0;
    for (let f = 0; f < frames; f += 1) {
      const o = onset[f];
      if (o === 0) continue;
      hist[Math.min(bins - 1, Math.floor((f % period) * k))] += o;
      total += o;
    }
    if (total <= 0) return { score: 0, at: 0 };
    // Lissage circulaire (+-2 trames), puis la case la plus pleine, affinee entre ses voisines
    const sm = new Float32Array(bins);
    let best = 0;
    for (let b = 0; b < bins; b += 1) {
      let s = 0;
      for (let d = -2; d <= 2; d += 1) s += hist[(b + d + bins) % bins] * (3 - Math.abs(d));
      sm[b] = s;
      if (s > sm[best]) best = b;
    }
    const l = sm[(best - 1 + bins) % bins];
    const c = sm[best];
    const r = sm[(best + 1) % bins];
    const curve = l - 2 * c + r;
    const shift = curve !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (l - r)) / curve)) : 0;
    return { score: c / (total * 9), at: (best + 0.5 + shift) / k };
  };

  let bpm = guess;
  let top = -1;
  for (let s = -30; s <= 30; s += 1) {
    const b = guess + s * 0.02;
    const r = fold(b);
    if (r.score > top) {
      top = r.score;
      bpm = b;
    }
  }
  const round = Math.round(bpm);
  bpm = Math.abs(bpm - round) <= 0.06 ? round : Math.round(bpm * 100) / 100;
  const g = fold(bpm);
  if (g.score <= 0) return null;
  const spb = 60 / bpm;
  const offset = ((g.at / fps) % spb + spb) % spb;
  return { bpm, offset };
}

/**
 * L'ecart de phase entre deux grilles de temps (secondes, du temps reel) :
 * dans combien de temps tombe le prochain temps de chacune, et leurs
 * periodes. Rend le decalage a donner a la seconde (positif : elle est en
 * retard, il faut l'avancer), ramene dans une demi-periode de la plus
 * courte (un morceau au double ou a la moitie du tempo se cale aussi).
 */
export function phaseShift(ownIn: number, ownPeriod: number, refIn: number, refPeriod: number): number {
  const p = Math.min(ownPeriod, refPeriod);
  if (!(p > 0)) return 0;
  let d = (((ownIn - refIn) % p) + p) % p;
  if (d > p / 2) d -= p;
  return d;
}
