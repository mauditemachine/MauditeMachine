/**
 * BIT et COMP du MM-RYTM (2026-10-10, Mika : "on a deja DELAY, remplace DLY
 * TIME et DLY FB par bit reduction et compressor") : sur toute la sortie du
 * MM-RYTM, kick, REVERB et DELAY compris (audio/drums.ts).
 * - BIT : la profondeur tombe de 16 a 4 bits, l'echantillonnage se divise
 *   jusqu'a 8 (v au carre : le debut de course reste fin). A 0, le son passe
 *   tel quel.
 * - COMP : un compresseur sans anticipation (le MM-RYTM reste cale sur le
 *   MM-BASS et le MM-ARP) : seuil de 0 a -30 dB, rapport de 1 a 8, attaque
 *   3 ms, retour 120 ms, le gain rattrape a 60 %. A 0, rien ne bouge.
 * Le passage de 0 a un peu se fait en 10 ms (pas de clic).
 */
class MMGlue extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'comp', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.mixB = 0;
    this.mixC = 0;
    this.ph = 0;
    this.h0 = 0;
    this.h1 = 0;
    this.env = 0;
    this.atk = Math.exp(-1 / (0.003 * sampleRate));
    this.rel = Math.exp(-1 / (0.12 * sampleRate));
    this.glide = 1 - Math.exp(-1 / (0.01 * sampleRate));
  }

  process(inputs, outputs, params) {
    const out = outputs[0];
    if (!out || !out.length) return true;
    const inp = inputs[0];
    const n = out[0].length;
    if (!inp || !inp.length) {
      for (const ch of out) ch.fill(0);
      return true;
    }
    const inL = inp[0];
    const inR = inp[1] || inp[0];
    const oL = out[0];
    const oR = out[1] || null;
    const b = Math.max(0, Math.min(1, params.bits[0] || 0));
    const cp = Math.max(0, Math.min(1, params.comp[0] || 0));
    const tB = b > 0 ? 1 : 0;
    const tC = cp > 0 ? 1 : 0;
    const q = Math.pow(2, 16 - 12 * b - 1);
    const fac = 1 + Math.round(b * b * 7);
    const thr = -30 * cp;
    const ratio = 1 + 7 * cp;
    const slope = 1 - 1 / ratio;
    const makeup = -thr * slope * 0.6;
    const k = this.glide;
    for (let i = 0; i < n; i += 1) {
      let l = inL[i];
      let r = inR[i];
      this.mixB += (tB - this.mixB) * k;
      this.mixC += (tC - this.mixC) * k;
      if (this.mixB > 1e-4) {
        this.ph += 1;
        if (this.ph >= fac) {
          this.ph = 0;
          this.h0 = Math.round(l * q) / q;
          this.h1 = Math.round(r * q) / q;
        }
        l += (this.h0 - l) * this.mixB;
        r += (this.h1 - r) * this.mixB;
      }
      if (this.mixC > 1e-4) {
        const pk = Math.max(Math.abs(l), Math.abs(r));
        this.env = pk > this.env ? this.atk * this.env + (1 - this.atk) * pk : this.rel * this.env + (1 - this.rel) * pk;
        const over = 20 * Math.log10(this.env + 1e-9) - thr;
        const gr = over > 0 ? over * slope : 0;
        const g = Math.pow(10, (makeup - gr) / 20);
        const gm = 1 + (g - 1) * this.mixC;
        l *= gm;
        r *= gm;
      }
      oL[i] = Number.isFinite(l) ? l : 0;
      if (oR) oR[i] = Number.isFinite(r) ? r : 0;
    }
    if (!Number.isFinite(this.env)) this.env = 0;
    return true;
  }
}

registerProcessor('mm-glue', MMGlue);
