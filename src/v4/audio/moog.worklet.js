/**
 * MM-VOYAGER : le moteur (AudioWorklet, 2026-10-03). Le plus pres possible
 * d'un Minimoog Voyager dans un navigateur, calcule echantillon par
 * echantillon :
 * - trois oscillateurs par note : OSC 1 et OSC 2 ecartes par FINE de part
 *   et d'autre de la note (le centre reste juste), OSC 3 une octave
 *   dessous ; forme continue comme le Voyager (triangle, dent de scie,
 *   carre, impulsion fine), sans repliement (PolyBLEP) ; chaque
 *   oscillateur derive lentement (quelques cents, comme un VCO) ;
 * - le filtre en echelle 24 dB (quatre poles, retroaction resolue sans
 *   retard, saturation a l'entree) : la resonance chante puis siffle,
 *   les graves fondent quand elle monte, comme sur un Moog ; DIST pousse
 *   son entree puis sature la sortie ;
 * - deux enveloppes ADSR a courbes de condensateur (attaque vers 1.3,
 *   decroissance et relachement exponentiels), redeclenchees depuis leur
 *   niveau : jamais de clic ;
 * - GLIDE glisse depuis la note precedente en hauteur logarithmique.
 * Jusqu'a 12 notes en meme temps (les queues de RELEASE se chevauchent) ;
 * au-dela, la plus ancienne repart de son niveau.
 * Notes recues avec leur instant (temps du contexte), jouees a
 * l'echantillon pres ; reglages lisses, sans craquement. Sortie stereo
 * (le meme signal), les effets suivent dans le graphe.
 */

const MAX_VOICES = 12;
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

/** Forme continue : 0 triangle, 1/3 dent de scie, 2/3 carre, 1 impulsion de 12 %. */
function shape(ph, dt, m) {
  if (m < 1 / 3) {
    const k = m * 3;
    const tri = 1 - 4 * Math.abs(ph - 0.5);
    const saw = 2 * ph - 1 - polyblep(ph, dt);
    return tri * (1 - k) + saw * k;
  }
  if (m < 2 / 3) {
    const k = (m - 1 / 3) * 3;
    const saw = 2 * ph - 1 - polyblep(ph, dt);
    return saw * (1 - k) + pulse(ph, dt, 0.5) * k;
  }
  const k = (m - 2 / 3) * 3;
  return pulse(ph, dt, 0.5 - 0.38 * k);
}

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const coef = (seconds, sr) => 1 - Math.exp(-1 / Math.max(1, seconds * sr));

class Voice {
  constructor() {
    this.on = false;
    this.midi = 60;
    this.logf = Math.log(261.6);
    this.logT = this.logf;
    this.ph = [Math.random(), Math.random(), Math.random()];
    this.drift = [0, 0, 0];
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
    this.p = {
      wave: 0.33,
      fine: 15,
      glide: 0,
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
    this.sm = { wave: 0.33, fine: 15, cutoff: 800, res: 0.3, envOct: 3, drive: 0 };
    this.smK = coef(0.015, sampleRate);
    this.c = {};
    if (o.params) Object.assign(this.p, o.params);
    Object.assign(this.sm, { wave: this.p.wave, fine: this.p.fine, cutoff: this.p.cutoff, res: this.p.res, envOct: this.p.envOct, drive: this.p.drive });
    this.coefs();
    if (o.notes) for (const n of o.notes) this.add(n);
    this.port.onmessage = (e) => this.onMsg(e.data);
  }

  coefs() {
    const sr = sampleRate;
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
      v.aV = 0;
      v.fV = 0;
    }
    const target = Math.log(midiHz(n.midi));
    v.logT = target;
    v.logf = this.p.glide > 0 && n.from !== null ? Math.log(midiHz(n.from)) : target;
    v.midi = n.midi;
    v.on = true;
    v.quick = false;
    v.aStage = 1;
    v.fStage = 1;
    v.off = frame + Math.max(64, Math.round(n.gate * sampleRate));
    v.accent = n.accent;
    this.age += 1;
    v.age = this.age;
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out.length > 1 ? out[1] : null;
    const N = L.length;
    const sr = sampleRate;
    const t0 = currentFrame;
    const q = this.queue;
    let active = false;
    for (const v of this.voices) if (v.on) active = true;
    if (!active && (q.length === 0 || q[0].frame >= t0 + N)) {
      L.fill(0);
      if (R) R.fill(0);
      return true;
    }
    // Derive lente des oscillateurs : une marche au hasard bornee, une fois par bloc
    for (const v of this.voices) {
      if (!v.on) continue;
      for (let k = 0; k < 3; k += 1) {
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
    const nyq = sr * 0.42;
    for (let i = 0; i < N; i += 1) {
      const fr = t0 + i;
      while (q.length > 0 && q[0].frame <= fr) this.noteOn(q.shift(), fr);
      sm.wave += (p.wave - sm.wave) * K;
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
      for (let vi = 0; vi < MAX_VOICES; vi += 1) {
        const v = this.voices[vi];
        if (!v.on) continue;
        // Enveloppes
        if (v.aStage < 3 && fr >= v.off) {
          v.aStage = 3;
          v.fStage = 3;
        }
        if (v.aStage === 1) {
          v.aV += (1.3 - v.aV) * c.aAtk;
          if (v.aV >= 1) {
            v.aV = 1;
            v.aStage = 2;
          }
        } else if (v.aStage === 2) v.aV += (p.aS - v.aV) * c.aDec;
        else {
          v.aV -= v.aV * (v.quick ? c.quick : c.aRel);
          if (v.aV < 0.00005) {
            v.on = false;
            continue;
          }
        }
        if (v.fStage === 1) {
          v.fV += (1.3 - v.fV) * c.fAtk;
          if (v.fV >= 1) {
            v.fV = 1;
            v.fStage = 2;
          }
        } else if (v.fStage === 2) v.fV += (p.fS - v.fV) * c.fDec;
        else v.fV -= v.fV * c.fRel;
        // Hauteur et oscillateurs
        v.logf += (v.logT - v.logf) * c.glide;
        const f = Math.exp(v.logf);
        const ph = v.ph;
        const f1 = f * Math.pow(2, (v.drift[0] - half) / 1200);
        const f2 = f * Math.pow(2, (v.drift[1] + half) / 1200);
        const f3 = f * 0.5 * Math.pow(2, v.drift[2] / 1200);
        const d1 = f1 / sr;
        const d2 = f2 / sr;
        const d3 = f3 / sr;
        const o = 0.42 * shape(ph[0], d1, sm.wave) + 0.42 * shape(ph[1], d2, sm.wave) + 0.36 * shape(ph[2], d3, sm.wave);
        ph[0] += d1;
        if (ph[0] >= 1) ph[0] -= 1;
        ph[1] += d2;
        if (ph[1] >= 1) ph[1] -= 1;
        ph[2] += d3;
        if (ph[2] >= 1) ph[2] -= 1;
        // Filtre en echelle : coupure (enveloppe, accent, suivi du clavier), retroaction resolue
        let fc = sm.cutoff * Math.pow(2, sm.envOct * v.fV * (0.8 + 0.2 * v.accent) + (KEY_TRACK * (v.midi - TRACK_ROOT)) / 12);
        if (fc > nyq) fc = nyq;
        else if (fc < 20) fc = 20;
        const g = Math.tan((Math.PI * fc) / sr);
        const G = g / (1 + g);
        const b = 1 / (1 + g);
        const G2 = G * G;
        const S = G2 * G * b * v.s1 + G2 * b * v.s2 + G * b * v.s3 + b * v.s4;
        let u = (o * driveIn - k * S) / (1 + k * G2 * G2);
        u = Math.tanh(u);
        let w = (u - v.s1) * G;
        let y = w + v.s1;
        v.s1 = y + w;
        w = (y - v.s2) * G;
        y = w + v.s2;
        v.s2 = y + w;
        w = (y - v.s3) * G;
        y = w + v.s3;
        v.s3 = y + w;
        w = (y - v.s4) * G;
        y = w + v.s4;
        v.s4 = y + w;
        // Les graves fondent avec la resonance : une partie seulement reprise
        y *= 1 + k * 0.3;
        // VCA, saturation de sortie (DIST la pousse)
        let a = y * v.aV * v.accent;
        a = Math.tanh(a * driveOut) / Math.pow(driveOut, 0.82);
        sum += a;
      }
      const s = sum * 1.5;
      L[i] = s;
      if (R) R[i] = s;
    }
    return true;
  }
}

registerProcessor('mm-voyager', MMVoyager);
