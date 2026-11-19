/**
 * Le cuir du panneau du plugin MM-ARP. v35 (2026-11-19, Mika : "c'est absolument horrible et ca ne ressemble pas du tout
 * a du cuir, je veux exactement le meme background que l'image 2", le fond de Legend HZ) : le cuir est une PHOTO, une
 * image precalculee (plugin/arp/retro/leather.png, une tuile de 1024 px en boucle pour 4 unites : un grain a plis fins
 * en biais, doux, moyenne 23 / 255, ecart-type ~4), posee telle quelle en couleur du plan. Plus de carte de normales
 * eclairee par la scene : c'etait elle (des cellules de 4 px, un relief pousse a 2.6) qui donnait le bruit scintillant
 * de la v33. Le calcul de l'image : voyager/leatherField.ts, npm run plugin:arp:leather.
 *
 * - setLeatherPhoto(url) : le plugin donne l'adresse de l'image (plugin/arp/look.ts) ; le site n'en charge aucune.
 * - leatherTile() : la texture du plan (une copie par plan : chacun sa repetition), sur une toile commune ; tant que
 *   l'image n'est pas la, un gris uni a sa moyenne.
 * - setLeatherAmount(t) : LEATHER TEXTURE (0 : le gris uni, 1 : la photo) : la toile est repeinte, la moyenne ne bouge pas.
 * - onLeatherReady(fn) : l'image est arrivee (ou la dose a change) : la scene se redessine (LookPanel.tsx FaceLook).
 * - leatherShade(w, d) : de larges nappes un rien plus claires ou plus sombres (+/- 6 %), pour les couleurs de sommets.
 */

import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import { LEATHER_MEAN, periodicNoise } from './leatherField';

/** La tuile : 1024 px pour 4 unites du panneau. */
export const LEATHER_TILE = 4.0;
const N = 1024;

const tex = (c: HTMLCanvasElement, name: string): CanvasTexture => {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = 8;
  t.name = name;
  return t;
};

let canvas: HTMLCanvasElement | null = null;
let photo: HTMLImageElement | null = null;
let amount = 1;
const tiles: CanvasTexture[] = [];
const ready = new Set<() => void>();

/** Repeint la toile commune : le gris de la moyenne, et la photo par-dessus a la dose voulue. */
function paint(): void {
  if (!canvas) return;
  const g = canvas.getContext('2d');
  if (!g) return;
  g.globalAlpha = 1;
  g.fillStyle = `rgb(${LEATHER_MEAN}, ${LEATHER_MEAN}, ${LEATHER_MEAN})`;
  g.fillRect(0, 0, N, N);
  if (photo && amount > 0) {
    g.globalAlpha = Math.min(1, amount);
    g.drawImage(photo, 0, 0, N, N);
    g.globalAlpha = 1;
  }
  for (const t of tiles) t.needsUpdate = true;
}

/** La texture du cuir pour un plan (repeat : le nombre de tuiles en large et en profondeur). */
export function leatherTile(repeatX: number, repeatY: number): CanvasTexture {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = N;
    paint();
  }
  const t = tex(canvas, 'arpLeather');
  t.repeat.set(repeatX, repeatY);
  tiles.push(t);
  return t;
}

/** L'adresse de la photo du cuir (le plugin seul) ; chargee une fois, la scene est prevenue a son arrivee. */
export function setLeatherPhoto(url: string): void {
  if (photo || typeof Image === 'undefined') return;
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    if (!(img.naturalWidth > 0)) return;
    photo = img;
    paint();
    ready.forEach((fn) => fn());
  };
  img.src = url;
}

/** LEATHER TEXTURE (0..1) : la part de la photo sur le gris uni ; true si la toile a ete repeinte. */
export function setLeatherAmount(t: number): boolean {
  const a = Math.round(Math.min(1, Math.max(0, t)) * 100) / 100;
  if (a === amount) return false;
  amount = a;
  paint();
  return true;
}

/** Previent quand la photo est arrivee (la scene, a la demande, doit se redessiner) ; rend de quoi se desabonner. */
export function onLeatherReady(fn: () => void): () => void {
  ready.add(fn);
  return () => {
    ready.delete(fn);
  };
}

/** De larges nappes de lumiere sur un plan de w x d unites (u, v de 0 a 1) : un gain autour de 1 (+/- 6 %). */
export function leatherShade(w: number, d: number, seed: number): (u: number, v: number) => number {
  const big = periodicNoise(seed, Math.max(2, Math.round(w / 2.6)), Math.max(2, Math.round(d / 2.6)));
  const mid = periodicNoise(seed + 7, Math.max(3, Math.round(w / 0.9)), Math.max(3, Math.round(d / 0.9)));
  return (u, v) => 1 + 0.09 * (big(u, v) - 0.5) + 0.04 * (mid(u, v) - 0.5);
}
