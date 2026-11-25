/**
 * Le cuir du plugin MM-ARP, le calcul seul (v35, 2026-11-19, Mika : "ca ne ressemble pas du tout a du cuir, je veux
 * exactement le meme background que l'image 2", le fond de Legend HZ) : un cuir noir a plis fins en biais, doux et peu
 * contraste, comme une photo de cuir, plus un bruit de pixels eclaire par la scene (le defaut de la v33 : des cellules de
 * 4 px en carte de normales, qui scintillaient).
 *
 * Sans DOM ni three (le banc de mise au point le fait tourner sous Node) :
 * - leatherField(N) : la hauteur d'une tuile de N px, en boucle : des cellules bombees, allongees le long du pli (un
 *   Voronoi a metrique etiree), le pli en biais et qui tourne d'une zone a l'autre, le tout deforme par un bruit lent,
 *   un sillon doux a chaque frontiere, un grain plus fin par-dessus ;
 * - leatherBake(h, N) : la photo de ce relief, 0..1 (la lumiere vient d'en haut a gauche, les sillons sont dans
 *   l'ombre), un rien floutee : c'est elle qui se voit, la carte de normales ne fait qu'accrocher un peu la lumiere.
 */

/** Le hasard a graine de scene/silk.ts (recopie : ce fichier ne depend de rien). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un bruit de valeur periodique (gx x gy cases sur la tuile), interpolation douce ; 0..1. */
export function periodicNoise(seed: number, gx: number, gy: number): (u: number, v: number) => number {
  const rnd = mulberry32(seed);
  const g = new Float32Array(gx * gy);
  for (let i = 0; i < g.length; i += 1) g[i] = rnd();
  const at = (i: number, j: number): number => g[(((j % gy) + gy) % gy) * gx + (((i % gx) + gx) % gx)];
  return (u, v) => {
    const x = u * gx;
    const y = v * gy;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return a + (b - a) * sy;
  };
}

export interface LeatherSpec {
  /** les cellules du grain : leur nombre par cote de tuile */
  g: number;
  /** l'allongement des cellules le long du pli (1 : rondes) et l'angle moyen du pli (degres, vers le haut a droite) */
  stretch: number;
  angle: number;
  /** de combien l'angle tourne d'une zone a l'autre (degres) */
  swirl: number;
  /** la deformation lente des plis (px a N = 1024) */
  warp: number;
  /** la part du dos de la cellule qui est bombee (1 : tout le dos, pas de plateau) et la part du grain fin */
  groove: number;
  fine: number;
}

/** Le cuir retenu (regle sur le fond de Legend HZ : un grain fin, ~4 px sur ~9 a 2000 px de large, en biais). */
export const LEATHER_SPEC: LeatherSpec = { g: 94, stretch: 1.6, angle: 30, swirl: 50, warp: 8, groove: 0.42, fine: 0.22 };
/** Les valeurs de l'image (sRGB, 0..255), mesurees sur le fond de Legend HZ : la moyenne, et l'ecart-type rapporte a elle. */
export const LEATHER_MEAN = 23;
export const LEATHER_SD = 0.22;
/** Le flou de la photo (1 : doux ; 0.5 : les sillons restent fins, comme sur le fond de Legend HZ). */
export const LEATHER_SOFT = 0.5;

/**
 * Un Voronoi a metrique etiree : des points tires sur une grille de g x g cases (en boucle), la distance comptee plus
 * courte le long du pli (angle th) que de travers : les cellules s'allongent le long du pli. Rend l'ecart F2 - F1 (0 sur
 * une frontiere), en px de la metrique, et un hasard propre a la cellule (0..1).
 */
function stretchedCells(N: number, g: number, seed: number, reach: number): (x: number, y: number, th: number, st: number, out: Float32Array) => void {
  const rnd = mulberry32(seed);
  const C = N / g;
  const px = new Float32Array(g * g);
  const py = new Float32Array(g * g);
  const pr = new Float32Array(g * g);
  for (let i = 0; i < g * g; i += 1) {
    px[i] = rnd();
    py[i] = rnd();
    pr[i] = rnd();
  }
  return (x, y, th, st, out) => {
    const c = Math.cos(th);
    const s = Math.sin(th);
    const ix = Math.floor(x / C);
    const iy = Math.floor(y / C);
    let d1 = 1e18;
    let d2 = 1e18;
    let r1 = 0;
    for (let dj = -reach; dj <= reach; dj += 1) {
      const cj = iy + dj;
      const wj = ((cj % g) + g) % g;
      for (let di = -reach; di <= reach; di += 1) {
        const ci = ix + di;
        const k = wj * g + (((ci % g) + g) % g);
        const dx = x - (ci + px[k]) * C;
        const dy = y - (cj + py[k]) * C;
        // le long du pli (vers le haut a droite : y vers le bas) et de travers
        const al = (dx * c - dy * s) / st;
        const ac = (dx * s + dy * c) * st;
        const d = al * al + ac * ac;
        if (d < d1) {
          d2 = d1;
          d1 = d;
          r1 = pr[k];
        } else if (d < d2) d2 = d;
      }
    }
    out[0] = Math.sqrt(d2) - Math.sqrt(d1);
    out[1] = r1;
  };
}

/** La hauteur du cuir sur une tuile de N px, en boucle (0 : le fond d'un sillon, ~1 : le dos d'une cellule). */
export function leatherField(N: number, spec: LeatherSpec = LEATHER_SPEC, seed = 1966): Float32Array {
  const k = N / 1024;
  const reach = Math.ceil(spec.stretch) + 1;
  const big = stretchedCells(N, spec.g, seed, reach);
  const small = stretchedCells(N, spec.g * 2, seed + 5, reach);
  const wx = periodicNoise(seed + 1, 9, 9);
  const wy = periodicNoise(seed + 2, 9, 9);
  const wx2 = periodicNoise(seed + 3, 23, 23);
  const wy2 = periodicNoise(seed + 4, 23, 23);
  const turn = periodicNoise(seed + 6, 5, 5);
  const turn2 = periodicNoise(seed + 7, 13, 13);
  const cell = N / spec.g;
  const h = new Float32Array(N * N);
  const o = new Float32Array(2);
  const rad = Math.PI / 180;
  for (let y = 0; y < N; y += 1) {
    const v = y / N;
    for (let x = 0; x < N; x += 1) {
      const u = x / N;
      const dx = ((wx(u, v) - 0.5) * 2 + (wx2(u, v) - 0.5) * 0.7) * spec.warp * k;
      const dy = ((wy(u, v) - 0.5) * 2 + (wy2(u, v) - 0.5) * 0.7) * spec.warp * k;
      const th = (spec.angle + ((turn(u, v) - 0.5) * 2 + (turn2(u, v) - 0.5) * 0.8) * spec.swirl) * rad;
      big(x + dx, y + dy, th, spec.stretch, o);
      // le dos d'une cellule : bombe d'un bord a l'autre, un sillon a la frontiere ; chaque cellule un rien plus haute
      const e = Math.min(1, o[0] / (cell * spec.groove));
      const dome = Math.sin((e * Math.PI) / 2);
      const lift = 0.8 + 0.2 * o[1];
      small(x + dx * 0.6, y + dy * 0.6, th, spec.stretch, o);
      const e2 = Math.min(1, o[0] / (cell * 0.5 * spec.groove));
      h[y * N + x] = dome * lift * (1 - spec.fine) + spec.fine * Math.sin((e2 * Math.PI) / 2) * (0.4 + 0.6 * dome);
    }
  }
  return h;
}

/** Un flou gaussien separable, en boucle (sigma en px). */
function blur(src: Float32Array, N: number, sigma: number): Float32Array {
  if (sigma <= 0) return src;
  const r = Math.max(1, Math.ceil(sigma * 2.5));
  const w = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i += 1) {
    w[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
    sum += w[i + r];
  }
  for (let i = 0; i < w.length; i += 1) w[i] /= sum;
  const tmp = new Float32Array(N * N);
  const out = new Float32Array(N * N);
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      let s = 0;
      for (let i = -r; i <= r; i += 1) s += src[y * N + ((x + i + N) % N)] * w[i + r];
      tmp[y * N + x] = s;
    }
  }
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      let s = 0;
      for (let i = -r; i <= r; i += 1) s += tmp[((y + i + N) % N) * N + x] * w[i + r];
      out[y * N + x] = s;
    }
  }
  return out;
}

/**
 * La photo du relief : pour chaque pixel, un gain autour de 1 (moyenne 1, ecart-type sd) : la pente vers la lumiere
 * (en haut a gauche) eclaircit, le fond des sillons s'assombrit ; un rien de flou (une peau, pas une gravure).
 */
export function leatherBake(h0: Float32Array, N: number, sd = 0.17, seed = 1966, soften = 1): Float32Array {
  const k = N / 1024;
  const h = blur(h0, N, 0.9 * k * soften);
  // la peau n'est pas plane : des bosses douces de ~15 et ~40 px (a N = 1024), que la lumiere accroche aussi
  const m1 = periodicNoise(seed + 21, 64, 64);
  const m2 = periodicNoise(seed + 22, 26, 26);
  const m3 = periodicNoise(seed + 23, 9, 9);
  // les pores : un bruit de pixels, que le dernier flou adoucit (le cuir n'est jamais net comme une gravure)
  const pore = mulberry32(seed + 31);
  const at = (x: number, y: number): number => h[((y + N) % N) * N + ((x + N) % N)];
  const raw = new Float32Array(N * N);
  let mean = 0;
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const gx = at(x + 1, y) - at(x - 1, y);
      const gy = at(x, y + 1) - at(x, y - 1);
      // la lumiere d'en haut a gauche : une pente qui monte vers le bas a droite lui fait face
      const lit = -(gx * 0.55 + gy * 0.83);
      const u = x / N;
      const w = y / N;
      const v = lit * 2.2 + (at(x, y) - 0.8) * 0.75 + (m1(u, w) - 0.5) * 0.3 + (m2(u, w) - 0.5) * 0.3 + (m3(u, w) - 0.5) * 0.18 + (pore() - 0.5) * 0.5;
      raw[y * N + x] = v;
      mean += v;
    }
  }
  mean /= N * N;
  const soft = blur(raw, N, 0.55 * k * soften);
  let varr = 0;
  for (let i = 0; i < soft.length; i += 1) varr += (soft[i] - mean) * (soft[i] - mean);
  const s = Math.sqrt(varr / soft.length) || 1;
  for (let i = 0; i < soft.length; i += 1) soft[i] = 1 + ((soft[i] - mean) / s) * sd;
  return soft;
}
