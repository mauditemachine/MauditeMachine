/**
 * Le son du MM-BASS (2026-10-07, Mika : "un generateur de bassline qui peut
 * descendre super bas pour faire de beaux SUBs ; j'aimerais que MM-BASS
 * puisse avoir la meme qualite de filtre que la TB-303 pour faire de
 * l'acid, voire exactement la meme"). Une voix monophonique, calculee deux
 * fois plus vite que le contexte (moins de repliement dans le filtre) ; la
 * hauteur, les enveloppes et la coupure a la cadence de controle (tous les
 * CTRL echantillons) :
 * - l'oscillateur : une dent de scie et un carre a bande limitee (polyBLEP),
 *   WAVE passe de l'un a l'autre ; la hauteur glisse (SLIDE, GLIDE) d'une
 *   note a la suivante sans relancer les enveloppes, comme la 303 ;
 * - le filtre : celui de la TB-303 d'apres Open303 (classe TeeBee : quatre
 *   poles couples comme son echelle a diodes, un passe-haut dans la boucle
 *   de retour), calcule deux fois plus vite que le contexte ; RESO va
 *   jusqu'au bord de l'auto-oscillation ;
 * - l'enveloppe du filtre (MEG) : attaque immediate, DECAY ; une note
 *   accentuee a sa decroissance courte et fixe (ACC DECAY), plus de
 *   profondeur, et le circuit d'accent de la 303 : une charge qui s'accumule
 *   d'un accent a l'autre (le "wow", jusqu'a SWEEP octaves), plus lente avec
 *   la resonance ;
 * - le VCA : tenu tant que la note l'est, un relachement court (RELEASE) ;
 *   l'accent pousse aussi le volume ;
 * - DRIVE apres le filtre ; le SUB, un sinus une octave sous la note (ou
 *   deux : SUB OCT), ajoute propre apres (il ne passe ni par le filtre ni par
 *   DRIVE : des basses pleines a toute resonance) ; TUNE accorde les deux.
 *
 * Les reglages fins sous le capot (2026-10-08, la refonte facon Monark) :
 * ACC DECAY, SWEEP, RELEASE, SUB OCT, TUNE etaient des constantes ; memes
 * lois que bass/params.ts, et leurs defauts redonnent exactement les
 * anciennes constantes (un message sans eux : le son d'avant). Un verrou de
 * DECAY sur un pas accentue l'emporte sur ACC DECAY (avant, l'accent
 * l'ignorait : le verrou ne faisait rien) ; sur une liaison ou une note
 * glissee, il change la decroissance de l'enveloppe qui continue.
 *
 * La machine Elektron (2026-10-08, Mika : "est-ce que le voice, est-ce que
 * le FX, est-ce que l'enveloppe") : onze reglages de plus, tous sans effet a
 * leur defaut (un rendu hors ligne du motif d'usine est identique a
 * l'echantillon pres), tous verrouillables par pas sauf ceux des effets
 * eux-memes :
 * - PW : la largeur du carre (50 % : le carre d'avant) ;
 * - KEY TRK : la coupure suit la hauteur qui sonne (glissee comprise),
 *   autour de fa diese 2 (la tonique) ;
 * - l'enveloppe de l'ampli : ATTACK (la constante de temps de la montee,
 *   2.5 ms : celle d'avant), puis AMP DECAY vers SUSTAIN (1 : tenue, comme
 *   avant), RELEASE ; une note glissee ne la relance pas (la 303) ;
 * - DELAY : un aller-retour gauche droite cale sur le tempo (DLY TIME en
 *   pas, DLY FB), son retour filtre (pas de boue sous 140 Hz, pas d'aigus
 *   au-dessus de 3.2 kHz) ;
 * - REVERB : un reseau de quatre lignes a retour (FDN, matrice de
 *   Householder) apres deux diffuseurs, REV SIZE sa duree (RT60), REV TONE
 *   l'amorti des aigus.
 * Les envois suivent les verrous du pas (lisses en 5 ms) ; un effet a zero
 * dont la queue s'est eteinte ne calcule plus rien (ses lignes sont videes).
 *
 * Le moteur MONARK (2026-10-09, Mika : "je veux vraiment un son a la MONARK
 * de Native Instruments ! BASS doit etre vraiment bon !", et le meme jour
 * "je bouge Drive pour le baisser au max et plus de son dans BASS") : une
 * voix de Minimoog Model D a cote de celle de la 303, MODE (fmode) choisit :
 * - LP24, LP12, LP6, BP (l'echelle) : OSC 1 (l'oscillateur d'avant, WAVE et
 *   PW), OSC 2 et OSC 3 (les six formes du Model D, RANGE en pieds, SEMI,
 *   FINE), NOISE (rose) -> le melangeur et ses niveaux -> DRIVE = LOAD (le
 *   melangeur pousse l'entree du filtre : le grognement du Moog vient de la,
 *   DANS le filtre) + FEEDBACK (la sortie renvoyee a l'entree, l'astuce du
 *   casque dans EXT IN) -> l'echelle de quatre poles a retard nul (ZDF,
 *   Zavalishin), chaque etage sature (tanh, linearise a l'etat d'avant :
 *   Mystran), les graves gardes a moitie dans la boucle -> la sortie du mode
 *   (le quatrieme etage, le deuxieme, le premier, la difference des deux
 *   premiers) -> le VCA (les contours du Model D : attaque de condensateur,
 *   decroissance vers SUSTAIN, relachement ; une note repart de son niveau,
 *   une note glissee ne repart pas) -> le demi-bande de moog.worklet.js
 *   (2x vers 1x) -> + SUB -> VOLUME -> un coupe-continu a 8 Hz (un 32'
 *   a OCTAVE -2 descend a 23 Hz) -> la garde -> DELAY, REVERB ;
 * - 303 : la voix d'avant, a l'echantillon pres (le meme oscillateur, le
 *   TeeBee, l'enveloppe et l'accent de la 303, DRIVE apres le filtre, le
 *   meme VCA, la moyenne de deux echantillons, le coupe-continu a 20 Hz) ;
 *   OSC 2, OSC 3, NOISE, FEEDBACK et DRIFT n'y entrent que s'ils sont
 *   au-dessus de 0. Deux differences voulues : DRIVE passe toujours par sa
 *   saturation (sous 0.00845, CC 0 et 1, elle sautait : plus fort de 2 a
 *   6 dB et sans borne), et les gardes ci-dessous.
 * Le passage de la 303 a l'echelle (ou l'inverse) se fond en 10 ms, d'un
 * mode de l'echelle a l'autre en 15 ms. Les gardes (le verrou NaN rendait la
 * machine muette jusqu'au rechargement) : chaque valeur d'un message ou d'un
 * verrou passe par num() (un nombre fini, borne a 0..1, sinon la valeur
 * d'avant ou celle d'heritage), un echantillon non fini ou au-dela de +-16
 * remet toute la voix a zero (heals, compte dans le rapport 'pos') ; DRIVE a
 * 0 laisse passer le melangeur a moitie : propre, jamais muet. Les defauts de
 * base sont les valeurs d'heritage (LEGACY : le son d'avant), bass/params.ts
 * ENGINE_IDS les envoie toutes. Silencieuse (pas de note, l'ampli eteint,
 * rien a venir dans ce bloc), l'echelle ne calcule plus rien.
 *
 * port, du fil principal :
 *   { type: 'params', p }              les 44 reglages de bass/params.ts ENGINE_IDS (0 a 1)
 *   { type: 'tempo', step }            la duree d'un pas (s) : le temps du DELAY
 *   { type: 'on', at, midi, acc, legato, lock }  une note a l'heure at du contexte (0 : tout de suite) ; legato :
 *                                      glisse depuis la note tenue, sans relancer les enveloppes ; lock : les
 *                                      verrous de son pas (2026-10-07, les parameter locks), null : les potards
 *   { type: 'lock', at, lock }         les verrous d'une liaison (la note continue, son son change)
 *   { type: 'off', at }                la note se relache a at
 *   { type: 'unseq', time }            les evenements programmes a time ou apres s'oublient (re-programmation)
 *   { type: 'stop' }                   tout se tait en 15 ms, plus rien de programme
 * vers le fil principal, ~25 fois par seconde tant que ca sonne :
 *   { type: 'pos', cut, env, gate, midi, peak, heals }  la coupure du moment (Hz), l'enveloppe du filtre, la note
 *                                      tenue, la crete, le nombre de remises a zero de la garde
 */

/*
 * Le modele de filtre TeeBee ci-dessous reprend Open303 :
 *
 * Copyright (c) Robin Schmidt
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

const OS = 2;
/** Les enveloppes, la hauteur et le filtre se recalculent tous les CTRL echantillons du contexte. */
const CTRL = 4;
const REPORT_EVERY = 1920;
/** KEY TRK : la note de reference (fa diese 2, la tonique du site), en log de Hz. */
const KT_REF = Math.log(440 * Math.pow(2, (42 - 69) / 12));
/** DLY TIME : les pas de chaque cran (1/16, 1/8, 3/16, 1/4, 3/8, 1/2), comme bass/params.ts DTIME_STEPS. */
const DTIME_STEPS = [1, 2, 3, 4, 6, 8];
/** Le DELAY : 2.2 s de memoire, le retour filtre, le niveau du retour. */
const DLY = { maxS: 2.2, lp: 3200, hp: 140, out: 0.85 };
/** La REVERB : les quatre lignes (s), les deux diffuseurs (s, gain), le niveau du retour. */
const REV = { lines: [0.0353, 0.0467, 0.0571, 0.0683], diff: [0.0047, 0.0036], g: 0.62, out: 0.42 };
/**
 * Un effet a zero s'endort quand rien n'y entre ni n'en sort sous ce niveau ce temps-la (s) ; le DELAY attend en plus
 * son temps (2026-10-08, revue : entre l'entree et la premiere repetition une ligne longue se tait, elle n'est pas vide).
 */
const FX_IDLE = { level: 1e-5, s: 0.4 };

/* ---------------- le moteur MONARK (2026-10-09) ---------------- */

/**
 * Le niveau de sortie de l'echelle (x VOLUME au carre) : le patch de depart (MM CLASSIC) sur la ligne de DARK DISCO
 * (le preset d'usine 0, 118 BPM, 4 mesures, la logique de seq.ts) monte a -11.3 dBFS a VOLUME 0.78, 2 dB sous le kick
 * (-9.3), la regle de Mika (mesure hors ligne le 2026-10-09 : -11.31 dBFS, RMS -23.3, -24.9 LUFS).
 */
const OUT_TRIM = 0.321;
/** Le SUB seul (les trois oscillateurs a 0, SUB a 1) monte a la crete du patch de depart au meme VOLUME (mesure : -11.30 dBFS). */
const SUB_K = 1.33;
/**
 * Le rattrapage de LOAD : x loadG^-MAKEUP. Mesure sur le patch de depart, DRIVE de 0 a 1 : 2.6 LU d'ecart au plus avec
 * 0.45, 3.2 avec 0.5, 3.8 avec 0.55 (la plus plate : 0.45).
 */
const MAKEUP = 0.45;
/** Les graves gardes dans la boucle (c de Valimaki) : le gain continu est (1 + c k) / (1 + k), -4.5 dB a EMPH 1 au lieu de -14.5. */
const BASS_COMP = 0.5;
/** k = 4.3 x EMPH : l'auto-oscillation vers EMPH 0.93 (RESO 0.953, CC 121). */
const K_EMPH = 4.3;
/** Les sorties de l'echelle ramenees au niveau de LP24 (mesure sur le prototype, la ligne de DARK DISCO). */
const TAP_RES = 0.12;
const LP6_GAIN = 0.8;
const BP_GAIN = 1.25;
/**
 * L'entree de l'echelle passe deux poles a 16 kHz (2026-10-09, mesure : les etages satures meles a une dent de scie
 * pleine bande replient ses harmoniques ultrasonores ; a 1760 Hz, coupure au maximum, LOAD 0.55, le hors-harmonique
 * tombe de -43 a -71 dB). Sous la coupure de l'echelle (6 kHz au plus au potard) il ne s'entend pas : -0.6 dB a 6 kHz.
 */
const PRE_HZ = 16000;
/** Le rapport cyclique des formes du Model D (0 TRI, 1 SHARK ou REV SAW, 2 SAW, 3 SQR, 4 WIDE, 5 NARROW). */
const DUTY = [0, 0, 0, 0.5, 0.3, 0.12];
/** RANGE : 32' 16' 8' 4', en octaves de la note (OSC 1 est toujours en 16'). */
const RANGE_OCT = [-1, 0, 1, 2];
/** DRIFT : l'erreur d'echelle de chaque oscillateur (cents par octave depuis fa diese 2, x DRIFT). */
const SCALE_ERR = [0, 0.4, -0.3];
/** STOP : la constante de temps du VCA, et le fondu de la sortie seche (10 ms, puis rien : sous -90 dBFS en 15 ms). */
const QUICK_S = 0.0015;
const STOP_S = 0.01;
/** Les fondus : 303 vers l'echelle, d'une sortie de l'echelle a l'autre ; le lissage des niveaux. */
const FADE_303_S = 0.01;
const FADE_TAP_S = 0.015;
const SMOOTH_S = 0.005;
/** Sous ce niveau de l'ampli a la note, elle part "a froid" : les phases repartent, les lissages sautent a leur cible. */
const QUIET = 0.02;
/**
 * Plus bas encore (-60 dB), apres un vrai silence : l'echelle, le retour, le contour du filtre, le demi-bande et le
 * coupe-continu repartent aussi de zero (ce qui restait de la note d'avant est sous -60 dB) ; une note apres un silence
 * sonne toujours pareil, et les verrous d'un pas ne debordent pas sur la note suivante.
 */
const COLD = 1e-3;
/** L'echelle se tait (plus rien a calculer) sous ce niveau d'ampli. */
const IDLE_LEVEL = 1e-5;
/** La garde : au-dela, la voix repart de zero. */
const GUARD = 16;

/**
 * Les valeurs d'heritage de chaque reglage du worklet (bass/params.ts legacy ?? def) : le son d'avant le 2026-10-09,
 * MODE 303 ; les defauts de base, et ce que prend une valeur illisible.
 */
const LEGACY = {
  cutoff: 0.32,
  reso: 0.62,
  envmod: 0.55,
  decay: 0.42,
  accent: 0.65,
  wave: 0,
  sub: 0.35,
  drive: 0.18,
  glide: 0.35,
  volume: 0.78,
  accdecay: Math.log(200 / 80) / Math.log(600 / 80),
  sweep: 0.55,
  release: Math.log(14 / 6) / Math.log(400 / 6),
  suboct: 0,
  tune: 0.5,
  pw: 0,
  keytrack: 0,
  attack: Math.log(2.5 / 0.5) / Math.log(1000 / 0.5),
  adecay: Math.log(400 / 20) / Math.log(4000 / 20),
  sustain: 1,
  delay: 0,
  dtime: 0.4,
  dfb: 0.5,
  reverb: 0,
  rsize: Math.log(2 / 0.3) / Math.log(8 / 0.3),
  rtone: Math.log(4000 / 800) / Math.log(12000 / 800),
  o1lvl: 1,
  o2wave: 0.4,
  o2range: 1 / 3,
  o2semi: 0.5,
  o2fine: 0.5,
  o2lvl: 0,
  o3wave: 0.6,
  o3range: 0,
  o3semi: 0.5,
  o3fine: 0.5,
  o3lvl: 0,
  noise: 0,
  feedback: 0,
  drift: 0,
  fmode: 1,
  fattack: 0,
  fsustain: 0,
  fpol: 0,
};
const KEYS = Object.keys(LEGACY);
/** Ce qu'un verrou ne bouge jamais (GLOBAL a l'ecran) : les reglages des effets, MODE, DRIFT. */
const NO_LOCK = { dtime: 1, dfb: 1, rsize: 1, rtone: 1, fmode: 1, drift: 1 };
const LOCK_KEYS = KEYS.filter((k) => !NO_LOCK[k]);

/** Une valeur sure : un nombre fini, borne a 0..1, sinon d. */
function num(v, d) {
  if (typeof v !== 'number' || v - v !== 0) return d;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Le filtre de la TB-303 : le modele "TeeBee" d'Open303 (Robin Schmidt,
 * licence MIT), une echelle de quatre poles couples comme les diodes du
 * circuit, un passe-haut a 150 Hz dans la boucle de retour (la 303 garde
 * ses basses quand la resonance monte) ; l'accord (b0) et le gain de
 * retour qui mene a l'auto-oscillation (k) suivent les ajustements
 * polynomiaux d'Open303, faits sur la frequence de coupure. r : la
 * resonance, de 0 a 1.
 */
class TeeBee {
  constructor(rate) {
    this.rate = rate;
    this.y1 = 0;
    this.y2 = 0;
    this.y3 = 0;
    this.y4 = 0;
    // Le passe-haut du retour (un pole, 150 Hz)
    const w = Math.tan((Math.PI * 150) / rate);
    this.hpA = (1 - w) / (1 + w);
    this.hpG = 1 / (1 + w);
    this.hpX = 0;
    this.hpY = 0;
    this.b0 = 0;
    this.k = 0;
    this.g = 1;
    this.fc = -1;
    this.r = -1;
    this.set(1000, 0);
  }
  set(fc, r) {
    if (fc === this.fc && r === this.r) return;
    this.fc = fc;
    this.r = r;
    const fx = fc / (this.rate * Math.SQRT2);
    this.b0 = (0.00045522346 + 6.1922189 * fx) / (1 + 12.358354 * fx + 4.4156345 * fx * fx);
    const k = fx * (fx * (fx * (fx * (fx * (fx + 7198.6997) - 5837.7917) - 476.47308) + 614.95611) + 213.87126) + 16.998792;
    let g = k / 17;
    g = (g - 1) * r + 1;
    g *= 1 + r;
    this.k = k * r;
    this.g = g;
  }
  run(x) {
    const fbIn = this.k * this.y4;
    const hp = this.hpG * (fbIn - this.hpX) + this.hpA * this.hpY;
    this.hpX = fbIn;
    this.hpY = hp;
    let y0 = x - hp;
    // Une saturation douce a l'entree (les diodes), loin du signal normal
    y0 = fastTanh(y0 * 0.5) * 2;
    const b0 = this.b0;
    this.y1 += 2 * b0 * (y0 - this.y1 + this.y2);
    this.y2 += b0 * (this.y1 - 2 * this.y2 + this.y3);
    this.y3 += b0 * (this.y2 - 2 * this.y3 + this.y4);
    this.y4 += b0 * (this.y3 - 2 * this.y4);
    return 2 * this.g * this.y4;
  }
  reset() {
    this.y1 = 0;
    this.y2 = 0;
    this.y3 = 0;
    this.y4 = 0;
    this.hpX = 0;
    this.hpY = 0;
  }
}

/** Correction polyBLEP d'une discontinuite (t : phase 0 a 1, dt : pas de phase). */
function blep(t, dt) {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

const expMap = (v, lo, hi) => lo * Math.pow(hi / lo, Math.min(1, Math.max(0, v)));
/** Des ms en secondes, a la microseconde pres (le defaut retombe pile sur l'ancienne constante : 0.2, 0.014). */
const msToS = (ms) => Math.round(ms * 1000) / 1e6;

/** tanh, approche rationnelle (assez juste pour une saturation, bien moins chere) ; l'echelle s'en sert telle quelle (1 : ou elle plie). */
function fastTanh(x) {
  if (x > 3) return 1;
  if (x < -3) return -1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}

/** La pente moyenne de la saturation entre a et b (fa, fb : leurs tanh) : la transconductance d'un etage de l'echelle. */
function tq(a, b, fa, fb) {
  const d = a - b;
  if (d > 1e-6 || d < -1e-6) return (fa - fb) / d;
  const s = 1 - fa * fa;
  return s > 0.05 ? s : 0.05;
}

/**
 * Une forme du Model D (OSC 2, OSC 3 ; t : la phase, dt : son pas) : 0 TRI, 1 SHARK (moitie triangle, moitie dent de
 * scie ; OSC 3 : REV SAW, la dent de scie montante), 2 SAW, 3 SQR, 4 WIDE, 5 NARROW (impulsions a 50, 30 et 12 %, sans
 * composante continue). Le triangle est naif : a 96 kHz son repliement reste sous -80 dB.
 */
function shape(w, t, dt, rev) {
  switch (w) {
    case 0: {
      let q = t + 0.25;
      if (q >= 1) q -= 1;
      return 1 - 4 * Math.abs(q - 0.5);
    }
    case 1: {
      const saw = 2 * t - 1 - blep(t, dt);
      if (rev) return -saw;
      let q = t + 0.25;
      if (q >= 1) q -= 1;
      return 0.5 * (1 - 4 * Math.abs(q - 0.5)) + 0.5 * saw;
    }
    case 2:
      return 2 * t - 1 - blep(t, dt);
    default: {
      const d = DUTY[w];
      let y = t < d ? 1 : -1;
      y += blep(t, dt);
      let t2 = t - d;
      if (t2 < 0) t2 += 1;
      y -= blep(t2, dt);
      return y - (2 * d - 1);
    }
  }
}

/* Le demi-bande de moog.worklet.js (copie : un worklet charge par ?url ne peut rien importer). */

/** Bessel I0 (serie), pour la fenetre de Kaiser. */
function besselI0(x) {
  let sum = 1;
  let term = 1;
  for (let k = 1; k < 40; k += 1) {
    term *= (x / (2 * k)) * (x / (2 * k));
    sum += term;
    if (term < 1e-12 * sum) break;
  }
  return sum;
}

/** Le filtre demi-bande (coupure au quart de sa frequence d'entree), gain 1 en continu. */
function halfband(taps, beta) {
  const c = (taps - 1) / 2;
  const h = new Float64Array(taps);
  const i0b = besselI0(beta);
  let sum = 0;
  for (let k = 0; k < taps; k += 1) {
    const n = k - c;
    const ideal = n === 0 ? 0.5 : Math.sin((Math.PI * n) / 2) / (Math.PI * n);
    const r = n / c;
    const w = besselI0(beta * Math.sqrt(Math.max(0, 1 - r * r))) / i0b;
    h[k] = ideal * w;
    sum += h[k];
  }
  for (let k = 0; k < taps; k += 1) h[k] /= sum;
  // Seuls le centre et les rangs impairs comptent (les autres sont nuls)
  const idx = [];
  for (let k = 0; k < taps; k += 1) if (Math.abs(h[k]) > 1e-12) idx.push(k);
  return { h, idx: Int32Array.from(idx) };
}

/** Un etage de decimation par 2 : le demi-bande, puis un echantillon sur deux ; garde son historique. */
class Decimator {
  constructor(taps, beta) {
    const hb = halfband(taps, beta);
    this.h = hb.h;
    this.idx = hb.idx;
    this.T = taps - 1;
    this.buf = new Float32Array(this.T + 1024);
  }
  /** n2 echantillons de input -> n2 / 2 dans out. */
  run(input, n2, out) {
    const T = this.T;
    if (this.buf.length < T + n2) {
      const grown = new Float32Array(T + n2);
      grown.set(this.buf.subarray(0, T));
      this.buf = grown;
    }
    const b = this.buf;
    b.set(input.subarray(0, n2), T);
    const h = this.h;
    const idx = this.idx;
    const n = n2 >> 1;
    for (let i = 0; i < n; i += 1) {
      const base = T + 2 * i + 1;
      let y = 0;
      for (let j = 0; j < idx.length; j += 1) {
        const k = idx[j];
        y += h[k] * b[base - k];
      }
      out[i] = y;
    }
    b.copyWithin(0, n2, n2 + T);
  }
  clear() {
    this.buf.fill(0, 0, this.T);
  }
}

/**
 * L'echelle du Moog (2026-10-09) : quatre etages a integrateur trapezoidal (prewarp : la coupure est exacte), la
 * boucle de retour resolue sans retard (Zavalishin, ZDF) ; chaque etage sature (son gain est la pente moyenne du tanh
 * entre son entree et son etat, prise une fois par echantillon du contexte a l'etat d'avant : Mystran), si bien qu'un
 * melangeur pousse fort (LOAD) arrondit les attaques et comprime la resonance, et que l'auto-oscillation se borne
 * d'elle-meme. Les graves gardes dans la boucle (u = (x (1 + c k) - k S) / (1 + k G4)). y1, y2 : les deux premiers
 * etages (LP6, LP12, BP), run() rend le quatrieme (LP24). En unites du tanh (1 : ou il plie).
 */
class Ladder {
  constructor() {
    this.reset();
  }
  reset() {
    this.s1 = 0;
    this.s2 = 0;
    this.s3 = 0;
    this.s4 = 0;
    this.pu = 0;
    this.y1 = 0;
    this.y2 = 0;
    this.Ga = 0;
    this.Gb = 0;
    this.Gc = 0;
    this.Gd = 0;
    this.c1 = 0;
    this.c2 = 0;
    this.c3 = 0;
    this.c4 = 1;
    this.k = 0;
    this.ck1 = 1;
    this.inv = 1;
  }
  /** Les gains des etages pour la coupure g = tan(pi fc / R) et le retour k, a l'etat du moment. */
  lin(g, k) {
    const pu = this.pu;
    const s1 = this.s1;
    const s2 = this.s2;
    const s3 = this.s3;
    const s4 = this.s4;
    const fu = fastTanh(pu);
    const f1 = fastTanh(s1);
    const f2 = fastTanh(s2);
    const f3 = fastTanh(s3);
    const f4 = fastTanh(s4);
    let t = g * tq(pu, s1, fu, f1);
    const Ga = t / (1 + t);
    t = g * tq(s1, s2, f1, f2);
    const Gb = t / (1 + t);
    t = g * tq(s2, s3, f2, f3);
    const Gc = t / (1 + t);
    t = g * tq(s3, s4, f3, f4);
    const Gd = t / (1 + t);
    this.Ga = Ga;
    this.Gb = Gb;
    this.Gc = Gc;
    this.Gd = Gd;
    this.c4 = 1 - Gd;
    this.c3 = Gd * (1 - Gc);
    this.c2 = Gd * Gc * (1 - Gb);
    this.c1 = Gd * Gc * Gb * (1 - Ga);
    this.k = k;
    this.ck1 = 1 + BASS_COMP * k;
    this.inv = 1 / (1 + k * Ga * Gb * Gc * Gd);
  }
  run(x) {
    let s1 = this.s1;
    let s2 = this.s2;
    let s3 = this.s3;
    let s4 = this.s4;
    const S = this.c1 * s1 + this.c2 * s2 + this.c3 * s3 + this.c4 * s4;
    const u = (x * this.ck1 - this.k * S) * this.inv;
    this.pu = u;
    let v = (u - s1) * this.Ga;
    const y1 = v + s1;
    s1 = y1 + v;
    v = (y1 - s2) * this.Gb;
    const y2 = v + s2;
    s2 = y2 + v;
    v = (y2 - s3) * this.Gc;
    const y3 = v + s3;
    s3 = y3 + v;
    v = (y3 - s4) * this.Gd;
    const y4 = v + s4;
    s4 = y4 + v;
    this.s1 = s1;
    this.s2 = s2;
    this.s3 = s3;
    this.s4 = s4;
    this.y1 = y1;
    this.y2 = y2;
    return y4;
  }
}

/**
 * Le DELAY (2026-10-08) : un aller-retour, la gauche repete l'entree, la
 * droite repete la gauche, et ainsi de suite ; le retour passe un passe-bas
 * et un passe-haut a un pole. run(x) rend la sortie mouillee dans outL, outR.
 */
class PingPong {
  constructor(rate) {
    this.rate = rate;
    this.len = Math.ceil(DLY.maxS * rate) + 2;
    this.l = new Float32Array(this.len);
    this.r = new Float32Array(this.len);
    this.w = 0;
    this.d = Math.round(0.3 * rate);
    this.fb = 0.45;
    this.aLp = 1 - Math.exp((-2 * Math.PI * DLY.lp) / rate);
    this.aHp = 1 - Math.exp((-2 * Math.PI * DLY.hp) / rate);
    this.lpL = 0;
    this.lpR = 0;
    this.hpL = 0;
    this.hpR = 0;
    this.outL = 0;
    this.outR = 0;
    /** ce qui vient d'entrer dans les lignes et d'en sortir (le sommeil le surveille) */
    this.lvl = 0;
  }
  setTime(s) {
    this.d = Math.max(1, Math.min(this.len - 2, Math.round(s * this.rate)));
  }
  run(x) {
    const len = this.len;
    let ri = this.w - this.d;
    if (ri < 0) ri += len;
    const yl = this.l[ri];
    const yr = this.r[ri];
    // Le retour filtre (gauche vers droite, droite vers gauche)
    this.lpL += (yl - this.lpL) * this.aLp;
    this.hpL += (this.lpL - this.hpL) * this.aHp;
    this.lpR += (yr - this.lpR) * this.aLp;
    this.hpR += (this.lpR - this.hpR) * this.aHp;
    const wl = x + this.fb * (this.lpR - this.hpR);
    const wr = this.fb * (this.lpL - this.hpL);
    this.l[this.w] = wl;
    this.r[this.w] = wr;
    this.w += 1;
    if (this.w >= len) this.w = 0;
    this.outL = yl * DLY.out;
    this.outR = yr * DLY.out;
    this.lvl = Math.abs(wl) + Math.abs(wr) + Math.abs(yl) + Math.abs(yr);
  }
  clear() {
    this.l.fill(0);
    this.r.fill(0);
    this.lpL = this.lpR = this.hpL = this.hpR = 0;
    this.outL = this.outR = 0;
    this.lvl = 0;
  }
}

/**
 * La REVERB (2026-10-08) : deux diffuseurs en serie (des passe-tout), puis
 * quatre lignes qui se renvoient leur son par une matrice de Householder,
 * chacune amortie (REV TONE) et attenuee pour durer REV SIZE (RT60).
 */
class Fdn {
  constructor(rate) {
    this.rate = rate;
    this.lines = REV.lines.map((s) => {
      const n = Math.max(8, Math.round(s * rate));
      return { buf: new Float32Array(n), n, w: 0, g: 0.8, lp: 0 };
    });
    this.diff = REV.diff.map((s) => {
      const n = Math.max(4, Math.round(s * rate));
      return { buf: new Float32Array(n), n, w: 0 };
    });
    this.aTone = 0.5;
    this.outL = 0;
    this.outR = 0;
    /** ce qui entre dans les lignes et en sort, chacune (deux sorties ne s'annulent pas en silence) */
    this.lvl = 0;
    this.set(2, 4000);
  }
  set(rt60, toneHz) {
    for (const ln of this.lines) ln.g = Math.pow(10, (-3 * (ln.n / this.rate)) / Math.max(0.1, rt60));
    this.aTone = 1 - Math.exp((-2 * Math.PI * toneHz) / this.rate);
  }
  run(x) {
    // Les diffuseurs : y = -g x + d, d' = x + g y
    let s = x;
    for (const df of this.diff) {
      const d = df.buf[df.w];
      const y = -REV.g * s + d;
      df.buf[df.w] = s + REV.g * y;
      df.w += 1;
      if (df.w >= df.n) df.w = 0;
      s = y;
    }
    const L = this.lines;
    const y0 = L[0].buf[L[0].w];
    const y1 = L[1].buf[L[1].w];
    const y2 = L[2].buf[L[2].w];
    const y3 = L[3].buf[L[3].w];
    const a = this.aTone;
    L[0].lp += (y0 - L[0].lp) * a;
    L[1].lp += (y1 - L[1].lp) * a;
    L[2].lp += (y2 - L[2].lp) * a;
    L[3].lp += (y3 - L[3].lp) * a;
    const h = 0.5 * (L[0].lp + L[1].lp + L[2].lp + L[3].lp);
    for (let k = 0; k < 4; k += 1) {
      const ln = L[k];
      ln.buf[ln.w] = s + ln.g * (ln.lp - h);
      ln.w += 1;
      if (ln.w >= ln.n) ln.w = 0;
    }
    this.outL = (y0 + y2) * REV.out;
    this.outR = (y1 + y3) * REV.out;
    this.lvl = Math.abs(s) + Math.abs(y0) + Math.abs(y1) + Math.abs(y2) + Math.abs(y3);
  }
  clear() {
    for (const ln of this.lines) {
      ln.buf.fill(0);
      ln.lp = 0;
    }
    for (const df of this.diff) df.buf.fill(0);
    this.outL = this.outR = 0;
    this.lvl = 0;
  }
}

class MMBass extends AudioWorkletProcessor {
  constructor() {
    super();
    this.R = sampleRate * OS;
    this.ladder = new TeeBee(this.R);
    // Les potards (base) ; les verrous du pas qui joue par-dessus (lock) ; p : ce qui sonne. Les defauts de base : les
    // valeurs d'heritage (2026-10-09 ; avant, des defauts perimes : un reglage jamais envoye sonnait faux sans bruit)
    this.base = { ...LEGACY };
    this.stepS = 60 / 120 / 4;
    this.dly = new PingPong(sampleRate);
    this.rev = new Fdn(sampleRate);
    // Les envois du moment (lisses), si chaque effet calcule, depuis quand sa queue est eteinte (echantillons)
    this.dS = 0;
    this.rS = 0;
    this.dlyOn = false;
    this.revOn = false;
    this.dlyQuiet = 0;
    this.revQuiet = 0;
    // Les reglages des effets du dernier calcul (des nombres : plus de chaine allouee a chaque verrou)
    this.fxDs = -1;
    this.fxDfb = -1;
    this.fxRsize = -1;
    this.fxRtone = -1;
    this.fxStep = -1;
    // L'enveloppe de l'ampli : la montee faite, le niveau vise pendant la decroissance
    this.ampDecaying = false;
    this.ampLvl = 1;
    this.lock = null;
    this.p = { ...LEGACY };
    // Le moteur MONARK (2026-10-09) : l'echelle, son decimateur, les tampons d'un bloc (rien d'alloue dans process)
    this.lad = new Ladder();
    this.dec = new Decimator(31, 7);
    this.raw = new Float32Array(128 * OS);
    this.decOut = new Float32Array(128);
    this.dryA = new Float64Array(128);
    this.dryB = new Float64Array(128);
    this.subB = new Float64Array(128);
    this.sendD = new Float64Array(128);
    this.sendR = new Float64Array(128);
    // DRIFT : la marche de chaque oscillateur et du filtre (cents ; filtre : centiemes d'octave), le hasard a graine
    // fixe (deux rendus des memes notes sont identiques), le bruit a part
    this.drift = new Float64Array(4);
    this.seed = 0x6d2b79f5;
    this.nseed = 0x2545f491;
    this.pk0 = 0;
    this.pk1 = 0;
    this.pk2 = 0;
    this.noteCents = 0;
    this.noteCut = 1;
    // Le poids de chaque sortie de l'echelle (LP24, LP12, LP6, BP), en fondu
    this.wm = new Float64Array(4);
    this.lmode = 0;
    this.mode = 4;
    this.acc = 0;
    this.h303 = new Float64Array(14);
    this.derive();
    this.phase = 0;
    this.subPhase = 0;
    this.logF = Math.log(55);
    this.logT = this.logF;
    this.midi = -1;
    this.gate = false;
    this.vca = 0;
    this.env = 0;
    this.envTau = 0.3;
    this.acc = 0;
    this.accEnv = 0;
    this.accSweep = 0;
    this.glideOn = false;
    // Les phases d'OSC 2 et OSC 3 dans la 303 (a part : pendant un fondu les deux voix tournent)
    this.q2 = 0.5;
    this.q3 = 0.5;
    this.d2 = 0.001;
    this.d3 = 0.001;
    this.queue = [];
    this.since = 0;
    this.active = false;
    this.dc = { x: 0, y: 0 };
    this.lastCut = 0;
    // L'echelle : sa hauteur (elle glisse a son rythme), ses phases, ses contours, ses lissages
    this.lF = this.logF;
    this.ph1 = 0.5;
    this.ph2 = 0.5;
    this.ph3 = 0.5;
    this.dt1 = 0.001;
    this.dt2 = 0.001;
    this.dt3 = 0.001;
    this.fe = 0;
    this.ae = 0;
    this.fSt = 3;
    this.aSt = 3;
    this.aEnvL = 0;
    this.aSwL = 0;
    this.g = 0.01;
    this.gStep = 0;
    this.fbY = 0;
    this.fb3 = 0;
    this.subPhL = 0;
    this.subInc = 0;
    this.dcLX = 0;
    this.dcLY = 0;
    this.pf1 = 0;
    this.pf2 = 0;
    this.pfK = 1 - Math.exp((-2 * Math.PI * PRE_HZ) / this.R);
    this.dirtyL = true;
    this.snap();
    // La voix qui joue : la 303 (x303 = 1), l'echelle (0), entre les deux pendant le fondu
    this.x303 = this.mode === 4 ? 1 : 0;
    this.on303 = this.mode === 4;
    this.onLad = this.mode !== 4;
    this.wm[this.lmode] = 1;
    this.lIdle = false;
    this.heals = 0;
    // STOP : le fondu de la sortie seche (1 : rien), en cours
    this.stopG = 1;
    this.stopping = false;
    // Une note a froid dans ce bloc (son rang, -1 : aucune) ; le rang du segment en cours
    this.cold = -1;
    this.segI = 0;
    this.port.onmessage = (e) => this.onMsg(e.data);
  }

  /** Le hasard a graine fixe (xorshift32), de 0 a 1. */
  rand() {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x;
    return (x >>> 0) / 4294967296;
  }

  /** Les grandeurs des reglages. */
  derive() {
    const p = this.p;
    // CUTOFF : de 60 Hz a 6 kHz ; ENVMOD : jusqu'a cinq octaves ; DECAY : 120 ms a 2.5 s
    this.cutBase = expMap(p.cutoff, 60, 6000);
    this.envOct = 5 * p.envmod;
    this.decayS = expMap(p.decay, 0.12, 2.5);
    // RESO : de 0 a 1, plus fin en haut (la courbe d'Open303)
    const rr = Math.min(1, Math.max(0, p.reso));
    this.res = (1 - Math.exp(-3 * rr)) / (1 - Math.exp(-3));
    this.accAmt = p.accent;
    this.glideS = expMap(p.glide, 0.012, 0.35);
    this.drive = 1 + 14 * p.drive * p.drive;
    // Le volume tenu a peu pres constant quand DRIVE monte (mesure hors ligne)
    this.driveNorm = 1 / Math.pow(this.drive, 0.45);
    // ACC DECAY : 80 a 600 ms ; SWEEP : la charge des accents, 0 a 4 octaves ; RELEASE : 6 a 400 ms
    this.accDecayS = msToS(expMap(p.accdecay, 80, 600));
    this.sweepOct = 4 * Math.min(1, Math.max(0, p.sweep));
    this.releaseS = msToS(expMap(p.release, 6, 400));
    // SUB OCT : le sinus une octave sous la note (0.5) ou deux (0.25) ; TUNE : -50 a +50 cents (en log)
    this.subMul = p.suboct >= 0.5 ? 0.25 : 0.5;
    this.tuneLog = ((Math.min(1, Math.max(0, p.tune)) - 0.5) * 100 * Math.LN2) / 1200;
    // La machine Elektron (2026-10-08). PW : 50 a 95 % ; le second front du carre tombe a pwFrac (0.5 : comme avant)
    const c01 = (x) => Math.min(1, Math.max(0, x));
    this.pwFrac = 0.5 + 0.45 * c01(p.pw);
    this.pwOff = 1 - this.pwFrac;
    this.kt = c01(p.keytrack);
    // L'ampli : ATTACK 0.5 ms a 1 s (2.5 ms : l'ancienne constante, a la microseconde pres), AMP DECAY 20 ms a 4 s
    this.attackS = msToS(expMap(p.attack, 0.5, 1000));
    this.adecayS = msToS(expMap(p.adecay, 20, 4000));
    this.sus = c01(p.sustain);
    // Les envois, et les reglages des effets (globaux)
    this.dSend = c01(p.delay);
    this.rSend = c01(p.reverb);
    const ds = DTIME_STEPS[Math.max(0, Math.min(DTIME_STEPS.length - 1, Math.round(c01(p.dtime) * (DTIME_STEPS.length - 1))))];
    if (ds !== this.fxDs || p.dfb !== this.fxDfb || p.rsize !== this.fxRsize || p.rtone !== this.fxRtone || this.stepS !== this.fxStep) {
      this.fxDs = ds;
      this.fxDfb = p.dfb;
      this.fxRsize = p.rsize;
      this.fxRtone = p.rtone;
      this.fxStep = this.stepS;
      this.dly.setTime(ds * this.stepS);
      this.dly.fb = 0.9 * c01(p.dfb);
      this.rev.set(expMap(p.rsize, 0.3, 8), expMap(p.rtone, 800, 12000));
    }

    // Le moteur MONARK (2026-10-09) : les lois de bass/params.ts (les memes, recopiees)
    const fs = sampleRate;
    const mode = Math.round(p.fmode * 4);
    this.mode = mode;
    if (mode < 4) this.lmode = mode;
    const emph = Math.pow(p.reso, 1.5);
    this.emph = emph;
    this.tK = K_EMPH * emph;
    // ENV MOD : l'amplitude du contour en octaves, POLARITY NEG la retourne (la coupure plonge puis remonte)
    this.envOctL = (p.fpol >= 0.5 ? -1 : 1) * this.envOct;
    // Les contours du Model D : l'attaque vise 1.3 et atteint 1 en A (0.5 ms a 1 s) ; DECAY (filtre) : la constante de
    // temps 10 ms a 2.5 s, AMP DECAY 20 ms a 4 s, vers leur SUSTAIN ; RELEASE (les deux) : 6 a 400 ms
    const fA = 0.0005 * Math.pow(2000, p.fattack);
    const aA = 0.0005 * Math.pow(2000, p.attack);
    this.kfA = 1 - Math.exp(-1.466 / (fA * fs));
    this.kaA = 1 - Math.exp(-1.466 / (aA * fs));
    this.kfD = 1 - Math.exp(-1 / (0.01 * Math.pow(250, p.decay) * fs));
    this.kaD = 1 - Math.exp(-1 / (this.adecayS * fs));
    this.kR = 1 - Math.exp(-1 / (this.releaseS * fs));
    this.kQ = 1 - Math.exp(-1 / (QUICK_S * fs));
    this.fSus = p.fsustain;
    // LOAD (DRIVE) : le melangeur entre dans l'echelle a 0.5x (DRIVE 0 : propre, jamais muet) jusqu'a 4x (+18 dB),
    // rattrape en sortie (loadG^-MAKEUP)
    const loadG = 0.5 * Math.pow(8, p.drive);
    this.tLoad = loadG;
    this.tMk = Math.pow(loadG, -MAKEUP);
    this.tL1 = p.o1lvl;
    this.tL2 = p.o2lvl;
    this.tL3 = p.o3lvl;
    this.tN = p.noise * p.noise;
    this.tFb = p.feedback;
    this.tSub = p.sub * SUB_K;
    this.tVol = p.volume * p.volume * OUT_TRIM;
    this.tAcc = 1 + 0.3 * this.acc;
    this.driftAmt = p.drift;
    // OSC 2 et OSC 3 : la forme, l'octave (RANGE), SEMI (-7 a +7), FINE (+-50 cents), en un rapport a la note
    this.w2 = Math.round(p.o2wave * 5);
    this.w3 = Math.round(p.o3wave * 5);
    this.m2 = Math.pow(2, RANGE_OCT[Math.round(p.o2range * 3)] + (Math.round(p.o2semi * 14) - 7) / 12 + ((p.o2fine - 0.5) * 100) / 1200);
    this.m3 = Math.pow(2, RANGE_OCT[Math.round(p.o3range * 3)] + (Math.round(p.o3semi * 14) - 7) / 12 + ((p.o3fine - 0.5) * 100) / 1200);
    // GLIDE de l'echelle : un rythme constant (GLIDE = le temps d'une octave, Monark MM), la fin en douceur
    this.gRate = Math.LN2 / this.glideS / fs;
    this.gTail = Math.min(1, Math.max(1 - Math.exp(-1 / (0.005 * fs)), this.gRate / 0.0578));
    // Le circuit d'accent sur l'echelle : la charge suit ACC DECAY, plus lente avec l'emphase (comme la 303)
    this.kAccL = Math.exp(-CTRL / (this.accDecayS * fs));
    this.kSwL = 1 - Math.exp(-CTRL / ((0.03 + 0.12 * emph) * fs));
    // La 303 recoit OSC 2, OSC 3, NOISE, FEEDBACK seulement s'ils sont la (OSC 1 a 1 : le son d'avant)
    this.extra303 = p.o1lvl !== 1 || p.o2lvl > 0 || p.o3lvl > 0 || p.noise > 0 || p.feedback > 0;
  }

  /** Les lissages de l'echelle sur leur cible, d'un coup (une note a froid : ses verrous exacts des le premier echantillon). */
  snap() {
    this.sL1 = this.tL1;
    this.sL2 = this.tL2;
    this.sL3 = this.tL3;
    this.sN = this.tN;
    this.sFb = this.tFb;
    this.sLoad = this.tLoad;
    this.sMk = this.tMk;
    this.sK = this.tK;
    this.sVol = this.tVol;
    this.sSub = this.tSub;
    this.sAcc = this.tAcc;
  }

  /** Les potards, puis les verrous du pas qui joue : chaque valeur sure (num), un verrou ne bouge pas un reglage GLOBAL. */
  mix() {
    const p = this.p;
    const b = this.base;
    for (let i = 0; i < KEYS.length; i += 1) {
      const k = KEYS[i];
      p[k] = num(b[k], LEGACY[k]);
    }
    const lock = this.lock;
    if (lock && typeof lock === 'object') {
      for (let i = 0; i < LOCK_KEYS.length; i += 1) {
        const k = LOCK_KEYS[i];
        const v = lock[k];
        if (typeof v === 'number' && v - v === 0) p[k] = v < 0 ? 0 : v > 1 ? 1 : v;
      }
    }
    this.derive();
  }

  onMsg(m) {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'params') {
      // Seules des valeurs lisibles entrent (2026-10-09 : un undefined, un NaN ou une chaine gardent la valeur d'avant)
      const q = m.p;
      if (q && typeof q === 'object') {
        for (let i = 0; i < KEYS.length; i += 1) {
          const k = KEYS[i];
          const v = q[k];
          if (typeof v === 'number' && v - v === 0) this.base[k] = v < 0 ? 0 : v > 1 ? 1 : v;
        }
      }
      this.mix();
    } else if (m.type === 'tempo') {
      if (typeof m.step === 'number' && m.step > 0 && m.step < 10 && m.step !== this.stepS) {
        this.stepS = m.step;
        this.mix();
      }
    } else if (m.type === 'on' || m.type === 'off' || m.type === 'lock') {
      // Une note sans hauteur lisible ne se programme pas (elle bloquerait la file)
      if (m.type === 'on' && !(typeof m.midi === 'number' && m.midi - m.midi === 0)) return;
      const t = typeof m.at === 'number' && m.at - m.at === 0 ? m.at : 0;
      const at = t > 0 ? Math.max(0, Math.round((t - currentTime) * sampleRate)) : 0;
      const midi = m.type === 'on' ? Math.max(0, Math.min(127, m.midi)) : m.midi;
      const ev = { frame: currentFrame + at, type: m.type, midi, acc: !!m.acc, legato: !!m.legato, lock: m.lock && typeof m.lock === 'object' ? m.lock : null };
      // Rangee par heure (un evenement a la meme heure passe apres ceux deja la)
      let i = this.queue.length;
      while (i > 0 && this.queue[i - 1].frame > ev.frame) i -= 1;
      this.queue.splice(i, 0, ev);
    } else if (m.type === 'unseq') {
      const f = Math.round((typeof m.time === 'number' && m.time - m.time === 0 ? m.time : 0) * sampleRate) - 2;
      this.queue = this.queue.filter((e) => e.frame < f);
    } else if (m.type === 'stop') {
      this.queue = [];
      this.gate = false;
      this.quick = true;
      this.stopping = true;
      this.fSt = 3;
      this.aSt = 3;
      if (this.lock) {
        this.lock = null;
        this.mix();
      }
    }
  }

  apply(ev) {
    if (ev.type === 'off') {
      this.gate = false;
      this.fSt = 3;
      this.aSt = 3;
      return;
    }
    // Les verrous du pas : avant la note (sa decroissance, son accent en dependent)
    if (ev.lock !== this.lock) {
      this.lock = ev.lock;
      this.mix();
    }
    // Un verrou de DECAY sur ce pas (2026-10-08) : il l'emporte, accent ou pas
    const lockedDecay = !!ev.lock && typeof ev.lock.decay === 'number';
    if (ev.type === 'lock') {
      // Une liaison verrouillee : l'enveloppe qui continue prend sa decroissance
      if (lockedDecay) this.envTau = this.decayS;
      return;
    }
    const target = Math.log(440 * Math.pow(2, (ev.midi - 69) / 12));
    const legato = ev.legato && this.gate;
    this.logT = target;
    this.midi = ev.midi;
    this.acc = ev.acc ? this.accAmt : 0;
    this.tAcc = 1 + 0.3 * this.acc;
    if (legato) {
      // Glisse : la hauteur part vers la note, les enveloppes continuent (un verrou de DECAY : comme une liaison)
      this.glideOn = true;
      this.dirty = true;
      this.dirtyL = true;
      if (lockedDecay) this.envTau = this.decayS;
      return;
    }
    this.glideOn = false;
    this.dirty = true;
    this.dirtyL = true;
    this.logF = target;
    this.lF = target;
    this.gate = true;
    this.quick = false;
    this.stopping = false;
    this.stopG = 1;
    // L'ampli remonte (ATTACK), puis decroitra vers SUSTAIN (2026-10-08)
    this.ampDecaying = false;
    this.ampLvl = 1;
    // L'enveloppe du filtre repart ; une note accentuee : courte et fixe (la 303 : ACC DECAY), sauf un verrou de DECAY
    this.env = 1;
    this.envTau = ev.acc && !lockedDecay ? this.accDecayS : this.decayS;
    if (ev.acc) {
      this.accEnv = 1;
      this.aEnvL = 1;
    }
    // L'echelle (2026-10-09) : les contours repartent de leur niveau (pas de clic, Monark) ; a froid, OSC 1 repart a
    // sa phase 0.5 (le passage a zero de la dent de scie : chaque note frappe pareil contre le kick), OSC 2 et 3 a
    // 0.5 + DRIFT x hasard (en phase a DRIFT 0, presque libres a 1), les lissages sur leur cible
    this.fSt = 1;
    this.aSt = 1;
    const dr = this.driftAmt;
    if (this.ae < QUIET) {
      this.ph1 = 0.5;
      this.ph2 = dr > 0 ? 0.5 + dr * (this.rand() - 0.5) : 0.5;
      this.ph3 = dr > 0 ? 0.5 + dr * (this.rand() - 0.5) : 0.5;
      this.snap();
      if (this.ae < COLD && this.onLad) {
        this.lad.reset();
        this.fbY = 0;
        this.pf1 = 0;
        this.pf2 = 0;
        this.fe = 0;
        this.ae = 0;
        this.cold = this.segI;
      }
    }
    // DRIFT : chaque note un peu a cote (+-1 cent, coupure +-1.4 % a DRIFT 1)
    if (dr > 0) {
      this.noteCents = (this.rand() - 0.5) * 2 * dr;
      this.noteCut = Math.exp(Math.LN2 * (this.rand() - 0.5) * 0.04 * dr);
    } else {
      this.noteCents = 0;
      this.noteCut = 1;
    }
  }

  /** La garde : un echantillon non fini ou demesure, toute la voix repart de zero (les deux voix, les etats, la hauteur). */
  heal() {
    this.heals += 1;
    this.lad.reset();
    this.ladder.reset();
    this.dec.clear();
    this.fbY = 0;
    this.pf1 = 0;
    this.pf2 = 0;
    this.fb3 = 0;
    this.vca = 0;
    this.env = 0;
    this.accEnv = 0;
    this.accSweep = 0;
    this.ampDecaying = false;
    this.ampLvl = 1;
    // Une note tenue repart (une attaque depuis zero), sinon le silence
    this.ae = 0;
    this.fe = 0;
    this.aSt = this.gate ? 1 : 3;
    this.fSt = this.gate ? 1 : 3;
    this.aEnvL = 0;
    this.aSwL = 0;
    this.dc.x = 0;
    this.dc.y = 0;
    this.dcLX = 0;
    this.dcLY = 0;
    this.pk0 = 0;
    this.pk1 = 0;
    this.pk2 = 0;
    if (!(this.logT - this.logT === 0)) this.logT = Math.log(55);
    this.logF = this.logT;
    this.lF = this.logT;
    this.glideOn = false;
    if (!(this.phase - this.phase === 0)) this.phase = 0;
    if (!(this.subPhase - this.subPhase === 0)) this.subPhase = 0;
    this.ph1 = 0.5;
    this.ph2 = 0.5;
    this.ph3 = 0.5;
    this.subPhL = 0;
    this.drift.fill(0);
    this.dt = 0.001;
    this.gainAcc = 1;
    this.gStep = 0;
    this.dirty = true;
    this.dirtyL = true;
    this.snap();
  }

  /** L'echelle se tait : ses etats a zero une fois (rien ne traine au reveil). */
  sleepLadder() {
    this.lad.reset();
    this.dec.clear();
    this.fbY = 0;
    this.pf1 = 0;
    this.pf2 = 0;
    this.dcLX = 0;
    this.dcLY = 0;
    this.pk0 = 0;
    this.pk1 = 0;
    this.pk2 = 0;
    this.aEnvL = 0;
    this.aSwL = 0;
  }

  /** La 303 entre (le fondu depuis l'echelle) : son filtre part de zero, son ampli et son enveloppe du niveau de l'echelle. */
  start303() {
    this.ladder.reset();
    this.vca = this.ae;
    this.env = this.fe;
    this.ampDecaying = this.aSt >= 2;
    this.ampLvl = this.aSt >= 2 ? this.ae : 1;
    this.accEnv = this.aEnvL;
    this.accSweep = this.aSwL;
    this.phase = this.ph1;
    this.logF = this.lF;
    this.dc.x = 0;
    this.dc.y = 0;
    this.dirty = true;
    this.on303 = true;
  }

  /** L'echelle entre (le fondu depuis la 303) : son filtre part de zero, ses contours du niveau de la 303. */
  startLad() {
    this.sleepLadder();
    this.ae = this.vca;
    this.fe = this.env;
    this.aSt = this.gate ? (this.ampDecaying ? 2 : 1) : 3;
    this.fSt = this.gate ? 2 : 3;
    this.aEnvL = this.accEnv;
    this.aSwL = this.accSweep;
    this.ph1 = this.phase;
    this.lF = this.logF;
    this.wm.fill(0);
    this.wm[this.lmode] = 1;
    this.snap();
    this.dirtyL = true;
    this.lIdle = false;
    this.onLad = true;
  }

  /** DRIFT, une fois par bloc : la marche lente de chaque oscillateur et du filtre, bornee a +-3 x DRIFT. */
  walk() {
    const dr = this.driftAmt;
    const d = this.drift;
    if (dr <= 0) {
      if (d[0] !== 0 || d[1] !== 0 || d[2] !== 0 || d[3] !== 0) d.fill(0);
      return;
    }
    const lim = 3 * dr;
    for (let k = 0; k < 4; k += 1) {
      let x = d[k] * 0.997 + (this.rand() - 0.5) * 0.25 * dr;
      if (x > lim) x = lim;
      else if (x < -lim) x = -lim;
      d[k] = x;
    }
  }

  /**
   * La 303, de i0 a i1 (exclus) : le code d'avant tel quel (les constantes du bloc prises au debut du bloc, comme
   * avant : le rendu reste identique a l'echantillon pres), plus OSC 2, OSC 3, NOISE, FEEDBACK et DRIFT s'ils sont la.
   */
  run303(i0, i1) {
    const R = this.R;
    const H = this.h303;
    const kGlide = H[0];
    const kEnv = H[1];
    const kAccEnv = H[2];
    const kSweep = H[3];
    const kAtt = H[4];
    const kRel = H[5];
    const kAmpDec = H[6];
    const sus = H[7];
    const sub = H[8];
    const oscK = H[9];
    const vol = H[10];
    const wave = H[11];
    const drive = H[12];
    const dNorm = H[13];
    const ladder = this.ladder;
    const out = this.dryA;
    let dt = this.dt || 0.001;
    let gainAcc = this.gainAcc || 1;
    const sin = Math.sin;
    const TWO_PI = 2 * Math.PI;
    // Les ajouts de l'echelle dans la 303 (2026-10-09), d'apres les reglages du moment (verrous compris)
    const ex = this.extra303;
    const dr = this.driftAmt;
    const p = this.p;
    const L1 = p.o1lvl;
    const L2 = p.o2lvl;
    const L3 = p.o3lvl;
    const nz2 = this.tN;
    const fbv = p.feedback;
    const fbA = 0.9 * fbv;
    const fbB = 1.3 + 2.7 * fbv;
    const w2 = this.w2;
    const w3 = this.w3;
    let dt2 = this.d2;
    let dt3 = this.d3;
    for (let i = i0; i < i1; i += 1) {
      if (i % CTRL === 0 || this.dirty) {
        this.dirty = false;
        // La hauteur (glisse en log), les enveloppes, la coupure
        if (this.glideOn) this.logF += (this.logT - this.logF) * kGlide;
        if (dr > 0) {
          const base = this.logF + this.tuneLog + (Math.LN2 * this.noteCents) / 1200;
          dt = Math.min(0.45, Math.exp(base + (Math.LN2 * this.drift[0]) / 1200) / R);
          if (L2 > 0) dt2 = Math.min(0.45, (Math.exp(base + (Math.LN2 * this.drift[1]) / 1200 + (SCALE_ERR[1] * dr * (this.logF - KT_REF)) / 1200) * this.m2) / R);
          if (L3 > 0) dt3 = Math.min(0.45, (Math.exp(base + (Math.LN2 * this.drift[2]) / 1200 + (SCALE_ERR[2] * dr * (this.logF - KT_REF)) / 1200) * this.m3) / R);
        } else {
          dt = Math.min(0.45, Math.exp(this.logF + this.tuneLog) / R);
          if (L2 > 0) dt2 = Math.min(0.45, dt * this.m2);
          if (L3 > 0) dt3 = Math.min(0.45, dt * this.m3);
        }
        this.env *= kEnv;
        this.accEnv *= kAccEnv;
        this.accSweep += (this.accEnv * this.acc - this.accSweep) * kSweep;
        const depth = this.envOct * (1 + 0.6 * this.acc);
        let fc = this.cutBase * Math.exp((depth * this.env + this.sweepOct * this.accSweep) * Math.LN2);
        // KEY TRK (2026-10-08) : la coupure suit la hauteur qui sonne, autour de la tonique (0 : rien ne change)
        if (this.kt > 0) fc *= Math.exp(this.kt * (this.logF - KT_REF));
        if (dr > 0) fc *= this.noteCut * Math.exp(0.01 * Math.LN2 * this.drift[3]);
        // AMP DECAY : le niveau vise descend vers SUSTAIN une fois la montee faite
        if (this.ampDecaying) this.ampLvl = sus + (this.ampLvl - sus) * kAmpDec;
        if (fc > R * 0.42) fc = R * 0.42;
        if (fc < 20) fc = 20;
        ladder.set(fc, this.res);
        this.lastCut = fc;
        gainAcc = 1 + 0.9 * this.acc * Math.max(this.env, 0.35);
      }
      let acc = 0;
      for (let s = 0; s < OS; s += 1) {
        // L'oscillateur : dent de scie et carre a bande limitee
        let t = this.phase + dt;
        if (t >= 1) t -= 1;
        this.phase = t;
        const saw = 2 * t - 1 - blep(t, dt);
        // Le carre : son second front a PW (0.5 : le carre d'avant, aux memes calculs pres)
        let t2 = t + this.pwOff;
        if (t2 >= 1) t2 -= 1;
        const sq = (t < this.pwFrac ? 1 : -1) + blep(t, dt) - blep(t2, dt);
        let x;
        if (!ex) x = (saw + (sq - saw) * wave) * 0.9;
        else {
          // OSC 2, OSC 3, NOISE et FEEDBACK dans l'entree du TeeBee (2026-10-09)
          let o = (saw + (sq - saw) * wave) * L1;
          if (L2 > 0) {
            let u = this.q2 + dt2;
            if (u >= 1) u -= 1;
            this.q2 = u;
            o += L2 * shape(w2, u, dt2, false);
          }
          if (L3 > 0) {
            let u = this.q3 + dt3;
            if (u >= 1) u -= 1;
            this.q3 = u;
            o += L3 * shape(w3, u, dt3, true);
          }
          if (nz2 > 0) o += nz2 * this.pink();
          x = o * 0.9;
          if (fbv > 0) x += fbA * fastTanh(fbB * this.fb3);
        }
        let y = ladder.run(x);
        // DRIVE apres le filtre, toujours (2026-10-09 : sous 0.00845 la saturation sautait, plus fort et sans borne)
        y = fastTanh(y * drive) * dNorm;
        acc += y;
      }
      // Le SUB : un sinus une octave dessous (ou deux : SUB OCT), propre (a la cadence du contexte)
      this.subPhase += dt * OS * this.subMul;
      if (this.subPhase >= 1) this.subPhase -= 1;
      // Le VCA : la montee vers 1 (ATTACK), puis le niveau d'AMP DECAY (1 tant que SUSTAIN l'est) ; relache, RELEASE
      if (this.gate) {
        this.vca += ((this.ampDecaying ? this.ampLvl : 1) - this.vca) * kAtt;
        if (!this.ampDecaying && this.vca >= 0.99) this.ampDecaying = true;
      } else this.vca += (0 - this.vca) * kRel;
      const v = ((acc / OS) * oscK + sin(TWO_PI * this.subPhase) * sub) * this.vca * gainAcc * vol;
      if (ex) this.fb3 = (acc / OS) * oscK * this.vca * gainAcc;
      // Un coupe-continu tres bas (20 Hz : les subs restent)
      const yv = v - this.dc.x + 0.9974 * this.dc.y;
      this.dc.x = v;
      this.dc.y = yv;
      out[i] = yv;
    }
    this.dt = dt;
    this.gainAcc = gainAcc;
    this.d2 = dt2;
    this.d3 = dt3;
  }

  /** Le bruit rose (xorshift32, le filtre economique de Paul Kellet). */
  pink() {
    let x = this.nseed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.nseed = x;
    const w = x / 2147483648;
    this.pk0 = 0.99765 * this.pk0 + w * 0.099046;
    this.pk1 = 0.963 * this.pk1 + w * 0.2965164;
    this.pk2 = 0.57 * this.pk2 + w * 1.0526913;
    return (this.pk0 + this.pk1 + this.pk2 + w * 0.1848) * 0.25;
  }

  /**
   * L'echelle, de i0 a i1 (exclus), au double du contexte : les oscillateurs, le melangeur, LOAD, FEEDBACK, l'echelle et
   * sa sortie, le VCA, dans raw ; le SUB dans subB. Les reglages lus apres les evenements du segment (un verrou est
   * exact des son premier echantillon).
   */
  runLad(i0, i1) {
    const fs = sampleRate;
    const R = this.R;
    const lad = this.lad;
    const raw = this.raw;
    const subB = this.subB;
    const nyq = 0.45 * fs;
    // Les cibles et les coefficients du moment
    const tL1 = this.tL1;
    const tL2 = this.tL2;
    const tL3 = this.tL3;
    const tN = this.tN;
    const tFb = this.tFb;
    const tLoad = this.tLoad;
    const tMk = this.tMk;
    const tK = this.tK;
    const tVol = this.tVol;
    const tSub = this.tSub;
    const tAcc = this.tAcc;
    const kSm = 1 - Math.exp(-CTRL / (SMOOTH_S * fs));
    const kfA = this.kfA;
    const kfD = this.kfD;
    const kfR = this.kR;
    const fS = this.fSus;
    const kaA = this.kaA;
    const kaD = this.kaD;
    const kaR = this.quick ? this.kQ : this.kR;
    const aS = this.sus;
    const envOct = this.envOctL;
    const sweepOct = this.sweepOct;
    const kAccL = this.kAccL;
    const kSwL = this.kSwL;
    const accAmt = this.acc;
    const cMul = 1 + 0.6 * accAmt;
    const kt = this.kt;
    const cutN = this.cutBase * this.noteCut;
    const tuneLog = this.tuneLog + (Math.LN2 * this.noteCents) / 1200;
    const subMul = this.subMul;
    const glideOn = this.glideOn;
    const logT = this.logT;
    const gRate = this.gRate;
    const gTail = this.gTail;
    const w1 = this.p.wave;
    const pwFrac = this.pwFrac;
    const pwOff = this.pwOff;
    const w2 = this.w2;
    const w3 = this.w3;
    const m2 = this.m2;
    const m3 = this.m3;
    const dr = this.driftAmt;
    const drift = this.drift;
    const lm = this.lmode;
    const wm = this.wm;
    const tapStep = CTRL / (FADE_TAP_S * fs);
    // Les etats
    let lF = this.lF;
    let fe = this.fe;
    let ae = this.ae;
    let fSt = this.fSt;
    let aSt = this.aSt;
    let aEnvL = this.aEnvL;
    let aSwL = this.aSwL;
    let g = this.g;
    let gStep = this.gStep;
    let ph1 = this.ph1;
    let ph2 = this.ph2;
    let ph3 = this.ph3;
    let dt1 = this.dt1;
    let dt2 = this.dt2;
    let dt3 = this.dt3;
    let fbY = this.fbY;
    let subPh = this.subPhL;
    let subInc = this.subInc;
    let sL1 = this.sL1;
    let sL2 = this.sL2;
    let sL3 = this.sL3;
    let sN = this.sN;
    let sFb = this.sFb;
    let sLoad = this.sLoad;
    let sMk = this.sMk;
    let sK = this.sK;
    let sVol = this.sVol;
    let sSub = this.sSub;
    let sAcc = this.sAcc;
    let wm0 = wm[0];
    let wm1 = wm[1];
    let wm2 = wm[2];
    let wm3 = wm[3];
    let tapK = 1 / (1 + TAP_RES * sK);
    let dirty = this.dirtyL;
    let lastCut = this.lastCut;
    let w = 2 * i0;
    let pf1 = this.pf1;
    let pf2 = this.pf2;
    const pfK = this.pfK;
    const TWO_PI = 2 * Math.PI;
    for (let i = i0; i < i1; i += 1) {
      // GLIDE (SLIDE) : la hauteur avance a rythme constant, le dernier demi-ton en douceur
      if (glideOn) {
        const d = logT - lF;
        if (d > 0.0578) lF += d < gRate ? d : gRate;
        else if (d < -0.0578) lF -= -d < gRate ? -d : gRate;
        else lF += d * gTail;
      }
      if (i % CTRL === 0 || dirty) {
        // Les lissages (5 ms), les poids des sorties (15 ms), a la cadence de controle
        sL1 += (tL1 - sL1) * kSm;
        sL2 += (tL2 - sL2) * kSm;
        sL3 += (tL3 - sL3) * kSm;
        sN += (tN - sN) * kSm;
        sFb += (tFb - sFb) * kSm;
        sLoad += (tLoad - sLoad) * kSm;
        sMk += (tMk - sMk) * kSm;
        sK += (tK - sK) * kSm;
        sVol += (tVol - sVol) * kSm;
        sSub += (tSub - sSub) * kSm;
        sAcc += (tAcc - sAcc) * kSm;
        tapK = 1 / (1 + TAP_RES * sK);
        if (wm0 !== (lm === 0 ? 1 : 0) || wm1 !== (lm === 1 ? 1 : 0) || wm2 !== (lm === 2 ? 1 : 0) || wm3 !== (lm === 3 ? 1 : 0)) {
          wm0 = lm === 0 ? Math.min(1, wm0 + tapStep) : Math.max(0, wm0 - tapStep);
          wm1 = lm === 1 ? Math.min(1, wm1 + tapStep) : Math.max(0, wm1 - tapStep);
          wm2 = lm === 2 ? Math.min(1, wm2 + tapStep) : Math.max(0, wm2 - tapStep);
          wm3 = lm === 3 ? Math.min(1, wm3 + tapStep) : Math.max(0, wm3 - tapStep);
        }
        // Les pas de phase des trois oscillateurs (DRIFT : leur marche, la note, l'erreur d'echelle d'OSC 2 et 3)
        const lb = lF + tuneLog;
        if (dr > 0) {
          const oct = (lF - KT_REF) / 1200;
          dt1 = Math.min(0.45, Math.exp(lb + (Math.LN2 * drift[0]) / 1200) / R);
          dt2 = Math.min(0.45, (Math.exp(lb + (Math.LN2 * drift[1]) / 1200 + SCALE_ERR[1] * dr * oct) * m2) / R);
          dt3 = Math.min(0.45, (Math.exp(lb + (Math.LN2 * drift[2]) / 1200 + SCALE_ERR[2] * dr * oct) * m3) / R);
        } else {
          const f = Math.exp(lb) / R;
          dt1 = Math.min(0.45, f);
          dt2 = Math.min(0.45, f * m2);
          dt3 = Math.min(0.45, f * m3);
        }
        // Sous 16 Hz (un 32' a OCTAVE -2) : une octave plus haut, toujours dans le ton
        const lowest = 16 / R;
        for (let o = 0; o < 3 && dt2 < lowest; o += 1) dt2 *= 2;
        for (let o = 0; o < 3 && dt3 < lowest; o += 1) dt3 *= 2;
        // Le circuit d'accent (la charge des accents qui se suivent)
        aEnvL *= kAccL;
        aSwL += (aEnvL * accAmt - aSwL) * kSwL;
        // La coupure : le contour (signe : POLARITY), l'accent, la charge, KEY TRK, DRIFT
        let fc = cutN * Math.exp(Math.LN2 * (envOct * fe * cMul + sweepOct * aSwL + (dr > 0 ? 0.01 * drift[3] : 0)) + kt * (lF - KT_REF));
        if (fc > nyq) fc = nyq;
        else if (fc < 15) fc = 15;
        lastCut = fc;
        const gT = Math.tan((Math.PI * fc) / R);
        // Interpolee d'un point de controle au suivant (pas d'escalier a forte emphase) ; une note : tout de suite
        if (dirty) {
          g = gT;
          gStep = 0;
          dirty = false;
        } else gStep = (gT - g) / CTRL;
        subInc = (Math.exp(lb) * subMul) / fs;
      }
      g += gStep;
      // Les contours du Model D (filtre, ampli) : attaque vers 1.3, decroissance vers SUSTAIN, relachement
      if (fSt === 1) {
        fe += (1.3 - fe) * kfA;
        if (fe >= 1) {
          fe = 1;
          fSt = 2;
        }
      } else if (fSt === 2) fe += (fS - fe) * kfD;
      else fe -= fe * kfR;
      if (aSt === 1) {
        ae += (1.3 - ae) * kaA;
        if (ae >= 1) {
          ae = 1;
          aSt = 2;
        }
      } else if (aSt === 2) ae += (aS - ae) * kaD;
      else ae -= ae * kaR;
      const inG = sLoad * sAcc;
      const outG = ae * sAcc * sMk * sVol;
      const on2 = sL2 > 1e-6;
      const on3 = sL3 > 1e-6;
      const onN = sN > 1e-9;
      const onFb = sFb > 1e-6;
      const fbA = 0.9 * sFb;
      const fbB = 1.3 + 2.7 * sFb;
      const pure = wm0 === 1;
      for (let s = 0; s < OS; s += 1) {
        // OSC 1 : l'oscillateur d'avant (dent de scie vers carre, PW)
        let t = ph1 + dt1;
        if (t >= 1) t -= 1;
        ph1 = t;
        let o1 = 2 * t - 1 - blep(t, dt1);
        if (w1 > 0) {
          let t2 = t + pwOff;
          if (t2 >= 1) t2 -= 1;
          const sq = (t < pwFrac ? 1 : -1) + blep(t, dt1) - blep(t2, dt1);
          o1 += (sq - o1) * w1;
        }
        let m = sL1 * o1;
        if (on2) {
          let u = ph2 + dt2;
          if (u >= 1) u -= 1;
          ph2 = u;
          m += sL2 * shape(w2, u, dt2, false);
        }
        if (on3) {
          let u = ph3 + dt3;
          if (u >= 1) u -= 1;
          ph3 = u;
          m += sL3 * shape(w3, u, dt3, true);
        }
        if (onN) m += sN * this.pink();
        // LOAD : le melangeur (adouci au-dessus de l'audible) pousse l'echelle ; FEEDBACK : la sortie de l'ampli
        // renvoyee a l'entree, saturee
        pf1 += (m - pf1) * pfK;
        pf2 += (pf1 - pf2) * pfK;
        let x = pf2 * inG;
        if (onFb) x += fbA * fastTanh(fbB * fbY);
        // L'echelle linearisee a chaque echantillon du double (2026-10-09, mesure : une fois par echantillon du
        // contexte, les gains des etages tenus deux echantillons replient la bande 24-48 kHz dans l'audible, -45 dB
        // sur une dent de scie a 1760 Hz filtre ouvert au lieu de -62 ; le calcul en plus tient dans le budget)
        lad.lin(g, sK);
        let y = lad.run(x);
        if (!pure) y = wm0 * y + tapK * (wm1 * lad.y2 + wm2 * LP6_GAIN * lad.y1 + wm3 * BP_GAIN * (lad.y1 - lad.y2));
        // Le VCA (l'accent le pousse aussi), le retour pris ici, puis le rattrapage de LOAD et VOLUME
        const a = y * ae * sAcc;
        fbY = a;
        raw[w] = y * outG;
        w += 1;
      }
      // Le SUB : propre, apres l'echelle, suit l'ampli
      if (sSub > 1e-6) {
        subPh += subInc;
        if (subPh >= 1) subPh -= 1;
        subB[i] = sSub * sVol * Math.sin(TWO_PI * subPh) * ae;
      } else subB[i] = 0;
    }
    this.pf1 = pf1;
    this.pf2 = pf2;
    wm[0] = wm0;
    wm[1] = wm1;
    wm[2] = wm2;
    wm[3] = wm3;
    this.lF = lF;
    this.fe = fe;
    this.ae = ae;
    this.fSt = fSt;
    this.aSt = aSt;
    this.aEnvL = aEnvL;
    this.aSwL = aSwL;
    this.g = g;
    this.gStep = gStep;
    this.ph1 = ph1;
    this.ph2 = ph2;
    this.ph3 = ph3;
    this.dt1 = dt1;
    this.dt2 = dt2;
    this.dt3 = dt3;
    this.fbY = fbY;
    this.subPhL = subPh;
    this.subInc = subInc;
    this.sL1 = sL1;
    this.sL2 = sL2;
    this.sL3 = sL3;
    this.sN = sN;
    this.sFb = sFb;
    this.sLoad = sLoad;
    this.sMk = sMk;
    this.sK = sK;
    this.sVol = sVol;
    this.sSub = sSub;
    this.sAcc = sAcc;
    this.dirtyL = dirty;
    if (!this.on303 || this.x303 < 1) this.lastCut = lastCut;
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const Rch = out[1] || out[0];
    const n = L.length;
    const R = this.R;
    // Les effets : les envois lisses (5 ms), et s'ils calculent (au debut du bloc, comme avant)
    const kSend = 1 - Math.exp(-1 / (0.005 * sampleRate));
    if (this.dSend > 0) {
      this.dlyOn = true;
      this.dlyQuiet = 0;
    }
    if (this.rSend > 0) {
      this.revOn = true;
      this.revQuiet = 0;
    }
    const fx = this.dlyOn || this.revOn;
    const dly = this.dly;
    const rev = this.rev;
    const f0 = currentFrame;
    const q = this.queue;
    // MODE : la 303 ou l'echelle ; un changement se fond (10 ms), tout de suite si rien ne sonne
    const want303 = this.mode === 4;
    if (want303 ? !this.on303 : !this.onLad) {
      const quiet = !this.gate && this.vca < 1e-4 && this.ae < 1e-4;
      if (want303) this.start303();
      else this.startLad();
      if (quiet) {
        this.x303 = want303 ? 1 : 0;
        if (want303) this.onLad = false;
        else this.on303 = false;
      }
    }
    const do303 = this.on303;
    let doLad = this.onLad;
    // L'echelle silencieuse (2026-10-09) : pas de note, l'ampli eteint, rien a jouer dans ce bloc : rien a calculer
    const due = q.length !== 0 && q[0].frame < f0 + n;
    if (doLad && !do303 && !this.gate && this.ae < IDLE_LEVEL && !due) {
      if (!this.lIdle) {
        this.lIdle = true;
        this.sleepLadder();
      }
      doLad = false;
      if (!fx) {
        L.fill(0);
        if (Rch !== L) Rch.fill(0);
        this.fxPeak = 0;
        this.since += n;
        if (this.active) this.port.postMessage({ type: 'pos', cut: this.lastCut, env: 0, gate: false, midi: -1, peak: 0, heals: this.heals });
        this.active = false;
        return true;
      }
    } else this.lIdle = false;
    this.walk();
    if (do303) {
      // Les coefficients d'un pas de controle (CTRL echantillons du contexte, CTRL * OS du double), au debut du bloc
      const steps = CTRL * OS;
      const H = this.h303;
      H[0] = 1 - Math.exp(-steps / (this.glideS * R));
      H[1] = Math.exp(-steps / (this.envTau * R));
      H[2] = Math.exp(-steps / (this.accDecayS * R));
      // Le circuit d'accent : plus lent avec la resonance (la charge s'accumule d'un accent a l'autre)
      H[3] = 1 - Math.exp(-steps / ((0.03 + 0.12 * this.p.reso) * R));
      // Le VCA, a chaque echantillon du contexte (ATTACK, 2.5 ms par defaut comme avant ; RELEASE ; STOP : 6 ms, plus vite)
      H[4] = 1 - Math.exp(-1 / (this.attackS * sampleRate));
      H[5] = 1 - Math.exp(-1 / ((this.quick ? 0.006 : this.releaseS) * sampleRate));
      // AMP DECAY vers SUSTAIN (2026-10-08), a la cadence de controle ; SUSTAIN a 1 : le niveau reste 1, le son d'avant
      H[6] = Math.exp(-steps / (this.adecayS * R));
      H[7] = this.sus;
      // Le niveau (2026-10-07, Mika : "le kick est la reference ; mon sub bassline, je le mets 2 dB sous lui") :
      // le SUB prend la place de l'oscillateur au lieu de s'y ajouter (la crete bouge peu quand il monte) ; VOLUME
      // par defaut : 2 dB sous le kick, mesure en sortie reelle le 2026-10-08 (sans le compresseur de la batterie,
      // avec le rattrapage de -3 dB des trois machines : 1.82 devient 0.97)
      H[8] = this.p.sub * 0.55;
      H[9] = 0.55 * (1 - 0.5 * this.p.sub);
      H[10] = this.p.volume * this.p.volume * 0.97;
      H[11] = this.p.wave;
      H[12] = this.drive;
      H[13] = this.driveNorm;
    }
    // La voix, segment par segment : les evenements d'un instant d'abord, puis jusqu'au suivant
    const sendD = this.sendD;
    const sendR = this.sendR;
    let i = 0;
    while (i < n) {
      if (q.length !== 0) {
        const frame = f0 + i;
        this.segI = i;
        while (q.length && q[0].frame <= frame) this.apply(q.shift());
      }
      let end = n;
      if (q.length !== 0) {
        const nf = q[0].frame - f0;
        if (nf < end) end = nf > i ? nf : i + 1;
      }
      const ds = this.dSend;
      const rs = this.rSend;
      for (let k = i; k < end; k += 1) {
        sendD[k] = ds;
        sendR[k] = rs;
      }
      if (do303) this.run303(i, end);
      if (doLad) this.runLad(i, end);
      i = end;
    }
    // L'echelle : le demi-bande (2x vers 1x), le SUB, le coupe-continu a 8 Hz
    const dryB = this.dryB;
    if (doLad) {
      const dec = this.decOut;
      // Une note a froid : ce qui la precede dans ce bloc (sous -60 dB) se tait, le demi-bande et le coupe-continu
      // repartent de zero avec elle
      if (this.cold >= 0) {
        this.raw.fill(0, 0, 2 * this.cold);
        this.dec.clear();
        this.dcLX = 0;
        this.dcLY = 0;
        this.cold = -1;
      }
      this.dec.run(this.raw, n * OS, dec);
      const subB = this.subB;
      const a = 1 - (2 * Math.PI * 8) / sampleRate;
      let dx = this.dcLX;
      let dy = this.dcLY;
      for (let k = 0; k < n; k += 1) {
        const y = dec[k] + subB[k];
        const yy = y - dx + a * dy;
        dx = y;
        dy = yy;
        dryB[k] = yy;
      }
      this.dcLX = dx;
      this.dcLY = dy;
    } else if (this.onLad) dryB.fill(0);
    // Le melange des deux voix (le fondu de MODE), la garde, les effets
    const dryA = this.dryA;
    const step303 = 1 / (FADE_303_S * sampleRate);
    const stepStop = 1 / (STOP_S * sampleRate);
    let x303 = this.x303;
    let peak = 0;
    let fxPeak = 0;
    let healed = false;
    for (let k = 0; k < n; k += 1) {
      let v;
      if (x303 === 1 && want303) v = dryA[k];
      else if (x303 === 0 && !want303) v = this.onLad ? dryB[k] : 0;
      else {
        x303 = want303 ? Math.min(1, x303 + step303) : Math.max(0, x303 - step303);
        v = x303 * (do303 ? dryA[k] : 0) + (1 - x303) * (this.onLad ? dryB[k] : 0);
      }
      // STOP (2026-10-09) : la sortie seche se fond en 10 ms, puis se tait (la queue du coupe-continu ne traine pas) ;
      // les effets finissent leurs repetitions
      if (this.stopping) {
        const sg = this.stopG - stepStop;
        this.stopG = sg > 0 ? sg : 0;
        v *= this.stopG;
      }
      // La garde (2026-10-09) : un echantillon non fini ou demesure, la voix repart de zero, le bloc se tait
      if (healed) v = 0;
      else if (v - v !== 0 || v > GUARD || v < -GUARD) {
        this.heal();
        healed = true;
        v = 0;
      }
      const av = v < 0 ? -v : v;
      if (av > peak) peak = av;
      if (!fx) {
        L[k] = v;
        if (Rch !== L) Rch[k] = v;
        continue;
      }
      // Les effets (2026-10-08) : le sec, plus les retours du DELAY et de la REVERB
      let l = v;
      let r = v;
      if (this.dlyOn) {
        const sd = sendD[k];
        this.dS += (sd - this.dS) * kSend;
        dly.run(v * this.dS);
        l += dly.outL;
        r += dly.outR;
        // Le silence se compte sur ce qui entre dans la ligne aussi (pas seulement sur sa sortie)
        const e = dly.lvl + this.dS;
        if (e > fxPeak) fxPeak = e;
        if (e < FX_IDLE.level && sd === 0) this.dlyQuiet += 1;
        else this.dlyQuiet = 0;
      }
      if (this.revOn) {
        const sr = sendR[k];
        this.rS += (sr - this.rS) * kSend;
        rev.run(v * this.rS);
        l += rev.outL;
        r += rev.outR;
        const e = rev.lvl + this.rS;
        if (e < FX_IDLE.level && sr === 0) this.revQuiet += 1;
        else this.revQuiet = 0;
      }
      if (l - l !== 0 || r - r !== 0) {
        dly.clear();
        rev.clear();
        l = 0;
        r = 0;
      }
      L[k] = l;
      if (Rch !== L) Rch[k] = r;
    }
    this.x303 = x303;
    // STOP fini : la voix repart de zero (rien ne traine a la reprise)
    if (this.stopping && this.stopG === 0) {
      this.stopping = false;
      this.sleepLadder();
      this.ae = 0;
      this.fe = 0;
      this.vca = 0;
      this.ladder.reset();
      this.dc.x = 0;
      this.dc.y = 0;
      this.stopG = 1;
    }
    // Le fondu fini : la voix sortie ne calcule plus
    if (x303 === 1 && want303) this.onLad = false;
    else if (x303 === 0 && !want303) this.on303 = false;
    // Un effet a zero dont la queue s'est eteinte : il s'endort, ses lignes videes (rien ne traine au reveil). Le DELAY :
    // rien d'ecrit depuis au moins son temps (dly.d), la partie de la ligne qui sortira encore est vide (2026-10-08, revue :
    // un verrou de DELAY en 3/8 ou 1/2 perdait sa repetition, la ligne videe avant qu'elle sorte)
    const idle = FX_IDLE.s * sampleRate;
    if (this.dlyOn && this.dlyQuiet > dly.d + idle) {
      this.dlyOn = false;
      this.dS = 0;
      dly.clear();
    }
    if (this.revOn && this.revQuiet > idle) {
      this.revOn = false;
      this.rS = 0;
      rev.clear();
    }
    this.fxPeak = fxPeak;
    // Plus rien ne sonne : on remet le filtre au repos (pas d'auto-oscillation qui traine)
    const lvl = Math.max(do303 ? this.vca : 0, this.onLad ? this.ae : 0);
    const sounding = this.gate || lvl > 1e-4 || this.queue.length > 0;
    if (!sounding && this.active && do303) this.ladder.reset();
    this.since += n;
    const env = this.x303 === 1 ? this.env : this.fe;
    if (sounding && this.since >= REPORT_EVERY) {
      this.since = 0;
      this.port.postMessage({ type: 'pos', cut: this.lastCut, env, gate: this.gate, midi: this.midi, peak, heals: this.heals });
    } else if (!sounding && this.active) this.port.postMessage({ type: 'pos', cut: this.lastCut, env: 0, gate: false, midi: -1, peak: 0, heals: this.heals });
    this.active = sounding;
    return true;
  }
}

registerProcessor('mm-bass', MMBass);
