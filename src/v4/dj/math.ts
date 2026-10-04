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

/* ---------- forme d'onde en trois bandes ---------- */

/**
 * Les trois bandes de la forme d'onde (2026-10-04, Mika : "la waveform est
 * correcte mais on a du mal a voir les choses, ya pas un autre affichage ?") :
 * les basses (grosse caisse, basse) sous 180 Hz, les aigus (charleston,
 * cymbales) au-dessus de 2.5 kHz, les mediums entre (voix, nappes, snare).
 * Comme le 3BAND et le RGB des CDJ : on voit ou tape la grosse caisse,
 * ou elle s'arrete (un break), ou reviennent les charlestons.
 */
export const WAVE_SPLIT = { low: 180, high: 2500 } as const;

/** Un biquad de Butterworth (RBJ) : b0, b1, b2, a1, a2. */
function butterworth(kind: 'lp' | 'hp', f: number, rate: number): readonly number[] {
  const w = (2 * Math.PI * Math.min(f, rate * 0.45)) / rate;
  const c = Math.cos(w);
  const al = Math.sin(w) / (2 * Math.SQRT1_2);
  const a0 = 1 + al;
  const k = kind === 'lp' ? (1 - c) / 2 : (1 + c) / 2;
  return [k / a0, ((kind === 'lp' ? 2 : -2) * k) / a0, k / a0, (-2 * c) / a0, (1 - al) / a0];
}

/** Sous ce niveau, l'etat d'un filtre repart de zero (les denormaux ralentissent tout). */
const TINY = 1e-20;
const flush = (v: number): number => (v > -TINY && v < TINY ? 0 : v);

/**
 * La moyenne quadratique par tranche de chaque bande, entrelacee (basses,
 * mediums, aigus), normalisee bande par bande (wavePeaks3), sur la somme
 * des canaux. Basses : deux passe-bas en cascade (24 dB par octave) ; aigus :
 * deux passe-haut ; mediums : deux passe-haut a la coupure des basses puis
 * un passe-bas a celle des aigus (le reste du signal, x moins basses et
 * aigus, garde un residu de phase qui suivait la grosse caisse). Un
 * generateur : il rend la main toutes les 256 tranches (dj/engine.ts le
 * fait tourner par morceaux de quelques millisecondes, l'ecran ne fige pas).
 */
export function* bandEnergy(channels: readonly Float32Array[], rate: number, slices: number): Generator<number, Float32Array, void> {
  const n = Math.max(0, slices);
  const sq = new Float32Array(n * 3);
  const A = channels[0];
  const len = A?.length ?? 0;
  if (!A || len === 0 || n === 0) return sq;
  const B = channels[1] ?? A;
  const [lb0, lb1, lb2, la1, la2] = butterworth('lp', WAVE_SPLIT.low, rate);
  const [hb0, hb1, hb2, ha1, ha2] = butterworth('hp', WAVE_SPLIT.high, rate);
  const [mb0, mb1, mb2, ma1, ma2] = butterworth('hp', WAVE_SPLIT.low, rate);
  const [nb0, nb1, nb2, na1, na2] = butterworth('lp', WAVE_SPLIT.high, rate);
  // Etats : x l'entree, puis la sortie de chaque etage (son entree est la sortie du precedent)
  let x1 = 0, x2 = 0;
  let ly1 = 0, ly2 = 0, lz1 = 0, lz2 = 0;
  let hy1 = 0, hy2 = 0, hz1 = 0, hz2 = 0;
  let my1 = 0, my2 = 0, mz1 = 0, mz2 = 0, mw1 = 0, mw2 = 0;
  const step = len / n;
  for (let i = 0; i < n; i += 1) {
    const a = Math.floor(i * step);
    const b = Math.min(len, Math.floor((i + 1) * step));
    let sl = 0;
    let sm = 0;
    let sh = 0;
    for (let j = a; j < b; j += 1) {
      const x = (A[j] + B[j]) * 0.5;
      const ly = lb0 * x + lb1 * x1 + lb2 * x2 - la1 * ly1 - la2 * ly2;
      const lz = lb0 * ly + lb1 * ly1 + lb2 * ly2 - la1 * lz1 - la2 * lz2;
      const hy = hb0 * x + hb1 * x1 + hb2 * x2 - ha1 * hy1 - ha2 * hy2;
      const hz = hb0 * hy + hb1 * hy1 + hb2 * hy2 - ha1 * hz1 - ha2 * hz2;
      const my = mb0 * x + mb1 * x1 + mb2 * x2 - ma1 * my1 - ma2 * my2;
      const mz = mb0 * my + mb1 * my1 + mb2 * my2 - ma1 * mz1 - ma2 * mz2;
      const mw = nb0 * mz + nb1 * mz1 + nb2 * mz2 - na1 * mw1 - na2 * mw2;
      x2 = x1;
      x1 = x;
      ly2 = ly1;
      ly1 = ly;
      lz2 = lz1;
      lz1 = lz;
      hy2 = hy1;
      hy1 = hy;
      hz2 = hz1;
      hz1 = hz;
      my2 = my1;
      my1 = my;
      mz2 = mz1;
      mz1 = mz;
      mw2 = mw1;
      mw1 = mw;
      sl += lz * lz;
      sm += mw * mw;
      sh += hz * hz;
    }
    const k = b > a ? 1 / (b - a) : 0;
    sq[i * 3] = sl * k;
    sq[i * 3 + 1] = sm * k;
    sq[i * 3 + 2] = sh * k;
    ly1 = flush(ly1);
    ly2 = flush(ly2);
    lz1 = flush(lz1);
    lz2 = flush(lz2);
    hy1 = flush(hy1);
    hy2 = flush(hy2);
    hz1 = flush(hz1);
    hz2 = flush(hz2);
    my1 = flush(my1);
    my2 = flush(my2);
    mz1 = flush(mz1);
    mz2 = flush(mz2);
    mw1 = flush(mw1);
    mw2 = flush(mw2);
    if (i % 256 === 255) yield i / n;
  }
  return wavePeaks3(sq, true);
}

/**
 * Des carres moyens par tranche (entrelaces par trois) aux hauteurs de la
 * forme d'onde : la racine sur une petite fenetre (les basses sur quatre
 * tranches, les mediums sur deux : sans quoi chaque periode de la basse
 * dessine une dent), puis chaque bande ramenee a 1 sur sa tranche du
 * centile 99.5 (un morceau masterise ne plafonne pas partout), au moins un
 * cinquieme de la bande la plus forte (des aigus presque absents restent
 * petits). fine : les fenetres de la forme d'onde fine ; la piste entiere
 * (bandOverview) n'en a pas besoin.
 */
export function wavePeaks3(sq: Float32Array, fine: boolean): Float32Array {
  const n = Math.floor(sq.length / 3);
  const out = new Float32Array(n * 3);
  const win = fine ? [4, 2, 1] : [1, 1, 1];
  for (let c = 0; c < 3; c += 1) {
    const w = win[c];
    const lo = -Math.floor((w - 1) / 2);
    let sum = 0;
    let cnt = 0;
    // Fenetre glissante [i + lo, i + lo + w)
    for (let j = lo; j < lo + w; j += 1) {
      if (j >= 0 && j < n) {
        sum += sq[j * 3 + c];
        cnt += 1;
      }
    }
    for (let i = 0; i < n; i += 1) {
      out[i * 3 + c] = cnt > 0 ? Math.sqrt(Math.max(0, sum) / cnt) : 0;
      const drop = i + lo;
      const add = i + lo + w;
      if (drop >= 0 && drop < n) {
        sum -= sq[drop * 3 + c];
        cnt -= 1;
      }
      if (add >= 0 && add < n) {
        sum += sq[add * 3 + c];
        cnt += 1;
      }
    }
  }
  // Le centile 99.5 de chaque bande, sur au plus 16384 tranches prises a pas regulier
  const take = Math.min(n, 16384);
  const tops = [0, 0, 0];
  if (take > 0) {
    const pick = new Float32Array(take);
    for (let c = 0; c < 3; c += 1) {
      for (let k = 0; k < take; k += 1) pick[k] = out[Math.floor((k * n) / take) * 3 + c];
      pick.sort();
      tops[c] = pick[Math.min(take - 1, Math.floor(take * 0.995))];
    }
  }
  const floor = Math.max(...tops) * 0.2;
  for (let c = 0; c < 3; c += 1) {
    const top = Math.max(tops[c], floor);
    const k = top > 0 ? 1 / top : 0;
    for (let i = 0; i < n; i += 1) out[i * 3 + c] = Math.min(1, out[i * 3 + c] * k);
  }
  return out;
}

/** Les trois bandes de la piste entiere, d'apres celles de la forme d'onde fine (moyenne quadratique par tranche). */
export function bandOverview(detail: Float32Array, slices: number): Float32Array {
  const n = Math.floor(detail.length / 3);
  const sq = new Float32Array(Math.max(0, slices) * 3);
  if (n === 0 || slices <= 0) return sq;
  const step = n / slices;
  for (let i = 0; i < slices; i += 1) {
    const a = Math.floor(i * step);
    const b = Math.max(a + 1, Math.min(n, Math.floor((i + 1) * step)));
    for (let c = 0; c < 3; c += 1) {
      let s = 0;
      for (let j = a; j < b; j += 1) {
        const v = detail[j * 3 + c] ?? 0;
        s += v * v;
      }
      sq[i * 3 + c] = s / (b - a);
    }
  }
  return wavePeaks3(sq, false);
}

/* ---------- VU ---------- */

/**
 * La loi des vumetres, en dBFS (2026-10-04, Mika : "je veux que ce soit
 * precis par rapport au volume de chacun ; le rouge, c'est la
 * saturation") : le seuil de chaque segment, du bas vers le haut. Un
 * segment s'allume quand la crete atteint son seuil. Quinze segments :
 * - jaune de -36 a -9 dBFS (neuf segments, plus serres en montant) ;
 * - orange de -6 a -1 dBFS (cinq segments) : -1 est le plafond du limiteur
 *   du site, une crete limitee y monte sans saturer ;
 * - rouge seulement a -0.5 dBFS et au-dessus : le vrai risque d'ecretage.
 *   Le master, mesure apres le limiteur, ne l'atteint donc jamais.
 */
export const VU_DB: readonly number[] = [-36, -30, -26, -22, -19, -16, -13, -11, -9, -6, -4.5, -3, -2, -1, -0.5];
/** La couleur d'un segment selon son seuil. */
export const vuZone = (db: number): 'yellow' | 'orange' | 'red' => (db >= -0.5 ? 'red' : db >= -6 ? 'orange' : 'yellow');
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
