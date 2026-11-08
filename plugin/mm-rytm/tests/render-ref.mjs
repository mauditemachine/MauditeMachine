// Rendu de reference : fait tourner le vrai src/v4/audio/shotsdsp.ts (celui du site) sur tests/cases.json
// et ecrit chaque coup en float32 brut (L puis R) dans <out>/<n>.f32, plus <out>/manifest.json.
// Usage : node tests/render-ref.mjs <dossier-de-sortie>
// Les sources TS sont copiees dans le dossier de sortie (imports suffixes .ts) puis lancees avec
// --experimental-strip-types : aucune dependance npm.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const out = resolve(process.argv[2] ?? join(here, '.ref'));
const src = join(out, 'src');
mkdirSync(src, { recursive: true });

for (const f of ['shotsdsp', 'sampledsp', 'stretch']) {
  let code = readFileSync(join(repo, 'src/v4/audio', `${f}.ts`), 'utf8');
  code = code.replace(/from '\.\/(shotsdsp|sampledsp|stretch)'/g, "from './$1.ts'");
  writeFileSync(join(src, `${f}.ts`), code);
}

const runner = `
import { readFileSync, writeFileSync } from 'node:fs';
import { renderLayers } from './shotsdsp.ts';
const [casesPath, samplesDir, outDir] = process.argv.slice(2);
const { sr, cases } = JSON.parse(readFileSync(casesPath, 'utf8'));
function wav(path) {
  const b = readFileSync(path);
  let pos = 12, ch = 1, rate = 44100, bits = 16, data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4), len = b.readUInt32LE(pos + 4);
    if (id === 'fmt ') { ch = b.readUInt16LE(pos + 10); rate = b.readUInt32LE(pos + 12); bits = b.readUInt16LE(pos + 22); }
    if (id === 'data') data = b.subarray(pos + 8, pos + 8 + len);
    pos += 8 + len + (len & 1);
  }
  if (bits !== 16) throw new Error('16 bits seulement : ' + path);
  const n = Math.floor(data.length / (2 * ch));
  const L = new Float32Array(n), R = ch > 1 ? new Float32Array(n) : null;
  for (let i = 0; i < n; i += 1) {
    L[i] = data.readInt16LE((i * ch) * 2) / 32768;
    if (R) R[i] = data.readInt16LE((i * ch + 1) * 2) / 32768;
  }
  return { L, R, sr: rate };
}
const manifest = [];
const flat = [];
cases.forEach((c, n) => {
  const tw = { model: c.model, tune: 0.5, attack: 0.5, decay: 0.45, drive: 0.25, snappy: 0.5, ...(c.tw ?? {}) };
  let pcm;
  if (c.sample) { tw.sample = c.sample; if (c.smp) tw.smp = c.smp; pcm = wav(samplesDir + '/' + c.sample); }
  const s = renderLayers(c.id, sr, c.stretch ?? 1, c.variant, tw, pcm);
  const mono = s.L === s.R;
  const buf = new Float32Array(s.L.length * (mono ? 1 : 2));
  buf.set(s.L, 0);
  if (!mono) buf.set(s.R, s.L.length);
  writeFileSync(outDir + '/' + n + '.f32', Buffer.from(buf.buffer));
  manifest.push({ n, len: s.L.length, mono });
  const smp = { lev: 1, st: 0, start: 0, len: 1, rev: false, ...(c.smp ?? {}) };
  flat.push([n, c.id, c.model, c.variant, c.stretch ?? 1, tw.tune, tw.attack, tw.decay, tw.drive, tw.snappy, tw.gate ? 1 : 0,
    tw.sweep ?? 0.5, tw.sdTune ?? 0.5, tw.sdDecay ?? 0.5, tw.sdTone ?? 0.5, tw.syn ?? 1, smp.lev, smp.st, smp.start, smp.len, smp.rev ? 1 : 0,
    c.sample ?? '-', s.L.length, mono ? 1 : 0].join('\\t'));
});
writeFileSync(outDir + '/cases.tsv', flat.join('\\n') + '\\n');
writeFileSync(outDir + '/manifest.json', JSON.stringify(manifest));
console.log('reference : ' + manifest.length + ' coups');
`;
writeFileSync(join(src, 'runner.ts'), runner);

execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', join(src, 'runner.ts'), join(here, 'cases.json'), join(repo, 'public/samples/rytm'), out], {
  stdio: 'inherit',
});
