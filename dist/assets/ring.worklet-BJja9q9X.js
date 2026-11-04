/**
 * La memoire du MIXER (2026-10-07, Mika : "chaque deck doit pouvoir sampler
 * ce qui est en cours, ou sampler le mixer") : un AudioWorklet branche sur
 * la sortie du site (apres son limiteur : ce qu'on entend) qui garde en
 * boucle les dernieres secondes, en stereo. REC MIX d'une platine y prend
 * les temps qui viennent de passer, tout de suite, sans attendre qu'ils
 * rejouent. Il ne sort rien (sa sortie est du silence).
 * port, du fil principal :
 *   { type: 'grab', id, from, to }  les images de from a to (en images du
 *                                   contexte, currentFrame) ; rend
 *                                   { type: 'grab', id, L, R, rate, from }
 *                                   (ce qui est encore en memoire), L null
 *                                   s'il n'y a rien
 */

class MMRing extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const s = (options && options.processorOptions && options.processorOptions.seconds) || 34;
    this.n = Math.ceil(s * sampleRate);
    this.L = new Float32Array(this.n);
    this.R = new Float32Array(this.n);
    /** la premiere image pas encore ecrite (images du contexte) */
    this.end = -1;
    /** la premiere image ecrite */
    this.start = -1;
    this.port.onmessage = (e) => this.onMsg(e.data);
  }

  onMsg(m) {
    if (!m || m.type !== 'grab') return;
    const lo = Math.max(Math.round(m.from), this.start, this.end - this.n);
    const hi = Math.min(Math.round(m.to), this.end);
    if (this.end < 0 || hi - lo < 2) {
      this.port.postMessage({ type: 'grab', id: m.id, L: null, R: null, rate: sampleRate, from: lo });
      return;
    }
    const len = hi - lo;
    const L = new Float32Array(len);
    const R = new Float32Array(len);
    for (let i = 0; i < len; i += 1) {
      const k = (lo + i) % this.n;
      L[i] = this.L[k];
      R[i] = this.R[k];
    }
    this.port.postMessage({ type: 'grab', id: m.id, L, R, rate: sampleRate, from: lo }, [L.buffer, R.buffer]);
  }

  process(inputs) {
    const inp = inputs[0];
    const a = inp && inp[0];
    const b = (inp && inp[1]) || a;
    const len = a ? a.length : 128;
    const at = currentFrame;
    if (this.start < 0) this.start = at;
    for (let i = 0; i < len; i += 1) {
      const k = (at + i) % this.n;
      this.L[k] = a ? a[i] : 0;
      this.R[k] = b ? b[i] : 0;
    }
    this.end = at + len;
    return true;
  }
}

registerProcessor('mm-ring', MMRing);
