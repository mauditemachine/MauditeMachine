/**
 * Le potard du MM-RYTM, pour le plugin MM-ARP (2026-11-16, Mika : "je veux le design des knobs de MM-RYTM, sans la
 * couronne de petits carres : on a l'arc lumineux"). Le meme potard que celui du plugin MM-RYTM, d'apres la photo de Mika
 * : la base ronde presque noire et son reflet, la prise noire a six lobes, le grand capuchon de metal brosse (chrome) et
 * ses deux reflets, le repere blanc epais d'un seul morceau, du bord du capuchon presque au bord de la base. Ses cotes et
 * ses gris viennent de rytm/knobLook.ts (le module du MM-RYTM, repris tel quel) ; la geometrie et la peinture du dessus
 * sont celles de scene/encoders.ts du MM-RYTM (moogGeometry, moogTopGeometry, moogTexture, branche du plugin MM-RYTM),
 * recopiees ici pour ne pas toucher au MM-RYTM, avec les cotes des potards du MM-ARP (VOY_KNOB) a la place des siennes.
 *
 * Deux maillages, comme au MM-RYTM : ce qui tourne (rytmKnobGeometry : la prise, son chanfrein, son dessus, le flanc du
 * capuchon, le repere) et ce qui ne tourne pas (rytmKnobTopGeometry : la base et le dessus du capuchon, peints par
 * rytmKnobTexture : leurs reflets restent face a la lumiere). Le plugin MM-ARP seul (voyager/knobs.ts, PLUGIN_ARP).
 */

import { CanvasTexture, CircleGeometry, EquirectangularReflectionMapping, Float32BufferAttribute, LatheGeometry, LinearFilter, LinearMipmapLinearFilter, RingGeometry, SRGBColorSpace, Vector2, BoxGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { KNOB_LOOK, baseGrey, capGrey, gripRadius, streak } from '../rytm/knobLook';
import { albedoRgb, paintLinear } from '../scene/materials';
import { LIT, gainOf } from '../theme';

/**
 * Les cotes du potard (unites du potard, avant son echelle : voyager/theme.ts SIZE_SCALE) : la base au rayon de la jupe
 * des potards du MM-ARP (un rien plus large, comme le MM-RYTM : x 1.06), la hauteur dans le rapport du MM-RYTM.
 */
export const RYTM_KNOB = { R: 0.3, h: 0.15, markH: 0.012 } as const;

const MOOG = { hBase: 0.22, hGrip: 0.6 } as const;
interface Dims {
  R: number;
  rc: number;
  h1: number;
  h2: number;
  h3: number;
  b: number;
  seg: number;
}
function dims(mobile: boolean): Dims {
  const R = RYTM_KNOB.R;
  const h = RYTM_KNOB.h;
  return { R, rc: R * KNOB_LOOK.cap, h1: h * MOOG.hBase, h2: h * MOOG.hGrip, h3: h, b: R * 0.04, seg: mobile ? 96 : 320 };
}

/** Une geometrie non indexee, sans uv. */
function flat(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g.clone();
  g.dispose();
  out.deleteAttribute('uv');
  return out;
}

/** Un tour de revolution deforme en prise a six lobes : tout au bord, rien au pied du capuchon. */
function lobed(g: BufferGeometry, D: Dims): void {
  const rl = D.R * KNOB_LOOK.lobe;
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const a = Math.atan2(x, -z);
    const out = Math.max(0, Math.min(1, (r - D.rc) / (rl - D.rc)));
    // 2026-11-16 : la jupe cannelee (40 cannelures fines sur le flanc), plus definie. v33 (maquette, Mika : "de
    // l'aliasing sur les knobs") : un profil arrondi (cosinus) au lieu de la pointe |cos|^0.6, dont l'arete faisait
    // scintiller les reflets d'un pixel a l'autre quand le knob tourne ; la meme profondeur
    const flute = out > 0.98 ? 0.018 * (0.5 + 0.5 * Math.cos(a * 40)) : 0;
    const f = (1 + (gripRadius(a) / KNOB_LOOK.lobe - 1) * out) * (1 - flute);
    p.setX(i, x * f);
    p.setZ(i, z * f);
  }
  g.computeVertexNormals();
}

/** Les facteurs d'albedo de la prise (MM-RYTM MOOG_GRIP). */
const GRIP = { wall: 0.75, bevel: 3.2, top: 0.95 } as const;

/** Ce qui tourne : la prise a six lobes, son chanfrein, son dessus, le flanc du capuchon, le repere (withMark). */
export function rytmKnobGeometry(mobile: boolean, withMark = true): BufferGeometry {
  const D = dims(mobile);
  const rl = D.R * KNOB_LOOK.lobe;
  const wall = new LatheGeometry([new Vector2(rl, D.h1 * 0.5), new Vector2(rl, D.h2 - D.b)], D.seg);
  lobed(wall, D);
  const bevel = new LatheGeometry([new Vector2(rl, D.h2 - D.b), new Vector2(rl - D.b, D.h2)], D.seg);
  lobed(bevel, D);
  const top = new LatheGeometry([new Vector2(rl - D.b, D.h2), new Vector2((rl - D.b + D.rc) / 2, D.h2), new Vector2(D.rc, D.h2)], D.seg);
  lobed(top, D);
  const capWall = new LatheGeometry([new Vector2(D.rc, D.h2), new Vector2(D.rc, D.h3)], D.seg);
  const parts: BufferGeometry[] = [wall, bevel, top, capWall];
  if (withMark) {
    // Le repere blanc epais, d'un seul morceau : du bord du capuchon presque au bord de la base (vers l'arriere, -z : midi)
    const r0 = D.rc * 0.99;
    const r1 = D.R * KNOB_LOOK.markEnd;
    const mark = new BoxGeometry(D.R * KNOB_LOOK.markW, RYTM_KNOB.markH * 1.5, r1 - r0);
    mark.translate(0, D.h2 + RYTM_KNOB.markH * 0.75, -(r0 + r1) / 2);
    parts.push(mark);
  }
  const fp = parts.map(flat);
  const body = albedoRgb('encoder', gainOf('encoder'));
  paintLinear(fp[0], body.map((v) => v * GRIP.wall));
  paintLinear(fp[1], body.map((v) => v * GRIP.bevel));
  paintLinear(fp[2], body.map((v) => v * GRIP.top));
  paintLinear(fp[3], body.map((v) => v * 0.9));
  if (fp[4]) paintLinear(fp[4], LIT.mark);
  const g = mergeGeometries(fp, false);
  for (const q of fp) q.dispose();
  if (!g) throw new Error('rytmKnob: merge failed');
  return g;
}

/** Le gris voulu a l'ecran (0 a 255) -> le facteur de l'albedo (MM-RYTM moogF, MOOG_CAL). */
const CAL = { k: 36.7, p: 2.54 } as const;
const moogF = (srgb: number): number => Math.pow(Math.max(4, srgb) / CAL.k, CAL.p) * (1 + Math.max(0, (srgb - 220) / 35) * 1.4);
const FMAX = moogF(255);
const EXT = 1.02;

let tex: CanvasTexture | null = null;
/** La peinture du dessus immobile (la base et le capuchon) : la meme image que le MM-RYTM (moogTexture). */
export function rytmKnobTexture(): CanvasTexture {
  if (tex) return tex;
  // v38 (Mika : "a tres grande taille les knobs pixellisent") : 1024 (512 avant) : le capuchon fait jusqu a ~340 px a
  // 2640 de large en DPR 2 ; 512 en donnait ~300 au capuchon, il etait agrandi
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('rytmKnob: no 2d context');
  const img = ctx.createImageData(S, S);
  const enc = (lin: number): number => {
    const v = Math.max(0, Math.min(1, lin));
    return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
  };
  const noise = (a: number, bins: number, seed: number): number => {
    const t = ((a + Math.PI) / (2 * Math.PI)) * bins;
    const i = Math.floor(t);
    const f = t - i;
    return streak((i % bins) + seed) * (1 - f) + streak(((i + 1) % bins) + seed) * f;
  };
  let mean = 0;
  for (let i = 0; i < 72; i += 1) mean += capGrey((i / 72) * Math.PI * 2) / 72;
  const capR = KNOB_LOOK.cap * 0.985;
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const px = (((x + 0.5) / S) * 2 - 1) * EXT;
      const pz = (((y + 0.5) / S) * 2 - 1) * EXT;
      const rr = Math.hypot(px, pz);
      const a = Math.atan2(pz, px);
      const lit = rr > 1e-6 ? 0.5 - (0.5 * (px + pz)) / (Math.SQRT2 * rr) : 0.5;
      let g: number;
      if (rr <= capR + 0.01) {
        const k = rr / capR;
        g = capGrey(a) * (1 + 0.05 * noise(a, 900, 0) + 0.03 * noise(a, 150, 977));
        // 2026-11-16 : le brossage circulaire (des cercles d'usinage fins, irreguliers) et un leger bombe
        g *= 1 + 0.07 * streak(Math.floor(k * 190)) + 0.035 * Math.sin(k * 520) - 0.08 * k * k;
        if (k < 0.07) g = mean + (g - mean) * (k / 0.07);
        if (k > 0.94) g *= 0.62 + 0.7 * lit;
      } else {
        const edge = Math.max(0, (rr - 0.93) / 0.07);
        const ao = 0.7 + 0.3 * Math.min(1, Math.max(0, (rr - 0.8) / 0.1));
        g = baseGrey(a) * ao * (1 - 0.25 * Math.min(1, edge) * Math.min(1, edge));
      }
      const v = enc(moogF(Math.min(255, g)) / FMAX);
      const o = (y * S + x) * 4;
      img.data[o] = v;
      img.data[o + 1] = v;
      img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 16; // v33 : le filtrage anisotrope au plus (three le borne a la carte) : le brossage net en biais
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.name = 'arpKnobTop';
  tex = t;
  return t;
}

/** Ce qui ne tourne pas : la base ronde et le dessus du capuchon (l'image), le flanc de la base, sombre. */
export function rytmKnobTopGeometry(mobile: boolean): BufferGeometry {
  const D = dims(mobile);
  const body = albedoRgb('encoder', gainOf('encoder'));
  const white = body.map((v) => v * FMAX);
  const mapped = (g: BufferGeometry, rgb: readonly number[]): BufferGeometry => {
    const out = flat(g);
    const p = out.getAttribute('position');
    const uv = new Float32Array(p.count * 2);
    const k = 1 / (2 * EXT * D.R);
    for (let i = 0; i < p.count; i += 1) {
      uv[i * 2] = 0.5 + p.getX(i) * k;
      uv[i * 2 + 1] = 0.5 - p.getZ(i) * k;
    }
    out.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    paintLinear(out, rgb);
    return out;
  };
  const seg = mobile ? 64 : 120;
  const base = new RingGeometry(D.R * (KNOB_LOOK.notch - 0.04), D.R, seg, 1);
  base.rotateX(-Math.PI / 2);
  base.translate(0, D.h1, 0);
  const side = new LatheGeometry([new Vector2(D.R, 0), new Vector2(D.R, D.h1)], seg);
  const cap = new CircleGeometry(D.rc * 0.985, seg);
  cap.rotateX(-Math.PI / 2);
  cap.translate(0, D.h3, 0);
  const parts = [mapped(base, white), mapped(side, white.map((v) => v * 0.35)), mapped(cap, white)];
  const g = mergeGeometries(parts, false);
  for (const q of parts) q.dispose();
  if (!g) throw new Error('rytmKnob: merge failed');
  return g;
}

/**
 * v33 (maquette, Mika : "des beaux knobs moog qui tournent bien avec des reflets") : un studio pour les reflets des
 * potards seulement (leurs materiaux, pas la scene) : une piece sombre, une grande softbox en haut a gauche, une bande
 * etroite a droite, un reflet de sol ; equirectangulaire, peinte une fois. Les cannelures et le chanfrein du capuchon y
 * accrochent des lumieres qui bougent quand le potard tourne.
 */
let studio: CanvasTexture | null = null;
export function studioEnv(): CanvasTexture {
  if (studio) return studio;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d')!;
  const v = g.createLinearGradient(0, 0, 0, 512);
  v.addColorStop(0, '#1c1b1a');
  v.addColorStop(0.45, '#0e0e0e');
  v.addColorStop(0.6, '#262422');
  v.addColorStop(1, '#070707');
  g.fillStyle = v;
  g.fillRect(0, 0, 1024, 512);
  const box = (x: number, y: number, w: number, h: number, a: number): void => {
    const r = g.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
    r.addColorStop(0, `rgba(255,252,246,${a})`);
    r.addColorStop(0.55, `rgba(240,236,230,${a * 0.85})`);
    r.addColorStop(1, 'rgba(240,236,230,0)');
    g.fillStyle = r;
    g.fillRect(x - w * 0.2, y - h * 0.2, w * 1.4, h * 1.4);
  };
  box(150, 70, 260, 150, 1); // la grande softbox, en haut a gauche
  box(700, 120, 60, 210, 0.85); // la bande, a droite
  box(460, 40, 120, 60, 0.5); // un petit plafonnier
  const t = new CanvasTexture(c);
  t.mapping = EquirectangularReflectionMapping;
  t.colorSpace = SRGBColorSpace;
  studio = t;
  return t;
}
