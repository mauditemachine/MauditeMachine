/**
 * Zone A : les quatre pads (spec 5.3), un seul InstancedMesh de
 * RoundedBoxGeometry(2.2, 0.35, 2.2, 2, 0.1), base a y 0 sur le plateau,
 * 2 x 2 avec leur serigraphie BD SD / TOM CH devant eux (silk.ts). Dessus
 * padTop, flancs graphite (couleurs de sommets). Frappe : le pad descend
 * de 0.12 en 60 ms puis remonte en 180 ms (easeOutCubic) et sa face
 * superieure passe en jaune emissif pendant 120 ms ; l'instrument
 * selectionne garde un jaune faible (PAD_GLOW, cale a l'affichage). Le son
 * part AVANT : l'appelant declenche la voix puis appelle press()
 * (actions.ts). Les coups du sequenceur font flash() seul (100 ms, sans
 * mouvement), a l'instant audio du pas.
 */

import {
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PAD, PADS, PAD_ALBEDO_GAIN, PAD_FX, PAD_GLOW, type Inst } from '../theme';
import type { HotspotDef } from './hit';
import { albedo, withInstanceEmissive } from './materials';
import { easeOutCubic, linear, type Tweens } from './tween';

/** Eclairage de la face superieure : eteint, selection, flash. */
type Glow = 0 | 1 | 2;
const OFF: Glow = 0;
const SELECTED: Glow = 1;
const FLASH: Glow = 2;
const GLOW_RGB: readonly (readonly number[])[] = [[0, 0, 0], PAD_GLOW.selected, PAD_GLOW.flash];
const GLOW_NAME = ['off', 'selected', 'flash'] as const;
const m4 = new Matrix4();
const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Geometrie partagee : couleurs de sommets et masque emissif selon la pente. */
function buildGeometry(): BufferGeometry {
  const g = new RoundedBoxGeometry(PAD.size, PAD.height, PAD.size, PAD.segments, PAD.radius);
  g.translate(0, PAD.height / 2, 0);
  g.deleteAttribute('uv');
  const n = g.getAttribute('normal');
  const top = albedo('padTop', new Color(), PAD_ALBEDO_GAIN);
  const side = albedo('graphite', new Color());
  const col = new Float32Array(n.count * 3);
  const mask = new Float32Array(n.count);
  for (let i = 0; i < n.count; i += 1) {
    // 1 sur le dessus plat, 0 sur les flancs, degrade sur l'arrondi
    const t = smoothstep(0.55, 0.95, n.getY(i));
    col[i * 3] = side.r + (top.r - side.r) * t;
    col[i * 3 + 1] = side.g + (top.g - side.g) * t;
    col[i * 3 + 2] = side.b + (top.b - side.b) * t;
    mask[i] = t;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('emissiveMask', new Float32BufferAttribute(mask, 1));
  return g;
}

export interface PadsOpts {
  tweens: Tweens;
  /** reduced motion : le flash sans le mouvement (spec 7.3) */
  reduced: () => boolean;
  /** demande une frame */
  invalidate: () => void;
  castShadow: boolean;
}

export interface PadsInfo {
  y: number[];
  glow: (typeof GLOW_NAME)[number][];
  selected: Inst | null;
  lastPress: { inst: Inst | null; at: number; count: number };
  /** flashs recus par pad (frappes et coups du sequenceur), ordre BD SD TOM CH */
  flashes: number[];
}

export class Pads {
  readonly mesh: InstancedMesh;
  /** revue : dernier appui (performance.now), a comparer a audio.last.at */
  readonly lastPress: PadsInfo['lastPress'] = { inst: null, at: 0, count: 0 };
  private material: MeshStandardMaterial;
  private emissive: InstancedBufferAttribute;
  private y = new Float32Array(PADS.length);
  private glow = new Uint8Array(PADS.length);
  private flashing = new Uint8Array(PADS.length);
  /** echeance de chaque flash (horloge des rAF, ms) */
  private flashUntil = new Float64Array(PADS.length);
  private flashCount = new Uint32Array(PADS.length);
  private selected = -1;
  // Cles et setters prepares : un appui n'alloue presque rien
  private keyY = PADS.map((p) => `pad.y.${p.id}`);
  private setters = PADS.map((_, i) => (v: number) => this.setY(i, v));

  constructor(private opts: PadsOpts) {
    const geo = buildGeometry();
    this.emissive = new InstancedBufferAttribute(new Float32Array(PADS.length * 3), 3);
    this.emissive.setUsage(DynamicDrawUsage);
    geo.setAttribute('instanceEmissive', this.emissive);
    this.material = withInstanceEmissive(new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 }), true);
    this.material.name = 'pad';
    this.mesh = new InstancedMesh(geo, this.material, PADS.length);
    this.mesh.name = 'pads';
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.castShadow = opts.castShadow;
    PADS.forEach((p, i) => this.mesh.setMatrixAt(i, m4.makeTranslation(p.x, 0, p.z)));
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private index(inst: Inst): number {
    for (let i = 0; i < PADS.length; i += 1) if (PADS[i].id === inst) return i;
    return -1;
  }

  private setY(i: number, v: number): void {
    this.y[i] = v;
    // Translation y de la matrice d'instance i (colonne 3, ligne 1)
    this.mesh.instanceMatrix.array[i * 16 + 13] = v;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private setGlow(i: number, g: Glow): void {
    this.glow[i] = g;
    const a = this.emissive.array as Float32Array;
    const c = GLOW_RGB[g];
    a[i * 3] = c[0];
    a[i * 3 + 1] = c[1];
    a[i * 3 + 2] = c[2];
    this.emissive.needsUpdate = true;
  }

  private restGlow(i: number): Glow {
    return i === this.selected ? SELECTED : OFF;
  }

  /** Frappe : flash de 120 ms, descente puis remontee (sans mouvement en reduced motion). */
  press(inst: Inst, now: number = performance.now()): void {
    const i = this.index(inst);
    if (i < 0) return;
    this.lastPress.inst = inst;
    this.lastPress.at = performance.now();
    this.lastPress.count += 1;
    this.flash(inst, PAD_FX.flashMs, now);
    if (!this.opts.reduced()) {
      const key = this.keyY[i];
      const set = this.setters[i];
      const tw = this.opts.tweens;
      tw.run(key, set, this.y[i], -PAD.press, PAD_FX.downMs, linear, now, (end) =>
        tw.run(key, set, -PAD.press, 0, PAD_FX.upMs, easeOutCubic, end)
      );
    }
    this.opts.invalidate();
  }

  /**
   * Flash emissif seul (CH tenu, coups du sequenceur). Sa fin est une
   * echeance relue par update() : deux frames par flash (allume, eteint),
   * pas une frame par rafraichissement comme le ferait un tween.
   */
  flash(inst: Inst, ms: number = PAD_FX.seqFlashMs, now: number = performance.now()): void {
    const i = this.index(inst);
    if (i < 0) return;
    // Un flash ne raccourcit jamais celui qui brille deja
    this.flashUntil[i] = this.flashing[i] ? Math.max(this.flashUntil[i], now + ms) : now + ms;
    this.flashing[i] = 1;
    this.flashCount[i] += 1;
    this.setGlow(i, FLASH);
    this.opts.invalidate();
  }

  /** Animateur du Stage : eteint les flashs echus ; 'poll' tant qu'un flash attend son echeance. */
  update(now: number): boolean | 'poll' {
    let changed = false;
    let pending = false;
    for (let i = 0; i < PADS.length; i += 1) {
      if (!this.flashing[i]) continue;
      if (now >= this.flashUntil[i]) {
        this.flashing[i] = 0;
        this.setGlow(i, this.restGlow(i));
        changed = true;
      } else {
        pending = true;
      }
    }
    return changed ? true : pending ? 'poll' : false;
  }

  /** L'instrument selectionne reste allume en jaune faible. */
  setSelected(inst: Inst | null): void {
    const i = inst ? this.index(inst) : -1;
    if (i === this.selected) return;
    const prev = this.selected;
    this.selected = i;
    if (prev >= 0 && !this.flashing[prev]) this.setGlow(prev, OFF);
    if (i >= 0 && !this.flashing[i]) this.setGlow(i, SELECTED);
    this.opts.invalidate();
  }

  /** Les quatre pads pour le picking : la boite 2.2 x 0.35 x 2.2 de chacun. */
  hotspots(layer: Object3D): HotspotDef[] {
    return PADS.map((p) => ({
      id: `pad-${p.id}`,
      kind: 'pad' as const,
      layer,
      shape: 'box' as const,
      x: p.x,
      z: p.z,
      hx: PAD.size / 2,
      hz: PAD.size / 2,
      y0: 0,
      y1: PAD.height,
      enabled: true,
      inst: p.id,
    }));
  }

  info(): PadsInfo {
    return {
      y: Array.from(this.y, (v) => +v.toFixed(4)),
      glow: Array.from(this.glow, (g) => GLOW_NAME[g as Glow]),
      selected: this.selected >= 0 ? PADS[this.selected].id : null,
      lastPress: { ...this.lastPress },
      flashes: Array.from(this.flashCount),
    };
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
