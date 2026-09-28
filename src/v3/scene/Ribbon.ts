/**
 * Le ruban : une geometrie (bande indexee, N segments), trois passes
 * additives (halo, corps, coeur) qui partagent un objet d'uniforms. Le
 * chemin est evalue dans le vertex shader (shaders.ts), jamais sur le CPU.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
  type IUniform,
} from 'three';
import { RIBBON_FRAG, RIBBON_VERT } from './shaders';

export const CREAM = new Color(0.965, 0.945, 0.906);
export const CREAM_CORE = new Color(1.0, 0.992, 0.973);

export type Uniforms = Record<string, IUniform>;

const slotUniforms = (suffix: 'A' | 'B', t: number): Uniforms => ({
  [`uWrap${suffix}`]: { value: 0 },
  [`uTurns${suffix}`]: { value: 2 },
  [`uFocusT${suffix}`]: { value: t },
  [`uFocusPos${suffix}`]: { value: new Vector3() },
  [`uFocusN1${suffix}`]: { value: new Vector3(1, 0, 0) },
  [`uFocusN2${suffix}`]: { value: new Vector3(0, 1, 0) },
  [`uFocusTan${suffix}`]: { value: new Vector3(0, 0, 1) },
});

export class Ribbon {
  readonly group = new Group();
  /** Uniforms partages par les trois passes (meme objets {value}). */
  readonly u: Uniforms;
  readonly halo: Mesh;
  readonly body: Mesh;
  readonly core: Mesh | null;
  readonly haloMat: ShaderMaterial;
  readonly bodyMat: ShaderMaterial;
  readonly coreMat: ShaderMaterial | null;
  private geom: BufferGeometry;
  segments: number;

  constructor(segments: number, withCore: boolean) {
    this.segments = segments;
    this.u = {
      uTime: { value: 0 },
      uDashTime: { value: 0 },
      uTuning: { value: 1 },
      uResonance: { value: 0.25 },
      uCutoff: { value: 0.5 },
      uEnvMod: { value: 0.5 },
      uDecay: { value: 0.066 },
      uAccent: { value: 1 },
      uFlow: { value: 0 },
      uReveal: { value: 0 },
      uDim: { value: 1 },
      uGhostOn: { value: 0 },
      uGhostT: { value: 0 },
      uWrapGlow: { value: 0 },
      ...slotUniforms('A', 0.94),
      ...slotUniforms('B', 0.94),
    };
    this.geom = Ribbon.buildGeometry(segments);

    const make = (extra: Uniforms) =>
      new ShaderMaterial({
        vertexShader: RIBBON_VERT,
        fragmentShader: RIBBON_FRAG,
        uniforms: { ...this.u, ...extra },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: AdditiveBlending,
        side: DoubleSide,
        toneMapped: false,
      });

    this.haloMat = make({
      uWidthMul: { value: 3.75 },
      uAlpha: { value: 0.14 },
      uBright: { value: 1 },
      uColor: { value: CREAM.clone() },
      uSoft: { value: 1 },
      uHaloE: { value: 1 },
    });
    this.bodyMat = make({
      uWidthMul: { value: 1 },
      uAlpha: { value: 0.9 },
      uBright: { value: 0.95 },
      uColor: { value: CREAM.clone() },
      uSoft: { value: 0 },
      uHaloE: { value: 0 },
    });
    this.coreMat = withCore
      ? make({
          uWidthMul: { value: 0.3 },
          uAlpha: { value: 1 },
          uBright: { value: 1 },
          uColor: { value: CREAM_CORE.clone() },
          uSoft: { value: 0 },
          uHaloE: { value: 0 },
        })
      : null;

    const mesh = (m: ShaderMaterial, order: number) => {
      const mesh = new Mesh(this.geom, m);
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      this.group.add(mesh);
      return mesh;
    };
    this.halo = mesh(this.haloMat, 10);
    this.body = mesh(this.bodyMat, 11);
    this.core = this.coreMat ? mesh(this.coreMat, 12) : null;
  }

  static buildGeometry(n: number): BufferGeometry {
    const verts = (n + 1) * 2;
    const aT = new Float32Array(verts);
    const aSide = new Float32Array(verts);
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      aT[2 * i] = t;
      aSide[2 * i] = -1;
      aT[2 * i + 1] = t;
      aSide[2 * i + 1] = 1;
    }
    const index = new Uint32Array(n * 6);
    for (let i = 0; i < n; i += 1) {
      const b = 2 * i;
      const o = 6 * i;
      index[o] = b;
      index[o + 1] = b + 1;
      index[o + 2] = b + 2;
      index[o + 3] = b + 1;
      index[o + 4] = b + 3;
      index[o + 5] = b + 2;
    }
    const g = new BufferGeometry();
    // position factice : three attend l'attribut, le shader n'en lit rien
    g.setAttribute('position', new BufferAttribute(new Float32Array(verts * 3), 3));
    g.setAttribute('aT', new BufferAttribute(aT, 1));
    g.setAttribute('aSide', new BufferAttribute(aSide, 1));
    g.setIndex(new BufferAttribute(index, 1));
    return g;
  }

  /** Changement de palier : on reconstruit la bande, les materiaux restent. */
  rebuild(n: number): void {
    if (n === this.segments) return;
    const g = Ribbon.buildGeometry(n);
    this.halo.geometry = g;
    this.body.geometry = g;
    if (this.core) this.core.geometry = g;
    this.geom.dispose();
    this.geom = g;
    this.segments = n;
  }

  setHaloVisible(v: boolean): void {
    this.halo.visible = v;
  }

  dispose(): void {
    this.geom.dispose();
    this.haloMat.dispose();
    this.bodyMat.dispose();
    this.coreMat?.dispose();
  }
}
