/**
 * Picking en espace ecran : les 42 centres projetes (au plus toutes les
 * 16 ms), le plus proche dans un rayon. Deux centres a moins de 20 px :
 * le second est propose en alternative (tooltip double, second clic cycle).
 */

import { Vector3, type PerspectiveCamera } from 'three';
import { BEADS, BEAD_COUNT } from '../data/beads';

export interface PickHit {
  id: string;
  index: number;
  alt: string | null;
  x: number;
  y: number;
}

const _v = new Vector3();

export class Picker {
  private sx = new Float32Array(BEAD_COUNT);
  private sy = new Float32Array(BEAD_COUNT);
  private ok = new Uint8Array(BEAD_COUNT);
  private lastAt = -1e9;

  refresh(camera: PerspectiveCamera, positions: Float32Array, width: number, height: number, nowMs: number, force = false): void {
    if (!force && nowMs - this.lastAt < 16) return;
    this.lastAt = nowMs;
    for (let i = 0; i < BEAD_COUNT; i += 1) {
      _v.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]).project(camera);
      if (_v.z > 1 || _v.z < -1) {
        this.ok[i] = 0;
        continue;
      }
      this.ok[i] = 1;
      this.sx[i] = ((_v.x + 1) / 2) * width;
      this.sy[i] = ((1 - _v.y) / 2) * height;
    }
  }

  nearest(x: number, y: number, radius: number): PickHit | null {
    let best = -1;
    let bestD = radius * radius;
    let second = -1;
    let secondD = Infinity;
    for (let i = 0; i < BEAD_COUNT; i += 1) {
      if (!this.ok[i]) continue;
      const dx = this.sx[i] - x;
      const dy = this.sy[i] - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        second = best;
        secondD = bestD;
        best = i;
        bestD = d;
      } else if (d < secondD) {
        second = i;
        secondD = d;
      }
    }
    if (best < 0) return null;
    let alt: string | null = null;
    if (second >= 0 && secondD <= radius * radius) {
      const dx = this.sx[second] - this.sx[best];
      const dy = this.sy[second] - this.sy[best];
      if (dx * dx + dy * dy <= 400) alt = BEADS[second].id;
    }
    return { id: BEADS[best].id, index: best, alt, x: this.sx[best], y: this.sy[best] };
  }

  /** Point ecran d'une perle (tooltip), ou null si hors champ. */
  screenOf(index: number): { x: number; y: number } | null {
    if (!this.ok[index]) return null;
    return { x: this.sx[index], y: this.sy[index] };
  }
}
