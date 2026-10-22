#!/usr/bin/env node
/**
 * La liste des parametres du MM-ARP en JSON (2026-10-22, l'etude VST3 : "une
 * seule source pour les parametres", le futur plugin JUCE genere son Params.h
 * depuis ce fichier). Lue dans le vrai code (voyager/params.ts VOY_KNOBS et ses
 * conversions engineParams, state/factory.ts les presets d'usine,
 * voyager/chords.ts les accords), par Vite, sans navigateur :
 *
 *   node scripts/arp-params.mjs                  ecrit scripts/output/arp-params.json (hors git)
 *   node scripts/arp-params.mjs --out <fichier>
 *
 * Pour chaque parametre : son id (celui des reglages gardes, des presets et du
 * MIDI : voy:knob:<id>), ses noms, sa section, sa valeur de depart et
 * d'heritage (celle d'un son garde avant lui), ses crans, son texte a l'ecran
 * en quelques points, et ce qu'il donne au moteur (audio/moog.worklet.js) :
 * les reglages du moteur qu'il fait bouger, releves en 11 points de sa course
 * (les autres a leur valeur de depart). Toutes les valeurs sont normalisees de
 * 0 a 1, comme les parametres VST3. Suivent les presets d'usine (memes ids
 * que le site : factory-arp-<n>), les accords et le format des reglages
 * gardes dans le navigateur.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out');
const OUT = outArg >= 0 && argv[outArg + 1] ? path.resolve(argv[outArg + 1]) : path.join(ROOT, 'scripts/output/arp-params.json');

async function siteModules() {
  const { createServer } = await import('vite');
  const server = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.ts'),
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    return {
      P: await server.ssrLoadModule('/src/v4/voyager/params.ts'),
      F: await server.ssrLoadModule('/src/v4/state/factory.ts'),
      C: await server.ssrLoadModule('/src/v4/voyager/chords.ts'),
    };
  } finally {
    await server.close();
  }
}

const round = (x) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x);
/**
 * Ou va un parametre que le moteur ne recoit pas : l'arpegiateur (voyager/arp.ts, seq.ts, chords.ts), la chaine
 * d'effets (audio/synth.ts : CHORUS, DELAY et sa bande, REVERB, VOLUME, BASS MONO), le sidechain (audio/duck.ts).
 * DRIFT va aux deux : au moteur, et a la force des notes de l'arpege.
 */
const ROLE = { rate: 'arp', mode: 'arp', range: 'arp', notes: 'arp', gate: 'arp', octave: 'arp', accent: 'arp', chord: 'arp', chorus: 'fx', delay: 'fx', reverb: 'fx', volume: 'fx', monoLow: 'fx', dlyTime: 'fx', tape: 'fx', duck: 'sidechain' };

async function main() {
  const { P, F, C } = await siteModules();
  const defaults = Object.fromEntries(P.VOY_KNOBS.map((k) => [k.id, k.def]));
  const base = P.engineParams(defaults);
  const points = Array.from({ length: 11 }, (_, i) => i / 10);
  const params = P.VOY_KNOBS.map((k, index) => {
    // Ce que le potard fait bouger dans le moteur, de 0 a 1 (les autres a leur valeur de depart)
    const rows = points.map((v) => P.engineParams({ ...defaults, [k.id]: v }));
    const keys = Object.keys(base).filter((key) => rows.some((r) => r[key] !== rows[0][key]));
    return {
      index,
      id: k.id,
      midiTarget: `voy:knob:${k.id}`,
      label: k.label,
      face: k.face ?? k.label,
      aria: k.aria,
      section: k.section,
      role: ROLE[k.id] ?? 'engine',
      kind: k.morph ? 'morph' : k.steps ? 'stepped' : 'continuous',
      def: k.def,
      legacy: k.legacy ?? k.def,
      steps: k.steps ? [...k.steps] : null,
      stepValues: k.steps && !k.morph ? k.steps.map((_, i) => round(i / (k.steps.length - 1))) : null,
      text: Object.fromEntries([0, 0.25, 0.5, 0.75, 1].map((v) => [String(v), P.voyValueText(k.id, v)])),
      engine: keys.length ? { keys, at: points.map((v, i) => ({ v, ...Object.fromEntries(keys.map((key) => [key, round(rows[i][key])])) })) } : null,
    };
  });
  const factory = F.arpFactory(16).map((p, i) => ({ id: `factory-arp-${i}`, name: p.name, knobs: Object.fromEntries(Object.entries(p.data.knobs).map(([k, v]) => [k, round(v)])), prog: p.data.prog }));
  const json = {
    format: 'mm-arp-params',
    version: 1,
    generated: new Date().toISOString(),
    source: { params: 'src/v4/voyager/params.ts', engine: 'src/v4/audio/moog.worklet.js', factory: 'src/v4/state/factory.ts', chords: 'src/v4/voyager/chords.ts' },
    note: 'Every value is normalised 0..1. stepped: the value of step i is i / (steps - 1). legacy: the value a saved sound gets when it has no such key (the sound from before this parameter). engine: what the worklet receives (engineParams), sampled at 11 points, the other knobs at def.',
    storage: { key: P.VOY_STORAGE_KEY, format: '{ v: 1, knobs: { <id>: 0..1 } }', preset: '{ knobs, seq: { edit, buf, len, has }, prog: chord indices }' },
    count: params.length,
    params,
    engineDefaults: Object.fromEntries(Object.entries(base).map(([k, v]) => [k, round(v)])),
    factory,
    chords: C.CHORDS.map((c, i) => ({ index: i, label: c.label, aria: c.aria, root: c.root, tones: [...c.tones] })),
  };
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(json, null, 1)}\n`);
  console.log(`${params.length} parametres, ${factory.length} presets d'usine -> ${path.relative(ROOT, OUT) || OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
