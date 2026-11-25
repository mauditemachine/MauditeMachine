/**
 * MM-RYTM dans le navigateur (2026-11-25, /mm-rytm/play/) : le fil du calcul du VST3 (PluginProcessor.cpp Renderer) dans
 * un Worker. Une seconde instance du meme module WebAssembly (plugin/mm-rytm/web-engine) calcule ce que l'AudioWorklet
 * lui demande, des fonctions pures du DSP : un son (ses variantes, mm::renderLayers : soundFor sans le cache) ou la
 * reponse de la reverb (mm::ReverbIR::make). Le meme code que le VST3, donc les memes nombres, sans jamais bloquer le
 * fil audio (un kit entier : plusieurs centaines de ms).
 *
 * La banque des samples (SampleBank.cpp) : les fichiers WAV de public/samples/rytm, telecharges a la premiere demande
 * (les memes octets que BinaryData du VST3), decodes par le C++ (mm::decodeWav). Un sample hors de la banque (un sample
 * perso du navigateur, la banque synthetisee) : la couche SAMPLE se tait, comme dans le VST3.
 *
 * Avant le premier geste (pas encore de son ni de worklet), les programmes de la face arrivent aussi ici : une instance
 * du moteur dit quels calculs le worklet demandera (a la frequence attendue du contexte), ils sont faits d'avance et
 * gardes ; le premier PLAY part tout de suite.
 *
 * Messages (fil principal) : init { module | bytes, samples [{ key, url }], rates }, prefetch { bytes }, port { port }.
 * Messages (worklet, par le port) : job { id, desc Float64Array, sample Uint8Array } -> sound { id, variants [{ L, R }] },
 * reverb { id, parts, H0, H1 } ou fail { id }.
 */

/* global self */

const FAMILIES = ['bd', 'sd', 'ch', 'oh', 'cp', 'tom', 'ht', 'cy'];
// un seul fichier de cache : au-dela, les plus anciens partent (des calculs d'avance jamais demandes)
const CACHE_MAX = 96;

let x = null;
let mem = null;
let port = null;
let prefetchRates = [48000];
const enc = new TextEncoder();
const dec = new TextDecoder();
/** la banque du site : la cle de la face ('bd/Bd 1.wav') -> l'adresse ; et ce qui est deja dans le C++ */
const bankUrl = new Map();
const loaded = new Map();
/** les calculs faits : la description (et le sample) -> le resultat a envoyer */
const cache = new Map();
const queue = [];
let busy = false;
const stats = { rendered: 0, cached: 0, fetched: 0, failed: 0, ms: 0 };

/* ---------------- le module ---------------- */

function instantiate(o) {
  const mod = o.module instanceof WebAssembly.Module ? o.module : new WebAssembly.Module(o.bytes);
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
  x = new WebAssembly.Instance(mod, imports).exports;
  mem = x.memory;
  x._initialize();
}

/** Des octets dans la memoire du wasm (a liberer par x.mmrytm_free). */
function put(bytes) {
  const p = x.mmrytm_alloc(bytes.length);
  new Uint8Array(mem.buffer, p, bytes.length).set(bytes);
  return p;
}

/* ---------------- la banque ---------------- */

/** SampleBank : la famille d'un fichier par son nom ("Bd 1.wav" -> bd), .wav seulement */
function familyOf(file) {
  if (file.length < 4 || file.slice(-4).toLowerCase() !== '.wav') return null;
  const name = file.slice(0, -4);
  const sp = name.indexOf(' ');
  const prefix = (sp < 0 ? name : name.slice(0, sp)).toLowerCase();
  return FAMILIES.includes(prefix) ? prefix : null;
}

/** byKey : la famille de la cle et le nom du fichier ; les fichiers de la banque qui y repondent */
function bankFiles(key) {
  const slash = key.indexOf('/');
  const fam = slash < 0 ? key : key.slice(0, slash);
  const file = slash < 0 ? '' : key.slice(slash + 1);
  const out = [];
  for (const [k, url] of bankUrl) {
    const f = k.slice(k.indexOf('/') + 1);
    if (f === file && familyOf(f) === fam) out.push({ k, f, url });
  }
  return out;
}

/** Le sample d'un son dans le C++ avant son calcul (telecharge une fois ; trois essais) */
async function ensureSample(key) {
  for (const s of bankFiles(key)) {
    if (loaded.has(s.k)) continue;
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt += 1) {
      try {
        const r = await fetch(s.url);
        if (!r.ok) continue;
        const data = new Uint8Array(await r.arrayBuffer());
        const fb = enc.encode(s.f);
        const pf = put(fb);
        const pd = put(data);
        ok = x.mmrytm_bank_add(pf, fb.length, pd, data.length) === 1;
        x.mmrytm_free(pf);
        x.mmrytm_free(pd);
        stats.fetched += 1;
      } catch {
        /* le reseau : on reessaie */
      }
    }
    loaded.set(s.k, ok);
  }
}

/* ---------------- les calculs ---------------- */

const keyOf = (desc, sample) => `${Array.prototype.join.call(desc, ',')}|${dec.decode(sample)}`;

/** Un son (mmrytm_render_sound) : ses variantes, copiees hors du wasm */
function renderSound(desc, sample) {
  const pd = x.mmrytm_alloc(desc.length * 8);
  new Float64Array(mem.buffer, pd, desc.length).set(desc);
  const ps = put(sample);
  const r = x.mmrytm_render_sound(pd, ps, sample.length);
  x.mmrytm_free(pd);
  x.mmrytm_free(ps);
  const n = x.mmrytm_rendered_count(r);
  const variants = [];
  for (let v = 0; v < n; v += 1) {
    const len = x.mmrytm_rendered_len(r, v);
    const L = new Float32Array(mem.buffer, x.mmrytm_rendered_L(r, v), len).slice();
    const R = x.mmrytm_rendered_mono(r, v) ? null : new Float32Array(mem.buffer, x.mmrytm_rendered_R(r, v), len).slice();
    variants.push({ L, R });
  }
  x.mmrytm_rendered_free(r);
  return { type: 'sound', variants };
}

/** La reponse de la reverb (mmrytm_render_reverb) : ses spectres (re, im) par canal */
function renderReverb(desc) {
  const ir = x.mmrytm_render_reverb(desc[2], desc[3], desc[4], desc[1]);
  const parts = x.mmrytm_reverb_parts(ir);
  const n = parts * 257 * 2;
  const H0 = new Float32Array(mem.buffer, x.mmrytm_reverb_H(ir, 0), n).slice();
  const H1 = new Float32Array(mem.buffer, x.mmrytm_reverb_H(ir, 1), n).slice();
  x.mmrytm_reverb_free(ir);
  return { type: 'reverb', parts, H0, H1 };
}

async function compute(desc, sample) {
  const key = keyOf(desc, sample);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    stats.cached += 1;
    return hit;
  }
  const t0 = Date.now();
  let res;
  if (desc[0] < 0) res = renderReverb(desc);
  else {
    if (sample.length > 0) await ensureSample(dec.decode(sample));
    res = renderSound(desc, sample);
  }
  stats.rendered += 1;
  stats.ms += Date.now() - t0;
  return res;
}

const transfers = (res) => (res.type === 'reverb' ? [res.H0.buffer, res.H1.buffer] : res.variants.flatMap((v) => (v.R ? [v.L.buffer, v.R.buffer] : [v.L.buffer])));

/** Avant le premier geste : les calculs que le worklet demandera pour ce programme, faits d'avance (a chaque frequence) */
async function prefetch(bytes) {
  for (const sr of prefetchRates) {
    // le worklet est arrive entre-temps : ses demandes passent d'abord
    if (port) return;
    await prefetchAt(bytes, sr);
  }
}

async function prefetchAt(bytes, sr) {
  const e = x.mmrytm_create();
  x.mmrytm_set_async(e, 1);
  x.mmrytm_prepare(e, sr, 128);
  const p = put(bytes);
  const ok = x.mmrytm_program(e, p, bytes.length);
  x.mmrytm_free(p);
  const jobs = [];
  if (ok) {
    x.mmrytm_idle(e, 0);
    const nd = x.mmrytm_job_desc_size();
    for (let id; (id = x.mmrytm_job_take(e)) !== 0; ) {
      const desc = new Float64Array(mem.buffer, x.mmrytm_job_desc(e, id), nd).slice();
      const sp = x.mmrytm_job_sample(e, id);
      const u8 = new Uint8Array(mem.buffer);
      let end = sp;
      while (u8[end] !== 0) end += 1;
      jobs.push({ desc, sample: u8.slice(sp, end) });
    }
  }
  x.mmrytm_destroy(e);
  for (const j of jobs) {
    const key = keyOf(j.desc, j.sample);
    if (cache.has(key)) continue;
    if (j.desc[0] >= 0 && j.sample.length > 0) await ensureSample(dec.decode(j.sample));
    const t0 = Date.now();
    cache.set(key, j.desc[0] < 0 ? renderReverb(j.desc) : renderSound(j.desc, j.sample));
    stats.rendered += 1;
    stats.ms += Date.now() - t0;
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  }
}

/* ---------------- la file (un calcul a la fois, comme le fil du VST3) ---------------- */

async function pump() {
  if (busy || !x) return;
  busy = true;
  try {
    while (queue.length > 0) {
      const m = queue.shift();
      try {
        if (m.type === 'job') {
          const res = await compute(m.desc, m.sample);
          port.postMessage({ ...res, id: m.id }, transfers(res));
        } else if (m.type === 'prefetch') {
          // le worklet est la : ses demandes passent d'abord, l'avance ne sert plus
          if (!port) await prefetch(m.bytes);
        }
      } catch (err) {
        stats.failed += 1;
        if (m.type === 'job' && port) port.postMessage({ type: 'fail', id: m.id });
        self.postMessage({ type: 'log', msg: String((err && err.message) || err) });
      }
    }
  } finally {
    busy = false;
  }
}

self.onmessage = (ev) => {
  const d = ev.data;
  if (!d || typeof d !== 'object') return;
  switch (d.type) {
    case 'init':
      try {
        instantiate(d);
        if (Array.isArray(d.rates)) prefetchRates = d.rates.filter((r) => typeof r === 'number' && r > 0).slice(0, 2);
        for (const s of Array.isArray(d.samples) ? d.samples : []) if (s && typeof s.key === 'string' && typeof s.url === 'string') bankUrl.set(s.key, s.url);
        self.postMessage({ type: 'ready' });
      } catch (err) {
        self.postMessage({ type: 'error', msg: String((err && err.message) || err) });
        return;
      }
      void pump();
      break;
    case 'prefetch':
      if (d.bytes instanceof Uint8Array) {
        // seul le dernier programme compte (la face en envoie plusieurs en s'ouvrant)
        for (let i = queue.length - 1; i >= 0; i -= 1) if (queue[i].type === 'prefetch') queue.splice(i, 1);
        queue.push({ type: 'prefetch', bytes: d.bytes });
        void pump();
      }
      break;
    case 'port':
      port = d.port;
      port.onmessage = (e2) => {
        const m = e2.data;
        if (!m || m.type !== 'job') return;
        queue.push({ type: 'job', id: m.id, desc: m.desc, sample: m.sample instanceof Uint8Array ? m.sample : new Uint8Array(0) });
        void pump();
      };
      break;
    case 'stats':
      self.postMessage({ type: 'stats', stats: { ...stats, bank: x ? x.mmrytm_bank_count() : 0, cache: cache.size } });
      break;
    default:
      break;
  }
};
