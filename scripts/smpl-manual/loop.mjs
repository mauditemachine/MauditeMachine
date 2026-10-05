/**
 * La boucle des captures du mode d'emploi du MM-SMPL (2026-10-05) : deux
 * mesures a 120 BPM, calculees ici (rien d'enregistre, rien de publie) :
 * kick sur chaque temps, clap sur 2 et 4, charleston, une basse en doubles
 * croches et un accord a la fin. De quoi voir des attaques nettes (SLICES
 * AUTO), une forme d'onde vivante et des slices qui tombent juste.
 */

const SR = 44100;
const BPM = 120;
const BEAT = 60 / BPM;
const BARS = 2;
const LEN = Math.round(BARS * 4 * BEAT * SR);

/** Un bruit reproductible (les captures ne bougent pas d'une fois a l'autre). */
function noise(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2147483648 - 1;
  };
}

function kick(L, R, at) {
  const n = Math.round(0.42 * SR);
  let ph = 0;
  for (let i = 0; i < n && at + i < LEN; i += 1) {
    const t = i / SR;
    const f = 46 + 120 * Math.exp(-t * 32);
    ph += (2 * Math.PI * f) / SR;
    const v = Math.sin(ph) * Math.exp(-t * 6.5) * 0.95 + (i < 90 ? (1 - i / 90) * 0.25 : 0);
    L[at + i] += v;
    R[at + i] += v;
  }
}

function clap(L, R, at, rnd) {
  const n = Math.round(0.32 * SR);
  // Un passe-bande grossier : la difference de deux passe-bas
  let a = 0;
  let b = 0;
  for (let i = 0; i < n && at + i < LEN; i += 1) {
    const t = i / SR;
    const x = rnd();
    a += 0.55 * (x - a);
    b += 0.08 * (x - b);
    const burst = t < 0.03 ? (Math.floor(t / 0.01) % 2 === 0 ? 1 : 0.35) : 1;
    const env = burst * (t < 0.03 ? 1 : Math.exp(-(t - 0.03) * 16));
    const v = (a - b) * env * 0.9;
    L[at + i] += v;
    R[at + i] += v * 0.92;
  }
}

function hat(L, R, at, open, rnd) {
  const n = Math.round((open ? 0.16 : 0.05) * SR);
  let lp = 0;
  for (let i = 0; i < n && at + i < LEN; i += 1) {
    const t = i / SR;
    const x = rnd();
    lp += 0.5 * (x - lp);
    const v = (x - lp) * Math.exp(-t * (open ? 22 : 70)) * (open ? 0.32 : 0.16);
    L[at + i] += v * 0.85;
    R[at + i] += v;
  }
}

/** Une note de basse : une dent de scie filtree, courte. */
function bass(L, R, at, hz, len) {
  const n = Math.round(len * SR);
  let ph = 0;
  let lp = 0;
  for (let i = 0; i < n && at + i < LEN; i += 1) {
    const t = i / SR;
    ph = (ph + hz / SR) % 1;
    const saw = ph * 2 - 1;
    const cut = 0.04 + 0.22 * Math.exp(-t * 14);
    lp += cut * (saw - lp);
    const env = Math.min(1, t / 0.004) * Math.exp(-t * 7);
    const v = lp * env * 0.42;
    L[at + i] += v;
    R[at + i] += v;
  }
}

/** Un accord (La mineur 7), des sinus legerement desaccordes, avec une queue. */
function chord(L, R, at, len) {
  const notes = [220, 261.63, 329.63, 392];
  const n = Math.round(len * SR);
  for (let i = 0; i < n && at + i < LEN; i += 1) {
    const t = i / SR;
    const env = Math.min(1, t / 0.01) * Math.exp(-t * 2.2) * 0.1;
    let l = 0;
    let r = 0;
    for (const f of notes) {
      l += Math.sin(2 * Math.PI * f * 0.998 * t) + 0.3 * Math.sin(4 * Math.PI * f * t);
      r += Math.sin(2 * Math.PI * f * 1.002 * t) + 0.3 * Math.sin(4 * Math.PI * f * t);
    }
    L[at + i] += l * env;
    R[at + i] += r * env;
  }
}

/** Les deux voies de la boucle (Float32, 44.1 kHz). */
export function makeLoopPcm() {
  const L = new Float32Array(LEN);
  const R = new Float32Array(LEN);
  const rnd = noise(1982);
  const at = (beat) => Math.round(beat * BEAT * SR);
  for (let b = 0; b < BARS * 4; b += 1) {
    kick(L, R, at(b));
    if (b % 2 === 1) clap(L, R, at(b), rnd);
    hat(L, R, at(b + 0.5), true, rnd);
    hat(L, R, at(b + 0.25), false, rnd);
    hat(L, R, at(b + 0.75), false, rnd);
  }
  // La basse : la, la a l'octave, sol, mi ; jamais sur le kick
  const line = [
    [0.25, 55], [0.5, 110], [0.75, 55], [1.5, 55], [1.75, 98], [2.25, 55], [2.5, 110], [2.75, 82.41],
    [3.5, 55], [3.75, 65.41], [4.25, 55], [4.5, 110], [4.75, 55], [5.5, 73.42], [5.75, 82.41], [6.25, 55],
    [6.5, 110], [6.75, 98], [7.25, 55], [7.5, 110],
  ];
  for (const [beat, hz] of line) bass(L, R, at(beat), hz, BEAT * 0.24);
  chord(L, R, at(6.5), 1.6);
  // Un peu de marge, puis le niveau
  let peak = 0;
  for (let i = 0; i < LEN; i += 1) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = 0.89 / (peak || 1);
  for (let i = 0; i < LEN; i += 1) {
    L[i] = Math.tanh(L[i] * g * 1.1) * 0.95;
    R[i] = Math.tanh(R[i] * g * 1.1) * 0.95;
  }
  return { L, R, rate: SR };
}

/** La boucle en WAV (16 bits, stereo). */
export function makeLoopWav() {
  const { L, R, rate } = makeLoopPcm();
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i += 1) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4);
  }
  return buf;
}
