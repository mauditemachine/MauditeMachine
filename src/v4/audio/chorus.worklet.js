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
 *   StereoPannerNode le ferait (memes formules : le son ne change pas) ;
 * - 'juno' (le MM-ARP) : l'entree en mono, passe-bas 8 kHz (la couleur des
 *   BBD), deux lectures en opposition de phase (un triangle lent), plus un
 *   triangle rapide commun (le mode I+II).
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
    // Chaque voix : retard, vitesse, et ses gains de placement (StereoPannerNode, entree stereo)
    this.voices = (Array.isArray(o.voices) ? o.voices : []).map((v) => {
      const x = v.pan <= 0 ? v.pan + 1 : v.pan;
      // Entree mono : le panoramique d'egale puissance du StereoPannerNode
      const xm = (v.pan + 1) / 2;
      return {
        delay: v.delay,
        rate: v.rate,
        left: v.pan <= 0,
        gl: Math.cos((x * Math.PI) / 2),
        gr: Math.sin((x * Math.PI) / 2),
        ml: Math.cos((xm * Math.PI) / 2),
        mr: Math.sin((xm * Math.PI) / 2),
      };
    });
    this.depth = Number(o.depth) || 0;
    // Bus (2026-10-10, CHORUS RATE et DEPTH du MM-RYTM) : le facteur des vitesses, lisse comme la profondeur (smDepth)
    this.mul = Number.isFinite(o.mul) && o.mul > 0 ? o.mul : 1;
    this.smMul = this.mul;
    this.ph = this.voices.map(() => 0);
    // Juno : vitesses et profondeurs (messages), lissees
    this.rate = 0.5;
    this.fastRate = 8;
    this.fastDepth = 0;
    this.base = Number(o.base) || 0.0035;
    this.slowPh = 0;
    this.fastPh = 0;
    this.smDepth = this.depth;
    this.smFast = 0;
    this.k = 1 - Math.exp(-1 / (0.02 * sampleRate));
    // Passe-bas 8 kHz (RBJ, Q 0.5) du Juno
    const w0 = (TAU * Math.min(Number(o.lowpass) || 8000, sampleRate * 0.45)) / sampleRate;
    const al = Math.sin(w0) / (2 * 0.5);
    const a0 = 1 + al;
    this.lp = { b0: (1 - Math.cos(w0)) / 2 / a0, b1: (1 - Math.cos(w0)) / a0, b2: (1 - Math.cos(w0)) / 2 / a0, a1: (-2 * Math.cos(w0)) / a0, a2: (1 - al) / a0, z1: 0, z2: 0 };
    this.port.onmessage = (e) => {
      const m = e.data || {};
      // Les valeurs finies seulement (2026-10-10) : un NaN ne gagne jamais la ligne
      if (Number.isFinite(m.depth)) this.depth = Math.max(0, Math.min(0.02, m.depth));
      if (Number.isFinite(m.rate)) this.rate = m.rate;
      if (Number.isFinite(m.fastDepth)) this.fastDepth = m.fastDepth;
      if (Number.isFinite(m.mul) && m.mul > 0) this.mul = Math.min(8, m.mul);
    };
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
      const lp = this.lp;
      for (let i = 0; i < N; i += 1) {
        // Entree mono, passe-bas, dans la ligne (une seule : les deux lectures la partagent)
        const x = 0.5 * (inL[i] + inR[i]);
        const y = lp.b0 * x + lp.z1;
        lp.z1 = lp.b1 * x - lp.a1 * y + lp.z2;
        lp.z2 = lp.b2 * x - lp.a2 * y;
        bL[this.w] = y;
        this.smDepth += (this.depth - this.smDepth) * this.k;
        this.smFast += (this.fastDepth - this.smFast) * this.k;
        const s = triangle(this.slowPh) * this.smDepth;
        const f = triangle(this.fastPh) * this.smFast;
        this.slowPh += this.rate / sr;
        this.fastPh += this.fastRate / sr;
        if (this.slowPh >= 1) this.slowPh -= 1;
        if (this.fastPh >= 1) this.fastPh -= 1;
        oL[i] = readFrac(bL, this.w, (this.base + s + f) * sr);
        oR[i] = readFrac(bL, this.w, (this.base - s + f) * sr);
        this.w = (this.w + 1) % n;
      }
      return true;
    }
    // Bus : chaque voix retarde les deux canaux, puis les place (StereoPannerNode : formules mono ou stereo)
    const V = this.voices;
    const mono = inp.length === 1;
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
        const d0 = (v.delay + Math.sin(TAU * this.ph[k]) * this.smDepth) * sr;
        // 8 echantillons au moins (la fenetre sinc) : une profondeur de 14 ms sur le retard de 14 ms ne lit jamais l'avenir
        const d = d0 < HALF ? HALF : d0;
        this.ph[k] += (v.rate * this.smMul) / sr;
        if (this.ph[k] >= 1) this.ph[k] -= 1;
        const dl = readFrac(bL, this.w, d);
        if (mono) {
          l += dl * v.ml;
          r += dl * v.mr;
          continue;
        }
        const dr = readFrac(bR, this.w, d);
        if (v.left) {
          l += dl + dr * v.gl;
          r += dr * v.gr;
        } else {
          l += dl * v.gl;
          r += dr + dl * v.gr;
        }
      }
      oL[i] = l;
      oR[i] = r;
      this.w = (this.w + 1) % n;
    }
    return true;
  }
}

registerProcessor('mm-chorus', MMChorus);
