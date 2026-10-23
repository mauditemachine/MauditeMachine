/**
 * Les mesures du controle qualite du MM-ARP (2026-10-23, Mika : "Pourrais-tu controler ARP pour que le son soit
 * d'extreme bonne qualite ?! entre Monark et un synth analog Moog Voyager et un Korg MS10"), en JavaScript seul (sans
 * Python) : spectres (fenetre de Blackman-Harris, FFT en double), purete harmonique (la metrique du 2026-10-21,
 * measure/ana.py harmonic_split : energie harmonique / non harmonique de 20 Hz a 20 kHz, 6 cases de tolerance, 65536
 * points depuis 0.2 s), projection sur un harmonique, frequence par passages a zero, sonie ponderee K (BS.1770, sans
 * porte), bandes de tiers d'octave, detecteur de clics (passe-haut d'ordre 4 a 8 kHz). Rien n'est joue.
 */

export const SR = 48000;

/** FFT complexe en place (rayon 2), re et im de longueur 2^k. */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const half = len >> 1;
    // Les racines de l'unite du niveau, calculees une fois (precision double)
    const wr = new Float64Array(half);
    const wi = new Float64Array(half);
    for (let k = 0; k < half; k += 1) {
      wr[k] = Math.cos(ang * k);
      wi[k] = Math.sin(ang * k);
    }
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k += 1) {
        const a = i + k;
        const b = a + half;
        const br = re[b] * wr[k] - im[b] * wi[k];
        const bi = re[b] * wi[k] + im[b] * wr[k];
        re[b] = re[a] - br;
        im[b] = im[a] - bi;
        re[a] += br;
        im[a] += bi;
      }
    }
  }
}

const winCache = new Map();
/** Blackman-Harris a 4 termes (celle de measure/ana.py). */
export function bhWindow(n) {
  const key = `bh${n}`;
  if (winCache.has(key)) return winCache.get(key);
  const w = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = (2 * Math.PI * i) / (n - 1);
    w[i] = 0.35875 - 0.48829 * Math.cos(t) + 0.14128 * Math.cos(2 * t) - 0.01168 * Math.cos(3 * t);
  }
  winCache.set(key, w);
  return w;
}

/** Spectre fenetre : { f, amp (crete d'un sinus), pow (puissance par case, somme = moyenne quadratique) }. */
export function spectrum(x, n = 65536, start = 0, sr = SR) {
  const w = bhWindow(n);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  let sw = 0;
  let sw2 = 0;
  for (let i = 0; i < n; i += 1) {
    const v = start + i < x.length ? x[start + i] : 0;
    re[i] = v * w[i];
    sw += w[i];
    sw2 += w[i] * w[i];
  }
  fft(re, im);
  const m = (n >> 1) + 1;
  const amp = new Float64Array(m);
  const pow = new Float64Array(m);
  const f = new Float64Array(m);
  for (let k = 0; k < m; k += 1) {
    const mag2 = re[k] * re[k] + im[k] * im[k];
    amp[k] = (Math.sqrt(mag2) * 2) / sw;
    pow[k] = (mag2 * 2) / sw2 / n;
    f[k] = (k * sr) / n;
  }
  return { f, amp, pow, n, sr };
}

export const db = (x) => 20 * Math.log10(Math.max(1e-30, Math.abs(x)));
export const db10 = (x) => 10 * Math.log10(Math.max(1e-30, x));

/**
 * La purete : energie harmonique / non harmonique dans [lo, hi] (dB, plus haut = plus propre), la pire raie non
 * harmonique (dBc, re l'harmonique le plus fort) et sa frequence. bases : une ou plusieurs fondamentales.
 */
export function harmonicSplit(x, bases, { n = 65536, start = Math.round(0.2 * SR), lo = 20, hi = 20000, tol = 6, sr = SR, maxh = Infinity } = {}) {
  const S = spectrum(x, n, start, sr);
  const binHz = sr / n;
  const m = S.pow.length;
  const mask = new Uint8Array(m);
  for (const f0 of [].concat(bases)) {
    for (let k = 1; k * f0 <= sr / 2 && k <= maxh; k += 1) {
      const c = (k * f0) / binHz;
      const i0 = Math.max(0, Math.floor(c - tol));
      const i1 = Math.min(m - 1, Math.ceil(c + tol));
      for (let i = i0; i <= i1; i += 1) mask[i] = 1;
    }
  }
  let harm = 0;
  let non = 0;
  let hmax = 1e-30;
  let worst = 1e-30;
  let worstHz = 0;
  for (let i = 0; i < m; i += 1) {
    const f = S.f[i];
    if (f < lo || f > hi) continue;
    if (mask[i]) {
      harm += S.pow[i];
      if (S.amp[i] > hmax) hmax = S.amp[i];
    } else {
      non += S.pow[i];
      if (S.amp[i] > worst) {
        worst = S.amp[i];
        worstHz = f;
      }
    }
  }
  return { purity: db10(harm / Math.max(non, 1e-30)), worstDbc: db(worst) - db(hmax), worstHz, harmPow: harm, nonPow: non };
}

/** L'amplitude d'une frequence f (projection fenetree de Hann sur [start, start + N)). */
export function harm(x, f, start, N, sr = SR) {
  let re = 0;
  let im = 0;
  let ws = 0;
  const w0 = (2 * Math.PI * f) / sr;
  for (let i = 0; i < N; i += 1) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
    const v = x[start + i] * w;
    re += v * Math.cos(w0 * i);
    im -= v * Math.sin(w0 * i);
    ws += w;
  }
  return (2 * Math.hypot(re, im)) / ws;
}

/** La frequence par passages a zero montants (interpoles) sur [start, start + N). */
export function zcFreq(x, start, N, sr = SR) {
  let first = -1;
  let last = -1;
  let n = 0;
  for (let i = start + 1; i < start + N && i < x.length; i += 1) {
    if (x[i - 1] < 0 && x[i] >= 0) {
      const t = i - 1 + -x[i - 1] / (x[i] - x[i - 1]);
      if (first < 0) first = t;
      last = t;
      n += 1;
    }
  }
  return n > 2 ? ((n - 1) * sr) / (last - first) : 0;
}

/** La frequence la plus forte (case du maximum, affinee par une parabole sur le log) dans [lo, hi]. */
export function peakFreq(x, { n = 65536, start = Math.round(0.2 * SR), lo = 20, hi = 24000, sr = SR } = {}) {
  const S = spectrum(x, n, start, sr);
  let bi = 1;
  for (let i = 1; i < S.amp.length - 1; i += 1) if (S.f[i] >= lo && S.f[i] <= hi && S.amp[i] > S.amp[bi]) bi = i;
  const a = Math.log(S.amp[bi - 1] + 1e-300);
  const b = Math.log(S.amp[bi] + 1e-300);
  const c = Math.log(S.amp[bi + 1] + 1e-300);
  const d = a - 2 * b + c;
  const p = d !== 0 ? (0.5 * (a - c)) / d : 0;
  return { f: (bi + p) * (sr / n), amp: S.amp[bi] };
}

/** Biquad direct, en double. */
export function biquad(x, b, a) {
  const y = new Float64Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i += 1) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}
/** Le filtre K de BS.1770 a 48 kHz. */
export const kWeight = (x) => biquad(biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]), [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
/** La sonie ponderee K sans porte (LUFS), sur [start, fin). */
export function loudness(L, R, start = 0) {
  const kl = kWeight(L);
  const kr = R ? kWeight(R) : kl;
  let s = 0;
  for (let i = start; i < kl.length; i += 1) s += kl[i] * kl[i] + kr[i] * kr[i];
  return -0.691 + db10(s / Math.max(1, kl.length - start));
}

/** Les centres des tiers d'octave (normalises, 40 Hz a 16 kHz). */
export const THIRDS = [40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000];
/** L'energie (dB) de chaque tiers d'octave du milieu (L + R) / 2, spectres de 16384 points mis bout a bout. */
export function thirdBands(L, R, start = 0) {
  const N = 16384;
  const acc = new Float64Array(N / 2 + 1);
  const w = bhWindow(N);
  let segs = 0;
  for (let s = start; s + N <= L.length; s += N / 2) {
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    for (let i = 0; i < N; i += 1) re[i] = 0.5 * (L[s + i] + (R ? R[s + i] : L[s + i])) * w[i];
    fft(re, im);
    for (let k = 0; k <= N / 2; k += 1) acc[k] += re[k] * re[k] + im[k] * im[k];
    segs += 1;
  }
  const out = [];
  for (const fc of THIRDS) {
    const lo = fc / Math.pow(2, 1 / 6);
    const hi = fc * Math.pow(2, 1 / 6);
    let e = 0;
    for (let k = Math.ceil((lo * N) / SR); k <= Math.floor((hi * N) / SR); k += 1) e += acc[k];
    out.push(db10(e / Math.max(1, segs)));
  }
  return out;
}

/** Passe-haut de Butterworth d'ordre 4 (deux biquads, transformee bilineaire), en double. */
export function highpass4(x, fc, sr = SR) {
  let y = x;
  for (const q of [0.5411961, 1.3065630]) {
    const w0 = (2 * Math.PI * fc) / sr;
    const al = Math.sin(w0) / (2 * q);
    const cw = Math.cos(w0);
    const a0 = 1 + al;
    y = biquad(y, [(1 + cw) / 2 / a0, -(1 + cw) / a0, (1 + cw) / 2 / a0], [1, (-2 * cw) / a0, (1 - al) / a0]);
  }
  return y;
}

/**
 * Le detecteur de clics (Q4) : l'energie au-dessus de 8 kHz (passe-haut d'ordre 4), en valeur efficace sur 1 ms, dans
 * +/-3 ms autour de t (s), contre le meme rendu sans l'evenement : dB (<= +3 : pas de clic ajoute).
 */
export function clickDb(withEv, without, t, sr = SR) {
  const a = highpass4(withEv, 8000, sr);
  const b = highpass4(without, 8000, sr);
  const i0 = Math.max(0, Math.round((t - 0.003) * sr));
  const i1 = Math.min(a.length, Math.round((t + 0.003) * sr));
  const win = Math.round(0.001 * sr);
  const peak = (y) => {
    let best = 0;
    for (let i = i0; i + win <= i1; i += 8) {
      let s = 0;
      for (let j = 0; j < win; j += 1) s += y[i + j] * y[i + j];
      if (s > best) best = s;
    }
    return best / win;
  };
  return db10(peak(a) / Math.max(peak(b), 1e-30));
}

/** Moyenne, valeur efficace, crete. */
export function stats(x, start = 0, end = x.length) {
  let s = 0;
  let s2 = 0;
  let pk = 0;
  for (let i = start; i < end; i += 1) {
    const v = x[i];
    s += v;
    s2 += v * v;
    const a = v < 0 ? -v : v;
    if (a > pk) pk = a;
  }
  const n = Math.max(1, end - start);
  return { mean: s / n, rms: Math.sqrt(s2 / n), peak: pk };
}

export const cents = (f, ref) => 1200 * Math.log2(f / ref);
export const r1 = (x) => Math.round(x * 10) / 10;
export const r2 = (x) => Math.round(x * 100) / 100;
