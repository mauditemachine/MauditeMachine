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
/** GAIN d'une voie (2026-10-08, Mika : "je veux un gain de +12 dB et -12 dB") : -12 a +12 dB, 0 au milieu (les EQ gardent leur loi). */
export const GAIN_DB = 12;
export const gainDb = (v: number): number => Math.max(-1, Math.min(1, v)) * GAIN_DB;
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

/* ---------- BPM et grille des temps d'un morceau ---------- */

/**
 * L'analyse d'un morceau (2026-10-08, Mika : "je pense qu'il faut analyser
 * la track pour que ca fonctionne", a propos de SYNC). Mesuree sur des
 * morceaux de synthese (grosse caisse a chaque temps, charleston a
 * contretemps, basse roulante, bruit ; 118 a 132 BPM, premier temps a 0,
 * 0.137 ou 0.402 s, 3 a 6 minutes, avec et sans intro de 16 mesures sans
 * grosse caisse et un break) : l'ancienne recherche du tempo (l'enveloppe
 * pleine bande, une minute au milieu) se trompait sur 16 morceaux sur 36
 * (134.5 pour 118, 110 pour 118, 142.5 pour 128.04), et la grille calait
 * 128.04 a 128 (19 ms de derive par minute, 110 ms au bout de six). En
 * quatre etages maintenant (36 sur 36, BPM exact, premier temps a 2 ms
 * pres, 0.3 s pour 6 minutes) :
 * 1. le tempo : les montees de l'enveloppe des basses (les grosses caisses)
 *    sur tout le morceau, leur autocorrelation, et pour chaque tempo de 78 a
 *    180 BPM la somme de ses quatre premiers temps (un tempo faux au double,
 *    a la moitie ou aux deux tiers n'y retrouve pas tous ses temps) ; un BPM
 *    connu (SoundCloud, les tags) ne sert que s'il s'accorde avec le son ;
 * 2. la grille : chaque trame rangee selon sa phase dans le temps, au
 *    tempo essaye a plus ou moins 0.6 par pas de 0.02 (beatGrid d'avant) ;
 * 3. la phase des grosses caisses parmi les doubles croches (kickPhase) ;
 * 4. la precision : l'attaque de chaque temps cherchee pres de la grille,
 *    puis la droite des moindres carres (ponderee, les ecarts rejetes) sur
 *    tout le morceau : le BPM au millieme, le premier temps a la
 *    milliseconde. Les temps sans attaque franche (intro, break) ne
 *    comptent pas.
 * Un generateur : il rend la main souvent (dj/grid.worker.ts le fait
 * tourner hors du fil principal ; sans worker, dj/actions.ts par tranches).
 */

/** Trames par seconde de l'enveloppe des basses (2.5 ms). */
const GRID_FPS = 400;
/** La plage des tempos cherches. */
const BPM_MIN = 78;
const BPM_MAX = 180;

/** Ce que l'analyse rend : le BPM, le premier temps (s, de 0 a une periode) et la part des temps ou tombe une attaque franche. */
export interface TrackGrid {
  bpm: number;
  offset: number;
  /** 0 a 1 : les temps de la grille ou une attaque est tombee a moins de 10 ms */
  confidence: number;
}

/**
 * La fenetre de l'enveloppe du tempo (trames, 20 ms). L'energie a 2.5 ms
 * d'une grosse caisse a 50 Hz ondule a 100 Hz (le carre d'une sinusoide) :
 * ces fausses montees, tout le long de la queue, brouillaient
 * l'autocorrelation au-dela de 155 BPM (2026-10-08, relecture : 170 BPM y
 * pesait 7 % du meilleur score, 160 tombait a 80, des breaks a 135 a 101).
 * Moyennee sur 20 ms (une periode de 50 Hz), l'ondulation disparait ; la
 * grille et la precision gardent l'enveloppe fine.
 */
const TEMPO_WIN = 8;

/** Les montees de l'enveloppe des basses (passe-bas a un pole vers 150 Hz, en log), GRID_FPS trames par seconde ; beat : celles de l'enveloppe lissee (TEMPO_WIN), pour le tempo. */
function* lowOnsets(signal: Float32Array, rate: number): Generator<void, { onset: Float32Array; level: Float32Array; beat: Float32Array }, void> {
  const hop = rate / GRID_FPS;
  const frames = Math.max(0, Math.floor(signal.length / hop));
  const onset = new Float32Array(frames);
  const level = new Float32Array(frames);
  const a = 1 - Math.exp((-2 * Math.PI * 150) / rate);
  let y = 0;
  let i = 0;
  let prev = 0;
  for (let f = 0; f < frames; f += 1) {
    const end = Math.floor((f + 1) * hop);
    let e = 0;
    let n = 0;
    for (; i < end; i += 1) {
      y += a * (signal[i] - y);
      e += y * y;
      n += 1;
    }
    y = flush(y);
    const env = Math.log1p((1000 * e) / Math.max(1, n));
    level[f] = e / Math.max(1, n);
    if (f > 0 && env > prev) onset[f] = env - prev;
    prev = env;
    if ((f & 4095) === 4095) yield;
  }
  // L'enveloppe du tempo : la moyenne glissante de l'energie sur TEMPO_WIN trames, en log, ses montees
  const beat = new Float32Array(frames);
  let sum = 0;
  let last = 0;
  for (let f = 0; f < frames; f += 1) {
    sum += level[f];
    if (f >= TEMPO_WIN) sum -= level[f - TEMPO_WIN];
    const env = Math.log1p((1000 * Math.max(0, sum)) / Math.min(f + 1, TEMPO_WIN));
    if (f > 0 && env > last) beat[f] = env - last;
    last = env;
  }
  return { onset, level, beat };
}

/**
 * La phase des grosses caisses parmi les quatre doubles croches d'un temps
 * (2026-10-08) : une basse roulante attaque aussi fort qu'une grosse caisse
 * dans les basses, la grille pouvait tomber sur elle (un quart de temps a
 * cote ; 3 morceaux sur 36 quand la grosse caisse est un peu moins forte).
 * La grosse caisse reste ce qui monte le plus : pour chaque double croche, la
 * crete d'energie des 40 ms qui suivent moins la moyenne des 40 ms d'avant,
 * sommee sur tout le morceau ; une autre double croche ne l'emporte que
 * nettement (20 % de plus). Rend le decalage en trames.
 */
function kickPhase(level: Float32Array, a: number, b: number): number {
  const frames = level.length;
  const win = Math.round(0.04 * GRID_FPS);
  const sums = [0, 0, 0, 0];
  for (let j = 0; j < 4; j += 1) {
    for (let c = a + (j * b) / 4; c < frames - win; c += b) {
      const f0 = Math.round(c);
      if (f0 < win) continue;
      // La montee : la crete des 40 ms qui suivent moins la moyenne des 40 ms d'avant
      let m = 0;
      for (let f = f0; f < f0 + win; f += 1) if (level[f] > m) m = level[f];
      let before = 0;
      for (let f = f0 - win; f < f0; f += 1) before += level[f];
      sums[j] += Math.max(0, m - before / win);
    }
  }
  let best = 0;
  for (let j = 1; j < 4; j += 1) if (sums[j] > sums[best]) best = j;
  return best !== 0 && sums[best] > 1.2 * sums[0] ? (best * b) / 4 : 0;
}

/**
 * Le tempo par l'autocorrelation des montees, a 200 trames par seconde
 * (lissees sur +-10 ms, centrees sur leur moyenne d'une seconde) : pour un
 * tempo, la moyenne de l'autocorrelation a un, deux, trois et quatre temps.
 * null : morceau trop court ou sans attaques.
 */
function* tempoCurve(onset: Float32Array): Generator<void, ((bpm: number) => number) | null, void> {
  const fps = GRID_FPS / 2;
  const n = Math.floor(onset.length / 2);
  if (n < fps * 8) return null;
  const o = new Float32Array(n);
  for (let j = 0; j < n; j += 1) o[j] = onset[2 * j] + onset[2 * j + 1];
  const sm = new Float32Array(n);
  for (let j = 0; j < n; j += 1) {
    let s = 3 * o[j];
    if (j > 0) s += 2 * o[j - 1];
    if (j > 1) s += o[j - 2];
    if (j + 1 < n) s += 2 * o[j + 1];
    if (j + 2 < n) s += o[j + 2];
    sm[j] = s / 9;
  }
  // La moyenne glissante d'une seconde retiree : l'autocorrelation ne voit que ce qui revient
  const c = new Float32Array(n);
  const half = fps >> 1;
  let sum = 0;
  let cnt = 0;
  for (let j = 0; j < Math.min(n, half); j += 1) {
    sum += sm[j];
    cnt += 1;
  }
  let energy = 0;
  for (let j = 0; j < n; j += 1) {
    const add = j + half;
    const drop = j - half - 1;
    if (add < n) {
      sum += sm[add];
      cnt += 1;
    }
    if (drop >= 0) {
      sum -= sm[drop];
      cnt -= 1;
    }
    c[j] = sm[j] - sum / cnt;
    energy += c[j] * c[j];
  }
  if (!(energy > 0)) return null;
  const lagMin = Math.max(1, Math.floor((60 * fps) / BPM_MAX) - 2);
  const lagMax = Math.ceil((4 * 60 * fps) / BPM_MIN) + 2;
  const r = new Float32Array(lagMax + 2);
  for (let L = lagMin; L <= lagMax + 1; L += 1) {
    let s = 0;
    const m = n - L;
    for (let j = 0; j < m; j += 1) s += c[j] * c[j + L];
    r[L] = s / Math.max(1, m);
    if ((L & 15) === 15) yield;
  }
  const at = (lag: number): number => {
    if (lag < lagMin || lag > lagMax) return 0;
    const k = Math.floor(lag);
    const t = lag - k;
    return r[k] * (1 - t) + r[k + 1] * t;
  };
  return (bpm: number): number => {
    const p = (60 * fps) / bpm;
    return (at(p) + at(2 * p) + at(3 * p) + at(4 * p)) / 4;
  };
}

/** Le meilleur tempo d'une courbe entre lo et hi (au vingtieme de BPM) et son score. */
function peakOf(score: (bpm: number) => number, lo: number, hi: number): { bpm: number; score: number } {
  let bpm = lo;
  let top = -Infinity;
  for (let b = Math.max(BPM_MIN, lo); b <= Math.min(BPM_MAX, hi) + 1e-9; b += 0.05) {
    const s = score(b);
    if (s > top) {
      top = s;
      bpm = b;
    }
  }
  return { bpm, score: top };
}

/**
 * La phase la plus chargee pour un tempo (l'ancienne beatGrid) : chaque
 * trame rangee selon sa phase dans le temps ; au bon tempo, les montees
 * s'empilent dans une meme case tout le long du morceau. Son poids (part du
 * total) et sa place (trames, depuis 0).
 */
function fold(onset: Float32Array, bpm: number): { score: number; at: number } {
  const frames = onset.length;
  const period = (GRID_FPS * 60) / bpm;
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
}

/** Une droite des moindres carres ponderee : t = a + b k. */
function line(ks: readonly number[], ts: readonly number[], ws: readonly number[]): { a: number; b: number } | null {
  let sw = 0;
  let sk = 0;
  let st = 0;
  for (let i = 0; i < ks.length; i += 1) {
    sw += ws[i];
    sk += ws[i] * ks[i];
    st += ws[i] * ts[i];
  }
  if (!(sw > 0)) return null;
  const mk = sk / sw;
  const mt = st / sw;
  let num = 0;
  let den = 0;
  for (let i = 0; i < ks.length; i += 1) {
    const dk = ks[i] - mk;
    num += ws[i] * dk * (ts[i] - mt);
    den += ws[i] * dk * dk;
  }
  if (!(den > 0)) return null;
  const b = num / den;
  return { a: mt - b * mk, b };
}

/**
 * L'etage de precision : pres de chaque temps de la grille (a +-win
 * trames), l'attaque la plus forte, placee entre ses voisines ; les temps
 * francs (au moins 30 % de la force des plus forts) font la droite, les
 * ecarts de plus de 10 ms (ou trois fois l'ecart median) sont rejetes. La
 * grille en trames : le temps 0 a la trame a, un temps toutes les b trames.
 * L'attaque se cherche en deux temps (relecture du 2026-10-08) : dans
 * l'enveloppe lissee (coarse, sans l'ondulation des basses), puis a
 * +-REFINE_NEAR trames de la, dans l'enveloppe fine. Au-dela de 165 BPM, la
 * queue de la grosse caisse d'avant ondule encore sous la suivante ; ses
 * fausses montees attiraient la grille 16 ms trop tot (175 et 180 BPM).
 */
const REFINE_NEAR = 3;

function refine(onset: Float32Array, coarse: Float32Array, a: number, b: number, win: number): { a: number; b: number; kc: number; hits: number; beats: number } | null {
  const frames = onset.length;
  const ks: number[] = [];
  const ts: number[] = [];
  const ws: number[] = [];
  const k0 = Math.ceil((1 - a) / b);
  let beats = 0;
  for (let k = k0; a + k * b < frames - 2; k += 1) {
    beats += 1;
    const c = a + k * b;
    const lo = Math.max(1, Math.round(c - win));
    const hi = Math.min(frames - 2, Math.round(c + win));
    // L'attaque dans l'enveloppe lissee, puis sa place exacte dans la fine
    let near = -1;
    let top = 0;
    for (let f = lo; f <= hi; f += 1) {
      if (coarse[f] > top) {
        top = coarse[f];
        near = f;
      }
    }
    if (near < 0) continue;
    let m = -1;
    let v = 0;
    for (let f = Math.max(1, near - REFINE_NEAR); f <= Math.min(frames - 2, near + REFINE_NEAR); f += 1) {
      if (onset[f] > v) {
        v = onset[f];
        m = f;
      }
    }
    if (m < 0) continue;
    const l = onset[m - 1];
    const r = onset[m + 1];
    const curve = l - 2 * v + r;
    const d = curve < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (l - r)) / curve)) : 0;
    ks.push(k);
    ts.push(m + d);
    ws.push(v);
  }
  if (ks.length < 16) return null;
  // Les temps francs : 30 % au moins du 90e centile des attaques
  const sorted = ws.slice().sort((x, y) => x - y);
  const strong = sorted[Math.floor(sorted.length * 0.9)] * 0.3;
  let K: number[] = [];
  let T: number[] = [];
  let W: number[] = [];
  for (let i = 0; i < ks.length; i += 1) {
    if (ws[i] < strong) continue;
    K.push(ks[i]);
    T.push(ts[i]);
    W.push(ws[i]);
  }
  let fit = line(K, T, W);
  for (let pass = 0; pass < 2 && fit; pass += 1) {
    const f = fit;
    const res = K.map((k, i) => Math.abs(T[i] - (f.a + f.b * k)));
    const med = res.slice().sort((x, y) => x - y)[Math.floor(res.length / 2)] ?? 0;
    const cut = Math.min(0.01 * GRID_FPS, Math.max(0.002 * GRID_FPS, 3 * med));
    const keep = res.map((e) => e <= cut);
    K = K.filter((_, i) => keep[i]);
    T = T.filter((_, i) => keep[i]);
    W = W.filter((_, i) => keep[i]);
    if (K.length < 16) return null;
    fit = line(K, T, W);
  }
  if (!fit) return null;
  // Le centre de gravite des temps mesures : la grille pivote autour de lui quand le BPM s'arrondit
  let sw = 0;
  let sk = 0;
  for (let i = 0; i < K.length; i += 1) {
    sw += W[i];
    sk += W[i] * K[i];
  }
  return { a: fit.a, b: fit.b, kc: sk / sw, hits: K.length, beats };
}

/** Un BPM connu s'accorde avec le son quand lui, son double ou sa moitie fait au moins cette part du meilleur score. */
const HINT_AGREES = 0.85;
/** Sans BPM connu, le double du meilleur tempo l'emporte s'il garde cette part de son score. */
const OCTAVE_UP = 0.9;

/**
 * Le tempo de depart de la grille (2026-10-08). Une grosse caisse a chaque
 * temps de 160 se lit aussi bien a 80 (ses temps tombent un sur deux) : la
 * courbe ne tranche pas entre un tempo et sa moitie. Avec un BPM connu
 * (tags, SoundCloud, la caisse) qui s'accorde avec le son, a l'octave pres,
 * c'est son octave qui compte, lui d'abord : un 174 de drum and bass reste a
 * 174 meme si le son pese plus a 87 (relecture du 2026-10-08 : l'ancienne
 * regle prenait le meilleur score des trois, 160 devenait 80). Un BPM faux
 * (3 de trop) ne s'accorde pas : le son l'emporte. Sans BPM connu, le plus
 * rapide des deux s'il garde 90 % du score (160 et non 80).
 */
function tempoGuess(curve: (bpm: number) => number, hint: number | null): number {
  const top = peakOf(curve, BPM_MIN, BPM_MAX);
  const inRange = (b: number): boolean => b >= BPM_MIN - 0.6 && b <= BPM_MAX + 0.6;
  const near = (b: number): { bpm: number; score: number } => peakOf(curve, b - 0.6, b + 0.6);
  if (hint && hint > 0) {
    const octaves = [hint, hint * 2, hint / 2].filter(inRange);
    if (octaves.some((h) => near(h).score >= HINT_AGREES * top.score)) return octaves[0];
  }
  const up = top.bpm * 2;
  if (inRange(up)) {
    const p = near(up);
    if (p.score >= OCTAVE_UP * top.score) return p.bpm;
  }
  return top.bpm;
}

/**
 * L'analyse entiere, en generateur. hint : un BPM connu (SoundCloud, tags,
 * la caisse) ; s'il s'accorde avec le son (lui, son double ou sa moitie a
 * 85 % au moins du meilleur score), son octave fait le tempo (tempoGuess),
 * sinon le son l'emporte. null : morceau trop court (moins de 8 s) ou sans
 * attaques.
 */
export function* trackGridSteps(signal: Float32Array, rate: number, hint: number | null = null): Generator<void, TrackGrid | null, void> {
  if (!(rate > 0) || signal.length < rate * 8) return null;
  const { onset, level, beat } = yield* lowOnsets(signal, rate);
  const curve = yield* tempoCurve(beat);
  if (!curve) return null;
  if (!(peakOf(curve, BPM_MIN, BPM_MAX).score > 0)) return null;
  const guess = tempoGuess(curve, hint);
  yield;
  // La grille : le tempo a +-0.6 par pas de 0.02, la phase la plus chargee
  let bpm = guess;
  let topFold = -1;
  for (let s = -30; s <= 30; s += 1) {
    const b = guess + s * 0.02;
    const r = fold(onset, b);
    if (r.score > topFold) {
      topFold = r.score;
      bpm = b;
    }
    if ((s & 7) === 7) yield;
  }
  const g = fold(onset, bpm);
  if (g.score <= 0) return null;
  // La precision : la fenetre d'un huitieme, puis d'un douzieme, puis d'un seizieme de temps, jusqu'a ce que la droite ne bouge plus
  let a = g.at + kickPhase(level, g.at, (GRID_FPS * 60) / bpm);
  let b = (GRID_FPS * 60) / bpm;
  // Le pivot (trames) : un temps au milieu des attaques ; la grille finale passe par lui
  let pivot = a + Math.floor(onset.length / b / 2) * b;
  let hits = 0;
  let beats = 0;
  for (const div of [8, 12, 16, 16, 16, 16]) {
    yield;
    const r = refine(onset, beat, a, b, b / div);
    if (!r) break;
    const still = Math.abs(r.b - b) < 1e-6 && div === 16;
    pivot = r.a + r.b * Math.round(r.kc);
    // Le temps 0 de la droite ramene dans la premiere periode
    a = ((r.a % r.b) + r.b) % r.b;
    b = r.b;
    hits = r.hits;
    beats = r.beats;
    if (still) break;
  }
  bpm = (GRID_FPS * 60) / b;
  // Le BPM au millieme ; a un centieme d'un entier, l'entier (la plupart des morceaux de club, sans derive mesurable)
  const round = Math.round(bpm);
  bpm = Math.abs(bpm - round) < 0.01 ? round : Math.round(bpm * 1000) / 1000;
  b = (GRID_FPS * 60) / bpm;
  // Le premier temps : celui du pivot, ramene dans la premiere periode (la crete placee entre ses voisines tombe sur l'attaque : mesure a +0.2 ms pres sur une 909, +1.4 ms sur une attaque lente de 6 ms)
  const spb = 60 / bpm;
  const offset = ((((((pivot % b) + b) % b) / GRID_FPS) % spb) + spb) % spb;
  return { bpm, offset, confidence: beats > 0 ? Math.min(1, hits / beats) : 0 };
}

/** L'analyse d'un trait (la caisse en fond, les tests). */
export function analyseTrack(signal: Float32Array, rate: number, hint: number | null = null): TrackGrid | null {
  const it = trackGridSteps(signal, rate, hint);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

/**
 * Le signal de l'analyse : la moyenne de q echantillons, q la frequence sur
 * 11 025 (entier) ; l'analyse n'ecoute que les basses, quatre fois moins de
 * calcul a 44.1 kHz pour le meme resultat (mesure sur les morceaux de
 * synthese). Toujours une copie : elle peut partir dans un worker.
 */
export function analysisSignal(signal: Float32Array, rate: number): { x: Float32Array; rate: number } {
  const q = Math.max(1, Math.floor(rate / 11025));
  if (q === 1) return { x: signal.slice(), rate };
  const n = Math.floor(signal.length / q);
  const x = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i += 1) {
    let s = 0;
    for (let k = 0; k < q; k += 1, j += 1) s += signal[j];
    x[i] = s / q;
  }
  return { x, rate: rate / q };
}

/**
 * Le tempo d'un fichier sans BPM (la caisse, en fond) : l'analyse entiere,
 * au centieme (a un centieme d'un entier, l'entier).
 */
export function estimateBpm(signal: Float32Array, rate: number): number | null {
  const s = analysisSignal(signal, rate);
  const g = analyseTrack(s.x, s.rate);
  return g ? Math.round(g.bpm * 100) / 100 : null;
}

/**
 * La grille des temps d'un morceau (2026-10-04, Mika : "continue avec le
 * calage des temps au SYNC") : le premier temps (secondes, de 0 a une
 * periode) et le BPM. guess : un BPM connu, ou null. null : morceau trop
 * court ou sans attaques.
 */
export function beatGrid(signal: Float32Array, rate: number, guess: number | null): { bpm: number; offset: number } | null {
  const g = analyseTrack(signal, rate, guess);
  return g ? { bpm: g.bpm, offset: g.offset } : null;
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
