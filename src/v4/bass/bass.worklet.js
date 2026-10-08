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
 *   accentuee a sa decroissance courte et fixe (ACC DECAY), plus de
 *   profondeur, et le circuit d'accent de la 303 : une charge qui s'accumule
 *   d'un accent a l'autre (le "wow", jusqu'a SWEEP octaves), plus lente avec
 *   la resonance ;
 * - le VCA : tenu tant que la note l'est, un relachement court (RELEASE) ;
 *   l'accent pousse aussi le volume ;
 * - DRIVE apres le filtre ; le SUB, un sinus une octave sous la note (ou
 *   deux : SUB OCT), ajoute propre apres (il ne passe ni par le filtre ni par
 *   DRIVE : des basses pleines a toute resonance) ; TUNE accorde les deux.
 *
 * Les reglages fins sous le capot (2026-10-08, la refonte facon Monark) :
 * ACC DECAY, SWEEP, RELEASE, SUB OCT, TUNE etaient des constantes ; memes
 * lois que bass/params.ts, et leurs defauts redonnent exactement les
 * anciennes constantes (un message sans eux : le son d'avant). Un verrou de
 * DECAY sur un pas accentue l'emporte sur ACC DECAY (avant, l'accent
 * l'ignorait : le verrou ne faisait rien) ; sur une liaison ou une note
 * glissee, il change la decroissance de l'enveloppe qui continue.
 *
 * La machine Elektron (2026-10-08, Mika : "est-ce que le voice, est-ce que
 * le FX, est-ce que l'enveloppe") : onze reglages de plus, tous sans effet a
 * leur defaut (un rendu hors ligne du motif d'usine est identique a
 * l'echantillon pres), tous verrouillables par pas sauf ceux des effets
 * eux-memes :
 * - PW : la largeur du carre (50 % : le carre d'avant) ;
 * - KEY TRK : la coupure suit la hauteur qui sonne (glissee comprise),
 *   autour de fa diese 2 (la tonique) ;
 * - l'enveloppe de l'ampli : ATTACK (la constante de temps de la montee,
 *   2.5 ms : celle d'avant), puis AMP DECAY vers SUSTAIN (1 : tenue, comme
 *   avant), RELEASE ; une note glissee ne la relance pas (la 303) ;
 * - DELAY : un aller-retour gauche droite cale sur le tempo (DLY TIME en
 *   pas, DLY FB), son retour filtre (pas de boue sous 140 Hz, pas d'aigus
 *   au-dessus de 3.2 kHz) ;
 * - REVERB : un reseau de quatre lignes a retour (FDN, matrice de
 *   Householder) apres deux diffuseurs, REV SIZE sa duree (RT60), REV TONE
 *   l'amorti des aigus.
 * Les envois suivent les verrous du pas (lisses en 5 ms) ; un effet a zero
 * dont la queue s'est eteinte ne calcule plus rien (ses lignes sont videes).
 * port, du fil principal :
 *   { type: 'params', p }              CUTOFF, RESO, ENVMOD, DECAY, ACCENT, WAVE, SUB, DRIVE, GLIDE, VOLUME,
 *                                      ACCDECAY, SWEEP, RELEASE, SUBOCT, TUNE, PW, KEYTRACK, ATTACK, ADECAY,
 *                                      SUSTAIN, DELAY, DTIME, DFB, REVERB, RSIZE, RTONE (0 a 1)
 *   { type: 'tempo', step }            la duree d'un pas (s) : le temps du DELAY
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
/** KEY TRK : la note de reference (fa diese 2, la tonique du site), en log de Hz. */
const KT_REF = Math.log(440 * Math.pow(2, (42 - 69) / 12));
/** DLY TIME : les pas de chaque cran (1/16, 1/8, 3/16, 1/4, 3/8, 1/2), comme bass/params.ts DTIME_STEPS. */
const DTIME_STEPS = [1, 2, 3, 4, 6, 8];
/** Le DELAY : 2.2 s de memoire, le retour filtre, le niveau du retour. */
const DLY = { maxS: 2.2, lp: 3200, hp: 140, out: 0.85 };
/** La REVERB : les quatre lignes (s), les deux diffuseurs (s, gain), le niveau du retour. */
const REV = { lines: [0.0353, 0.0467, 0.0571, 0.0683], diff: [0.0047, 0.0036], g: 0.62, out: 0.42 };
/**
 * Un effet a zero s'endort quand rien n'y entre ni n'en sort sous ce niveau ce temps-la (s) ; le DELAY attend en plus
 * son temps (2026-10-08, revue : entre l'entree et la premiere repetition une ligne longue se tait, elle n'est pas vide).
 */
const FX_IDLE = { level: 1e-5, s: 0.4 };

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
/** Des ms en secondes, a la microseconde pres (le defaut retombe pile sur l'ancienne constante : 0.2, 0.014). */
const msToS = (ms) => Math.round(ms * 1000) / 1e6;

/** tanh, approche rationnelle (assez juste pour une saturation, bien moins chere). */
function fastTanh(x) {
  if (x > 3) return 1;
  if (x < -3) return -1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}

/**
 * Le DELAY (2026-10-08) : un aller-retour, la gauche repete l'entree, la
 * droite repete la gauche, et ainsi de suite ; le retour passe un passe-bas
 * et un passe-haut a un pole. run(x) rend la sortie mouillee dans outL, outR.
 */
class PingPong {
  constructor(rate) {
    this.rate = rate;
    this.len = Math.ceil(DLY.maxS * rate) + 2;
    this.l = new Float32Array(this.len);
    this.r = new Float32Array(this.len);
    this.w = 0;
    this.d = Math.round(0.3 * rate);
    this.fb = 0.45;
    this.aLp = 1 - Math.exp((-2 * Math.PI * DLY.lp) / rate);
    this.aHp = 1 - Math.exp((-2 * Math.PI * DLY.hp) / rate);
    this.lpL = 0;
    this.lpR = 0;
    this.hpL = 0;
    this.hpR = 0;
    this.outL = 0;
    this.outR = 0;
    /** ce qui vient d'entrer dans les lignes et d'en sortir (le sommeil le surveille) */
    this.lvl = 0;
  }
  setTime(s) {
    this.d = Math.max(1, Math.min(this.len - 2, Math.round(s * this.rate)));
  }
  run(x) {
    const len = this.len;
    let ri = this.w - this.d;
    if (ri < 0) ri += len;
    const yl = this.l[ri];
    const yr = this.r[ri];
    // Le retour filtre (gauche vers droite, droite vers gauche)
    this.lpL += (yl - this.lpL) * this.aLp;
    this.hpL += (this.lpL - this.hpL) * this.aHp;
    this.lpR += (yr - this.lpR) * this.aLp;
    this.hpR += (this.lpR - this.hpR) * this.aHp;
    const wl = x + this.fb * (this.lpR - this.hpR);
    const wr = this.fb * (this.lpL - this.hpL);
    this.l[this.w] = wl;
    this.r[this.w] = wr;
    this.w += 1;
    if (this.w >= len) this.w = 0;
    this.outL = yl * DLY.out;
    this.outR = yr * DLY.out;
    this.lvl = Math.abs(wl) + Math.abs(wr) + Math.abs(yl) + Math.abs(yr);
  }
  clear() {
    this.l.fill(0);
    this.r.fill(0);
    this.lpL = this.lpR = this.hpL = this.hpR = 0;
    this.outL = this.outR = 0;
    this.lvl = 0;
  }
}

/**
 * La REVERB (2026-10-08) : deux diffuseurs en serie (des passe-tout), puis
 * quatre lignes qui se renvoient leur son par une matrice de Householder,
 * chacune amortie (REV TONE) et attenuee pour durer REV SIZE (RT60).
 */
class Fdn {
  constructor(rate) {
    this.rate = rate;
    this.lines = REV.lines.map((s) => {
      const n = Math.max(8, Math.round(s * rate));
      return { buf: new Float32Array(n), n, w: 0, g: 0.8, lp: 0 };
    });
    this.diff = REV.diff.map((s) => {
      const n = Math.max(4, Math.round(s * rate));
      return { buf: new Float32Array(n), n, w: 0 };
    });
    this.aTone = 0.5;
    this.outL = 0;
    this.outR = 0;
    /** ce qui entre dans les lignes et en sort, chacune (deux sorties ne s'annulent pas en silence) */
    this.lvl = 0;
    this.set(2, 4000);
  }
  set(rt60, toneHz) {
    for (const ln of this.lines) ln.g = Math.pow(10, (-3 * (ln.n / this.rate)) / Math.max(0.1, rt60));
    this.aTone = 1 - Math.exp((-2 * Math.PI * toneHz) / this.rate);
  }
  run(x) {
    // Les diffuseurs : y = -g x + d, d' = x + g y
    let s = x;
    for (const df of this.diff) {
      const d = df.buf[df.w];
      const y = -REV.g * s + d;
      df.buf[df.w] = s + REV.g * y;
      df.w += 1;
      if (df.w >= df.n) df.w = 0;
      s = y;
    }
    const L = this.lines;
    const y0 = L[0].buf[L[0].w];
    const y1 = L[1].buf[L[1].w];
    const y2 = L[2].buf[L[2].w];
    const y3 = L[3].buf[L[3].w];
    const a = this.aTone;
    L[0].lp += (y0 - L[0].lp) * a;
    L[1].lp += (y1 - L[1].lp) * a;
    L[2].lp += (y2 - L[2].lp) * a;
    L[3].lp += (y3 - L[3].lp) * a;
    const h = 0.5 * (L[0].lp + L[1].lp + L[2].lp + L[3].lp);
    for (let k = 0; k < 4; k += 1) {
      const ln = L[k];
      ln.buf[ln.w] = s + ln.g * (ln.lp - h);
      ln.w += 1;
      if (ln.w >= ln.n) ln.w = 0;
    }
    this.outL = (y0 + y2) * REV.out;
    this.outR = (y1 + y3) * REV.out;
    this.lvl = Math.abs(s) + Math.abs(y0) + Math.abs(y1) + Math.abs(y2) + Math.abs(y3);
  }
  clear() {
    for (const ln of this.lines) {
      ln.buf.fill(0);
      ln.lp = 0;
    }
    for (const df of this.diff) df.buf.fill(0);
    this.outL = this.outR = 0;
    this.lvl = 0;
  }
}

class MMBass extends AudioWorkletProcessor {
  constructor() {
    super();
    this.R = sampleRate * OS;
    this.ladder = new TeeBee(this.R);
    // Les potards (base) ; les verrous du pas qui joue par-dessus (lock) ; p : ce qui sonne.
    // Les reglages fins (2026-10-08) : leurs defauts, ceux de bass/params.ts (200 ms, 2.2 octaves, 14 ms, -1, 0 cent)
    this.base = {
      cutoff: 0.35,
      reso: 0.55,
      envmod: 0.55,
      decay: 0.45,
      accent: 0.6,
      wave: 0,
      sub: 0.35,
      drive: 0.15,
      glide: 0.35,
      volume: 0.8,
      accdecay: Math.log(200 / 80) / Math.log(600 / 80),
      sweep: 0.55,
      release: Math.log(14 / 6) / Math.log(400 / 6),
      suboct: 0,
      tune: 0.5,
      // La machine Elektron (2026-10-08) : sans effet a leur defaut (bass/params.ts)
      pw: 0,
      keytrack: 0,
      attack: Math.log(2.5 / 0.5) / Math.log(1000 / 0.5),
      adecay: Math.log(400 / 20) / Math.log(4000 / 20),
      sustain: 1,
      delay: 0,
      dtime: 0.4,
      dfb: 0.5,
      reverb: 0,
      rsize: Math.log(2 / 0.3) / Math.log(8 / 0.3),
      rtone: Math.log(4000 / 800) / Math.log(12000 / 800),
    };
    this.stepS = 60 / 120 / 4;
    this.dly = new PingPong(sampleRate);
    this.rev = new Fdn(sampleRate);
    // Les envois du moment (lisses), si chaque effet calcule, depuis quand sa queue est eteinte (echantillons)
    this.dS = 0;
    this.rS = 0;
    this.dlyOn = false;
    this.revOn = false;
    this.dlyQuiet = 0;
    this.revQuiet = 0;
    this.fxKey = '';
    // L'enveloppe de l'ampli : la montee faite, le niveau vise pendant la decroissance
    this.ampDecaying = false;
    this.ampLvl = 1;
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
    // ACC DECAY : 80 a 600 ms ; SWEEP : la charge des accents, 0 a 4 octaves ; RELEASE : 6 a 400 ms
    this.accDecayS = msToS(expMap(p.accdecay, 80, 600));
    this.sweepOct = 4 * Math.min(1, Math.max(0, p.sweep));
    this.releaseS = msToS(expMap(p.release, 6, 400));
    // SUB OCT : le sinus une octave sous la note (0.5) ou deux (0.25) ; TUNE : -50 a +50 cents (en log)
    this.subMul = p.suboct >= 0.5 ? 0.25 : 0.5;
    this.tuneLog = ((Math.min(1, Math.max(0, p.tune)) - 0.5) * 100 * Math.LN2) / 1200;
    // La machine Elektron (2026-10-08). PW : 50 a 95 % ; le second front du carre tombe a pwFrac (0.5 : comme avant)
    const c01 = (x) => Math.min(1, Math.max(0, x));
    this.pwFrac = 0.5 + 0.45 * c01(p.pw);
    this.pwOff = 1 - this.pwFrac;
    this.kt = c01(p.keytrack);
    // L'ampli : ATTACK 0.5 ms a 1 s (2.5 ms : l'ancienne constante, a la microseconde pres), AMP DECAY 20 ms a 4 s
    this.attackS = msToS(expMap(p.attack, 0.5, 1000));
    this.adecayS = msToS(expMap(p.adecay, 20, 4000));
    this.sus = c01(p.sustain);
    // Les envois, et les reglages des effets (globaux)
    this.dSend = c01(p.delay);
    this.rSend = c01(p.reverb);
    const ds = DTIME_STEPS[Math.max(0, Math.min(DTIME_STEPS.length - 1, Math.round(c01(p.dtime) * (DTIME_STEPS.length - 1))))];
    const key = `${ds}|${p.dfb}|${p.rsize}|${p.rtone}|${this.stepS}`;
    if (key !== this.fxKey) {
      this.fxKey = key;
      this.dly.setTime(ds * this.stepS);
      this.dly.fb = 0.9 * c01(p.dfb);
      this.rev.set(expMap(p.rsize, 0.3, 8), expMap(p.rtone, 800, 12000));
    }
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
    } else if (m.type === 'tempo') {
      if (m.step > 0 && m.step !== this.stepS) {
        this.stepS = m.step;
        this.mix();
      }
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
    // Un verrou de DECAY sur ce pas (2026-10-08) : il l'emporte, accent ou pas
    const lockedDecay = !!ev.lock && typeof ev.lock.decay === 'number';
    if (ev.type === 'lock') {
      // Une liaison verrouillee : l'enveloppe qui continue prend sa decroissance
      if (lockedDecay) this.envTau = this.decayS;
      return;
    }
    const target = Math.log(440 * Math.pow(2, (ev.midi - 69) / 12));
    const legato = ev.legato && this.gate;
    this.logT = target;
    this.midi = ev.midi;
    this.acc = ev.acc ? this.accAmt : 0;
    if (legato) {
      // Glisse : la hauteur part vers la note, les enveloppes continuent (un verrou de DECAY : comme une liaison)
      this.glideOn = true;
      this.dirty = true;
      if (lockedDecay) this.envTau = this.decayS;
      return;
    }
    this.glideOn = false;
    this.dirty = true;
    this.logF = target;
    this.gate = true;
    this.quick = false;
    // L'ampli remonte (ATTACK), puis decroitra vers SUSTAIN (2026-10-08)
    this.ampDecaying = false;
    this.ampLvl = 1;
    // L'enveloppe du filtre repart ; une note accentuee : courte et fixe (la 303 : ACC DECAY), sauf un verrou de DECAY
    this.env = 1;
    this.envTau = ev.acc && !lockedDecay ? this.accDecayS : this.decayS;
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
    const kAccEnv = Math.exp(-steps / (this.accDecayS * R));
    // Le circuit d'accent : plus lent avec la resonance (la charge s'accumule d'un accent a l'autre)
    const kSweep = 1 - Math.exp(-steps / ((0.03 + 0.12 * this.p.reso) * R));
    // Le VCA, a chaque echantillon du contexte (ATTACK, 2.5 ms par defaut comme avant ; RELEASE ; STOP : 6 ms, plus vite)
    const kAtt = 1 - Math.exp(-1 / (this.attackS * sampleRate));
    const kRel = 1 - Math.exp(-1 / ((this.quick ? 0.006 : this.releaseS) * sampleRate));
    // AMP DECAY vers SUSTAIN (2026-10-08), a la cadence de controle ; SUSTAIN a 1 : le niveau reste 1, le son d'avant
    const kAmpDec = Math.exp(-steps / (this.adecayS * R));
    const sus = this.sus;
    // Les effets : les envois lisses (5 ms), et s'ils calculent
    const kSend = 1 - Math.exp(-1 / (0.005 * sampleRate));
    if (this.dSend > 0) {
      this.dlyOn = true;
      this.dlyQuiet = 0;
    }
    if (this.rSend > 0) {
      this.revOn = true;
      this.revQuiet = 0;
    }
    const fx = this.dlyOn || this.revOn;
    const dly = this.dly;
    const rev = this.rev;
    let fxPeak = 0;
    // Le niveau (2026-10-07, Mika : "le kick est la reference ; mon sub bassline, je le mets 2 dB sous lui") :
    // le SUB prend la place de l'oscillateur au lieu de s'y ajouter (la crete bouge peu quand il monte) ; VOLUME
    // par defaut : 2 dB sous le kick, mesure en sortie reelle le 2026-10-08 (sans le compresseur de la batterie,
    // avec le rattrapage de -3 dB des trois machines : 1.82 devient 0.97)
    const sub = this.p.sub * 0.55;
    const oscK = 0.55 * (1 - 0.5 * this.p.sub);
    const vol = this.p.volume * this.p.volume * 0.97;
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
        dt = Math.min(0.45, Math.exp(this.logF + this.tuneLog) / R);
        this.env *= kEnv;
        this.accEnv *= kAccEnv;
        this.accSweep += (this.accEnv * this.acc - this.accSweep) * kSweep;
        const depth = this.envOct * (1 + 0.6 * this.acc);
        let fc = this.cutBase * Math.exp((depth * this.env + this.sweepOct * this.accSweep) * Math.LN2);
        // KEY TRK (2026-10-08) : la coupure suit la hauteur qui sonne, autour de la tonique (0 : rien ne change)
        if (this.kt > 0) fc *= Math.exp(this.kt * (this.logF - KT_REF));
        // AMP DECAY : le niveau vise descend vers SUSTAIN une fois la montee faite
        if (this.ampDecaying) this.ampLvl = sus + (this.ampLvl - sus) * kAmpDec;
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
        // Le carre : son second front a PW (0.5 : le carre d'avant, aux memes calculs pres)
        let t2 = t + this.pwOff;
        if (t2 >= 1) t2 -= 1;
        const sq = (t < this.pwFrac ? 1 : -1) + blep(t, dt) - blep(t2, dt);
        let y = ladder.run((saw + (sq - saw) * wave) * 0.9);
        if (drive > 1.001) y = fastTanh(y * drive) * dNorm;
        acc += y;
      }
      // Le SUB : un sinus une octave dessous (ou deux : SUB OCT), propre (a la cadence du contexte)
      this.subPhase += dt * OS * this.subMul;
      if (this.subPhase >= 1) this.subPhase -= 1;
      // Le VCA : la montee vers 1 (ATTACK), puis le niveau d'AMP DECAY (1 tant que SUSTAIN l'est) ; relache, RELEASE
      if (this.gate) {
        this.vca += ((this.ampDecaying ? this.ampLvl : 1) - this.vca) * kAtt;
        if (!this.ampDecaying && this.vca >= 0.99) this.ampDecaying = true;
      } else this.vca += (0 - this.vca) * kRel;
      let v = ((acc / OS) * oscK + sin(TWO_PI * this.subPhase) * sub) * this.vca * gainAcc * vol;
      // Un coupe-continu tres bas (20 Hz : les subs restent)
      const yv = v - this.dc.x + 0.9974 * this.dc.y;
      this.dc.x = v;
      this.dc.y = yv;
      v = yv;
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
      if (!fx) {
        L[i] = v;
        if (Rch !== L) Rch[i] = v;
        continue;
      }
      // Les effets (2026-10-08) : le sec, plus les retours du DELAY et de la REVERB
      let l = v;
      let r = v;
      if (this.dlyOn) {
        this.dS += (this.dSend - this.dS) * kSend;
        dly.run(v * this.dS);
        l += dly.outL;
        r += dly.outR;
        // Le silence se compte sur ce qui entre dans la ligne aussi (pas seulement sur sa sortie)
        const e = dly.lvl + this.dS;
        if (e > fxPeak) fxPeak = e;
        if (e < FX_IDLE.level && this.dSend === 0) this.dlyQuiet += 1;
        else this.dlyQuiet = 0;
      }
      if (this.revOn) {
        this.rS += (this.rSend - this.rS) * kSend;
        rev.run(v * this.rS);
        l += rev.outL;
        r += rev.outR;
        const e = rev.lvl + this.rS;
        if (e < FX_IDLE.level && this.rSend === 0) this.revQuiet += 1;
        else this.revQuiet = 0;
      }
      L[i] = l;
      if (Rch !== L) Rch[i] = r;
    }
    this.dt = dt;
    this.gainAcc = gainAcc;
    // Un effet a zero dont la queue s'est eteinte : il s'endort, ses lignes videes (rien ne traine au reveil). Le DELAY :
    // rien d'ecrit depuis au moins son temps (dly.d), la partie de la ligne qui sortira encore est vide (2026-10-08, revue :
    // un verrou de DELAY en 3/8 ou 1/2 perdait sa repetition, la ligne videe avant qu'elle sorte)
    const idle = FX_IDLE.s * sampleRate;
    if (this.dlyOn && this.dlyQuiet > dly.d + idle) {
      this.dlyOn = false;
      this.dS = 0;
      dly.clear();
    }
    if (this.revOn && this.revQuiet > idle) {
      this.revOn = false;
      this.rS = 0;
      rev.clear();
    }
    this.fxPeak = fxPeak;
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
