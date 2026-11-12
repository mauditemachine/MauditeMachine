/**
 * L'habillage de la face du plugin MM-ARP (2026-11-11 ; epure le 2026-11-12, Mika : "je trouve les lignes blanches
 * pourries", puis "peut-etre que je preferais les knobs NOIRS") : un panneau noir mat a grain tres fin de simili, et le
 * noyer des joues. Plus de bandeau de metal brosse ni de capuchon de metal : les titres sont des filets fins
 * (voyager/silk.ts skinBase, plugin/arp/face.css), les potards sont noirs (voyager/knobs.ts ; leur image pour les couches
 * HTML : plugin/arp/knob.ts). Tout est PROCEDURAL (aucune image du commerce) : deux dessins calcules une fois, pixel par
 * pixel, sur un canvas, et partages par la scene 3D (voyager/silk.ts) et par les couches HTML de la face (plugin/arp/
 * face.css, par des variables CSS posees par plugin/arp/ArpFace.tsx) : la 3D et le HTML portent la meme matiere.
 *
 * Le plugin MM-ARP seul (PLUGIN_ARP) : le site et le MM-RYTM n'appellent jamais ces fonctions.
 */

import { mulberry32 } from '../scene/silk';

const clamp = (x: number): number => (x < 0 ? 0 : x > 255 ? 255 : x);

function make(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D; img: ImageData } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('skin: no 2d context');
  return { c, ctx, img: ctx.createImageData(w, h) };
}

/**
 * Le simili noir : un grain de petits galets (bruit cellulaire, les points d'une grille decales au hasard), eclaire de
 * haut a gauche. La tuile se raccorde sur ses quatre bords. gain : la clarte (1 : celle du HTML ; la scene 3D en veut
 * une autre, sa lumiere et sa courbe de tons passent dessus). relief : le creux du grain (la scene 3D, que ses mipmaps
 * adoucissent, en veut plus).
 */
function leather(size: number, cells: number, gain: number, tint: readonly [number, number, number], relief: number, seed: number): HTMLCanvasElement {
  const { c, ctx, img } = make(size, size);
  const rnd = mulberry32(seed);
  const px: number[] = [];
  const py: number[] = [];
  const pv: number[] = [];
  for (let i = 0; i < cells * cells; i += 1) {
    px.push(0.12 + 0.76 * rnd());
    py.push(0.12 + 0.76 * rnd());
    pv.push(rnd());
  }
  const cell = size / cells;
  const hgt = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const gx = x / cell;
      const gy = y / cell;
      const cx = Math.floor(gx);
      const cy = Math.floor(gy);
      let d1 = 9;
      let d2 = 9;
      let v = 0;
      for (let j = -1; j <= 1; j += 1) {
        for (let i = -1; i <= 1; i += 1) {
          const qx = cx + i;
          const qy = cy + j;
          const k = ((qy + cells) % cells) * cells + ((qx + cells) % cells);
          const dx = qx + px[k] - gx;
          const dy = qy + py[k] - gy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            v = pv[k];
          } else if (d < d2) d2 = d;
        }
      }
      // Le galet : plein au centre de sa cellule, il tombe dans le sillon a la frontiere de ses voisines
      const e = Math.min(1, (d2 - d1) / 0.42);
      hgt[y * size + x] = e * e * (3 - 2 * e) * (0.72 + 0.28 * v);
    }
  }
  const at = (x: number, y: number): number => hgt[((y + size) % size) * size + ((x + size) % size)];
  const d = img.data;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const h = at(x, y);
      const lit = at(x - 1, y - 1) - at(x + 1, y + 1);
      const l = clamp((18 + (5.5 * (h - 0.62) - 20 * lit) * relief + (rnd() - 0.5) * 2.4) * gain);
      const o = (y * size + x) * 4;
      d[o] = clamp(l * tint[0]);
      d[o + 1] = clamp(l * tint[1]);
      d[o + 2] = clamp(l * tint[2]);
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Le noyer fume des joues (les teintes affichees de voyager/wood.ts) : le fil court le long de la joue (de haut en bas),
 * des cernes serres et legerement ondules, des fibres fines, des pores en tirets sombres. La tuile se raccorde en hauteur.
 */
function wood(w: number, h: number, seed: number): HTMLCanvasElement {
  const { c, ctx, img } = make(w, h);
  const rnd = mulberry32(seed);
  // Un bruit de valeur a une dimension, periodique
  const noise1 = (n: number): ((x: number) => number) => {
    const g = new Float32Array(n);
    for (let i = 0; i < n; i += 1) g[i] = rnd();
    return (x) => {
      const xi = Math.floor(x);
      const f = x - xi;
      const s = f * f * (3 - 2 * f);
      const a = g[((xi % n) + n) % n];
      const b = g[(((xi + 1) % n) + n) % n];
      return a + (b - a) * s;
    };
  };
  const rings = noise1(64);
  const fine = noise1(256);
  const wobA = noise1(8);
  const wobB = noise1(8);
  const slow = noise1(8);
  const lo = [22, 13, 9];
  const mid = [56, 35, 23];
  const hi = [98, 63, 40];
  const d = img.data;
  for (let y = 0; y < h; y += 1) {
    const ty = (y / h) * 8;
    const wob = (wobA(ty) - 0.5) * 7 + (wobB(ty * 2) - 0.5) * 2.5;
    const shade = 0.86 + 0.28 * slow(ty);
    for (let x = 0; x < w; x += 1) {
      const u = x + wob;
      let t = 0.62 * rings(u * 0.42) + 0.38 * fine(u * 1.9 + 31);
      t = t * t * (3 - 2 * t);
      t = Math.min(1, Math.max(0, (t - 0.18) * 1.35)) * shade;
      const o = (y * w + x) * 4;
      for (let k = 0; k < 3; k += 1) {
        const v = t < 0.5 ? lo[k] + (mid[k] - lo[k]) * (t / 0.5) : mid[k] + (hi[k] - mid[k]) * ((t - 0.5) / 0.5);
        d[o + k] = clamp(v + (rnd() - 0.5) * 3);
      }
      d[o + 3] = 255;
    }
  }
  // Les pores : des tirets sombres le long du fil
  for (let i = 0; i < (w * h) / 26; i += 1) {
    const x = Math.floor(rnd() * w);
    const y0 = Math.floor(rnd() * h);
    const len = 3 + Math.floor(rnd() * rnd() * 26);
    const k = 0.45 + 0.3 * rnd();
    for (let j = 0; j < len; j += 1) {
      const o = (((y0 + j) % h) * w + x) * 4;
      d[o] *= k;
      d[o + 1] *= k;
      d[o + 2] *= k;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const cache = new Map<string, HTMLCanvasElement>();
function once(key: string, build: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = build();
    cache.set(key, c);
  }
  return c;
}

const NEUTRAL = [1, 1, 1.01] as const;
/** Le relief du grain dans les couches HTML : a peine un fremissement (0.8 avant le 2026-11-12 : "trop de textures a la fois"). */
export const SKIN_RELIEF = 0.3;
/**
 * La tuile de simili (256 px, a afficher sur 128 px CSS : nette sur un ecran Retina) : 60 galets de cote, un grain fin
 * (38 avant le 2026-11-12). gain et tint : pour la scene 3D, dont la lumiere chaude et la courbe de tons passent sur la
 * tuile (voyager/theme.ts VOY_PLUGIN_SKIN.gain).
 */
export const leatherTile = (gain = 1, tint: readonly [number, number, number] = NEUTRAL, relief = SKIN_RELIEF): HTMLCanvasElement =>
  once(`leather:${gain}:${tint.join()}:${relief}`, () => leather(256, 60, gain, tint, relief, 0x4d4d4152));
/** La tuile de noyer des joues (80 x 640 px, a afficher sur 40 x 320 px CSS ; se repete en hauteur). */
export const woodTile = (): HTMLCanvasElement => once('wood', () => wood(80, 640, 0x574f4f44));

const urls = new Map<string, string>();
/** Une tuile en url de donnees (les fonds CSS des couches HTML). */
export function skinUrl(which: 'leather' | 'wood'): string {
  let u = urls.get(which);
  if (!u) {
    // 0.815 : le noir que rend la scene 3D avec sa propre tuile (mesure sur une capture : 14.5 sur 255 des deux cotes)
    const c = which === 'leather' ? leatherTile(0.815) : woodTile();
    u = c.toDataURL('image/png');
    urls.set(which, u);
  }
  return u;
}
