/**
 * v43 (Mika, 2026-11-20 : "remplace tous les knobs de ce style par ce png la", puis "je ne veux pas que tu redessines")
 * : les knobs de la face sont SES PNG, ses pixels (plugin/mm-arp/web/vknob-src), seulement decoupes au masque
 * (vknob-cut.py) pour que le capuchon reste fixe quand il le peut :
 * - k1 (le potard) : le PNG entier tourne (son repere deborde sur le capuchon) ;
 * - k3 (le petit) et sel (le selecteur) : le PNG entier tourne, son capuchon (decoupe au disque) reste fixe par-dessus.
 * Chaque calque : un quad couche dans le plan du panneau ou du plateau (il suit le capot a l'OPEN), un InstancedMesh par
 * calque, famille et plan. La texture : premultipliee (pas de lisere sombre au bord), mipmaps, filtrage anisotrope ; le
 * shader rend ses pixels tels quels (ni lumiere de la scene, ni courbe de tons). Le repere d'origine du PNG est compense
 * (k1 vers 1 h, le selecteur vers 2 h) : il pointe sur la valeur. Sous chaque knob, une ombre portee douce et fixe (la
 * meme que celle des potards des pages d'OPEN), qui ne touche pas au PNG.
 */

import {
  CanvasTexture,
  ClampToEdgeWrapping,
  CustomBlending,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  NoColorSpace,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Texture,
  Vector3,
  type Object3D,
} from 'three';
import SPEC from './vknob/vknobSpec.json';
import k1Url from './vknob/k1.png';
import k1Mip from './vknob/k1-mip.png';
import k3Mip from './vknob/k3-mip.png';
import k3CapMip from './vknob/k3-cap-mip.png';
import selMip from './vknob/sel-mip.png';
import selCapMip from './vknob/sel-cap-mip.png';
import tinyUrl from './vknob/tiny.png';
import tinyShadowUrl from './vknob/tiny-shadow.png';

export type VKnobKind = 'k1' | 'k3' | 'sel';
type SpecOf = { w: number; h: number; cx: number; cy: number; R: number; ax: number; ay: number; ref: number; cap: boolean; capR?: number; mips?: number[][] };
/** Les mesures des PNG (vknob-cut.py) : leur taille, le disque, l'axe de rotation, l'angle du repere d'origine. */
export const VKNOB_SPEC = SPEC as unknown as Record<VKnobKind | 'tiny', SpecOf>;
/** Les PNG (les pages d'OPEN les posent en CSS : pcbui.tsx). */
export const VKNOB_URL = { k1: k1Url, tiny: tinyUrl, tinyShadow: tinyShadowUrl } as const;
/** Les planches des reductions (vknob-cut.py : le niveau 0 puis chaque moitie, Lanczos sur l'alpha premultiplie). */
const URL_OF: Record<VKnobKind, { rot: string; cap: string | null }> = {
  k1: { rot: k1Mip, cap: null },
  k3: { rot: k3Mip, cap: k3CapMip },
  sel: { rot: selMip, cap: selCapMip },
};

/** L'ombre portee : sa taille (rayons du disque), son decalage vers le bas a droite, sa force. */
const SHADOW = { size: 1.24, dx: 0.04, dz: 0.09, a: 0.6 } as const;

/* ---------------- textures et materiaux ---------------- */

const texCache = new Map<string, Texture>();
let pending = 0;
const waiters = new Set<() => void>();
/** Appele a l'arrivee de chaque PNG (la scene redessine). */
export function onVKnobLoad(fn: () => void): () => void {
  waiters.add(fn);
  return () => waiters.delete(fn);
}
/** true quand tous les PNG demandes sont la. */
export const vknobLoaded = (): boolean => pending === 0;

/**
 * La texture d'un calque : ses reductions precalculees (la planche, coupee en niveaux), envoyees telles quelles (pas de
 * reduction par la carte graphique), premultipliees a l'envoi (le filtrage ne fonce pas le bord), filtrage trilineaire.
 */
function pngTexture(url: string, sizes: number[][]): Texture {
  const have = texCache.get(url);
  if (have) return have;
  pending += 1;
  const t = new Texture();
  const img = new Image();
  img.onload = () => {
    let x = 0;
    const levels = sizes.map(([w, h]) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')?.drawImage(img, x, 0, w, h, 0, 0, w, h);
      x += w;
      return c;
    });
    t.image = levels[0];
    t.mipmaps = levels;
    t.needsUpdate = true;
    pending -= 1;
    for (const w of waiters) w();
  };
  img.src = url;
  t.premultiplyAlpha = true;
  t.colorSpace = NoColorSpace;
  t.generateMipmaps = false;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.wrapS = ClampToEdgeWrapping;
  t.wrapT = ClampToEdgeWrapping;
  t.anisotropy = 4;
  t.name = url;
  texCache.set(url, t);
  return t;
}

let shadowTex: CanvasTexture | null = null;
function shadowTexture(): CanvasTexture {
  if (shadowTex) return shadowTex;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;
  // un disque flou : opaque jusqu'a ~ 0.8 du rayon du knob, nul a 1.24 (premultiplie : noir)
  const k = S / 2 / SHADOW.size;
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, `rgba(0,0,0,${SHADOW.a})`);
  grd.addColorStop((0.8 * k) / (S / 2), `rgba(0,0,0,${SHADOW.a})`);
  grd.addColorStop((1.05 * k) / (S / 2), `rgba(0,0,0,${(SHADOW.a * 0.35).toFixed(3)})`);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const t = new CanvasTexture(c);
  t.colorSpace = NoColorSpace;
  t.premultiplyAlpha = true;
  shadowTex = t;
  return t;
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const FRAG = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
void main() {
  // un rien plus net que le filtrage trilineaire seul (les reductions sont deja filtrees : pas de crenelage)
  vec4 c = texture2D(map, vUv, -0.3);
  if (c.a < 0.002) discard;
  gl_FragColor = c;
}`;

const matCache = new Map<Texture, ShaderMaterial>();
/** Le materiau d'un calque : ses pixels premultiplies, sans lumiere ni courbe de tons, fondus par-dessus. */
function layerMaterial(map: Texture, order: number): ShaderMaterial {
  const have = matCache.get(map);
  if (have) return have;
  const m = new ShaderMaterial({
    uniforms: { map: { value: map } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
    polygonOffset: true,
    polygonOffsetFactor: -4 - order,
    polygonOffsetUnits: -4 - order,
  });
  m.name = 'vknob';
  matCache.set(map, m);
  return m;
}

/** Le quad d'un PNG : couche (y vers le haut), centre sur l'axe de rotation, en rayons du disque ; ses uv sur le PNG. */
const geoCache = new Map<VKnobKind, PlaneGeometry>();
function quadOf(kind: VKnobKind): PlaneGeometry {
  const have = geoCache.get(kind);
  if (have) return have;
  const s = VKNOB_SPEC[kind];
  // assez grand pour tout le disque (l'axe peut etre un rien decentre)
  const Q = (s.R + Math.hypot(s.cx - s.ax, s.cy - s.ay) + 2) / s.R;
  const g = new PlaneGeometry(2 * Q, 2 * Q);
  g.rotateX(-Math.PI / 2);
  const p = g.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i += 1) {
    // x vers la droite, z vers le bas de l'image ; image : y vers le bas, uv : v = 1 en haut (flipY)
    uv[i * 2] = (s.ax + p.getX(i) * s.R) / s.w;
    uv[i * 2 + 1] = 1 - (s.ay + p.getZ(i) * s.R) / s.h;
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geoCache.set(kind, g);
  return g;
}
let shadowQuad: PlaneGeometry | null = null;

/* ---------------- un jeu de knobs ---------------- */

const m4 = new Matrix4();
const vp = new Vector3();
const vs = new Vector3();
const q = new Quaternion();
const AXIS_Y = new Vector3(0, 1, 0);

/**
 * Les knobs d'une famille sur un plan : un InstancedMesh par calque (l'ombre, le PNG qui tourne, son capuchon fixe).
 * place : le centre du knob (repere du plan ; y : la hauteur des quads au-dessus du plan), le rayon de son disque.
 * setAngle : l'angle des potards 3D de la face (autour de +y, le repere vers -z a 0 : scene/encoders.ts potAngle).
 */
export class VKnobSet {
  readonly shadow: InstancedMesh;
  readonly rot: InstancedMesh;
  readonly cap: InstancedMesh | null;
  private at: { x: number; y: number; z: number; R: number; a: number }[];
  private ref: number;

  constructor(
    readonly kind: VKnobKind,
    count: number
  ) {
    const urls = URL_OF[kind];
    this.ref = (VKNOB_SPEC[kind].ref * Math.PI) / 180;
    if (!shadowQuad) {
      shadowQuad = new PlaneGeometry(2 * SHADOW.size, 2 * SHADOW.size);
      shadowQuad.rotateX(-Math.PI / 2);
    }
    this.shadow = new InstancedMesh(shadowQuad, layerMaterial(shadowTexture(), 0), count);
    const mips = VKNOB_SPEC[kind].mips ?? [[VKNOB_SPEC[kind].w, VKNOB_SPEC[kind].h]];
    this.rot = new InstancedMesh(quadOf(kind), layerMaterial(pngTexture(urls.rot, mips), 1), count);
    this.cap = urls.cap ? new InstancedMesh(quadOf(kind), layerMaterial(pngTexture(urls.cap, mips), 2), count) : null;
    const layers = [this.shadow, this.rot, this.cap];
    layers.forEach((m, i) => {
      if (!m) return;
      m.name = `vknob-${kind}-${['shadow', 'rot', 'cap'][i]}`;
      m.renderOrder = 3 + i;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(DynamicDrawUsage);
    });
    this.at = Array.from({ length: count }, () => ({ x: 0, y: 0, z: 0, R: 0, a: 0 }));
  }

  get meshes(): Object3D[] {
    return [this.shadow, this.rot, ...(this.cap ? [this.cap] : [])];
  }

  place(i: number, x: number, y: number, z: number, R: number): void {
    const p = this.at[i];
    Object.assign(p, { x, y, z, R });
    this.shadow.setMatrixAt(i, m4.compose(vp.set(x + SHADOW.dx * R, y - 0.002, z + SHADOW.dz * R), q.identity(), vs.setScalar(R)));
    this.shadow.instanceMatrix.needsUpdate = true;
    if (this.cap) {
      this.cap.setMatrixAt(i, m4.compose(vp.set(x, y + 0.001, z), q.identity(), vs.setScalar(R)));
      this.cap.instanceMatrix.needsUpdate = true;
    }
    this.turn(i);
  }

  /** a : l'angle du potard (autour de +y) ; le PNG tourne de a + l'angle de son repere d'origine. true s'il a change. */
  setAngle(i: number, a: number): boolean {
    const p = this.at[i];
    if (p.a === a) return false;
    p.a = a;
    this.turn(i);
    return true;
  }

  private turn(i: number): void {
    const p = this.at[i];
    q.setFromAxisAngle(AXIS_Y, p.a + this.ref);
    this.rot.setMatrixAt(i, m4.compose(vp.set(p.x, p.y, p.z), q, vs.setScalar(p.R)));
    this.rot.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const m of this.meshes) (m as InstancedMesh).dispose();
  }
}
