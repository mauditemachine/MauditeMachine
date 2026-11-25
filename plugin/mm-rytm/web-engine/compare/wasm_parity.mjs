// Le banc wasm de la parite (wasm_parity.cpp) : la meme fonction, dans le module WebAssembly, avec les memes samples
// (la banque, fichier par fichier) et les memes cles que le natif ; puis les deux sorties comparees echantillon par
// echantillon. Nos imports seulement (ceux de l'AudioWorklet) : rien d'autre que du calcul.
//
//   R=plugin/mm-rytm; S=$R/web-engine
//   clang++ --target=wasm32-wasi -O3 -std=c++17 -ffp-contract=off -fno-exceptions -fno-rtti -mexec-model=reactor \
//     -include $S/wasm_compat.h -I$R/dsp -I$S -I$R/tests $S/compare/wasm_parity.cpp $S/RytmEngine.cpp $S/wasm_rt.cpp \
//     $R/dsp/Shots.cpp $R/dsp/Engine.cpp $R/dsp/Program.cpp $R/dsp/Fx.cpp -Wl,--export=parity_render -Wl,--export=malloc \
//     -Wl,--export=mmrytm_bank_add -Wl,--initial-memory=134217728 -Wl,--max-memory=1073741824 -Wl,-z,stack-size=1048576 -o parity.wasm
//   c++ -O2 -std=c++17 [-DMMRYTM_NO_FTZ] -I$R/dsp -I$S -I$R/tests $S/compare/wasm_parity.cpp $S/RytmEngine.cpp $R/dsp/*.cpp -o parity_native
//   ./parity_native public/samples/rytm native.raw 8 [face.json ...]
//   node $S/compare/wasm_parity.mjs parity.wasm public/samples/rytm native.raw 8 [face.json ...]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , wasmPath, samplesDir, nativeRaw, seedsArg, ...faces] = process.argv;
const mod = new WebAssembly.Module(readFileSync(wasmPath));
let mem;
const dv = () => new DataView(mem.buffer);
const imports = {};
for (const imp of WebAssembly.Module.imports(mod)) {
  imports[imp.module] ??= {};
  imports[imp.module][imp.name] =
    imp.name === 'fd_write'
      ? (fd, iov, cnt, nw) => {
          let t = 0;
          for (let i = 0; i < cnt; i += 1) t += dv().getUint32(iov + i * 8 + 4, true);
          dv().setUint32(nw, t, true);
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
const put = (bytes) => {
  const p = x.malloc(bytes.length || 1);
  new Uint8Array(mem.buffer, p, bytes.length).set(bytes);
  return p;
};
const enc = new TextEncoder();
const keysText = readFileSync(`${nativeRaw}.keys`);
for (const key of keysText.toString('utf8').split('\n').filter(Boolean)) {
  const file = enc.encode(key.slice(key.indexOf('/') + 1));
  const data = readFileSync(join(samplesDir, key));
  if (!x.mmrytm_bank_add(put(file), file.length, put(data), data.length)) throw new Error(`banque : ${key}`);
}
const kp = put(keysText);
const progs = [...Array(Number(seedsArg)).fill(null), ...faces.map((f) => readFileSync(f))];
const max = 48000 * 3;
const op = x.malloc(max * 2 * 4);
const native = new Float32Array(readFileSync(nativeRaw).buffer.slice(0));
let at = 0;
let total = 0;
let diff = 0;
let maxDiff = 0;
let peak = 0;
let worstRms = -Infinity;
let bestRms = Infinity;
const t0 = Date.now();
progs.forEach((pr, i) => {
  for (const async of [0, 1]) {
    const pp = pr ? put(pr) : 0;
    const n = x.parity_render(i + 1, async, kp, keysText.length, pp, pr ? pr.length : 0, op, max);
    const w = new Float32Array(mem.buffer, op, n * 2);
    let d = 0;
    let md = 0;
    let sig = 0;
    let err = 0;
    for (let k = 0; k < n * 2; k += 1) {
      const a = native[at + k];
      const b = w[k];
      peak = Math.max(peak, Math.abs(b));
      sig += a * a;
      err += (a - b) * (a - b);
      if (!Object.is(a, b)) {
        d += 1;
        md = Math.max(md, Math.abs(a - b));
      }
    }
    // l'ecart RMS sous le signal (dB)
    const rms = err > 0 ? 10 * Math.log10(err / sig) : -Infinity;
    if (err > 0) {
      worstRms = Math.max(worstRms, rms);
      bestRms = Math.min(bestRms, rms);
    }
    at += n * 2;
    total += n * 2;
    diff += d;
    maxDiff = Math.max(maxDiff, md);
    console.log(`${pr ? faces[i - Number(seedsArg)] : `graine ${i + 1}`} ${async ? 'asynchrone' : 'synchrone '} : ${n * 2} ech., ${d} differents, ecart max ${md.toExponential(3)}, RMS ${rms.toFixed(1)} dB`);
  }
});
console.log(`TOTAL wasm / natif : ${total} echantillons, ${diff} differents (${((100 * diff) / total).toFixed(4)} %), ecart max ${maxDiff.toExponential(3)} (${(20 * Math.log10(maxDiff || 1e-30)).toFixed(1)} dBFS), ecart RMS de ${bestRms.toFixed(1)} a ${worstRms.toFixed(1)} dB sous le signal, crete ${peak.toFixed(3)}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
