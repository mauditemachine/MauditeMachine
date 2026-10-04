/**
 * La prise de l'oscilloscope (2026-10-04, Mika : "dans OPEN je voudrais un
 * oscilloscope pour voir l'onde comme le fait occularScope ; voir si la
 * phase bouge ou pas ; je veux quelque chose d'ultra precis"). Rien ne
 * sort : le processeur recopie ses deux entrees (A en stereo, B en mono,
 * la somme de ses canaux) par blocs de CHUNK echantillons, avec le numero
 * du premier (currentFrame : la meme horloge que le contexte, a
 * l'echantillon pres), et les envoie au fil principal (audio/scope.ts).
 * port : { on: false } le met en veille (plus aucun envoi) ; { back } lui
 * rend un jeu de tampons lu, qu'il reprend au lieu d'en allouer un.
 */

const CHUNK = 1024;
/** Les jeux de tampons gardes pour resservir (le fil principal les rend apres lecture). */
const POOL = 8;

class MMScope extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = true;
    this.n = 0;
    this.at = 0;
    this.pool = [];
    this.fresh();
    this.port.onmessage = (e) => {
      const d = e.data;
      if (!d) return;
      if (typeof d.on === 'boolean') {
        this.on = d.on;
        this.n = 0;
      }
      // Les tampons lus nous reviennent : plus aucune allocation en regime
      // (le ramasse-miettes du fil audio le faisait craquer)
      if (d.back && this.pool.length < POOL) this.pool.push(d.back);
    };
  }

  fresh() {
    const p = this.pool.pop();
    if (p && p.aL.length === CHUNK) {
      this.aL = p.aL;
      this.aR = p.aR;
      this.b = p.b;
      return;
    }
    this.aL = new Float32Array(CHUNK);
    this.aR = new Float32Array(CHUNK);
    this.b = new Float32Array(CHUNK);
  }

  process(inputs) {
    if (!this.on) return true;
    const a = inputs[0] || [];
    const b = inputs[1] || [];
    const len = (a[0] && a[0].length) || 128;
    if (this.n === 0) this.at = currentFrame;
    const n = this.n;
    if (a[0]) {
      this.aL.set(a[0], n);
      this.aR.set(a[1] || a[0], n);
    } else {
      this.aL.fill(0, n, n + len);
      this.aR.fill(0, n, n + len);
    }
    if (b[0]) {
      const b0 = b[0];
      const b1 = b[1] || b[0];
      for (let i = 0; i < len; i += 1) this.b[n + i] = 0.5 * (b0[i] + b1[i]);
    } else this.b.fill(0, n, n + len);
    this.n += len;
    if (this.n >= CHUNK) {
      this.port.postMessage({ at: this.at, aL: this.aL, aR: this.aR, b: this.b }, [this.aL.buffer, this.aR.buffer, this.b.buffer]);
      this.fresh();
      this.n = 0;
    }
    return true;
  }
}

registerProcessor('mm-scope', MMScope);
