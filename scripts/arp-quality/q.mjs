#!/usr/bin/env node
/**
 * Le controle qualite du MM-ARP (2026-10-23, Mika : "Pourrais-tu controler ARP pour que le son soit d'extreme bonne
 * qualite ?! entre Monark et un synth analog Moog Voyager et un Korg MS10") : des series de mesures sur le vrai moteur,
 * rendu dans Node, rien n'est joue.
 *
 *   node scripts/arp-quality/q.mjs purity,sync          les series voulues (liste plus bas, "all" : toutes)
 *   node scripts/arp-quality/q.mjs purity --worklet <moog.worklet.js d'une autre version>
 *   node scripts/arp-quality/q.mjs purity --against <moog.worklet.js>   les deux moteurs, cote a cote, et l'ecart
 *   node scripts/arp-quality/q.mjs purity --phone        seulement le chemin du telephone (x2) ; --desktop : x4
 *   --quick : moins de points (balayages plus larges)
 *
 * Les resultats : scripts/output/arp-quality/<serie>.json (hors git). Les seuils de chaque etape sont dans la spec
 * (scratchpad arp-q/design/final-spec.md) et le rapport docs/reports/2026-10-23-arp-qualite.md.
 */
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { OUT, ROOT, WORKLET, engine, flag, held, hzMidi, midiHz, opt, patches, render, writeJson } from './lib.mjs';
import { cents, clickDb, db, db10, harm, harmonicSplit, loudness, peakFreq, r1, r2, spectrum, stats, thirdBands, zcFreq, SR } from './ana.mjs';

const AGAINST = opt('--against', '');
const QUICK = flag('--quick');
const PATHS = flag('--phone') ? [2] : flag('--desktop') ? [4] : [4, 2];
const NOTES3 = [84, 96, 108];

/* ---------------- les series ---------------- */

/** Q1 : purete (la metrique du 2026-10-21) des cas de measure.md section 7, MOOG a la butee, OSC 0.62, DRIFT 0. */
const PURITY_CASES = {
  SINE: { wave1: 0 },
  TRI: { wave1: 1 },
  SAW: { wave1: 2 },
  SQUARE: { wave1: 3 },
  PULSE: { wave1: 4 },
  PWM50: { wave1: 3.5 },
  'SAW>SQR': { wave1: 2.5 },
  FMWAVE: { wave1: 5, tune2: 0 },
  SYNC7: { wave1: 2, osc2: 'L', wave2: 2, tune2: 7, sync: 1 },
  SYNC19: { wave1: 2, osc2: 'L', wave2: 2, tune2: 19, sync: 1 },
  FM06R2: { wave1: 2, fm: 0.6, ratio: 2 },
  FM1R35: { wave1: 0, fm: 1, ratio: 3.5 },
  OD06: { wave1: 2, drive: 0.6 },
  RES08: { wave1: 2, res: 0.8, cutoff: 5000 },
  GLUE1: { wave1: 2, glue: 1 },
  SUBSQR: { wave1: 2, sub: 0.5, subWave: 3, subOct: 1 },
  SUBTRI: { wave1: 2, osc1: 0, sub: 0.5, subWave: 1, subOct: 1 },
};
function purityOne(ctx, file, os, cname, cp, midi, lvl = 0.62, extra = {}) {
  const p = { ...ctx.LAB, fmode: 0, cutoff: 21600, osc1: lvl, ...cp, ...extra };
  if (p.osc2 === 'L') p.osc2 = lvl;
  const r = render({ file, os, params: p, notes: [held(midi)], seconds: 1.6 });
  const f0 = midiHz(midi);
  let bases = [f0];
  if (cname === 'FM1R35' || cname === 'SUBSQR' || cname === 'SUBTRI') bases = [f0 / 2];
  return harmonicSplit(r.L, bases);
}
async function purity(ctx, file) {
  const out = {};
  for (const os of PATHS) {
    for (const [cname, cp] of Object.entries(PURITY_CASES)) {
      for (const midi of NOTES3) out[`${cname} ${midi} x${os}`] = r1(purityOne(ctx, file, os, cname, cp, midi).purity);
    }
  }
  return out;
}

/** P1-a : le filtre aux coupures hautes, RES 0.9 a 1.0, graine NOISE et scie A2 (measure.md 3b). */
async function p1a(ctx, file) {
  const out = {};
  const cuts = QUICK ? [8000, 12000, 16000, 21600] : [8000, 10000, 12000, 14000, 16000, 18000, 21600];
  for (const os of PATHS) {
    for (const res of [0.9, 0.95, 1.0]) {
      for (const cutoff of cuts) {
        // La graine de bruit : la frequence et le niveau de l'oscillation
        const a = render({ file, os, params: { ...ctx.LAB, noise: 0.003, res, cutoff }, notes: [held(54)], seconds: 2.5 });
        const pk = peakFreq(a.L, { start: Math.round(1.0 * SR), n: 65536 });
        out[`noise r${res} f${cutoff} x${os} cents`] = r1(cents(pk.f, Math.min(cutoff, SR * 0.45)));
        out[`noise r${res} f${cutoff} x${os} dBFS`] = r1(db(pk.amp));
        // Une scie A2 a 0.3 : la pire raie non harmonique, la crete
        const b = render({ file, os, params: { ...ctx.LAB, osc1: 0.3, wave1: 2, res, cutoff }, notes: [held(45)], seconds: 1.6 });
        const hs = harmonicSplit(b.L, [110]);
        out[`saw r${res} f${cutoff} x${os} worst dBc`] = r1(hs.worstDbc);
        // Au-dessus du seuil, l'auto-oscillation est une raie voulue : la pire raie hors d'elle (et de ses harmoniques)
        if (res > 0.9) out[`saw r${res} f${cutoff} x${os} worst excl. osc dBc`] = r1(harmonicSplit(b.L, [110, pk.f], { maxh: 40 }).worstDbc);
        out[`saw r${res} f${cutoff} x${os} peak dBFS`] = r1(db(stats(b.L, Math.round(0.2 * SR)).peak));
      }
    }
  }
  return out;
}

/** Auto-oscillation (C8, C9, C10) : hauteur (cents re coupure), niveau du fondamental, H3, MOOG, graine NOISE. */
async function selfosc(ctx, file) {
  const out = {};
  const fm = Number(opt('--fmode', 0));
  const cuts = QUICK ? [250, 1000, 4000, 10000] : [100, 250, 1000, 4000, 8000, 10000, 12000, 16000];
  const resL = QUICK ? [1.0] : [0.92, 0.95, 1.0];
  for (const os of PATHS) {
    for (const res of resL) {
      for (const cutoff of cuts) {
        const secs = cutoff < 300 ? 4 : 2.5;
        const a = render({ file, os, params: { ...ctx.LAB, noise: 0.003, res, cutoff, fmode: fm }, notes: [held(54)], seconds: secs });
        const st = Math.round((secs - 1.2) * SR);
        const N = Math.round(1.1 * SR);
        let f = zcFreq(a.L, st, N);
        const pk = peakFreq(a.L, { start: st, n: 32768 });
        if (!(f > 0) || Math.abs(cents(f, pk.f)) > 30) f = pk.f;
        const h1 = harm(a.L, f, st, N);
        out[`r${res} f${cutoff} x${os} cents`] = r1(cents(f, cutoff));
        out[`r${res} f${cutoff} x${os} dBFS`] = r1(db(h1));
        out[`r${res} f${cutoff} x${os} H3 dBc`] = r1(db(harm(a.L, 3 * f, st, N)) - db(h1));
        out[`r${res} f${cutoff} x${os} H2 dBc`] = r1(db(harm(a.L, 2 * f, st, N)) - db(h1));
      }
    }
  }
  return out;
}

/** Hard SYNC (measure.md 7b) : l'esclave seul, C7, niveau 0.1, HP 20 Hz ; balayages fins autour des rapports justes. */
function syncOne(ctx, file, os, semi, fine, wave2, fine1 = 0) {
  const p = { ...ctx.LAB, fmode: 3, cutoff: 20, osc1: 0, osc2: 0.1, wave1: 2, wave2, tune2: semi, fine1, fine2: fine, sync: 1 };
  const r = render({ file, os, params: p, notes: [held(96)], seconds: 1.6 });
  return harmonicSplit(r.L, [midiHz(96 + fine1 / 100)]).purity;
}
async function sync(ctx, file) {
  const out = {};
  const step = QUICK ? 5 : 1;
  for (const os of PATHS) {
    for (let s = 0; s <= 31; s += 1) out[`saw s${s} x${os}`] = r1(syncOne(ctx, file, os, s, 0, 2));
    for (const s of [0, 12, 19, 24, 31]) {
      const ref = [s - 1, s + 1].filter((x) => x >= 1 && x <= 31).map((x) => out[`saw s${x} x${os}`]);
      const med = ref.length === 1 ? ref[0] : (ref[0] + ref[1]) / 2;
      let min = Infinity;
      let dip = 0;
      for (let f = -25; f <= 25; f += step) {
        const v = syncOne(ctx, file, os, s, f, 2);
        if (v < min) min = v;
        if (med - v > dip) dip = med - v;
      }
      out[`saw s${s} sweep x${os} min`] = r1(min);
      out[`saw s${s} sweep x${os} dip`] = r1(dip);
    }
    for (const w of [3, 4]) for (const s of [7, 12, 16, 19, 24]) out[`${w === 3 ? 'sqr' : 'pulse'} s${s} x${os}`] = r1(syncOne(ctx, file, os, s, 0, w));
    for (const s of [0, 12, 24]) out[`saw s${s} fine8 x${os}`] = r1(syncOne(ctx, file, os, s, 8, 2, -8));
  }
  return out;
}

/** Le triangle (P2-a) : purete C7 / C8, SUB TRI, morphings ; harmoniques 1 a 19 d'un triangle A2 (dB re H1). */
async function tri(ctx, file) {
  const out = {};
  for (const os of PATHS) {
    for (const midi of [96, 108]) {
      out[`TRI ${midi} x${os}`] = r1(purityOne(ctx, file, os, 'TRI', PURITY_CASES.TRI, midi).purity);
      out[`SINE>TRI ${midi} x${os}`] = r1(purityOne(ctx, file, os, 'X', { wave1: 0.5 }, midi).purity);
      out[`TRI>SAW ${midi} x${os}`] = r1(purityOne(ctx, file, os, 'X', { wave1: 1.5 }, midi).purity);
      out[`SUBTRI ${midi} x${os}`] = r1(purityOne(ctx, file, os, 'SUBTRI', PURITY_CASES.SUBTRI, midi).purity);
    }
    const r = render({ file, os, params: { ...ctx.LAB, wave1: 1, osc1: 0.05 }, notes: [held(45)], seconds: 1.5 });
    const st = Math.round(0.3 * SR);
    const N = Math.round(1.0 * SR);
    const h1 = harm(r.L, 110, st, N);
    for (let k = 3; k <= 19; k += 2) out[`A2 H${k} x${os}`] = r2(db(harm(r.L, 110 * k, st, N)) - db(h1));
  }
  return out;
}

/** OVERDRIVE et saturations : H2..H9 d'un sinus 110 Hz (OSC 0.1, 0.62, deux a 0.88) a OVERDRIVE 0, 0.25, 0.5, 1. */
async function timbre(ctx, file) {
  const out = {};
  for (const os of PATHS) {
    for (const [lbl, lp] of [['o0.1', { osc1: 0.1 }], ['o0.62', { osc1: 0.62 }], ['2x0.88', { osc1: 0.88, osc2: 0.88, wave2: 0, tune2: 0 }]]) {
      for (const d of [0, 0.25, 0.5, 1]) {
        const r = render({ file, os, params: { ...ctx.LAB, wave1: 0, ...lp, drive: d }, notes: [held(45)], seconds: 1.2 });
        const st = Math.round(0.3 * SR);
        const N = Math.round(0.8 * SR);
        const h1 = harm(r.L, 110, st, N);
        out[`${lbl} od${d} x${os} H1 dB`] = r2(db(h1));
        for (let k = 2; k <= 9; k += 1) out[`${lbl} od${d} x${os} H${k}`] = r1(db(harm(r.L, 110 * k, st, N)) - db(h1));
      }
    }
  }
  return out;
}

/** La reponse du chemin ouvert (HP a 20 Hz, presque brut) : le gain d'un sinus a 1, 5, 10, 15, 18.8 kHz (dB). */
async function resp(ctx, file) {
  const out = {};
  const extra = JSON.parse(opt('--set', '{}'));
  for (const os of PATHS) {
    for (const f of [1000, 5000, 10000, 15000, 18800]) {
      const r = render({ file, os, params: { ...ctx.LAB, fmode: 3, cutoff: 20, wave1: 0, osc1: 0.02, ...extra }, notes: [held(hzMidi(f))], seconds: 0.6 });
      out[`${f} Hz x${os}`] = r2(db(harm(r.L, f, Math.round(0.25 * SR), Math.round(0.3 * SR))));
    }
  }
  return out;
}

/** Le niveau (valeur efficace, dB) d'un sinus et d'une scie a 0.62 selon OVERDRIVE. */
async function level(ctx, file) {
  const out = {};
  for (const os of PATHS) {
    for (const w of [0, 2]) {
      for (const d of [0, 0.1, 0.25, 0.5, 1]) {
        const r = render({ file, os, params: { ...ctx.LAB, wave1: w, osc1: 0.62, drive: d, cutoff: 4000 }, notes: [held(45)], seconds: 1.0 });
        out[`${w ? 'saw' : 'sine'} od${d} x${os}`] = r2(db(stats(r.L, Math.round(0.3 * SR)).rms));
      }
    }
  }
  return out;
}

/** Q6 : le silence apres les notes (measure t11) : sous-normaux et non finis dans l'etat, la queue jusqu'au zero exact. */
const DBL_MIN = 2.2250738585072014e-308;
function scan(obj, acc, seen = new Set(), depth = 0) {
  if (obj === null || typeof obj !== 'object' || seen.has(obj) || depth > 5) return;
  seen.add(obj);
  if (ArrayBuffer.isView(obj)) {
    const f32 = obj instanceof Float32Array;
    for (let i = 0; i < obj.length; i += 1) {
      const x = obj[i];
      if (typeof x !== 'number') continue;
      if (!Number.isFinite(x)) acc.nonFinite += 1;
      else if (x !== 0 && Math.abs(x) < (f32 ? 1.1754944e-38 : DBL_MIN)) acc.sub += 1;
      else if (x !== 0 && Math.abs(x) < 1e-30) acc.tiny += 1;
    }
    return;
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) {
        if (!(k === 'q1' || k === 'q2' || k === 'rIdx' || k === 'clipT')) acc.nonFinite += 1;
      } else if (v !== 0 && Math.abs(v) < DBL_MIN) {
        acc.sub += 1;
        if (acc.where.length < 8 && !acc.where.includes(k)) acc.where.push(k);
      } else if (v !== 0 && Math.abs(v) < 1e-30) acc.tiny += 1;
    } else if (typeof v === 'object') scan(v, acc, seen, depth + 1);
  }
}
async function silence(ctx, file) {
  const out = {};
  const step = 60 / 130 / 4;
  const bar = () => Array.from({ length: 16 }, (_, k) => ({ midi: 54 + ((k * 7) % 12), time: 0.05 + k * step, gate: 0.5 * step, accent: [1, 0.8, 0.92, 1.12][k % 4], from: null }));
  const list = [
    ...ctx.presets.map((p) => ({ name: p.name, params: { ...p.engine, outLevel: 0.25 } })),
    { name: 'INIT', params: { ...ctx.DEF, outLevel: 0.25 } },
    { name: 'X STACK WIDE GLUE', params: { ...ctx.DEF, stack: 30, wide: 1, glue: 1, outLevel: 0.25 } },
    { name: 'X RES1 LONG REL', params: { ...ctx.DEF, res: 1, aR: 3, fR: 3, outLevel: 0.25 } },
    { name: 'X OD1 SYNC FM', params: { ...ctx.DEF, drive: 1, sync: 1, tune2: 7, fm: 0.6, outLevel: 0.25 } },
    ...(ctx.extraSilence ?? []),
  ];
  let subTot = 0;
  let nfTot = 0;
  let worstTail = 0;
  let worstRatio = 0;
  const where = new Set();
  for (const os of PATHS) {
    for (const pt of list) {
      const acc = { nonFinite: 0, sub: 0, tiny: 0, where: [] };
      let lastNonZero = 0;
      let lastActive = 0;
      const tEnd = 0.05 + 16 * step;
      const r = render({ file, os, params: pt.params, notes: bar(), seconds: tEnd + 6, timing: true, onBlock: (f, proc) => {
        if (f % 1280 === 0 || f / SR > tEnd + 5.9) scan(proc, acc);
        if (proc.voices.some((v) => v.on)) lastActive = f;
      } });
      let outNF = 0;
      for (let i = 0; i < r.L.length; i += 1) {
        if (!Number.isFinite(r.L[i]) || !Number.isFinite(r.R[i])) outNF += 1;
        if (r.L[i] !== 0 || r.R[i] !== 0) lastNonZero = i;
      }
      // Les blocs de la queue (apres la derniere voix, avant le zero) contre les blocs des 100 dernieres ms de son
      const sounding = [];
      const tail = [];
      for (let b = 0; b < r.blockUs.length; b += 1) {
        const f = b * 128;
        if (f > lastActive - 0.1 * SR && f <= lastActive) sounding.push(r.blockUs[b]);
        if (f > lastActive + 128 && f <= lastNonZero) tail.push(r.blockUs[b]);
      }
      const med = (a) => (a.length ? [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)] : 0);
      const ratio = med(sounding) > 0 ? Math.max(...(tail.length ? tail : [0])) / med(sounding) : 0;
      const tz = Math.max(0, (lastNonZero - lastActive) / SR);
      out[`${pt.name} x${os} sub`] = acc.sub;
      out[`${pt.name} x${os} nonFinite`] = acc.nonFinite + outNF;
      out[`${pt.name} x${os} zero after s`] = r2(tz);
      subTot += acc.sub;
      nfTot += acc.nonFinite + outNF;
      for (const w of acc.where) where.add(w);
      if (tz > worstTail) worstTail = tz;
      if (ratio > worstRatio) worstRatio = ratio;
    }
  }
  out['TOTAL subnormal'] = subTot;
  out['TOTAL nonFinite'] = nfTot;
  out['TOTAL subnormal fields'] = [...where].join(' ');
  out['WORST zero after s'] = r2(worstTail);
  out['WORST tail block / sounding median'] = r2(worstRatio);
  return out;
}

/** Q7 : des reglages pourris (NaN, undefined, +/-Infinity, +/-1e9, une chaine) pendant une note RES 0.8, puis corriges. */
async function garbage(ctx, file) {
  const out = {};
  const base = { ...ctx.DEF, res: 0.8, outLevel: 0.3, aS: 1, glue: 0.35 };
  const keys = Object.keys(base).filter((k) => typeof base[k] === 'number' && k !== 'bpm');
  const BAD = [NaN, undefined, Infinity, -Infinity, 1e9, -1e9, 'x'];
  const name = (b) => (b === undefined ? 'undef' : typeof b === 'string' ? 'str' : String(b));
  const os = PATHS[PATHS.length - 1];
  const notes = [held(54, 3), held(61, 3)];
  const ref = render({ file, os, params: base, notes, seconds: 1.0, seed: 7 });
  let worstPk = -Infinity;
  let worstNF = 0;
  let worstRec = 0;
  let worstKey = '';
  let worstRecKey = '';
  for (const k of keys) {
    for (const b of BAD) {
      const r = render({ file, os, params: base, notes, seconds: 1.0, seed: 7, onBlock: (f, proc) => {
        if (f === 128 * 112) proc.onMsg({ type: 'params', params: { [k]: b } });
        if (f === 128 * 225) proc.onMsg({ type: 'params', params: { [k]: base[k] } });
      } });
      let nf = 0;
      let pk = 0;
      for (let i = 128 * 112; i < 128 * 225; i += 1) {
        const v = Math.max(Math.abs(r.L[i]), Math.abs(r.R[i]));
        if (!Number.isFinite(r.L[i]) || !Number.isFinite(r.R[i])) nf += 1;
        else if (v > pk) pk = v;
      }
      // Le retour : le premier instant apres la correction ou l'ecart a la reference reste sous -60 dB re sa crete
      const refPk = stats(ref.L, 128 * 225).peak;
      let rec = 0;
      for (let i = r.L.length - 1; i >= 128 * 225; i -= 1) {
        const d = Math.abs(r.L[i] - ref.L[i]);
        if (!(d <= refPk * 1e-3)) {
          rec = (i - 128 * 225) / SR;
          break;
        }
      }
      if (nf > worstNF) worstNF = nf;
      if (db(pk) > worstPk) {
        worstPk = db(pk);
        worstKey = `${k}=${name(b)}`;
      }
      if (rec > worstRec) {
        worstRec = rec;
        worstRecKey = `${k}=${name(b)}`;
      }
      if (nf > 0 || db(pk) > -3 || rec > 0.003) out[`${k}=${name(b)}`] = `nf ${nf} pk ${r1(db(pk))} dBFS rec ${r1(rec * 1000)} ms`;
    }
  }
  out['WORST peak dBFS during bad'] = `${r1(worstPk)} (${worstKey})`;
  out['WORST nonFinite'] = worstNF;
  out['WORST recovery ms'] = `${r1(worstRec * 1000)} (${worstRecKey})`;
  // Le pire reglage legal : RES 1, OD 1, coupure max, FM 1, SYNC, STACK, WIDE, GLUE 1, 12 voix a C8
  for (const os2 of PATHS) {
    const ext = { ...ctx.DEF, res: 1, drive: 1, cutoff: 21600, fm: 1, sync: 1, stack: 30, wide: 1, glue: 1, outLevel: 0.3, aS: 1, ...(ctx.extremeExtra ?? {}) };
    const r = render({ file, os: os2, params: ext, notes: Array.from({ length: 12 }, (_, i) => held(108 + (i % 4), 1.5, 0.01 * i)), seconds: 2 });
    let nf = 0;
    for (let i = 0; i < r.L.length; i += 1) if (!Number.isFinite(r.L[i]) || !Number.isFinite(r.R[i])) nf += 1;
    out[`EXTREME x${os2} peak dBFS`] = r1(db(Math.max(stats(r.L).peak, stats(r.R).peak)));
    out[`EXTREME x${os2} nonFinite`] = nf;
    out[`EXTREME x${os2} heals`] = r.proc.heals ?? 0;
  }
  return out;
}

/** Q2 : la chaine de decimation (4x -> 2x -> 1x et 2x -> 1x) : ondulation, bord de bande, repliement. */
async function q2(ctx, file) {
  const src = (await import('node:fs')).readFileSync(file, 'utf8');
  const g = {};
  new Function('AudioWorkletProcessor', 'registerProcessor', `${src}\n;__g.halfband = halfband;`.replace('__g', 'this.__g'))
    .call({ __g: g }, class {}, () => {});
  const out = {};
  const resp1 = (h, f, fs) => {
    let re = 0;
    let im = 0;
    for (let k = 0; k < h.length; k += 1) {
      re += h[k] * Math.cos((2 * Math.PI * f * k) / fs);
      im -= h[k] * Math.sin((2 * Math.PI * f * k) / fs);
    }
    return Math.hypot(re, im);
  };
  const h31 = g.halfband(31, 7).h;
  const h63 = g.halfband(63, 8).h;
  for (const os of PATHS) {
    // Le gain total d'une frequence d'entree f (Hz, au rythme interne) et sa frequence de sortie apres les replis
    const total = (f) => {
      if (os === 4) {
        const g1 = resp1(h31, f, 192000);
        const f1 = f % 96000 < 48000 ? f % 96000 : 96000 - (f % 96000);
        const g2 = resp1(h63, f1, 96000);
        const f2 = f1 < 24000 ? f1 : 48000 - f1;
        return { g: g1 * g2, fo: f2 };
      }
      const g2 = resp1(h63, f, 96000);
      const f2 = f % 48000 < 24000 ? f % 48000 : 48000 - (f % 48000);
      return { g: g2, fo: f2 };
    };
    let rip = 0;
    for (let f = 20; f <= 16000; f += 20) rip = Math.max(rip, Math.abs(db(total(f).g)));
    out[`x${os} ripple to 16k dB`] = Number(rip.toFixed(4));
    out[`x${os} at 18k dB`] = Number(db(total(18000).g).toFixed(4));
    out[`x${os} at 20k dB`] = Number(db(total(20000).g).toFixed(4));
    let fold = -Infinity;
    let foldF = 0;
    const top = os === 4 ? 96000 : 48000;
    for (let f = 24000; f <= top; f += 25) {
      const t = total(f);
      if (t.fo <= 20000 && db(t.g) > fold) {
        fold = db(t.g);
        foldF = f;
      }
    }
    out[`x${os} worst fold into 0-20k dB`] = r1(fold);
    out[`x${os} worst fold at Hz`] = foldF;
  }
  return out;
}

/** Q10 : le haut "numerique" : energie 10-20 kHz re 1-5 kHz d'une scie A3 et A4, MOOG potard au maximum, RES 0. */
function pdSawBands(f0) {
  const M = 1 << 14;
  const P = 0.9924 - 0.00002151 * Math.min(f0, 4000);
  const x = new Float64Array(M);
  for (let i = 0; i < M; i += 1) {
    const t = i / M;
    const pm = (Math.PI - 2 * Math.PI * P) * (t < P ? t / P : (1 - t) / (1 - P));
    x[i] = -Math.cos(2 * Math.PI * t + pm);
  }
  let lo = 0;
  let hi = 0;
  let loI = 0;
  let hiI = 0;
  for (let h = 1; h * f0 < 20000; h += 1) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < M; i += 1) {
      re += x[i] * Math.cos((2 * Math.PI * h * i) / M);
      im += x[i] * Math.sin((2 * Math.PI * h * i) / M);
    }
    const a2 = (2 * Math.hypot(re, im)) / M;
    const f = h * f0;
    if (f >= 1000 && f <= 5000) {
      lo += a2 * a2;
      loI += 1 / (h * h);
    }
    if (f >= 10000) {
      hi += a2 * a2;
      hiI += 1 / (h * h);
    }
  }
  return { pd: db10(hi / lo), ideal: db10(hiI / loI) };
}
async function q10(ctx, file) {
  const out = {};
  const cutMax = ctx.M.params.cutoffHz(1);
  for (const os of PATHS) {
    for (const midi of [57, 69]) {
      const r = render({ file, os, params: { ...ctx.LAB, wave1: 2, osc1: 0.3, cutoff: cutMax }, notes: [held(midi)], seconds: 1.6 });
      const S = spectrum(r.L, 65536, Math.round(0.2 * SR));
      let lo = 0;
      let hi = 0;
      let top = 0;
      for (let i = 0; i < S.pow.length; i += 1) {
        if (S.f[i] >= 1000 && S.f[i] <= 5000) lo += S.pow[i];
        if (S.f[i] >= 10000 && S.f[i] <= 20000) hi += S.pow[i];
        if (S.f[i] > 20000 && S.amp[i] > top) top = S.amp[i];
      }
      const ref = pdSawBands(midiHz(midi));
      out[`saw ${midi} x${os} 10-20k re 1-5k dB`] = r1(db10(hi / lo));
      out[`saw ${midi} x${os} Voyager PD ref dB`] = r1(ref.pd);
      out[`saw ${midi} x${os} ideal saw dB`] = r1(ref.ideal);
      out[`saw ${midi} x${os} pass (<= PD + 1)`] = db10(hi / lo) <= ref.pd + 1 ? 'oui' : 'non';
      out[`saw ${midi} x${os} above 20k dBFS`] = r1(db(top));
    }
  }
  return out;
}

/** C3 et C5 : la coupure (le point a -12 dB, MOOG, RES 0) et la bosse de resonance (RES 0.5 / 0.7 / 0.8), petit signal. */
function probeGains(ctx, file, os, base, freqs) {
  // Une sinusoide par voix (12 au plus, a un tiers d'octave l'une de l'autre au moins : la projection les separe), la
  // meme coupure pour toutes (KEY TRACK 0)
  const gains = new Array(freqs.length);
  const left = freqs.map((f, i) => i);
  while (left.length) {
    const grp = [];
    for (let j = 0; j < left.length && grp.length < 12; j += 1) {
      const f = freqs[left[j]];
      if (grp.every((i) => Math.abs(Math.log2(freqs[i] / f)) >= 1 / 3)) grp.push(left[j]);
    }
    for (const i of grp) left.splice(left.indexOf(i), 1);
    const r = render({ file, os, maxVoices: 12, params: { ...ctx.LAB, wave1: 0, osc1: 0.01, ...base }, notes: grp.map((i) => held(hzMidi(freqs[i]))), seconds: 0.9 });
    for (const i of grp) gains[i] = harm(r.L, freqs[i], Math.round(0.35 * SR), Math.round(0.5 * SR)) / 0.01;
  }
  return gains;
}
async function c3c5(ctx, file) {
  const out = {};
  const fmode = Number(opt('--fmode', 0));
  for (const os of PATHS) {
    // Le gain relatif : le meme sinus, filtre ouvert a la butee (21.6 kHz, MOOG, RES 0) en reference, sa pente connue
    // (quatre poles prewarpes) retiree : il ne reste que le filtre mesure (bloqueurs et decimateurs s'annulent)
    const sr2 = SR * os;
    const corr = (f) => Math.pow(1 + Math.pow(Math.tan((Math.PI * f) / sr2) / Math.tan((Math.PI * 21600) / sr2), 2), 2);
    const rel = (base, freqs) => {
      const a = probeGains(ctx, file, os, base, freqs);
      const b = probeGains(ctx, file, os, { cutoff: 21600, res: 0, fmode: 0 }, freqs);
      return a.map((g, i) => g / b[i] / corr(freqs[i]));
    };
    for (const fc of [100, 300, 1000, 3000, 10000]) {
      const freqs = Array.from({ length: 24 }, (_, i) => fc * Math.pow(2, (i - 12) / 48));
      const g = rel({ cutoff: fc, res: 0, fmode }, freqs);
      let f12 = null;
      for (let i = 0; i < g.length - 1; i += 1) {
        const a = db(g[i]);
        const b = db(g[i + 1]);
        if (a >= -12 && b < -12) {
          const t = (a + 12) / (a - b);
          f12 = freqs[i] * Math.pow(freqs[i + 1] / freqs[i], t);
          break;
        }
      }
      out[`fc ${fc} x${os} -12dB point re set %`] = f12 ? r2((f12 / fc - 1) * 100) : 'n/a';
    }
    for (const res of [0.5, 0.7, 0.8]) {
      const fc = 1000;
      const freqs = [60, ...Array.from({ length: 35 }, (_, i) => fc * Math.pow(2, (i - 24) / 24))];
      const g = rel({ cutoff: fc, res, fmode }, freqs);
      const g0 = rel({ cutoff: fc, res: 0, fmode }, [60])[0];
      let pk = 0;
      for (let i = 1; i < g.length; i += 1) pk = Math.max(pk, g[i]);
      out[`res ${res} x${os} peak over RES0 passband dB`] = r1(db(pk / g0));
      out[`res ${res} x${os} 60Hz re RES0 dB`] = r1(db(g[0] / g0));
    }
  }
  return out;
}

/** C18 : le fondamental le long de WAVE 1 (sinus -> impulsion), A2, filtre ouvert, petit niveau. */
async function c18(ctx, file) {
  const out = {};
  for (const os of PATHS) {
    let ref = null;
    let lo = Infinity;
    let hi = -Infinity;
    for (let w = 0; w <= 4.0001; w += 0.25) {
      const r = render({ file, os, params: { ...ctx.LAB, wave1: w, osc1: 0.05 }, notes: [held(45)], seconds: 0.8 });
      const a = db(harm(r.L, 110, Math.round(0.3 * SR), Math.round(0.45 * SR)));
      if (ref === null) ref = a;
      lo = Math.min(lo, a - ref);
      hi = Math.max(hi, a - ref);
      out[`wave ${w} x${os} H1 re SINE dB`] = r2(a - ref);
    }
    out[`x${os} span dB`] = r2(hi - lo);
  }
  return out;
}

/** C22h : KEY TRACK 1, le filtre en auto-oscillation suit les notes C2 a C6 (cents re la note). */
async function c22h(ctx, file) {
  const out = {};
  for (const os of PATHS) {
    for (const midi of [36, 48, 60, 72, 84]) {
      const r = render({ file, os, params: { ...ctx.LAB, noise: 0.003, res: 1, keyTrack: 1, cutoff: midiHz(54) }, notes: [held(midi)], seconds: 3.5 });
      const st = Math.round(2.2 * SR);
      const f = zcFreq(r.L, st, Math.round(1.2 * SR));
      out[`note ${midi} x${os} cents`] = r1(cents(f, midiHz(midi)));
    }
  }
  return out;
}

/** Q11 : la somme mono des presets larges (moteur seul) : sonie L+R contre stereo, creux de la somme. */
async function q11(ctx, file) {
  const out = {};
  const step = 60 / 124 / 4;
  const notes = Array.from({ length: 32 }, (_, k) => ({ midi: [54, 57, 61, 64][k % 4] + (k % 8 >= 4 ? 12 : 0), time: 0.05 + k * step, gate: 0.6 * step, accent: 1, from: null }));
  const list = [...ctx.presets.filter((p) => p.engine.wide > 0 || p.engine.stack > 0 || p.engine.width > 0).map((p) => ({ name: p.name, params: p.engine })), ...(ctx.extraQ11 ?? [])];
  for (const os of PATHS) {
    for (const pt of list) {
      const r = render({ file, os, params: { ...pt.params, outLevel: 0.3 }, notes, seconds: 0.05 + 32 * step + 0.5 });
      const st = Math.round(0.05 * SR);
      const M = new Float32Array(r.L.length);
      for (let i = 0; i < M.length; i += 1) M[i] = 0.5 * (r.L[i] + r.R[i]);
      const lst = loudness(r.L, r.R, st);
      const lm = loudness(M, M, st);
      const bl = thirdBands(r.L, r.L, st);
      const br = thirdBands(r.R, r.R, st);
      const bm = thirdBands(r.L, r.R, st);
      let notch = 0;
      for (let i = 0; i < bm.length; i += 1) {
        const fcen = [40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000][i];
        if (!fcen || fcen < 100 || fcen > 5000) continue;
        const stereo = db10(0.5 * (Math.pow(10, bl[i] / 10) + Math.pow(10, br[i] / 10)));
        notch = Math.min(notch, bm[i] - stereo);
      }
      out[`${pt.name} x${os} mono re stereo LU`] = r2(lm - lst);
      out[`${pt.name} x${os} deepest notch dB`] = r1(notch);
    }
  }
  return out;
}

/**
 * Q3 : l'escalier des potards. Chaque potard du moteur parcourt ses 128 valeurs MIDI en 2 s (un message toutes les
 * 15.6 ms, la traduction du site) sur une scie C3 tenue : l'energie au-dessus de 6 kHz par fenetre de 2 ms contre sa
 * mediane glissante de 50 ms (le pire exces, dB) ; et la raie du bloc (375 Hz) d'une note fixe.
 */
async function q3(ctx, file) {
  const out = {};
  const P = ctx.M.params;
  const { highpass4 } = await import('./ana.mjs');
  const knobs = { ...ctx.knobs, delay: 0, reverb: 0 };
  const ids = ['cutoff', 'res', 'dist', 'osc1', 'osc2', 'wave1', 'wave2', 'sub', 'noise', 'fm', 'volume', 'glue', 'wide', 'stack', 'envAmt', ...(ctx.extraQ3 ?? [])].filter((id) => P.VOY_KNOB_IDS.includes(id));
  const os = PATHS[0];
  const eng = (k) => ({ ...P.engineParams(k), outLevel: 0.3 });
  // Le potard de 0 a 1 en 2 s : par crans MIDI (128 valeurs, un message toutes les 15.6 ms) ou lisse (une valeur par
  // bloc, l'ideal) ; l'escalier, c'est l'energie au-dessus de 6 kHz que les crans ajoutent, par fenetre de 2 ms
  const run = (id, stepped) => render({ file, os, params: eng({ ...knobs, [id]: 0 }), notes: [held(48, 4)], seconds: 2.6, seed: 5, onBlock: (f, proc) => {
    const t = f / SR - 0.3;
    if (t < 0 || t > 2.05) return;
    const v = stepped ? Math.min(127, Math.floor(t / 0.0156)) / 127 : Math.min(1, t / (127 * 0.0156));
    proc.onMsg({ type: 'params', params: eng({ ...knobs, [id]: v }) });
  } });
  const w = Math.round(0.002 * SR);
  const energy = (x) => {
    const h = highpass4(x, 6000);
    const e = [];
    for (let i = Math.round(0.35 * SR); i + w < Math.round(2.35 * SR); i += w) {
      let s = 0;
      for (let j = 0; j < w; j += 1) s += h[i + j] * h[i + j];
      e.push(s / w);
    }
    return e;
  };
  for (const id of ids) {
    const a = energy(run(id, true).L);
    const b = energy(run(id, false).L);
    const floor = Math.max(...b) * 1e-6;
    let worst = -Infinity;
    for (let i = 0; i < a.length; i += 1) worst = Math.max(worst, db10((a[i] + floor) / (b[i] + floor)));
    out[`${id} worst 2ms HF, MIDI steps re smooth dB`] = r1(worst);
  }
  // La raie du bloc (128 / 48 kHz) d'une note fixe, son de depart
  const r = render({ file, os, params: { ...eng(knobs), glue: 0 }, notes: [held(48, 4)], seconds: 2.5 });
  const S = spectrum(r.L, 65536, Math.round(0.8 * SR));
  let line = 0;
  for (let k = 1; k <= 8; k += 1) {
    const i = Math.round((375 * k * 65536) / SR);
    for (let j = i - 2; j <= i + 2; j += 1) line = Math.max(line, S.amp[j]);
  }
  out['static note, line at 375 Hz x k (dBFS)'] = r1(db(line));
  return out;
}

/**
 * Q8 : memoire et calcul. Les octets alloues par bloc par le moteur (echantillonnage du tas, objets ramasses compris),
 * sur 20 s (60 s pour l'arpege) apres 10 s de chauffe, dans la meme instance du moteur (comme le fil audio) ; les
 * ramasse-miettes (node --trace-gc) sur 30 s apres la chauffe ; les blocs lents (mediane, p99.9) d'un arpege.
 */
async function gc(ctx, file) {
  const out = {};
  const { Session } = await import('node:inspector');
  const step = 60 / 130 / 4;
  const arp = (secs) => Array.from({ length: Math.floor(secs / step) }, (_, k) => ({ midi: 54 + ((k * 5) % 12), time: 0.05 + k * step, gate: 0.5 * step, accent: 1, from: null }));
  const cases = [
    ['held GLUE 0.35', { ...ctx.DEF, glue: 0.35, outLevel: 0.3 }, [held(54, 100, 0.05)], 20],
    ['held GLUE 0', { ...ctx.DEF, glue: 0, outLevel: 0.3 }, [held(54, 100, 0.05)], 20],
    ['arp INIT 60 s', { ...ctx.DEF, outLevel: 0.3 }, arp(72), 60],
    ...(ctx.extraGc ?? []),
  ];
  const session = new Session();
  session.connect();
  session.post('HeapProfiler.enable', () => {});
  for (const os of PATHS) {
    for (const [name, params, notes, D] of cases) {
      const W = 10;
      const A = Math.round((W * SR) / 128) * 128;
      const B = A + Math.round((D * SR) / 128) * 128;
      let prof = null;
      render({ file, os, params, notes, seconds: W + D + 0.1, onBlock: (f) => {
        if (f === A) session.post('HeapProfiler.startSampling', { samplingInterval: 1024, includeObjectsCollectedByMinorGC: true, includeObjectsCollectedByMajorGC: true }, () => {});
        if (f === B) session.post('HeapProfiler.stopSampling', (e, r) => { prof = r.profile; });
      } });
      let tot = 0;
      const agg = {};
      (function walk(n) {
        // Le moteur est evalue (new Function) : ses cadres n'ont pas d'adresse
        const f = n.callFrame.url || '';
        if (f === '' || f.includes(path.basename(file))) {
          const k = `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber + 1}`;
          agg[k] = (agg[k] || 0) + n.selfSize;
          tot += n.selfSize;
        }
        for (const c of n.children || []) walk(c);
      })(prof.head);
      const blocks = (D * SR) / 128;
      out[`${name} x${os} bytes per block`] = r1(tot / blocks);
      const top = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${r1(v / blocks)}`);
      if (top.length) out[`${name} x${os} top`] = top.join(' | ');
    }
    // Les blocs d'un arpege de 60 s apres 10 s de chauffe (temps mur) : mediane, p99.9, max
    const t = render({ file, os, params: { ...ctx.DEF, outLevel: 0.3 }, notes: arp(72), seconds: 70, timing: true });
    const a = [...t.blockUs.slice(Math.round((10 * SR) / 128))].sort((p, q) => p - q);
    out[`arp INIT 60 s x${os} block us median`] = r1(a[Math.floor(a.length / 2)]);
    out[`arp INIT 60 s x${os} block us p99.9`] = r1(a[Math.floor(a.length * 0.999)]);
    out[`arp INIT 60 s x${os} block us max`] = r1(a[a.length - 1]);
  }
  session.disconnect();
  // Les ramasse-miettes (node --trace-gc) sur 30 s d'une note tenue, apres 10 s de chauffe dans la meme instance ; sans
  // Vite dans ce processus (un petit tas, comme le fil audio) : les reglages ecrits dans la sonde
  const probe = path.join(OUT, 'gc-probe.mjs');
  mkdirSync(OUT, { recursive: true });
  const P = JSON.stringify({ ...ctx.DEF, outLevel: 0.3 });
  const F = JSON.stringify(file);
  for (const os1 of PATHS) {
    writeFileSync(probe, `import { render, held } from ${JSON.stringify(path.join(ROOT, 'scripts/arp-quality/lib.mjs'))};\nconst params = ${P};\nconst A = Math.round((10 * 48000) / 128) * 128;\nconst B = A + Math.round((30 * 48000) / 128) * 128;\nrender({ file: ${F}, os: ${os1}, params, notes: [held(54, 100, 0.05)], seconds: 40.1, onBlock: (f) => {\n  if (f === A) console.log('--- chauffe finie');\n  if (f === B) console.log('--- fin');\n} });\n`);
    const res = spawnSync(process.execPath, ['--trace-gc', probe], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    const win = ((res.stdout || '').split('--- chauffe finie')[1] || '').split('--- fin')[0];
    out[`held INIT x${os1} scavenges in 30 s after warm-up`] = (win.match(/Scavenge/g) || []).length;
    out[`held INIT x${os1} mark-compact in 30 s after warm-up`] = (win.match(/Mark-Compact|Mark-sweep/gi) || []).length;
  }
  return out;
}

const SUITES = { purity, p1a, selfosc, sync, tri, timbre, resp, level, silence, garbage, q2, q10, c3c5, c18, c22h, q11, q3, gc };
export async function extraSuites(more) {
  Object.assign(SUITES, more);
}

/* ---------------- le lanceur ---------------- */

export async function main(extra = {}) {
  Object.assign(SUITES, extra.suites ?? {});
  const names = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'purity').split(',');
  const list = names.includes('all') ? Object.keys(SUITES) : names;
  const ctx = { ...(await patches()), ...(extra.ctx ?? {}) };
  const tag = opt('--tag', '');
  for (const name of list) {
    const fn = SUITES[name];
    if (!fn) {
      console.log(`serie inconnue : ${name} (${Object.keys(SUITES).join(', ')})`);
      continue;
    }
    const t0 = Date.now();
    const a = await fn(ctx, WORKLET);
    const b = AGAINST ? await fn(ctx, path.resolve(AGAINST)) : null;
    console.log(`\n== ${name} (${path.relative(ROOT, WORKLET) || WORKLET}${b ? ` contre ${AGAINST}` : ''}) ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    for (const k of Object.keys(a)) {
      const va = a[k];
      if (!b) console.log(`  ${k.padEnd(52)} ${va}`);
      else {
        const vb = b[k];
        const d = typeof va === 'number' && typeof vb === 'number' ? r2(va - vb) : '';
        console.log(`  ${k.padEnd(52)} ${String(va).padStart(10)}   avant ${String(vb).padStart(10)}   ${d !== '' ? `ecart ${d}` : ''}`);
      }
    }
    writeJson(path.join(OUT, `${name}${tag ? `-${tag}` : ''}.json`), { worklet: WORKLET, against: AGAINST || null, paths: PATHS, res: a, ...(b ? { ref: b } : {}) });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => {
  console.error(e);
  process.exit(1);
});
