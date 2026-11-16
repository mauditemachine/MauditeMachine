/**
 * Le cuir du panneau du plugin MM-ARP (2026-11-16, Mika : "fond en cuir") : un tolex noir a gros grain, en vrai relief.
 * Une tuile de 512 px generee une fois : des galets (cellules de Voronoi en boucle) bombes, separes de sillons fins ;
 * - normal : la carte de relief (eclairee par la lumiere de la scene) ;
 * - rough : la brillance, un peu plus satinee sur le haut des galets, mate dans les sillons.
 */

import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping } from 'three';
import { mulberry32 } from '../scene/silk';

export interface LeatherMaps {
  normal: CanvasTexture;
  rough: CanvasTexture;
}

/** La hauteur du grain (0..1), tuile de N px, cellules de taille moyenne cell px. */
export function leatherHeight(N: number, cell: number, seed: number): Float32Array {
  const rnd = mulberry32(seed);
  const G = Math.round(N / cell);
  const pts: number[] = [];
  for (let j = 0; j < G; j += 1) for (let i = 0; i < G; i += 1) pts.push((i + 0.15 + 0.7 * rnd()) * cell, (j + 0.15 + 0.7 * rnd()) * cell, 0.75 + 0.5 * rnd());
  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y += 1) {
    const gy = Math.floor(y / cell);
    for (let x = 0; x < N; x += 1) {
      const gx = Math.floor(x / cell);
      let d1 = 1e9;
      let d2 = 1e9;
      let s1 = 1;
      for (let dj = -1; dj <= 1; dj += 1) {
        for (let di = -1; di <= 1; di += 1) {
          const ci = (gx + di + G) % G;
          const cj = (gy + dj + G) % G;
          const k = (cj * G + ci) * 3;
          let px = pts[k];
          let py = pts[k + 1];
          // la tuile boucle
          px += (gx + di - ci) * cell;
          py += (gy + dj - cj) * cell;
          const d = Math.hypot(x - px, y - py);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            s1 = pts[k + 2];
          } else if (d < d2) d2 = d;
        }
      }
      // le galet bombe, le sillon a la frontiere de deux cellules
      const edge = Math.min(1, (d2 - d1) / (cell * 0.35));
      const dome = 1 - Math.min(1, d1 / (cell * 0.75)) ** 2;
      h[y * N + x] = Math.sqrt(edge) * (0.55 + 0.45 * dome) * s1 + 0.04 * rnd();
    }
  }
  return h;
}

let maps: LeatherMaps | null = null;
export function makeLeather(): LeatherMaps {
  if (maps) return maps;
  const N = 512;
  const h = leatherHeight(N, 12, 1966);
  const nc = document.createElement('canvas');
  nc.width = nc.height = N;
  const rc = document.createElement('canvas');
  rc.width = rc.height = N;
  const nx = nc.getContext('2d')!;
  const rx = rc.getContext('2d')!;
  const ni = nx.createImageData(N, N);
  const ri = rx.createImageData(N, N);
  const at = (x: number, y: number): number => h[((y + N) % N) * N + ((x + N) % N)];
  const k = 2.2;
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * k;
      const dy = (at(x, y + 1) - at(x, y - 1)) * k;
      const l = Math.hypot(dx, dy, 1);
      const o = (y * N + x) * 4;
      ni.data[o] = Math.round(((-dx / l) * 0.5 + 0.5) * 255);
      ni.data[o + 1] = Math.round(((dy / l) * 0.5 + 0.5) * 255);
      ni.data[o + 2] = Math.round(((1 / l) * 0.5 + 0.5) * 255);
      ni.data[o + 3] = 255;
      const r = Math.round((0.84 - 0.16 * Math.min(1, at(x, y))) * 255);
      ri.data[o] = ri.data[o + 1] = ri.data[o + 2] = r;
      ri.data[o + 3] = 255;
    }
  }
  nx.putImageData(ni, 0, 0);
  rx.putImageData(ri, 0, 0);
  const mk = (c: HTMLCanvasElement, name: string): CanvasTexture => {
    const t = new CanvasTexture(c);
    t.colorSpace = NoColorSpace;
    t.wrapS = t.wrapT = RepeatWrapping;
    t.generateMipmaps = true;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.anisotropy = 8;
    t.name = name;
    return t;
  };
  maps = { normal: mk(nc, 'arpLeatherN'), rough: mk(rc, 'arpLeatherR') };
  return maps;
}
