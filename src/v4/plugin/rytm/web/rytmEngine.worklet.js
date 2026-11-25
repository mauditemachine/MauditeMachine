/**
 * MM-RYTM dans le navigateur (2026-11-25, /mm-rytm/play/) : le moteur du VST3 (plugin/mm-rytm/web-engine, compile en
 * WebAssembly par scripts/build-rytm-wasm.sh) dans un AudioWorklet. Ce fil joue le role du processeur du VST3
 * (PluginProcessor.cpp) : faceProgram (parseProgram, le JSON lu par le C++ comme juce::JSON), faceHit, faceRun, faceFill,
 * processBlock, et les passages du fil du calcul (renderLoop) ; les calculs lourds de ce fil (les sons, la reponse de la
 * reverb) partent au Worker (rytmRender.worker.js, par le port recu), qui renvoie les memes nombres que le VST3. L'editeur
 * (le minuteur de PluginEditor.cpp) vit dans le fil principal (webBackend.ts) : ce fil lui envoie la tete de lecture
 * (Feedback) a chaque changement.
 *
 * processorOptions : { module (WebAssembly.Module) ou bytes (ArrayBuffer) }.
 * Messages du fil principal : program { bytes }, hit { bytes } (le JSON en UTF-8), run { on }, fill { on }, renderer { port }.
 * Le module est un "reactor" WASI sans glu : trois imports (fd_close, fd_seek, fd_write), _initialize une fois, puis
 * les mmrytm_* (plugin/mm-rytm/web-engine/RytmEngine.h).
 */

const QUANTUM = 128;
// le fil du calcul du VST3 se reveille au moins toutes les 100 ms (Renderer : wake.wait(100))
const RENDER_EVERY_S = 0.1;
// la tete et les compteurs vers le fil principal : a chaque pas, et au moins 4 fois par seconde
const POST_EVERY_S = 0.25;

class MMRytmEngine extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.ok = false;
    this.peak = 0;
    this.quanta = 0;
    this.renderQ = 0;
    this.postQ = 0;
    this.fb0 = -1;
    this.fb1 = -1;
    this.fb3 = -1;
    this.rp = null;
    this.pendingJobs = [];
    // RUN avant le premier etat publie (le premier geste etait PLAY) : il attend que le kit soit calcule, comme un VST3
    // qu'on lance une fois charge (sinon le premier pas tomberait avant les sons)
    this.heldRun = false;
    const q = sampleRate / QUANTUM;
    this.renderEvery = Math.max(1, Math.round(q * RENDER_EVERY_S));
    this.postEvery = Math.max(1, Math.round(q * POST_EVERY_S));
    try {
      this.init(o);
      this.ok = true;
      this.port.postMessage({ type: 'ready', sr: sampleRate });
    } catch (err) {
      this.port.postMessage({ type: 'error', msg: String((err && err.message) || err) });
    }
    this.port.onmessage = (ev) => {
      if (!this.ok) return;
      try {
        this.onMessage(ev.data);
      } catch (err) {
        this.fail(err);
      }
    };
  }

  /* ---------------- le module ---------------- */

  init(o) {
    const mod = o.module instanceof WebAssembly.Module ? o.module : new WebAssembly.Module(o.bytes);
    let mem = null;
    let dv = null;
    const view = () => (dv && dv.buffer === mem.buffer ? dv : (dv = new DataView(mem.buffer)));
    const imports = {};
    // les seuls imports du module (wasi : les ecritures d'un abandon) ; tout autre est bouche
    for (const imp of WebAssembly.Module.imports(mod)) {
      imports[imp.module] = imports[imp.module] || {};
      imports[imp.module][imp.name] =
        imp.name === 'fd_write'
          ? (_fd, iov, cnt, nw) => {
              const d = view();
              let t = 0;
              for (let i = 0; i < cnt; i += 1) t += d.getUint32(iov + i * 8 + 4, true);
              d.setUint32(nw, t, true);
              return 0;
            }
          : imp.name === 'proc_exit'
            ? (c) => {
                throw new Error(`proc_exit ${c}`);
              }
            : () => 0;
    }
    const x = new WebAssembly.Instance(mod, imports).exports;
    mem = x.memory;
    x._initialize();
    this.x = x;
    this.mem = mem;
    const e = x.mmrytm_create();
    if (!e) throw new Error('mmrytm_create');
    this.e = e;
    x.mmrytm_set_async(e, 1);
    x.mmrytm_prepare(e, sampleRate, QUANTUM);
    this.nDesc = x.mmrytm_job_desc_size();
    this.nStats = x.mmrytm_stats_size();
    this.pL = x.mmrytm_alloc(QUANTUM * 4);
    this.pR = x.mmrytm_alloc(QUANTUM * 4);
    // la tete et les compteurs : toujours au meme endroit, remplis a chaque appel
    this.pFb = x.mmrytm_feedback(e);
    this.pStats = x.mmrytm_stats(e);
    this.buf = null;
    this.views();
  }

  /** Les vues sur la memoire du wasm, refaites si elle a grandi (l'ancien tampon est alors detache). */
  views() {
    if (this.buf === this.mem.buffer) return;
    const b = this.mem.buffer;
    this.buf = b;
    this.vL = new Float32Array(b, this.pL, QUANTUM);
    this.vR = new Float32Array(b, this.pR, QUANTUM);
    this.vFb = new Int32Array(b, this.pFb, 5);
    this.vStats = new Int32Array(b, this.pStats, this.nStats);
  }

  /** Des octets ou des nombres dans le wasm (a liberer par mmrytm_free) */
  put(arr) {
    const p = this.x.mmrytm_alloc(arr.byteLength);
    new Uint8Array(this.mem.buffer, p, arr.byteLength).set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength));
    return p;
  }

  fail(err) {
    this.ok = false;
    this.port.postMessage({ type: 'error', msg: String((err && err.message) || err) });
  }

  /* ---------------- le processeur ---------------- */

  /** Un passage du fil du calcul (renderLoop), puis ses demandes vers le Worker. */
  pass() {
    const x = this.x;
    const e = this.e;
    x.mmrytm_idle(e, currentTime);
    for (let id; (id = x.mmrytm_job_take(e)) !== 0; ) {
      const desc = new Float64Array(this.mem.buffer, x.mmrytm_job_desc(e, id), this.nDesc).slice();
      const sp = x.mmrytm_job_sample(e, id);
      const u8 = new Uint8Array(this.mem.buffer);
      let end = sp;
      while (u8[end] !== 0) end += 1;
      const job = { type: 'job', id, desc, sample: u8.slice(sp, end) };
      if (this.rp) this.rp.postMessage(job, [job.desc.buffer, job.sample.buffer]);
      else this.pendingJobs.push(job);
    }
    if (this.heldRun && this.published() > 0) {
      this.heldRun = false;
      x.mmrytm_run(e, 1);
    }
    this.views();
  }

  /** Les etats publies par le fil du calcul (Stats.published) */
  published() {
    this.x.mmrytm_stats(this.e);
    this.views();
    return this.vStats[1];
  }

  /** Ce que le Worker a calcule : dans le C++, pour le passage qui l'attend. */
  onRender(d) {
    if (!d || typeof d !== 'object' || !this.ok) return;
    const x = this.x;
    const e = this.e;
    try {
      if (d.type === 'sound' && Array.isArray(d.variants)) {
        x.mmrytm_job_sound_begin(e, d.id, d.variants.length);
        for (const v of d.variants) {
          const pL = this.put(v.L);
          const pR = v.R ? this.put(v.R) : 0;
          x.mmrytm_job_sound_variant(e, d.id, pL, pR, v.L.length);
          x.mmrytm_free(pL);
          if (pR) x.mmrytm_free(pR);
        }
        x.mmrytm_job_sound_end(e, d.id);
      } else if (d.type === 'reverb') {
        const p0 = this.put(d.H0);
        const p1 = this.put(d.H1);
        x.mmrytm_job_reverb(e, d.id, d.parts, p0, p1);
        x.mmrytm_free(p0);
        x.mmrytm_free(p1);
      } else if (d.type === 'fail') {
        // le Worker n'a pas pu : le calcul se fait ici (le meme resultat, le fil audio attend)
        x.mmrytm_job_fail(e, d.id);
      } else return;
      this.pass();
    } catch (err) {
      this.fail(err);
    }
  }

  /** Un texte UTF-8 (Uint8Array) vers une fonction du C++ (pointeur, longueur). */
  withText(bytes, fn) {
    const p = this.put(bytes);
    try {
      return fn(p, bytes.length);
    } finally {
      this.x.mmrytm_free(p);
    }
  }

  onMessage(d) {
    if (!d || typeof d !== 'object') return;
    const x = this.x;
    const e = this.e;
    switch (d.type) {
      case 'program':
        // faceProgram, puis le fil du calcul se reveille
        if (d.bytes instanceof Uint8Array && this.withText(d.bytes, (p, n) => x.mmrytm_program(e, p, n))) this.pass();
        break;
      case 'hit':
        // faceHit : le son deja calcule part tout de suite, sinon apres son calcul
        if (d.bytes instanceof Uint8Array) {
          this.withText(d.bytes, (p, n) => x.mmrytm_hit(e, p, n));
          if (x.mmrytm_pending(e)) this.pass();
        }
        break;
      case 'run':
        if (d.on && this.published() === 0 && x.mmrytm_pending(e)) this.heldRun = true;
        else {
          this.heldRun = false;
          x.mmrytm_run(e, d.on ? 1 : 0);
        }
        break;
      case 'fill':
        x.mmrytm_fill(e, d.on ? 1 : 0);
        break;
      case 'renderer':
        if (d.port) {
          this.rp = d.port;
          this.rp.onmessage = (ev) => this.onRender(ev.data);
          for (const job of this.pendingJobs) this.rp.postMessage(job, [job.desc.buffer, job.sample.buffer]);
          this.pendingJobs.length = 0;
        }
        break;
      default:
        break;
    }
    this.views();
  }

  /** La tete de lecture (Feedback) et les compteurs, vers l'editeur. */
  post(force) {
    const x = this.x;
    const e = this.e;
    x.mmrytm_feedback(e);
    this.views();
    const f = this.vFb;
    // a chaque pas joue, a chaque depart ou arret (ce que l'editeur regarde)
    if (!force && f[0] === this.fb0 && f[1] === this.fb1 && f[3] === this.fb3) return;
    this.fb0 = f[0];
    this.fb1 = f[1];
    this.fb3 = f[3];
    x.mmrytm_stats(e);
    this.views();
    const stats = Int32Array.from(this.vStats);
    this.port.postMessage({ type: 'fb', fb: Array.from(f), stats, peak: this.peak, held: this.heldRun, frame: currentFrame }, [stats.buffer]);
    this.peak = 0;
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length === 0) return true;
    if (!this.ok) return true;
    const L = out[0];
    const R = out.length > 1 ? out[1] : null;
    const len = L.length;
    const x = this.x;
    try {
      for (let off = 0; off < len; off += QUANTUM) {
        const m = Math.min(QUANTUM, len - off);
        x.mmrytm_process(this.e, this.pL, this.pR, m);
        this.views();
        L.set(m === QUANTUM ? this.vL : this.vL.subarray(0, m), off);
        if (R) R.set(m === QUANTUM ? this.vR : this.vR.subarray(0, m), off);
      }
      let pk = this.peak;
      for (let i = 0; i < len; i += 1) {
        const a = L[i] < 0 ? -L[i] : L[i];
        if (a > pk) pk = a;
        if (R) {
          const b = R[i] < 0 ? -R[i] : R[i];
          if (b > pk) pk = b;
        }
      }
      this.peak = pk;
      this.quanta += 1;
      // le fil du calcul : au moins toutes les 100 ms (liberer les etats retires)
      this.renderQ += 1;
      if (this.renderQ >= this.renderEvery) {
        this.renderQ = 0;
        this.pass();
      }
      this.postQ += 1;
      const force = this.postQ >= this.postEvery;
      if (force) this.postQ = 0;
      this.post(force);
    } catch (err) {
      // le module s'est arrete (abort) : le silence, et le fil principal le sait
      L.fill(0);
      if (R) R.fill(0);
      this.fail(err);
    }
    return true;
  }
}

registerProcessor('mm-rytm-engine', MMRytmEngine);
