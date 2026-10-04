/**
 * Le limiteur de sortie (2026-10-03, Mika : "le son sortant de la
 * meilleure qualite qu'il soit"). A la place de l'ecreteur doux de
 * drums.ts (qui arrondissait les cretes et ajoutait des harmoniques), un
 * limiteur a anticipation, transparent :
 * - le gain demande par chaque echantillon (plafond / crete, 1 dessous) ;
 * - son minimum sur la fenetre d'anticipation (LOOK echantillons, 3 ms) :
 *   la baisse commence AVANT la crete ;
 * - un relachement exponentiel (RELEASE_S), l'attaque immediate ;
 * - une moyenne glissante sur la meme fenetre : la baisse est une rampe
 *   douce, jamais une marche, et la crete est tenue exactement sous le
 *   plafond ;
 * - le son retarde de LOOK - 1 echantillons, aligne sur son gain.
 * Stereo liee (un seul gain pour les deux canaux : l'image ne bouge pas).
 * Plafond -1 dBFS. Sous le plafond, le son passe intact (gain 1).
 */

const CEILING = Math.pow(10, -1 / 20);
const LOOK_S = 0.003;
const RELEASE_S = 0.12;

class MMLimiter extends AudioWorkletProcessor {
  constructor() {
    super();
    this.look = Math.max(2, Math.round(LOOK_S * sampleRate));
    const L = this.look;
    // Ligne a retard du son (deux canaux) et fenetres circulaires
    this.dl = [new Float32Array(L), new Float32Array(L)];
    this.dIdx = 0;
    // Minimum glissant : file monotone (valeurs, positions)
    this.qv = new Float32Array(L + 1);
    this.qp = new Float64Array(L + 1);
    this.qHead = 0;
    this.qLen = 0;
    this.n = 0;
    // Moyenne glissante du gain
    this.box = new Float32Array(L).fill(1);
    this.bIdx = 0;
    this.bSum = L;
    this.g = 1;
    this.rel = 1 - Math.exp(-1 / (RELEASE_S * sampleRate));
    this.minGain = 1;
    this.port.onmessage = (e) => {
      if (e.data === 'info') {
        this.port.postMessage({ look: this.look, minGain: this.minGain });
        this.minGain = 1;
      }
    };
  }

  /** Pousse le gain demande g a la position n ; renvoie le minimum de la fenetre. */
  pushMin(g, n) {
    const L = this.look;
    const cap = L + 1;
    // Retire de la queue tout ce qui est plus grand (il ne sera plus jamais le minimum)
    while (this.qLen > 0) {
      const tail = (this.qHead + this.qLen - 1) % cap;
      if (this.qv[tail] < g) break;
      this.qLen -= 1;
    }
    const at = (this.qHead + this.qLen) % cap;
    this.qv[at] = g;
    this.qp[at] = n;
    this.qLen += 1;
    // Retire de la tete ce qui est sorti de la fenetre
    while (this.qp[this.qHead] <= n - L) {
      this.qHead = (this.qHead + 1) % cap;
      this.qLen -= 1;
    }
    return this.qv[this.qHead];
  }

  process(inputs, outputs) {
    const inp = inputs[0];
    const out = outputs[0];
    const N = out[0].length;
    const inL = inp && inp[0] ? inp[0] : null;
    const inR = inp && inp[1] ? inp[1] : inL;
    const oL = out[0];
    const oR = out.length > 1 ? out[1] : null;
    const L = this.look;
    const dlL = this.dl[0];
    const dlR = this.dl[1];
    for (let i = 0; i < N; i += 1) {
      const xl = inL ? inL[i] : 0;
      const xr = inR ? inR[i] : 0;
      const peak = Math.max(Math.abs(xl), Math.abs(xr));
      const req = peak > CEILING ? CEILING / peak : 1;
      const target = this.pushMin(req, this.n);
      this.n += 1;
      // Attaque immediate (l'anticipation fait la rampe), relachement exponentiel
      this.g = target < this.g ? target : this.g + (target - this.g) * this.rel;
      // Moyenne glissante sur la fenetre : une rampe douce, la crete tenue
      this.bSum += this.g - this.box[this.bIdx];
      this.box[this.bIdx] = this.g;
      this.bIdx = (this.bIdx + 1) % L;
      const gain = this.bSum / L;
      if (gain < this.minGain) this.minGain = gain;
      // Le son retarde de L - 1 echantillons (la ligne en garde L - 1 utiles)
      const r = (this.dIdx + 1) % L;
      const yl = dlL[r];
      const yr = dlR[r];
      dlL[this.dIdx] = xl;
      dlR[this.dIdx] = xr;
      this.dIdx = r;
      oL[i] = yl * gain;
      if (oR) oR[i] = yr * gain;
    }
    return true;
  }
}

registerProcessor('mm-limiter', MMLimiter);
