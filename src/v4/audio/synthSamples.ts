/**
 * Banque d'echantillons electroniques synthetises a la demande pour le MM-RYTM :
 * couvre les 8 familles (bd, sd, ch, oh, cp, tom, ht, cy) avec des sons de
 * batterie, de percussions, de basses (303, Reese, EBM, FM) et d'accords/stabs
 * (Dub Techno, Detroit, Rave, Italo, Trance, IDM) sans dependre de fichiers
 * externes volumineux.
 */

import type { SamplePcm } from './sampledsp';
import type { KitSample, SampleFamily } from './samples';

interface SynthSampleDef {
  family: SampleFamily;
  file: string;
  label: string;
  dur: number;
  gen: (sr: number, len: number, r: () => number) => [Float32Array, Float32Array];
}

const TAU = Math.PI * 2;

function rng(seed: number): () => number {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1000000) / 1000000;
  };
}

function tanh(x: number): number {
  return Math.tanh(x);
}

function fadeEnd(buf: Float32Array, sr: number, sec = 0.025): void {
  const n = Math.min(buf.length, Math.round(sr * sec));
  for (let i = 0; i < n; i += 1) {
    const k = buf.length - n + i;
    buf[k] *= 0.5 * (1 + Math.cos((Math.PI * (i + 1)) / n));
  }
}

function normPeak(L: Float32Array, R: Float32Array, peak = 0.85): [Float32Array, Float32Array] {
  let m = 1e-6;
  for (let i = 0; i < L.length; i += 1) {
    const a = Math.abs(L[i]);
    const b = Math.abs(R[i]);
    if (a > m) m = a;
    if (b > m) m = b;
  }
  const g = peak / m;
  for (let i = 0; i < L.length; i += 1) {
    L[i] *= g;
    R[i] *= g;
  }
  return [L, R];
}

const DEFS: readonly SynthSampleDef[] = [
  // BD : Kicks electroniques
  {
    family: 'bd',
    file: '90-909-Punch.wav',
    label: '909 PUNCH',
    dur: 0.55,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      let ph = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const f = 54 + 210 * Math.exp(-t / 0.005) + 32 * Math.exp(-t / 0.032);
        ph += f / sr;
        const env = (1 - Math.exp(-t / 0.0004)) * Math.exp(-t / 0.19);
        const click = (r() * 2 - 1) * Math.exp(-t / 0.0025) * 0.45;
        L[i] = tanh((Math.sin(TAU * ph) * env + click) * 1.9);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.9);
    },
  },
  {
    family: 'bd',
    file: '91-808-Sub-Boom.wav',
    label: '808 SUB BOOM',
    dur: 0.95,
    gen(sr, len) {
      const L = new Float32Array(len);
      let ph = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const f = 46 + 48 * Math.exp(-t / 0.012);
        ph += f / sr;
        const env = (1 - Math.exp(-t / 0.0006)) * Math.exp(-t / 0.42);
        L[i] = tanh(Math.sin(TAU * ph) * env * 1.35);
      }
      fadeEnd(L, sr, 0.05);
      return normPeak(L, new Float32Array(L), 0.9);
    },
  },
  {
    family: 'bd',
    file: '92-Warehouse-Rumble.wav',
    label: 'WAREHOUSE RUMBLE',
    dur: 0.72,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      let ph = 0;
      let lpL = 0;
      let lpR = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const f = 50 + 180 * Math.exp(-t / 0.0055);
        ph += f / sr;
        const body = Math.sin(TAU * ph) * Math.exp(-t / 0.16);
        const rumbleEnv = Math.max(0, t - 0.04) * Math.exp(-t / 0.18) * 14;
        lpL += 0.03 * ((r() * 2 - 1) * rumbleEnv + Math.sin(TAU * ph * 0.5) * rumbleEnv - lpL);
        lpR += 0.03 * ((r() * 2 - 1) * rumbleEnv + Math.cos(TAU * ph * 0.5) * rumbleEnv - lpR);
        L[i] = tanh((body + lpL * 0.55) * 1.8);
        R[i] = tanh((body + lpR * 0.55) * 1.8);
      }
      fadeEnd(L, sr, 0.04);
      fadeEnd(R, sr, 0.04);
      return normPeak(L, R, 0.88);
    },
  },
  {
    family: 'bd',
    file: '93-Hardgroove-Drive.wav',
    label: 'HARDGROOVE DRIVE',
    dur: 0.48,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      let ph = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const f = 58 + 240 * Math.exp(-t / 0.004) + 45 * Math.exp(-t / 0.025);
        ph += f / sr;
        const env = Math.exp(-t / 0.15);
        const punch = (r() * 2 - 1) * Math.exp(-t / 0.003) * 0.5;
        L[i] = tanh((Math.sin(TAU * ph) + 0.25 * Math.sin(TAU * ph * 2)) * env * 2.4 + punch);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.9);
    },
  },
  {
    family: 'bd',
    file: '94-Industrial-Slam.wav',
    label: 'INDUSTRIAL SLAM',
    dur: 0.65,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      let ph = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const f = 48 + 310 * Math.exp(-t / 0.004);
        ph += f / sr;
        const env = Math.exp(-t / 0.22);
        const grit = (r() * 2 - 1) * Math.exp(-t / 0.06) * 0.35;
        L[i] = tanh((Math.sin(TAU * ph) * env + grit) * 3.4);
      }
      fadeEnd(L, sr, 0.03);
      return normPeak(L, new Float32Array(L), 0.88);
    },
  },
  {
    family: 'bd',
    file: '95-Deep-House-Thump.wav',
    label: 'DEEP THUMP',
    dur: 0.5,
    gen(sr, len) {
      const L = new Float32Array(len);
      let ph = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const f = 52 + 125 * Math.exp(-t / 0.009);
        ph += f / sr;
        const env = (1 - Math.exp(-t / 0.0008)) * Math.exp(-t / 0.17);
        L[i] = tanh(Math.sin(TAU * ph) * env * 1.45);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.88);
    },
  },

  // SD : Snares et Rims
  {
    family: 'sd',
    file: '90-909-Crisp-Snare.wav',
    label: '909 CRISP',
    dur: 0.36,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      let p1 = 0;
      let p2 = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        p1 += (182 + 95 * Math.exp(-t / 0.007)) / sr;
        p2 += (338 + 80 * Math.exp(-t / 0.005)) / sr;
        const body = (Math.sin(TAU * p1) * Math.exp(-t / 0.055) + 0.55 * Math.sin(TAU * p2) * Math.exp(-t / 0.038)) * 0.85;
        const wire = (r() * 2 - 1) * Math.exp(-t / 0.105) * 0.9;
        L[i] = tanh((body + wire) * 1.6);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.85);
    },
  },
  {
    family: 'sd',
    file: '91-808-Tight-Snare.wav',
    label: '808 TIGHT',
    dur: 0.28,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      let p1 = 0;
      let p2 = 0;
      let hp = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        p1 += 238 / sr;
        p2 += 476 / sr;
        const n = r() * 2 - 1;
        hp = n - hp * 0.45;
        const body = Math.sin(TAU * p1) * Math.exp(-t / 0.045) + 0.55 * Math.sin(TAU * p2) * Math.exp(-t / 0.03);
        L[i] = tanh((body * 0.85 + hp * Math.exp(-t / 0.075) * 0.65) * 1.4);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.84);
    },
  },
  {
    family: 'sd',
    file: '92-Linndrum-Gated.wav',
    label: 'LINNDRUM GATE',
    dur: 0.34,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      let p1 = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        p1 += (195 + 110 * Math.exp(-t / 0.008)) / sr;
        const gate = t < 0.16 ? 1 : Math.exp(-(t - 0.16) / 0.025);
        const body = Math.sin(TAU * p1) * Math.exp(-t / 0.065);
        const roomL = (r() * 2 - 1) * Math.exp(-t / 0.18) * gate * 0.85;
        const roomR = (r() * 2 - 1) * Math.exp(-t / 0.18) * gate * 0.85;
        L[i] = tanh((body + roomL) * 1.7);
        R[i] = tanh((body + roomR) * 1.7);
      }
      fadeEnd(L, sr);
      fadeEnd(R, sr);
      return normPeak(L, R, 0.85);
    },
  },
  {
    family: 'sd',
    file: '93-Amen-Break-Snare.wav',
    label: 'AMEN BREAK',
    dur: 0.3,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      let p1 = 0;
      let p2 = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        p1 += (245 + 90 * Math.exp(-t / 0.006)) / sr;
        p2 += (510 + 70 * Math.exp(-t / 0.004)) / sr;
        const ring = Math.sin(TAU * p1) * Math.exp(-t / 0.07) + 0.5 * Math.sin(TAU * p2) * Math.exp(-t / 0.045);
        const snap = (r() * 2 - 1) * Math.exp(-t / 0.095) * 0.95;
        L[i] = tanh((ring + snap) * 2.1);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.86);
    },
  },
  {
    family: 'sd',
    file: '94-UKG-Rim-Snap.wav',
    label: 'UKG RIM SNAP',
    dur: 0.16,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      let p1 = 0;
      let p2 = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        p1 += 440 / sr;
        p2 += 1680 / sr;
        const rim = (Math.sin(TAU * p1) + 0.8 * Math.sin(TAU * p2)) * Math.exp(-t / 0.014);
        const click = (r() * 2 - 1) * Math.exp(-t / 0.006) * 0.6;
        L[i] = tanh((rim + click) * 2.2);
      }
      fadeEnd(L, sr, 0.015);
      return normPeak(L, new Float32Array(L), 0.82);
    },
  },
  {
    family: 'sd',
    file: '95-EBM-Metal-Snare.wav',
    label: 'EBM METAL',
    dur: 0.38,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      let p1 = 0;
      let p2 = 0;
      let p3 = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        p1 += 210 / sr;
        p2 += 565 / sr;
        p3 += 1180 / sr;
        const metal = (Math.sin(TAU * p1) + 0.6 * Math.sin(TAU * p2) + 0.4 * Math.sin(TAU * p3)) * Math.exp(-t / 0.065);
        const noise = (r() * 2 - 1) * Math.exp(-t / 0.13);
        L[i] = tanh((metal + noise) * 2.5);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.85);
    },
  },

  // CH : Closed Hats & Shakers
  {
    family: 'ch',
    file: '01-909-Closed-Hat.wav',
    label: '909 CLOSED',
    dur: 0.12,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      const hz = [310, 446, 588, 795, 845, 1180];
      let prev = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        let m = 0;
        for (let k = 0; k < 6; k += 1) m += Math.sin(TAU * hz[k] * t) >= 0 ? 1 : -1;
        const raw = (m / 6) * 0.55 + (r() * 2 - 1) * 0.7;
        const hp = raw - prev;
        prev = raw;
        L[i] = hp * Math.exp(-t / 0.026);
      }
      fadeEnd(L, sr, 0.015);
      return normPeak(L, new Float32Array(L), 0.72);
    },
  },
  {
    family: 'ch',
    file: '02-808-Tick-Hat.wav',
    label: '808 TICK',
    dur: 0.1,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      const hz = [205.3, 304.4, 369.6, 522.7, 540, 800];
      let prev = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        let m = 0;
        for (let k = 0; k < 6; k += 1) m += Math.sin(TAU * hz[k] * 2 * t) >= 0 ? 1 : -1;
        const raw = (m / 6) * 0.75 + (r() * 2 - 1) * 0.25;
        const hp = raw - prev;
        prev = raw;
        L[i] = hp * Math.exp(-t / 0.022);
      }
      fadeEnd(L, sr, 0.012);
      return normPeak(L, new Float32Array(L), 0.7);
    },
  },
  {
    family: 'ch',
    file: '03-Micro-Click-Hat.wav',
    label: 'MICRO CLICK',
    dur: 0.08,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      let prev = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const n = r() * 2 - 1;
        const hp = n - prev;
        prev = n;
        L[i] = (hp * Math.exp(-t / 0.009) + Math.sin(TAU * 4200 * t) * Math.exp(-t / 0.003)) * 0.9;
      }
      fadeEnd(L, sr, 0.01);
      return normPeak(L, new Float32Array(L), 0.68);
    },
  },
  {
    family: 'ch',
    file: '04-Afro-Shaker.wav',
    label: 'AFRO SHAKER',
    dur: 0.16,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      let pL = 0;
      let pR = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const env = Math.sin(Math.min(1, t / 0.022) * (Math.PI / 2)) * Math.exp(-Math.max(0, t - 0.015) / 0.032);
        const nL = r() * 2 - 1;
        const nR = r() * 2 - 1;
        L[i] = (nL - pL) * env;
        R[i] = (nR - pR) * env;
        pL = nL;
        pR = nR;
      }
      fadeEnd(L, sr, 0.015);
      fadeEnd(R, sr, 0.015);
      return normPeak(L, R, 0.68);
    },
  },
  {
    family: 'ch',
    file: '05-Jungle-Ghost-Hat.wav',
    label: 'JUNGLE GHOST',
    dur: 0.11,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      let prev = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const n = r() * 2 - 1 + 0.4 * Math.sin(TAU * 6800 * t);
        const hp = n - prev;
        prev = n;
        L[i] = hp * Math.exp(-t / 0.02);
      }
      fadeEnd(L, sr, 0.012);
      return normPeak(L, new Float32Array(L), 0.68);
    },
  },

  // OH : Open Hats & Rides
  {
    family: 'oh',
    file: '90-909-Open-Hat.wav',
    label: '909 OPEN',
    dur: 0.48,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      const hz = [310, 446, 588, 795, 845, 1180];
      let prev = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        let m = 0;
        for (let k = 0; k < 6; k += 1) m += Math.sin(TAU * hz[k] * 1.45 * t) >= 0 ? 1 : -1;
        const raw = (m / 6) * 0.55 + (r() * 2 - 1) * 0.65;
        const hp = raw - prev;
        prev = raw;
        L[i] = hp * (0.4 * Math.exp(-t / 0.06) + 0.6 * Math.exp(-t / 0.2));
      }
      fadeEnd(L, sr, 0.04);
      return normPeak(L, new Float32Array(L), 0.72);
    },
  },
  {
    family: 'oh',
    file: '91-808-Sizzle-Hat.wav',
    label: '808 SIZZLE',
    dur: 0.52,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      const hz = [205.3, 304.4, 369.6, 522.7, 540, 800];
      let prev = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        let m = 0;
        for (let k = 0; k < 6; k += 1) m += Math.sin(TAU * hz[k] * 2 * t) >= 0 ? 1 : -1;
        const raw = (m / 6) * 0.75 + (r() * 2 - 1) * 0.35;
        const hp = raw - prev;
        prev = raw;
        L[i] = hp * Math.exp(-t / 0.22);
      }
      fadeEnd(L, sr, 0.04);
      return normPeak(L, new Float32Array(L), 0.7);
    },
  },
  {
    family: 'oh',
    file: '92-Rave-Ride-Bell.wav',
    label: 'RAVE RIDE BELL',
    dur: 0.62,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      let prev = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const bell = Math.sin(TAU * 2840 * t) * Math.exp(-t / 0.14) + 0.5 * Math.sin(TAU * 4320 * t) * Math.exp(-t / 0.09);
        const n = r() * 2 - 1;
        const sizzle = (n - prev) * Math.exp(-t / 0.24) * 0.55;
        prev = n;
        L[i] = bell * 0.5 + sizzle;
      }
      fadeEnd(L, sr, 0.05);
      return normPeak(L, new Float32Array(L), 0.72);
    },
  },
  {
    family: 'oh',
    file: '93-House-Offbeat-Hat.wav',
    label: 'HOUSE OFFBEAT',
    dur: 0.36,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      let prev = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const n = (r() * 2 - 1) * 0.8 + 0.25 * Math.sin(TAU * 7600 * t);
        const hp = n - prev;
        prev = n;
        L[i] = hp * Math.exp(-t / 0.13);
      }
      fadeEnd(L, sr, 0.03);
      return normPeak(L, new Float32Array(L), 0.72);
    },
  },

  // CP : Claps & Snaps
  {
    family: 'cp',
    file: '01-909-Studio-Clap.wav',
    label: '909 STUDIO',
    dur: 0.34,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      const offs = [0, 0.0085, 0.017, 0.026];
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        let e = 0;
        for (let k = 0; k < 4; k += 1) {
          const u = t - offs[k];
          if (u >= 0) e += k < 3 ? Math.exp(-u / 0.004) : Math.exp(-u / 0.095);
        }
        L[i] = tanh((r() * 2 - 1) * e * 1.4);
        R[i] = tanh((r() * 2 - 1) * e * 1.4);
      }
      fadeEnd(L, sr);
      fadeEnd(R, sr);
      return normPeak(L, R, 0.82);
    },
  },
  {
    family: 'cp',
    file: '02-808-Handclap.wav',
    label: '808 HANDCLAP',
    dur: 0.38,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      const offs = [0, 0.011, 0.022, 0.033];
      let bp = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        let e = 0;
        for (let k = 0; k < 4; k += 1) {
          const u = t - offs[k];
          if (u >= 0) e += k < 3 ? Math.exp(-u / 0.0045) : Math.exp(-u / 0.13);
        }
        bp += 0.22 * ((r() * 2 - 1) - bp);
        L[i] = tanh(bp * e * 2.2);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.82);
    },
  },
  {
    family: 'cp',
    file: '03-Dark-Disco-Clap.wav',
    label: 'DARK DISCO',
    dur: 0.42,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      const offs = [0, 0.012, 0.025, 0.039];
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        let e = 0;
        for (let k = 0; k < 4; k += 1) {
          const u = t - offs[k];
          if (u >= 0) e += k < 3 ? Math.exp(-u / 0.005) : Math.exp(-u / 0.14);
        }
        const tone = Math.sin(TAU * 980 * t) * Math.exp(-t / 0.018) * 0.3;
        L[i] = tanh(((r() * 2 - 1) * e + tone) * 1.5);
        R[i] = tanh(((r() * 2 - 1) * e - tone) * 1.5);
      }
      fadeEnd(L, sr);
      fadeEnd(R, sr);
      return normPeak(L, R, 0.82);
    },
  },
  {
    family: 'cp',
    file: '04-Minimal-Finger-Snap.wav',
    label: 'FINGER SNAP',
    dur: 0.15,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      let ph = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        ph += (2100 - 700 * Math.min(1, t / 0.015)) / sr;
        const body = Math.sin(TAU * ph) * Math.exp(-t / 0.016);
        const pop = (r() * 2 - 1) * Math.exp(-t / 0.007) * 0.55;
        L[i] = tanh((body + pop) * 1.8);
      }
      fadeEnd(L, sr, 0.015);
      return normPeak(L, new Float32Array(L), 0.8);
    },
  },
  {
    family: 'cp',
    file: '05-Industrial-Whip.wav',
    label: 'INDUSTRIAL WHIP',
    dur: 0.36,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      let ph = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        ph += (3200 * Math.exp(-t / 0.022) + 280) / sr;
        const crack = (r() * 2 - 1) * Math.exp(-t / 0.085);
        L[i] = tanh((crack + 0.55 * Math.sin(TAU * ph) * Math.exp(-t / 0.05)) * 2.6);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.84);
    },
  },

  // TOM : Low Toms & Bass Synths (303, Reese, Donk, EBM)
  {
    family: 'tom',
    file: '01-909-Low-Tom.wav',
    label: '909 LOW TOM',
    dur: 0.42,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      let ph = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const f = 96 + 72 * Math.exp(-t / 0.042);
        ph += f / sr;
        const click = (r() * 2 - 1) * Math.exp(-t / 0.006) * 0.25;
        L[i] = tanh((Math.sin(TAU * ph) * Math.exp(-t / 0.16) + click) * 1.5);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.85);
    },
  },
  {
    family: 'tom',
    file: '02-808-Conga-Low.wav',
    label: '808 CONGA LOW',
    dur: 0.38,
    gen(sr, len) {
      const L = new Float32Array(len);
      let ph = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const f = 132 + 38 * Math.exp(-t / 0.015);
        ph += f / sr;
        L[i] = tanh(Math.sin(TAU * ph) * Math.exp(-t / 0.14) * 1.3);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.85);
    },
  },
  {
    family: 'tom',
    file: '03-Acid-303-Squelch.wav',
    label: 'ACID 303 SQUELCH',
    dur: 0.4,
    gen(sr, len) {
      const L = new Float32Array(len);
      let ph = 0;
      let y1 = 0;
      let y2 = 0;
      const f0 = 65.41; // C2
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        ph = (ph + f0 / sr) % 1;
        const saw = ph * 2 - 1;
        const cut = 260 + 2800 * Math.exp(-t / 0.065);
        const g = Math.min(0.75, (TAU * cut) / sr);
        const fb = 2.6 * (y1 - y2);
        y1 += g * (tanh(saw - fb) - y1);
        y2 += g * (y1 - y2);
        const env = (1 - Math.exp(-t / 0.0015)) * Math.exp(-t / 0.18);
        L[i] = tanh(y2 * env * 2.8);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.86);
    },
  },
  {
    family: 'tom',
    file: '04-Reese-Sub-Bass.wav',
    label: 'REESE SUB BASS',
    dur: 0.65,
    gen(sr, len) {
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      let p1 = 0;
      let p2 = 0.25;
      let p3 = 0.5;
      let lpL = 0;
      let lpR = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        p1 = (p1 + 55 / sr) % 1;
        p2 = (p2 + 55.45 / sr) % 1;
        p3 = (p3 + 54.55 / sr) % 1;
        const sL = (p1 * 2 - 1) + 0.7 * (p2 * 2 - 1) + 0.8 * Math.sin(TAU * p1);
        const sR = (p1 * 2 - 1) + 0.7 * (p3 * 2 - 1) + 0.8 * Math.sin(TAU * p1);
        lpL += 0.04 * (sL - lpL);
        lpR += 0.04 * (sR - lpR);
        const env = (1 - Math.exp(-t / 0.008)) * Math.exp(-t / 0.35);
        L[i] = tanh(lpL * env * 1.9);
        R[i] = tanh(lpR * env * 1.9);
      }
      fadeEnd(L, sr, 0.04);
      fadeEnd(R, sr, 0.04);
      return normPeak(L, R, 0.86);
    },
  },
  {
    family: 'tom',
    file: '05-Donk-FM-Bass.wav',
    label: 'FM DONK BASS',
    dur: 0.32,
    gen(sr, len) {
      const L = new Float32Array(len);
      const fc = 65.41;
      const fm = fc * 3;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const idx = 4.2 * Math.exp(-t / 0.045);
        const mod = Math.sin(TAU * fm * t) * idx;
        const env = (1 - Math.exp(-t / 0.001)) * Math.exp(-t / 0.14);
        L[i] = tanh(Math.sin(TAU * fc * t + mod) * env * 1.7);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.85);
    },
  },
  {
    family: 'tom',
    file: '06-EBM-Octave-Bass.wav',
    label: 'EBM OCTAVE BASS',
    dur: 0.28,
    gen(sr, len) {
      const L = new Float32Array(len);
      let ph = 0;
      let lp = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        ph = (ph + 65.41 / sr) % 1;
        const sq = ph < 0.42 ? 1 : -1;
        const saw = ((ph * 2) % 1) * 2 - 1;
        const g = 0.08 + 0.35 * Math.exp(-t / 0.04);
        lp += g * (0.6 * sq + 0.5 * saw - lp);
        const env = (1 - Math.exp(-t / 0.0008)) * Math.exp(-t / 0.12);
        L[i] = tanh(lp * env * 2.2);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.86);
    },
  },

  // HT : Hi Toms, Chords & Stabs (Dub Techno, Detroit, Rave, Italo, Afro)
  {
    family: 'ht',
    file: '01-909-Hi-Tom.wav',
    label: '909 HI TOM',
    dur: 0.34,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      let ph = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const f = 165 + 105 * Math.exp(-t / 0.035);
        ph += f / sr;
        const click = (r() * 2 - 1) * Math.exp(-t / 0.005) * 0.22;
        L[i] = tanh((Math.sin(TAU * ph) * Math.exp(-t / 0.13) + click) * 1.45);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.84);
    },
  },
  {
    family: 'ht',
    file: '02-Dub-Techno-Chord.wav',
    label: 'DUB TECHNO CHORD',
    dur: 0.78,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      const notes = [261.63, 311.13, 392.0, 466.16, 587.33]; // Cm9
      let lpL = 0;
      let lpR = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        let sL = 0;
        let sR = 0;
        for (let k = 0; k < notes.length; k += 1) {
          const p1 = (notes[k] * (1 + k * 0.0012) * t) % 1;
          const p2 = (notes[k] * (1 - k * 0.0012) * t + 0.3) % 1;
          sL += p1 * 2 - 1;
          sR += p2 * 2 - 1;
        }
        const echo = Math.exp(-t / 0.28) * (0.65 + 0.35 * Math.cos(TAU * 3.5 * t));
        const g = 0.035 + 0.12 * Math.exp(-t / 0.09);
        lpL += g * ((sL / 5 + (r() * 2 - 1) * 0.05) * echo - lpL);
        lpR += g * ((sR / 5 + (r() * 2 - 1) * 0.05) * echo - lpR);
        L[i] = tanh(lpL * 1.9);
        R[i] = tanh(lpR * 1.9);
      }
      fadeEnd(L, sr, 0.05);
      fadeEnd(R, sr, 0.05);
      return normPeak(L, R, 0.82);
    },
  },
  {
    family: 'ht',
    file: '03-Detroit-Minor-Stab.wav',
    label: 'DETROIT STAB',
    dur: 0.46,
    gen(sr, len) {
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      const notes = [293.66, 349.23, 440.0, 523.25]; // Dm7
      let lpL = 0;
      let lpR = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        let sL = 0;
        let sR = 0;
        for (let k = 0; k < notes.length; k += 1) {
          const f = notes[k] * (1 + 0.015 * Math.exp(-t / 0.02));
          sL += ((f * t) % 1) * 2 - 1;
          sR += ((f * 1.003 * t + 0.2) % 1) * 2 - 1;
        }
        const g = 0.05 + 0.28 * Math.exp(-t / 0.055);
        lpL += g * (sL / 4 - lpL);
        lpR += g * (sR / 4 - lpR);
        const env = (1 - Math.exp(-t / 0.002)) * Math.exp(-t / 0.18);
        L[i] = tanh(lpL * env * 2.1);
        R[i] = tanh(lpR * env * 2.1);
      }
      fadeEnd(L, sr);
      fadeEnd(R, sr);
      return normPeak(L, R, 0.84);
    },
  },
  {
    family: 'ht',
    file: '04-Rave-Hoover-Stab.wav',
    label: 'RAVE HOOVER',
    dur: 0.5,
    gen(sr, len) {
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      let p1 = 0;
      let p2 = 0;
      let p3 = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const bend = 1 + 0.35 * Math.sin(Math.min(Math.PI, t * 14));
        const f = 130.81 * bend;
        p1 = (p1 + f / sr) % 1;
        p2 = (p2 + (f * 1.009) / sr) % 1;
        p3 = (p3 + (f * 1.994) / sr) % 1;
        const pwm = 0.5 + 0.35 * Math.sin(TAU * 6 * t);
        const w1 = (p1 < pwm ? 1 : -1) + (p2 * 2 - 1);
        const w2 = (p2 < pwm ? 1 : -1) + (p3 * 2 - 1);
        const env = (1 - Math.exp(-t / 0.004)) * Math.exp(-t / 0.24);
        L[i] = tanh(w1 * env * 0.9);
        R[i] = tanh(w2 * env * 0.9);
      }
      fadeEnd(L, sr);
      fadeEnd(R, sr);
      return normPeak(L, R, 0.84);
    },
  },
  {
    family: 'ht',
    file: '05-Italo-Arp-Pluck.wav',
    label: 'ITALO PLUCK',
    dur: 0.26,
    gen(sr, len) {
      const L = new Float32Array(len);
      let ph = 0;
      let lp = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        ph = (ph + 261.63 / sr) % 1;
        const raw = (ph < 0.28 ? 1 : -1) + 0.6 * (ph * 2 - 1);
        const g = 0.06 + 0.4 * Math.exp(-t / 0.032);
        lp += g * (raw - lp);
        L[i] = tanh(lp * Math.exp(-t / 0.095) * 1.8);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.84);
    },
  },
  {
    family: 'ht',
    file: '06-Afro-Wood-Log.wav',
    label: 'AFRO WOOD LOG',
    dur: 0.22,
    gen(sr, len) {
      const L = new Float32Array(len);
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const v = Math.sin(TAU * 310 * t) * Math.exp(-t / 0.045) + 0.45 * Math.sin(TAU * 765 * t) * Math.exp(-t / 0.014);
        L[i] = tanh(v * 1.7);
      }
      fadeEnd(L, sr, 0.015);
      return normPeak(L, new Float32Array(L), 0.84);
    },
  },

  // CY : Cymbals, Cowbell, Siren, Glitch & Trance Lead
  {
    family: 'cy',
    file: '01-909-Crash-Cymbal.wav',
    label: '909 CRASH',
    dur: 0.95,
    gen(sr, len, r) {
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      const hz = [410, 608, 739, 1045, 1080, 1600];
      let pL = 0;
      let pR = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        let m = 0;
        for (let k = 0; k < 6; k += 1) m += Math.sin(TAU * hz[k] * t) >= 0 ? 1 : -1;
        const env = 0.45 * Math.exp(-t / 0.07) + 0.55 * Math.exp(-t / 0.42);
        const nL = (m / 6) * 0.45 + (r() * 2 - 1) * 0.55;
        const nR = (m / 6) * 0.45 + (r() * 2 - 1) * 0.55;
        L[i] = (nL - pL) * env;
        R[i] = (nR - pR) * env;
        pL = nL;
        pR = nR;
      }
      fadeEnd(L, sr, 0.06);
      fadeEnd(R, sr, 0.06);
      return normPeak(L, R, 0.72);
    },
  },
  {
    family: 'cy',
    file: '02-808-Cowbell.wav',
    label: '808 COWBELL',
    dur: 0.3,
    gen(sr, len) {
      const L = new Float32Array(len);
      let bp = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const s1 = Math.sin(TAU * 540 * t) >= 0 ? 1 : -1;
        const s2 = Math.sin(TAU * 800 * t) >= 0 ? 1 : -1;
        const env = 0.65 * Math.exp(-t / 0.018) + 0.35 * Math.exp(-t / 0.14);
        bp += 0.25 * ((s1 + s2) * 0.5 - bp);
        L[i] = tanh(bp * env * 1.9);
      }
      fadeEnd(L, sr);
      return normPeak(L, new Float32Array(L), 0.78);
    },
  },
  {
    family: 'cy',
    file: '03-Dub-Siren-FX.wav',
    label: 'DUB SIREN FX',
    dur: 0.7,
    gen(sr, len) {
      const L = new Float32Array(len);
      let ph = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const f = 580 + 240 * (Math.sin(TAU * 5.5 * t) >= 0 ? 1 : -1);
        ph += f / sr;
        const env = (1 - Math.exp(-t / 0.005)) * Math.exp(-t / 0.38);
        L[i] = tanh(Math.sin(TAU * ph) * env * 1.4);
      }
      fadeEnd(L, sr, 0.04);
      return normPeak(L, new Float32Array(L), 0.76);
    },
  },
  {
    family: 'cy',
    file: '04-IDM-Glitch-Zap.wav',
    label: 'IDM GLITCH ZAP',
    dur: 0.24,
    gen(sr, len) {
      const L = new Float32Array(len);
      let ph = 0;
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        const step = Math.floor(t * 36);
        const f = 220 * Math.pow(1.35, (step * 5) % 9) * Math.exp(-t / 0.09);
        ph += f / sr;
        const fm = Math.sin(TAU * f * 2.71 * t) * 2.5;
        L[i] = tanh(Math.sin(TAU * ph + fm) * Math.exp(-t / 0.09) * 1.6);
      }
      fadeEnd(L, sr, 0.015);
      return normPeak(L, new Float32Array(L), 0.8);
    },
  },
  {
    family: 'cy',
    file: '05-Trance-Supersaw.wav',
    label: 'TRANCE SUPERSAW',
    dur: 0.55,
    gen(sr, len) {
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      const det = [-0.018, -0.009, -0.003, 0, 0.003, 0.009, 0.018];
      const notes = [220, 329.63, 440]; // A power chord
      for (let i = 0; i < len; i += 1) {
        const t = i / sr;
        let sL = 0;
        let sR = 0;
        for (const f0 of notes) {
          for (let d = 0; d < det.length; d += 1) {
            const p = (f0 * (1 + det[d]) * t + d * 0.13) % 1;
            const w = p * 2 - 1;
            if (d % 2 === 0) sL += w;
            else sR += w;
          }
        }
        const env = (1 - Math.exp(-t / 0.006)) * Math.exp(-t / 0.25);
        L[i] = tanh((sL / 10) * env * 1.5);
        R[i] = tanh((sR / 10) * env * 1.5);
      }
      fadeEnd(L, sr, 0.03);
      fadeEnd(R, sr, 0.03);
      return normPeak(L, R, 0.82);
    },
  },
];

const BY_KEY = new Map<string, SynthSampleDef>(DEFS.map((d) => [`${d.family}/${d.file}`, d]));

export const SYNTH_SAMPLES: readonly KitSample[] = DEFS.map(
  (d): KitSample => ({
    key: `${d.family}/${d.file}`,
    family: d.family,
    file: d.file,
    label: d.label,
    url: `synth:${d.family}/${d.file}`,
  })
);

export function isSynthSampleUrl(url: string): boolean {
  return url.startsWith('synth:');
}

export function renderSynthSample(key: string, sr = 48000): SamplePcm | null {
  const def = BY_KEY.get(key);
  if (!def) return null;
  const len = Math.max(64, Math.round(sr * def.dur));
  let seed = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) seed = Math.imul(seed ^ key.charCodeAt(i), 0x01000193);
  const [L, R] = def.gen(sr, len, rng(seed));
  return { L, R, sr };
}
