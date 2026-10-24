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
import { cents, clickDb, db, db10, harm, harmonicSplit, loudness, peakFreq, r1, r2, spectrum, stats, thirdBands, THIRDS, zcFreq, SR } from './ana.mjs';

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

/**
 * S6 (2026-10-23) : la coupure balayee de 2 a 16 kHz en 2 s (exponentielle, un message par bloc) a RES 0.95, graine
 * NOISE : la plus grande marche de l'enveloppe de l'auto-oscillation (valeur efficace sur 4 ms, Hann, toutes les 1 ms ;
 * dB d'une mesure a la suivante) et ou elle tombe ; Q4 (au-dessus de 8 kHz) n'a pas de sens ici (l'oscillation y passe).
 */
async function sweep(ctx, file) {
  const out = {};
  const res = Number(opt('--res', 0.95));
  for (const os of PATHS) {
    const t0 = 0.5;
    const T = 2;
    const tl = [];
    for (let f = Math.ceil((t0 * SR) / 128) * 128; f <= (t0 + T) * SR; f += 128) {
      const x = (f / SR - t0) / T;
      tl.push({ at: f / SR - 1e-6, msg: { type: 'params', params: { cutoff: 2000 * Math.pow(8, x) } } });
    }
    const r = render({ file, os, params: { ...ctx.LAB, noise: 0.003, res, cutoff: 2000 }, notes: [held(54, 10)], seconds: t0 + T + 0.2, timeline: tl });
    const W = Math.round(0.004 * SR);
    const hop = Math.round(0.001 * SR);
    const env = [];
    for (let i = Math.round(t0 * SR); i + W < (t0 + T) * SR; i += hop) {
      let s2 = 0;
      let ws = 0;
      for (let j = 0; j < W; j += 1) {
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * j) / W);
        s2 += w * r.L[i + j] * r.L[i + j];
        ws += w;
      }
      env.push([i / SR, 10 * Math.log10(s2 / ws + 1e-30)]);
    }
    let worst = 0;
    let at = 0;
    for (let i = 1; i < env.length; i += 1) {
      const d = Math.abs(env[i][1] - env[i - 1][1]);
      if (d > worst) {
        worst = d;
        at = env[i][0];
      }
    }
    const lv = env.map((e) => e[1]);
    out[`r${res} x${os} max step dB`] = r2(worst);
    out[`r${res} x${os} at cutoff Hz`] = Math.round(2000 * Math.pow(8, (at - t0) / T));
    out[`r${res} x${os} level min dBFS`] = r1(Math.min(...lv) + 3.01);
    out[`r${res} x${os} level max dBFS`] = r1(Math.max(...lv) + 3.01);
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
        // 2026-10-23 (S7) : en bas, l'oscillation met des secondes a s'installer (sa hauteur aux petites amplitudes est
        // celle du filtre lineaire) : 9 s sous 300 Hz, 5 s sous 1.5 kHz
        const secs = cutoff < 300 ? 9 : cutoff < 1500 ? 5 : 2.5;
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

/**
 * S8 (2026-10-23) : la forme synchronisee contre la scie synchronisee ideale (maitre A2 110 Hz, esclave a +7 et +19
 * demi-tons, scie, HP 20 Hz) : le plus grand ecart des harmoniques 1 a 30 a la serie de Fourier ideale (les deux a la
 * meme energie ; les harmoniques a plus de 40 dB sous le plus fort).
 */
async function syncwave(ctx, file) {
  const out = {};
  for (const os of PATHS) {
    for (const semi of [7, 19]) {
      const r = render({ file, os, params: { ...ctx.LAB, fmode: 3, cutoff: 20, osc1: 0, osc2: 0.1, wave1: 2, wave2: 2, tune2: semi, sync: 1 }, notes: [held(45)], seconds: 1.6 });
      const st = Math.round(0.3 * SR);
      const N = Math.round(1.0 * SR);
      const ratio = Math.pow(2, semi / 12);
      // L'ideal : une periode du maitre echantillonnee finement, ses coefficients de Fourier
      const M = 1 << 16;
      const ideal = (k) => {
        let re = 0;
        let im = 0;
        for (let i = 0; i < M; i += 1) {
          const t = i / M;
          let ph = ratio * t;
          ph -= Math.floor(ph);
          const y = 1 - 2 * ph;
          re += y * Math.cos(2 * Math.PI * k * t);
          im += y * Math.sin(2 * Math.PI * k * t);
        }
        return Math.hypot(re, im) / M;
      };
      // Les deux series ramenees a la meme energie (H1 a H30), puis l'ecart de chaque harmonique a plus de -40 dB
      const A = [];
      const B = [];
      for (let k = 1; k <= 30; k += 1) {
        A.push(harm(r.L, 110 * k, st, N));
        B.push(ideal(k));
      }
      const ea = Math.sqrt(A.reduce((x, y) => x + y * y, 0));
      const eb = Math.sqrt(B.reduce((x, y) => x + y * y, 0));
      const top = Math.max(...B) / eb;
      let worst = 0;
      let wk = 0;
      for (let k = 0; k < 30; k += 1) {
        if (B[k] / eb < top * 0.01) continue;
        const d = db(A[k] / ea) - db(B[k] / eb);
        if (Math.abs(d) > Math.abs(worst)) {
          worst = d;
          wk = k + 1;
        }
      }
      out[`s${semi} x${os} worst dB`] = r2(worst);
      out[`s${semi} x${os} at H`] = wk;
    }
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

/**
 * Q4 sur un reglage (2026-10-23, S4) : un potard change pendant une note tenue (par defaut OVERDRIVE 0 -> 0.5 a 0.6 s,
 * puis 0.5 -> 0 a 1.2 s) ; l'energie au-dessus de 8 kHz autour de chaque changement contre la plus forte des deux
 * notes tenues sans changement (le reglage d'avant et celui d'apres) : dB, <= +3 (pas de clic ajoute).
 *   --key drive --from 0 --to 0.5   un autre potard
 */
async function pclick(ctx, file) {
  const out = {};
  const key = opt('--key', 'drive');
  // 2026-10-23 (S11) : des reglages de base en plus (--base '{"res":0.8}')
  const extraBase = JSON.parse(opt('--base', '{}'));
  const a = Number(opt('--from', 0));
  const b = Number(opt('--to', 0.5));
  const t1 = 0.6;
  const t2 = 1.2;
  for (const os of PATHS) {
    for (const [lbl, base] of [['saw C3', { wave1: 2, osc1: 0.62 }], ['saw C5', { wave1: 2, osc1: 0.62, keyTrack: 0 }], ['2x0.88 C3', { wave1: 2, osc1: 0.88, osc2: 0.88, wave2: 2 }]]) {
      const midi = lbl.includes('C5') ? 72 : 48;
      const params = { ...ctx.DEF, ...base, cutoff: 6000, envOct: 0, aS: 1, fS: 1, drift: 0, glue: 0, outLevel: 0.3, ...extraBase };
      const notes = [held(midi, 3, 0.05)];
      const ev = render({ file, os, params: { ...params, [key]: a }, notes, seconds: 1.8, timeline: [
        { at: t1, msg: { type: 'params', params: { [key]: b } } },
        { at: t2, msg: { type: 'params', params: { [key]: a } } },
      ] });
      const ra = render({ file, os, params: { ...params, [key]: a }, notes, seconds: 1.8 });
      const rb = render({ file, os, params: { ...params, [key]: b }, notes, seconds: 1.8 });
      for (const [t, n] of [[t1, `${a}->${b}`], [t2, `${b}->${a}`]]) {
        const tb = Math.round((t * SR) / 128) * 128 / SR;
        const d = Math.min(clickDb(ev.L, ra.L, tb), clickDb(ev.L, rb.L, tb));
        out[`${key} ${n} ${lbl} x${os} dB`] = r1(d);
      }
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
    // Une note tenue dont les sources (OSC 1, OSC 2, SUB, NOISE) passent a 0 apres 0.5 s : l'etat d'une voix allumee qui ne
    // recoit plus que des zeros (le passe-bas d'avant le filtre, S3, et l'echelle) ne doit pas descendre dans les
    // sous-normaux
    { name: 'X HELD SOURCE OFF', params: { ...ctx.DEF, aS: 1, fS: 1, outLevel: 0.25 }, notes: [held(54, 20, 0.05)], timeline: [{ at: 0.5, msg: { type: 'params', params: { osc1: 0, osc2: 0, sub: 0, noise: 0 } } }], seconds: 14 },
    // Le MS-10 (S11) : resonance a fond, WIDE
    { name: 'X MS10 RES1 WIDE', params: { ...ctx.DEF, fmode: 4, res: 1, wide: 1, outLevel: 0.25 } },
    // LOAD a fond (S12), resonance haute, WIDE
    { name: 'X LOAD1 RES0.9 WIDE', params: { ...ctx.DEF, load: 1, res: 0.9, wide: 1, outLevel: 0.25 } },
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
      // Un premier passage pour le compilateur (la premiere queue fait repartir le code optimise : des blocs lents qui
      // ne reviennent plus), puis la mesure
      render({ file, os, params: pt.params, notes: pt.notes ?? bar(), timeline: pt.timeline, seconds: tEnd + 1 });
      const secs = pt.seconds ?? tEnd + 6;
      const r = render({ file, os, params: pt.params, notes: pt.notes ?? bar(), timeline: pt.timeline, seconds: secs, timing: true, onBlock: (f, proc) => {
        if (f % 1280 === 0 || f / SR > secs - 0.1) scan(proc, acc);
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
      // Le 90e centile de la queue (le temps mur d'un bloc seul suit aussi le bruit de la machine)
      const p90 = (a) => (a.length ? [...a].sort((p, q) => p - q)[Math.floor(a.length * 0.9)] : 0);
      const ratio = med(sounding) > 0 ? p90(tail) / med(sounding) : 0;
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
  out['WORST tail block p90 / sounding median'] = r2(worstRatio);
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
  let worstRecX = 0;
  let worstRecXKey = '';
  for (const k of keys) {
    for (const b of BAD) {
      const r = render({ file, os, params: base, notes, seconds: 1.0, seed: 7, onBlock: (f, proc) => {
        if (f === 128 * 112) proc.onMsg({ type: 'params', params: { [k]: b } });
        if (f === 128 * 225) proc.onMsg({ type: 'params', params: { [k]: base[k] } });
      } });
      let nf = 0;
      let pk = 0;
      // La crete apres VOLUME (outLevel), celle qui sort des enceintes
      for (let i = 128 * 112; i < 128 * 225; i += 1) {
        const v = Math.max(Math.abs(r.L[i]), Math.abs(r.R[i])) * base.outLevel;
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
      // +/-1e9 est borne a l'extreme legal (un vrai son, qui revient en lissant) : son retour compte a part
      if (b === 1e9 || b === -1e9) {
        if (rec > worstRecX) {
          worstRecX = rec;
          worstRecXKey = `${k}=${name(b)}`;
        }
        if (nf > 0) out[`${k}=${name(b)}`] = `nf ${nf}`;
        continue;
      }
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
  out['WORST peak dBFS during bad (after VOLUME)'] = `${r1(worstPk)} (${worstKey})`;
  out['WORST nonFinite'] = worstNF;
  out['WORST recovery ms'] = `${r1(worstRec * 1000)} (${worstRecKey})`;
  out['WORST recovery ms, +/-1e9 (borne a l extreme legal)'] = `${r1(worstRecX * 1000)} (${worstRecXKey})`;
  // Le pire reglage legal : RES 1, OD 1, coupure max, FM 1, SYNC, STACK, WIDE, GLUE 1, 12 voix a C8
  // Dans chaque MODE, et en HP coupure basse avec toutes les sources a fond (le plus fort que l'echelle laisse passer)
  const modes = ctx.extremeModes ?? [0, 1, 2, 3];
  for (const os2 of PATHS) {
    for (const fmode of modes) {
      for (const [lbl, x] of [['cutmax', { cutoff: 21600 }], ['allmax', { cutoff: 200, osc1: 1.32, osc2: 1.32, sub: 1.32, noise: 1.5, wave1: 3, wave2: 3, sync: 0, fm: 0 }]]) {
        const ext = { ...ctx.DEF, res: 1, drive: 1, fm: 1, sync: 1, stack: 30, wide: 1, glue: 1, outLevel: 0.3, aS: 1, fmode, ...x, ...(ctx.extremeExtra ?? {}) };
        const notes = lbl === 'cutmax' ? Array.from({ length: 12 }, (_, i) => held(108 + (i % 4), 1.5, 0.01 * i)) : Array.from({ length: 12 }, (_, i) => held(36 + i * 5, 1.5, 0.01 * i));
        const r = render({ file, os: os2, params: ext, notes, seconds: 2 });
        let nf = 0;
        for (let i = 0; i < r.L.length; i += 1) if (!Number.isFinite(r.L[i]) || !Number.isFinite(r.R[i])) nf += 1;
        const k = `EXTREME ${lbl} mode ${fmode} x${os2}`;
        out[`${k} peak dBFS`] = r1(db(Math.max(stats(r.L).peak, stats(r.R).peak)));
        out[`${k} nonFinite`] = nf;
        out[`${k} heals`] = r.proc.heals ?? 0;
      }
    }
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
  // Les decimateurs tels que le moteur les construit (2026-10-23, K1' : le premier etage du x4 en Kaiser 9)
  const b31 = Number((src.match(/new Decimator\(31, (\d+)\)/) ?? [0, 7])[1]);
  const b63 = Number((src.match(/new Decimator\(63, (\d+)\)/) ?? [0, 8])[1]);
  const h31 = g.halfband(31, b31).h;
  const h63 = g.halfband(63, b63).h;
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

/**
 * S11 (2026-10-23) : le MODE MS-10 (fmode 4) contre son plan : bosses (C6, toucher contre MOOG), 60 Hz, pente, depart
 * de l'auto-oscillation (C7), son niveau et sa hauteur (C8, C9), H2 / H3 / crete (C10), le grain par defaut (sinus de
 * 200 Hz a 0.62, H3), la compression de la bosse (C11), l'ecart de hauteur des notes sous DRIFT 5 (B7), la sonie
 * d'INIT contre MOOG, le continu (Q5). --quick : moins de points.
 */
async function ms10(ctx, file) {
  const out = {};
  // Le genou des diodes du moteur mesure (C11 : les niveaux en unites de genou)
  const src = (await import('node:fs')).readFileSync(file, 'utf8');
  const knee = Number((src.match(/const K35_KNEE = ([0-9.]+)/) ?? [0, 1.6])[1]);
  const kapRes = (kap) => {
    const A = [0, 0.3, 0.5, 0.7, 0.8, 0.85, 0.9, 1.0];
    const K = [0, 0.5, 0.72, 0.86, 0.935, 0.965, 1.0, 1.15];
    for (let i = 1; i < A.length; i += 1) if (kap <= K[i]) return A[i - 1] + ((A[i] - A[i - 1]) * (kap - K[i - 1])) / (K[i] - K[i - 1]);
    return 1;
  };
  for (const os of PATHS) {
    const fc = 1000;
    const freqs = [60, ...Array.from({ length: 35 }, (_, i) => fc * Math.pow(2, (i - 24) / 24))];
    const g0 = probeGains(ctx, file, os, { cutoff: fc, res: 0, fmode: 4 }, freqs);
    const resL = QUICK ? [0.5, 0.7, 0.8] : [0.3, 0.5, 0.7, 0.8, 0.85];
    const kaps = [0.75, 0.9, 0.95];
    for (const [lbl, res] of [...resL.map((r) => [`RES ${r}`, r]), ...kaps.map((k) => [`kappa ${k}`, kapRes(k)])]) {
      const g = probeGains(ctx, file, os, { cutoff: fc, res, fmode: 4 }, freqs);
      let pk = 0;
      for (let i = 1; i < g.length; i += 1) pk = Math.max(pk, g[i]);
      out[`${lbl} x${os} peak over passband dB`] = r1(db(pk / g[0]));
      out[`${lbl} x${os} 60Hz re RES0 dB`] = r2(db(g[0] / g0[0]));
      if (lbl.startsWith('RES') && os === PATHS[0]) {
        const gm = probeGains(ctx, file, os, { cutoff: fc, res, fmode: 0 }, freqs);
        let pm = 0;
        for (let i = 1; i < gm.length; i += 1) pm = Math.max(pm, gm[i]);
        out[`${lbl} x${os} MOOG peak dB`] = r1(db(pm / gm[0]));
      }
    }
    // La pente : de 4 fc a 8 fc, RES 0 (a RES 0 le second pole est a 2.3 fc)
    const sl = probeGains(ctx, file, os, { cutoff: fc, res: 0, fmode: 4 }, [4 * fc, 8 * fc]);
    out[`slope 4-8 fc x${os} dB/oct`] = r2(db(sl[1] / sl[0]));
    // Le depart de l'auto-oscillation (graine NOISE, 1 kHz)
    let onset = null;
    for (let r = 0.86; r <= 0.95; r += 0.005) {
      const a = render({ file, os, params: { ...ctx.LAB, noise: 0.003, res: r, cutoff: 1000, fmode: 4 }, notes: [held(54)], seconds: 3 });
      const pk = peakFreq(a.L, { start: Math.round(2 * SR), n: 32768 });
      if (db(pk.amp) > -40) {
        onset = r;
        break;
      }
    }
    out[`self-osc onset x${os} RES`] = onset === null ? 'n/a' : r2(onset);
    // L'auto-oscillation a RES 1 : niveau, hauteur, H2, H3, crete
    for (const f of QUICK ? [250, 1000, 4000, 8000] : [100, 250, 1000, 4000, 8000, 12000]) {
      const secs = f < 300 ? 9 : f < 1500 ? 5 : 3;
      const a = render({ file, os, params: { ...ctx.LAB, noise: 0.003, res: 1, cutoff: f, fmode: 4 }, notes: [held(54, 20)], seconds: secs });
      const st = Math.round((secs - 1.2) * SR);
      const N = Math.round(1.1 * SR);
      let fz = zcFreq(a.L, st, N);
      const pk = peakFreq(a.L, { start: st, n: 32768 });
      if (!(fz > 0) || Math.abs(cents(fz, pk.f)) > 30) fz = pk.f;
      const h1 = harm(a.L, fz, st, N);
      out[`r1 f${f} x${os} cents`] = r1(cents(fz, f));
      out[`r1 f${f} x${os} dBFS`] = r1(db(h1));
      if (f === 1000) {
        out[`r1 f${f} x${os} H2 dBc`] = r1(db(harm(a.L, 2 * fz, st, N)) - db(h1));
        out[`r1 f${f} x${os} H3 dBc`] = r1(db(harm(a.L, 3 * fz, st, N)) - db(h1));
        const S = stats(a.L, st, st + N);
        out[`r1 f${f} x${os} crest dB`] = r2(db(S.peak / S.rms));
      }
    }
    // Le grain par defaut : un sinus de 200 Hz a 0.62, filtre ouvert, RES 0
    {
      const a = render({ file, os, params: { ...ctx.LAB, wave1: 0, osc1: 0.62, cutoff: 21600, res: 0, fmode: 4 }, notes: [held(hzMidi(200))], seconds: 1.2 });
      const st = Math.round(0.3 * SR);
      const N = Math.round(0.8 * SR);
      const h1 = harm(a.L, 200, st, N);
      out[`sine200 0.62 x${os} H3 dBc`] = r1(db(harm(a.L, 600, st, N)) - db(h1));
      out[`sine200 0.62 x${os} H2 dBc`] = r1(db(harm(a.L, 400, st, N)) - db(h1));
      const m = render({ file, os, params: { ...ctx.LAB, wave1: 0, osc1: 0.62, cutoff: 21600, res: 0, fmode: 0 }, notes: [held(hzMidi(200))], seconds: 1.2 });
      out[`sine200 0.62 x${os} MOOG H3 dBc`] = r1(db(harm(m.L, 600, st, N)) - db(harm(m.L, 200, st, N)));
    }
    // C11 : la bosse a kappa 0.86 contre le niveau (0.3 genou puis +12 dB) ; 60 Hz a kappa 0.95 contre RES 0, au meme
    // niveau, a chaque niveau
    {
      const lv = [];
      for (const amp of [0.3 * knee, 1.2 * knee]) lv.push(probeGains(ctx, file, os, { cutoff: fc, res: kapRes(0.86), fmode: 4, osc1: amp }, [60, fc]));
      out[`C11 kappa 0.86 x${os} prominence change dB (+12 dB in)`] = r1(db(lv[1][1] / lv[1][0]) - db(lv[0][1] / lv[0][0]));
      let worst = 0;
      for (const amp of [0.1 * knee, 0.3 * knee, 1.2 * knee, 4 * knee]) {
        const a = probeGains(ctx, file, os, { cutoff: fc, res: kapRes(0.95), fmode: 4, osc1: amp }, [60])[0];
        const b = probeGains(ctx, file, os, { cutoff: fc, res: 0, fmode: 4, osc1: amp }, [60])[0];
        if (Math.abs(db(a / b)) > Math.abs(worst)) worst = db(a / b);
      }
      out[`C11 kappa 0.95 x${os} 60Hz re RES0 worst over levels dB`] = r2(worst);
    }
    // Q1 du MS-10 : scie C7 RES 0.8 (coupure 5 kHz), auto-oscillation (RES 1, graine NOISE) a 1, 4, 8 et 12 kHz
    {
      const a = render({ file, os, params: { ...ctx.LAB, wave1: 2, osc1: 0.62, res: 0.8, cutoff: 5000, fmode: 4 }, notes: [held(96)], seconds: 1.6 });
      out[`Q1 saw C7 RES0.8 x${os} purity`] = r1(harmonicSplit(a.L, [midiHz(96)]).purity);
      for (const f of [1000, 4000, 8000, 12000]) {
        const b = render({ file, os, params: { ...ctx.LAB, noise: 0.003, res: 1, cutoff: f, fmode: 4 }, notes: [held(54, 20)], seconds: 3 });
        const pk = peakFreq(b.L, { start: Math.round(1.5 * SR), n: 65536 });
        out[`Q1 self-osc ${f} x${os} purity`] = r1(harmonicSplit(b.L, [pk.f], { start: Math.round(1.4 * SR) }).purity);
      }
    }
    // INIT contre MOOG : une mesure de doubles croches (DEF), sonie ponderee K
    {
      const step = 60 / 130 / 4;
      const notes = Array.from({ length: 32 }, (_, k) => ({ midi: 54 + ((k * 7) % 12), time: 0.05 + k * step, gate: 0.5 * step, accent: [1, 0.8, 0.92, 1.12][k % 4], from: null }));
      const a = render({ file, os, params: { ...ctx.DEF, fmode: 4, outLevel: 0.25 }, notes, seconds: 0.05 + 32 * step + 0.3 });
      const m = render({ file, os, params: { ...ctx.DEF, fmode: 0, outLevel: 0.25 }, notes, seconds: 0.05 + 32 * step + 0.3 });
      out[`INIT x${os} MS-10 re MOOG LU`] = r2(loudness(a.L, a.R) - loudness(m.L, m.R));
      let mx = 0;
      for (let s0 = 0; s0 + SR <= a.L.length; s0 += SR / 4) mx = Math.max(mx, Math.abs(stats(a.L, s0, s0 + SR).mean));
      out[`INIT x${os} MS-10 worst 1 s mean`] = Number(mx.toExponential(2));
      let mm = 0;
      for (let s0 = 0; s0 + SR <= m.L.length; s0 += SR / 4) mm = Math.max(mm, Math.abs(stats(m.L, s0, s0 + SR).mean));
      out[`INIT x${os} MOOG worst 1 s mean`] = Number(mm.toExponential(2));
    }
    // B7 : DRIFT 5 a l'ecran (le defaut, drift 1 au moteur), RES 0.95, 32 notes de suite (keyTrack 0) : l'ecart type de
    // la hauteur de l'oscillation
    for (const fm of [4, 0]) {
      const cs = [];
      const n = QUICK ? 12 : 32;
      const dur = 0.9;
      const notes = Array.from({ length: n }, (_, k) => ({ midi: 60, time: 0.05 + k * dur, gate: dur - 0.05, accent: 1, from: null }));
      const a = render({ file, os, params: { ...ctx.LAB, noise: 0.01, res: 0.95, cutoff: 1000, drift: 1, fmode: fm, keyTrack: 0 }, notes, seconds: 0.05 + n * dur + 0.1 });
      for (let k = 0; k < n; k += 1) {
        const st = Math.round((0.05 + k * dur + 0.45) * SR);
        const f = zcFreq(a.L, st, Math.round(0.35 * SR));
        if (f > 0) cs.push(cents(f, 1000));
      }
      const mean = cs.reduce((x, y) => x + y, 0) / cs.length;
      const sd = Math.sqrt(cs.reduce((x, y) => x + (y - mean) * (y - mean), 0) / cs.length);
      out[`B7 ${fm === 4 ? 'MS-10' : 'MOOG'} x${os} pitch spread cents rms`] = r1(sd);
    }
  }
  return out;
}

/**
 * S12 (2026-10-23) : LOAD contre son plan : C12 (un sinus a 0.62), C13 / C14 (deux sinus a 0.88 : H3, H5, H2, la
 * pente au-dessus du genou), C11 (la bosse comprimee par le niveau, la perte de graves a RES 0.95), C15 (filtre ferme :
 * centroide et crete), C16 (sonie d'INIT et DARK DISCO de LOAD 0 a 1), le punch d'un accord pince, Q1, la reponse
 * ouverte, Q5 (continu, sous 20 Hz).
 */
async function load(ctx, file) {
  const out = {};
  const LOADS = QUICK ? [0, 0.35, 1] : [0, 0.1, 0.2, 0.35, 0.6, 1];
  const st = Math.round(0.3 * SR);
  const N = Math.round(0.8 * SR);
  const hk = (r, f, k) => db(harm(r.L, f * k, st, N)) - db(harm(r.L, f, st, N));
  for (const os of PATHS) {
    // C12 : un sinus a 0.62, ouvert
    {
      const r = render({ file, os, params: { ...ctx.LAB, wave1: 0, osc1: 0.62, load: 0.1, cutoff: 21600 }, notes: [held(45)], seconds: 1.2 });
      out[`C12 L0.1 x${os} H3 dBc`] = r1(hk(r, 110, 3));
      out[`C12 L0.1 x${os} H2 dBc`] = r1(hk(r, 110, 2));
    }
    // C13 / C14 : deux sinus a 0.88
    for (const L of [0.1, 0.2, 0.35, 0.6, 1]) {
      const r = render({ file, os, params: { ...ctx.LAB, wave1: 0, osc1: 0.88, osc2: 0.88, wave2: 0, tune2: 0, load: L, cutoff: 21600 }, notes: [held(45)], seconds: 1.2 });
      out[`C13 2x0.88 L${L} x${os} H3 dBc`] = r1(hk(r, 110, 3));
      out[`C13 2x0.88 L${L} x${os} H5 under H3 dB`] = r1(hk(r, 110, 3) - hk(r, 110, 5));
      out[`C14 2x0.88 L${L} x${os} H2 under H3 dB`] = r1(hk(r, 110, 3) - hk(r, 110, 2));
    }
    {
      // A LOAD 0.6, au-dessus du genou : +6 dB a l'entree (deux sinus de 0.2 a 0.4 : l'entree de la courbe de 0.98 a 1.95)
      const lv = [0.2, 0.4].map((o) => {
        const r = render({ file, os, params: { ...ctx.LAB, wave1: 0, osc1: o, osc2: o, wave2: 0, tune2: 0, load: 0.6, cutoff: 21600 }, notes: [held(45)], seconds: 1.2 });
        return db(harm(r.L, 110, st, N));
      });
      out[`C13 L0.6 +6 dB in x${os} out dB`] = r2(lv[1] - lv[0]);
    }
    // C11 : la bosse a RES 0.8 (coupure 1 kHz) contre le niveau (+12 dB), a LOAD 0 / 0.35 / 0.6 / 1 ; la perte de
    // graves a RES 0.95 (60 Hz re RES 0) a LOAD 0 et 1
    for (const L of [0, 0.35, 0.6, 1]) {
      const g = [0.05, 0.2].map((amp) => probeGains(ctx, file, os, { cutoff: 1000, res: 0.8, load: L, osc1: amp }, [60, 1000]));
      out[`C11 RES0.8 L${L} x${os} prominence change dB`] = r1(db(g[1][1] / g[1][0]) - db(g[0][1] / g[0][0]));
    }
    for (const L of [0, 1]) {
      const a = probeGains(ctx, file, os, { cutoff: 1000, res: 0.95, load: L, osc1: 0.2 }, [60])[0];
      const b = probeGains(ctx, file, os, { cutoff: 1000, res: 0, load: L, osc1: 0.2 }, [60])[0];
      out[`C11 RES0.95 L${L} x${os} bass loss dB`] = r2(db(a / b));
    }
    // C15 : filtre ferme (300 Hz, RES 0.3), deux scies C2 : centroide et crete contre LOAD 0
    {
      const cen = (r) => {
        const S = spectrum(r.L, 65536, st);
        let a = 0;
        let b = 0;
        for (let i = 1; i < S.pow.length; i += 1) {
          if (S.f[i] > 20000) break;
          a += S.f[i] * S.pow[i];
          b += S.pow[i];
        }
        return a / b;
      };
      const ref = render({ file, os, params: { ...ctx.LAB, wave1: 2, osc1: 0.62, osc2: 0.62, wave2: 2, tune2: 0, fine2: 7, cutoff: 300, res: 0.3, load: 0 }, notes: [held(36)], seconds: 1.5 });
      const c0 = cen(ref);
      const s0 = stats(ref.L, st);
      for (const L of LOADS.filter((x) => x > 0)) {
        const r = render({ file, os, params: { ...ctx.LAB, wave1: 2, osc1: 0.62, osc2: 0.62, wave2: 2, tune2: 0, fine2: 7, cutoff: 300, res: 0.3, load: L }, notes: [held(36)], seconds: 1.5 });
        const s1 = stats(r.L, st);
        out[`C15 L${L} x${os} centroid ratio`] = r2(cen(r) / c0);
        out[`C15 L${L} x${os} crest re L0 dB`] = r2(db(s1.peak / s1.rms) - db(s0.peak / s0.rms));
      }
    }
    // C16 et Q5 : INIT et DARK DISCO en doubles croches, sonie contre LOAD 0 ; continu et sous 20 Hz a LOAD 1
    {
      const step = 60 / 124 / 4;
      const notes = Array.from({ length: 32 }, (_, k) => ({ midi: 54 + ((k * 7) % 12), time: 0.05 + k * step, gate: 0.5 * step, accent: [1, 0.8, 0.92, 1.12][k % 4], from: null }));
      const dd = ctx.presets.find((x) => x.name === 'DARK DISCO');
      for (const [nm, base] of [['INIT', ctx.DEF], ['DARK DISCO', dd ? dd.engine : ctx.DEF]]) {
        const l0 = render({ file, os, params: { ...base, load: 0, outLevel: 0.25 }, notes, seconds: 0.05 + 32 * step + 0.3 });
        const ref = loudness(l0.L, l0.R);
        for (const L of LOADS.filter((x) => x > 0)) {
          const r = render({ file, os, params: { ...base, load: L, outLevel: 0.25 }, notes, seconds: 0.05 + 32 * step + 0.3 });
          out[`C16 ${nm} L${L} x${os} LU re L0`] = r2(loudness(r.L, r.R) - ref);
          if ((L === 1 || L === LOADS[1]) && nm === 'INIT') {
            for (const [tag, rr] of [['L0', l0], [`L${L}`, r]]) {
              if (tag === 'L0' && L !== 1) continue;
              let mx = 0;
              for (let s0 = 0; s0 + SR <= rr.L.length; s0 += SR / 4) mx = Math.max(mx, Math.abs(stats(rr.L, s0, s0 + SR).mean));
              out[`Q5 INIT ${tag} x${os} worst 1 s mean`] = Number(mx.toExponential(2));
              const S = spectrum(rr.L, 65536, 0);
              let lo = 0;
              let tot = 0;
              for (let i = 1; i < S.pow.length; i += 1) {
                tot += S.pow[i];
                if (S.f[i] < 20) lo += S.pow[i];
              }
              out[`Q5 INIT ${tag} x${os} below 20 Hz dB re total`] = r1(db10(lo / tot));
            }
          }
          if (false) {
            let mx = 0;
            for (let s0 = 0; s0 + SR <= r.L.length; s0 += SR / 4) mx = Math.max(mx, Math.abs(stats(r.L, s0, s0 + SR).mean));
            out[`Q5 INIT L1 x${os} worst 1 s mean`] = Number(mx.toExponential(2));
            const S = spectrum(r.L, 65536, 0);
            let lo = 0;
            let tot = 0;
            for (let i = 1; i < S.pow.length; i += 1) {
              tot += S.pow[i];
              if (S.f[i] < 20) lo += S.pow[i];
            }
            out[`Q5 INIT L1 x${os} below 20 Hz dB re total`] = r1(db10(lo / tot));
          }
        }
      }
    }
    // Le punch : un accord pince (3 notes, attaque 1 ms, decroissance 150 ms), RMS 0-10 ms sur 30-120 ms
    {
      const notes = [54, 58, 61].map((m) => held(m, 0.4, 0.05));
      const pun = (L) => {
        const r = render({ file, os, params: { ...ctx.DEF, load: L, aA: 0.001, aD: 0.15, aS: 0.2, fA: 0.001, fD: 0.15, fS: 0.3, drift: 0, outLevel: 0.25 }, notes, seconds: 0.6 });
        const t0 = Math.round(0.05 * SR);
        const a = stats(r.L, t0, t0 + Math.round(0.01 * SR)).rms;
        const b = stats(r.L, t0 + Math.round(0.03 * SR), t0 + Math.round(0.12 * SR)).rms;
        return db(a / b);
      };
      const p0 = pun(0);
      out[`punch L0 x${os} dB`] = r2(p0);
      for (const L of LOADS.filter((x) => x > 0)) out[`punch L${L} x${os} re L0 dB`] = r2(pun(L) - p0);
    }
    // Q1 : scie C7 / C8 ouverte a LOAD 0.35 et 1
    for (const L of [0.35, 1]) {
      for (const m of [96, 108]) {
        const r = render({ file, os, params: { ...ctx.LAB, wave1: 2, osc1: 0.62, load: L, cutoff: 21600 }, notes: [held(m)], seconds: 1.6 });
        out[`Q1 saw ${m} L${L} x${os} purity`] = r1(harmonicSplit(r.L, [midiHz(m)]).purity);
      }
    }
    // La reponse ouverte (HP, presque brut) a LOAD 0.25 contre LOAD 0, la forme (re 1 kHz : le gain de LOAD retire)
    {
      const gg = [1000, 10000, 15000].map((f) => [0, 0.25].map((L) => {
        const r = render({ file, os, params: { ...ctx.LAB, fmode: 3, cutoff: 20, wave1: 0, osc1: 0.02, load: L }, notes: [held(hzMidi(f))], seconds: 0.6 });
        return db(harm(r.L, f, Math.round(0.25 * SR), Math.round(0.3 * SR)));
      }));
      out[`resp L0.25 gain at 1 kHz x${os} dB`] = r2(gg[0][1] - gg[0][0]);
      out[`resp 10 kHz L0.25 re L0 re 1 kHz x${os} dB`] = r2(gg[1][1] - gg[1][0] - (gg[0][1] - gg[0][0]));
      out[`resp 15 kHz L0.25 re L0 re 1 kHz x${os} dB`] = r2(gg[2][1] - gg[2][0] - (gg[0][1] - gg[0][0]));
    }
  }
  return out;
}

/**
 * S13 (2026-10-23, essaye puis retire : le moteur n'a pas FEEDBACK) : arpege de scies (coupure 800 Hz, RES 0.6) a LOAD
 * 1 contre 0.6 (bande 60-150 Hz, la bosse), pas de cycle limite (sortie 1 s apres la note, LOAD 1, OVERDRIVE 0 et 1,
 * RES 0.6 et 0.85), la pire raie sous 40 Hz, Q1 a LOAD 1, le cas extreme (LOAD 1, RES 1, OVERDRIVE 1) borne.
 */
async function fb(ctx, file) {
  const out = {};
  const step = 60 / 124 / 4;
  const notes = Array.from({ length: 32 }, (_, k) => ({ midi: 42 + ((k * 7) % 12), time: 0.05 + k * step, gate: 0.6 * step, accent: [1, 0.8, 0.92, 1.12][k % 4], from: null }));
  const T = 0.05 + 32 * step + 0.3;
  for (const os of PATHS) {
    const base = { ...ctx.LAB, wave1: 2, osc1: 0.62, osc2: 0.62, wave2: 2, fine2: 7, cutoff: 800, res: 0.6, aA: 0.002, aD: 0.3, aS: 0.6, aR: 0.08, fA: 0.002, fD: 0.3, fS: 1, envOct: 0, outLevel: 0.25 };
    const bands = {};
    for (const L of [0.6, 1]) {
      const r = render({ file, os, params: { ...base, load: L }, notes, seconds: T });
      bands[L] = thirdBands(r.L, r.R, Math.round(0.05 * SR));
      if (L === 1) {
        const S = spectrum(r.L, 65536, 0);
        let lo = 0;
        let top = 0;
        for (let i = 1; i < S.amp.length; i += 1) {
          top = Math.max(top, S.amp[i]);
          if (S.f[i] < 40 && S.f[i] > 2) lo = Math.max(lo, S.amp[i]);
        }
        out[`L1 x${os} worst line under 40 Hz dBc`] = r1(db(lo / top));
      }
    }
    const e = (b, lo, hi) => db10(THIRDS.reduce((acc, f, i) => (f >= lo && f <= hi ? acc + Math.pow(10, b[i] / 10) : acc), 0));
    out[`L1 re L0.6 x${os} 60-150 Hz dB`] = r2(e(bands[1], 60, 150) - e(bands[0.6], 60, 150));
    const prom = (b) => e(b, 630, 1000) - e(b, 250, 400);
    out[`L1 re L0.6 x${os} peak prominence dB`] = r2(prom(bands[1]) - prom(bands[0.6]));
    let worst = -Infinity;
    for (const od of [0, 1]) {
      for (const res of [0.6, 0.85]) {
        const r = render({ file, os, params: { ...base, load: 1, drive: od, res, aR: 0.05 }, notes: [held(42, 0.3, 0.05)], seconds: 1.6 });
        worst = Math.max(worst, db(stats(r.L, Math.round(1.35 * SR), Math.round(1.6 * SR)).peak + 1e-30));
      }
    }
    out[`L1 x${os} peak 1 s after the note dBFS`] = r1(worst);
    const q = render({ file, os, params: { ...ctx.LAB, wave1: 2, osc1: 0.62, load: 1, cutoff: 21600 }, notes: [held(96)], seconds: 1.6 });
    out[`Q1 saw C7 L1 x${os} purity`] = r1(harmonicSplit(q.L, [midiHz(96)]).purity);
    const x = render({ file, os, params: { ...ctx.DEF, load: 1, res: 1, drive: 1, osc1: 1, osc2: 1, outLevel: 0.25 }, notes: [held(42, 2), held(49, 2)], seconds: 2.5 });
    out[`Q7 extreme x${os} peak dBFS`] = r1(db(stats(x.L).peak));
    out[`Q7 extreme x${os} heals`] = x.proc.heals;
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
      // Les notes basses s'installent lentement (S7) : 9 s sous C3
      const secs = midi < 48 ? 9 : 3.5;
      const r = render({ file, os, params: { ...ctx.LAB, noise: 0.003, res: 1, keyTrack: 1, cutoff: midiHz(54) }, notes: [held(midi, 20)], seconds: secs });
      const st = Math.round((secs - 1.3) * SR);
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
 * SPACE (2026-10-23, S17) : les deux passe-bas du Voyager (la gauche 2^-s, la droite 2^s). L'ecart des coupures (sur
 * du bruit, RES 0 : la frequence ou chaque cote tombe de 12 dB sous son plateau) contre 2^(2s), et le rapport des
 * centroides d'un arpege de scies (pour memoire : un centroide ne suit pas la coupure en proportion) ; la somme mono
 * (Q11) a SPACE 0.5 et 1, RES 0 et 0.8 ; BASS MONO 120 Hz (la correlation sous 120 Hz) ; SPACE 0 -> 1 sous une note
 * resonante (Q4 : le pire niveau sur 10 ms contre celui d'avant).
 */
async function space(ctx, file) {
  const out = {};
  const P = ctx.M.params;
  const base = { ...ctx.DEF, width: 0, wide: 0, outLevel: 0.3 };
  const step = 60 / 124 / 4;
  const arp = Array.from({ length: 32 }, (_, k) => ({ midi: [54, 57, 61, 64][k % 4] + (k % 8 >= 4 ? 12 : 0), time: 0.05 + k * step, gate: 0.6 * step, accent: 1, from: null }));
  const secs = 0.05 + 32 * step + 0.5;
  const st = Math.round(0.05 * SR);
  const avgSpec = (x, start) => {
    const N = 16384;
    const acc = new Float64Array(N / 2 + 1);
    let segs = 0;
    for (let s0 = start; s0 + N <= x.length; s0 += N / 2) {
      const sp = spectrum(x, N, s0).pow;
      for (let k = 0; k <= N / 2; k += 1) acc[k] += sp[k];
      segs += 1;
    }
    for (let k = 0; k <= N / 2; k += 1) acc[k] /= Math.max(1, segs);
    return { acc, N };
  };
  const centroid = (x) => {
    const { acc, N } = avgSpec(x, st);
    let a = 0;
    let b = 0;
    for (let k = Math.ceil((20 * N) / SR); k <= Math.floor((20000 * N) / SR); k += 1) {
      a += ((k * SR) / N) * acc[k];
      b += acc[k];
    }
    return a / b;
  };
  // La coupure d'un cote : lisse au tiers d'octave, le plateau (100 a 200 Hz), puis la premiere frequence 12 dB dessous
  const knee = (x) => {
    const { acc, N } = avgSpec(x, Math.round(0.3 * SR));
    const band = (f) => {
      const lo = Math.ceil(((f / Math.pow(2, 1 / 12)) * N) / SR);
      const hi = Math.floor(((f * Math.pow(2, 1 / 12)) * N) / SR);
      let e = 0;
      for (let k = lo; k <= hi; k += 1) e += acc[k];
      return e / Math.max(1, hi - lo + 1);
    };
    let plat = 0;
    for (let f = 100; f <= 200; f *= Math.pow(2, 1 / 12)) plat += band(f);
    plat /= 13;
    for (let f = 200; f < 20000; f *= Math.pow(2, 1 / 48)) if (db10(band(f) / plat) < -12) return f;
    return 20000;
  };
  for (const os of PATHS) {
    for (const s of [0.25, 0.5, 1]) {
      const noise = { ...base, osc1: 0, osc2: 0, sub: 0, noise: 0.8, res: 0, envOct: 0, cutoff: 800, keyTrack: 0, drift: 0, space: s };
      const r = render({ file, os, params: noise, notes: [held(60, 4)], seconds: 2.5, seed: 3 });
      const kl = knee(r.L);
      const kr = knee(r.R);
      out[`noise x${os} SPACE ${s} knee L / R Hz`] = `${Math.round(kl)} / ${Math.round(kr)}`;
      out[`noise x${os} SPACE ${s} knee ratio (target ${r2(Math.pow(2, 2 * s))})`] = r2(kr / kl);
      const a = render({ file, os, params: { ...base, cutoff: P.cutoffHz(0.4), space: s }, notes: arp, seconds: secs });
      out[`saw arp CUTOFF 0.4 x${os} SPACE ${s} centroid ratio R/L`] = r2(centroid(a.R) / centroid(a.L));
    }
    for (const s of [0.5, 1]) {
      for (const res of [0, 0.8]) {
        const r = render({ file, os, params: { ...base, cutoff: P.cutoffHz(0.4), res, space: s, width: 0.22 }, notes: arp, seconds: secs });
        const M = new Float32Array(r.L.length);
        for (let i = 0; i < M.length; i += 1) M[i] = 0.5 * (r.L[i] + r.R[i]);
        const lst = loudness(r.L, r.R, st);
        const lm = loudness(M, M, st);
        const bl = thirdBands(r.L, r.L, st);
        const br = thirdBands(r.R, r.R, st);
        const bm = thirdBands(r.L, r.R, st);
        let notch = 0;
        for (let i = 0; i < bm.length; i += 1) {
          if (THIRDS[i] < 100 || THIRDS[i] > 5000) continue;
          notch = Math.min(notch, bm[i] - db10(0.5 * (Math.pow(10, bl[i] / 10) + Math.pow(10, br[i] / 10))));
        }
        out[`Q11 x${os} SPACE ${s} RES ${res} mono re stereo LU`] = r2(lm - lst);
        out[`Q11 x${os} SPACE ${s} RES ${res} deepest notch dB`] = r1(notch);
      }
    }
    // BASS MONO 120 Hz : la chaine du site (audio/synth.ts build : le haut de chaque cote par deux passe-haut de
    // Butterworth, le bas de la somme mono par deux passe-bas, a 120 Hz), puis la correlation sous 120 Hz
    {
      const r = render({ file, os, params: { ...base, cutoff: P.cutoffHz(0.4), res: 0.5, space: 1 }, notes: arp.map((n) => ({ ...n, midi: n.midi - 24 })), seconds: secs });
      const bq = (x, f, hp) => {
        // Un biquad de Butterworth (Q 0.7071, celui de BiquadFilterNode), bilineaire
        const w0 = (2 * Math.PI * f) / SR;
        const al = Math.sin(w0) / (2 * Math.SQRT1_2);
        const cw = Math.cos(w0);
        const b0 = hp ? (1 + cw) / 2 : (1 - cw) / 2;
        const b1 = hp ? -(1 + cw) : 1 - cw;
        const a0 = 1 + al;
        const a1 = -2 * cw;
        const a2 = 1 - al;
        const y = new Float64Array(x.length);
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        for (let i = 0; i < x.length; i += 1) {
          const xi = x[i];
          const yi = (b0 * xi + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2) / a0;
          x2 = x1;
          x1 = xi;
          y2 = y1;
          y1 = yi;
          y[i] = yi;
        }
        return y;
      };
      const M = new Float64Array(r.L.length);
      for (let i = 0; i < M.length; i += 1) M[i] = 0.5 * (r.L[i] + r.R[i]);
      const lowM = bq(bq(M, 120, false), 120, false);
      const hl = bq(bq(r.L, 120, true), 120, true);
      const hr = bq(bq(r.R, 120, true), 120, true);
      const oL = hl.map((v, i) => v + lowM[i]);
      const oR = hr.map((v, i) => v + lowM[i]);
      const corr = (a, b) => {
        let sa = 0, sb = 0, sab = 0;
        for (let i = st; i < a.length; i += 1) {
          sa += a[i] * a[i];
          sb += b[i] * b[i];
          sab += a[i] * b[i];
        }
        return Math.round((1000 * sab) / Math.sqrt(sa * sb)) / 1000;
      };
      out[`BASS MONO 120 Hz x${os} SPACE 1 correlation < 120 Hz`] = corr(bq(bq(oL, 120, false), 120, false), bq(bq(oR, 120, false), 120, false));
      out[`no BASS MONO x${os} SPACE 1 correlation < 120 Hz (for reference)`] = corr(bq(bq(r.L, 120, false), 120, false), bq(bq(r.R, 120, false), 120, false));
    }
    // Q4 : SPACE 0 -> 1 en plein son (une note tenue, RES 0.8, coupure 600 Hz) : le pire niveau sur 10 ms apres
    {
      const pp = { ...base, cutoff: 600, res: 0.8, envOct: 0, space: 0 };
      const r = render({ file, os, params: pp, notes: [held(48, 4)], seconds: 2.5, seed: 7, onBlock: (f, proc) => {
        if (f === Math.round(1.2 * SR / 128) * 128) proc.onMsg({ type: 'params', params: { ...pp, space: 1 } });
      } });
      const win = Math.round(0.01 * SR);
      const lvl = (a, b) => {
        let e = 0;
        for (let i = a; i < b; i += 1) e += r.L[i] * r.L[i] + r.R[i] * r.R[i];
        return db10(e / (b - a));
      };
      const before = lvl(Math.round(0.8 * SR), Math.round(1.2 * SR));
      let worst = -Infinity;
      for (let a = Math.round(1.2 * SR); a + win < Math.round(2.4 * SR); a += win / 2) worst = Math.max(worst, lvl(a, a + win));
      out[`Q4 x${os} SPACE 0 -> 1, RES 0.8: worst 10 ms re before dB`] = r1(worst - before);
    }
  }
  return out;
}

/**
 * POLARITY (2026-10-23, S18, C22f) : NEG retourne le contour. La coupure de la note (la tangente de l'echelle, lue a
 * chaque bloc) en POS et en NEG contre celle sans enveloppe : log2(POS / 0) + log2(NEG / 0) doit rester a 0.01 octave de
 * 0, pour une enveloppe de 1 a 5 octaves (la coupure 657 Hz : +/-5 octaves tiennent entre 20 Hz et la butee) ; MS-10 de
 * meme. Au-dela, la butee (20 Hz ou 0.45 du contexte) coupe le miroir : son ecart est donne.
 */
async function fpol(ctx, file) {
  const out = {};
  const sr0 = SR;
  for (const os of PATHS) {
    for (const fmode of [0, 4]) {
      for (const oct of [1, 2, 3, 4, 5, 6]) {
        const run = (pol, envOct) => {
          const fcs = [];
          const pp = { ...ctx.DEF, cutoff: 657, res: 0, envOct, fpol: pol, fmode, drift: 0, keyTrack: 0, fA: 0.05, fD: 0.6, fS: 0, accFlt: 0, outLevel: 0.3 };
          render({ file, os, params: pp, notes: [held(60, 2)], seconds: 1.2, seed: 9, onBlock: (f, proc) => {
            const v = proc.voices.find((x) => x.on);
            if (!v) return;
            const g = fmode === 4 ? v.x[27] : v.g;
            if (g > 0) fcs.push((Math.atan(g) * sr0 * os) / Math.PI);
          } });
          return fcs;
        };
        const z = run(0, 0);
        const a = run(0, oct);
        const b = run(1, oct);
        let worst = 0;
        let peak = 0;
        for (let i = 8; i < Math.min(z.length, a.length, b.length); i += 1) {
          const e = Math.log2(a[i] / z[i]) + Math.log2(b[i] / z[i]);
          if (Math.abs(e) > Math.abs(worst)) worst = e;
          peak = Math.max(peak, Math.log2(a[i] / z[i]));
        }
        out[`x${os} ${fmode === 4 ? 'MS-10' : 'MOOG'} env ${oct} oct (peak +${r2(peak)}): POS + NEG oct`] = Math.round(worst * 10000) / 10000;
      }
    }
  }
  return out;
}

/**
 * L'escalier de la coupure (2026-10-23, S19 ; measure t13 A) : CUTOFF de 1 a 4 kHz en 1.2 s sur un filtre en
 * auto-oscillation (RES 1), quatre facons de l'envoyer (smooth : une valeur par bloc ; ui60 : un glisser a 60 Hz ; cc7_fast
 * / cc7_slow : des pas MIDI de 1/127 toutes les 13 / 40 ms). La hauteur de l'oscillation (passages par zero d'un
 * passe-bande 700 Hz - 6 kHz, par fenetres de 2 ms) : son ecart au chemin de smooth, sans sa tendance (la moyenne
 * glissante de 0.2 s : l'ondulation, au pire et efficace), et le retard sur le chemin du potard (ms).
 */
async function zip(ctx, file) {
  const out = {};
  const P = ctx.M.params;
  const knobOfHz = (hz) => Math.log2(hz / 30) / 9.3;
  const t0 = 0.8;
  const t1 = 2.0;
  const a = knobOfHz(1000);
  const b = knobOfHz(4000);
  const auto = (kind) => {
    let last = null;
    let lastSent = -1e9;
    return (t) => {
      if (t < t0) return null;
      const u = Math.min(1, (t - t0) / (t1 - t0));
      let v = a + (b - a) * u;
      if (kind === 'smooth') return v;
      if (kind === 'ui60') {
        if (t - lastSent < 1 / 60 && u < 1) return null;
        lastSent = t;
        return v;
      }
      const per = kind === 'cc7_fast' ? 0.013 : 0.04;
      v = Math.round(v * 127) / 127;
      if (v === last || (t - lastSent < per && u < 1)) return null;
      last = v;
      lastSent = t;
      return v;
    };
  };
  const bq = (x, f, hp) => {
    const w0 = (2 * Math.PI * f) / SR;
    const al = Math.sin(w0) / (2 * Math.SQRT1_2);
    const cw = Math.cos(w0);
    const b0 = hp ? (1 + cw) / 2 : (1 - cw) / 2;
    const b1 = hp ? -(1 + cw) : 1 - cw;
    const a0 = 1 + al;
    const a1 = -2 * cw;
    const a2 = 1 - al;
    const y = new Float64Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i += 1) {
      const xi = x[i];
      const yi = (b0 * xi + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1;
      x1 = xi;
      y2 = y1;
      y1 = yi;
      y[i] = yi;
    }
    return y;
  };
  const FR = 96;
  const pitch = (x) => {
    const y = bq(bq(bq(bq(x, 700, true), 700, true), 6000, false), 6000, false);
    const nF = Math.floor(y.length / FR);
    const sum = new Float64Array(nF);
    const cnt = new Float64Array(nF);
    let prev = -1;
    for (let i = 1; i < y.length; i += 1) {
      if (y[i - 1] < 0 && y[i] >= 0) {
        const tz = i - 1 + -y[i - 1] / (y[i] - y[i - 1]);
        if (prev >= 0) {
          const f = SR / (tz - prev);
          const k = Math.floor((0.5 * (tz + prev)) / FR);
          if (k < nF) {
            sum[k] += f;
            cnt[k] += 1;
          }
        }
        prev = tz;
      }
    }
    return Array.from(sum, (s0, k) => (cnt[k] ? 1200 * Math.log2(s0 / cnt[k] / 1000) : NaN));
  };
  for (const os of PATHS) {
    const paths = {};
    for (const kind of ['smooth', 'ui60', 'cc7_fast', 'cc7_slow']) {
      const f = auto(kind);
      const pp = { ...ctx.LAB, noise: 0.003, res: 1, cutoff: 1000, outLevel: 0.3 };
      const r = render({ file, os, params: pp, notes: [held(54, 30)], seconds: 2.4, seed: 4, onBlock: (fr, proc) => {
        const v = f(fr / SR);
        if (v !== null) proc.onMsg({ type: 'params', params: { ...proc.p, cutoff: P.cutoffHz(v) } });
      } });
      paths[kind] = pitch(r.L);
    }
    const ref = paths.smooth;
    const k0 = Math.ceil(((t0 + 0.05) * SR) / FR);
    const k1 = Math.floor(((t1 - 0.05) * SR) / FR);
    // Le chemin du potard (la coupure demandee), en cents re 1 kHz ; sa pente
    const ideal = (k) => {
      const t = ((k + 0.5) * FR) / SR;
      const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
      return 1200 * Math.log2(P.cutoffHz(a + (b - a) * u) / 1000);
    };
    const slope = (ideal(k1) - ideal(k0)) / (((k1 - k0) * FR) / SR);
    for (const [kind, c] of Object.entries(paths)) {
      const dev = [];
      for (let k = k0; k <= k1; k += 1) dev.push(c[k] - ref[k]);
      const W = 100;
      let worst = 0;
      let e2 = 0;
      let n = 0;
      // cc7_slow : a partir de son second message (le premier pas d'un geste est un vrai pas)
      const from = kind === 'cc7_slow' ? Math.ceil((0.08 * SR) / FR) : 0;
      for (let i = Math.max(W / 2, from); i < dev.length - W / 2; i += 1) {
        let m = 0;
        for (let j = i - W / 2; j < i + W / 2; j += 1) m += dev[j];
        const h = dev[i] - m / W;
        if (!Number.isFinite(h)) continue;
        worst = Math.max(worst, Math.abs(h));
        e2 += h * h;
        n += 1;
      }
      let lagC = 0;
      let nl = 0;
      for (let k = k0 + 25; k <= k1 - 25; k += 1) {
        if (!Number.isFinite(c[k])) continue;
        lagC += ideal(k) - c[k];
        nl += 1;
      }
      out[`x${os} ${kind} ripple cents (peak / rms)`] = `+/-${r1(worst)} / ${r1(Math.sqrt(e2 / Math.max(1, n)))}`;
      out[`x${os} ${kind} lag on the knob ms`] = r1((1000 * lagC) / nl / slope);
    }
  }
  return out;
}

/**
 * Tout en haut (2026-10-23, S21) : RANGE 2' et SEMI +7 (+31 demi-tons) sur les notes du haut, une scie seule, filtre
 * ouvert : la plus forte raie de 20 Hz a 20 kHz contre le fondamental d'une scie a 1 kHz (dB) ; et la note dont le
 * fondamental passe 18 kHz (la marche doit etre douce : son niveau note par note).
 */
async function top(ctx, file) {
  const out = {};
  for (const os of PATHS) {
    const base = { ...ctx.LAB, wave1: 2, osc1: 0.6, outLevel: 0.3 };
    const ref = render({ file, os, params: base, notes: [held(hzMidi(1000), 2)], seconds: 1.6 });
    const sr0 = spectrum(ref.L, 32768, Math.round(0.4 * SR));
    let nominal = 0;
    for (let k = 0; k < sr0.amp.length; k += 1) if (sr0.f[k] > 900 && sr0.f[k] < 1100) nominal = Math.max(nominal, sr0.amp[k]);
    for (const m of [101, 103, 105, 110, 116, 120, 124, 127]) {
      const r = render({ file, os, params: { ...base, tune1: 31 }, notes: [held(m, 2)], seconds: 1.6 });
      const sp = spectrum(r.L, 32768, Math.round(0.4 * SR));
      let worst = 0;
      let at = 0;
      for (let k = 0; k < sp.amp.length; k += 1) {
        if (sp.f[k] < 20 || sp.f[k] > 20000) continue;
        if (sp.amp[k] > worst) {
          worst = sp.amp[k];
          at = sp.f[k];
        }
      }
      const f0 = midiHz(m + 31);
      out[`x${os} note ${m} + 31 (f0 ${Math.round(f0)} Hz): strongest line dB re nominal (Hz)`] = `${r1(db(worst / nominal))} (${Math.round(at)})`;
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
    // Le meme sur les fenetres a moins de 40 dB de la plus forte (2026-10-23, S19 : les pires ecarts ci-dessus tombent
    // dans des fenetres 57 a 100 dB sous la plus forte, entre deux fronts de la scie, ou un rien fait un rapport)
    const f40 = Math.max(...b) * 1e-4;
    let w40 = -Infinity;
    for (let i = 0; i < a.length; i += 1) w40 = Math.max(w40, db10((a[i] + f40) / (b[i] + f40)));
    out[`${id} worst 2ms HF within 40 dB of the loudest, MIDI steps re smooth dB`] = r1(w40);
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
    // 2026-10-23 (controle qualite F5) : un arpege avec les reglages du bus et des voix ajoutes (LOAD, SPACE, WIDE, OD)
    ['arp LOAD SPACE WIDE OD 30 s', { ...ctx.DEF, load: 0.5, space: 0.6, wide: 0.5, drive: 0.4, outLevel: 0.3 }, arp(42), 30],
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

const SUITES = { purity, p1a, sweep, selfosc, sync, syncwave, ms10, load, fb, tri, timbre, resp, level, pclick, silence, garbage, q2, q10, c3c5, c18, c22h, q11, space, fpol, zip, top, q3, gc };
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
