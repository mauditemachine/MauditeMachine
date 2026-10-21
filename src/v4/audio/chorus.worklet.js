/**
 * Les chorus a retard module, sans interpolation lineaire (2026-10-04,
 * Mika : "la meilleure des meilleures qualites", a l'ecoute aux Sennheiser
 * IE900). Le DelayNode du navigateur lit ses retards fractionnaires en
 * interpolation lineaire : un filtre passe-bas qui bouge avec la
 * modulation (jusqu'a -5 dB vers 15 kHz), des aigus ternis qui flottent.
 * Ici : une ligne circulaire par canal, lue en interpolation sinc fenetree
 * (16 points, fenetre de Kaiser, table de 512 phases : plate a 0.1 dB pres
 * jusque vers 19 kHz, quel que soit le retard), les LFO calcules a chaque
 * echantillon. Le mouille seul
 * (le sec et le dosage restent a l'insert, chorus.ts). Deux sortes :
 * - 'bus' (la boite a rythmes et ses voix) : deux voix, chacune un retard
 *   de base module par un sinus lent, chacune placee comme un
 *   StereoPannerNode le ferait d'une entree mono (memes formules que les
 *   DelayNode de secours). Depuis le 2026-10-21 (audit F5, F10, M2) la voix
 *   de gauche ne lit que le canal gauche, celle de droite le droit : une
 *   ligne lue par voix au lieu de deux (deux fois moins de calcul), un coup
 *   en double mono sonne au bit pres comme avant (chorus.ts LINE_W), un
 *   sample stereo garde son energie et un coup place par PAN (son pas
 *   verrouille compris) le reste dans le CHORUS (le panoramique stereo
 *   ramenait chaque ligne au milieu) ;
 * - 'juno' (le MM-ARP, refait le 2026-10-12 d'apres le Juno-106, chorus.ts
 *   JUNO) : l'entree en mono, les filtres des BBD (deux Butterworth de 4
 *   poles vers 10 kHz et un 7.2 kHz a l'entree du BBD), une seule ligne et
 *   deux lectures, chacune a 1 / (c0 +/- c1 triangle) : l'horloge de chaque
 *   BBD suit le triangle (ou son inverse), son retard suit l'inverse de son
 *   horloge. Les modes I et II ne changent que la vitesse du triangle, sans
 *   saut (sa phase continue).
 * Sans entree branchee, le processeur rend la main (process -> false) : le
 * noeud d'une branche debranchee peut partir.
 */

const TAU = Math.PI * 2;

/** Bessel I0 (fenetre de Kaiser). */
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

/** Interpolation sinc : 16 points (8 de chaque cote), 512 phases (+1), Kaiser beta 8, gain 1 en continu par phase. */
const TAPS = 16;
const HALF = 8;
const PHASES = 512;
const SINC = (() => {
  const t = new Float32Array((PHASES + 1) * TAPS);
  const beta = 8;
  const i0b = besselI0(beta);
  for (let p = 0; p <= PHASES; p += 1) {
    const f = p / PHASES;
    let sum = 0;
    for (let k = 0; k < TAPS; k += 1) {
      // le point lu est a f apres l'echantillon i ; la prise k est l'echantillon i - 7 + k
      const x = f + (HALF - 1) - k;
      const sinc = Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const r = x / HALF;
      const w = Math.abs(r) >= 1 ? 0 : besselI0(beta * Math.sqrt(1 - r * r)) / i0b;
      t[p * TAPS + k] = sinc * w;
      sum += sinc * w;
    }
    for (let k = 0; k < TAPS; k += 1) t[p * TAPS + k] /= sum;
  }
  return t;
})();

/** Lecture a d echantillons (8 au moins) dans le passe de la ligne b, ecrite en w. */
function readFrac(b, w, d) {
  const n = b.length;
  let pos = w - d;
  while (pos < 0) pos += n;
  const i = Math.floor(pos);
  const ph = Math.round((pos - i) * PHASES) * TAPS;
  let y = 0;
  let j = i - (HALF - 1);
  if (j < 0) j += n;
  for (let k = 0; k < TAPS; k += 1) {
    y += SINC[ph + k] * b[j];
    j += 1;
    if (j === n) j = 0;
  }
  return y;
}

/** Triangle de phase p (0..1) : 0 -> 1 -> 0 -> -1 -> 0, comme l'OscillatorNode. */
function triangle(p) {
  const q = p - Math.floor(p);
  return q < 0.25 ? 4 * q : q < 0.75 ? 2 - 4 * q : 4 * q - 4;
}

class MMChorus extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.kind = o.kind === 'juno' ? 'juno' : 'bus';
    // 60 ms de memoire : le plus long retard (21 ms + 7 ms) et de la marge
    const n = Math.ceil(0.06 * sampleRate) + 8;
    this.bufL = new Float32Array(n);
    this.bufR = new Float32Array(n);
    this.w = 0;
    // Chaque voix : retard, vitesse, son canal (gauche sous le centre) et ses gains de placement (StereoPannerNode,
    // entree mono : sa loi d'egale puissance)
    this.voices = (Array.isArray(o.voices) ? o.voices : []).map((v) => {
      const xm = (v.pan + 1) / 2;
      return {
        delay: v.delay,
        rate: v.rate,
        left: v.pan <= 0,
        ml: Math.cos((xm * Math.PI) / 2),
        mr: Math.sin((xm * Math.PI) / 2),
      };
    });
    this.depth = Number(o.depth) || 0;
    // Bus (2026-10-10, CHORUS RATE et DEPTH du MM-RYTM) : le facteur des vitesses, lisse comme la profondeur (smDepth)
    this.mul = Number.isFinite(o.mul) && o.mul > 0 ? o.mul : 1;
    this.smMul = this.mul;
    this.vph = this.voices.map(() => 0);
    this.smDepth = this.depth;
    this.k = 1 - Math.exp(-1 / (0.02 * sampleRate));
    // Juno (2026-10-12) : le triangle (sa vitesse : le mode, par message), la course de la ligne, ses filtres
    this.rate = Number.isFinite(o.rate) && o.rate > 0 ? o.rate : 0.513;
    this.ph = 0;
    if (this.kind === 'juno') this.initJuno(o);
    this.port.onmessage = (e) => {
      const m = e.data || {};
      // Les valeurs finies seulement (2026-10-10) : un NaN ne gagne jamais la ligne
      if (Number.isFinite(m.depth)) this.depth = Math.max(0, Math.min(0.02, m.depth));
      if (Number.isFinite(m.rate) && m.rate > 0) this.rate = Math.min(20, m.rate);
      if (Number.isFinite(m.mul) && m.mul > 0) this.mul = Math.min(8, m.mul);
    };
  }

  /**
   * Le Juno-106 (2026-10-12) : la ligne entre dmin et dmax (s, chorus.ts), son inverse lineaire en triangle (l'horloge
   * du BBD : c0 +/- c1 en 1/s) ; les filtres d'avant et d'apres les BBD reunis avant la ligne (le retard bouge si
   * lentement, 2 % au plus, que filtrer avant ou apres revient au meme : un seul jeu de filtres pour deux lectures).
   */
  initJuno(o) {
    const sr = sampleRate;
    const dmin = Math.max(Number(o.dmin) || 0.00155, (HALF + 1) / sr);
    const dmax = Math.min(Math.max(Number(o.dmax) || 0.00524, dmin), 0.05);
    this.c0 = 0.5 * (1 / dmin + 1 / dmax);
    this.c1 = 0.5 * (1 / dmin - 1 / dmax);
    // RBJ passe-bas (Q) en forme transposee II : b0 = b2, b1 = 2 b0
    const lp = (hz, q) => {
      const w0 = (TAU * Math.min(hz, sr * 0.45)) / sr;
      const al = Math.sin(w0) / (2 * q);
      const cw = Math.cos(w0);
      const a0 = 1 + al;
      return { b0: (1 - cw) / 2 / a0, a1: (-2 * cw) / a0, a2: (1 - al) / a0 };
    };
    const bq = (Array.isArray(o.biquads) ? o.biquads : []).map((f) => lp(Number(f[0]) || 10000, Number(f[1]) || 0.707));
    this.bq = new Float64Array(bq.length * 3);
    bq.forEach((c, i) => {
      this.bq[i * 3] = c.b0;
      this.bq[i * 3 + 1] = c.a1;
      this.bq[i * 3 + 2] = c.a2;
    });
    this.bz = new Float64Array(bq.length * 2);
    // Le passe-bas d'un pole (10K et 2.2n a l'entree du BBD), bilineaire
    const t = Math.tan((Math.PI * Math.min(Number(o.pole) || 7234, sr * 0.45)) / sr);
    this.pb = t / (1 + t);
    this.pa = (1 - t) / (1 + t);
    this.px = 0;
    this.py = 0;
  }

  process(inputs, outputs) {
    const inp = inputs[0];
    const out = outputs[0];
    if (!inp || inp.length === 0) {
      for (const ch of out) ch.fill(0);
      return false;
    }
    const inL = inp[0];
    const inR = inp.length > 1 ? inp[1] : inp[0];
    const oL = out[0];
    const oR = out.length > 1 ? out[1] : out[0];
    const N = oL.length;
    const sr = sampleRate;
    const bL = this.bufL;
    const bR = this.bufR;
    const n = bL.length;
    if (this.kind === 'juno') {
      const B = this.bq;
      const Z = this.bz;
      const nb = Z.length / 2;
      const c0 = this.c0;
      const c1 = this.c1;
      const pb = this.pb;
      const pa = this.pa;
      const dph = this.rate / sr;
      let px = this.px;
      let py = this.py;
      let ph = this.ph;
      let w = this.w;
      for (let i = 0; i < N; i += 1) {
        // Entree mono, les filtres des BBD, dans la ligne (une seule : les deux lectures la partagent)
        const x = 0.5 * (inL[i] + inR[i]);
        py = pb * (x + px) + pa * py;
        px = x;
        let y = py;
        for (let j = 0; j < nb; j += 1) {
          const b0 = B[j * 3];
          const yo = b0 * y + Z[j * 2];
          Z[j * 2] = 2 * b0 * y - B[j * 3 + 1] * yo + Z[j * 2 + 1];
          Z[j * 2 + 1] = b0 * y - B[j * 3 + 2] * yo;
          y = yo;
        }
        bL[w] = y;
        // Le triangle (TP4) et son inverse (TP3) : chaque horloge, son retard (s) = 1 / horloge
        const t = triangle(ph) * c1;
        ph += dph;
        if (ph >= 1) ph -= 1;
        oL[i] = readFrac(bL, w, sr / (c0 + t));
        oR[i] = readFrac(bL, w, sr / (c0 - t));
        w += 1;
        if (w === n) w = 0;
      }
      // Les etats tres petits (un silence) reviennent a 0 : pas de nombres denormaux dans les filtres
      if (Math.abs(py) < 1e-20) py = 0;
      for (let j = 0; j < Z.length; j += 1) if (Math.abs(Z[j]) < 1e-20) Z[j] = 0;
      this.px = px;
      this.py = py;
      this.ph = ph;
      this.w = w;
      return true;
    }
    // Bus : chaque voix retarde son canal (une entree mono : le meme des deux cotes), puis le place (loi mono)
    const V = this.voices;
    const kS = this.k;
    for (let i = 0; i < N; i += 1) {
      bL[this.w] = inL[i];
      bR[this.w] = inR[i];
      let l = 0;
      let r = 0;
      // Profondeur et vitesse lissees (2026-10-10) : a leurs valeurs de depart, exactement le calcul d'avant
      this.smDepth += (this.depth - this.smDepth) * kS;
      this.smMul += (this.mul - this.smMul) * kS;
      for (let k = 0; k < V.length; k += 1) {
        const v = V[k];
        const d0 = (v.delay + Math.sin(TAU * this.vph[k]) * this.smDepth) * sr;
        // 8 echantillons au moins (la fenetre sinc) : une profondeur de 14 ms sur le retard de 14 ms ne lit jamais l'avenir
        const d = d0 < HALF ? HALF : d0;
        this.vph[k] += (v.rate * this.smMul) / sr;
        if (this.vph[k] >= 1) this.vph[k] -= 1;
        const y = readFrac(v.left ? bL : bR, this.w, d);
        l += y * v.ml;
        r += y * v.mr;
      }
      oL[i] = l;
      oR[i] = r;
      this.w = (this.w + 1) % n;
    }
    return true;
  }
}

registerProcessor('mm-chorus', MMChorus);
