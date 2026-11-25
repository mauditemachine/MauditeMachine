// Rendus de reference des effets du MM-ARP (plugin/mm-arp/dsp/ArpFx), sans aucun son :
//   node plugin/mm-arp/tests/fx-ref.mjs <dossier> [worklet] [chain]
// - worklet : le vrai src/v4/audio/chorus.worklet.js ('mm-chorus' juno, 'mm-tape') charge sous Node avec des stubs
//   (sampleRate, registerProcessor, AudioWorkletProcessor), joue bloc de 128 par bloc de 128 ;
// - chain : la vraie chaine du site dans un OfflineAudioContext de Chromium (Playwright, --mute-audio) : chorus.ts,
//   insert.ts, glide.ts, sends.ts, fx.ts, voyager/params.ts tels quels (types retires par Node), et build, applyFx,
//   buildPingPong, retime, volGain... extraits du texte de src/v4/audio/synth.ts ; un AudioBufferSourceNode a la place
//   du moteur. Les changements de reglages tombent sur des suspend() alignes sur 128.
// Chaque cas est ecrit dans <dossier>/<nom>.mmfx : une suite de tableaux nommes (nom 16 octets, type 0 f32 / 1 f64,
// nombre, donnees), lue par plugin/mm-arp/tests/fx_test.cpp.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const out = resolve(process.argv[2] ?? join(here, '.fxref'));
const want = process.argv.slice(3).filter((a) => !a.startsWith('runs='));
// runs=N : la chaine rendue N fois (Chromium n'est pas deterministe juste apres un changement du graphe : voir fx_test)
const RUNS = Number((process.argv.find((a) => a.startsWith('runs=')) ?? 'runs=3').slice(5)) || 1;
const doWorklet = want.length === 0 || want.includes('worklet');
const doChain = want.length === 0 || want.includes('chain');
const SR = 48000;
const Q = 128;
mkdirSync(out, { recursive: true });

/* ---------------- les modules du site, types retires ---------------- */

const mods = join(out, 'site');
mkdirSync(mods, { recursive: true });
function tsToMjs(rel, name, extra = (s) => s) {
  let code = stripTypeScriptTypes(readFileSync(join(repo, rel), 'utf8'), { mode: 'transform' });
  code = code.replace(/from '\.\/([a-z]+)'/g, "from './$1.mjs'");
  code = extra(code);
  writeFileSync(join(mods, `${name}.mjs`), code);
}
tsToMjs('src/v4/audio/glide.ts', 'glide');
tsToMjs('src/v4/audio/insert.ts', 'insert');
tsToMjs('src/v4/audio/fx.ts', 'fx');
tsToMjs('src/v4/audio/sends.ts', 'sends');
tsToMjs('src/v4/voyager/params.ts', 'params');
tsToMjs('src/v4/audio/chorus.ts', 'chorus', (s) => s.replace(/import chorusUrl from '\.\/chorus\.worklet\.js\?url';/, "const chorusUrl = new URL('./chorus.worklet.js', import.meta.url).href;"));
writeFileSync(join(mods, 'chorus.worklet.js'), readFileSync(join(repo, 'src/v4/audio/chorus.worklet.js')));

/** Les declarations de synth.ts dont la chaine a besoin, extraites de son texte (types retires). */
function synthChain() {
  const js = stripTypeScriptTypes(readFileSync(join(repo, 'src/v4/audio/synth.ts'), 'utf8'), { mode: 'transform' });
  const take = (start) => {
    // jusqu'au ; (ou la } d'une fonction) de profondeur 0
    let depth = 0;
    let fn = js.startsWith('function', start);
    let opened = false;
    for (let i = start; i < js.length; i += 1) {
      const ch = js[i];
      if (ch === '/' && js[i + 1] === '/') {
        i = js.indexOf('\n', i);
        continue;
      }
      if (ch === '/' && js[i + 1] === '*') {
        i = js.indexOf('*/', i) + 1;
        continue;
      }
      if (ch === "'" || ch === '`') {
        i = js.indexOf(ch, i + 1);
        continue;
      }
      if ('([{'.includes(ch)) {
        depth += 1;
        if (ch === '{') opened = true;
      } else if (')]}'.includes(ch)) {
        depth -= 1;
        if (fn && opened && depth === 0 && ch === '}') return js.slice(start, i + 1);
      } else if (!fn && ch === ';' && depth === 0) return js.slice(start, i + 1);
    }
    throw new Error('declaration sans fin');
  };
  const decl = (name) => {
    // (un export devant ou non : la declaration seule est reprise)
    const m = new RegExp(`(^|\\n)(export )?((?:const ${name} =)|(?:function ${name}\\())`).exec(js);
    if (!m) throw new Error(`synth.ts : ${name} introuvable`);
    return take(m.index + m[1].length + (m[2] ?? '').length);
  };
  const names = ['VOLUME_K', 'MAKEUP', 'REVERB_BOOST', 'PINGPONG', 'delayS', 'MONO_OFF_HZ', 'BUTTER_Q_DB', 'buildPingPong', 'butter', 'build', 'tapeTime', 'applyFx', 'retimeAll', 'volGain', 'retime'];
  return [
    "import { chorusMode, delaySixteenths, fxAmount, monoLowHz } from './params.mjs';",
    "import { buildJunoChorus, loadChorus, tapeNode } from './chorus.mjs';",
    "import { glide } from './glide.mjs';",
    "export { loadChorus };",
    'export const voyParams = { cur: null, get() { return voyParams.cur; } };',
    'const stepOf = () => 60 / 120 / 4;',
    ...names.map(decl),
    'export { build, applyFx, retimeAll, volGain, delayS };',
  ].join('\n\n');
}
writeFileSync(join(mods, 'chain.mjs'), synthChain());

/* ---------------- les signaux de test (a graine) ---------------- */

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Un signal de synthe : notes en dent de scie (graves, mediums) a enveloppe, bruit en rafales, impulsions, sinus. */
function signal(n, seed, kind = 'mix') {
  const r = mulberry(seed);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    let l = 0;
    let rr = 0;
    if (kind === 'mix' || kind === 'synth') {
      // une note toutes les 0.25 s, 55 a 440 Hz, dent de scie un peu desaccordee a droite
      const k = Math.floor(t / 0.25);
      const f = 55 * Math.pow(2, ((k * 7) % 36) / 12);
      const tt = t - k * 0.25;
      const env = Math.exp(-tt * 6) * Math.min(1, tt / 0.003) * (t < n / SR - 1.2 ? 1 : 0);
      const saw = (x) => 2 * (x - Math.floor(x + 0.5));
      l += 0.25 * env * saw(f * t);
      rr += 0.25 * env * saw(f * 1.003 * t + 0.1);
    }
    if (kind === 'mix' || kind === 'noise') {
      const burst = Math.floor(t / 0.4) % 2 === 0 && t < n / SR - 1.2 ? 0.12 : 0;
      const a = r() * 2 - 1;
      const b = r() * 2 - 1;
      l += burst * a;
      rr += burst * (0.6 * a + 0.4 * b);
    }
    if (kind === 'mix' || kind === 'imp') {
      if (i % 19200 === 300) {
        l += 0.7;
        rr += 0.5;
      }
      l += t < 0.6 ? 0.1 * Math.sin(2 * Math.PI * 3000 * t) : 0;
      rr += t < 0.6 ? 0.1 * Math.sin(2 * Math.PI * 70 * t) : 0;
    }
    L[i] = l;
    R[i] = rr;
  }
  return { L, R };
}

/* ---------------- le format des cas ---------------- */

function writeCase(name, arrays) {
  const parts = [];
  for (const [k, v] of Object.entries(arrays)) {
    const isF64 = v instanceof Float64Array || Array.isArray(v);
    const data = isF64 ? Float64Array.from(v) : v;
    const h = Buffer.alloc(24);
    h.write(k.padEnd(16, '\0').slice(0, 16), 0, 'latin1');
    h.writeInt32LE(isF64 ? 1 : 0, 16);
    h.writeInt32LE(data.length, 20);
    parts.push(h, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  }
  writeFileSync(join(out, `${name}.mmfx`), Buffer.concat(parts));
}

/* ---------------- 1. les worklets sous Node ---------------- */

async function worklets() {
  const procs = {};
  class AWP {
    constructor() {
      this.port = { onmessage: null, postMessage() {} };
    }
  }
  const src = readFileSync(join(repo, 'src/v4/audio/chorus.worklet.js'), 'utf8');
  new Function('sampleRate', 'registerProcessor', 'AudioWorkletProcessor', src)(SR, (n, c) => (procs[n] = c), AWP);
  const { JUNO } = await import(pathToFileURL(join(mods, 'chorus.mjs')).href);
  const dmin = JUNO.delay.min - JUNO.filterDelay;
  const dmax = JUNO.delay.max - JUNO.filterDelay;

  const juno = (name, seconds, seed, kind, rate0, switches) => {
    const n = Math.round((seconds * SR) / Q) * Q;
    const { L, R } = signal(n, seed, kind);
    const p = new procs['mm-chorus']({ processorOptions: { kind: 'juno', dmin, dmax, biquads: JUNO.biquads, pole: JUNO.pole, rate: rate0 } });
    const oL = new Float32Array(n);
    const oR = new Float32Array(n);
    const rate = new Float64Array(n / Q);
    for (let q = 0; q < n / Q; q += 1) {
      if (switches[q] !== undefined) {
        p.port.onmessage({ data: { rate: switches[q] } });
        rate[q] = switches[q];
      }
      const a = q * Q;
      p.process([[L.subarray(a, a + Q), R.subarray(a, a + Q)]], [[oL.subarray(a, a + Q), oR.subarray(a, a + Q)]]);
    }
    writeCase(name, { kind: [0], init: [dmin, dmax, rate0], inL: L, inR: R, rate, outL: oL, outR: oR });
  };
  juno('w_juno_I_noise', 2, 11, 'noise', JUNO.rates[0], {});
  juno('w_juno_II_mix', 2, 12, 'mix', JUNO.rates[1], {});
  juno('w_juno_switch', 3, 13, 'mix', JUNO.rates[0], { 100: JUNO.rates[1], 333: JUNO.rates[0], 500: JUNO.rates[1] });

  const tape = (name, seconds, seed, kind, sched) => {
    const n = Math.round((seconds * SR) / Q) * Q;
    const { L, R } = signal(n, seed, kind);
    const p = new procs['mm-tape']({ processorOptions: { maxS: 2 } });
    const oL = new Float32Array(n);
    const oR = new Float32Array(n);
    const time = new Float32Array(n);
    const fbQ = new Float32Array(n / Q);
    const tapeQ = new Float32Array(n / Q);
    for (let q = 0; q < n / Q; q += 1) {
      const a = q * Q;
      const s = sched(q);
      for (let i = 0; i < Q; i += 1) time[a + i] = s.time(a + i);
      fbQ[q] = s.fb;
      tapeQ[q] = s.tape;
      // a-rate : un tableau de 128 pendant une rampe, de 1 sinon (comme Chromium)
      const tq = time.subarray(a, a + Q);
      const constant = tq.every((v) => v === tq[0]);
      const params = { time: constant ? tq.subarray(0, 1) : tq, fb: fbQ.subarray(q, q + 1), tape: tapeQ.subarray(q, q + 1) };
      p.process([[L.subarray(a, a + Q), R.subarray(a, a + Q)]], [[oL.subarray(a, a + Q), oR.subarray(a, a + Q)]], params);
    }
    writeCase(name, { kind: [1], init: [2], inL: L, inR: R, time, fb: fbQ, tape: tapeQ, outL: oL, outR: oR });
  };
  // une rafale puis 4 s de silence : la bande s'endort (sa memoire depassee), se reveille a la note suivante
  tape('w_tape_sleep', 6, 21, 'noise', () => ({ time: () => 0.375, fb: 0.5, tape: 0.3 }));
  // un retime (0.375 -> 0.25 en 0.2 s a 1 s), fb et tape qui glissent bloc par bloc
  tape('w_tape_glide', 3, 22, 'mix', (q) => {
    const t0 = 1 * SR;
    const t1 = t0 + 0.2 * SR;
    const fr = (k) => (k < t0 ? 0.375 : k >= t1 ? 0.25 : 0.375 + (0.25 - 0.375) * ((k - t0) / (t1 - t0)));
    const g = Math.min(1, Math.max(0, (q * Q - 1.5 * SR) / (0.02 * SR)));
    return { time: (k) => Math.fround(fr(k)), fb: Math.fround(0.4 + 0.25 * g), tape: Math.fround(0.2 + 0.7 * g) };
  });
  tape('w_tape_zero', 2, 23, 'imp', () => ({ time: () => Math.fround(0.125), fb: Math.fround(0.68), tape: 0 }));
  console.log('worklets : 6 cas');
}

/* ---------------- 2. la chaine complete dans Chromium ---------------- */

/** Les potards du site (VoyValues) qui touchent la chaine ; le reste du store n'y entre pas. */
const BASE = { chorus: 0, delay: 0, reverb: 0, tape: 0, dlyTime: 0.25, monoLow: 0, volume: 0.8 };
const KEYS = ['chorus', 'delay', 'reverb', 'tape', 'dlyTime', 'monoLow', 'volume'];

const CASES = [
  { name: 'c_dry', seconds: 2, seed: 31, p: {} },
  { name: 'c_bassmono', seconds: 2, seed: 32, p: { monoLow: 0.5 } },
  { name: 'c_chorusI', seconds: 2.5, seed: 33, p: { chorus: 0.5 } },
  { name: 'c_chorusII', seconds: 2.5, seed: 34, p: { chorus: 1 } },
  { name: 'c_delay', seconds: 4, seed: 35, p: { delay: 0.7 } },
  { name: 'c_tape', seconds: 4, seed: 36, p: { delay: 0.7, tape: 0.6, dlyTime: 0.5 } },
  { name: 'c_reverb', seconds: 4, seed: 37, p: { reverb: 0.7 } },
  { name: 'c_all', seconds: 4, seed: 38, bpm: 128, p: { chorus: 0.5, delay: 0.4, tape: 0.3, reverb: 0.4, monoLow: 0.3, volume: 0.75 } },
  // les changements un par un (pour situer un ecart)
  { name: 'c_ev_vol', seconds: 3, seed: 40, p: { delay: 0.5 }, ev: [[Q * 300, { volume: 0.5 }]] },
  { name: 'c_ev_chorus', seconds: 3, seed: 41, p: { chorus: 0.5 }, ev: [[Q * 150, { chorus: 0 }], [Q * 300, { chorus: 0.5 }], [Q * 400, { chorus: 1 }]] },
  { name: 'c_ev_chdelay', seconds: 3, seed: 42, p: { chorus: 0, delay: 0.3 }, ev: [[Q * 300, { chorus: 0.5 }]] },
  {
    name: 'c_changes',
    seconds: 6,
    seed: 39,
    p: { chorus: 0.5, delay: 0.3, reverb: 0.3, volume: 0.7 },
    // [frame (multiple de 128), reglages, bpm]
    ev: [
      [Q * 188, { chorus: 1 }],
      [Q * 375, { chorus: 0 }],
      [Q * 563, { chorus: 0.5, volume: 0.9 }],
      [Q * 750, { chorus: 0 }],
      [Q * 760, { chorus: 1 }],
      [Q * 900, { dlyTime: 0.75, monoLow: 0.6 }],
      [Q * 1100, {}, 100],
      [Q * 1300, { tape: 0.5, reverb: 0.6 }],
      [Q * 1500, { delay: 0.8, monoLow: 0 }],
      [Q * 1700, { tape: 0, dlyTime: 0 }],
      [Q * 1710, { volume: 0.5 }],
      [Q * 1900, { reverb: 0, delay: 0 }],
    ],
  },
];

async function chain() {
  const require = createRequire(import.meta.url);
  const { chromium } = require('playwright');
  const types = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.html': 'text/html' };
  const srv = createServer((q, r) => {
    const f = q.url === '/' ? '/index.html' : q.url.split('?')[0];
    if (f === '/index.html') {
      r.setHeader('content-type', 'text/html');
      r.end('<!doctype html><title>fx-ref</title>');
      return;
    }
    try {
      const b = readFileSync(join(mods, f.replace(/^\//, '')));
      r.setHeader('content-type', types[f.slice(f.lastIndexOf('.'))] ?? 'application/octet-stream');
      r.end(b);
    } catch {
      r.statusCode = 404;
      r.end();
    }
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const browser = await chromium.launch({ args: ['--mute-audio'] });
  try {
    const page = await browser.newPage();
    page.on('console', (m) => console.log('[page]', m.text()));
    page.on('pageerror', (e) => console.log('[page error]', e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/`);
    for (let run = 1; run <= RUNS; run += 1)
    for (const c of CASES) {
      const n = Math.round((c.seconds * SR) / Q) * Q;
      const { L, R } = signal(n, c.seed, 'mix');
      const bpm = c.bpm ?? 120;
      const p0 = { ...BASE, ...c.p };
      const ev = c.ev ?? [];
      const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
      const res = await page.evaluate(
        async ({ inL, inR, n, sr, p0, bpm, ev }) => {
          const dec = (s) => {
            const b = atob(s);
            const u = new Uint8Array(b.length);
            for (let i = 0; i < b.length; i += 1) u[i] = b.charCodeAt(i);
            return new Float32Array(u.buffer);
          };
          const m = await import('/chain.mjs');
          const { buildReverbBus } = await import('/sends.mjs');
          const oc = new OfflineAudioContext(2, n, sr);
          await oc.audioWorklet.addModule('/chorus.worklet.js');
          await m.loadChorus(oc);
          const buf = oc.createBuffer(2, n, sr);
          buf.getChannelData(0).set(dec(inL));
          buf.getChannelData(1).set(dec(inR));
          const src = oc.createBufferSource();
          src.buffer = buf;
          const out = oc.createGain();
          out.connect(oc.destination);
          const reverb = buildReverbBus(oc, out);
          let P = { ...p0 };
          m.voyParams.cur = P;
          const g = m.build(oc, out, reverb, src, bpm);
          m.applyFx(g, P, true);
          src.start(0);
          const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
          for (const [frame, pp, nb] of ev) {
            oc.suspend(frame / sr).then(async () => {
              P = { ...P, ...pp };
              m.voyParams.cur = P;
              if (nb) {
                // pattern.subscribe : le tempo seul (le delai glisse, rien d'autre)
                g.bpm = nb;
                const t = m.delayS(P, g.bpm);
                if (t !== g.delayAt) m.retimeAll(g, t);
              } else m.applyFx(g, P);
              // les messages et les noeuds neufs du worklet arrivent avant la reprise ; un CHORUS OFF : moins de 60 ms
              // (sinon la minuterie de l'insert, en temps reel, demonte la branche ici meme, avant son fondu)
              await wait(pp.chorus === 0 ? 20 : 120);
              oc.resume();
            });
            if (pp.chorus === 0) {
              // la branche du CHORUS part 60 ms (setTimeout) apres OFF : le rendu attend la, sans rien changer
              const f2 = frame + Math.ceil((0.064 * sr) / 128) * 128;
              if (!ev.some((e) => e[0] > frame && e[0] <= f2))
                oc.suspend(f2 / sr).then(async () => {
                  await wait(150);
                  oc.resume();
                });
            }
          }
          const o = await oc.startRendering();
          const f = new Float32Array(2 * n);
          f.set(o.getChannelData(0), 0);
          f.set(o.getChannelData(1), n);
          const u8 = new Uint8Array(f.buffer);
          let s = '';
          for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
          return btoa(s);
        },
        { inL: b64(L), inR: b64(R), n, sr: SR, p0, bpm, ev }
      );
      const bb = Buffer.from(res, 'base64');
      const f = new Float32Array(bb.buffer, bb.byteOffset, bb.length / 4);
      const evArr = [];
      for (const [frame, pp, nb] of ev) {
        evArr.push(frame, nb ?? 0);
        const P = { ...p0 };
        for (const e of ev) {
          if (e[0] > frame) break;
          Object.assign(P, e[1]);
        }
        for (const k of KEYS) evArr.push(P[k]);
      }
      writeCase(RUNS > 1 ? `${c.name}.r${run}` : c.name, { kind: [2], init: [bpm, ...KEYS.map((k) => p0[k])], ev: evArr, inL: L, inR: R, outL: f.slice(0, n), outR: f.slice(n) });
      console.log(`chaine : ${c.name}${RUNS > 1 ? ` (rendu ${run})` : ''}`);
    }
  } finally {
    await browser.close();
    srv.close();
  }
}

if (doWorklet) await worklets();
if (doChain) await chain();
