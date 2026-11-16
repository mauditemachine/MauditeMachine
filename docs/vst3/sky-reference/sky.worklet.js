/**
 * MM-SKY (2026-11-16, Mika : "regarde ce plugin [le BigSky de Strymon] decortique le et quand on clic sur le knob
 * Reverb on tombe sur une page de configuration pour la reverb avec tous les parametres AINSI QUE la qualite de
 * Strymon BigSky mais au design de MM-ARP") : la reverbe du MM-ARP, algorithmique, a la place du convolueur sur du
 * bruit (audio/fx.ts). Les douze machines du BigSky, leurs reglages (voyager/sky.ts traduit la page en grandeurs
 * physiques : secondes, Hz, rapports), le mouille seul (l'envoi REVERB du MM-ARP, audio/sends.ts sendBus).
 *
 * Le coeur (ROOM, HALL, PLATE, SWELL, BLOOM, CLOUD, CHORALE, SHIMMER, et la queue de MAGNETO, NONLINEAR et
 * REFLECTIONS) : un reseau de huit retards reboucles (FDN) par une matrice de Householder (sans perte, chaque ligne
 * nourrit toutes les autres), chaque ligne :
 * - lue en interpolation d'Hermite (4 points) a un retard module par deux sinus de vitesses sans rapport simple (MOD :
 *   la queue bouge sans jamais vibrer en mesure, la coloration metallique d'un FDN fixe s'en va) ;
 * - suivie d'un passe-tout (densite : CLOUD, HALL, PLATE) ;
 * - amortie en trois bandes (graves, mediums, aigus, separations complementaires a un pole) : chaque bande perd
 *   exactement ce qu'il faut pour descendre de 60 dB en DECAY x son multiplicateur (LOW END, MID, TONE), quelle que
 *   soit la longueur de la ligne ; le DECAY affiche est donc le vrai Tr60, comme sur le BigSky.
 * Avant lui : le coupe-bas de LOW END, le PRE-DELAY (lu en Hermite, il glisse sans clic), quatre passe-tout de
 * diffusion par canal (DIFFUSION), les premieres reflexions (sources images d'une vraie piece : ROOM, HALL,
 * REFLECTIONS). Apres lui : le passe-bas de TONE (deux poles).
 *
 * Les machines a part :
 * - SPRING : un a trois ressorts, chacun une boucle retard + une cascade de 40 passe-tout du premier ordre (la
 *   dispersion : les graves arrivent apres les aigus, le "drip" qui descend), DWELL sature le preampli ;
 * - SWELL : un suiveur d'enveloppe arme sur le silence, la reverbe (SWLWET) ou une copie du son (SWLDRY) monte en
 *   RISE TIME ;
 * - BLOOM : quatre longs passe-tout reboucles (LENGTH, FEEDBACK) avant le reseau : la reverbe fleurit ;
 * - CHORALE : trois formants (filtres a variables d'etat) par canal sur la queue, la voyelle qui glisse ;
 * - SHIMMER : deux voix transposees (deux lectures fenetrees en sin^2 par voix, la somme reste constante), en entree
 *   (INPUT), dans la boucle (REGEN) ou les deux ;
 * - MAGNETO : un echo a bande multi-tetes (3, 4, 6, EVEN ou UNEVEN), chaque tete diffusee, la reinjection saturee ;
 * - NONLINEAR : 32 prises reparties sur TIME, leur gain suit SHAPE (GATE, REVERSE...), puis une queue (LATE) ;
 * - REFLECTIONS : les reflexions d'ordre 1 et 2 d'une piece de 100 a 1000 pieds carres (SHAPE), l'ampli place en X et
 *   en Y, chaque oreille a sa distance (le relief), puis une petite queue diffuse.
 *
 * Un changement de structure (machine, taille, ressorts, tetes...) passe par un fondu de 20 ms : la sortie descend,
 * les lignes se vident, la nouvelle structure remonte. Les autres reglages glissent. Rien n'alloue dans process().
 * Au repos (entree et sortie muettes depuis 1 s), le processeur ne calcule plus rien.
 */

const N = 8;
/** Les longueurs de base des lignes du reseau (echantillons a 48 kHz, premiers entre eux, 23 a 47 ms). */
const BASE = [1129, 1291, 1453, 1601, 1777, 1913, 2083, 2267];
/** Les passe-tout dans la boucle, un par ligne (echantillons a 48 kHz). */
const AP_IN = [139, 173, 211, 251, 293, 331, 379, 419];
/** Les signes de sortie gauche et droite (deux combinaisons orthogonales : la queue est large et decorrelee). */
const OUT_L = [1, -1, 1, -1, 1, -1, 1, -1];
const OUT_R = [1, 1, -1, -1, 1, 1, -1, -1];
const INJ = [1, 1, -1, 1, -1, -1, 1, -1];
/** Diffuseurs d'entree (echantillons a 48 kHz, ceux du plateau de Dattorro mis a l'echelle). */
const DIFF_L = [229, 173, 611, 447];
const DIFF_R = [241, 163, 593, 461];
const MAX_SCALE = 3.2;
const FADE_N = 960;
const IDLE_S = 1;
const TINY = 1e-20;

const clampN = (v, lo, hi, d) => (Number.isFinite(v) ? (v < lo ? lo : v > hi ? hi : v) : d);
const pow2 = (n) => {
  let s = 16;
  while (s < n) s <<= 1;
  return s;
};

/** Une ligne circulaire : read(d) lit x[n - d] (d >= 1) avant le write(x) de l'echantillon n. */
class Line {
  constructor(n) {
    const size = pow2(n + 8);
    this.b = new Float32Array(size);
    this.m = size - 1;
    this.w = 0;
  }
  clear() {
    this.b.fill(0);
  }
  write(x) {
    this.b[this.w] = x;
    this.w = (this.w + 1) & this.m;
  }
  read(d) {
    return this.b[(this.w - d) & this.m];
  }
  /** Hermite 4 points, d >= 2. */
  readF(d) {
    const i = d | 0;
    const f = d - i;
    const b = this.b;
    const m = this.m;
    const w = this.w;
    const x0 = b[(w - i + 1) & m];
    const x1 = b[(w - i) & m];
    const x2 = b[(w - i - 1) & m];
    const x3 = b[(w - i - 2) & m];
    const c1 = 0.5 * (x2 - x0);
    const c2 = x0 - 2.5 * x1 + 2 * x2 - 0.5 * x3;
    const c3 = 0.5 * (x3 - x0) + 1.5 * (x1 - x2);
    return ((c3 * f + c2) * f + c1) * f + x1;
  }
}

/** Un passe-tout de Schroeder sur une ligne : d (echantillons), g (coefficient). */
class Allpass {
  constructor(maxD) {
    this.l = new Line(maxD);
    this.d = Math.max(1, Math.min(maxD, 1));
    this.g = 0;
  }
  clear() {
    this.l.clear();
  }
  run(x) {
    const z = this.l.read(this.d);
    const v = x + this.g * z;
    this.l.write(v);
    return z - this.g * v;
  }
  /** Lu a un retard module (fractionnaire). */
  runF(x, d) {
    const z = this.l.readF(d);
    const v = x + this.g * z;
    this.l.write(v);
    return z - this.g * v;
  }
}

/** Passe-bas a deux poles (biquad RBJ, Q 0.707) ; f >= 0.45 sr : bypass. */
class Lp2 {
  constructor() {
    this.set(20000);
    this.z1 = 0;
    this.z2 = 0;
  }
  set(f) {
    this.on = f < 0.45 * sampleRate && f < 19500;
    if (!this.on) return;
    const w = (2 * Math.PI * f) / sampleRate;
    const cs = Math.cos(w);
    const al = Math.sin(w) / (2 * Math.SQRT1_2);
    const a0 = 1 + al;
    this.b0 = (1 - cs) / 2 / a0;
    this.b1 = (1 - cs) / a0;
    this.b2 = this.b0;
    this.a1 = (-2 * cs) / a0;
    this.a2 = (1 - al) / a0;
  }
  clear() {
    this.z1 = 0;
    this.z2 = 0;
  }
  run(x) {
    if (!this.on) return x;
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

/** Passe-haut a deux poles (biquad RBJ, Q 0.707). */
class Hp2 {
  constructor() {
    this.set(20);
    this.z1 = 0;
    this.z2 = 0;
  }
  set(f) {
    const w = (2 * Math.PI * Math.max(5, f)) / sampleRate;
    const cs = Math.cos(w);
    const al = Math.sin(w) / (2 * Math.SQRT1_2);
    const a0 = 1 + al;
    this.b0 = (1 + cs) / 2 / a0;
    this.b1 = -(1 + cs) / a0;
    this.b2 = this.b0;
    this.a1 = (-2 * cs) / a0;
    this.a2 = (1 - al) / a0;
  }
  clear() {
    this.z1 = 0;
    this.z2 = 0;
  }
  run(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

/** Le coefficient d'un pole a f Hz. */
const poleOf = (f) => Math.exp((-2 * Math.PI * f) / sampleRate);

/**
 * Le reseau de huit lignes. configure() pose les longueurs (structure), decay() les gains des trois bandes,
 * run(l, r) calcule un echantillon (sortie dans oL, oR).
 */
class Tank {
  constructor() {
    const k = sampleRate / 48000;
    this.k = k;
    this.lines = BASE.map((b) => new Line(Math.ceil(b * k * MAX_SCALE + 64 * k * MAX_SCALE + 8)));
    this.aps = AP_IN.map((b) => new Allpass(Math.ceil(b * k * 1.6 + 32)));
    this.len = new Float64Array(N);
    this.apLen = new Float64Array(N);
    this.gL = new Float64Array(N);
    this.gM = new Float64Array(N);
    this.gH = new Float64Array(N);
    this.sL = new Float64Array(N);
    this.sM = new Float64Array(N);
    this.ph1 = new Float64Array(N);
    this.ph2 = new Float64Array(N);
    this.dp1 = new Float64Array(N);
    this.dp2 = new Float64Array(N);
    this.y = new Float64Array(N);
    for (let i = 0; i < N; i += 1) {
      this.ph1[i] = (i * 0.37) % 1;
      this.ph2[i] = (i * 0.61 + 0.2) % 1;
    }
    this.depth = 0;
    this.apG = 0;
    this.aLow = poleOf(250);
    this.aHi = poleOf(4000);
    this.oL = 0;
    this.oR = 0;
    this.configure(1, 0, 0, 0.5);
    this.decay(2, 1, 1, 1);
  }
  clear() {
    for (const l of this.lines) l.clear();
    for (const a of this.aps) a.clear();
    this.sL.fill(0);
    this.sM.fill(0);
    this.y.fill(0);
    this.oL = 0;
    this.oR = 0;
  }
  /** scale : la taille (1 : 23 a 47 ms) ; apG : le passe-tout de chaque ligne ; depth : MOD (echantillons) ; rate (Hz). */
  configure(scale, apG, depth, rate) {
    const s = Math.max(0.12, Math.min(MAX_SCALE, scale));
    for (let i = 0; i < N; i += 1) {
      this.len[i] = BASE[i] * this.k * s;
      this.apLen[i] = Math.max(2, Math.round(AP_IN[i] * this.k * Math.min(1.6, Math.max(0.3, s))));
      this.aps[i].d = this.apLen[i];
      this.aps[i].g = apG;
    }
    this.apG = apG;
    this.setMod(depth, rate);
  }
  setMod(depth, rate) {
    this.depth = Math.max(0, Math.min(60 * this.k, depth));
    for (let i = 0; i < N; i += 1) {
      const r1 = rate * (0.62 + 0.11 * i);
      const r2 = rate * (1.37 + 0.083 * ((i * 5) % 8));
      this.dp1[i] = r1 / sampleRate;
      this.dp2[i] = r2 / sampleRate;
    }
  }
  /** t60 (s), et les multiplicateurs des graves, des mediums et des aigus ; fLow, fHi : les separations (Hz). */
  decay(t60, low, mid, hi, fLow = 250, fHi = 4500) {
    this.aLow = poleOf(fLow);
    this.aHi = poleOf(Math.min(0.4 * sampleRate, fHi));
    const t = Math.max(0.05, t60);
    for (let i = 0; i < N; i += 1) {
      // la longueur moyenne vue par la boucle : la ligne + son passe-tout (sa contribution au retard de groupe)
      const d = (this.len[i] + this.apLen[i] * (this.apG > 0 ? 1 : 0)) / sampleRate;
      const g = (m) => Math.min(0.99995, Math.pow(10, (-3 * d) / (t * Math.max(0.05, m))));
      this.gL[i] = g(low);
      this.gM[i] = g(mid);
      this.gH[i] = g(hi);
    }
  }
  run(inL, inR) {
    const y = this.y;
    const aL = 1 - this.aLow;
    const aH = 1 - this.aHi;
    const dep = this.depth;
    let sum = 0;
    let oL = 0;
    let oR = 0;
    for (let i = 0; i < N; i += 1) {
      let p1 = this.ph1[i] + this.dp1[i];
      if (p1 >= 1) p1 -= 1;
      let p2 = this.ph2[i] + this.dp2[i];
      if (p2 >= 1) p2 -= 1;
      this.ph1[i] = p1;
      this.ph2[i] = p2;
      const mod = dep > 0 ? dep * (0.62 * Math.sin(6.283185307179586 * p1) + 0.38 * Math.sin(6.283185307179586 * p2)) : 0;
      let r = this.lines[i].readF(this.len[i] + dep + mod + 2);
      if (this.apG > 0) r = this.aps[i].run(r);
      // trois bandes : graves (un pole a fLow), aigus (le reste au-dessus de fHi), mediums entre les deux
      const lo = (this.sL[i] += aL * (r - this.sL[i]));
      const rest = r - lo;
      const md = (this.sM[i] += aH * (rest - this.sM[i]));
      const v = this.gL[i] * lo + this.gM[i] * md + this.gH[i] * (rest - md);
      y[i] = v;
      sum += v;
      oL += v * OUT_L[i];
      oR += v * OUT_R[i];
    }
    const h = sum * (2 / N);
    for (let i = 0; i < N; i += 1) {
      let x = y[i] - h + (i & 1 ? inR : inL) * INJ[i];
      // un filet : jamais de montee sans fin (une reinjection SHIMMER, une entree saturee), le son normal n'y touche pas
      if (x > 4 || x < -4) x = 4 * Math.tanh(x * 0.25);
      this.lines[i].write(x + TINY);
    }
    this.oL = oL * 0.35355;
    this.oR = oR * 0.35355;
  }
}

/**
 * Les reflexions d'une piece rectangulaire (sources images, ordres 1 et 2 sur les murs, sol et plafond a l'ordre 1) :
 * w, l, h (m) ; src, lst ([x, y], m) ; beta : ce que renvoie un mur ; max : la derniere prise (s). Renvoie des prises
 * { d (echantillons apres le son direct), gl, gr }, triees.
 */
function imageTaps(w, l, h, src, lst, beta, max) {
  const out = [];
  const ears = [
    [lst[0] - 0.09, lst[1]],
    [lst[0] + 0.09, lst[1]],
  ];
  const zS = 1.1;
  const zL = 1.2;
  const d0 = Math.hypot(src[0] - lst[0], src[1] - lst[1], zS - zL);
  const add = (ix, iy, iz, order) => {
    const g = [0, 0];
    let dm = 0;
    for (let e = 0; e < 2; e += 1) {
      const dx = ix - ears[e][0];
      const dy = iy - ears[e][1];
      const d = Math.hypot(dx, dy, iz - zL);
      // l'ombre de la tete : l'oreille tournee vers la source entend un peu plus
      const side = e === 0 ? -dx / d : dx / d;
      g[e] = (d0 / d) * Math.pow(beta, order) * (0.72 + 0.28 * side);
      dm += d / 2;
    }
    const t = (dm - d0) / 343;
    if (t > 0.0005 && t < max) out.push({ d: t * sampleRate, gl: g[0], gr: g[1] });
  };
  const img = (n, s, L) => (n % 2 === 0 ? n * L + s : (n + 1) * L - s);
  for (let mx = -2; mx <= 2; mx += 1) {
    for (let my = -2; my <= 2; my += 1) {
      const o = Math.abs(mx) + Math.abs(my);
      if (o === 0 || o > 2) continue;
      add(img(mx, src[0], w), img(my, src[1], l), zS, o);
    }
  }
  // sol et plafond
  add(src[0], src[1], -zS, 1);
  add(src[0], src[1], 2 * h - zS, 1);
  out.sort((a, b) => a.d - b.d);
  return out;
}

/** Les douze machines, dans l'ordre du selecteur TYPE du BigSky (voyager/sky.ts SKY_MACHINES). */
const ROOM = 0;
const HALL = 1;
const PLATE = 2;
const SPRING = 3;
const SWELL = 4;
const BLOOM = 5;
const CLOUD = 6;
const CHORALE = 7;
const SHIMMER = 8;
const MAGNETO = 9;
const NONLINEAR = 10;
const REFLECTIONS = 11;

/** Les voyelles de CHORALE : F1 F2 F3 (Hz) et leurs niveaux. */
const VOWELS = {
  a: [730, 1090, 2440, 1, 0.55, 0.3],
  o: [570, 840, 2410, 1, 0.45, 0.22],
  u: [300, 870, 2240, 1, 0.3, 0.14],
};
/** VOWEL : les paires de voyelles entre lesquelles le choeur glisse (-1 : RANDOM). */
const VOWEL_SETS = [
  ['a', 'u'],
  ['a', 'a'],
  ['a', 'o'],
  ['o', 'o'],
  ['u', 'o'],
  ['u', 'u'],
  null,
];

/** SHAPE de NONLINEAR (t de 0 a 1 sur TIME) : SWOOSH, REVERSE, RAMP, GATE, GAUSS, BOUNCE. */
const NL_SHAPES = [
  (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.6) * (0.3 + 0.7 * t),
  (t) => t * t,
  (t) => 0.15 + 0.85 * t,
  () => 1,
  (t) => Math.exp(-Math.pow((t - 0.42) / 0.2, 2)),
  (t) => 0.12 + 0.88 * (1 - Math.exp(-Math.pow((t - 0.5) / 0.22, 2))),
];
const NL_TAPS = 32;

/** Un transpositeur a deux lectures fenetrees (sin^2) sur une ligne ; ratio : le rapport de hauteur. */
class Shifter {
  constructor(line, win) {
    this.l = line;
    this.win = win;
    this.ph = 0;
    this.ratio = 1;
  }
  run() {
    if (this.ratio === 1) return 0;
    const W = this.win;
    let ph = this.ph + (1 - this.ratio) / W;
    ph -= Math.floor(ph);
    this.ph = ph;
    let ph2 = ph + 0.5;
    if (ph2 >= 1) ph2 -= 1;
    const a = Math.sin(Math.PI * ph);
    const b = Math.sin(Math.PI * ph2);
    return a * a * this.l.readF(3 + ph * W) + b * b * this.l.readF(3 + ph2 * W);
  }
}

class MMSky extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const sr = sampleRate;
    const k = sr / 48000;
    this.k = k;
    this.tank = new Tank();
    this.pre = [new Line(Math.ceil(1.35 * sr)), new Line(Math.ceil(1.35 * sr))];
    this.dif = [DIFF_L.map((d) => new Allpass(Math.ceil(d * k * 1.3 + 8))), DIFF_R.map((d) => new Allpass(Math.ceil(d * k * 1.3 + 8)))];
    for (let c = 0; c < 2; c += 1) {
      const ds = c === 0 ? DIFF_L : DIFF_R;
      this.dif[c].forEach((a, i) => {
        a.d = Math.round(ds[i] * k);
      });
    }
    this.hp = [new Hp2(), new Hp2()];
    this.lp = [new Lp2(), new Lp2()];
    // SPRING : trois ressorts, 40 passe-tout du premier ordre chacun, leur boucle, ses filtres
    this.springs = [0, 1, 2].map((i) => ({
      line: new Line(Math.ceil(0.06 * sr)),
      ap: new Float64Array(40),
      fb: 0,
      lp: 0,
      hp: new Hp2(),
      D: [0.0331, 0.0387, 0.0423][i] * sr,
      g: 0,
      ph: i * 0.3,
    }));
    // BLOOM : quatre longs passe-tout reboucles
    this.bloom = [0.37, 0.53, 0.71, 1].map(() => new Allpass(Math.ceil(0.45 * sr)));
    this.bloomFb = 0;
    this.bloomLp = 0;
    // SHIMMER : une ligne par canal, deux voix
    this.shLine = [new Line(Math.ceil(0.2 * sr)), new Line(Math.ceil(0.2 * sr))];
    const W = Math.round(0.085 * sr);
    this.shift = [
      [new Shifter(this.shLine[0], W), new Shifter(this.shLine[0], W * 0.83)],
      [new Shifter(this.shLine[1], W * 0.91), new Shifter(this.shLine[1], W * 0.77)],
    ];
    this.shHp = [new Hp2(), new Hp2()];
    this.shLp = [new Lp2(), new Lp2()];
    this.shHp[0].set(180);
    this.shHp[1].set(180);
    this.shLp[0].set(9000);
    this.shLp[1].set(9000);
    this.shFbL = 0;
    this.shFbR = 0;
    // CHORALE : trois filtres a variables d'etat par canal
    this.svf = [new Float64Array(6), new Float64Array(6)];
    this.svfG = new Float64Array(3);
    this.svfLvl = new Float64Array(3);
    this.vPh = 0;
    this.vRand = [0, 0];
    this.vTarget = 0;
    this.vNow = 0;
    // MAGNETO : la bande, six tetes et leurs diffuseurs
    this.tape = new Line(Math.ceil(1.6 * sr));
    this.heads = new Float64Array(6);
    this.headAp = [0, 1, 2, 3, 4, 5].map(() => [new Allpass(Math.ceil(0.02 * sr)), new Allpass(Math.ceil(0.02 * sr))]);
    this.tapeFb = 0;
    this.tapeLp = 0;
    this.tapeHp = new Hp2();
    this.tapeHp.set(110);
    this.tapePh = 0;
    this.tapePh2 = 0;
    // NONLINEAR : la ligne, les gains des prises
    this.nlLine = new Line(Math.ceil(1.7 * sr));
    this.nlG = new Float64Array(NL_TAPS);
    this.nlD = new Float64Array(NL_TAPS);
    this.nlFb = 0;
    this.nlLp = 0;
    this.nlPh = 0;
    // Premieres reflexions (ROOM, HALL, REFLECTIONS)
    this.er = [];
    this.erPh = 0;
    // SWELL
    this.env = 0;
    this.quiet = 1;
    this.swell = 1;
    this.swArmed = true;
    // l'etat
    this.p = null;
    this.next = null;
    this.struct = '';
    this.fade = 1;
    this.fadeDir = 0;
    this.preCur = 0;
    this.idle = 0;
    this.blocks = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (!m) return;
      if (m.type === 'params' && m.p) this.next = m.p;
      else if (m.type === 'clear') this.clearAll();
    };
    const p0 = options && options.processorOptions && options.processorOptions.params;
    if (p0) {
      this.apply(p0, true);
    }
  }

  clearAll() {
    this.tank.clear();
    for (const l of this.pre) l.clear();
    for (const c of this.dif) for (const a of c) a.clear();
    for (const f of this.hp) f.clear();
    for (const f of this.lp) f.clear();
    for (const s of this.springs) {
      s.line.clear();
      s.ap.fill(0);
      s.fb = 0;
      s.lp = 0;
      s.hp.clear();
    }
    for (const a of this.bloom) a.clear();
    this.bloomFb = 0;
    this.bloomLp = 0;
    for (const l of this.shLine) l.clear();
    this.shFbL = 0;
    this.shFbR = 0;
    for (const f of this.shHp) f.clear();
    for (const f of this.shLp) f.clear();
    this.svf[0].fill(0);
    this.svf[1].fill(0);
    this.tape.clear();
    for (const h of this.headAp) for (const a of h) a.clear();
    this.tapeFb = 0;
    this.tapeLp = 0;
    this.tapeHp.clear();
    this.nlLine.clear();
    this.nlFb = 0;
    this.nlLp = 0;
    this.env = 0;
    this.swell = 1;
    this.swArmed = true;
  }

  /** Ce qui demande un fondu (la structure) : la machine, et ce qui change les longueurs ou le nombre d'elements. */
  structOf(p) {
    return [p.algo, p.scale, p.springs, p.heads, p.uneven, p.roomW, p.roomL, p.srcX, p.srcY].join('|');
  }

  /** Les reglages : structure (au fondu, ou d'emblee) et le reste (tout de suite, les filtres et les gains glissent). */
  apply(p, now = false) {
    const s = this.structOf(p);
    if (!now && this.p && s !== this.struct) {
      // la structure change : le fondu descend, la suite viendra au bout
      this.pending = p;
      this.fadeDir = -1;
      return;
    }
    const restruct = s !== this.struct;
    this.struct = s;
    this.p = p;
    const sr = sampleRate;
    const algo = p.algo | 0;
    const scale = clampN(p.scale, 0.12, MAX_SCALE, 1);
    const mod = clampN(p.mod, 0, 1, 0.3);
    const depth = (mod <= 0.5 ? mod * 2 : 1 + (mod - 0.5) * 3) * (3 + 9 * Math.min(scale, 1.5)) * this.k;
    const rate = clampN(p.modRate, 0.05, 8, 0.6) * (mod > 0.5 ? 1 + (mod - 0.5) * 1.2 : 1);
    this.tank.configure(scale, clampN(p.apG, 0, 0.75, 0), depth, rate);
    const t60 = clampN(p.t60, 0.05, 60, 2);
    this.tank.decay(t60, clampN(p.lowMul, 0.2, 2, 1), clampN(p.midMul, 0.2, 2, 1), clampN(p.hiMul, 0.05, 1.2, 0.7), 260, clampN(p.hiHz, 600, 16000, 4500));
    this.hp[0].set(clampN(p.lowCut, 10, 600, 30));
    this.hp[1].set(clampN(p.lowCut, 10, 600, 30));
    this.lp[0].set(clampN(p.toneHz, 300, 22000, 8000));
    this.lp[1].set(clampN(p.toneHz, 300, 22000, 8000));
    this.preT = clampN(p.pre, 0, 1, 0) * sr;
    if (now || restruct) this.preCur = this.preT;
    const dg = clampN(p.diffusion, 0, 1, 0.7);
    const gIn = [0.75 * dg, 0.75 * dg, 0.625 * dg, 0.625 * dg];
    for (const c of this.dif) c.forEach((a, i) => (a.g = gIn[i]));
    // SPRING
    if (algo === SPRING) {
      const n = clampN(p.springs, 1, 3, 2) | 0;
      this.springs.forEach((sp, i) => {
        sp.on = i < n;
        const d = sp.D / sr;
        sp.g = Math.pow(10, (-3 * d) / Math.max(0.1, t60));
        sp.hp.set(clampN(p.lowCut, 10, 600, 60) * 1.4);
      });
      this.springLp = 1 - poleOf(Math.min(5200, clampN(p.toneHz, 300, 22000, 5000) * 0.9));
      this.drive = clampN(p.drive, 1, 20, 1);
    }
    // BLOOM
    if (algo === BLOOM) {
      const L = clampN(p.bloomLen, 0.02, 0.4, 0.15) * sr;
      [0.37, 0.53, 0.71, 1].forEach((f, i) => {
        this.bloom[i].d = Math.max(2, Math.round(L * f));
        this.bloom[i].g = 0.62;
      });
      this.bloomGain = clampN(p.bloomFb, 0, 0.92, 0.5);
    }
    // SHIMMER
    if (algo === SHIMMER) {
      const r1 = clampN(p.shift1, 0.25, 4, 2);
      const r2 = clampN(p.shift2, 0, 4, 0);
      this.shift[0][0].ratio = r1;
      this.shift[1][0].ratio = r1;
      this.shift[0][1].ratio = r2 > 0 ? r2 : 1;
      this.shift[1][1].ratio = r2 > 0 ? r2 : 1;
      this.shAmt = clampN(p.shAmt, 0, 1, 0.5);
      this.shMode = clampN(p.shMode, 0, 2, 1) | 0;
      this.shTwo = r2 > 0;
    }
    // CHORALE
    if (algo === CHORALE) {
      this.vSet = clampN(p.vowel, 0, 6, 0) | 0;
      this.vQ = clampN(p.q, 1, 30, 8);
    }
    // MAGNETO
    if (algo === MAGNETO) {
      const n = [3, 4, 6].includes(p.heads) ? p.heads : 4;
      const T = clampN(p.dTime, 0.04, 1.5, 0.4) * sr;
      const uneven = [0.23, 0.41, 0.58, 0.72, 0.87, 1];
      for (let i = 0; i < 6; i += 1) {
        const pos = p.uneven ? uneven[6 - n + i] ?? 1 : (i + 1) / n;
        this.heads[i] = i < n ? Math.max(3, pos * T) : 0;
        for (let j = 0; j < 2; j += 1) {
          const a = this.headAp[i][j];
          a.d = Math.max(2, Math.round((j === 0 ? 0.0071 : 0.0113) * sr * (0.8 + 0.08 * i)));
          a.g = 0.68 * clampN(p.diffusion, 0, 1, 0.5);
        }
      }
      this.nHeads = n;
      this.tapeGain = clampN(p.fb, 0, 0.95, 0.4);
      this.tapeLpA = 1 - poleOf(Math.min(6500, clampN(p.toneHz, 300, 22000, 5000)));
    }
    // NONLINEAR
    if (algo === NONLINEAR) {
      const T = clampN(p.nlTime, 0.05, 1.5, 0.3) * sr;
      const shape = NL_SHAPES[clampN(p.nlShape, 0, 5, 3) | 0];
      let e = 0;
      for (let i = 0; i < NL_TAPS; i += 1) {
        const t = (i + 0.5) / NL_TAPS;
        // une prise sur deux un peu decalee : pas de peigne regulier
        this.nlD[i] = Math.max(3, t * T * (1 + (i % 2 ? 0.013 : -0.011)));
        this.nlG[i] = shape(t);
        e += this.nlG[i] * this.nlG[i];
      }
      const norm = 1.25 / Math.sqrt(Math.max(1e-6, e));
      let sum = 0;
      for (let i = 0; i < NL_TAPS; i += 1) {
        this.nlG[i] *= norm;
        sum += this.nlG[i];
      }
      // la reinjection ramenee a la somme des prises (elles s'additionnent en phase dans les graves) : la boucle reste
      // sous FEEDBACK, jamais au-dessus de 1
      this.nlGain = clampN(p.fb, 0, 0.9, 0) / Math.max(1, 0.675 * sum);
      this.lateLevel = clampN(p.lateLevel, 0, 1, 0.3);
      this.nlRate = clampN(p.modRate, 0.05, 8, 0.6);
    }
    // Premieres reflexions
    if (restruct || now) {
      this.er = [];
      if (algo === ROOM || algo === HALL || algo === REFLECTIONS) {
        const w = clampN(p.roomW, 2, 80, 6);
        const l = clampN(p.roomL, 2, 80, 5);
        const h = clampN(p.roomH, 2, 25, 3);
        const src = [w * clampN(p.srcX, 0, 1, 0.5), l * clampN(p.srcY, 0, 1, 0.5)];
        const lst = [w * 0.5, l * clampN(p.lstY, 0, 1, 0.15)];
        const taps = imageTaps(w, l, h, src, lst, clampN(p.beta, 0.2, 0.98, 0.8), algo === REFLECTIONS ? 0.22 : 0.16);
        this.er = taps;
      }
    }
    this.erGain = clampN(p.erLevel, 0, 2, 0);
    this.tankGain = clampN(p.tankLevel, 0, 4, 1);
    this.outGain = clampN(p.gain, 0, 8, 1);
    this.rise = clampN(p.rise, 0.05, 5, 0.5);
    this.swellDry = p.swellDry === true;
    this.algo = algo;
  }

  /** CHORALE : les trois formants du moment (la voyelle glissee entre les deux du VOWEL, ou au hasard). */
  vowelCoefs(blockS) {
    const set = VOWEL_SETS[this.vSet];
    let A;
    let B;
    let x;
    if (set) {
      A = VOWELS[set[0]];
      B = VOWELS[set[1]];
      // la voyelle glisse au rythme de MOD (0.07 a 0.4 Hz)
      this.vPh += blockS * (0.07 + 0.33 * clampN(this.p.mod, 0, 1, 0.3));
      if (this.vPh >= 1) this.vPh -= 1;
      x = 0.5 - 0.5 * Math.cos(2 * Math.PI * this.vPh);
    } else {
      // RANDOM : une voyelle neuve toutes les 1.5 s environ, on y glisse
      this.vPh += blockS / 1.5;
      if (this.vPh >= 1) {
        this.vPh -= 1;
        this.vRand[0] = this.vRand[1];
        this.vRand[1] = Math.floor(Math.random() * 3);
      }
      const keys = ['a', 'o', 'u'];
      A = VOWELS[keys[this.vRand[0]]];
      B = VOWELS[keys[this.vRand[1]]];
      x = Math.min(1, this.vPh * 2.5);
      x = x * x * (3 - 2 * x);
    }
    for (let j = 0; j < 3; j += 1) {
      const f = A[j] + (B[j] - A[j]) * x;
      this.svfG[j] = Math.tan((Math.PI * Math.min(f, 0.45 * sampleRate)) / sampleRate);
      this.svfLvl[j] = A[j + 3] + (B[j + 3] - A[j + 3]) * x;
    }
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const oL = out[0];
    const oR = out[1] || out[0];
    const n = oL.length;
    const inp = inputs[0];
    const iL = inp && inp[0];
    const iR = inp && (inp[1] || inp[0]);
    if (this.next) {
      const p = this.next;
      this.next = null;
      this.apply(p);
    }
    if (!this.p) {
      oL.fill(0);
      if (oR !== oL) oR.fill(0);
      return true;
    }
    // Au repos : rien en entree, la queue eteinte depuis IDLE_S
    let peakIn = 0;
    if (iL) for (let i = 0; i < n; i += 1) peakIn = Math.max(peakIn, Math.abs(iL[i]), Math.abs(iR[i]));
    if (peakIn < 1e-7 && this.idle > IDLE_S * sampleRate && this.fadeDir === 0) {
      oL.fill(0);
      if (oR !== oL) oR.fill(0);
      return true;
    }
    const algo = this.algo;
    const tank = this.tank;
    const sr = sampleRate;
    if (algo === CHORALE) {
      this.vowelCoefs(n / sr);
      this.svfK = 1 / this.vQ;
    }
    const preA = 1 - Math.exp(-1 / (0.06 * sr));
    const fadeStep = 1 / FADE_N;
    const er = this.er;
    const nEr = er.length;
    const dif = this.dif;
    let peakOut = 0;
    for (let s = 0; s < n; s += 1) {
      let xL = iL ? iL[s] : 0;
      let xR = iL ? iR[s] : 0;
      xL = this.hp[0].run(xL);
      xR = this.hp[1].run(xR);
      // SWELL : le suiveur, arme sur le silence (-60 dB pendant 80 ms), la montee en RISE TIME
      if (algo === SWELL) {
        const a = Math.abs(xL) + Math.abs(xR);
        this.env += (a > this.env ? 0.02 : 0.0004) * (a - this.env);
        if (this.env < 0.001) {
          this.quiet += 1;
          if (this.quiet > 0.08 * sr) this.swArmed = true;
        } else this.quiet = 0;
        if (this.swArmed && this.env > 0.003) {
          this.swArmed = false;
          this.swell = 0;
        }
        if (this.swell < 1) this.swell = Math.min(1, this.swell + 1 / (this.rise * sr));
      }
      const sw = algo === SWELL ? Math.sin(0.5 * Math.PI * this.swell) ** 2 : 1;
      this.pre[0].write(xL);
      this.pre[1].write(xR);
      this.preCur += preA * (this.preT - this.preCur);
      // REFLECTIONS : MOD fait bouger le pre-delai (un chorus au hasard)
      let pd = this.preCur + 3;
      if (algo === REFLECTIONS && this.p.mod > 0) {
        this.erPh += 0.37 / sr;
        if (this.erPh >= 1) this.erPh -= 1;
        pd += this.p.mod * 0.0015 * sr * (0.5 + 0.5 * Math.sin(2 * Math.PI * this.erPh) * Math.sin(2 * Math.PI * this.erPh * 2.31));
      }
      let pL = this.pre[0].readF(pd);
      let pR = this.pre[1].readF(pd);
      let wL = 0;
      let wR = 0;
      // les premieres reflexions
      if (nEr > 0) {
        let eL = 0;
        let eR = 0;
        for (let j = 0; j < nEr; j += 1) {
          const t = er[j];
          const m = 0.5 * (this.pre[0].readF(pd + t.d) + this.pre[1].readF(pd + t.d));
          eL += m * t.gl;
          eR += m * t.gr;
        }
        wL += eL * this.erGain;
        wR += eR * this.erGain;
        // la queue part des reflexions (plus dense, et sans trou entre elles et elle)
        pL = 0.6 * pL + 0.5 * eL;
        pR = 0.6 * pR + 0.5 * eR;
      }
      if (algo === SPRING) {
        // le preampli (DWELL), mono vers les ressorts, chaque ressort sa place
        const dr = this.drive;
        const x = Math.tanh((0.5 * (pL + pR)) * dr) / Math.pow(dr, 0.72);
        let sL = 0;
        let sR = 0;
        const pans = [
          [1, 0.25],
          [0.25, 1],
          [0.7, 0.7],
        ];
        for (let i = 0; i < 3; i += 1) {
          const sp = this.springs[i];
          if (!sp.on) continue;
          let v = x + sp.fb;
          // la dispersion : 40 passe-tout du premier ordre (a = 0.72)
          const ap = sp.ap;
          for (let j = 0; j < 40; j += 2) {
            const y1 = -0.72 * v + ap[j];
            ap[j] = v + 0.72 * y1;
            const y2 = -0.72 * y1 + ap[j + 1];
            ap[j + 1] = y1 + 0.72 * y2;
            v = y2;
          }
          sp.line.write(v);
          sp.ph += (0.9 + 0.2 * i) / sr;
          if (sp.ph >= 1) sp.ph -= 1;
          const y = sp.line.readF(sp.D + this.p.mod * 6 * Math.sin(2 * Math.PI * sp.ph) + 4);
          sp.lp += this.springLp * (y - sp.lp);
          sp.fb = sp.g * sp.hp.run(sp.lp);
          sL += y * pans[i][0];
          sR += y * pans[i][1];
        }
        wL += sL * this.tankGain;
        wR += sR * this.tankGain;
      } else if (algo === MAGNETO) {
        // la bande : l'entree et la reinjection saturee, les tetes lues avec le pleurage (MOD)
        this.tapePh += 0.63 / sr;
        if (this.tapePh >= 1) this.tapePh -= 1;
        this.tapePh2 += 5.7 / sr;
        if (this.tapePh2 >= 1) this.tapePh2 -= 1;
        const wow = 1 + this.p.mod * (0.0035 * Math.sin(2 * Math.PI * this.tapePh) + 0.0007 * Math.sin(2 * Math.PI * this.tapePh2));
        const inT = 0.5 * (pL + pR) + this.tapeFb;
        this.tape.write(Math.tanh(inT * 0.9) / 0.9);
        let hL = 0;
        let hR = 0;
        let last = 0;
        let last2 = 0;
        const nh = this.nHeads;
        for (let i = 0; i < nh; i += 1) {
          let y = this.tape.readF(this.heads[i] * wow + 2);
          if (i === nh - 1) last = y;
          if (i === nh - 2) last2 = y;
          y = this.headAp[i][1].run(this.headAp[i][0].run(y));
          if (i % 2) hR += y;
          else hL += y;
        }
        const fbSrc = this.p.uneven ? 0.5 * (last + last2) : last;
        this.tapeLp += this.tapeLpA * (fbSrc - this.tapeLp);
        this.tapeFb = this.tapeGain * this.tapeHp.run(this.tapeLp);
        const hs = 1.4 / Math.sqrt(nh);
        hL *= hs;
        hR *= hs;
        tank.run(hL * 0.5, hR * 0.5);
        wL += hL + tank.oL * this.tankGain;
        wR += hR + tank.oR * this.tankGain;
      } else if (algo === NONLINEAR) {
        // diffusion, puis la ligne et ses 32 prises (SHAPE), la reinjection, la queue tardive
        let m = 0.5 * (pL + pR);
        m = dif[0][1].run(dif[0][0].run(m));
        m = dif[1][3].run(dif[1][2].run(m));
        this.nlLine.write(m + this.nlFb);
        this.nlPh += this.nlRate / sr;
        if (this.nlPh >= 1) this.nlPh -= 1;
        const jit = this.p.mod * 18 * this.k;
        let nL = 0;
        let nR = 0;
        for (let i = 0; i < NL_TAPS; i += 1) {
          const d = this.nlD[i] + 3 + (jit > 0 ? jit * (1 + Math.sin(2 * Math.PI * (this.nlPh + i * 0.137))) : 0);
          const y = this.nlLine.readF(d) * this.nlG[i];
          if (i & 1) {
            nR += y;
            nL += 0.35 * y;
          } else {
            nL += y;
            nR += 0.35 * y;
          }
        }
        this.nlLp += 0.35 * (0.5 * (nL + nR) - this.nlLp);
        this.nlFb = this.nlGain * this.nlLp;
        if (this.nlFb > 2 || this.nlFb < -2) this.nlFb = 2 * Math.tanh(this.nlFb / 2);
        tank.run(nL * 0.4, nR * 0.4);
        wL += nL + tank.oL * this.lateLevel * this.tankGain;
        wR += nR + tank.oR * this.lateLevel * this.tankGain;
      } else {
        // le reseau, et ce qui le precede selon la machine
        let dL = pL * sw;
        let dR = pR * sw;
        for (let j = 0; j < 4; j += 1) {
          dL = dif[0][j].run(dL);
          dR = dif[1][j].run(dR);
        }
        if (algo === BLOOM) {
          let b = 0.5 * (dL + dR) + this.bloomFb;
          for (let j = 0; j < 4; j += 1) b = this.bloom[j].run(b);
          this.bloomLp += 0.25 * (b - this.bloomLp);
          this.bloomFb = this.bloomGain * this.bloomLp;
          if (this.bloomFb > 3 || this.bloomFb < -3) this.bloomFb = 3 * Math.tanh(this.bloomFb / 3);
          dL = 0.35 * dL + b;
          dR = 0.35 * dR + b;
        }
        if (algo === SHIMMER) {
          // la ligne des transpositeurs : l'entree (INPUT), la queue (REGEN), ou les deux
          const md = this.shMode;
          const srcL = (md !== 1 ? dL : 0) + (md !== 0 ? this.shFbL : 0);
          const srcR = (md !== 1 ? dR : 0) + (md !== 0 ? this.shFbR : 0);
          this.shLine[0].write(srcL);
          this.shLine[1].write(srcR);
          let zL = this.shift[0][0].run();
          let zR = this.shift[1][0].run();
          if (this.shTwo) {
            zL = 0.7 * (zL + this.shift[0][1].run());
            zR = 0.7 * (zR + this.shift[1][1].run());
          }
          zL = this.shLp[0].run(this.shHp[0].run(zL)) * this.shAmt;
          zR = this.shLp[1].run(this.shHp[1].run(zR)) * this.shAmt;
          dL += zL;
          dR += zR;
        }
        tank.run(dL, dR);
        let tL = tank.oL;
        let tR = tank.oR;
        if (algo === SHIMMER) {
          // REGEN : la queue renvoyee aux transpositeurs, assez bas pour que chaque octave s'eteigne apres l'autre
          this.shFbL = Math.tanh(tL * 0.35);
          this.shFbR = Math.tanh(tR * 0.35);
        }
        if (algo === CHORALE) {
          // trois formants par canal (filtres a variables d'etat, sortie passe-bande), la queue en dessous
          const K = this.svfK;
          let cL = 0;
          let cR = 0;
          for (let c = 0; c < 2; c += 1) {
            const st = this.svf[c];
            const x = c === 0 ? tL : tR;
            let acc = 0;
            for (let j = 0; j < 3; j += 1) {
              const g = this.svfG[j];
              const a1 = 1 / (1 + g * (g + K));
              const v3 = x - st[2 * j + 1];
              const v1 = a1 * st[2 * j] + g * a1 * v3;
              const v2 = st[2 * j + 1] + g * v1;
              st[2 * j] = 2 * v1 - st[2 * j];
              st[2 * j + 1] = 2 * v2 - st[2 * j + 1];
              acc += v1 * K * this.svfLvl[j];
            }
            if (c === 0) cL = acc;
            else cR = acc;
          }
          const vq = Math.sqrt(this.vQ) * 0.9;
          tL = 0.3 * tL + cL * vq;
          tR = 0.3 * tR + cR * vq;
        }
        wL += tL * this.tankGain;
        wR += tR * this.tankGain;
        // SWLDRY : une copie du son qui monte devant la reverbe
        if (algo === SWELL && this.swellDry) {
          const s2 = Math.sin(0.5 * Math.PI * this.swell) ** 2;
          wL += xL * s2 * 0.8;
          wR += xR * s2 * 0.8;
        }
      }
      wL = this.lp[0].run(wL) * this.outGain;
      wR = this.lp[1].run(wR) * this.outGain;
      // le fondu d'un changement de structure
      if (this.fadeDir !== 0) {
        this.fade += this.fadeDir * fadeStep;
        if (this.fade <= 0) {
          this.fade = 0;
          this.clearAll();
          const p = this.pending;
          this.pending = null;
          this.struct = '';
          if (p) this.apply(p, true);
          this.fadeDir = 1;
        } else if (this.fade >= 1) {
          this.fade = 1;
          this.fadeDir = 0;
        }
      }
      if (this.fade < 1) {
        wL *= this.fade;
        wR *= this.fade;
      }
      if (!(wL === wL) || !(wR === wR)) {
        // un NaN ne passe jamais (une valeur absurde) : tout repart a zero
        this.clearAll();
        wL = 0;
        wR = 0;
      }
      oL[s] = wL;
      if (oR !== oL) oR[s] = wR;
      const a = Math.abs(wL) + Math.abs(wR);
      if (a > peakOut) peakOut = a;
    }
    if (peakIn < 1e-7 && peakOut < 1e-6) this.idle += n;
    else this.idle = 0;
    this.blocks += 1;
    return true;
  }
}

registerProcessor('mm-sky', MMSky);
