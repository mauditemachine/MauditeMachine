// Dumps the real knob -> engine mapping of the site (this repo, read-only) to scripts/output/arp-quality/measure/params.json:
// default knobs, their engine params, and every factory ARP preset (knobs + engine params).
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const OUTD = path.join(ROOT, 'scripts/output/arp-quality/measure');
const { createServer } = await import(path.join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({
  root: ROOT,
  configFile: path.join(ROOT, 'vite.config.ts'),
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const P = await server.ssrLoadModule('/src/v4/voyager/params.ts');
  const F = await server.ssrLoadModule('/src/v4/state/factory.ts');
  const knobs = Object.fromEntries(P.VOY_KNOBS.map((k) => [k.id, k.def]));
  const meta = P.VOY_KNOBS.map((k) => ({ id: k.id, label: k.label, section: k.section, def: k.def, steps: k.steps ?? null, legacy: k.legacy ?? null }));
  const presets = F.arpFactory(16).map((f) => ({ name: f.name, knobs: f.data.knobs, engine: P.engineParams(f.data.knobs) }));
  // A few mapping curves (label -> engine), for the report
  const curve = (fn) => [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map((v) => [v, fn(v)]);
  const maps = {
    attackS: curve(P.attackS),
    decayS: curve(P.decayS),
    releaseS: curve(P.releaseS),
    cutoffHz: curve(P.cutoffHz),
    envOctaves: curve(P.envOctaves),
    glideS: curve(P.glideS),
    stackCents: curve(P.stackCents),
  };
  const out = { knobs, engine: P.engineParams(knobs), meta, presets, maps };
  await (await import('node:fs/promises')).mkdir(OUTD, { recursive: true });
  await writeFile(path.join(OUTD, 'params.json'), JSON.stringify(out, null, 1));
  console.log('default engine params:', JSON.stringify(out.engine));
  for (const p of presets) console.log(p.name.padEnd(12), JSON.stringify({ w1: +p.engine.wave1.toFixed(2), w2: +p.engine.wave2.toFixed(2), cut: Math.round(p.engine.cutoff), res: p.engine.res, env: +p.engine.envOct.toFixed(2), drive: p.engine.drive, fmode: p.engine.fmode, sync: p.engine.sync, fm: p.engine.fm, stack: +p.engine.stack.toFixed(1), glue: p.engine.glue, kt: p.engine.keyTrack, aA: +p.engine.aA.toFixed(4), aD: +p.engine.aD.toFixed(3), aS: p.engine.aS, aR: +p.engine.aR.toFixed(3), fD: +p.engine.fD.toFixed(3) }));
} finally {
  await server.close();
}
