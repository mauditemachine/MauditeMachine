/**
 * MM-ARP dans le navigateur (2026-11-25, /mm-arp/play/) : le moteur du VST3 (plugin/mm-arp/web-engine, compile en
 * WebAssembly par scripts/build-arp-wasm.sh) dans un AudioWorklet. Ce fil joue le role du processeur du VST3
 * (PluginProcessor.cpp) : faceProgram (parseProgram recopie ligne a ligne), faceParam, faceRun, MIDI LEARN, le MIDI qui
 * entre, l'analyseur, le clip MIDI (arpMidi). L'editeur (le minuteur de PluginEditor.cpp) vit dans le fil principal
 * (webBackend.ts) : ce fil lui envoie ~30 fois par seconde la telemetrie, les 359 parametres, la table MIDI LEARN quand
 * elle change, et l'analyseur 15 fois par seconde quand il est demande.
 *
 * processorOptions : { module (WebAssembly.Module) ou bytes (ArrayBuffer), seed, ccmap [{ch, cc, id}], postHz }.
 * Le module est un "reactor" WASI sans glu : cinq imports seulement (clock_time_get, fd_close, fd_seek, fd_write,
 * random_get), _initialize une fois, puis les mmarp_* (plugin/mm-arp/web-engine/ArpEngine.h).
 */

const QUANTUM = 128;
const TELE_N = 72;
const SPEC_N = 96;
const MAP_N = 16 * 128;
const CLIP_MAX = 8192;
// la telemetrie (ArpEngine.h Telemetry) : les indices lus ici
const T_LEARN = 67;
// les potards du site (mmarp::kKnobs), puis les reglages du VST3 seul (mmx::kExtra)
const KNOBS = 62;
// parseProgram (PluginProcessor.cpp 32-99) : un silence de la suite, la banque des accords du plugin, celle du site
const SEQ_REST = -10000;
const CHORD_BANK = 2;
const SITE_TO_ARP = [0, 5, 6, 4, 3, 2, 7, 5];
// les pistes du STEP SEQUENCER (steps.ts) : cle, bornes, depart (MMArpProgram)
const LANES = [
  ['acc', 0, 2, 1],
  ['slide', 0, 1, 0],
  ['gate', 0, 3, 1],
  ['rat', 1, 4, 1],
  ['prob', 0, 100, 100],
];

/* ---------------- le JSON comme juce::var ---------------- */

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const prop = (o, k) => (isObj(o) ? o[k] : undefined);
const num = (o, k, d) => {
  const v = prop(o, k);
  return isNum(v) ? v : d;
};
// static_cast<int> d'un double : vers zero
const toInt = (v) => Math.trunc(v);
const jlimit = (lo, hi, v) => (v < lo ? lo : v > hi ? hi : v);
// static_cast<bool>(juce::var) : un booleen, un nombre non nul, "true" ou un entier non nul en texte
const toBool = (v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.trim() === 'true' || (parseInt(v, 10) || 0) !== 0;
  return v !== undefined && v !== null;
};

class MMArpEngine extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.ok = false;
    this.peak = 0;
    this.quanta = 0;
    this.idleQ = 0;
    this.postQ = 0;
    this.specOn = false;
    this.specQ = 0;
    this.lastBpm = 120;
    // le numero du dernier message du fil principal traite (le minuteur de l'editeur s'y fie pour les mm_param)
    this.ack = 0;
    this.setRate(typeof o.postHz === 'number' ? o.postHz : 30);
    try {
      this.init(o);
      this.ok = true;
      this.port.postMessage({ type: 'ready', ids: this.ids, defaults: Float32Array.from(this.defaults), knobs: KNOBS, sr: sampleRate, seed: this.seed, clock: this.clock });
    } catch (err) {
      this.port.postMessage({ type: 'error', msg: String((err && err.message) || err) });
    }
    this.port.onmessage = (ev) => {
      if (!this.ok) return;
      try {
        this.onMessage(ev.data);
      } catch (err) {
        this.port.postMessage({ type: 'log', msg: String((err && err.message) || err) });
      }
      const seq = ev.data && ev.data.seq;
      if (typeof seq === 'number' && seq > this.ack) this.ack = seq;
    };
  }

  /* ---------------- le module ---------------- */

  init(o) {
    const mod = o.module instanceof WebAssembly.Module ? o.module : new WebAssembly.Module(o.bytes);
    let mem = null;
    let dv = null;
    const view = () => (dv && dv.buffer === mem.buffer ? dv : (dv = new DataView(mem.buffer)));
    // l'horloge du compteur CPU (steady_clock -> clock_time_get, en ns) : performance.now si le fil l'a, sinon Date.now
    const perf = typeof globalThis.performance !== 'undefined' && globalThis.performance && typeof globalThis.performance.now === 'function' ? globalThis.performance : null;
    this.clock = perf ? 'performance' : 'date';
    const nowMs = perf ? () => perf.now() : () => Date.now();
    const wasi = {
      clock_time_get: (_id, _precision, out) => {
        const ns = nowMs() * 1e6;
        const d = view();
        d.setUint32(out, ns % 4294967296 >>> 0, true);
        d.setUint32(out + 4, Math.floor(ns / 4294967296) >>> 0, true);
        return 0;
      },
      fd_close: () => 0,
      fd_seek: () => 0,
      fd_write: (_fd, iov, cnt, nwritten) => {
        const d = view();
        let t = 0;
        for (let i = 0; i < cnt; i += 1) t += d.getUint32(iov + i * 8 + 4, true);
        d.setUint32(nwritten, t, true);
        return 0;
      },
      // std::random_device (jamais appele : le moteur est toujours seede)
      random_get: (buf, len) => {
        const b = new Uint8Array(mem.buffer, buf, len);
        for (let i = 0; i < len; i += 1) b[i] = (Math.random() * 256) | 0;
        return 0;
      },
    };
    const x = new WebAssembly.Instance(mod, { wasi_snapshot_preview1: wasi }).exports;
    mem = x.memory;
    x._initialize();
    this.x = x;
    this.mem = mem;
    const n = x.mmarp_param_count();
    this.n = n;
    // les ids (mmx::allId), en ASCII : le fil audio n'a pas toujours TextDecoder
    const bytes = () => new Uint8Array(mem.buffer);
    this.ids = [];
    for (let i = 0; i < n; i += 1) {
      const p = x.mmarp_param_id(i);
      const b = bytes();
      let s = '';
      for (let k = p; b[k] !== 0; k += 1) s += String.fromCharCode(b[k]);
      this.ids.push(s);
    }
    this.index = new Map(this.ids.map((id, i) => [id, i]));
    this.defaults = [];
    for (let i = 0; i < n; i += 1) this.defaults.push(x.mmarp_param_default(i));
    this.seed = (typeof o.seed === 'number' ? o.seed : 808) >>> 0;
    const e = x.mmarp_create(this.seed);
    if (!e) throw new Error('mmarp_create');
    this.e = e;
    // La table MIDI LEARN gardee (setStateInformation : mapSet), avant prepareToPlay
    for (const it of Array.isArray(o.ccmap) ? o.ccmap : []) {
      const i = it && typeof it.id === 'string' ? this.index.get(it.id) : undefined;
      const ch = it ? toInt(Number(it.ch)) : 0;
      const cc = it ? toInt(Number(it.cc)) : -1;
      if (i !== undefined && ch >= 1 && ch <= 16 && cc >= 0 && cc < 128) x.mmarp_map_set(e, ch - 1, cc, i);
    }
    x.mmarp_prepare(e, sampleRate, QUANTUM);
    // la memoire du JS dans le wasm : les sorties, l'analyseur, le programme
    this.pL = x.mmarp_alloc(QUANTUM * 4);
    this.pR = x.mmarp_alloc(QUANTUM * 4);
    this.pSpec = x.mmarp_alloc(SPEC_N * 4);
    this.pSeq = x.mmarp_alloc(16 * 4);
    this.pProg = x.mmarp_alloc(8 * 4);
    this.pLanes = x.mmarp_alloc(80);
    this.pKnobs = x.mmarp_alloc(KNOBS * 4);
    this.pExtra = x.mmarp_alloc((n - KNOBS) * 4);
    this.pBars = x.mmarp_alloc(4);
    this.pClip = 0;
    this.clipMax = 0;
    this.pTele = x.mmarp_telemetry(e);
    this.pParams = x.mmarp_params(e);
    this.pMap = x.mmarp_ccmap(e);
    this.buf = null;
    this.views();
  }

  /** Les vues sur la memoire du wasm, refaites si elle a grandi (ALLOW growth : l'ancien tampon est detache). */
  views() {
    if (this.buf === this.mem.buffer) return;
    const b = this.mem.buffer;
    this.buf = b;
    this.vL = new Float32Array(b, this.pL, QUANTUM);
    this.vR = new Float32Array(b, this.pR, QUANTUM);
    this.vSpec = new Float32Array(b, this.pSpec, SPEC_N);
    this.vTele = new Float64Array(b, this.pTele, TELE_N);
    this.vParams = new Float32Array(b, this.pParams, this.n);
    this.vMap = new Int32Array(b, this.pMap, MAP_N);
  }

  setRate(hz) {
    const q = sampleRate / QUANTUM;
    this.postEvery = Math.max(1, Math.round(q / Math.max(1, hz)));
    // le timer de l'instance du VST3 : 15 Hz (la latence, la reverb recalculee)
    this.idleEvery = Math.max(1, Math.round(q / 15));
  }

  /* ---------------- le processeur ---------------- */

  /** parseProgram (PluginProcessor.cpp 70-99), puis faceProgram (la regle knobsKnown est dans le moteur). */
  program(json) {
    let o;
    try {
      o = JSON.parse(json);
    } catch {
      return;
    }
    if (!isObj(o) || toInt(num(o, 'v', 0)) !== 2) return;
    const x = this.x;
    const bpm = jlimit(20, 400, num(o, 'bpm', 120));
    const swing = jlimit(0, 0.5, num(o, 'swing', 0));
    // parseSeq
    const s = prop(o, 'seq');
    const edit = toBool(prop(s, 'edit'));
    const len = jlimit(1, 16, toInt(num(s, 'len', 8)));
    const buf = new Int32Array(16);
    const b = prop(s, 'buf');
    if (Array.isArray(b))
      for (let i = 0; i < Math.min(16, b.length); i += 1) {
        const d = b[i];
        buf[i] = isNum(d) ? jlimit(-7, 24, toInt(d)) : SEQ_REST;
      }
    // parseProg : les indices du site (sans chordBank 2) convertis, 8 au plus
    const site = !(isNum(prop(o, 'chordBank')) && toInt(o.chordBank) === CHORD_BANK);
    const prog = new Int32Array(8);
    let nProg = 0;
    const pr = prop(o, 'prog');
    if (Array.isArray(pr))
      for (const c of pr)
        if (isNum(c) && nProg < 8 && toInt(c) >= 0 && toInt(c) < 8) {
          prog[nProg] = site ? SITE_TO_ARP[toInt(c)] : toInt(c);
          nProg += 1;
        }
    // parseKnobs : un objet seulement ; les departs, puis ses potards connus
    const kn = prop(o, 'knobs');
    const hasKnobs = isObj(kn);
    const knobs = new Float32Array(KNOBS);
    for (let i = 0; i < KNOBS; i += 1) knobs[i] = this.defaults[i];
    if (hasKnobs)
      for (const [id, v] of Object.entries(kn)) {
        const i = this.index.get(id);
        if (i !== undefined && i < KNOBS && isNum(v)) knobs[i] = jlimit(0, 1, v);
      }
    // les pistes par pas : leurs departs, puis ce que le programme porte
    const lanes = new Uint8Array(80);
    const st = prop(o, 'steps');
    LANES.forEach(([key, lo, hi, def], k) => {
      lanes.fill(def, k * 16, k * 16 + 16);
      const a = prop(st, key);
      if (Array.isArray(a))
        for (let i = 0; i < Math.min(16, a.length); i += 1) if (isNum(a[i])) lanes[k * 16 + i] = jlimit(lo, hi, toInt(a[i]));
    });
    // les reglages du VST3 seul : leurs departs, puis ceux du programme
    const nx = this.n - KNOBS;
    const extra = new Float32Array(nx);
    for (let i = 0; i < nx; i += 1) extra[i] = this.defaults[KNOBS + i];
    const xo = prop(o, 'extra');
    if (isObj(xo))
      for (const [id, v] of Object.entries(xo)) {
        const i = this.index.get(id);
        if (i !== undefined && i >= KNOBS && isNum(v)) extra[i - KNOBS] = jlimit(0, 1, v);
      }
    this.views();
    const b8 = this.mem.buffer;
    new Int32Array(b8, this.pSeq, 16).set(buf);
    new Int32Array(b8, this.pProg, 8).set(prog);
    new Uint8Array(b8, this.pLanes, 80).set(lanes);
    new Float32Array(b8, this.pKnobs, KNOBS).set(knobs);
    new Float32Array(b8, this.pExtra, nx).set(extra);
    x.mmarp_set_program(this.e, bpm, swing, edit ? 1 : 0, len, this.pSeq, this.pProg, nProg, this.pLanes, this.pKnobs, this.pExtra, hasKnobs ? 1 : 0);
    this.lastBpm = bpm;
    this.views();
  }

  /** arpMidi : les notes de la progression (le moteur), le fichier est ecrit par le fil principal. */
  clip(cycles) {
    const x = this.x;
    const c = jlimit(1, 8, toInt(isNum(cycles) ? cycles : 1));
    let n = 0;
    for (let pass = 0; pass < 2; pass += 1) {
      if (this.clipMax === 0) {
        this.clipMax = CLIP_MAX;
        this.pClip = x.mmarp_alloc(this.clipMax * 16);
      }
      n = x.mmarp_render_clip(this.e, c, this.pClip, this.clipMax, this.pBars);
      if (n <= this.clipMax) break;
      x.mmarp_free(this.pClip);
      this.clipMax = n;
      this.pClip = x.mmarp_alloc(this.clipMax * 16);
    }
    this.views();
    const bars = new Int32Array(this.mem.buffer, this.pBars, 1)[0];
    const notes = Float32Array.from(new Float32Array(this.mem.buffer, this.pClip, Math.min(n, this.clipMax) * 4));
    return { bars, notes, bpm: this.lastBpm };
  }

  onMessage(d) {
    if (!d || typeof d !== 'object') return;
    const x = this.x;
    const e = this.e;
    switch (d.type) {
      case 'program':
        if (typeof d.json === 'string') this.program(d.json);
        break;
      case 'param': {
        // faceParam : un id inconnu ou une valeur non finie ne fait rien ; sinon borne a 0..1, potards connus
        const i = this.index.get(d.id);
        if (i !== undefined && isNum(d.v)) x.mmarp_set_param(e, i, d.v);
        break;
      }
      case 'run':
        x.mmarp_run(e, d.on ? 1 : 0);
        break;
      case 'learn': {
        const i = typeof d.id === 'string' && d.id !== '' ? this.index.get(d.id) : -1;
        x.mmarp_learn(e, i === undefined ? -1 : i);
        break;
      }
      case 'unmap':
        x.mmarp_unmap(e, toInt(isNum(d.ch) ? d.ch : 0) - 1, toInt(isNum(d.cc) ? d.cc : -1));
        break;
      case 'unmapAll':
        x.mmarp_unmap_all(e);
        break;
      case 'spec':
        this.specOn = !!d.on;
        x.mmarp_set_spec_on(e, this.specOn ? 1 : 0);
        break;
      case 'midi':
        if (isNum(d.s)) x.mmarp_midi(e, 0, d.s & 255, (d.d1 | 0) & 127, (d.d2 | 0) & 127);
        break;
      case 'clip': {
        const r = this.clip(d.cycles);
        this.port.postMessage({ type: 'clip', id: d.id, bars: r.bars, bpm: r.bpm, notes: r.notes }, [r.notes.buffer]);
        break;
      }
      case 'rate':
        if (isNum(d.hz)) this.setRate(d.hz);
        break;
      default:
        break;
    }
  }

  /** Ce que lit le minuteur de l'editeur (PluginEditor.cpp timerCallback). */
  post() {
    const x = this.x;
    const e = this.e;
    x.mmarp_telemetry(e);
    this.views();
    const msg = { type: 'tick', tele: Float64Array.from(this.vTele), params: Float32Array.from(this.vParams), peak: this.peak, frame: currentFrame, ack: this.ack };
    this.peak = 0;
    if (x.mmarp_take_map_changed(e)) {
      msg.map = Int32Array.from(this.vMap);
      msg.learn = this.vTele[T_LEARN];
    }
    // l'analyseur : 15 fois par seconde (sa descente compte les appels, comme le minuteur du VST3)
    if (this.specOn) {
      this.specQ ^= 1;
      if (this.specQ === 0) {
        x.mmarp_spec_frame(e, this.pSpec);
        this.views();
        msg.spec = Float32Array.from(this.vSpec);
      }
    }
    const tr = [msg.tele.buffer, msg.params.buffer];
    if (msg.map) tr.push(msg.map.buffer);
    if (msg.spec) tr.push(msg.spec.buffer);
    this.port.postMessage(msg, tr);
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
        x.mmarp_process(this.e, this.pL, this.pR, m);
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
      // le timer de l'instance (15 Hz), jamais a chaque quantum : la reverb peut s'y recalculer
      this.idleQ += 1;
      if (this.idleQ >= this.idleEvery) {
        this.idleQ = 0;
        x.mmarp_idle(this.e);
      }
      this.postQ += 1;
      if (this.postQ >= this.postEvery) {
        this.postQ = 0;
        this.post();
      }
    } catch (err) {
      // le module s'est arrete (abort) : le silence, et le fil principal le sait
      this.ok = false;
      L.fill(0);
      if (R) R.fill(0);
      this.port.postMessage({ type: 'error', msg: String((err && err.message) || err) });
    }
    return true;
  }
}

registerProcessor('mm-arp-engine', MMArpEngine);
