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
 *   accentuee a sa decroissance courte et fixe, plus de profondeur, et le
 *   circuit d'accent de la 303 : une charge qui s'accumule d'un accent a
 *   l'autre (le "wow"), plus lente avec la resonance ;
 * - le VCA : tenu tant que la note l'est, un relachement court ; l'accent
 *   pousse aussi le volume ;
 * - DRIVE apres le filtre ; le SUB, un sinus une octave sous la note, ajoute
 *   propre apres (il ne passe ni par le filtre ni par DRIVE : des basses
 *   pleines a toute resonance).
 * port, du fil principal :
 *   { type: 'params', p }              CUTOFF, RESO, ENVMOD, DECAY, ACCENT, WAVE, SUB, DRIVE, GLIDE, VOLUME (0 a 1)
 *   { type: 'on', at, midi, acc, legato, lock }  une note a l'heure at du contexte (0 : tout de suite) ; legato :
 *                                      glisse depuis la note tenue, sans relancer les enveloppes ; lock : les
 *                                      verrous de son pas (2026-10-07, les parameter locks), null : les potards
 *   { type: 'lock', at, lock }         les verrous d'une liaison (la note continue, son son change)
 *   { type: 'off', at }                la note se relache a at
 *   { type: 'unseq', time }            les evenements programmes a time ou apres s'oublient (re-programmation)
 *   { type: 'stop' }                   tout se tait en 15 ms, plus rien de programme
 * vers le fil principal, ~25 fois par seconde tant que ca sonne :
 *   { type: 'pos', cut, env, gate, midi }  la coupure du moment (Hz), l'enveloppe, la note tenue
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

/** tanh, approche rationnelle (assez juste pour une saturation, bien moins chere). */
function fastTanh(x) {
  if (x > 3) return 1;
  if (x < -3) return -1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}

class MMBass extends AudioWorkletProcessor {
  constructor() {
    super();
    this.R = sampleRate * OS;
    this.ladder = new TeeBee(this.R);
    // Les potards (base) ; les verrous du pas qui joue par-dessus (lock) ; p : ce qui sonne
    this.base = { cutoff: 0.35, reso: 0.55, envmod: 0.55, decay: 0.45, accent: 0.6, wave: 0, sub: 0.35, drive: 0.15, glide: 0.35, volume: 0.8 };
    this.lock = null;
    this.p = { ...this.base };
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
    this.queue = [];
    this.since = 0;
    this.active = false;
    this.dc = { x: 0, y: 0 };
    this.lastCut = 0;
    this.port.onmessage = (e) => this.onMsg(e.data);
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
  }

  /** Les potards, puis les verrous du pas qui joue. */
  mix() {
    this.p = this.lock ? { ...this.base, ...this.lock } : { ...this.base };
    this.derive();
  }

  onMsg(m) {
    if (!m) return;
    if (m.type === 'params') {
      Object.assign(this.base, m.p);
      this.mix();
    } else if (m.type === 'on' || m.type === 'off' || m.type === 'lock') {
      const at = m.at > 0 ? Math.max(0, Math.round((m.at - currentTime) * sampleRate)) : 0;
      const ev = { frame: currentFrame + at, type: m.type, midi: m.midi, acc: !!m.acc, legato: !!m.legato, lock: m.lock || null };
      // Rangee par heure (un evenement a la meme heure passe apres ceux deja la)
      let i = this.queue.length;
      while (i > 0 && this.queue[i - 1].frame > ev.frame) i -= 1;
      this.queue.splice(i, 0, ev);
    } else if (m.type === 'unseq') {
      const f = Math.round((m.time || 0) * sampleRate) - 2;
      this.queue = this.queue.filter((e) => e.frame < f);
    } else if (m.type === 'stop') {
      this.queue = [];
      this.gate = false;
      this.quick = true;
      if (this.lock) {
        this.lock = null;
        this.mix();
      }
    }
  }

  apply(ev) {
    if (ev.type === 'off') {
      this.gate = false;
      return;
    }
    // Les verrous du pas : avant la note (sa decroissance, son accent en dependent)
    if (ev.lock !== this.lock) {
      this.lock = ev.lock;
      this.mix();
    }
    if (ev.type === 'lock') return;
    const target = Math.log(440 * Math.pow(2, (ev.midi - 69) / 12));
    const legato = ev.legato && this.gate;
    this.logT = target;
    this.midi = ev.midi;
    this.acc = ev.acc ? this.accAmt : 0;
    if (legato) {
      // Glisse : la hauteur part vers la note, les enveloppes continuent
      this.glideOn = true;
      this.dirty = true;
      return;
    }
    this.glideOn = false;
    this.dirty = true;
    this.logF = target;
    this.gate = true;
    this.quick = false;
    // L'enveloppe du filtre repart ; une note accentuee : courte et fixe (la 303)
    this.env = 1;
    this.envTau = ev.acc ? 0.2 : this.decayS;
    if (ev.acc) this.accEnv = 1;
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const Rch = out[1] || out[0];
    const n = L.length;
    const R = this.R;
    // Les coefficients d'un pas de controle (CTRL echantillons du contexte, CTRL * OS du double)
    const steps = CTRL * OS;
    const kGlide = 1 - Math.exp(-steps / (this.glideS * R));
    const kEnv = Math.exp(-steps / (this.envTau * R));
    const kAccEnv = Math.exp(-steps / (0.2 * R));
    // Le circuit d'accent : plus lent avec la resonance (la charge s'accumule d'un accent a l'autre)
    const kSweep = 1 - Math.exp(-steps / ((0.03 + 0.12 * this.p.reso) * R));
    // Le VCA, a chaque echantillon du contexte
    const kAtt = 1 - Math.exp(-1 / (0.0025 * sampleRate));
    const kRel = 1 - Math.exp(-1 / ((this.quick ? 0.006 : 0.014) * sampleRate));
    // Le niveau (2026-10-07, Mika : "le kick est la reference ; mon sub bassline, je le mets 2 dB sous lui") :
    // le SUB prend la place de l'oscillateur au lieu de s'y ajouter (la crete bouge peu quand il monte), et
    // VOLUME par defaut crete vers -6 dBFS, 2 dB sous le kick du MM-RYTM (mesure hors ligne)
    const sub = this.p.sub * 0.55;
    const oscK = 0.55 * (1 - 0.5 * this.p.sub);
    const vol = this.p.volume * this.p.volume * 1.82;
    const wave = this.p.wave;
    const drive = this.drive;
    const dNorm = this.driveNorm;
    const ladder = this.ladder;
    let peak = 0;
    let dt = this.dt || 0.001;
    let gainAcc = this.gainAcc || 1;
    const f0 = currentFrame;
    const q = this.queue;
    const sin = Math.sin;
    const TWO_PI = 2 * Math.PI;
    for (let i = 0; i < n; i += 1) {
      if (q.length !== 0) {
        const frame = f0 + i;
        while (this.queue.length && this.queue[0].frame <= frame) this.apply(this.queue.shift());
      }
      if (i % CTRL === 0 || this.dirty) {
        this.dirty = false;
        // La hauteur (glisse en log), les enveloppes, la coupure
        if (this.glideOn) this.logF += (this.logT - this.logF) * kGlide;
        dt = Math.min(0.45, Math.exp(this.logF) / R);
        this.env *= kEnv;
        this.accEnv *= kAccEnv;
        this.accSweep += (this.accEnv * this.acc - this.accSweep) * kSweep;
        const depth = this.envOct * (1 + 0.6 * this.acc);
        let fc = this.cutBase * Math.exp((depth * this.env + 2.2 * this.accSweep) * Math.LN2);
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
        let t2 = t + 0.5;
        if (t2 >= 1) t2 -= 1;
        const sq = (t < 0.5 ? 1 : -1) + blep(t, dt) - blep(t2, dt);
        let y = ladder.run((saw + (sq - saw) * wave) * 0.9);
        if (drive > 1.001) y = fastTanh(y * drive) * dNorm;
        acc += y;
      }
      // Le SUB : un sinus une octave dessous, propre (a la cadence du contexte)
      this.subPhase += dt * OS * 0.5;
      if (this.subPhase >= 1) this.subPhase -= 1;
      this.vca += ((this.gate ? 1 : 0) - this.vca) * (this.gate ? kAtt : kRel);
      let v = ((acc / OS) * oscK + sin(TWO_PI * this.subPhase) * sub) * this.vca * gainAcc * vol;
      // Un coupe-continu tres bas (20 Hz : les subs restent)
      const yv = v - this.dc.x + 0.9974 * this.dc.y;
      this.dc.x = v;
      this.dc.y = yv;
      v = yv;
      L[i] = v;
      if (Rch !== L) Rch[i] = v;
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
    }
    this.dt = dt;
    this.gainAcc = gainAcc;
    // Plus rien ne sonne : on remet le filtre au repos (pas d'auto-oscillation qui traine)
    const sounding = this.gate || this.vca > 1e-4 || this.queue.length > 0;
    if (!sounding && this.active) ladder.reset();
    this.since += n;
    if (sounding && this.since >= REPORT_EVERY) {
      this.since = 0;
      this.port.postMessage({ type: 'pos', cut: this.lastCut, env: this.env, gate: this.gate, midi: this.midi, peak });
    } else if (!sounding && this.active) this.port.postMessage({ type: 'pos', cut: this.lastCut, env: 0, gate: false, midi: -1, peak: 0 });
    this.active = sounding;
    return true;
  }
}

registerProcessor('mm-bass', MMBass);
