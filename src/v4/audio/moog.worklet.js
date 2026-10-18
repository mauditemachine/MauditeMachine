/**
 * MM-VOYAGER : le moteur (AudioWorklet, 2026-10-03). Le plus pres possible
 * d'un Minimoog Voyager dans un navigateur, calcule echantillon par
 * echantillon :
 * - deux oscillateurs par note, facon Dreadbox Typhon (2026-10-03) : WAVE
 *   fait MORPHER chaque oscillateur d'une forme a la suivante (sinus,
 *   triangle, dent de scie, carre, impulsion ; OSC 1 finit sur la FM, sa
 *   sinusoide modulee par OSC 2) ; les formes ont toutes leur fondamentale
 *   en phase, le fondu de l'une a l'autre ne creuse jamais le son. Chaque
 *   oscillateur accorde par RANGE et SEMI, FINE a part (2026-10-04, facon
 *   Mini V ; TUNE 2 et l'ecart FINE avant), dose par son volume ; sans repliement
 *   (PolyBLEP) ; chaque oscillateur derive lentement (quelques cents, comme
 *   un VCO) ; l'operateur FM module les DEUX oscillateurs ;
 * - presque analogique (2026-10-03, Mika : "presque du analog") : chaque
 *   note a ses petits ecarts, comme les voix d'un vrai polyphonique (la
 *   coupure a +/- 2.8 %, les enveloppes a +/- 5 %, l'accord a +/- 1.5
 *   cent), et sa place dans l'image stereo (une note a gauche, la suivante
 *   a droite, de peu : WIDTH) ;
 * - le filtre en echelle 24 dB (quatre poles, retroaction resolue sans
 *   retard) a saturation DANS chaque etage, comme les transistors d'un
 *   Moog (la methode "cheap" de Mystran : chaque etage prend la pente de
 *   sa tangente hyperbolique au point de l'echantillon precedent, puis
 *   l'echelle se resout lineairement, sans retard) : les forts signaux
 *   arrondissent, la resonance s'auto-limite en chantant ; les graves
 *   fondent moins quand elle monte (BASS_KEEP) ; OVERDRIVE (DIST avant
 *   le 2026-10-04) pousse un peu son entree, puis chauffe la sortie
 *   (OD_GAIN, une Tube Screamer) ;
 * - deux enveloppes ADSR a courbes de condensateur (attaque vers 1.3,
 *   decroissance et relachement exponentiels), redeclenchees depuis leur
 *   niveau : jamais de clic ;
 * - GLIDE glisse depuis la note precedente en hauteur logarithmique.
 * TWEAKS (2026-10-04, sous le capot, Mika : "pas de probleme de phase dans
 * les low ; l'impression d'analog, mais un peu trop intense") :
 * - phase : -1, les oscillateurs tournent librement (chaque voix neuve part
 *   d'une phase au hasard, comme avant) ; 0 a 1, chaque note repart de
 *   cette phase, les trois oscillateurs ensemble : l'attaque est la meme a
 *   chaque note, la basse frappe toujours pareil. Seulement si la voix est
 *   (presque) muette : pas de clic sur une voix reprise en plein son ;
 * - drift : la part d'analogique (1 : celle d'avant) : derive lente des
 *   oscillateurs et petits ecarts par note (coupure, enveloppes, accord) ;
 *   0 : tout est stable et juste ;
 * - width : l'ecart stereo des notes (0.22 avant, SPREAD) ;
 * - keyTrack : la coupure suit la note (0.5 avant, KEY_TRACK) ;
 * - sync : OSC 2 repart a chaque cycle d'OSC 1 (hard sync) : il ne bat
 *   plus contre lui, son accord devient un timbre.
 * Les rangees d'oscillateurs facon Mini V (2026-10-04) : chaque oscillateur
 * a son accord (tune1, tune2 : RANGE et SEMI, en demi-tons) et son FINE
 * (fine1, fine2, en cents) ; ils remplacent TUNE 2 et l'ecart FINE de part
 * et d'autre de la note. Son ON (on1, on2, qui multipliait son gain) est
 * parti le 2026-10-11 (Mika : "si on veut pas les osc on coupe les
 * volumes") : osc1 ou osc2 a 0 le coupe, lisse de meme.
 * SUB (2026-10-10, Mika : "pour l'ARP rajoute un sub parametrable") : un
 * troisieme oscillateur, une ou deux octaves sous la note jouee (subOct : 1
 * ou 2), sinus, triangle ou carre (subWave : la forme 0, 1 ou 3), dose par
 * sub (lisse). Il suit la note (pas RANGE ni SEMI d'OSC 1), mais prend le
 * FINE et la derive d'OSC 1 : cale sur lui, il ne bat pas contre lui ; pas
 * de FM ni de SYNC (des graves propres) ; il passe par le filtre, comme les
 * autres. A 0, ni forme ni phase calculees (le son d'avant, au bit pres).
 * Jusqu'a 12 notes en meme temps (les queues de RELEASE se chevauchent) ;
 * au-dela, la plus ancienne repart de son niveau.
 * Notes recues avec leur instant (temps du contexte), jouees a
 * l'echantillon pres ; reglages lisses, sans craquement. Sortie stereo,
 * les effets suivent dans le graphe.
 *
 * Qualite (2026-10-03, Mika : "le son sortant de la meilleure qualite") :
 * tout le moteur tourne a OS fois la frequence du contexte (4 sur
 * ordinateur, 2 au telephone : processorOptions.os) ; les saturations
 * (entree du filtre, OVERDRIVE, sortie) ne replient presque plus leurs
 * harmoniques dans l'audible. Le retour a la frequence du contexte passe
 * par des filtres demi-bande en cascade (fenetre de Kaiser : 4x -> 2x en
 * 31 coefficients, 2x -> 1x en 63, environ -80 dB au-dessus de la bande
 * utile), calcules au demarrage.
 */

const MAX_VOICES = 12;
/** Surechantillonnage par defaut (sans processorOptions.os). */
const OS_DEFAULT = 4;

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
const TRACK_ROOT = 54;

function polyblep(t, dt) {
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

/** Impulsion de rapport d, centree (sans composante continue), PolyBLEP. */
function pulse(ph, dt, d) {
  let y = ph < d ? 1 : -1;
  y += polyblep(ph, dt);
  let t2 = ph - d;
  if (t2 < 0) t2 += 1;
  y -= polyblep(t2, dt);
  return y - (2 * d - 1);
}

const TAU = Math.PI * 2;
/** Cran FM de WAVE 1 : OSC 2 decale la phase d'OSC 1 de FM_INDEX x 0.16 cycle au plus (environ 1.6 rad). */
const FM_INDEX = 1.6;
/**
 * Potard FM (2026-10-03, Mika : "de la synthese FM, comme le Typhon") :
 * un operateur sinus module la phase d'OSC 1, quelle que soit sa forme ;
 * l'indice monte avec le carre du potard jusqu'a FM_MAX radians et suit
 * l'enveloppe du filtre (35 % fixe, 65 % par elle) : l'attaque brille, la
 * tenue s'adoucit. RATIO (meme jour) : la frequence de l'operateur, en
 * multiple d'OSC 1 (1/2 a 7) ; l'indice est borne pour que les bandes
 * laterales restent sous 0.4 x la frequence d'echantillonnage interne.
 */
const FM_MAX = 6;
/**
 * NOISE (2026-10-03, Mika) : un bruit blanc par voix entre dans le filtre
 * avec les oscillateurs (niveau au carre du potard, un nouveau tirage par
 * echantillon du contexte, tenu pendant le surechantillonnage : le meme
 * niveau a x2 et x4).
 * MODE du filtre (2026-10-04, apres SLOPE) : les sorties de l'echelle
 * melangees comme sur un Oberheim Xpander, la retroaction restant celle des
 * quatre etages : LP 24 (le quatrieme etage), LP 12 (le deuxieme, sa bosse
 * de resonance ramenee par SLOPE12_RES), BP (2 x (premier - deuxieme)),
 * HP (entree - 2 x premier + deuxieme) ; en fondu de 15 ms d'un mode a
 * l'autre. Les graves gardes (BASS_KEEP) seulement en passe-bas.
 * OSC 1 et OSC 2 (2026-10-04, a la place de MIX) : le gain de chaque
 * oscillateur, lisse.
 * MOD (2026-10-04) : un LFO commun aux notes, cale sur le tempo (un cycle
 * = lfoBeats temps), adouci en 2 ms (pas de clic) ; il pousse les formes
 * d'onde (+/-2 crans), la coupure (+/-3 octaves), la FM (+/-0.6), la
 * hauteur (+/-1 demi-ton) ou formes et coupure a moitie chacune, selon DEPTH.
 * Cale sur la mesure (2026-10-18, Mika : "dans les MOD je veux un random
 * aussi et qui se cale au beat") : sa phase ne tourne plus d'elle-meme
 * (avant, elle repartait a la premiere note apres un STOP, s'arretait a
 * chaque silence du moteur et gardait son avance a un changement de
 * tempo : elle quittait la grille). Elle se lit sur la position du
 * transport, en temps : a chaque pas, l'arpegiateur dit ou il en est
 * ('beat' : a tel instant, tel temps depuis le debut de sa premiere
 * mesure, a tel tempo), et entre deux pas la position suit la droite de la
 * derniere ancre. Un cycle part donc toujours pile sur la grille de sa
 * division (1/16 sur chaque double croche, 1 BAR sur chaque mesure, 4 BAR
 * sur les mesures 1, 5, 9... de l'arpege), apres un RUN, un tempo change ou
 * un silence. Arrete (STOP), il tourne librement au tempo (bpm) ; sans
 * ancre depuis une seconde (un onglet gele), un tempo qui change s'y
 * applique aussi tout de suite. Les formes (lfoShape) : 0 triangle, 1 dent de
 * scie, 2 carre, 3 S&H (une valeur par cycle, tiree pile a son debut,
 * tenue), 4 RND (le hasard lisse : de la valeur du cycle a la suivante, en
 * S, arrivee pile au debut du cycle suivant) ; deux valeurs de suite du
 * hasard s'ecartent d'au moins LFO_MIN_JUMP (un quart de la course, -1 a
 * +1) : il s'entend toujours, jamais un tirage presque pareil au precedent.
 */
const LFO_MIN_JUMP = 0.5;
/** Le tirage suivant du hasard de MOD : partout entre -1 et +1, sauf a moins de LFO_MIN_JUMP du precedent. */
function nextRandom(a) {
  const lo = Math.max(0, a - LFO_MIN_JUMP + 1);
  const hi = Math.max(0, 1 - a - LFO_MIN_JUMP);
  const r = Math.random() * (lo + hi);
  return r < lo ? -1 + r : a + LFO_MIN_JUMP + (r - lo);
}
const NOISE_MAX = 1;
const SLOPE12_RES = 0.12;
/**
 * Gains des modes passe-bande et passe-haut, ramenes au niveau du passe-bas
 * (mesure hors ligne, arpege par defaut) ; un peu moins quand la resonance
 * monte (leur bosse grandit plus vite que celle du passe-bas).
 */
const BP_GAIN = 1.25;
const BP_RES = 0.12;
const HP_GAIN = 1.7;
const HP_RES = 0.1;

/**
 * Une forme : 0 sinus, 1 triangle, 2 dent de scie, 3 carre, 4 impulsion
 * de 14 % (5 : FM, calculee a part). Toutes en phase (fondamentale en
 * +sin) : le triangle decale d'un quart, la dent de scie descendante ; le
 * morphing de l'une a l'autre garde sa fondamentale.
 */
function shape(ph, dt, w) {
  switch (w) {
    case 0:
      return Math.sin(TAU * ph);
    case 1: {
      let q = ph + 0.25;
      if (q >= 1) q -= 1;
      return 1 - 4 * Math.abs(q - 0.5);
    }
    case 2:
      return 1 - 2 * ph + polyblep(ph, dt);
    case 3:
      return pulse(ph, dt, 0.5);
    default:
      return pulse(ph, dt, 0.14);
  }
}

/** OSC 1, forme w : le cran FM (5) est la sinusoide modulee par OSC 2. */
function shape1(w, p1, d1, ph0, o2, pm) {
  return w === 5 ? Math.sin(TAU * (ph0 + FM_INDEX * o2 * 0.16 + pm)) : shape(p1, d1, w);
}

/** Saturation d'un etage du filtre (tanh rapide, rationnelle, bornee) : gain 1 en petit signal. */
const NL_A = 0.6;
function nl(x) {
  let z = x * NL_A;
  if (z > 3) z = 3;
  else if (z < -3) z = -3;
  const z2 = z * z;
  return (z * (27 + z2)) / (27 + 9 * z2) / NL_A;
}
/** Pente moyenne de nl entre a et b (la transconductance de l'etage). */
function tq(a, b, fa, fb) {
  const d = a - b;
  if (d > 1e-6 || d < -1e-6) return (fa - fb) / d;
  const t = fa * NL_A;
  return Math.max(0.05, 1 - t * t);
}
/** Les graves gardes quand la resonance monte (0.3 avant le 2026-10-03). */
const BASS_KEEP = 0.45;
/** Sous ce niveau d'enveloppe, une voix reprise peut repartir de la phase de PHASE sans clic. */
const PHASE_QUIET = 0.02;
/** Gain de sortie (1.5 avant le filtre a etages satures : recale au meme niveau, mesure hors ligne). */
const OUT_GAIN = 1.25;
/**
 * OVERDRIVE (2026-10-04, Mika : "pour ARP c'est pas DIST qu'on veut c'est
 * OVERDRIVE") : le montage d'une Tube Screamer plutot qu'un ecretage. Le
 * signal propre passe entier ; une copie privee de ses graves (passe-haut
 * OD_HP_HZ) est amplifiee (jusqu'a OD_GAIN fois), arrondie par une courbe
 * douce un peu asymetrique (OD_BIAS : des harmoniques paires, chaudes),
 * adoucie (passe-bas OD_TONE_HZ) et ajoutee. La basse reste ronde et
 * tendue, le grain vient dans les mediums ; le niveau est compense
 * (OD_TRIM). L'entree du filtre est poussee un peu (1 + 2.5 x), la
 * saturation de sortie des voix a peine (1 + 1.5 x) : avant (DIST), 1 + 5 x
 * et 1 + 7 x, un ecretage dur.
 */
const OD_HP_HZ = 720;
const OD_TONE_HZ = 4200;
const OD_GAIN = 40;
const OD_BIAS = 0.22;
const OD_TANH_BIAS = Math.tanh(OD_BIAS);
const OD_MIX = 0.42;
const OD_TRIM = 0.85;
/** La courbe de l'overdrive : douce, asymetrique, nulle a zero. */
const odCurve = (u) => Math.tanh(u + OD_BIAS) - OD_TANH_BIAS;

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const coef = (seconds, sr) => 1 - Math.exp(-1 / Math.max(1, seconds * sr));

class Voice {
  constructor() {
    this.on = false;
    this.midi = 60;
    this.logf = Math.log(261.6);
    this.logT = this.logf;
    // OSC 1, OSC 2, l'operateur FM, le SUB
    this.ph = [Math.random(), Math.random(), Math.random(), Math.random()];
    // Bruit : xorshift 32 bits, une graine par voix (jamais 0)
    this.seed = ((Math.random() * 0x7fffffff) | 0) | 1;
    this.nz = 0;
    this.drift = [0, 0];
    this.aStage = 0;
    this.aV = 0;
    this.fStage = 0;
    this.fV = 0;
    this.s1 = 0;
    this.s2 = 0;
    this.s3 = 0;
    this.s4 = 0;
    this.off = 0;
    this.accent = 1;
    this.age = 0;
    this.quick = false;
    // Les petits ecarts de la note (noteOn) : coupure, enveloppes, accord, place stereo
    this.vCut = 1;
    this.vEnv = 1;
    this.vTune = 0;
    this.gL = 1;
    this.gR = 1;
    // L'entree du premier etage au dernier echantillon (pente de sa saturation)
    this.pu = 0;
    // Recalcules une fois par echantillon du contexte (pas a chaque echantillon surechantillonne) :
    // les pas de phase et les gains des quatre etages
    this.d1 = 0;
    this.d2 = 0;
    this.d3 = 0;
    this.Ga = 0;
    this.Gb = 0;
    this.Gc = 0;
    this.Gd = 0;
  }
}

class MMVoyager extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.voices = [];
    for (let i = 0; i < MAX_VOICES; i += 1) this.voices.push(new Voice());
    this.queue = [];
    this.age = 0;
    const os = o.os === 1 || o.os === 2 || o.os === 4 ? o.os : OS_DEFAULT;
    this.os = os;
    this.sr2 = sampleRate * os;
    // Le bloc surechantillonne, l'etage intermediaire, et les decimateurs (4x -> 2x, 2x -> 1x)
    this.raw = new Float32Array(os * 128);
    this.rawR = new Float32Array(os * 128);
    this.mid = new Float32Array(256);
    this.midR = new Float32Array(256);
    this.d4 = os === 4 ? new Decimator(31, 7) : null;
    this.d2 = os >= 2 ? new Decimator(63, 8) : null;
    this.d4R = os === 4 ? new Decimator(31, 7) : null;
    this.d2R = os >= 2 ? new Decimator(63, 8) : null;
    // OVERDRIVE : etats des filtres de la branche saturee (gauche, droite) et coefficients a la frequence du calcul
    this.od = { hpL: 0, xL: 0, lpL: 0, hpR: 0, xR: 0, lpR: 0 };
    this.odHp = Math.exp((-2 * Math.PI * OD_HP_HZ) / this.sr2);
    this.odLp = 1 - Math.exp((-2 * Math.PI * OD_TONE_HZ) / this.sr2);
    // Une note a gauche, la suivante a droite
    this.flip = false;
    // MODE du filtre : le poids de chaque sortie (LP 24, LP 12, BP, HP), en fondu
    this.wm = [1, 0, 0, 0];
    // MOD : la sortie adoucie du LFO (sa phase vient du transport, plus bas)
    this.lfoOut = 0;
    this.lfoK = coef(0.002, this.sr2);
    this.p = {
      wave1: 2,
      wave2: 2,
      tune1: 0,
      tune2: -12,
      fine1: -8,
      fine2: 8,
      osc1: 0.62,
      osc2: 0.62,
      fm: 0,
      ratio: 1,
      glide: 0,
      noise: 0,
      fmode: 0,
      lfoBeats: 4,
      lfoShape: 0,
      lfoDest: 0,
      lfoAmt: 0,
      bpm: 130,
      cutoff: 800,
      res: 0.3,
      envOct: 3,
      fA: 0.001,
      fD: 0.3,
      fS: 0.2,
      fR: 0.3,
      aA: 0.002,
      aD: 0.35,
      aS: 0.6,
      aR: 0.3,
      drive: 0,
      phase: -1,
      drift: 1,
      width: 0.22,
      keyTrack: 0.5,
      sync: 0,
      sub: 0,
      subOct: 1,
      subWave: 0,
    };
    // Valeurs lissees (un pole, environ 15 ms) : pas de craquement quand un potard tourne
    this.sm = { w1: 2, w2: 2, o1: 0.62, o2: 0.62, fm: 0, noise: 0, sub: 0, lfoAmt: 0, f1: -8, f2: 8, cutoff: 800, res: 0.3, envOct: 3, drive: 0 };
    this.smK = coef(0.015, this.sr2);
    this.c = {};
    if (o.params) Object.assign(this.p, o.params);
    Object.assign(this.sm, { w1: this.p.wave1, w2: this.p.wave2, o1: this.p.osc1, o2: this.p.osc2, fm: this.p.fm, noise: this.p.noise, sub: this.p.sub, lfoAmt: this.p.lfoAmt, f1: this.p.fine1, f2: this.p.fine2, cutoff: this.p.cutoff, res: this.p.res, envOct: this.p.envOct, drive: this.p.drive });
    this.coefs();
    // MOD cale sur la mesure (2026-10-18) : la position du transport en temps, la droite de la derniere ancre
    // (temps = b + (echantillon - f) x k, k : temps par echantillon du contexte) ; libre au depart, au tempo
    this.tp = { f: currentFrame, b: 0, k: this.p.bpm / 60 / sampleRate, run: false };
    this.tpLocked = false;
    // Les ancres a venir (l'arpegiateur les envoie avec leur instant), dans l'ordre
    this.beats = [];
    // Le hasard (S&H, RND) : le cycle en cours, sa valeur et celle du cycle suivant
    this.rIdx = NaN;
    this.rA = Math.random() * 2 - 1;
    this.rB = nextRandom(this.rA);
    // Tests sans son (audio/synth.ts renderSynthOffline) : probe, la sortie dit le LFO (gauche : sa forme, droite :
    // la position en temps) ; timeline, des messages a leur instant, comme ceux du port
    this.probe = o.probe === true;
    this.pL = new Float32Array(128);
    this.pR = new Float32Array(128);
    this.timeline = Array.isArray(o.timeline) ? o.timeline.filter((x) => x && x.msg && Number.isFinite(x.at)).sort((a, b) => a.at - b.at) : [];
    if (o.notes) for (const n of o.notes) this.add(n);
    if (o.beats) for (const b of o.beats) this.addBeat(b);
    this.port.onmessage = (e) => this.onMsg(e.data);
  }

  /** Une ancre du transport ('beat') : a time (temps du contexte), la position beat (en temps), au tempo bpm jusqu'a la suivante ; run : le premier pas d'un RUN. */
  addBeat(m) {
    if (!m || !Number.isFinite(m.time) || !Number.isFinite(m.beat)) return;
    const bpm = Number.isFinite(m.bpm) && m.bpm > 0 ? m.bpm : this.p.bpm;
    // Son instant pose sur la grille surechantillonnee (comme une note sur son echantillon) : la frontiere d'un cycle
    // tombe sur un echantillon calcule, jamais a un bruit de flottant pres (un pas pile sur un echantillon)
    const OS = this.os;
    const a = { f: Math.round(m.time * sampleRate * OS) / OS, b: m.beat, k: bpm / 60 / sampleRate, run: m.run === true };
    const q = this.beats;
    let i = q.length;
    while (i > 0 && q[i - 1].f > a.f) i -= 1;
    q.splice(i, 0, a);
  }

  /** Les ancres arrivees a l'echantillon x (fractionnaire au surechantillonnage) : la derniere tient la position. */
  dueBeats(x) {
    const q = this.beats;
    while (q.length > 0 && q[0].f <= x) {
      const a = q.shift();
      this.tp = a;
      this.tpLocked = true;
      // Un RUN : le hasard repart d'un nouveau tirage
      if (a.run) this.rIdx = NaN;
    }
  }

  /** La position du transport (en temps) a l'echantillon x. */
  beatAt(x) {
    const tp = this.tp;
    return tp.b + (x - tp.f) * tp.k;
  }

  /** Le transport libre (STOP, tempo change a l'arret) : il continue d'ou il est, au tempo du moment. */
  freeRun(x) {
    this.tp = { f: x, b: this.beatAt(x), k: this.p.bpm / 60 / sampleRate, run: false };
    this.tpLocked = false;
  }

  /**
   * MOD : la forme du LFO a la position cyc (en cycles depuis le debut du transport) ; le hasard avance pile au debut
   * de chaque cycle (la valeur du cycle : celle qu'il visait, puis un nouveau tirage pour le suivant).
   */
  lfoRaw(cyc, shape) {
    const c = Math.floor(cyc);
    if (c !== this.rIdx) {
      this.rIdx = c;
      this.rA = this.rB;
      this.rB = nextRandom(this.rA);
    }
    const ph = cyc - c;
    switch (shape) {
      case 1:
        return 1 - 2 * ph;
      case 2:
        return ph < 0.5 ? 1 : -1;
      case 3:
        return this.rA;
      case 4:
        return this.rA + (this.rB - this.rA) * ph * ph * (3 - 2 * ph);
      default:
        return 1 - 4 * Math.abs(ph - 0.5);
    }
  }

  coefs() {
    // Les enveloppes et GLIDE avancent a la frequence surechantillonnee
    const sr = this.sr2;
    const p = this.p;
    // Attaque vers 1.3 : elle atteint 1 en A (courbe de condensateur)
    this.c.aAtk = coef(p.aA / 1.466, sr);
    this.c.fAtk = coef(p.fA / 1.466, sr);
    // Decroissance et relachement : -40 dB en D et R
    this.c.aDec = coef(p.aD / 4.6, sr);
    this.c.fDec = coef(p.fD / 4.6, sr);
    this.c.aRel = coef(p.aR / 4.6, sr);
    this.c.fRel = coef(p.fR / 4.6, sr);
    this.c.quick = coef(0.012, sr);
    this.c.glide = p.glide > 0 ? coef(p.glide / 3, sr) : 1;
  }

  add(n) {
    const frame = Math.round(n.time * sampleRate);
    const q = this.queue;
    let i = q.length;
    while (i > 0 && q[i - 1].frame > frame) i -= 1;
    q.splice(i, 0, { frame, midi: n.midi, gate: n.gate, accent: n.accent || 1, from: n.from == null ? null : n.from });
  }

  onMsg(m) {
    if (m.type === 'note') this.add(m);
    else if (m.type === 'beat') this.addBeat(m);
    else if (m.type === 'params') {
      Object.assign(this.p, m.params);
      this.coefs();
      // Un tempo, transport libre (ou plus d'ancre depuis une seconde) : la position continue au nouveau tempo ;
      // en lecture, ce sont les ancres qui portent le tempo, a la frontiere de pas ou il change
      const stale = this.beats.length === 0 && currentFrame - this.tp.f > sampleRate;
      if (m.params && m.params.bpm > 0 && (!this.tpLocked || stale)) this.freeRun(currentFrame);
    } else if (m.type === 'probe') {
      // Debug (window.__v4.voyager.synth.lfo) : le LFO maintenant, lu par le meme calcul que le son
      const x = currentFrame;
      this.dueBeats(x);
      const beat = this.beatAt(x);
      const cycle = beat / Math.max(0.0625, this.p.lfoBeats);
      const raw = this.lfoRaw(cycle, this.p.lfoShape);
      this.port.postMessage({ type: 'probe', id: m.id, frame: x, beat, cycle, raw, out: this.lfoOut, locked: this.tpLocked, bpm: this.tp.k * 60 * sampleRate, shape: this.p.lfoShape, pending: this.beats.length });
    } else if (m.type === 'cancel') {
      // Re-programmation (2026-10-05) : les notes attendues a partir de time sont oubliees, ce qui sonne continue ;
      // les ancres du transport aussi (2026-10-18 : l'arpegiateur renvoie les memes)
      const f = Math.round((m.time || 0) * sampleRate);
      this.queue = this.queue.filter((n) => n.frame < f);
      this.beats = this.beats.filter((a) => a.f < f - 0.5);
    } else if (m.type === 'stop') {
      // STOP : plus rien d'attendu, ce qui sonne s'eteint en 12 ms ; le LFO tourne librement au tempo
      const f = Math.round((m.time || 0) * sampleRate);
      this.queue = this.queue.filter((n) => n.frame < f);
      // Le transport s'arrete : les ancres passees comptent, celles a venir n'ont plus de sens
      this.dueBeats(currentFrame);
      this.beats.length = 0;
      this.freeRun(currentFrame);
      for (const v of this.voices) {
        if (!v.on) continue;
        v.aStage = 3;
        v.fStage = 3;
        v.quick = true;
      }
    }
  }

  noteOn(n, frame) {
    let v = null;
    for (const x of this.voices) if (!x.on) v = v && v.age < x.age ? v : x;
    if (!v) {
      // Plus de voix libre : la plus ancienne repart de son niveau (pas de clic)
      for (const x of this.voices) if (!v || x.age < v.age) v = x;
    } else {
      // Une voix neuve : filtre au repos, phases libres
      v.s1 = v.s2 = v.s3 = v.s4 = 0;
      v.pu = 0;
      v.Ga = 0;
      v.aV = 0;
      v.fV = 0;
    }
    const target = Math.log(midiHz(n.midi));
    v.logT = target;
    v.logf = this.p.glide > 0 && n.from !== null ? Math.log(midiHz(n.from)) : target;
    v.midi = n.midi;
    // Nouvelle hauteur : les pas de phase se recalculent au prochain echantillon
    v.d1 = 0;
    v.on = true;
    v.quick = false;
    v.aStage = 1;
    v.fStage = 1;
    v.off = frame + Math.max(64, Math.round(n.gate * sampleRate));
    v.accent = n.accent;
    // PHASE : la note repart de la meme phase (voix muette ou presque : pas de clic)
    const p = this.p;
    if (p.phase >= 0 && v.aV < PHASE_QUIET) {
      v.ph[0] = p.phase;
      v.ph[1] = p.phase;
      v.ph[2] = p.phase;
      v.ph[3] = p.phase;
    }
    // Presque analogique (DRIFT) : chaque note a ses petits ecarts, et sa place dans l'image (WIDTH)
    const dr = p.drift;
    v.vCut = Math.pow(2, (Math.random() - 0.5) * 0.08 * dr);
    v.vEnv = 1 + (Math.random() - 0.5) * 0.1 * dr;
    v.vTune = (Math.random() - 0.5) * 3 * dr;
    this.flip = !this.flip;
    const pan = (this.flip ? 1 : -1) * p.width * (0.7 + 0.3 * Math.random());
    v.gL = Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    v.gR = Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    this.age += 1;
    v.age = this.age;
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out.length > 1 ? out[1] : null;
    const N = L.length;
    const sr = this.sr2;
    const t0 = currentFrame;
    // Tests (processorOptions.timeline) : les messages dont l'instant est venu, entre deux blocs comme ceux du port
    const tl = this.timeline;
    while (tl.length > 0 && tl[0].at * sampleRate <= t0) this.onMsg(tl.shift().msg);
    const q = this.queue;
    const lfoBeats = Math.max(0.0625, this.p.lfoBeats);
    let active = false;
    for (const v of this.voices) if (v.on) active = true;
    if (!this.probe && !active && (q.length === 0 || q[0].frame >= t0 + N)) {
      L.fill(0);
      if (R) R.fill(0);
      // Silence : l'historique des demi-bandes repart a zero
      if (this.d4) this.d4.clear();
      if (this.d2) this.d2.clear();
      if (this.d4R) this.d4R.clear();
      if (this.d2R) this.d2R.clear();
      // MOD : le transport avance quand meme (ses ancres, le hasard tire au debut de chaque cycle) ; la sortie du
      // LFO y est deja quand une note revient
      const x = t0 + N - 1;
      this.dueBeats(x);
      this.lfoOut = this.lfoRaw(this.beatAt(x) / lfoBeats, this.p.lfoShape);
      return true;
    }
    // Derive lente des oscillateurs : une marche au hasard bornee, une fois par bloc
    for (const v of this.voices) {
      if (!v.on) continue;
      for (let k = 0; k < 2; k += 1) {
        let d = v.drift[k] * 0.995 + (Math.random() - 0.5) * 0.35;
        if (d > 3) d = 3;
        else if (d < -3) d = -3;
        v.drift[k] = d;
      }
    }
    const p = this.p;
    const sm = this.sm;
    const c = this.c;
    const K = this.smK;
    // La coupure du filtre reste sous la bande utile du contexte
    const nyq = sampleRate * 0.45;
    const OS = this.os;
    if (this.raw.length < OS * N) {
      this.raw = new Float32Array(OS * N);
      this.rawR = new Float32Array(OS * N);
    }
    if (this.mid.length < 2 * N) {
      this.mid = new Float32Array(2 * N);
      this.midR = new Float32Array(2 * N);
    }
    const raw = this.raw;
    const rawR = this.rawR;
    const beats = this.beats;
    const probe = this.probe;
    if (probe && this.pL.length < N) {
      this.pL = new Float32Array(N);
      this.pR = new Float32Array(N);
    }
    for (let i2 = 0; i2 < OS * N; i2 += 1) {
      const i = (i2 / OS) | 0;
      const fr = t0 + i;
      if (i2 % OS === 0) while (q.length > 0 && q[0].frame <= fr) this.noteOn(q.shift(), fr);
      // MOD : la position du transport a cet echantillon (une ancre de l'arpege prend effet a son instant exact,
      // au surechantillonnage pres), en cycles du LFO, puis sa forme, adoucie
      const x = fr + (i2 - i * OS) / OS;
      if (beats.length > 0 && beats[0].f <= x) this.dueBeats(x);
      const tp = this.tp;
      const pos = tp.b + (x - tp.f) * tp.k;
      const lraw = this.lfoRaw(pos / lfoBeats, p.lfoShape);
      if (probe && i2 - i * OS === 0) {
        this.pL[i] = lraw;
        this.pR[i] = pos;
      }
      this.lfoOut += (lraw - this.lfoOut) * this.lfoK;
      sm.lfoAmt += (p.lfoAmt - sm.lfoAmt) * K;
      const lfo = this.lfoOut * sm.lfoAmt;
      const dest = p.lfoDest;
      const waveMod = dest === 0 ? 2 * lfo : dest === 4 ? lfo : 0;
      const cutMod = dest === 1 ? 3 * lfo : dest === 4 ? 1.5 * lfo : 0;
      const pitchMod = dest === 3 ? 100 * lfo : 0;
      sm.fm += (p.fm - sm.fm) * K;
      const fmEff = dest === 2 ? Math.min(1, Math.max(0, sm.fm + 0.6 * lfo)) : sm.fm;
      const fmDepth = fmEff * fmEff * FM_MAX;
      sm.noise += (p.noise - sm.noise) * K;
      const nGain = sm.noise * sm.noise * NOISE_MAX;
      // SUB : son gain (deja au carre, params.ts), son octave sous la note, sa forme
      sm.sub += (p.sub - sm.sub) * K;
      const g3 = sm.sub;
      const subDiv = p.subOct === 2 ? 0.25 : 0.5;
      const subW = p.subWave === 1 ? 1 : p.subWave === 3 ? 3 : 0;
      const newNoise = i2 % OS === 0;
      // MODE du filtre : chaque sortie glisse vers son poids (1 pour le mode choisi)
      const wm = this.wm;
      for (let m = 0; m < 4; m += 1) wm[m] += ((m === p.fmode ? 1 : 0) - wm[m]) * K;
      // WAVE : la position de chaque morphing (lissee, poussee par MOD), la forme de depart et la part de la suivante
      sm.w1 += (p.wave1 - sm.w1) * K;
      sm.w2 += (p.wave2 - sm.w2) * K;
      const pw1 = Math.min(5, Math.max(0, sm.w1 + waveMod));
      const pw2 = Math.min(4, Math.max(0, sm.w2 + 0.8 * waveMod));
      const i1 = Math.min(4, Math.floor(pw1));
      const f1m = pw1 - i1;
      const i2w = Math.min(3, Math.floor(pw2));
      const f2m = pw2 - i2w;
      // OSC 1 et OSC 2 : le gain de chaque oscillateur (0.62 chacun au depart, le MIX au centre d'avant) ; a 0, coupe (lisse, pas de clic)
      sm.o1 += (p.osc1 - sm.o1) * K;
      sm.o2 += (p.osc2 - sm.o2) * K;
      const g1 = sm.o1;
      const g2 = sm.o2;
      // RANGE et SEMI de chaque oscillateur ; FINE en cents, lisse
      const ratio1 = Math.pow(2, p.tune1 / 12);
      const ratio2 = Math.pow(2, p.tune2 / 12);
      sm.f1 += (p.fine1 - sm.f1) * K;
      sm.f2 += (p.fine2 - sm.f2) * K;
      const fine1 = sm.f1;
      const fine2 = sm.f2;
      sm.cutoff += (p.cutoff - sm.cutoff) * K;
      sm.res += (p.res - sm.res) * K;
      sm.envOct += (p.envOct - sm.envOct) * K;
      sm.drive += (p.drive - sm.drive) * K;
      const k = sm.res * 4.1;
      const driveIn = 1 + 2.5 * sm.drive;
      const driveOut = 1 + 1.5 * sm.drive;
      // OVERDRIVE : le gain de la branche saturee (progressif : les premiers crans chauffent a peine)
      const odGain = 1 + OD_GAIN * sm.drive * sm.drive;
      const odMix = OD_MIX * Math.min(1, sm.drive * 4);
      const odTrim = 1 / (1 + OD_TRIM * sm.drive);
      const drift = p.drift;
      const sync = p.sync === 1;
      let sum = 0;
      let sumR = 0;
      for (let vi = 0; vi < MAX_VOICES; vi += 1) {
        const v = this.voices[vi];
        if (!v.on) continue;
        // Enveloppes
        if (v.aStage < 3 && fr >= v.off) {
          v.aStage = 3;
          v.fStage = 3;
        }
        const ve = v.vEnv;
        if (v.aStage === 1) {
          v.aV += (1.3 - v.aV) * c.aAtk * ve;
          if (v.aV >= 1) {
            v.aV = 1;
            v.aStage = 2;
          }
        } else if (v.aStage === 2) v.aV += (p.aS - v.aV) * c.aDec * ve;
        else {
          v.aV -= v.aV * (v.quick ? c.quick : c.aRel * ve);
          if (v.aV < 0.00005) {
            v.on = false;
            continue;
          }
        }
        if (v.fStage === 1) {
          v.fV += (1.3 - v.fV) * c.fAtk * ve;
          if (v.fV >= 1) {
            v.fV = 1;
            v.fStage = 2;
          }
        } else if (v.fStage === 2) v.fV += (p.fS - v.fV) * c.fDec * ve;
        else v.fV -= v.fV * c.fRel * ve;
        // Hauteur et oscillateurs (les pas de phase : une fois par echantillon du contexte)
        v.logf += (v.logT - v.logf) * c.glide;
        const ph = v.ph;
        if (newNoise || v.d1 === 0) {
          const f = Math.exp(v.logf);
          v.d1 = (f * ratio1 * Math.pow(2, (v.drift[0] * drift + fine1 + v.vTune + pitchMod) / 1200)) / sr;
          v.d2 = (f * ratio2 * Math.pow(2, (v.drift[1] * drift + fine2 + v.vTune + pitchMod) / 1200)) / sr;
          // SUB : la note, une ou deux octaves dessous, avec le FINE et la derive d'OSC 1 (le pas d'OSC 1 sans son RANGE ni son SEMI)
          v.d3 = (v.d1 * subDiv) / ratio1;
        }
        const d1 = v.d1;
        const d2 = v.d2;
        // FM : l'operateur decale la phase des DEUX oscillateurs (indice en radians, suivi de l'enveloppe du filtre)
        const dm = d1 * p.ratio;
        const idx = fmDepth > 0 ? Math.min(fmDepth * (0.35 + 0.65 * Math.min(1, v.fV)), Math.max(0, 0.4 / dm - 1)) : 0;
        const pm = idx > 0 ? (idx * Math.sin(TAU * ph[2])) / TAU : 0;
        // OSC 2 d'abord : il module OSC 1 au cran FM ; chaque forme fondue dans la suivante
        let q2 = ph[1] + pm;
        q2 -= Math.floor(q2);
        let o2 = shape(q2, d2, i2w);
        if (f2m > 1e-4) o2 += (shape(q2, d2, i2w + 1) - o2) * f2m;
        let p1 = ph[0] + pm;
        p1 -= Math.floor(p1);
        let o1 = shape1(i1, p1, d1, ph[0], o2, pm);
        if (f1m > 1e-4) o1 += (shape1(i1 + 1, p1, d1, ph[0], o2, pm) - o1) * f1m;
        let o = g1 * o1 + g2 * o2;
        // SUB coupe : sa phase s'arrete (il revient en fondu depuis 0, pas de clic)
        if (g3 > 1e-6) {
          o += g3 * shape(ph[3], v.d3, subW);
          ph[3] += v.d3;
          if (ph[3] >= 1) ph[3] -= Math.floor(ph[3]);
        }
        if (nGain > 1e-6) {
          if (newNoise) {
            let x = v.seed;
            x ^= x << 13;
            x ^= x >>> 17;
            x ^= x << 5;
            v.seed = x;
            v.nz = x / 2147483648;
          }
          o += nGain * v.nz;
        }
        ph[0] += d1;
        ph[1] += d2;
        if (ph[0] >= 1) {
          ph[0] -= 1;
          // SYNC : OSC 2 repart avec OSC 1, a la fraction d'echantillon pres
          if (sync) ph[1] = (ph[0] / d1) * d2;
        }
        if (ph[1] >= 1) ph[1] -= Math.floor(ph[1]);
        ph[2] += dm;
        ph[2] -= Math.floor(ph[2]);
        // Filtre en echelle : coupure (enveloppe, accent, suivi du clavier), retroaction resolue
        // Coupure et pentes des etages : une fois par echantillon du contexte (elles bougent lentement a cette echelle)
        if (newNoise || v.Ga === 0) {
          let fc = sm.cutoff * v.vCut * Math.pow(2, cutMod + sm.envOct * v.fV * (0.8 + 0.2 * v.accent) + (p.keyTrack * (v.midi - TRACK_ROOT)) / 12);
          if (fc > nyq) fc = nyq;
          else if (fc < 20) fc = 20;
          const g = Math.tan((Math.PI * fc) / sr);
          // Chaque etage sature : sa pente au point de son etat (Mystran), puis l'echelle lineaire
          const fu = nl(v.pu);
          const fs1 = nl(v.s1);
          const fs2 = nl(v.s2);
          const fs3 = nl(v.s3);
          const fs4 = nl(v.s4);
          const ga = g * tq(v.pu, v.s1, fu, fs1);
          const gb = g * tq(v.s1, v.s2, fs1, fs2);
          const gc = g * tq(v.s2, v.s3, fs2, fs3);
          const gd = g * tq(v.s3, v.s4, fs3, fs4);
          v.Ga = ga / (1 + ga);
          v.Gb = gb / (1 + gb);
          v.Gc = gc / (1 + gc);
          v.Gd = gd / (1 + gd);
        }
        const Ga = v.Ga;
        const Gb = v.Gb;
        const Gc = v.Gc;
        const Gd = v.Gd;
        const S = Gd * Gc * Gb * (1 - Ga) * v.s1 + Gd * Gc * (1 - Gb) * v.s2 + Gd * (1 - Gc) * v.s3 + (1 - Gd) * v.s4;
        const u = (o * driveIn - k * S) / (1 + k * Ga * Gb * Gc * Gd);
        v.pu = u;
        let w = (u - v.s1) * Ga;
        let y = w + v.s1;
        v.s1 = y + w;
        const y1 = y;
        w = (y - v.s2) * Gb;
        y = w + v.s2;
        v.s2 = y + w;
        const y2 = y;
        w = (y - v.s3) * Gc;
        y = w + v.s3;
        v.s3 = y + w;
        w = (y - v.s4) * Gd;
        y = w + v.s4;
        v.s4 = y + w;
        // MODE : les sorties de l'echelle melangees (Xpander) ; les graves gardes en passe-bas (BASS_KEEP)
        const keep = 1 + k * BASS_KEEP;
        let out = 0;
        if (wm[0] > 1e-4) out += wm[0] * y * keep;
        if (wm[1] > 1e-4) out += (wm[1] * y2 * keep) / (1 + k * SLOPE12_RES);
        if (wm[2] > 1e-4) out += (wm[2] * 2 * (y1 - y2) * BP_GAIN) / (1 + k * BP_RES);
        if (wm[3] > 1e-4) out += (wm[3] * (u - 2 * y1 + y2) * HP_GAIN) / (1 + k * HP_RES);
        y = out;
        // VCA, saturation de sortie (OVERDRIVE la pousse a peine), puis la place de la note dans l'image
        let a = y * v.aV * v.accent;
        a = Math.tanh(a * driveOut) / Math.pow(driveOut, 0.82);
        sum += a * v.gL;
        sumR += a * v.gR;
      }
      // OVERDRIVE : le propre + la branche sans graves, amplifiee, arrondie, adoucie
      if (odMix > 1e-4) {
        const od = this.od;
        const hpA = this.odHp;
        const lpA = this.odLp;
        od.hpL = hpA * (od.hpL + sum - od.xL);
        od.xL = sum;
        od.lpL += (odCurve(od.hpL * odGain) - od.lpL) * lpA;
        sum = (sum + od.lpL * odMix) * odTrim;
        od.hpR = hpA * (od.hpR + sumR - od.xR);
        od.xR = sumR;
        od.lpR += (odCurve(od.hpR * odGain) - od.lpR) * lpA;
        sumR = (sumR + od.lpR * odMix) * odTrim;
      }
      raw[i2] = sum * OUT_GAIN;
      rawR[i2] = sumR * OUT_GAIN;
    }
    // Retour a la frequence du contexte : les demi-bandes en cascade, un canal chacune
    if (OS === 4) {
      this.d4.run(raw, 4 * N, this.mid);
      this.d2.run(this.mid, 2 * N, L);
      if (R) {
        this.d4R.run(rawR, 4 * N, this.midR);
        this.d2R.run(this.midR, 2 * N, R);
      }
    } else if (OS === 2) {
      this.d2.run(raw, 2 * N, L);
      if (R) this.d2R.run(rawR, 2 * N, R);
    } else {
      L.set(raw.subarray(0, N));
      if (R) R.set(rawR.subarray(0, N));
    }
    // Tests : la sortie dit le LFO, a chaque echantillon du contexte (sa forme, la position en temps)
    if (probe) {
      L.set(this.pL.subarray(0, N));
      if (R) R.set(this.pR.subarray(0, N));
    }
    return true;
  }
}

registerProcessor('mm-voyager', MMVoyager);
