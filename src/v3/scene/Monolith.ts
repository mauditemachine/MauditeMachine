/**
 * Le nom au bout du tunnel : MAUDITE MACHINE rasterise depuis la vraie
 * Larsseit (canvas 2D, fillText + getImageData), un bloc de metal par
 * cellule opaque, un seul InstancedMesh. Zero asset. Si la police arrive
 * apres le delai, on re-rasterise en place.
 */

import { BoxGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, PointLight, Quaternion, Vector3 } from 'three';

const _pos = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _m = new Matrix4();

export const MONOLITH_CENTER = new Vector3(0, 2.2, -66);

const FONT = '700 44px Larsseit, sans-serif';
const FONT_QUERY = '700 44px Larsseit';

const timeout = (ms: number) => new Promise<boolean>((r) => window.setTimeout(() => r(false), ms));

function fontLoaded(): Promise<boolean> {
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve(false);
  try {
    return document.fonts.load(FONT_QUERY).then(
      (faces) => faces.length > 0,
      () => false
    );
  } catch {
    return Promise.resolve(false);
  }
}

export class Monolith {
  readonly mesh: InstancedMesh;
  readonly lamp: PointLight;
  private geom: BoxGeometry;
  private material: MeshStandardMaterial;
  private cells: number[] = [];
  private cols = 128;
  private rows = 56;
  private stride: number;
  private capacity: number;
  private portrait = false;
  private halved = false;
  private disposed = false;
  private rasteredWithFont = false;
  private seed: number[] = [];

  constructor(metal: MeshStandardMaterial, capacity: number, stride: number) {
    this.capacity = capacity;
    this.stride = stride;
    this.material = metal;
    this.geom = new BoxGeometry(1, 1, 3);
    this.mesh = new InstancedMesh(this.geom, this.material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.lamp = new PointLight(0xf6f1e7, 0, 40, 2);
    this.lamp.position.set(0, 5, -58);
  }

  /** Raster apres la police (3 s max), puis re-raster silencieux si elle arrive plus tard (10 s). */
  raster(onDone?: () => void): void {
    Promise.race([fontLoaded(), timeout(3000)]).then((ok) => {
      if (this.disposed) return;
      this.draw(ok);
      onDone?.();
      if (!ok) {
        Promise.race([fontLoaded(), timeout(10000)]).then((late) => {
          if (late && !this.disposed && !this.rasteredWithFont) {
            this.draw(true);
            onDone?.();
          }
        });
      }
    });
  }

  private draw(withFont: boolean): void {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 112;
    const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
    if (!ctx) return;
    ctx.clearRect(0, 0, 256, 112);
    ctx.fillStyle = '#fff';
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = '2px';
    ctx.fillText('MAUDITE', 128, 46);
    ctx.fillText('MACHINE', 128, 100);
    const data = ctx.getImageData(0, 0, 256, 112).data;
    const st = this.stride;
    this.cols = Math.ceil(256 / st);
    this.rows = Math.ceil(112 / st);
    const cells: number[] = [];
    for (let y = 0; y < 112; y += st) {
      for (let x = 0; x < 256; x += st) {
        if (data[(y * 256 + x) * 4 + 3] > 128) cells.push(x / st, y / st);
      }
    }
    this.cells = cells;
    this.rasteredWithFont = withFont;
    // Jitter en z seede par index : le mur n'est pas un plan parfait
    let s = 20260211;
    this.seed = [];
    for (let i = 0; i < cells.length / 2; i += 1) {
      s = (s * 1664525 + 1013904223) >>> 0;
      this.seed.push(s / 4294967296 - 0.5);
    }
    this.layout(this.portrait, this.halved);
  }

  /** Pose les matrices : largeur 14 (paysage) ou 7 (portrait), halved = palier bas. */
  layout(portrait: boolean, halved: boolean): void {
    this.portrait = portrait;
    this.halved = halved;
    if (!this.cells.length) return;
    const W = portrait ? 7 : 14;
    const cell = W / this.cols;
    _q.identity();
    _s.set(cell, cell, cell);
    let n = 0;
    const total = this.cells.length / 2;
    for (let i = 0; i < total && n < this.capacity; i += 1) {
      if (halved && i % 2 === 1) continue;
      const col = this.cells[i * 2];
      const row = this.cells[i * 2 + 1];
      _pos.set(
        (col - this.cols / 2 + 0.5) * cell,
        MONOLITH_CENTER.y + (this.rows / 2 - row - 0.5) * cell,
        MONOLITH_CENTER.z + this.seed[i] * 0.12 * cell * 3
      );
      _m.compose(_pos, _q, _s);
      this.mesh.setMatrixAt(n, _m);
      n += 1;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  get cellCount(): number {
    return this.cells.length / 2;
  }

  dispose(): void {
    this.disposed = true;
    this.geom.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
