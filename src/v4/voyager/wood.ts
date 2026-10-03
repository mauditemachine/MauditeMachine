/**
 * Le bois des joues du MM-VOYAGER (2026-10-03, revu apres l'essai de Mika :
 * "j'aime l'idee, fais mieux en dark et en light"). Deux essences, une par
 * apparence :
 * - machine noire : noyer fume, presque noir, fil chaud qui accroche la
 *   lumiere ;
 * - machine claire : chene blanc, miel pale, fil fin (une piece
 *   scandinave).
 * Debit sur quartier : fil droit le long de la joue, cernes serres et
 * legerement ondules, fibres fines, pores en tirets sombres, nuances lentes.
 * Une texture de couleur et une de relief (pores et fibres en creux) ; le
 * materiau est un vernis satine (clearcoat) qui reflete un studio doux
 * (carte d'environnement generee ici, comme celle du PCB).
 */

import {
  CanvasTexture,
  EquirectangularReflectionMapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshPhysicalMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { mulberry32 } from '../scene/silk';
import { APPEARANCE } from '../theme';

type RGB = readonly [number, number, number];

/** Teintes AFFICHEES visees (sous la cle et l'ACES, l'albedo est un peu plus clair). */
const SPECIES: Record<'dark' | 'light', { lo: RGB; mid: RGB; hi: RGB; pore: number; rings: number }> = {
  // Noyer fume
  dark: { lo: [26, 16, 11], mid: [58, 37, 24], hi: [104, 68, 42], pore: 0.55, rings: 34 },
  // Chene blanc
  light: { lo: [138, 101, 66], mid: [190, 152, 108], hi: [224, 194, 150], pore: 0.72, rings: 28 },
};

/** Bruit de valeur periodique (periode px, py), interpolation douce. */
function makeNoise(seed: number, px: number, py: number): (x: number, y: number) => number {
  const rnd = mulberry32(seed);
  const g = new Float32Array(px * py);
  for (let i = 0; i < g.length; i += 1) g[i] = rnd();
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const at = (i: number, j: number): number => g[(((j % py) + py) % py) * px + (((i % px) + px) % px)];
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return a + (b - a) * sy;
  };
}

export interface WoodMaps {
  color: CanvasTexture;
  bump: CanvasTexture;
  env: CanvasTexture;
}

/**
 * Les cartes du bois : W px le long du fil (u : toute la joue), H en
 * travers (v). Une tuile par joue (repetition reglee par l'appelant), sans
 * raccord visible.
 */
export function makeWood(mobile: boolean): WoodMaps {
  const look = APPEARANCE.current === 'light' ? 'light' : 'dark';
  const S = SPECIES[look];
  const W = mobile ? 512 : 1024;
  const H = mobile ? 256 : 512;
  const n1 = makeNoise(1974, 64, 64);
  const n2 = makeNoise(808, 256, 256);
  const n3 = makeNoise(42, 128, 128);
  const color = document.createElement('canvas');
  color.width = W;
  color.height = H;
  const bump = document.createElement('canvas');
  bump.width = W;
  bump.height = H;
  const cx = color.getContext('2d');
  const bx = bump.getContext('2d');
  if (!cx || !bx) throw new Error('voyager: no 2d context');
  const ci = cx.createImageData(W, H);
  const bi = bx.createImageData(W, H);
  for (let y = 0; y < H; y += 1) {
    const v = y / H;
    for (let x = 0; x < W; x += 1) {
      const u = x / W;
      // Cernes : presque droits, a peine ondules le long du fil
      const warp = (n1(u * 4, v * 3) - 0.5) * 0.05 + (n1(u * 1.2 + 7, v * 1.5) - 0.5) * 0.09;
      const r = (v + warp) * S.rings;
      const ph = r - Math.floor(r);
      // Bois d'ete : une bande sombre nette, puis le bois de printemps qui s'eclaircit
      const late = ph < 0.18 ? 1 - ph / 0.18 : ph > 0.82 ? (ph - 0.82) / 0.18 : 0;
      // Fibres fines, etirees le long du fil
      const fiber = n2(u * 12, v * 230);
      // Nuances lentes (le coeur, l'aubier)
      const tone = n1(u * 2 + 3, v * 4) * 0.6 + n3(u * 6, v * 9) * 0.4;
      // Pores : de courts tirets sombres alignes sur le fil
      const pore = n3(u * 90, v * 520) > S.pore + 0.2 * (1 - late) ? 1 : 0;
      let t = 0.58 - 0.42 * late * late + (fiber - 0.5) * 0.22 + (tone - 0.5) * 0.35;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const c0 = t < 0.5 ? S.lo : S.mid;
      const c1 = t < 0.5 ? S.mid : S.hi;
      const k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      const shade = 1 - pore * 0.35;
      const o = (y * W + x) * 4;
      ci.data[o] = (c0[0] + (c1[0] - c0[0]) * k) * shade;
      ci.data[o + 1] = (c0[1] + (c1[1] - c0[1]) * k) * shade;
      ci.data[o + 2] = (c0[2] + (c1[2] - c0[2]) * k) * shade;
      ci.data[o + 3] = 255;
      // Relief : pores et bois d'ete en creux, fibres a peine
      const h = 0.75 - pore * 0.5 - late * 0.12 + (fiber - 0.5) * 0.08;
      const g = Math.max(0, Math.min(255, h * 255));
      bi.data[o] = g;
      bi.data[o + 1] = g;
      bi.data[o + 2] = g;
      bi.data[o + 3] = 255;
    }
  }
  cx.putImageData(ci, 0, 0);
  bx.putImageData(bi, 0, 0);
  const tex = (c: HTMLCanvasElement, srgb: boolean): CanvasTexture => {
    const t = new CanvasTexture(c);
    t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.generateMipmaps = true;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.anisotropy = 8;
    return t;
  };
  return { color: tex(color, true), bump: tex(bump, false), env: makeStudioEnv(look) };
}

/**
 * Un studio doux en equirectangulaire (256 x 128) : plafond clair, une
 * grande boite a lumiere en haut a gauche, sol sombre ; le vernis y prend
 * ses reflets.
 */
function makeStudioEnv(look: 'dark' | 'light'): CanvasTexture {
  const W = 256;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  if (!x) throw new Error('voyager: no 2d context');
  const g = x.createLinearGradient(0, 0, 0, H);
  if (look === 'light') {
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#e9e4da');
    g.addColorStop(1, '#a9a49b');
  } else {
    g.addColorStop(0, '#6d675e');
    g.addColorStop(0.5, '#2a2622');
    g.addColorStop(1, '#0a0908');
  }
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  // Boite a lumiere
  const box = x.createRadialGradient(W * 0.3, H * 0.22, 2, W * 0.3, H * 0.22, W * 0.16);
  box.addColorStop(0, 'rgba(255, 250, 240, 1)');
  box.addColorStop(1, 'rgba(255, 250, 240, 0)');
  x.fillStyle = box;
  x.fillRect(0, 0, W, H);
  const t = new CanvasTexture(c);
  t.mapping = EquirectangularReflectionMapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Le vernis satine : le fil en couleur et en relief, un reflet doux. */
export function makeWoodMaterial(maps: WoodMaps): MeshPhysicalMaterial {
  const light = APPEARANCE.current === 'light';
  const m = new MeshPhysicalMaterial({
    map: maps.color,
    bumpMap: maps.bump,
    bumpScale: light ? 0.9 : 1.2,
    roughness: light ? 0.62 : 0.5,
    metalness: 0,
    clearcoat: light ? 0.35 : 0.6,
    clearcoatRoughness: light ? 0.45 : 0.32,
    envMap: maps.env,
    envMapIntensity: light ? 0.35 : 0.55,
  });
  m.name = 'voyWood';
  return m;
}
