/**
 * Les 12 pads (spec 20.3.5), la signature de l'Analog Rytm : caoutchouc
 * noir, un peu bombes, retroeclaires par-dessous, deux rangees de six sur
 * la moitie droite du panneau. UN InstancedMesh (une geometrie : boite a
 * coins arrondis et dome fusionnes) et UN InstancedMesh de halos (un carre
 * additif sous chaque pad) : deux draw calls pour les douze.
 * Retroeclairage par instance (emissif du dessus, 55 % sur les flancs, et
 * halo) :
 * - voix BD SD TOM CH : eteintes ; jaune vif 120 ms a la frappe, 100 ms
 *   par coup du sequenceur ; l'instrument selectionne en blanc chaud faible ;
 * - pages TRACKS a SONAA : jaune faible en permanence (on les distingue),
 *   plus fort au survol de la souris, yellowHi pour la page ouverte, une
 *   seule a la fois ;
 * - OPEN : jaune faible, yellowHi pendant l'ouverture et vue ouverte.
 * Frappe (les 12) : le pad s'enfonce de 0.06 en 60 ms et remonte en 180 ms
 * (reduced motion : la lumiere seule). Le son part AVANT : l'appelant
 * declenche la voix puis appelle press() (actions.ts).
 */

import {
  AdditiveBlending,
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type BufferGeometry,
  type CanvasTexture,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLOR, MATERIAL, OPEN_TINT, PAD, PADS, PAD_FX, PAD_GLOW, PAD_HALO, gainOf, type Inst, type PadId, type PageId } from '../theme';
import type { HotspotDef } from './hit';
import { albedo, withInstanceEmissive } from './materials';
import { makeHaloTexture } from './silk';
import { easeOutCubic, linear, type Tweens } from './tween';

/** Etat lumineux d'un pad. */
type Glow = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
const OFF: Glow = 0;
const SELECTED: Glow = 1;
const FAINT: Glow = 2;
const HOVER: Glow = 3;
const ACTIVE: Glow = 4;
const FLASH: Glow = 5;
/** OPEN (revision 4) : orange plein machine fermee, faible machine ouverte */
const ORANGE: Glow = 6;
const ORANGE_DIM: Glow = 7;
const GLOW_NAME = ['off', 'selected', 'faint', 'hover', 'active', 'flash', 'orange', 'orangeDim'] as const;
const ZERO = [0, 0, 0] as const;
const GLOW_RGB: readonly (readonly number[])[] = [
  ZERO,
  PAD_GLOW.selected,
  PAD_GLOW.faint,
  PAD_GLOW.hover,
  PAD_GLOW.active,
  PAD_GLOW.flash,
  PAD_GLOW.orange,
  PAD_GLOW.orangeDim,
];
const HALO_K = [0, PAD_HALO.selected, PAD_HALO.faint, PAD_HALO.hover, PAD_HALO.active, PAD_HALO.flash, PAD_HALO.orange, PAD_HALO.orangeDim];
const COUNT = PADS.length;

const m4 = new Matrix4();
const col = new Color();
/** jaune lineaire du halo (flash et pages), blanc chaud (selection) */
const YELLOW = new Color(COLOR.yellow);
const YELLOW_HI = new Color(COLOR.yellowHi);
const WARM = new Color(COLOR.bone);
const ORANGE_TINT = new Color(COLOR.orange);

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Geometrie partagee : RoundedBoxGeometry (non indexee, normales douces)
 * et, sur son dessus plat (0.8 x 0.8, sans sommet interieur), un plan
 * 6 x 6 bombe de 0.04 au centre, nul sur tout son bord. Couleur caoutchouc
 * (couleurs de sommets), masque emissif 1 dessus, 0.55 sur les flancs.
 */
function buildGeometry(mobile: boolean): BufferGeometry {
  const box = new RoundedBoxGeometry(PAD.size, PAD.height, PAD.size, mobile ? PAD.segments.mobile : PAD.segments.desktop, PAD.radius);
  box.translate(0, PAD.height / 2, 0);
  const flat = PAD.size - 2 * PAD.radius;
  const plane = new PlaneGeometry(flat, flat, PAD.domeSegments, PAD.domeSegments);
  plane.rotateX(-Math.PI / 2);
  const pos = plane.getAttribute('position');
  const h = flat / 2;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i) / h;
    const z = pos.getZ(i) / h;
    pos.setY(i, PAD.domeY + PAD.dome * (1 - x * x) * (1 - z * z));
  }
  plane.computeVertexNormals();
  const dome = plane.toNonIndexed();
  plane.dispose();
  const parts = [box, dome];
  const rubber = albedo('pad', new Color(), gainOf('pad'));
  for (const g of parts) {
    g.deleteAttribute('uv');
    const n = g.getAttribute('normal');
    const c = new Float32Array(n.count * 3);
    const m = new Float32Array(n.count);
    for (let i = 0; i < n.count; i += 1) {
      c[i * 3] = rubber.r;
      c[i * 3 + 1] = rubber.g;
      c[i * 3 + 2] = rubber.b;
      m[i] = 0.55 + 0.45 * smoothstep(0.55, 0.95, n.getY(i));
    }
    g.setAttribute('color', new Float32BufferAttribute(c, 3));
    g.setAttribute('emissiveMask', new Float32BufferAttribute(m, 1));
  }
  const merged = mergeGeometries(parts, false);
  box.dispose();
  dome.dispose();
  if (!merged) throw new Error('pads: merge failed');
  return merged;
}

export interface PadsOpts {
  tweens: Tweens;
  /** reduced motion : la lumiere sans le mouvement (spec 7.3) */
  reduced: () => boolean;
  /**
   * demande une frame sans passe d'ombre (la lumiere seule ; l'enfoncement
   * passe par les tweens du Stage, qui refont la carte d'ombre)
   */
  repaint: () => void;
  castShadow: boolean;
  mobile: boolean;
}

export interface PadsInfo {
  ids: PadId[];
  y: number[];
  glow: (typeof GLOW_NAME)[number][];
  selected: Inst | null;
  activePage: PageId | null;
  open: boolean;
  hover: PadId | null;
  lastPress: { id: PadId | null; at: number; count: number };
  /** flashs recus par pad (frappes et coups du sequenceur), ordre des pads */
  flashes: number[];
}

export class Pads {
  readonly mesh: InstancedMesh;
  readonly halos: InstancedMesh;
  /** revue : dernier appui (performance.now) */
  readonly lastPress: PadsInfo['lastPress'] = { id: null, at: 0, count: 0 };
  private material: MeshStandardMaterial;
  private haloMat: MeshBasicMaterial;
  private haloTex: CanvasTexture;
  private emissive: InstancedBufferAttribute;
  private y = new Float32Array(COUNT);
  private glow = new Uint8Array(COUNT);
  private flashing = new Uint8Array(COUNT);
  /** echeance de chaque flash (horloge des rAF, ms) */
  private flashUntil = new Float64Array(COUNT);
  private flashCount = new Uint32Array(COUNT);
  private selected = -1;
  private activePage = -1;
  private open = false;
  private hover = -1;
  // Cles et setters prepares : un appui n'alloue presque rien
  private keyY = PADS.map((p) => `pad.y.${p.id}`);
  private setters = PADS.map((_, i) => (v: number) => this.setY(i, v));

  constructor(private opts: PadsOpts) {
    const geo = buildGeometry(opts.mobile);
    this.emissive = new InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
    this.emissive.setUsage(DynamicDrawUsage);
    geo.setAttribute('instanceEmissive', this.emissive);
    this.material = withInstanceEmissive(new MeshStandardMaterial({ vertexColors: true, ...MATERIAL.pad }), true);
    this.material.name = 'pad';
    this.mesh = new InstancedMesh(geo, this.material, COUNT);
    this.mesh.name = 'pads';
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.castShadow = opts.castShadow;
    this.mesh.receiveShadow = true;
    // Couleur par pad : blanche (le caoutchouc), OPEN teinte en orange sur la machine claire
    for (let i = 0; i < COUNT; i += 1) this.mesh.setColorAt(i, col.setRGB(1, 1, 1));
    this.mesh.setColorAt(PADS.findIndex((p) => p.id === 'open'), col.setRGB(OPEN_TINT[0], OPEN_TINT[1], OPEN_TINT[2]));

    // Halos : un carre de 1.25 a plat sous chaque pad, additif, sans profondeur
    this.haloTex = makeHaloTexture();
    this.haloMat = new MeshBasicMaterial({
      map: this.haloTex,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.haloMat.name = 'padHalo';
    const hg = new PlaneGeometry(PAD.halo, PAD.halo);
    hg.rotateX(-Math.PI / 2);
    this.halos = new InstancedMesh(hg, this.haloMat, COUNT);
    this.halos.name = 'padHalos';

    PADS.forEach((p, i) => {
      this.mesh.setMatrixAt(i, m4.makeTranslation(p.x, 0, p.z));
      this.halos.setMatrixAt(i, m4.makeTranslation(p.x, PAD.haloY, p.z));
      this.halos.setColorAt(i, col.setRGB(0, 0, 0));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.halos.instanceMatrix.needsUpdate = true;
    this.halos.instanceColor?.setUsage(DynamicDrawUsage);
    for (let i = 0; i < COUNT; i += 1) this.setGlow(i, this.restGlow(i));
  }

  index(id: PadId): number {
    for (let i = 0; i < COUNT; i += 1) if (PADS[i].id === id) return i;
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
    const tint = g === SELECTED ? WARM : g === ACTIVE ? YELLOW_HI : g === ORANGE || g === ORANGE_DIM ? ORANGE_TINT : YELLOW;
    this.halos.setColorAt(i, col.copy(tint).multiplyScalar(HALO_K[g]));
    if (this.halos.instanceColor) this.halos.instanceColor.needsUpdate = true;
  }

  /** Lumiere de repos d'un pad (hors flash). */
  private restGlow(i: number): Glow {
    const k = PADS[i].kind;
    if (k === 'voice') return i === this.selected ? SELECTED : OFF;
    if (k === 'open') return this.open ? ORANGE_DIM : ORANGE;
    const on = i === this.activePage;
    if (on) return ACTIVE;
    return i === this.hover ? HOVER : FAINT;
  }

  private refresh(i: number): void {
    if (i < 0 || this.flashing[i]) return;
    const g = this.restGlow(i);
    if (g !== this.glow[i]) this.setGlow(i, g);
  }

  /** Frappe : le pad s'enfonce et remonte ; une voix flashe 120 ms (lumiere seule en reduced motion). */
  press(id: PadId, now: number = performance.now()): void {
    const i = this.index(id);
    if (i < 0) return;
    this.lastPress.id = id;
    this.lastPress.at = performance.now();
    this.lastPress.count += 1;
    if (PADS[i].kind === 'voice') this.flashAt(i, PAD_FX.flashMs, now);
    if (!this.opts.reduced()) {
      const key = this.keyY[i];
      const set = this.setters[i];
      const tw = this.opts.tweens;
      tw.run(key, set, this.y[i], -PAD.press, PAD_FX.downMs, linear, now, (end) =>
        tw.run(key, set, -PAD.press, 0, PAD_FX.upMs, easeOutCubic, end)
      );
    }
    this.opts.repaint();
  }

  /**
   * Flash seul (coups du sequenceur). Sa fin est une echeance relue par
   * update() : deux frames par flash (allume, eteint).
   */
  flash(inst: Inst, ms: number = PAD_FX.seqFlashMs, now: number = performance.now()): void {
    const i = this.index(inst);
    if (i >= 0) this.flashAt(i, ms, now);
  }

  private flashAt(i: number, ms: number, now: number): void {
    // Un flash ne raccourcit jamais celui qui brille deja
    this.flashUntil[i] = this.flashing[i] ? Math.max(this.flashUntil[i], now + ms) : now + ms;
    this.flashing[i] = 1;
    this.flashCount[i] += 1;
    if (this.glow[i] !== FLASH) this.setGlow(i, FLASH);
    this.opts.repaint();
  }

  /**
   * Animateur du Stage : eteint les flashs echus ('paint' : de la lumiere
   * seulement, pas de passe d'ombre) ; 'poll' tant qu'un flash attend son
   * echeance.
   */
  update(now: number): 'paint' | 'poll' | false {
    let changed = false;
    let pending = false;
    for (let i = 0; i < COUNT; i += 1) {
      if (!this.flashing[i]) continue;
      if (now >= this.flashUntil[i]) {
        this.flashing[i] = 0;
        this.setGlow(i, this.restGlow(i));
        changed = true;
      } else {
        pending = true;
      }
    }
    return changed ? 'paint' : pending ? 'poll' : false;
  }

  /** L'instrument selectionne reste allume (blanc chaud faible). */
  setSelected(inst: Inst | null): boolean {
    const i = inst ? this.index(inst) : -1;
    if (i === this.selected) return false;
    const prev = this.selected;
    this.selected = i;
    this.refresh(prev);
    this.refresh(i);
    return true;
  }

  /** La page ouverte (yellowHi) ; les autres pages en jaune faible. */
  setActivePage(id: PageId | null): boolean {
    const i = id ? this.index(id) : -1;
    if (i === this.activePage) return false;
    const prev = this.activePage;
    this.activePage = i;
    this.refresh(prev);
    this.refresh(i);
    return true;
  }

  /** OPEN allume (yellowHi) pendant l'ouverture et vue ouverte. */
  setOpen(on: boolean): boolean {
    if (on === this.open) return false;
    this.open = on;
    this.refresh(this.index('open'));
    return true;
  }

  /** Survol a la souris : une page (ou OPEN) s'eclaire un peu plus ; true s'il faut une frame. */
  setHover(id: PadId | null): boolean {
    const i = id ? this.index(id) : -1;
    const h = i >= 0 && PADS[i].kind !== 'voice' ? i : -1;
    if (h === this.hover) return false;
    const prev = this.hover;
    this.hover = h;
    this.refresh(prev);
    this.refresh(h);
    return true;
  }

  /**
   * Les 12 pads pour le picking, en ordre de lecture : la boite 0.96 x 0.26
   * (dome compris). Voix : 'pad' ; pages : 'page' (et leur section) ;
   * OPEN : 'open'.
   */
  hotspots(layer: Object3D): HotspotDef[] {
    return PADS.map((p) => {
      const base = {
        id: `pad-${p.id}`,
        layer,
        shape: 'box' as const,
        x: p.x,
        z: p.z,
        hx: PAD.size / 2,
        hz: PAD.size / 2,
        y0: 0,
        y1: PAD.domeY + PAD.dome,
        enabled: true,
      };
      if (p.kind === 'voice') return { ...base, kind: 'pad' as const, inst: p.id };
      if (p.kind === 'page') return { ...base, kind: 'page' as const, section: p.id };
      return { ...base, kind: 'open' as const };
    });
  }

  info(): PadsInfo {
    return {
      ids: PADS.map((p) => p.id),
      y: Array.from(this.y, (v) => +v.toFixed(4)),
      glow: Array.from(this.glow, (g) => GLOW_NAME[g as Glow]),
      selected: this.selected >= 0 ? (PADS[this.selected].id as Inst) : null,
      activePage: this.activePage >= 0 ? (PADS[this.activePage].id as PageId) : null,
      open: this.open,
      hover: this.hover >= 0 ? PADS[this.hover].id : null,
      lastPress: { ...this.lastPress },
      flashes: Array.from(this.flashCount),
    };
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
    this.halos.geometry.dispose();
    this.haloMat.dispose();
    this.haloTex.dispose();
    this.halos.dispose();
  }
}
