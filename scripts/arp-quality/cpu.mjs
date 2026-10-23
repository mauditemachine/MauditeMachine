#!/usr/bin/env node
/**
 * Le calcul du MM-ARP, deux moteurs l'un contre l'autre (2026-10-23) : chaque cas rendu tour a tour par le moteur du
 * depot et par --against (les tours alternes effacent les variations de la machine), le meilleur temps mur par bloc
 * de 128 de chacun, et le rapport. Les notes tenues (comme arp-bench --cpu), le JIT chaud.
 *
 *   node scripts/arp-quality/cpu.mjs --against <moog.worklet.js d'avant> [--phone] [--voices 8] [--cases plain,GLUE]
 *   --set '{"load":0.25}'  des reglages du moteur en plus pour tous les cas
 */
import path from 'node:path';
import { WORKLET, flag, held, opt, patches, render } from './lib.mjs';

const PHONE = flag('--phone');
const OS = PHONE ? 2 : 4;
const AGAINST = opt('--against', '');
const ROUNDS = Number(opt('--rounds', 5));
const NV = opt('--voices', '').split(',').filter(Boolean).map(Number);
const extra = JSON.parse(opt('--set', '{}'));
const ctx = await patches();
const D = ctx.knobs;
const P = ctx.M.params;
const CASES = {
  plain: {},
  GLUE0: { glue: 0 },
  STACK: { stack: 0.5 },
  WIDE: { wide: 0.6 },
  'STACK+WIDE+GLUE': { stack: 0.5, wide: 0.6, glue: 1 },
  OD: { dist: 0.5 },
  'SYNC+FM': { sync: 1, fm: 0.5, semi2: 1 },
  RES95HI: { res: 0.95, cutoff: 0.95, envAmt: 0 },
};
const only = opt('--cases', '').split(',').filter(Boolean);
const list = Object.entries(CASES).filter(([n]) => !only.length || only.includes(n));
const voices = NV.length ? NV : PHONE ? [1, 8] : [1, 12];
const time = (file, knobs, nv) => {
  const params = { ...P.engineParams({ ...D, ...knobs }), bpm: 130, aS: 1, outLevel: 0.3, ...extra };
  const notes = Array.from({ length: nv }, (_, i) => held(54 + i * 3, 100, 0));
  const r = render({ file, params, notes, os: OS, phone: PHONE, seed: 808, seconds: 1.5, timing: true });
  const b = [...r.blockUs.slice(100)].sort((x, y) => x - y);
  return b[Math.floor(b.length / 2)];
};
console.log(`x${OS}, temps mur median par bloc (us), le meilleur de ${ROUNDS} tours alternes ; le temps reel : 2667 us`);
for (const [name, k] of list) {
  for (const nv of voices) {
    let a = Infinity;
    let b = Infinity;
    time(WORKLET, k, nv);
    if (AGAINST) time(path.resolve(AGAINST), k, nv);
    for (let i = 0; i < ROUNDS; i += 1) {
      a = Math.min(a, time(WORKLET, k, nv));
      if (AGAINST) b = Math.min(b, time(path.resolve(AGAINST), k, nv));
    }
    const pct = (x) => `${((100 * x) / 2667).toFixed(1)} %`;
    console.log(`  ${name.padEnd(16)} ${String(nv).padStart(2)}v  ${a.toFixed(0).padStart(5)} us (${pct(a)})${AGAINST ? `   avant ${b.toFixed(0).padStart(5)} us (${pct(b)})   rapport ${(a / b).toFixed(3)}` : ''}`);
  }
}
