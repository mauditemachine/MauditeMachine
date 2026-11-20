/**
 * v43 (Mika, 2026-11-20 : "conserve la qualite et remplace tous les knobs de ce style par ce png la", puis le selecteur
 * pour WAVEFORM et RANGE, et le petit pour FM, RATIO...) : les knobs de la face, redessines a chaque image d'apres ses
 * trois PNG (plugin/mm-arp/web/vknob-src), nets a toutes les tailles :
 * - k1 : le potard (jupe a six lobes, gorge sombre, capuchon de metal brosse conique, repere clair sur la jupe) ;
 * - k3 : le petit (meme famille, capuchon plus petit, repere a midi) ;
 * - sel : le selecteur (disque noir mat, barre en relief, petit capuchon brosse, repere clair encadre de noir).
 * Un quad par knob, couche dans le plan du panneau ou du plateau (il suit le capot a l'OPEN), un InstancedMesh par
 * famille et par plan ; le shader calcule chaque pixel : les bords (disque, capuchon, gorge, repere) sont des formes
 * (antialiasees au pixel, nettes a toutes les tailles), les matieres viennent des tables mesurees sur les PNG
 * (vknob-gen.py) : la prise ou la face SANS la lumiere (elles tournent avec la valeur), la lumiere a part (fixe : elle
 * ne tourne pas), le brossage du capuchon selon l'angle (fixe, ses stries fines calculees). Le repere tourne avec la
 * prise. Les pages d'OPEN dessinent le meme potard sur une toile (paintVKnob, le meme calcul en JS).
 */

import {
  ClampToEdgeWrapping,
  DataTexture,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  ShaderMaterial,
  Vector3,
  type Texture,
} from 'three';
import SPEC from './vknob/vknobSpec.json';
import k1Grip from './vknob/k1-grip.png';
import k1Light from './vknob/k1-light.png';
import k1Lut from './vknob/k1-lut.png';
import k3Grip from './vknob/k3-grip.png';
import k3Light from './vknob/k3-light.png';
import k3Lut from './vknob/k3-lut.png';
import selGrip from './vknob/sel-grip.png';
import selLight from './vknob/sel-light.png';
import selLut from './vknob/sel-lut.png';

export type VKnobKind = 'k1' | 'k3' | 'sel';
const URLS: Record<VKnobKind, [string, string, string]> = {
  k1: [k1Grip, k1Light, k1Lut],
  k3: [k3Grip, k3Light, k3Lut],
  sel: [selGrip, selLight, selLut],
};

/** Le pas en rayon des tables polaires (vknob-gen.py DR). */
const DR = 0.002;
/** Le quad deborde du disque pour l'ombre portee. */
export const VKNOB_QUAD = 1.16;
/** L'ombre portee : courte, vers le bas a droite (la lumiere vient du haut a gauche), sa force. */
const SHADOW = { dx: 0.035, dy: 0.06, a: 0.5 } as const;

interface Img {
  w: number;
  h: number;
  px: Uint8ClampedArray;
}
interface KindData {
  spec: (typeof SPEC)['k1'] | (typeof SPEC)['sel'];
  grip: Img;
  light: Img;
  cap: Img;
  mark: Img;
}

function loadImg(url: string): Promise<Img> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = im.naturalWidth;
      c.height = im.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      if (!g) return reject(new Error('vknob: no 2d'));
      g.drawImage(im, 0, 0);
      resolve({ w: c.width, h: c.height, px: g.getImageData(0, 0, c.width, c.height).data });
    };
    im.onerror = () => reject(new Error(`vknob: ${url}`));
    im.src = url;
  });
}

/** Une rangee d'une image (la table du capuchon : rangee 0 ; du repere : rangee 1). */
const row = (im: Img, y: number): Img => ({ w: im.w, h: 1, px: im.px.slice(y * im.w * 4, (y + 1) * im.w * 4) });

let loading: Promise<Record<VKnobKind, KindData>> | null = null;
let loaded: Record<VKnobKind, KindData> | null = null;
/** Les tables des trois knobs (chargees une fois). */
export function vknobData(): Promise<Record<VKnobKind, KindData>> {
  if (!loading)
    loading = Promise.all(
      (Object.keys(URLS) as VKnobKind[]).map(async (k) => {
        const [g, l, u] = await Promise.all(URLS[k].map(loadImg));
        return [k, { spec: SPEC[k], grip: g, light: l, cap: row(u, 0), mark: row(u, 1) }] as const;
      })
    ).then((list) => {
      loaded = Object.fromEntries(list) as Record<VKnobKind, KindData>;
      return loaded;
    });
  return loading;
}

function tex(im: Img, wrapS: typeof RepeatWrapping | typeof ClampToEdgeWrapping, mips: boolean): DataTexture {
  const t = new DataTexture(new Uint8Array(im.px.buffer.slice(im.px.byteOffset, im.px.byteOffset + im.px.byteLength)), im.w, im.h);
  t.wrapS = wrapS;
  t.wrapT = ClampToEdgeWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = mips ? LinearMipmapLinearFilter : LinearFilter;
  t.generateMipmaps = mips;
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}

/* ---------------- le shader ---------------- */

const VERT = /* glsl */ `
attribute float aAngle;
varying vec2 vP;
varying float vA;
void main() {
  vP = position.xz;
  vA = aAngle;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tGrip;
uniform sampler2D tLight;
uniform sampler2D tCap;
uniform sampler2D tMark;
uniform float uReady;
uniform float uSel;
uniform vec2 uGripSize;
uniform vec2 uGripR;
uniform vec2 uLightR;
uniform vec2 uLightSize;
uniform float uN;
uniform float uRcap;
uniform float uRef;
uniform vec4 uMark;
uniform vec2 uGroove;
uniform float uEdge;
uniform vec4 uSelBox;
uniform vec3 uShadow;
uniform float uNC;
varying vec2 vP;
varying float vA;
const float TAU = 6.283185307179586;
const vec2 LIGHT = vec2(-0.70710678, -0.70710678);

float hash1(float n) { return fract(sin(n) * 43758.5453123); }
// un bruit periodique (f valeurs par tour) : les stries du brossage
float vnoise(float x, float f, float seed) {
  float i = floor(x);
  float t = x - i;
  return mix(hash1(mod(i, f) + seed), hash1(mod(i + 1.0, f) + seed), t) * 2.0 - 1.0;
}
// rot(p, d) : p tourne de d dans le sens horaire de l'ecran (x a droite, y en bas)
vec2 rot(vec2 p, float d) {
  float c = cos(d);
  float s = sin(d);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}
vec3 lightK(float r, float th) {
  float v = (clamp(r, uLightR.x, uLightR.y) - uLightR.x) / (uLightR.y - uLightR.x);
  return textureLod(tLight, vec2(th / TAU + 0.5 / uLightSize.x, (v * (uLightSize.y - 1.0) + 0.5) / uLightSize.y), 0.0).rgb * 2.0;
}

void main() {
  if (uReady < 0.5) discard;
  vec2 p = vP;
  float r = length(p);
  float px = max(max(fwidth(p.x), fwidth(p.y)), 1e-4);
  float th = atan(p.x, -p.y);
  float thp = th < 0.0 ? th + TAU : th;
  float disc = clamp((1.0 - r) / px + 0.5, 0.0, 1.0);
  float sh = uShadow.z * (1.0 - smoothstep(0.9, 1.07, length(p - uShadow.xy)));
  float A = disc + sh * (1.0 - disc);
  if (A < 0.002) discard;
  vec3 col = vec3(0.0);
  if (disc > 0.0) {
    vec3 K = lightK(r, thp);
    // la prise ou la face, sans la lumiere, qui tourne avec la valeur ; puis la lumiere fixe
    if (uSel < 0.5) {
      float per = TAU / uN;
      float u = th - vA;
      float ph = mod(u + 0.5 * per, per) - 0.5 * per;
      float a = abs(ph) / (0.5 * per);
      float v = (clamp(r, uGripR.x, uGripR.y) - uGripR.x) / (uGripR.y - uGripR.x);
      col = texture2D(tGrip, vec2(a, (v * (uGripSize.y - 1.0) + 0.5) / uGripSize.y)).rgb * K;
    } else {
      vec2 q = rot(p, uRef - vA);
      col = texture2D(tGrip, uSelBox.xy + q * uSelBox.zw).rgb * 2.0 * K;
    }
    // la gorge au pied du capuchon, le bord arrondi du disque (fixes)
    float gr = clamp((r - uRcap) / uGroove.x, 0.0, 1.0);
    col *= 1.0 - uGroove.y * (1.0 - gr);
    col *= 1.0 - uEdge * smoothstep(0.975, 1.0, r);
    // le repere : dans le repere du knob (vers le haut a la valeur du milieu)
    vec2 m = rot(p, -vA);
    float along = -m.y;
    float across = m.x;
    float hw = 0.5 * uMark.x;
    float inR = clamp((along - uMark.y) / px + 0.5, 0.0, 1.0) * clamp((uMark.z - along) / px + 0.5, 0.0, 1.0);
    float cov = clamp((hw - abs(across)) / px + 0.5, 0.0, 1.0) * inR;
    if (uMark.w > 0.0) {
      float b = uMark.w;
      float cb = clamp((hw + b - abs(across)) / px + 0.5, 0.0, 1.0) * clamp((along - uMark.y + b) / px + 0.5, 0.0, 1.0) * clamp((uMark.z + b - along) / px + 0.5, 0.0, 1.0);
      col = mix(col, vec3(0.012), cb);
    } else {
      // le flanc du repere tourne vers l'ombre : un filet sombre dehors
      float f = dot(vec2(cos(vA), sin(vA)), LIGHT);
      float side = f > 0.0 ? -1.0 : 1.0;
      float dist = side * across - hw;
      float line = clamp(1.0 - dist / 0.014, 0.0, 1.0) * clamp(dist / px + 0.5, 0.0, 1.0) * inR;
      col *= 1.0 - 0.75 * min(1.0, abs(f) * 1.6) * line;
    }
    float t = clamp((along - uMark.y) / (uMark.z - uMark.y), 0.0, 1.0);
    vec3 mc = textureLod(tMark, vec2((t * (uNC - 1.0) + 0.5) / uNC, 0.5), 0.0).rgb * K;
    col = mix(col, mc, cov);
    // le capuchon de metal brosse : fixe (son reflet ne tourne pas), ses stries fines
    float capCov = clamp((uRcap - r) / px + 0.5, 0.0, 1.0);
    if (capCov > 0.0) {
      float pa = px / max(r, 1e-3);
      float lod = log2(max(pa * uNC / TAU, 1.0));
      vec3 cc = textureLod(tCap, vec2(thp / TAU + 0.5 / uNC, 0.5), lod).rgb;
      float x = thp / TAU;
      float n = 0.6 * vnoise(x * 1440.0, 1440.0, 1.7) * clamp(1.0 - 2.0 * 1440.0 * pa / TAU, 0.0, 1.0)
              + 0.8 * vnoise(x * 3600.0, 3600.0, 5.3) * clamp(1.0 - 2.0 * 3600.0 * pa / TAU, 0.0, 1.0)
              + 0.8 * vnoise(x * 7200.0, 7200.0, 9.1) * clamp(1.0 - 2.0 * 7200.0 * pa / TAU, 0.0, 1.0);
      cc *= 1.0 + 0.024 * n;
      col = mix(col, cc, capCov);
    }
  }
  gl_FragColor = vec4(col * disc / A, A);
}`;

interface KindGpu {
  mat: ShaderMaterial;
  ready: boolean;
}
const gpu = new Map<VKnobKind, KindGpu>();
const waiters = new Set<() => void>();

function uniformsOf(kind: VKnobKind) {
  const s = SPEC[kind] as (typeof SPEC)['sel'] & (typeof SPEC)['k1'];
  const sel = s.kind === 'selector';
  return {
    tGrip: { value: null as Texture | null },
    tLight: { value: null as Texture | null },
    tCap: { value: null as Texture | null },
    tMark: { value: null as Texture | null },
    uReady: { value: 0 },
    uSel: { value: sel ? 1 : 0 },
    uGripSize: { value: [s.grip[0], s.grip[1]] },
    uGripR: { value: [s.r0, s.r0 + (s.grip[1] - 1) * DR] },
    uLightR: { value: [s.r0, s.r1] },
    uLightSize: { value: [128, 1] },
    uN: { value: sel ? 1 : s.n },
    uRcap: { value: s.rcap },
    uRef: { value: (s.ref * Math.PI) / 180 },
    uMark: { value: [s.mark.w, s.mark.r0, s.mark.r1, s.mark.border] },
    uGroove: { value: [s.groove.w, s.groove.k] },
    uEdge: { value: s.edge },
    uSelBox: { value: sel ? [s.center[0], s.center[1], s.radius[0], s.radius[1]] : [0, 0, 0, 0] },
    uShadow: { value: [SHADOW.dx, SHADOW.dy, SHADOW.a] },
    uNC: { value: 2048 },
  };
}

/** Le materiau d'une famille (partage par tous ses knobs) ; ses tables arrivent apres (vknobData), il ne dessine qu'alors. */
export function vknobMaterial(kind: VKnobKind): ShaderMaterial {
  const have = gpu.get(kind);
  if (have) return have.mat;
  const mat = new ShaderMaterial({
    uniforms: uniformsOf(kind),
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  mat.name = `vknob-${kind}`;
  const g: KindGpu = { mat, ready: false };
  gpu.set(kind, g);
  void vknobData().then((all) => {
    const d = all[kind];
    const u = mat.uniforms;
    u.tGrip.value = tex(d.grip, ClampToEdgeWrapping, true);
    const lt = tex(d.light, RepeatWrapping, false);
    u.tLight.value = lt;
    u.uLightSize.value = [d.light.w, d.light.h];
    u.uLightR.value = [d.spec.r0, d.spec.r0 + (d.light.h - 1) * DR];
    u.tCap.value = tex(d.cap, RepeatWrapping, true);
    u.tMark.value = tex(d.mark, ClampToEdgeWrapping, false);
    u.uNC.value = d.cap.w;
    u.uReady.value = 1;
    g.ready = true;
    for (const w of waiters) w();
  });
  return mat;
}

/** Appele quand une famille est prete (la scene redessine). */
export function onVKnobReady(fn: () => void): () => void {
  waiters.add(fn);
  return () => waiters.delete(fn);
}
export const vknobReady = (kind: VKnobKind): boolean => gpu.get(kind)?.ready ?? false;

/* ---------------- un jeu de knobs (un InstancedMesh) ---------------- */

const m4 = new Matrix4();
const vpos = new Vector3();
const vscl = new Vector3();
const qid = new Quaternion();
let quad: PlaneGeometry | null = null;

/**
 * Les knobs d'une famille sur un plan (panneau, plateau, encart) : un quad chacun, couche (y vers le haut), son centre,
 * son rayon (celui du disque exterieur), son angle (repere : radians, sens horaire vu de face, 0 en haut).
 */
export class VKnobSet {
  readonly mesh: InstancedMesh;
  private ang: InstancedBufferAttribute;
  constructor(
    readonly kind: VKnobKind,
    count: number
  ) {
    if (!quad) {
      quad = new PlaneGeometry(2 * VKNOB_QUAD, 2 * VKNOB_QUAD);
      quad.rotateX(-Math.PI / 2);
    }
    this.mesh = new InstancedMesh(quad, vknobMaterial(kind), count);
    this.mesh.name = `vknobs-${kind}`;
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false;
    this.ang = new InstancedBufferAttribute(new Float32Array(count), 1);
    this.ang.setUsage(DynamicDrawUsage);
    this.mesh.geometry = quad.clone();
    this.mesh.geometry.setAttribute('aAngle', this.ang);
  }

  /** Le knob i : son centre (repere du plan ; y : sa hauteur au-dessus du plan), son rayon exterieur. */
  place(i: number, x: number, y: number, z: number, R: number): void {
    this.mesh.setMatrixAt(i, m4.compose(vpos.set(x, y, z), qid, vscl.setScalar(R)));
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** L'angle du repere (radians, horaire) ; true s'il a change. */
  setAngle(i: number, a: number): boolean {
    const v = Math.fround(a);
    if (this.ang.getX(i) === v) return false;
    this.ang.setX(i, v);
    this.ang.needsUpdate = true;
    return true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

/* ---------------- le meme potard sur une toile (les pages d'OPEN) ---------------- */

interface Prep {
  n: number;
  r: Float32Array;
  th: Float32Array;
  K: Float32Array;
  cap: Float32Array;
  capCov: Float32Array;
  disc: Float32Array;
  fix: Float32Array;
  px: number;
}
const preps = new Map<string, Prep>();

const fract = (x: number): number => x - Math.floor(x);
const hash1 = (n: number): number => fract(Math.sin(n) * 43758.5453123);
const vnoise = (x: number, f: number, seed: number): number => {
  const i = Math.floor(x);
  const t = x - i;
  const a = hash1((((i % f) + f) % f) + seed);
  const b = hash1(((((i + 1) % f) + f) % f) + seed);
  return (a + (b - a) * t) * 2 - 1;
};
const TAU = Math.PI * 2;

function sampleRow(im: Img, x: number, out: Float32Array, o: number, wrap: boolean): void {
  // x en texels (centre du texel i a i + 0.5)
  const f = x - 0.5;
  let i0 = Math.floor(f);
  const t = f - i0;
  let i1 = i0 + 1;
  if (wrap) {
    i0 = ((i0 % im.w) + im.w) % im.w;
    i1 = ((i1 % im.w) + im.w) % im.w;
  } else {
    i0 = Math.min(im.w - 1, Math.max(0, i0));
    i1 = Math.min(im.w - 1, Math.max(0, i1));
  }
  const p = im.px;
  for (let c = 0; c < 3; c += 1) out[o + c] = (p[i0 * 4 + c] * (1 - t) + p[i1 * 4 + c] * t) / 255;
}

function sample2(im: Img, u: number, v: number, out: Float32Array, o: number, wrapU: boolean): void {
  const fx = u * im.w - 0.5;
  const fy = Math.min(im.h - 1, Math.max(0, v * im.h - 0.5));
  let x0 = Math.floor(fx);
  const tx = fx - x0;
  let x1 = x0 + 1;
  if (wrapU) {
    x0 = ((x0 % im.w) + im.w) % im.w;
    x1 = ((x1 % im.w) + im.w) % im.w;
  } else {
    x0 = Math.min(im.w - 1, Math.max(0, x0));
    x1 = Math.min(im.w - 1, Math.max(0, x1));
  }
  const y0 = Math.floor(fy);
  const ty = fy - y0;
  const y1 = Math.min(im.h - 1, y0 + 1);
  const p = im.px;
  for (let c = 0; c < 3; c += 1) {
    const a = p[(y0 * im.w + x0) * 4 + c] * (1 - tx) + p[(y0 * im.w + x1) * 4 + c] * tx;
    const b = p[(y1 * im.w + x0) * 4 + c] * (1 - tx) + p[(y1 * im.w + x1) * 4 + c] * tx;
    out[o + c] = (a * (1 - ty) + b * ty) / 255;
  }
}

/** Une table de la prise reduite de moitie (minification sur une petite toile). */
const gripMips = new Map<string, Img[]>();
function mipsOf(kind: VKnobKind, im: Img): Img[] {
  const have = gripMips.get(kind);
  if (have) return have;
  const out = [im];
  let cur = im;
  while (cur.w > 8 && cur.h > 8 && out.length < 6) {
    const w = Math.max(1, cur.w >> 1);
    const h = Math.max(1, cur.h >> 1);
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y += 1)
      for (let x = 0; x < w; x += 1)
        for (let c = 0; c < 4; c += 1) {
          const s = (xx: number, yy: number): number => cur.px[(Math.min(cur.h - 1, yy) * cur.w + Math.min(cur.w - 1, xx)) * 4 + c];
          px[(y * w + x) * 4 + c] = (s(2 * x, 2 * y) + s(2 * x + 1, 2 * y) + s(2 * x, 2 * y + 1) + s(2 * x + 1, 2 * y + 1)) / 4;
        }
    cur = { w, h, px };
    out.push(cur);
  }
  gripMips.set(kind, out);
  return out;
}

/**
 * Le potard (k1 ou k3) sur une toile de S x S pixels, le disque de rayon S / 2 / box (box : la marge autour, 1.04 aux
 * pages d'OPEN), son repere a l'angle a (radians, horaire, 0 en haut). false tant que les tables ne sont pas la.
 */
export function paintVKnob(ctx: CanvasRenderingContext2D, S: number, kind: 'k1' | 'k3', a: number, box = 1.04): boolean {
  const all = loaded;
  if (!all) return false;
  const d = all[kind];
  const s = d.spec as (typeof SPEC)['k1'];
  const key = `${kind}:${S}:${box}`;
  let P = preps.get(key);
  const R = S / 2 / box;
  const pxR = 1 / R;
  if (!P) {
    const n = S * S;
    P = { n, r: new Float32Array(n), th: new Float32Array(n), K: new Float32Array(n * 3), cap: new Float32Array(n * 3), capCov: new Float32Array(n), disc: new Float32Array(n), fix: new Float32Array(n), px: pxR };
    const lr0 = s.r0;
    const lr1 = s.r0 + (d.light.h - 1) * DR;
    for (let y = 0; y < S; y += 1)
      for (let x = 0; x < S; x += 1) {
        const i = y * S + x;
        const vx = (x + 0.5 - S / 2) / R;
        const vy = (y + 0.5 - S / 2) / R;
        const r = Math.hypot(vx, vy);
        let th = Math.atan2(vx, -vy);
        if (th < 0) th += TAU;
        P.r[i] = r;
        P.th[i] = th;
        P.disc[i] = Math.min(1, Math.max(0, (1 - r) / pxR + 0.5));
        const v = (Math.min(lr1, Math.max(lr0, r)) - lr0) / (lr1 - lr0);
        sample2(d.light, th / TAU + 0.5 / d.light.w, (v * (d.light.h - 1) + 0.5) / d.light.h, P.K, i * 3, true);
        for (let c = 0; c < 3; c += 1) P.K[i * 3 + c] *= 2;
        const gr = Math.min(1, Math.max(0, (r - s.rcap) / s.groove.w));
        const e = Math.min(1, Math.max(0, (r - 0.975) / 0.025));
        P.fix[i] = (1 - s.groove.k * (1 - gr)) * (1 - s.edge * e * e * (3 - 2 * e));
        const cc = Math.min(1, Math.max(0, (s.rcap - r) / pxR + 0.5));
        P.capCov[i] = cc;
        if (cc > 0) {
          // le brossage, moyenne sur l'empreinte du pixel en angle (quelques echantillons)
          const pa = pxR / Math.max(r, 1e-3);
          const acc = [0, 0, 0];
          const tmp = new Float32Array(3);
          const N = Math.min(24, Math.max(1, Math.ceil((pa * d.cap.w) / TAU)));
          for (let k = 0; k < N; k += 1) {
            const t2 = th + ((k + 0.5) / N - 0.5) * pa;
            sampleRow(d.cap, (t2 / TAU) * d.cap.w + 0.5, tmp, 0, true);
            acc[0] += tmp[0];
            acc[1] += tmp[1];
            acc[2] += tmp[2];
          }
          const xx = th / TAU;
          const nz =
            0.6 * vnoise(xx * 1440, 1440, 1.7) * Math.min(1, Math.max(0, 1 - (2 * 1440 * pa) / TAU)) +
            0.8 * vnoise(xx * 3600, 3600, 5.3) * Math.min(1, Math.max(0, 1 - (2 * 3600 * pa) / TAU)) +
            0.8 * vnoise(xx * 7200, 7200, 9.1) * Math.min(1, Math.max(0, 1 - (2 * 7200 * pa) / TAU));
          for (let c = 0; c < 3; c += 1) P.cap[i * 3 + c] = (acc[c] / N) * (1 + 0.024 * nz);
        }
      }
    preps.set(key, P);
  }
  const img = ctx.createImageData(S, S);
  const out = img.data;
  const per = TAU / s.n;
  const mips = mipsOf(kind, d.grip);
  const g0 = d.grip;
  const r0 = s.r0;
  const r1 = s.r0 + (g0.h - 1) * DR;
  const hw = s.mark.w / 2;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const f = -0.70710678 * ca - 0.70710678 * sa;
  const side = f > 0 ? -1 : 1;
  const tmp = new Float32Array(3);
  const mk = new Float32Array(3);
  for (let i = 0; i < P.n; i += 1) {
    const disc = P.disc[i];
    const o = i * 4;
    if (disc <= 0) {
      out[o + 3] = 0;
      continue;
    }
    const r = P.r[i];
    const th = P.th[i];
    let cr: number;
    let cg: number;
    let cb: number;
    if (P.capCov[i] >= 1) {
      cr = P.cap[i * 3];
      cg = P.cap[i * 3 + 1];
      cb = P.cap[i * 3 + 2];
    } else {
      const u = th - a;
      const ph = (((u + 0.5 * per) % per) + per) % per - 0.5 * per;
      const aa = Math.abs(ph) / (0.5 * per);
      const v = (Math.min(r1, Math.max(r0, r)) - r0) / (r1 - r0);
      // la reduction : l'empreinte du pixel en phase (texels de la table)
      const foot = (pxR / Math.max(r, 0.05) / (0.5 * per)) * g0.w;
      const lvl = Math.min(mips.length - 1, Math.max(0, Math.floor(Math.log2(Math.max(1, foot)))));
      const im = mips[lvl];
      sample2(im, aa, (v * (g0.h - 1) + 0.5) / g0.h, tmp, 0, false);
      const k = P.fix[i];
      cr = tmp[0] * P.K[i * 3] * k;
      cg = tmp[1] * P.K[i * 3 + 1] * k;
      cb = tmp[2] * P.K[i * 3 + 2] * k;
      // le repere (dans le repere du knob)
      const vx = r * Math.sin(th);
      const vy = -r * Math.cos(th);
      const mx = ca * vx + sa * vy;
      const my = -sa * vx + ca * vy;
      const along = -my;
      const across = mx;
      const inR = Math.min(1, Math.max(0, (along - s.mark.r0) / pxR + 0.5)) * Math.min(1, Math.max(0, (s.mark.r1 - along) / pxR + 0.5));
      if (inR > 0) {
        const dist = side * across - hw;
        const line = Math.min(1, Math.max(0, 1 - dist / 0.014)) * Math.min(1, Math.max(0, dist / pxR + 0.5)) * inR;
        const dk = 1 - 0.75 * Math.min(1, Math.abs(f) * 1.6) * line;
        cr *= dk;
        cg *= dk;
        cb *= dk;
        const cov = Math.min(1, Math.max(0, (hw - Math.abs(across)) / pxR + 0.5)) * inR;
        if (cov > 0) {
          const t = Math.min(1, Math.max(0, (along - s.mark.r0) / (s.mark.r1 - s.mark.r0)));
          sampleRow(d.mark, t * (d.mark.w - 1) + 0.5, mk, 0, false);
          cr += (mk[0] * P.K[i * 3] - cr) * cov;
          cg += (mk[1] * P.K[i * 3 + 1] - cg) * cov;
          cb += (mk[2] * P.K[i * 3 + 2] - cb) * cov;
        }
      }
      const c2 = P.capCov[i];
      if (c2 > 0) {
        cr += (P.cap[i * 3] - cr) * c2;
        cg += (P.cap[i * 3 + 1] - cg) * c2;
        cb += (P.cap[i * 3 + 2] - cb) * c2;
      }
    }
    out[o] = cr * 255;
    out[o + 1] = cg * 255;
    out[o + 2] = cb * 255;
    out[o + 3] = disc * 255;
  }
  ctx.putImageData(img, 0, 0);
  return true;
}
