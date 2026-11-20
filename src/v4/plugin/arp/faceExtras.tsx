/**
 * La face du plugin, v27 (2026-11-17 ; la maquette v26 validee par Mika : "ok code et publie") :
 * - les petits knobs canneles en 3D dans la scene (FM, RATIO, OSC 1, OSC 2, NOISE, SUB, SUB WAVE ; DETUNE et SPREAD) :
 *   une prise noire a 30 cannelures et un moletage fin, un dessus plat un peu plus clair, un repere blanc du centre au bord.
 *   Ils tournent avec leur reglage ; les potards du MM-RYTM a leur place sont caches (voyager/knobs.ts FLUTED_DIALS), leurs
 *   zones de prise restent (le geste de toujours, la valeur sur l'ecran, l'arc de modulation : FaceModArcs.tsx) ;
 * - SUB OCT devient un levier 3D : une fente noire arrondie, une capsule chrome couchee a gauche (-1) ou a droite (-2) ;
 *   la zone de prise du poussoir d'avant reste (un clic bascule) ;
 * - DETUNE (STACK) et SPREAD (WIDE) dans la colonne OUTPUT, sous le logotype, relies par un trait (49.jpg) : des zones de
 *   prise de potards du MM-ARP (v:stack, v:wide) ;
 * - l'encart d'EDIT : les sections synthe de l'ancienne page SOUND (OSCILLATORS, OSC +, VOICE, FILTER, FILTER +, AMP,
 *   PERFORMANCE, OUTPUT) sur un panneau noir qui monte a la place des pads, en deux rangees, avec des petits knobs, des
 *   leviers et des touches 3D, leurs noms serigraphies ; chaque piece a sa zone de prise (un DialId z:ed:<id>, comme
 *   HELL) : glisser regle, un clic bascule un levier ou passe une touche au cran suivant (hellKnob.tsx faceDbl), la
 *   valeur s'ecrit sur l'ecran de la machine. Les notes de la suite vont a la page SEQ : le verre ne prend plus de geste.
 */

import { useEffect } from 'react';
import {
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  EquirectangularReflectionMapping,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  Shape,
  SRGBColorSpace,
  Vector2,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Stage } from '../../scene/renderer';
import type { HotspotDef } from '../../scene/hit';
import { potAngle } from '../../scene/encoders';
import { registerDialSpec } from '../../scene/screen/menus/registry';
import { editor } from '../../state/editor';
import { FONT_DISPLAY, PORTRAIT, type EncId } from '../../theme';
import { FLUTED_DIALS } from '../../voyager/knobs';
import { voyMsg } from '../../voyager/msg';
import { voyKnob, voyParams, voyValueText, type VoyKnobId } from '../../voyager/params';
import { VOY_SEQ } from '../../voyager/seqscreen';
import { voySilkExtraKnob } from '../../voyager/silk';
import { VOY_DS_PLACE, VOY_KNOB, voyKnobPlace } from '../../voyager/theme';
import { arpExtra, extraParam, isExtra } from './extra';
import { VKnobSet } from './vknob';
import { VKNOB_LIFT, attachVKnobs } from './vknobFace';

voySilkExtraKnob('panel', 'DETUNE', VOY_DS_PLACE.detune.x, VOY_DS_PLACE.detune.labelZ);
voySilkExtraKnob('panel', 'SPREAD', VOY_DS_PLACE.spread.x, VOY_DS_PLACE.spread.labelZ);

/* ---------------- les environnements (reflets) ---------------- */

function equirect(draw: (g: CanvasRenderingContext2D) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  draw(c.getContext('2d')!);
  const t = new CanvasTexture(c);
  t.mapping = EquirectangularReflectionMapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}
/** Le noir des knobs : un studio sombre, une bande claire sous l'horizon (les flancs canneles en pente l'accrochent). */
const knobEnv = (): CanvasTexture =>
  equirect((g) => {
    const v = g.createLinearGradient(0, 0, 0, 512);
    v.addColorStop(0, '#2a2928');
    v.addColorStop(0.4, '#1a1918');
    v.addColorStop(0.55, '#3a3836');
    v.addColorStop(0.66, '#c4c1bc');
    v.addColorStop(0.74, '#3a3836');
    v.addColorStop(1, '#0a0a0a');
    g.fillStyle = v;
    g.fillRect(0, 0, 1024, 512);
  });
/** Le chrome : un ciel clair, une bande nette pres du zenith, un horizon noir, une lumiere a gauche. */
const chromeEnv = (): CanvasTexture =>
  equirect((g) => {
    const v = g.createLinearGradient(0, 0, 0, 512);
    v.addColorStop(0, '#eeede9');
    v.addColorStop(0.08, '#e2e0dc');
    v.addColorStop(0.13, '#c4c2be');
    v.addColorStop(0.2, '#9a9894');
    v.addColorStop(0.3, '#6a6866');
    v.addColorStop(0.4, '#3a3836');
    v.addColorStop(0.5, '#0a0a0a');
    v.addColorStop(0.6, '#1a1a1a');
    v.addColorStop(1, '#4a4846');
    g.fillStyle = v;
    g.fillRect(0, 0, 1024, 512);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 26, 1024, 12);
    for (const dx of [-1024, 0, 1024]) {
      const gr = g.createRadialGradient(dx, 110, 0, dx, 110, 150);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(dx - 150, -40, 300, 300);
    }
  });

/* ---------------- les geometries ---------------- */

function colored(g: BufferGeometry, hex: string): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  out.deleteAttribute('uv');
  const c = new Color(hex);
  const n = out.getAttribute('position').count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    a[3 * i] = c.r;
    a[3 * i + 1] = c.g;
    a[3 * i + 2] = c.b;
  }
  out.setAttribute('color', new Float32BufferAttribute(a, 3));
  return out;
}

/** Le petit knob cannele (unites du potard ; rayon 0.24 au pied, 0.2 de haut), son repere vers -z (comme les autres). */
function flutedGeometry(): BufferGeometry {
  const prof = [
    [0.152, 0.2],
    [0.168, 0.196],
    [0.182, 0.185],
    [0.21, 0.13],
    [0.23, 0.06],
    [0.24, 0.018],
    [0.24, 0],
  ].map(([r, y]) => new Vector2(r, y));
  const skirt = new LatheGeometry(prof, 240);
  const p = skirt.getAttribute('position');
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.175) continue;
    const a = Math.atan2(z, x);
    const w = Math.min(1, (r - 0.175) / 0.03);
    const k = 1 - w * (0.04 * (0.5 + 0.5 * Math.cos(a * 30)) + 0.006 * (0.5 + 0.5 * Math.cos(a * 120)));
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  skirt.computeVertexNormals();
  const top = new LatheGeometry([new Vector2(0.0001, 0.2), new Vector2(0.146, 0.2), new Vector2(0.154, 0.198)], 96);
  const mark = new BoxGeometry(0.018, 0.006, 0.142);
  mark.translate(0, 0.203, -0.077);
  const g = mergeGeometries([colored(skirt, '#1d1d1f'), colored(top, '#38383a'), colored(mark, '#f1ede5')], false);
  if (!g) throw new Error('faceMock : knob');
  return g;
}

function rounded(w: number, d: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + d - r);
  s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + d);
  s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
function roundedPath(w: number, d: number, r: number): Path {
  const p = new Path();
  const x = -w / 2;
  const y = -d / 2;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x + w, y + d - r);
  p.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  p.lineTo(x + r, y + d);
  p.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(x, y + r);
  p.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return p;
}

/**
 * Le levier (unites du levier : 0.6 x 0.27) : le boitier noir creuse d'une fente, son fond, la capsule chrome a gauche et
 * a droite (une seule se voit : set(right)). Construit une fois.
 */
interface Lever {
  group: Group;
  set: (right: boolean) => void;
  dispose: () => void;
}
function leverOf(mats: { body: MeshStandardMaterial; floor: MeshStandardMaterial; chrome: MeshStandardMaterial }): Lever {
  const grp = new Group();
  const sh = rounded(0.6, 0.27, 0.135);
  sh.holes.push(roundedPath(0.43, 0.18, 0.09));
  const body = new ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 4, curveSegments: 32 });
  body.rotateX(-Math.PI / 2);
  grp.add(new Mesh(body, mats.body));
  const floor = new CircleGeometry(1, 48);
  floor.scale(0.23, 0.1, 1);
  floor.rotateX(-Math.PI / 2);
  floor.translate(0, 0.004, 0);
  grp.add(new Mesh(floor, mats.floor));
  const cap = new CapsuleGeometry(0.08, 0.09, 12, 48);
  cap.rotateZ(Math.PI / 2);
  const l = new Mesh(cap, mats.chrome);
  const r = new Mesh(cap, mats.chrome);
  l.position.set(-0.085, 0.08, 0);
  r.position.set(0.085, 0.08, 0);
  l.castShadow = r.castShadow = true;
  grp.add(l, r);
  return {
    group: grp,
    set: (right) => {
      l.visible = !right;
      r.visible = right;
    },
    dispose: () => {
      body.dispose();
      floor.dispose();
      cap.dispose();
    },
  };
}

/* ---------------- l'encart d'EDIT ---------------- */

type Ctl = { k: 'knob' | 'lever' | 'keys'; id: string; name: string; steps?: readonly string[] };
const knob = (id: string, name: string): Ctl => ({ k: 'knob', id, name });
const lever = (id: string, name: string, steps: readonly string[]): Ctl => ({ k: 'lever', id, name, steps });
const keys = (id: string, name: string, steps: readonly string[]): Ctl => ({ k: 'keys', id, name, steps });
const ROWS: { title: string; ctls: Ctl[] }[][] = [
  [
    { title: 'OSCILLATORS', ctls: [knob('phase', 'PHASE'), knob('drift', 'DRIFT'), lever('sync', 'SYNC', ['OFF', 'ON'])] },
    { title: 'OSC +', ctls: [knob('xRing', 'RING MOD'), knob('xFold', 'FOLD'), knob('xNoiseColor', 'NOISE'), keys('xUnison', 'UNISON', ['OFF', '5', '7'])] },
    { title: 'VOICE', ctls: [keys('xVoiceMode', 'MODE', ['POLY', 'MONO', 'LEGATO']), knob('xPbRange', 'BEND')] },
    { title: 'FILTER', ctls: [knob('load', 'LOAD'), knob('space', 'SPACE'), knob('keyTrack', 'KEY TRACK'), lever('fpol', 'POLARITY', ['POS', 'NEG'])] },
  ],
  [
    { title: 'FILTER +', ctls: [knob('xHpf', 'HIGH PASS'), knob('xComb', 'COMB'), knob('xCombFb', 'COMB FB')] },
    { title: 'AMP', ctls: [knob('xFeedback', 'FEEDBACK'), keys('xAmpMode', 'AMP MODE', ['CLEAN', 'TRIODE', 'PENTODE', 'SAT'])] },
    { title: 'PERFORMANCE', ctls: [knob('accent', 'ACCENT'), knob('accFlt', 'ACC FILTER'), knob('chord', 'CHORD')] },
    { title: 'OUTPUT', ctls: [knob('width', 'WIDTH'), knob('monoLow', 'BASS MONO'), knob('glue', 'GLUE'), knob('duck', 'SIDECHAIN')] },
  ],
];
const CELL = { knob: 0.76, lever: 0.92 } as const;
const cellW = (c: Ctl): number => (c.k === 'keys' ? Math.max(0.9, (c.steps?.length ?? 3) * (c.steps!.some((s) => s.length > 4) ? 0.44 : 0.32)) : CELL[c.k]);
const GAP = 0.34;
const valOf = (id: string): number => (isExtra(id) ? arpExtra.of(id) : voyParams.of(id as VoyKnobId));
const setOf = (id: string, v: number): void => {
  if (isExtra(id)) arpExtra.set(id, v);
  else voyParams.set(id as VoyKnobId, v);
};
const defOf = (id: string): number => (isExtra(id) ? arpExtra.def(id) : voyParams.def(id as VoyKnobId));
const textOf = (id: string, v: number = valOf(id)): string => (isExtra(id) ? arpExtra.text(id, v) : voyValueText(id as VoyKnobId, v));
/** Les crans du reglage lui-meme (0 : continu). */
const stepsOf = (id: string): number => (isExtra(id) ? (extraParam(id)?.steps?.length ?? 0) : (voyKnob(id as VoyKnobId).steps?.length ?? 0));

/** Le DialId d'une piece de l'encart. */
export const ED = 'z:ed:';
const CTLS: Ctl[] = ROWS.flat().flatMap((f) => f.ctls);
for (const c of CTLS) {
  registerDialSpec(ED + c.id, {
    value: () => valOf(c.id),
    set: (v) => {
      const n = stepsOf(c.id);
      const x = Math.min(1, Math.max(0, v));
      setOf(c.id, n > 1 ? Math.round(x * (n - 1)) / (n - 1) : x);
      voyMsg.show(`${c.name} ${textOf(c.id)}`, 1800);
    },
    range: () => [0, 1] as const,
    steps: () => 0,
    text: (v) => textOf(c.id, v),
    unit: () => '',
    reset: () => defOf(c.id),
    say: (v) => `${c.name} ${textOf(c.id, v)}`,
  });
}

/**
 * Le clic d'une piece de l'encart (hellKnob.tsx faceDbl) : un levier bascule, une touche passe au cran suivant ; un
 * knob ne fait rien (le clic est pris). false : pas une piece de l'encart.
 */
export function encartTap(dial: string): boolean {
  if (!dial.startsWith(ED)) return false;
  const c = CTLS.find((x) => ED + x.id === dial);
  if (!c) return false;
  if (c.k === 'knob') return true;
  const n = Math.max(2, stepsOf(c.id));
  const i = Math.round(valOf(c.id) * (n - 1));
  setOf(c.id, ((i + 1) % n) / (n - 1));
  voyMsg.show(`${c.name} ${textOf(c.id)}`, 1800);
  return true;
}

/** Le petit knob cannele : son rayon au pied (unites du potard), sa hauteur, l'echelle de ceux de la face. */
export const FLUTED = { r: 0.24, h: 0.2, scale: 0.9 } as const;

/**
 * Ou dessiner l'arc de modulation d'un knob ajoute (FaceModArcs.tsx) : DETUNE (stack), et les pieces de l'encart
 * (RING MOD, FOLD, COMB) tant qu'il est ouvert ; le calque, le centre et le rayon de l'arc.
 */
export const faceArcPlaces = new Map<string, { layer: Group; x: number; z: number; y: number; R: number; live: () => boolean }>();


/** Les places de l'encart (repere du plateau) et sa serigraphie (la texture du panneau). */
function encart(): { tex: CanvasTexture; place: { c: Ctl; x: number; z: number }[]; scale: number } {
  const gw = VOY_SEQ.w - 2 * VOY_SEQ.bezel;
  const gd = VOY_SEQ.d - 2 * VOY_SEQ.bezel;
  const W = 4096;
  const H = Math.round((W * gd) / gw);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const X0 = VOY_SEQ.x - gw / 2;
  const Z0 = VOY_SEQ.z - gd / 2;
  const px = (x: number): number => ((x - X0) / gw) * W;
  const py = (z: number): number => ((z - Z0) / gd) * H;
  const U = W / gw;
  // le panneau : un noir anodise, un rien plus clair en haut, son liseré
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a1a1b');
  bg.addColorStop(1, '#0f0f10');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i += 1) {
    g.fillStyle = `rgba(255,255,255,${(Math.random() * 0.025).toFixed(3)})`;
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  g.strokeStyle = 'rgba(255, 250, 240, 0.12)';
  g.lineWidth = 3;
  g.strokeRect(6, 6, W - 12, H - 12);
  const ink = 'rgba(238, 234, 226, 0.92)';
  const dim = 'rgba(238, 234, 226, 0.55)';
  const text = (s: string, x: number, z: number, cap: number, weight: number, col: string, spacing = 0.18): void => {
    g.font = `${weight} ${Math.round(cap * U * 1.38)}px ${FONT_DISPLAY}`;
    (g as unknown as { letterSpacing: string }).letterSpacing = `${(cap * U * spacing).toFixed(1)}px`;
    g.fillStyle = col;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(s, px(x), py(z));
  };
  const scale = 0.72;
  const r = 0.24 * scale;
  const rows = [Z0 + 0.42, Z0 + 1.22];
  const place: { c: Ctl; x: number; z: number }[] = [];
  ROWS.forEach((row, ri) => {
    const z = rows[ri];
    const total = row.reduce((s, f) => s + f.ctls.reduce((t, c2) => t + cellW(c2), 0), 0) + GAP * (row.length - 1);
    let x = VOY_SEQ.x - total / 2;
    row.forEach((f, fi) => {
      const fw = f.ctls.reduce((t, c2) => t + cellW(c2), 0);
      text(f.title, x + fw / 2, z - r - 0.16, 0.072, 700, ink, 0.24);
      let cx = x;
      for (const ct of f.ctls) {
        const w = cellW(ct);
        const mx = cx + w / 2;
        place.push({ c: ct, x: mx, z });
        text(ct.name, mx, z + r + 0.1, 0.058, 600, ink, 0.16);
        if (ct.k === 'lever' && ct.steps) {
          text(ct.steps[0], mx - 0.17, z + 0.18, 0.044, 600, dim, 0.1);
          text(ct.steps[1], mx + 0.17, z + 0.18, 0.044, 600, dim, 0.1);
        }
        if (ct.k === 'keys' && ct.steps) {
          const n = ct.steps.length;
          const step = Math.min(0.42, (w - 0.08) / n);
          ct.steps.forEach((s, i) => text(s, mx + (i - (n - 1) / 2) * step, z - 0.21, 0.042, 600, dim, 0.08));
        }
        cx += w;
      }
      if (fi < row.length - 1) {
        g.fillStyle = 'rgba(255, 250, 240, 0.14)';
        g.fillRect(px(x + fw + GAP / 2) - 2, py(z - r - 0.24), 4, (0.68 + r) * U);
      }
      x += fw + GAP;
    });
  });
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, place, scale };
}

/* ---------------- dans la scene ---------------- */

export const FaceExtras: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  useEffect(() => {
    const rig = stage?.voy;
    if (!stage || !rig) return undefined;
    const kEnv = knobEnv();
    const cEnv = chromeEnv();
    const knobMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.12, envMap: kEnv, envMapIntensity: 0.9, side: DoubleSide });
    const geo = flutedGeometry();
    const mats = {
      body: new MeshStandardMaterial({ color: '#0d0d0e', roughness: 0.42, metalness: 0.1, envMap: kEnv, envMapIntensity: 0.6 }),
      floor: new MeshStandardMaterial({ color: '#030303', roughness: 0.9, metalness: 0 }),
      chrome: new MeshStandardMaterial({ color: '#f2f2f4', roughness: 0.1, metalness: 1, envMap: cEnv, envMapIntensity: 1.05 }),
    };
    const added: { parent: Group; obj: Mesh | Group }[] = [];
    const levers: Lever[] = [];
    const turns: (() => void)[] = [];
    const defs: HotspotDef[] = [];
    const disposers: (() => void)[] = [];
    // v43 (Mika : "remplace tous ceux que tu as faits noirs par celui-la") : les potards de la face sont ses PNG
    // (vknobFace.ts) ; les petits de la face (FM, RATIO, OSC 1..., DETUNE, SPREAD) : son petit knob (vknob.ts k3), meme
    // centre, meme rayon exterieur (celui du petit knob cannele d'avant). Ceux de l'encart d'EDIT ne changent pas.
    const offFace = attachVKnobs(stage);
    let nSmall = 0;
    const small = new VKnobSet('k3', FLUTED_DIALS.size + 2);
    const addSmall = (x: number, z: number, s: number, id: string): void => {
      const i = nSmall;
      nSmall += 1;
      small.place(i, x, VKNOB_LIFT, z, FLUTED.r * s);
      turns.push(() => small.setAngle(i, potAngle(valOf(id))));
    };
    rig.panel.add(...small.meshes);
    // 1. les petits knobs de la face (leurs zones de prise : celles des potards d'avant, vk-<id>)
    for (const id of FLUTED_DIALS) {
      const pl = voyKnobPlace(id);
      addSmall(pl.x, pl.z, FLUTED.scale, id);
    }
    // 2. DETUNE (stack) et SPREAD (wide) : deux potards du MM-ARP de plus sur la face
    for (const [id, pl] of [
      ['stack', VOY_DS_PLACE.detune],
      ['wide', VOY_DS_PLACE.spread],
    ] as const) {
      addSmall(pl.x, pl.z, pl.s, id);
      const r = Math.max(VOY_KNOB.touchR, FLUTED.r * pl.s);
      defs.push({ id: `vds-${id}`, kind: 'vknob', vknob: id, layer: rig.panel, shape: 'disc', x: pl.x, z: pl.z, hx: r, hz: r, y0: 0, y1: FLUTED.h * pl.s, enabled: true, machine: 'voy' });
      if (id === 'stack') faceArcPlaces.set('stack', { layer: rig.panel, x: pl.x, z: pl.z, y: 0.004, R: FLUTED.r * pl.s * 1.13, live: () => true });
    }
    // 3. SUB OCT : v43 (Mika : "tous les boutons, meme CHORUS ... SUB OCT") : plus de levier, sa touche-pilule revient
    //    (voyager/pads.ts), ses LED -1 / -2 restent
    // 4. l'encart d'EDIT : le panneau serigraphie et ses pieces 3D, enfants de l'ecran qui monte ; chacune sa zone de prise
    const sq = rig.seqScreen;
    let panelTex: CanvasTexture | null = null;
    let panelMat: MeshStandardMaterial | null = null;
    const edDefs: HotspotDef[] = [];
    if (sq && !PORTRAIT) {
      const e = encart();
      panelTex = e.tex;
      panelMat = new MeshStandardMaterial({ map: e.tex, roughness: 0.78, metalness: 0.05 });
      sq.cover(panelMat);
      sq.inert = true;
      const y = VOY_SEQ.h + 0.004;
      const ledOn = new MeshBasicMaterial({ color: '#ff3b2f' });
      const ledOff = new MeshBasicMaterial({ color: '#3a0e0a' });
      const keyMat = new MeshStandardMaterial({ color: '#262524', roughness: 0.5, metalness: 0.05 });
      const keyGeo = new BoxGeometry(0.42, 0.07, 0.24);
      keyGeo.translate(0, 0.035, 0);
      const ledGeo = new CircleGeometry(0.026, 20);
      ledGeo.rotateX(-Math.PI / 2);
      for (const p of e.place) {
        const id = p.c.id;
        let hx = 0.2;
        let hz = 0.2;
        let y1 = y + 0.1;
        if (p.c.k === 'knob') {
          const m = new Mesh(geo, knobMat);
          m.position.set(p.x, y, p.z);
          m.scale.setScalar(e.scale);
          m.castShadow = true;
          sq.group.add(m);
          added.push({ parent: sq.group, obj: m });
          turns.push(() => m.rotation.set(0, potAngle(valOf(id)), 0));
          hx = hz = Math.max(0.2, FLUTED.r * e.scale * 1.15);
          y1 = y + FLUTED.h * e.scale;
          if (id === 'xRing' || id === 'xFold' || id === 'xComb')
            faceArcPlaces.set(id, { layer: sq.group, x: p.x, z: p.z, y: y + 0.004, R: FLUTED.r * e.scale * 1.13, live: () => editor.get() === 'voy' });
        } else if (p.c.k === 'lever') {
          const lv = leverOf(mats);
          lv.group.position.set(p.x, y, p.z);
          lv.group.scale.setScalar(0.9);
          sq.group.add(lv.group);
          added.push({ parent: sq.group, obj: lv.group });
          levers.push(lv);
          turns.push(() => lv.set(valOf(id) >= 0.5));
          hx = 0.3;
          hz = 0.16;
          y1 = y + 0.17;
        } else {
          const n = p.c.steps?.length ?? 3;
          const k = new Mesh(keyGeo, keyMat);
          k.position.set(p.x, y, p.z + 0.05);
          k.castShadow = true;
          sq.group.add(k);
          added.push({ parent: sq.group, obj: k });
          const w = cellW(p.c);
          const step = Math.min(0.42, (w - 0.08) / n);
          const leds: Mesh[] = [];
          for (let i = 0; i < n; i += 1) {
            const led = new Mesh(ledGeo, ledOff);
            led.position.set(p.x + (i - (n - 1) / 2) * step, y + 0.004, p.z - 0.12);
            sq.group.add(led);
            added.push({ parent: sq.group, obj: led });
            leds.push(led);
          }
          turns.push(() => {
            const idx = Math.max(0, Math.min(n - 1, Math.round(valOf(id) * (n - 1))));
            leds.forEach((l, i) => (l.material = i === idx ? ledOn : ledOff));
          });
          hx = Math.max(0.24, w / 2 - 0.04);
          hz = 0.24;
          y1 = y + 0.08;
        }
        edDefs.push({ id: `ved-${id}`, kind: 'encoder', param: (ED + id) as EncId, layer: sq.group, shape: p.c.k === 'knob' ? 'disc' : 'box', x: p.x, z: p.z + (p.c.k === 'keys' ? -0.02 : 0), hx, hz, y0: 0, y1, enabled: false, machine: 'voy' });
      }
      disposers.push(() => {
        keyGeo.dispose();
        ledGeo.dispose();
        keyMat.dispose();
        ledOn.dispose();
        ledOff.dispose();
      });
    }
    stage.hit.add([...defs, ...edDefs]);
    // les zones de l'encart ne prennent que tant qu'il est monte (EDIT)
    const syncEdit = (): void => {
      const on = editor.get() === 'voy';
      let ch = false;
      for (const d of edDefs)
        if (d.enabled !== on) {
          d.enabled = on;
          ch = true;
        }
      if (ch) stage.hit.invalidate();
    };
    syncEdit();
    const offEd = editor.subscribe(syncEdit);
    // ?probe (les essais sans son, Chromium) : ou tombe une zone de prise a l'ecran, et ce qui est pris en (x, y)
    if (typeof location !== 'undefined' && location.search.includes('probe'))
      (window as unknown as { __mmProbe?: unknown }).__mmProbe = {
        at: (id: string) => {
          const v = stage.hit.list().find((h) => h.id === id);
          return v ? { x: v.cx, y: v.cy, enabled: v.enabled } : null;
        },
        pick: (x: number, y: number) => stage.hit.pick(x, y, false)?.id ?? null,
        ids: () => stage.hit.list().map((h) => h.id),
        params: () => ({ ...voyParams.get(), ...arpExtra.get() }),
        msg: () => voyMsg.get(),
        // v31 : la cadence du rendu (frames rendues, rAF, temps JS des rendus, DPR, taille du canevas)
        stats: () => ({ frames: stage.stats.frames, rafs: stage.stats.rafs, renderMs: stage.stats.renderMs, dpr: stage.stats.dpr, loop: stage.stats.loopActive }),
        stage: () => stage,
      };
    const turn = (): void => {
      for (const t of turns) t();
      stage.invalidate();
    };
    turn();
    const off1 = voyParams.subscribe(turn);
    const off2 = arpExtra.subscribe(turn);
    return () => {
      off1();
      off2();
      offEd();
      offFace();
      rig.panel.remove(...small.meshes);
      small.dispose();
      for (const d of [...defs, ...edDefs]) d.enabled = false;
      stage.hit.invalidate();
      for (const a of added) a.parent.remove(a.obj);
      for (const l of levers) l.dispose();
      for (const d of disposers) d();
      if (sq) {
        sq.cover(null);
        sq.inert = false;
      }
      faceArcPlaces.clear();
      panelTex?.dispose();
      panelMat?.dispose();
      geo.dispose();
      knobMat.dispose();
      kEnv.dispose();
      cEnv.dispose();
      mats.body.dispose();
      mats.floor.dispose();
      mats.chrome.dispose();
    };
  }, [stage]);
  return null;
};
