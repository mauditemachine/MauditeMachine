/**
 * MM-VOYAGER : le moteur (AudioWorklet, 2026-10-03). Le plus pres possible
 * d'un Minimoog Voyager dans un navigateur, calcule echantillon par
 * echantillon :
 * - deux oscillateurs par note, facon Dreadbox Typhon (2026-10-03) : WAVE
 *   fait MORPHER chaque oscillateur d'une forme a la suivante (sinus,
 *   triangle, dent de scie, carre, impulsion ; OSC 1 finit sur la FM, sa
 *   sinusoide modulee par OSC 2) ; les formes ont toutes leur fondamentale
 *   en phase, le fondu de l'une a l'autre ne creuse jamais le son. OSC 2
 *   accorde par TUNE 2 (crans musicaux), les deux ecartes par FINE de part
 *   et d'autre (le centre reste juste), doses par MIX ; sans repliement
 *   (PolyBLEP) ; chaque oscillateur derive lentement (quelques cents, comme
 *   un VCO) ; l'operateur FM module les DEUX oscillateurs ;
 * - presque analogique (2026-10-03, Mika : "presque du analog") : chaque
 *   note a ses petits ecarts, comme les voix d'un vrai polyphonique (la
 *   coupure a +/- 2.8 %, les enveloppes a +/- 5 %, l'accord a +/- 1.5
 *   cent), et sa place dans l'image stereo (une note a gauche, la suivante
 *   a droite, de peu : SPREAD) ;
 * - le filtre en echelle 24 dB (quatre poles, retroaction resolue sans
 *   retard) a saturation DANS chaque etage, comme les transistors d'un
 *   Moog (la methode "cheap" de Mystran : chaque etage prend la pente de
 *   sa tangente hyperbolique au point de l'echantillon precedent, puis
 *   l'echelle se resout lineairement, sans retard) : les forts signaux
 *   arrondissent, la resonance s'auto-limite en chantant ; les graves
 *   fondent moins quand elle monte (BASS_KEEP) ; DIST pousse son entree
 *   puis sature la sortie ;
 * - deux enveloppes ADSR a courbes de condensateur (attaque vers 1.3,
 *   decroissance et relachement exponentiels), redeclenchees depuis leur
 *   niveau : jamais de clic ;
 * - GLIDE glisse depuis la note precedente en hauteur logarithmique.
 * Jusqu'a 12 notes en meme temps (les queues de RELEASE se chevauchent) ;
 * au-dela, la plus ancienne repart de son niveau.
 * Notes recues avec leur instant (temps du contexte), jouees a
 * l'echantillon pres ; reglages lisses, sans craquement. Sortie stereo,
 * les effets suivent dans le graphe.
 *
 * Qualite (2026-10-03, Mika : "le son sortant de la meilleure qualite") :
 * tout le moteur tourne a OS fois la frequence du contexte (4 sur
 * ordinateur, 2 au telephone : processorOptions.os) ; les saturations
 * (entree du filtre, DIST, sortie) ne replient presque plus leurs
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
const KEY_TRACK = 0.5;

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
 * NOISE et SLOPE (2026-10-03, Mika) : un bruit blanc par voix entre dans le
 * filtre avec les oscillateurs (niveau au carre du potard, un nouveau tirage
 * par echantillon du contexte, tenu pendant le surechantillonnage : le meme
 * niveau a x2 et x4). SLOPE prend la sortie apres deux etages de l'echelle
 * (12 dB par octave, la retroaction reste celle des quatre) ou apres quatre
 * (24 dB), en fondu de 15 ms ; a 12 dB la bosse de resonance, deux fois plus
 * haute a cet etage, est ramenee par SLOPE12_RES.
 */
const NOISE_MAX = 1;
const SLOPE12_RES = 0.12;

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
/** Ecart stereo des notes (0 : au centre, 1 : tout a gauche ou a droite). */
const SPREAD = 0.22;
/** Gain de sortie (1.5 avant le filtre a etages satures : recale au meme niveau, mesure hors ligne). */
const OUT_GAIN = 1.25;

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const coef = (seconds, sr) => 1 - Math.exp(-1 / Math.max(1, seconds * sr));

class Voice {
  constructor() {
    this.on = false;
    this.midi = 60;
    this.logf = Math.log(261.6);
    this.logT = this.logf;
    this.ph = [Math.random(), Math.random(), Math.random()];
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
    // Une note a gauche, la suivante a droite
    this.flip = false;
    this.p = {
      wave1: 2,
      wave2: 2,
      tune2: -12,
      mix: 0.5,
      fm: 0,
      ratio: 1,
      fine: 15,
      glide: 0,
      noise: 0,
      slope: 1,
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
    };
    // Valeurs lissees (un pole, environ 15 ms) : pas de craquement quand un potard tourne
    this.sm = { w1: 2, w2: 2, mix: 0.5, fm: 0, noise: 0, slope: 1, fine: 15, cutoff: 800, res: 0.3, envOct: 3, drive: 0 };
    this.smK = coef(0.015, this.sr2);
    this.c = {};
    if (o.params) Object.assign(this.p, o.params);
    Object.assign(this.sm, { w1: this.p.wave1, w2: this.p.wave2, mix: this.p.mix, fm: this.p.fm, noise: this.p.noise, slope: this.p.slope, fine: this.p.fine, cutoff: this.p.cutoff, res: this.p.res, envOct: this.p.envOct, drive: this.p.drive });
    this.coefs();
    if (o.notes) for (const n of o.notes) this.add(n);
    this.port.onmessage = (e) => this.onMsg(e.data);
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
    else if (m.type === 'params') {
      Object.assign(this.p, m.params);
      this.coefs();
    } else if (m.type === 'stop') {
      // STOP : plus rien d'attendu, ce qui sonne s'eteint en 12 ms
      const f = Math.round((m.time || 0) * sampleRate);
      this.queue = this.queue.filter((n) => n.frame < f);
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
    // Presque analogique : chaque note a ses petits ecarts, et sa place dans l'image
    v.vCut = Math.pow(2, (Math.random() - 0.5) * 0.08);
    v.vEnv = 1 + (Math.random() - 0.5) * 0.1;
    v.vTune = (Math.random() - 0.5) * 3;
    this.flip = !this.flip;
    const pan = (this.flip ? 1 : -1) * SPREAD * (0.7 + 0.3 * Math.random());
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
    const q = this.queue;
    let active = false;
    for (const v of this.voices) if (v.on) active = true;
    if (!active && (q.length === 0 || q[0].frame >= t0 + N)) {
      L.fill(0);
      if (R) R.fill(0);
      // Silence : l'historique des demi-bandes repart a zero
      if (this.d4) this.d4.clear();
      if (this.d2) this.d2.clear();
      if (this.d4R) this.d4R.clear();
      if (this.d2R) this.d2R.clear();
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
    for (let i2 = 0; i2 < OS * N; i2 += 1) {
      const i = (i2 / OS) | 0;
      const fr = t0 + i;
      if (i2 % OS === 0) while (q.length > 0 && q[0].frame <= fr) this.noteOn(q.shift(), fr);
      sm.mix += (p.mix - sm.mix) * K;
      sm.fm += (p.fm - sm.fm) * K;
      const fmDepth = sm.fm * sm.fm * FM_MAX;
      sm.noise += (p.noise - sm.noise) * K;
      sm.slope += (p.slope - sm.slope) * K;
      const nGain = sm.noise * sm.noise * NOISE_MAX;
      const newNoise = i2 % OS === 0;
      // WAVE : la position de chaque morphing (lissee), la forme de depart et la part de la suivante
      sm.w1 += (p.wave1 - sm.w1) * K;
      sm.w2 += (p.wave2 - sm.w2) * K;
      const i1 = Math.min(4, Math.max(0, Math.floor(sm.w1)));
      const f1m = sm.w1 - i1;
      const i2w = Math.min(3, Math.max(0, Math.floor(sm.w2)));
      const f2m = sm.w2 - i2w;
      // MIX a puissance constante : 0.62 chacun au milieu, 0.88 seul a un bout
      const g1 = 0.88 * Math.cos((sm.mix * Math.PI) / 2);
      const g2 = 0.88 * Math.sin((sm.mix * Math.PI) / 2);
      const ratio2 = Math.pow(2, p.tune2 / 12);
      sm.fine += (p.fine - sm.fine) * K;
      sm.cutoff += (p.cutoff - sm.cutoff) * K;
      sm.res += (p.res - sm.res) * K;
      sm.envOct += (p.envOct - sm.envOct) * K;
      sm.drive += (p.drive - sm.drive) * K;
      const k = sm.res * 4.1;
      const driveIn = 1 + 5 * sm.drive;
      const driveOut = 1 + 7 * sm.drive;
      const half = sm.fine / 2;
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
          v.d1 = (f * Math.pow(2, (v.drift[0] - half + v.vTune) / 1200)) / sr;
          v.d2 = (f * ratio2 * Math.pow(2, (v.drift[1] + half + v.vTune) / 1200)) / sr;
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
        if (ph[0] >= 1) ph[0] -= 1;
        ph[1] += d2;
        if (ph[1] >= 1) ph[1] -= 1;
        ph[2] += dm;
        ph[2] -= Math.floor(ph[2]);
        // Filtre en echelle : coupure (enveloppe, accent, suivi du clavier), retroaction resolue
        // Coupure et pentes des etages : une fois par echantillon du contexte (elles bougent lentement a cette echelle)
        if (newNoise || v.Ga === 0) {
          let fc = sm.cutoff * v.vCut * Math.pow(2, sm.envOct * v.fV * (0.8 + 0.2 * v.accent) + (KEY_TRACK * (v.midi - TRACK_ROOT)) / 12);
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
        // SLOPE : 12 dB (deux etages) ou 24 dB (quatre), en fondu
        if (sm.slope < 0.9999) y = y * sm.slope + (y2 / (1 + k * SLOPE12_RES)) * (1 - sm.slope);
        // Les graves fondent avec la resonance : une bonne partie reprise
        y *= 1 + k * BASS_KEEP;
        // VCA, saturation de sortie (DIST la pousse), puis la place de la note dans l'image
        let a = y * v.aV * v.accent;
        a = Math.tanh(a * driveOut) / Math.pow(driveOut, 0.82);
        sum += a * v.gL;
        sumR += a * v.gR;
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
    return true;
  }
}

registerProcessor('mm-voyager', MMVoyager);
