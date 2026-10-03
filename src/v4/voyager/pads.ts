/**
 * Le plateau du MM-VOYAGEUR (2026-10-03) : les huit pads d'accords
 * (caoutchouc bombe retroeclaire, comme ceux de la 808) et les boutons
 * (TRACKS a CONTACT, OPEN, CLEAR, RANDOM : des touches rectangulaires
 * retroeclairees). Deux InstancedMesh et un de halos additifs : trois
 * draw calls.
 *
 * Lumieres :
 * - pad hors progression : jaune faible (on le voit, on a envie d'y
 *   toucher) ; dans la progression : orange ; l'accord qui joue : yellowHi ;
 *   chaque note de l'arpege le fait flasher ;
 * - pages : jaune faible, yellowHi pour la page ouverte ; OPEN : orange
 *   plein qui respire, faible machine ouverte ; CLEAR et RANDOM : eteints,
 *   un eclat a l'appui.
 * Appui : la touche s'enfonce et remonte (reduced motion : la lumiere seule).
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
  Quaternion,
  Vector3,
  type BufferGeometry,
  type CanvasTexture,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HotspotDef } from '../scene/hit';
import { albedo, withInstanceEmissive } from '../scene/materials';
import { makeHaloTexture } from '../scene/silk';
import { easeOutCubic, linear, type Tweens } from '../scene/tween';
import { COLOR, MATERIAL, OPEN_BREATHE, OPEN_TINT, PAD_FX, PAD_GLOW, PAD_HALO, gainOf, type PageId } from '../theme';
import { CHORDS } from './chords';
import { VOY_BUTTON, VOY_BUTTONS, VOY_PAD, voyPadAt, type VoyButtonId } from './theme';

const PADS = CHORDS.length;
const BTNS = VOY_BUTTONS.length;
const OPEN_I = VOY_BUTTONS.findIndex((b) => b.id === 'open');

type Glow = 'off' | 'faint' | 'hover' | 'queued' | 'active' | 'flash' | 'orange' | 'orangeDim';
const RGB: Record<Glow, readonly number[]> = {
  off: [0, 0, 0],
  faint: PAD_GLOW.faint,
  hover: PAD_GLOW.hover,
  queued: [0.3, 0.07, 0],
  active: PAD_GLOW.active,
  flash: PAD_GLOW.flash,
  orange: PAD_GLOW.orange,
  orangeDim: PAD_GLOW.orangeDim,
};
const HALO: Record<Glow, number> = {
  off: 0,
  faint: PAD_HALO.faint,
  hover: PAD_HALO.hover,
  queued: 0.12,
  active: PAD_HALO.active,
  flash: PAD_HALO.flash,
  orange: PAD_HALO.orange,
  orangeDim: PAD_HALO.orangeDim,
};

const m4 = new Matrix4();
const col = new Color();
const q0 = new Quaternion();
const v3 = new Vector3();
const s3 = new Vector3();
const YELLOW = new Color(COLOR.yellow);
const YELLOW_HI = new Color(COLOR.yellowHi);
const ORANGE = new Color(COLOR.orange);

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Couleur caoutchouc et masque emissif (1 dessus, 0.55 sur les flancs). */
function paintRubber(g: BufferGeometry): void {
  const rubber = albedo('pad', new Color(), gainOf('pad'));
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

/** Pad bombe (la geometrie des pads de la 808, a la taille de VOY_PAD). */
function padGeometry(mobile: boolean): BufferGeometry {
  const P = VOY_PAD;
  const box = new RoundedBoxGeometry(P.size, P.height, P.size, mobile ? 2 : 3, P.radius);
  box.translate(0, P.height / 2, 0);
  const flat = P.size - 2 * P.radius;
  const plane = new PlaneGeometry(flat, flat, 6, 6);
  plane.rotateX(-Math.PI / 2);
  const pos = plane.getAttribute('position');
  const h = flat / 2;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i) / h;
    const z = pos.getZ(i) / h;
    pos.setY(i, P.height + 0.002 + P.dome * (1 - x * x) * (1 - z * z));
  }
  plane.computeVertexNormals();
  const dome = plane.toNonIndexed();
  plane.dispose();
  const parts = [box, dome];
  for (const g of parts) {
    g.deleteAttribute('uv');
    paintRubber(g);
  }
  const merged = mergeGeometries(parts, false);
  box.dispose();
  dome.dispose();
  if (!merged) throw new Error('voyager: pads merge failed');
  return merged;
}

/** Touche unite (1 x h x 1), mise a l'echelle par instance. */
function buttonGeometry(mobile: boolean): BufferGeometry {
  const g = new RoundedBoxGeometry(1, VOY_BUTTON.h, 1, mobile ? 2 : 3, VOY_BUTTON.radius);
  g.translate(0, VOY_BUTTON.h / 2, 0);
  g.deleteAttribute('uv');
  paintRubber(g);
  return g;
}

export interface VoyKeysOpts {
  tweens: Tweens;
  reduced: () => boolean;
  repaint: () => void;
  mobile: boolean;
}

export class VoyKeys {
  readonly pads: InstancedMesh;
  readonly buttons: InstancedMesh;
  readonly halos: InstancedMesh;
  private padMat: MeshStandardMaterial;
  private btnMat: MeshStandardMaterial;
  private haloMat: MeshBasicMaterial;
  private haloTex: CanvasTexture;
  private padEm: InstancedBufferAttribute;
  private btnEm: InstancedBufferAttribute;
  private padY = new Float32Array(PADS);
  private btnY = new Float32Array(BTNS);
  private padGlow: Glow[] = Array<Glow>(PADS).fill('faint');
  private btnGlow: Glow[] = Array<Glow>(BTNS).fill('off');
  private flashUntil = new Float64Array(PADS + BTNS);
  private flashing = new Uint8Array(PADS + BTNS);
  /** progression et accord qui joue */
  private queued = new Set<number>();
  private playing = -1;
  private activePage = -1;
  private open = false;
  private hover = -1;
  private breath = 1;
  readonly flashes = new Uint32Array(PADS);

  constructor(private opts: VoyKeysOpts) {
    const pg = padGeometry(opts.mobile);
    this.padEm = new InstancedBufferAttribute(new Float32Array(PADS * 3), 3);
    this.padEm.setUsage(DynamicDrawUsage);
    pg.setAttribute('instanceEmissive', this.padEm);
    this.padMat = withInstanceEmissive(new MeshStandardMaterial({ vertexColors: true, ...MATERIAL.pad }), true);
    this.padMat.name = 'voyPad';
    this.pads = new InstancedMesh(pg, this.padMat, PADS);
    this.pads.name = 'voyPads';
    this.pads.castShadow = true;
    this.pads.receiveShadow = true;
    this.pads.instanceMatrix.setUsage(DynamicDrawUsage);

    const bg = buttonGeometry(opts.mobile);
    this.btnEm = new InstancedBufferAttribute(new Float32Array(BTNS * 3), 3);
    this.btnEm.setUsage(DynamicDrawUsage);
    bg.setAttribute('instanceEmissive', this.btnEm);
    this.btnMat = withInstanceEmissive(new MeshStandardMaterial({ vertexColors: true, ...MATERIAL.pad }), true);
    this.btnMat.name = 'voyButton';
    this.buttons = new InstancedMesh(bg, this.btnMat, BTNS);
    this.buttons.name = 'voyButtons';
    this.buttons.castShadow = !opts.mobile;
    this.buttons.receiveShadow = true;
    this.buttons.instanceMatrix.setUsage(DynamicDrawUsage);
    for (let i = 0; i < BTNS; i += 1) this.buttons.setColorAt(i, col.setRGB(1, 1, 1));
    this.buttons.setColorAt(OPEN_I, col.setRGB(OPEN_TINT[0], OPEN_TINT[1], OPEN_TINT[2]));
    this.buttons.instanceColor?.setUsage(DynamicDrawUsage);

    this.haloTex = makeHaloTexture();
    this.haloMat = new MeshBasicMaterial({ map: this.haloTex, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
    this.haloMat.name = 'voyHalo';
    const hg = new PlaneGeometry(1, 1);
    hg.rotateX(-Math.PI / 2);
    this.halos = new InstancedMesh(hg, this.haloMat, PADS + BTNS);
    this.halos.name = 'voyHalos';
    for (let i = 0; i < PADS; i += 1) {
      const p = voyPadAt(i);
      const k = VOY_PAD.size * 1.16;
      this.halos.setMatrixAt(i, m4.compose(v3.set(p.x, 0.003, p.z), q0, s3.set(k, 1, k)));
      this.placePad(i);
    }
    VOY_BUTTONS.forEach((b, i) => {
      this.halos.setMatrixAt(PADS + i, m4.compose(v3.set(b.x, 0.003, b.z), q0, s3.set(b.w * 1.25, 1, b.d * 1.4)));
      this.placeButton(i);
    });
    this.halos.instanceMatrix.needsUpdate = true;
    this.halos.instanceColor?.setUsage(DynamicDrawUsage);
    for (let i = 0; i < PADS; i += 1) this.setPadGlow(i, this.padRest(i));
    for (let i = 0; i < BTNS; i += 1) this.setBtnGlow(i, this.btnRest(i));
  }

  private placePad(i: number): void {
    const p = voyPadAt(i);
    this.pads.setMatrixAt(i, m4.makeTranslation(p.x, this.padY[i], p.z));
    this.pads.instanceMatrix.needsUpdate = true;
  }

  private placeButton(i: number): void {
    const b = VOY_BUTTONS[i];
    this.buttons.setMatrixAt(i, m4.compose(v3.set(b.x, this.btnY[i], b.z), q0, s3.set(b.w, 1, b.d)));
    this.buttons.instanceMatrix.needsUpdate = true;
  }

  private haloColor(i: number, g: Glow, k = 1): void {
    const tint = g === 'active' ? YELLOW_HI : g === 'queued' || g === 'orange' || g === 'orangeDim' ? ORANGE : YELLOW;
    this.halos.setColorAt(i, col.copy(tint).multiplyScalar(HALO[g] * k));
    if (this.halos.instanceColor) this.halos.instanceColor.needsUpdate = true;
  }

  private setPadGlow(i: number, g: Glow): void {
    this.padGlow[i] = g;
    const a = this.padEm.array as Float32Array;
    const c = RGB[g];
    a[i * 3] = c[0];
    a[i * 3 + 1] = c[1];
    a[i * 3 + 2] = c[2];
    this.padEm.needsUpdate = true;
    this.haloColor(i, g);
  }

  private setBtnGlow(i: number, g: Glow): void {
    this.btnGlow[i] = g;
    const k = i === OPEN_I && g === 'orange' ? this.breath : 1;
    const a = this.btnEm.array as Float32Array;
    const c = RGB[g];
    a[i * 3] = c[0] * k;
    a[i * 3 + 1] = c[1] * k;
    a[i * 3 + 2] = c[2] * k;
    this.btnEm.needsUpdate = true;
    this.haloColor(PADS + i, g, k);
  }

  private padRest(i: number): Glow {
    if (i === this.playing) return 'active';
    if (this.queued.has(i)) return 'queued';
    return i === this.hover ? 'hover' : 'faint';
  }

  private btnRest(i: number): Glow {
    const b = VOY_BUTTONS[i];
    if (b.id === 'open') return this.open ? 'orangeDim' : 'orange';
    if (b.id === 'clear' || b.id === 'random') return PADS + i === this.hover ? 'hover' : 'off';
    if (i === this.activePage) return 'active';
    return PADS + i === this.hover ? 'hover' : 'faint';
  }

  private refreshPad(i: number): void {
    if (i < 0 || i >= PADS || this.flashing[i]) return;
    const g = this.padRest(i);
    if (g !== this.padGlow[i]) this.setPadGlow(i, g);
  }

  private refreshBtn(i: number): void {
    if (i < 0 || i >= BTNS || this.flashing[PADS + i]) return;
    const g = this.btnRest(i);
    if (g !== this.btnGlow[i]) this.setBtnGlow(i, g);
  }

  buttonIndex(id: VoyButtonId): number {
    return VOY_BUTTONS.findIndex((b) => b.id === id);
  }

  /** La progression (pads en orange) et l'accord qui joue (yellowHi) ; true s'il faut une frame. */
  setChords(prog: readonly number[], playing: number): boolean {
    const next = new Set(prog);
    let changed = playing !== this.playing;
    for (let i = 0; i < PADS; i += 1) if (next.has(i) !== this.queued.has(i)) changed = true;
    if (!changed) return false;
    this.queued = next;
    this.playing = playing;
    for (let i = 0; i < PADS; i += 1) this.refreshPad(i);
    return true;
  }

  setActivePage(id: PageId | null): boolean {
    const i = id ? this.buttonIndex(id) : -1;
    if (i === this.activePage) return false;
    const prev = this.activePage;
    this.activePage = i;
    this.refreshBtn(prev);
    this.refreshBtn(i);
    return true;
  }

  setOpen(on: boolean): boolean {
    if (on === this.open) return false;
    this.open = on;
    this.refreshBtn(OPEN_I);
    return true;
  }

  /** Survol a la souris : un pad (0 a 7) ou un bouton (8 et plus) ; -1 : aucun. */
  setHover(slot: number): boolean {
    if (slot === this.hover) return false;
    const prev = this.hover;
    this.hover = slot;
    for (const s of [prev, slot]) {
      if (s < 0) continue;
      if (s < PADS) this.refreshPad(s);
      else this.refreshBtn(s - PADS);
    }
    return true;
  }

  /** Flash d'un pad (une note de l'arpege) : sa fin est une echeance relue par update(). */
  flashPad(i: number, ms: number, now: number): void {
    if (i < 0 || i >= PADS) return;
    this.flashUntil[i] = this.flashing[i] ? Math.max(this.flashUntil[i], now + ms) : now + ms;
    this.flashing[i] = 1;
    this.flashes[i] += 1;
    if (this.padGlow[i] !== 'flash') this.setPadGlow(i, 'flash');
    this.opts.repaint();
  }

  private flashBtn(i: number, now: number): void {
    const s = PADS + i;
    this.flashUntil[s] = now + PAD_FX.flashMs * 2;
    this.flashing[s] = 1;
    if (this.btnGlow[i] !== 'flash') this.setBtnGlow(i, 'flash');
  }

  private tweenY(key: string, from: number, set: (v: number) => void, depth: number, now: number): void {
    if (this.opts.reduced()) return;
    const tw = this.opts.tweens;
    tw.run(key, set, from, -depth, PAD_FX.downMs, linear, now, (end) => tw.run(key, set, -depth, 0, PAD_FX.upMs, easeOutCubic, end));
  }

  /** Appui sur un pad : il s'enfonce (la lumiere suit l'arpege). */
  pressPad(i: number, now = performance.now()): void {
    if (i < 0 || i >= PADS) return;
    this.tweenY(`vpad.${i}`, this.padY[i], (v) => {
      this.padY[i] = v;
      this.placePad(i);
    }, 0.06, now);
    this.flashPad(i, PAD_FX.flashMs, now);
  }

  /** Appui sur un bouton : il s'enfonce ; CLEAR et RANDOM eclairent. */
  pressButton(id: VoyButtonId, now = performance.now()): void {
    const i = this.buttonIndex(id);
    if (i < 0) return;
    this.tweenY(`vbtn.${i}`, this.btnY[i], (v) => {
      this.btnY[i] = v;
      this.placeButton(i);
    }, VOY_BUTTON.press, now);
    if (id === 'clear' || id === 'random') this.flashBtn(i, now);
    this.opts.repaint();
  }

  /** Animateur : eteint les flashs echus ('paint') ; 'poll' tant qu'un flash attend. */
  update(now: number): 'paint' | 'poll' | false {
    let changed = false;
    let pending = false;
    for (let s = 0; s < PADS + BTNS; s += 1) {
      if (!this.flashing[s]) continue;
      if (now >= this.flashUntil[s]) {
        this.flashing[s] = 0;
        if (s < PADS) this.setPadGlow(s, this.padRest(s));
        else this.setBtnGlow(s - PADS, this.btnRest(s - PADS));
        changed = true;
      } else pending = true;
    }
    return changed ? 'paint' : pending ? 'poll' : false;
  }

  /** OPEN respire, comme celui de la 808 ; true si sa lumiere a change. */
  breathe(now: number): boolean {
    if (this.btnGlow[OPEN_I] !== 'orange') return false;
    const B = OPEN_BREATHE;
    const phase = Math.round((0.5 + 0.5 * Math.cos((2 * Math.PI * now) / B.periodMs)) * 100) / 100;
    const k = B.min + (1 - B.min) * phase;
    if (k === this.breath) return false;
    this.breath = k;
    this.setBtnGlow(OPEN_I, 'orange');
    const f = B.tintMin + (1 - B.tintMin) * phase;
    this.buttons.setColorAt(OPEN_I, col.setRGB(OPEN_TINT[0] * f, OPEN_TINT[1] * f, OPEN_TINT[2] * f));
    if (this.buttons.instanceColor) this.buttons.instanceColor.needsUpdate = true;
    return true;
  }

  stopBreath(): boolean {
    if (this.breath === 1) return false;
    this.breath = 1;
    this.setBtnGlow(OPEN_I, this.btnGlow[OPEN_I]);
    this.buttons.setColorAt(OPEN_I, col.setRGB(OPEN_TINT[0], OPEN_TINT[1], OPEN_TINT[2]));
    if (this.buttons.instanceColor) this.buttons.instanceColor.needsUpdate = true;
    return true;
  }

  get breathing(): boolean {
    return this.btnGlow[OPEN_I] === 'orange';
  }

  hotspots(layer: Object3D): HotspotDef[] {
    const out: HotspotDef[] = [];
    for (let i = 0; i < PADS; i += 1) {
      const p = voyPadAt(i);
      out.push({
        id: `vpad-${i}`,
        kind: 'vpad',
        layer,
        shape: 'box',
        x: p.x,
        z: p.z,
        hx: VOY_PAD.size / 2,
        hz: VOY_PAD.size / 2,
        y0: 0,
        y1: VOY_PAD.height + VOY_PAD.dome,
        enabled: true,
        vpad: i,
      });
    }
    for (const b of VOY_BUTTONS) {
      const base = { layer, shape: 'box' as const, x: b.x, z: b.z, hx: b.w / 2, hz: b.d / 2, y0: 0, y1: VOY_BUTTON.h, enabled: true };
      if (b.id === 'open') out.push({ ...base, id: 'vbtn-open', kind: 'vopen' });
      else if (b.id === 'clear' || b.id === 'random') out.push({ ...base, id: `vbtn-${b.id}`, kind: 'vbtn', vbtn: b.id });
      else out.push({ ...base, id: `vbtn-${b.id}`, kind: 'vpage', section: b.id });
    }
    return out;
  }

  info(): { padGlow: Glow[]; btnGlow: Glow[]; flashes: number[]; playing: number; queued: number[] } {
    return { padGlow: [...this.padGlow], btnGlow: [...this.btnGlow], flashes: Array.from(this.flashes), playing: this.playing, queued: [...this.queued] };
  }

  dispose(): void {
    for (const m of [this.pads, this.buttons, this.halos]) {
      m.geometry.dispose();
      m.dispose();
    }
    this.padMat.dispose();
    this.btnMat.dispose();
    this.haloMat.dispose();
    this.haloTex.dispose();
  }
}
