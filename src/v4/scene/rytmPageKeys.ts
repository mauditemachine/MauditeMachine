/**
 * Les six touches de page du MM-RYTM (2026-10-08, la refonte facon
 * Digitakt, Mika : "8 encodeurs assignables a condition de presser les
 * bonnes touches" ; "RYTM : je ne vois AUCUN changement de ce que j'ai
 * demande") : TRIG SRC SMPL FLTR AMP FX, l'ordre de l'Analog Rytm, sous les
 * potards de page (theme.ts PAGE_KEYS, pageKeyX). La matiere et l'arrondi des
 * touches du transport, plus petites ; sur chacune un fin temoin pres du
 * bord arriere, comme RUN ou MUTE (BTN_LED) : allume (l'orange des pas
 * programmes) sur la page affichee, a peine en vue HOME (la touche rallume
 * la page), eteint ailleurs. Un appui l'enfonce et l'eclaire comme un pas.
 * UN InstancedMesh pour les touches, un pour les temoins (non eclaires) ;
 * le Stage ne rend une frame que si quelque chose a change.
 */

import { Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, type BufferGeometry, type Object3D } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLOR, KEYS, LIT, MATERIAL, PAGE_KEYS, PRESS_TINT, RYTM_PAGE_KEYS, STEP_PRESS, pageKeyX } from '../theme';
import type { HotspotDef } from './hit';
import { withInstanceEmissive } from './materials';

const N = RYTM_PAGE_KEYS.length;
const m4 = new Matrix4();
const col = new Color();

/** L'eclat du temoin de la page affichee en vue HOME : a peine (la touche la rallume). */
const HOME_LEVEL = 0.32;

function keyGeometry(mobile: boolean): BufferGeometry {
  const P = PAGE_KEYS;
  const g = new RoundedBoxGeometry(P.w, P.h, P.d, mobile ? KEYS.segments.mobile : KEYS.segments.desktop, P.radius);
  g.translate(0, P.h / 2, 0);
  g.deleteAttribute('uv');
  return g;
}

function ledGeometry(): BufferGeometry {
  const g = new PlaneGeometry(PAGE_KEYS.led.w, PAGE_KEYS.led.d);
  g.rotateX(-Math.PI / 2);
  g.deleteAttribute('uv');
  return g;
}

/** z du temoin : sur le dessus, pres du bord arriere. */
const LED_Z = PAGE_KEYS.z - PAGE_KEYS.d / 2 + PAGE_KEYS.led.back;
const LED_Y = PAGE_KEYS.h + 0.002;

export interface PageKeysInfo {
  /** l'eclat de chaque temoin (0 a 1), dans l'ordre des pages */
  leds: number[];
  page: string;
  home: boolean;
}

export class RytmPageKeys {
  readonly keys: InstancedMesh;
  readonly leds: InstancedMesh;
  private keyMat: MeshStandardMaterial;
  private ledMat: MeshBasicMaterial;
  private emissive: InstancedBufferAttribute;
  private level = new Float32Array(N);
  private press = new Float32Array(N);
  private off = new Color();
  private on = new Color();
  private page = '';
  private home = false;

  constructor(opts: { mobile: boolean }) {
    const g = keyGeometry(opts.mobile);
    this.emissive = new InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.emissive.setUsage(DynamicDrawUsage);
    g.setAttribute('instanceEmissive', this.emissive);
    this.keyMat = withInstanceEmissive(new MeshStandardMaterial({ ...MATERIAL.key }), false);
    this.keyMat.name = 'pageKey';
    this.keys = new InstancedMesh(g, this.keyMat, N);
    this.keys.name = 'pageKeys';
    this.keys.receiveShadow = true;
    for (let i = 0; i < N; i += 1) {
      this.keys.setMatrixAt(i, m4.makeTranslation(pageKeyX(i), 0, PAGE_KEYS.z));
      this.keys.setColorAt(i, col.setRGB(LIT.clear[0], LIT.clear[1], LIT.clear[2]));
    }
    this.keys.instanceMatrix.setUsage(DynamicDrawUsage);
    this.keys.instanceMatrix.needsUpdate = true;
    this.keys.instanceColor?.setUsage(DynamicDrawUsage);

    this.off.setHex(COLOR.line);
    this.on.setHex(COLOR.ledSet);
    this.ledMat = new MeshBasicMaterial({ toneMapped: false });
    this.ledMat.name = 'pageKeyLed';
    this.leds = new InstancedMesh(ledGeometry(), this.ledMat, N);
    this.leds.name = 'pageKeyLeds';
    for (let i = 0; i < N; i += 1) {
      this.leds.setMatrixAt(i, m4.makeTranslation(pageKeyX(i), LED_Y, LED_Z));
      this.leds.setColorAt(i, col.copy(this.off));
    }
    this.leds.instanceMatrix.setUsage(DynamicDrawUsage);
    this.leds.instanceMatrix.needsUpdate = true;
    this.leds.instanceColor?.setUsage(DynamicDrawUsage);
  }

  /** Les meshes a poser sur le plateau. */
  objects(): Object3D[] {
    return [this.keys, this.leds];
  }

  /** La page affichee et la vue : les temoins suivent ; true s'il faut une frame. */
  setPage(page: string, home: boolean): boolean {
    if (page === this.page && home === this.home) return false;
    this.page = page;
    this.home = home;
    let changed = false;
    RYTM_PAGE_KEYS.forEach((p, i) => {
      const v = p.id === page ? (home ? HOME_LEVEL : 1) : 0;
      if (this.level[i] === v) return;
      this.level[i] = v;
      this.leds.setColorAt(i, col.copy(this.off).lerp(this.on, v));
      changed = true;
    });
    if (changed && this.leds.instanceColor) this.leds.instanceColor.needsUpdate = true;
    return changed;
  }

  /** Appui sur la touche i, v de 0 (repos) a 1 (enfoncee) : elle descend et s'eclaire (le Stage l'anime). */
  setPress(i: number, v: number, move: boolean): void {
    if (i < 0 || i >= N) return;
    this.press[i] = v;
    const dy = move ? -STEP_PRESS.depth * v : 0;
    this.keys.instanceMatrix.array[i * 16 + 13] = dy;
    this.keys.instanceMatrix.needsUpdate = true;
    this.leds.instanceMatrix.array[i * 16 + 13] = LED_Y + dy;
    this.leds.instanceMatrix.needsUpdate = true;
    const e = this.emissive.array as Float32Array;
    for (let c = 0; c < 3; c += 1) e[i * 3 + c] = STEP_PRESS.glow[c] * v;
    this.emissive.needsUpdate = true;
    const t = PRESS_TINT.rgb;
    if (t) {
      const b = LIT.clear;
      this.keys.setColorAt(i, col.setRGB(b[0] + (t[0] - b[0]) * v, b[1] + (t[1] - b[1]) * v, b[2] + (t[2] - b[2]) * v));
      if (this.keys.instanceColor) this.keys.instanceColor.needsUpdate = true;
    }
  }

  /** Les zones des touches : pkey-trig ... pkey-fx (kind pkey, rpage). */
  hotspots(layer: Object3D): HotspotDef[] {
    return RYTM_PAGE_KEYS.map((p, i) => ({
      id: `pkey-${p.id}`,
      kind: 'pkey' as const,
      layer,
      shape: 'box' as const,
      x: pageKeyX(i),
      z: PAGE_KEYS.z,
      hx: PAGE_KEYS.w / 2,
      hz: PAGE_KEYS.d / 2,
      y0: 0,
      y1: PAGE_KEYS.h,
      enabled: true,
      rpage: p.id,
    }));
  }

  info(): PageKeysInfo {
    return { leds: Array.from(this.level, (v) => +v.toFixed(2)), page: this.page, home: this.home };
  }

  dispose(): void {
    this.keys.geometry.dispose();
    this.keyMat.dispose();
    this.keys.dispose();
    this.leds.geometry.dispose();
    this.ledMat.dispose();
    this.leds.dispose();
  }
}
