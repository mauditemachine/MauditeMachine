// Un son du site rendu en fichier pour la banque du plugin (2026-11-16, Mika : "j'aime bien ce kick la ! rajouter ca dans
// les parametres du vst, je l'ai fait avec Rytm light du site web").
//
//   node plugin/mm-rytm/tools/site-sound.mjs            tous les sons de la table
//   node plugin/mm-rytm/tools/site-sound.mjs "808 SUB BOOM"
//
// Crete : celle du fichier (jamais au-dessus de 0.9, rien ne sature).
// Le rendu passe par le DSP du site lui-meme (src/v4/audio/shotsdsp.ts renderLayers, synthSamples.ts), bundle a la volee
// par esbuild : le fichier est le son du site, a l'echantillon pres. L'enveloppe AMP du site (DEC) y est cuite en partie :
// le plugin multiplie encore par son DEC de depart (124), le fichier porte la difference, pour qu'a DEC 124 le plugin rende
// exactement le DEC choisi sur le site. Crete 0.9 (le niveau des kicks de la banque), fin sous -80 dB plus 20 ms de fondu.
// Sortie : plugin/mm-rytm/samples/<famille>/<Prefixe> <Nom>.wav (le prefixe dit la piste, SampleBank.cpp).
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const OUT = resolve(HERE, '../samples');
const SR = 48000;

/**
 * Les sons du site rendus pour le plugin. tw : la voix telle que le site la joue (le preset de son de
 * scene/screen/menus/preset.ts, le reste a son depart) ; dec : le DEC AMP choisi sur le site (0..127), hold 0.
 */
const SOUNDS = {
  // 808 SUB BOOM (preset.ts : syn 0.75, slev 0.85, kdecay 0.68, kdrive 0.25, kattack 0.45), ENV ATK 0, HOLD 0, DEC 85
  '808 SUB BOOM': {
    fam: 'bd',
    voice: 'BD',
    file: 'Bd 808 Sub Boom.wav',
    sample: 'bd/91-808-Sub-Boom.wav',
    tw: { model: '808', tune: 0.5, attack: 0.45, decay: 0.68, drive: 0.25, snappy: 0.5, syn: 0.75, smp: { lev: 0.85, st: 0, start: 0, len: 1, rev: false } },
    dec: 85,
  },
  // 909 PUNCH KICK (preset.ts : syn 0.65, slev 0.85, kdecay 0.48, kdrive 0.35, kattack 0.65), le DEC de depart du site (127)
  '909 PUNCH KICK': {
    fam: 'bd',
    voice: 'BD',
    file: 'Bd 909 Punch.wav',
    sample: 'bd/90-909-Punch.wav',
    tw: { model: '909', tune: 0.5, attack: 0.65, decay: 0.48, drive: 0.35, snappy: 0.5, syn: 0.65, smp: { lev: 0.85, st: 0, start: 0, len: 1, rev: false } },
    dec: 127,
  },
  // WAREHOUSE RUMBLE (preset.ts : syn 0.5, slev 0.95, kdecay 0.55, kdrive 0.45 ; son envoi REVERB 0.22 reste un envoi :
  // dans le plugin, REVERB de la piste a 28), le DEC de depart du site (127)
  'WAREHOUSE RUMBLE': {
    fam: 'bd',
    voice: 'BD',
    file: 'Bd Warehouse Rumble.wav',
    sample: 'bd/92-Warehouse-Rumble.wav',
    tw: { model: '909', tune: 0.5, attack: 0.5, decay: 0.55, drive: 0.45, snappy: 0.5, syn: 0.5, smp: { lev: 0.95, st: 0, start: 0, len: 1, rev: false } },
    dec: 127,
  },
};

/** Le DEC AMP du site et du plugin (audio/voicelaw.ts decayTau) : null = tenu. */
const decayTau = (v) => (v >= 0.995 ? null : 0.012 * Math.pow(60, Math.max(0, v)));
const HOLD_S = 0.004;
/** Le DEC de depart du plugin (124/127, arrondi comme la face). */
const PLUGIN_DEC = Math.round((124 / 127) * 1000) / 1000;

async function siteDsp() {
  const r = await build({
    stdin: {
      contents: "export { renderLayers } from './src/v4/audio/shotsdsp.ts';\nexport { renderSynthSample } from './src/v4/audio/synthSamples.ts';\n",
      resolveDir: REPO,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'error',
  });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
}

function wav16(L, R, n, gain) {
  const ch = R ? 2 : 1;
  const buf = Buffer.alloc(44 + n * ch * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * ch * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * ch * 2, 28);
  buf.writeUInt16LE(ch * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * ch * 2, 40);
  for (let i = 0; i < n; i += 1)
    for (let c = 0; c < ch; c += 1) {
      const v = Math.max(-1, Math.min(1, (c ? R[i] : L[i]) * gain));
      buf.writeInt16LE(Math.round(v * 32767), 44 + (i * ch + c) * 2);
    }
  return buf;
}

function render(dsp, name, s) {
  const pcm = dsp.renderSynthSample(s.sample, SR);
  const out = dsp.renderLayers(s.voice, SR, 1, 0, { ...s.tw, sample: s.sample }, pcm);
  const n = out.L.length;
  const mono = out.L === out.R;
  const tauSite = decayTau(s.dec / 127);
  const tauPlug = decayTau(PLUGIN_DEC);
  // DEC 127 sur le site (tenu, tauSite null) : le fichier remonte la queue d'autant que le DEC 124 du plugin la baisse
  // (tauBake negatif) ; au DEC 124 on entend le site, au DEC 127 du plugin la queue traine plus que sur le site
  const tauBake = 1 / (1 / (tauSite ?? Infinity) - 1 / tauPlug);
  const L = new Float32Array(n);
  const R = mono ? null : new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const e = t < HOLD_S ? 1 : Math.exp(-(t - HOLD_S) / tauBake);
    L[i] = out.L[i] * e;
    if (R) R[i] = out.R[i] * e;
    peak = Math.max(peak, Math.abs(L[i]), R ? Math.abs(R[i]) : 0);
  }
  let end = n;
  for (let i = n - 1; i > 0; i -= 1)
    if (Math.max(Math.abs(L[i]), R ? Math.abs(R[i]) : 0) > 1e-4) {
      end = Math.min(n, i + Math.round(0.02 * SR));
      break;
    }
  const fade = Math.round(0.02 * SR);
  for (let i = 0; i < fade; i += 1) {
    const k = end - fade + i;
    if (k < 0) continue;
    const g = 0.5 * (1 + Math.cos((Math.PI * (i + 1)) / fade));
    L[k] *= g;
    if (R) R[k] *= g;
  }
  const dst = resolve(OUT, s.fam, s.file);
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, wav16(L, R, end, 0.9 / peak));
  console.log(`${name} -> ${dst.slice(REPO.length + 1)} (${Math.round((end / SR) * 1000)} ms, ${mono ? 'mono' : 'stereo'}, DEC site ${s.dec} = plugin 124)`);
}

const want = process.argv.slice(2);
const names = want.length ? want : Object.keys(SOUNDS);
const dsp = await siteDsp();
for (const name of names) {
  const s = SOUNDS[name];
  if (!s) {
    console.error(`Son inconnu : ${name} (connus : ${Object.keys(SOUNDS).join(', ')})`);
    process.exit(1);
  }
  render(dsp, name, s);
}
