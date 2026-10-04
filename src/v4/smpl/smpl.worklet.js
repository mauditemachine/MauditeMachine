/**
 * Le son du MM-SMPL (2026-10-04, Mika : "une machine de travail du sample
 * avec une partie granulaire ; faire des samples, extraire des parties,
 * changer la tonalite, slicer"). Un AudioWorklet qui garde le sample (les
 * deux canaux, a sa frequence) et joue :
 * - des voix (une slice, ou la region entiere) : lecture a la vitesse du
 *   PITCH (interpolation cubique d'Hermite), a l'endroit ou a l'envers,
 *   bouclee tant que le pad est tenu (LOOP), ATTACK au depart, RELEASE au
 *   lacher ; un fondu de 3 ms au bout de la slice (pas de clic) ;
 * - des nuages de grains (GRAIN) : des grains de SIZE, DENSITY par seconde,
 *   autour d'une position (SPRAY : de combien ils s'en ecartent), a la
 *   hauteur du PITCH sans changer la duree, places dans l'image (SPREAD),
 *   fenetre de Hann, niveau rattrape selon leur recouvrement ;
 * - l'enregistrement de son entree (la sortie du site) : REC.
 * port, du fil principal :
 *   { type: 'sample', L, R, rate }  le sample (transfere)
 *   { type: 'params', p }           ATTACK, RELEASE (s), SIZE (s), DENSITY (Hz), SPRAY, SPREAD, PITCH (demi-tons), reverse
 *   { type: 'play', id, a, b, loop } une voix de a a b (s) ; loop : bouclee jusqu'a 'release'
 *   { type: 'cloud', id, pos, a, b } un nuage a pos (s), dans la region [a, b]
 *   { type: 'move', id, pos }       le nuage se deplace
 *   { type: 'release', id }         la voix ou le nuage s'eteint (RELEASE)
 *   { type: 'stop' }                tout s'eteint en 10 ms
 *   { type: 'rec', on, max }        enregistrer (max secondes) ; off : renvoie { type: 'rec', L, R, n }
 * vers le fil principal, 23 fois par seconde tant que quelque chose joue :
 *   { type: 'pos', voices: [[id, s]...], clouds: [[id, s]...] }
 */

const MAX_VOICES = 12;
const MAX_GRAINS = 96;
const END_FADE_S = 0.003;
const QUICK_S = 0.01;
const REPORT_EVERY = 2048;

/** Hermite a 4 points (Catmull-Rom) sur un canal, x en echantillons du sample. */
function hermite(buf, n, x) {
  const i = Math.floor(x);
  const t = x - i;
  const y0 = buf[i - 1 < 0 ? 0 : i - 1 >= n ? n - 1 : i - 1];
  const y1 = buf[i < 0 ? 0 : i >= n ? n - 1 : i];
  const y2 = buf[i + 1 >= n ? n - 1 : i + 1 < 0 ? 0 : i + 1];
  const y3 = buf[i + 2 >= n ? n - 1 : i + 2 < 0 ? 0 : i + 2];
  const c1 = 0.5 * (y2 - y0);
  const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
  const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
  return ((c3 * t + c2) * t + c1) * t + y1;
}

class MMSmpl extends AudioWorkletProcessor {
  constructor() {
    super();
    this.L = null;
    this.R = null;
    this.n = 0;
    this.rate = sampleRate;
    this.voices = [];
    for (let i = 0; i < MAX_VOICES; i += 1) this.voices.push({ on: false, id: -1, pos: 0, a: 0, b: 0, dir: 1, loop: false, held: false, env: 0, att: 0, rel: 0, releasing: false, quick: false, age: 0 });
    this.clouds = [];
    this.grains = [];
    for (let i = 0; i < MAX_GRAINS; i += 1) this.grains.push({ on: false, cloud: null, pos: 0, step: 0, len: 0, age: 0, gl: 1, gr: 1 });
    this.p = { attack: 0.002, release: 0.12, size: 0.09, density: 22, spray: 0.08, spread: 0.35, pitch: 0, reverse: false };
    this.age = 0;
    this.sinceReport = 0;
    this.reported = true;
    this.rec = null;
    this.port.onmessage = (e) => this.onMsg(e.data);
  }

  onMsg(m) {
    if (!m) return;
    if (m.type === 'sample') {
      for (const v of this.voices) v.on = false;
      for (const g of this.grains) g.on = false;
      this.clouds = [];
      this.L = m.L;
      this.R = m.R || m.L;
      this.n = m.L ? m.L.length : 0;
      this.rate = m.rate || sampleRate;
    } else if (m.type === 'params') Object.assign(this.p, m.p);
    else if (m.type === 'play') this.play(m);
    else if (m.type === 'cloud') {
      const old = this.clouds.find((c) => c.id === m.id);
      if (old) {
        old.pos = m.pos * this.rate;
        old.releasing = false;
        return;
      }
      this.clouds.push({ id: m.id, pos: m.pos * this.rate, a: m.a * this.rate, b: m.b * this.rate, env: 0, releasing: false, next: 0 });
    } else if (m.type === 'move') {
      const c = this.clouds.find((x) => x.id === m.id);
      if (c) c.pos = m.pos * this.rate;
    } else if (m.type === 'release') {
      for (const v of this.voices) if (v.on && v.id === m.id) v.held = false;
      for (const c of this.clouds) if (c.id === m.id) c.releasing = true;
      // Une voix bouclee s'eteint au lacher ; une voix simple va au bout de sa slice
      for (const v of this.voices) if (v.on && v.id === m.id && v.loop) v.releasing = true;
    } else if (m.type === 'stop') {
      for (const v of this.voices) {
        if (!v.on) continue;
        v.releasing = true;
        v.quick = true;
      }
      for (const c of this.clouds) c.releasing = true;
    } else if (m.type === 'rec') {
      if (m.on) {
        const max = Math.max(1, Math.round((m.max || 30) * sampleRate));
        this.rec = { L: new Float32Array(max), R: new Float32Array(max), n: 0, max };
      } else this.flushRec();
    }
  }

  flushRec() {
    const r = this.rec;
    if (!r) return;
    this.rec = null;
    const L = r.L.slice(0, r.n);
    const R = r.R.slice(0, r.n);
    this.port.postMessage({ type: 'rec', L, R, n: r.n, rate: sampleRate }, [L.buffer, R.buffer]);
  }

  play(m) {
    if (!this.L || this.n < 2) return;
    // Le meme pad repart : sa voix d'avant s'efface vite (pas d'empilement)
    for (const v of this.voices) {
      if (v.on && v.id === m.id) {
        v.releasing = true;
        v.quick = true;
        v.id = -1;
      }
    }
    let v = this.voices.find((x) => !x.on);
    if (!v) {
      // Plus de voix libre : la plus ancienne
      v = this.voices.reduce((o, x) => (x.age < o.age ? x : o), this.voices[0]);
    }
    const a = Math.max(0, Math.min(this.n - 2, m.a * this.rate));
    const b = Math.max(a + 2, Math.min(this.n - 1, m.b * this.rate));
    const rev = !!this.p.reverse;
    v.on = true;
    v.id = m.id;
    v.a = a;
    v.b = b;
    v.dir = rev ? -1 : 1;
    v.pos = rev ? b - 1 : a;
    v.loop = !!m.loop;
    v.held = true;
    v.env = 0;
    v.releasing = false;
    v.quick = false;
    this.age += 1;
    v.age = this.age;
  }

  spawn(c, rate) {
    const g = this.grains.find((x) => !x.on);
    if (!g) return;
    const p = this.p;
    const len = Math.max(32, Math.round(p.size * sampleRate));
    const span = Math.max(1, c.b - c.a);
    const jitter = (Math.random() * 2 - 1) * p.spray * span * 0.5;
    const read = len * rate;
    let start = c.pos + jitter;
    // Le grain reste dans la region (a l'envers : il part de sa fin)
    start = Math.max(c.a, Math.min(c.b - read - 1, start));
    if (start < c.a) start = c.a;
    const rev = !!p.reverse;
    g.on = true;
    g.cloud = c;
    g.pos = rev ? start + read : start;
    g.step = rev ? -rate : rate;
    g.len = len;
    g.age = 0;
    const pan = (Math.random() * 2 - 1) * p.spread;
    g.gl = Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    g.gr = Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const oL = out[0];
    const oR = out[1] || out[0];
    const N = oL.length;
    // REC : l'entree (la sortie du site) s'ajoute au tampon
    const r = this.rec;
    if (r) {
      const inp = inputs[0] || [];
      const iL = inp[0];
      const iR = inp[1] || iL;
      const k = Math.min(N, r.max - r.n);
      if (iL) {
        r.L.set(iL.subarray(0, k), r.n);
        r.R.set(iR.subarray(0, k), r.n);
      }
      r.n += k;
      if (r.n >= r.max) this.flushRec();
    }
    oL.fill(0);
    if (oR !== oL) oR.fill(0);
    const L = this.L;
    const R = this.R;
    const n = this.n;
    let active = false;
    if (L && n > 1) {
      const p = this.p;
      const rate = Math.pow(2, p.pitch / 12) * (this.rate / sampleRate);
      const att = Math.max(1, p.attack * sampleRate);
      const rel = Math.max(1, p.release * sampleRate);
      const quick = QUICK_S * sampleRate;
      const fade = END_FADE_S * this.rate;
      // Les voix
      for (const v of this.voices) {
        if (!v.on) continue;
        active = true;
        const step = rate * v.dir;
        for (let i = 0; i < N; i += 1) {
          if (v.releasing) {
            v.env -= 1 / (v.quick ? quick : rel);
            if (v.env <= 0) {
              v.on = false;
              break;
            }
          } else if (v.env < 1) v.env = Math.min(1, v.env + 1 / att);
          // Le bout de la slice : on boucle (pad tenu), sinon un fondu de 3 ms et c'est fini
          let edge = 1;
          if (v.dir > 0) {
            if (v.pos >= v.b) {
              if (v.loop && v.held) v.pos -= v.b - v.a;
              else {
                v.on = false;
                break;
              }
            }
            if (!(v.loop && v.held)) edge = Math.min(1, (v.b - v.pos) / fade);
          } else {
            if (v.pos <= v.a) {
              if (v.loop && v.held) v.pos += v.b - v.a;
              else {
                v.on = false;
                break;
              }
            }
            if (!(v.loop && v.held)) edge = Math.min(1, (v.pos - v.a) / fade);
          }
          const g = v.env * edge;
          oL[i] += hermite(L, n, v.pos) * g;
          oR[i] += hermite(R, n, v.pos) * g;
          v.pos += step;
        }
      }
      // Les nuages de grains
      if (this.clouds.length > 0) {
        active = true;
        const every = sampleRate / Math.max(0.5, p.density);
        for (const c of this.clouds) {
          for (let i = 0; i < N; i += 1) {
            c.next -= 1;
            if (c.next <= 0 && !c.releasing) {
              this.spawn(c, rate);
              c.next += every * (0.85 + 0.3 * Math.random());
            }
          }
          if (c.releasing) c.env = Math.max(0, c.env - N / rel);
          else c.env = Math.min(1, c.env + N / att);
        }
        // Le recouvrement des grains : le niveau reste a peu pres celui d'une lecture simple
        const overlap = Math.max(1, p.density * p.size);
        const norm = 1 / Math.sqrt(overlap);
        for (const g of this.grains) {
          if (!g.on) continue;
          const cg = g.cloud.env * norm;
          for (let i = 0; i < N; i += 1) {
            if (g.age >= g.len) {
              g.on = false;
              break;
            }
            const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * g.age) / g.len);
            const k = w * cg;
            oL[i] += hermite(L, n, g.pos) * k * g.gl;
            oR[i] += hermite(R, n, g.pos) * k * g.gr;
            g.pos += g.step;
            g.age += 1;
          }
        }
        // Un nuage eteint et sans grain : il part (le tableau ne se refait qu'alors : rien a ramasser sur le fil audio)
        let dead = false;
        for (const c of this.clouds) if (c.releasing && c.env <= 0) dead = true;
        if (dead) this.clouds = this.clouds.filter((c) => !(c.releasing && c.env <= 0 && !this.grains.some((g) => g.on && g.cloud === c)));
      }
    }
    // Les positions, pour l'ecran (et une derniere fois quand tout s'est tu)
    this.sinceReport += N;
    if ((active || !this.reported) && this.sinceReport >= REPORT_EVERY) {
      this.sinceReport = 0;
      const voices = [];
      for (const v of this.voices) if (v.on && v.id >= 0) voices.push([v.id, v.pos / this.rate]);
      const clouds = this.clouds.map((c) => [c.id, c.pos / this.rate]);
      this.port.postMessage({ type: 'pos', voices, clouds });
      this.reported = !active;
    }
    if (active) this.reported = false;
    return true;
  }
}

registerProcessor('mm-smpl', MMSmpl);
