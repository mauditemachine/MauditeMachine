/**
 * Le cuir du panneau du plugin MM-ARP (2026-11-16, revu le meme jour, Mika : "regarde bien le fond de Legend HZ, c'est
 * pas exactement la meme chose") : un cuir noir pleine fleur presque uni, pas un tolex a bosses. Le grain se devine plus
 * qu'il ne se voit (il apparait surtout de pres) ; le relief est faible et mat ; la peau a de larges variations de lumiere,
 * douces, sans motif qui se repete.
 *
 * - leatherGrain() : la tuile de relief (768 px pour 3 unites, en boucle) : de petites cellules irregulieres (Voronoi), des plis fins et
 *   sinueux en biais (des lignes de crete d'un bruit etire, comme la fleur du cuir), un rien de pores ; la carte de
 *   normales, eclairee par la lumiere de la scene. Generee une fois (quelques dizaines de ms).
 * - leatherSkin(w, d) : une image pour tout le plan, sans repetition (512 px de large) : la couleur (de larges nappes un rien
 *   plus claires ou plus sombres, +/- 7 %) et la brillance (rough : mat partout, un peu plus satine par endroits).
 * La meme recette en Python pour l'image d'OPEN (retro/leather.png).
 */

import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three';
import { mulberry32 } from '../scene/silk';

/** Un bruit de valeur periodique (periode gx x gy cases sur la tuile), interpolation douce ; 0..1. */
function periodicNoise(seed: number, gx: number, gy: number): (u: number, v: number) => number {
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

/** La hauteur du cuir sur une tuile de N px (en boucle) ; cell : la taille moyenne d'une cellule du grain (px). */
export function leatherHeight(N: number, cell: number, seed: number): Float32Array {
  const rnd = mulberry32(seed);
  const G = Math.round(N / cell);
  const C = N / G;
  const pts = new Float32Array(G * G * 2);
  for (let j = 0; j < G; j += 1) {
    for (let i = 0; i < G; i += 1) {
      pts[(j * G + i) * 2] = (i + 0.1 + 0.8 * rnd()) * C;
      pts[(j * G + i) * 2 + 1] = (j + 0.1 + 0.8 * rnd()) * C;
    }
  }
  // les plis : deux bruits etires en biais (cisaillement entier : la tuile boucle toujours)
  const n1 = periodicNoise(seed + 1, 40, 9);
  const n2 = periodicNoise(seed + 2, 64, 15);
  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y += 1) {
    const gy = Math.floor(y / C);
    for (let x = 0; x < N; x += 1) {
      const gx = Math.floor(x / C);
      let d1 = 1e9;
      let d2 = 1e9;
      for (let dj = -1; dj <= 1; dj += 1) {
        const cj = gy + dj;
        const wj = ((cj % G) + G) % G;
        for (let di = -1; di <= 1; di += 1) {
          const ci = gx + di;
          const wi = ((ci % G) + G) % G;
          const k = (wj * G + wi) * 2;
          const dx = x - (pts[k] + (ci - wi) * C);
          const dy = y - (pts[k + 1] + (cj - wj) * C);
          const d = dx * dx + dy * dy;
          if (d < d1) {
            d2 = d1;
            d1 = d;
          } else if (d < d2) d2 = d;
        }
      }
      // la cellule : un plateau a peine bombe, un sillon tres fin a la frontiere
      const e = Math.min(1, (Math.sqrt(d2) - Math.sqrt(d1)) / (C * 0.22));
      const grain = Math.sqrt(e);
      // les plis : la ou un bruit etire passe par 0.5, une ligne sinueuse
      const p1 = Math.abs(n1(((x + y) % N) / N, y / N) - 0.5);
      const p2 = Math.abs(n2(((x + 2 * y) % N) / N, y / N) - 0.5);
      const crease = Math.exp(-p1 * 38) * 0.9 + Math.exp(-p2 * 55) * 0.6;
      h[y * N + x] = 0.55 * grain - 0.45 * crease + 0.06 * rnd();
    }
  }
  return h;
}

const tex = (c: HTMLCanvasElement, name: string, color: boolean, repeat: boolean): CanvasTexture => {
  const t = new CanvasTexture(c);
  t.colorSpace = color ? SRGBColorSpace : NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = 8;
  t.name = name;
  return t;
};

let normalTex: CanvasTexture | null = null;
/** La tuile de relief (carte de normales, en boucle). */
export function leatherGrain(): CanvasTexture {
  if (normalTex) return normalTex;
  // 768 px pour 3 unites (silk.ts) : une cellule de 6 px = 0.023 unite, ~4 px d'ecran a 2x ; la tuile a peine reduite a
  // l'ecran (le mipmap n'efface pas le grain)
  const N = 768;
  const h = leatherHeight(N, 6, 1966);
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  if (!g) throw new Error('leather: no 2d context');
  const img = g.createImageData(N, N);
  const at = (x: number, y: number): number => h[((y + N) % N) * N + ((x + N) % N)];
  const K = 1.6;
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * K;
      const dy = (at(x, y + 1) - at(x, y - 1)) * K;
      const l = Math.hypot(dx, dy, 1);
      const o = (y * N + x) * 4;
      img.data[o] = Math.round(((-dx / l) * 0.5 + 0.5) * 255);
      img.data[o + 1] = Math.round(((dy / l) * 0.5 + 0.5) * 255);
      img.data[o + 2] = Math.round(((1 / l) * 0.5 + 0.5) * 255);
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  normalTex = tex(c, 'arpLeatherN', false, true);
  return normalTex;
}

/** La peau d'un plan (w x d unites) : la couleur (base 0.8 : le materiau la divise) et la brillance, sans repetition. */
export function leatherSkin(w: number, d: number, seed: number): { color: CanvasTexture; rough: CanvasTexture } {
  const W = 512;
  const H = Math.max(8, Math.round((W * d) / w));
  const cc = document.createElement('canvas');
  const rc = document.createElement('canvas');
  cc.width = rc.width = W;
  cc.height = rc.height = H;
  const cx = cc.getContext('2d');
  const rx = rc.getContext('2d');
  if (!cx || !rx) throw new Error('leather: no 2d context');
  const ci = cx.createImageData(W, H);
  const ri = rx.createImageData(W, H);
  // des nappes larges (le plan fait ~12 unites : une nappe ~ 1 a 3 unites)
  const big = periodicNoise(seed, Math.max(2, Math.round(w / 2.6)), Math.max(2, Math.round(d / 2.6)));
  const mid = periodicNoise(seed + 7, Math.max(3, Math.round(w / 0.9)), Math.max(3, Math.round(d / 0.9)));
  const gl = periodicNoise(seed + 13, Math.max(2, Math.round(w / 1.8)), Math.max(2, Math.round(d / 1.8)));
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const u = x / W;
      const v = y / H;
      const lum = 0.8 * (1 + 0.1 * (big(u, v) - 0.5) + 0.05 * (mid(u, v) - 0.5));
      const r = 0.88 + 0.1 * (gl(u, v) - 0.5);
      const o = (y * W + x) * 4;
      const c8 = Math.round(Math.max(0, Math.min(1, lum)) * 255);
      ci.data[o] = ci.data[o + 1] = ci.data[o + 2] = c8;
      ci.data[o + 3] = 255;
      const r8 = Math.round(r * 255);
      ri.data[o] = ri.data[o + 1] = ri.data[o + 2] = r8;
      ri.data[o + 3] = 255;
    }
  }
  cx.putImageData(ci, 0, 0);
  rx.putImageData(ri, 0, 0);
  return { color: tex(cc, 'arpLeatherC', false, false), rough: tex(rc, 'arpLeatherR', false, false) };
}
