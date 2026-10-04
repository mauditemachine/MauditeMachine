/**
 * Le MM-SMPL en 3D (2026-10-04) : un bloc de la famille du MM-DECKS (le
 * coin, le dessus brosse, les vis, les pieds, la connectique derriere),
 * fait de ses pieces (dj/body.ts, dj/controls.ts, dj/silk.ts) :
 * - l'ecran (smpl/screen.ts) et ses tetes de lecture ;
 * - douze potards, une rangee de neuf touches en caoutchouc (REV, LOOP,
 *   REC s'allument), PLAY (le bouton rond d'aluminium d'une platine), seize
 *   pads en caoutchouc plus epais qui s'allument : orange quand ils ont une
 *   slice, jaune quand ils sonnent ;
 * - la serigraphie : l'en-tete, les noms, les crochets SAMPLE / SHAPE /
 *   GRAIN et PADS, le numero de chaque pad.
 * Tout dans le repere top (le dessus incline), x = 0 au centre du bloc.
 */

import { BufferGeometry, CylinderGeometry, DynamicDrawUsage, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3, type CanvasTexture, type Texture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HotspotDef, Occluder } from '../scene/hit';
import { potAngle } from '../scene/encoders';
import { withInstanceEmissive } from '../scene/materials';
import { makeBrushTexture, whenFonts } from '../scene/silk';
import { APPEARANCE } from '../theme';
import { bezel, dc, partDj, power, rca, screw, usb, wedge } from '../dj/body';
import { DJ_GLOW, keyGeometry, knobGeometry, labelGeometry, labelTexture, roundGeometry } from '../dj/controls';
import { DjSilk, headTexts, type Bracket, type Line, type Text } from '../dj/silk';
import { DJ_BODY, DJ_KEY, DJ_KNOB, DJ_ROUND, DJ_TILT, DJ_TOP_Y } from '../dj/theme';
import { smplEngine } from './engine';
import { SMPL_KNOBS, smplParams, type SmplKnobId } from './params';
import { SmplScreen } from './screen';
import { SMPL_PADS } from './slices';
import { padCount, smplState } from './state';
import { SMPL, SMPL_D, SMPL_KEYS, SMPL_KNOB_ROWS, SMPL_ROW_NAMES, SMPL_W, smplKeyAt, smplKnobAt, smplPadAt, smplX, type SmplKeyKind } from './theme';

const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const v3 = new Vector3();
const q = new Quaternion();
const q0 = new Quaternion();
const s3 = new Vector3();

export interface SmplRigOpts {
  mobile: boolean;
  anisotropy: number;
  /** a droite du MM-DECKS (sinon du MM-ARP) */
  withDj: boolean;
  repaint: () => void;
  invalidate: () => void;
}

/* ---------------- les ids des commandes ---------------- */

export const smplKnobId = (k: SmplKnobId): string => `smpl-knob-${k}`;
export const smplKeyId = (k: SmplKeyKind): string => `smpl-key-${k}`;
export const smplPadId = (i: number): string => `smpl-pad-${i + 1}`;
export const SMPL_PLAY_ID = 'smpl-play';
export const SMPL_SCREEN_ID = 'smpl-screen';

/* ---------------- le corps ---------------- */

function buildBody(mobile: boolean): BufferGeometry {
  const seg = mobile ? 12 : 16;
  const hw = SMPL_W / 2;
  const hd = SMPL_D / 2;
  const parts: BufferGeometry[] = [wedge(-hw, hw)];
  // Quatre pieds, quatre vis
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const f = new CylinderGeometry(0.3, 0.3, DJ_BODY.feet, seg);
      f.translate(sx * (hw - 0.6), DJ_BODY.feet / 2, sz * (hd - 0.6));
      parts.push(partDj(f, 'rubber'));
      parts.push(...screw(sx * (hw - 0.26), sz * (hd - 0.26), seg));
    }
  }
  parts.push(bezel(SMPL.screen.x, SMPL.screen.z, SMPL.screen.w, SMPL.screen.d));
  // Derriere : sorties RCA, USB-C, alimentation et interrupteur (vu de derriere, la gauche est a +x)
  const y = 0.78;
  parts.push(...rca(2.6, y, seg), ...rca(2.25, y, seg), ...usb(1.4, y), ...dc(-2.4, y, seg), ...power(-3.0, y));
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!g) throw new Error('smpl: body merge failed');
  const pos = g.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    uv[i * 2] = pos.getX(i);
    uv[i * 2 + 1] = pos.getZ(i);
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

/* ---------------- la serigraphie ---------------- */

const knobLabelZ = (z: number): number => z - DJ_KNOB.skirt.r * SMPL.knobs.s - 0.12;

function silkItems(): { texts: Text[]; lines: Line[]; brackets: Bracket[] } {
  const texts: Text[] = headTexts('MM-SMPL', 'SAMPLER / SLICER / GRANULAR', SMPL_W, SMPL.head.z, 1.95);
  const lines: Line[] = [];
  const brackets: Bracket[] = [];
  // Les touches : leur nom au-dessus ; un filet entre les sources et le reste
  SMPL_KEYS.forEach((k, i) => {
    const p = smplKeyAt(i);
    texts.push({ text: k.label, x: p.x, z: p.z - SMPL.keys.d / 2 - 0.15, cap: 0.058, weight: 700, group: 'keys', maxW: 0.8 });
  });
  const sep = (smplKeyAt(3).x + smplKeyAt(4).x) / 2;
  lines.push([sep, SMPL.keys.z - 0.3, sep, SMPL.keys.z + 0.2]);
  // Les potards : le nom au-dessus, les butees, un crochet par rangee
  const r = DJ_KNOB.skirt.r * SMPL.knobs.s;
  SMPL_KNOB_ROWS.forEach((row, ri) => {
    for (const id of row) {
      const p = smplKnobAt(id);
      const def = SMPL_KNOBS.find((k) => k.id === id);
      texts.push({ text: def?.label ?? id, x: p.x, z: knobLabelZ(p.z), cap: 0.062, maxW: 0.8, group: 'knob' });
      const r0 = r + 0.035;
      const r1 = r0 + 0.055;
      for (const deg of def?.bipolar ? [225, 90, -45] : [225, -45]) {
        const a = (deg * Math.PI) / 180;
        lines.push([p.x + Math.cos(a) * r0, p.z - Math.sin(a) * r0, p.x + Math.cos(a) * r1, p.z - Math.sin(a) * r1]);
      }
    }
    const xs = SMPL.knobs.xs;
    brackets.push({ text: SMPL_ROW_NAMES[ri], x0: xs[0] - r, x1: xs[xs.length - 1] + r, z: SMPL.knobs.zs[ri] + r + 0.2 });
  });
  // PLAY : son nom au-dessus, ce qu'il joue a cote
  const P = SMPL.play;
  texts.push({ text: 'PLAY', x: P.x, z: P.z - P.r - 0.16, cap: 0.075, weight: 700 });
  texts.push({ text: 'THE REGION, OR THE GRAIN CLOUD', x: P.x + P.r + 0.25, z: P.z, cap: 0.055, align: 'left', alpha: 0.5 });
  // Les pads : leur numero au-dessus a gauche, le crochet dessous
  const h = SMPL.pads.size / 2;
  for (let i = 0; i < SMPL_PADS; i += 1) {
    const p = smplPadAt(i);
    texts.push({ text: String(i + 1), x: p.x - h + 0.02, z: p.z - h - 0.11, cap: 0.055, weight: 700, align: 'left', alpha: 0.6 });
  }
  const px = SMPL.pads.xs;
  brackets.push({ text: 'PADS', x0: px[0] - h, x1: px[px.length - 1] + h, z: SMPL.pads.zs[0] + h + 0.22 });
  return { texts, lines, brackets };
}

/* ---------------- le rig ---------------- */

export class SmplRig {
  readonly root = new Group();
  readonly socle = new Group();
  readonly top = new Group();
  readonly screen: SmplScreen;
  private body: Mesh;
  private bodyMat: MeshStandardMaterial;
  private brush: Texture;
  private knobs: InstancedMesh;
  private keys: InstancedMesh;
  private pads: InstancedMesh;
  private play: InstancedMesh;
  private playLabel: InstancedMesh;
  private labelTex: CanvasTexture;
  private silk: DjSilk;
  private materials: MeshStandardMaterial[] = [];
  private keyEm: InstancedBufferAttribute;
  private padEm: InstancedBufferAttribute;
  private playEm: InstancedBufferAttribute;
  private knobAngle = new Float32Array(SMPL_KNOBS.length);
  private keyY = new Float32Array(SMPL_KEYS.length);
  private padY = new Float32Array(SMPL_PADS);
  private playY = 0;
  private defs: HotspotDef[];
  private unsubs: (() => void)[] = [];
  private held = new Set<string>();
  private screenAt = 0;
  private liveAt = -1;

  constructor(private opts: SmplRigOpts) {
    this.root.name = 'smplRoot';
    this.root.position.x = smplX(opts.withDj);
    this.socle.name = 'smplSocle';
    this.top.name = 'smplTop';
    this.top.position.set(0, DJ_TOP_Y, 0);
    this.top.rotation.x = DJ_TILT;
    this.root.add(this.socle, this.top);

    const light = APPEARANCE.current === 'light';
    this.brush = makeBrushTexture();
    this.bodyMat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughnessMap: this.brush, roughness: light ? 0.55 : 0.68, metalness: light ? 0 : 0.22 });
    this.bodyMat.name = 'smplBody';
    this.body = new Mesh(buildBody(opts.mobile), this.bodyMat);
    this.body.name = 'smplBody';
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.socle.add(this.body);

    const std = (name: string, p: { roughness: number; metalness: number }, emissive = false): MeshStandardMaterial => {
      const m = new MeshStandardMaterial({ vertexColors: true, ...p });
      m.name = name;
      this.materials.push(m);
      return emissive ? withInstanceEmissive(m, true) : m;
    };
    this.knobs = new InstancedMesh(knobGeometry(opts.mobile), std('smplKnob', { roughness: 0.42, metalness: 0.28 }), SMPL_KNOBS.length);
    this.knobs.name = 'smplKnobs';
    const kg = keyGeometry(opts.mobile);
    this.keyEm = new InstancedBufferAttribute(new Float32Array(SMPL_KEYS.length * 3), 3);
    this.keyEm.setUsage(DynamicDrawUsage);
    kg.setAttribute('instanceEmissive', this.keyEm);
    this.keys = new InstancedMesh(kg, std('smplKey', { roughness: 0.9, metalness: 0 }, true), SMPL_KEYS.length);
    this.keys.name = 'smplKeys';
    const pg = keyGeometry(opts.mobile);
    this.padEm = new InstancedBufferAttribute(new Float32Array(SMPL_PADS * 3), 3);
    this.padEm.setUsage(DynamicDrawUsage);
    pg.setAttribute('instanceEmissive', this.padEm);
    this.pads = new InstancedMesh(pg, std('smplPad', { roughness: 0.85, metalness: 0 }, true), SMPL_PADS);
    this.pads.name = 'smplPads';
    const rg = roundGeometry(opts.mobile, 'ring');
    this.playEm = new InstancedBufferAttribute(new Float32Array(3), 3);
    this.playEm.setUsage(DynamicDrawUsage);
    rg.setAttribute('instanceEmissive', this.playEm);
    this.play = new InstancedMesh(rg, std('smplPlay', { roughness: 0.3, metalness: light ? 0.2 : 0.55 }, true), 1);
    this.play.name = 'smplPlay';
    this.labelTex = labelTexture(opts.anisotropy);
    const labelMat = new MeshStandardMaterial({ map: this.labelTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, roughness: 0.6, metalness: 0 });
    labelMat.name = 'smplPlayLabel';
    this.materials.push(labelMat);
    this.playLabel = new InstancedMesh(labelGeometry(opts.mobile, 1), labelMat, 1);
    this.playLabel.name = 'smplPlayLabel';
    for (const m of [this.knobs, this.keys, this.pads, this.play, this.playLabel]) {
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      m.castShadow = !opts.mobile;
      m.receiveShadow = true;
    }
    this.top.add(this.knobs, this.keys, this.pads, this.play, this.playLabel);

    this.screen = new SmplScreen(opts.anisotropy, opts.mobile);
    this.top.add(this.screen.mesh, this.screen.heads);
    this.silk = new DjSilk({ name: 'smplSilk', w: SMPL_W, x: 0, items: silkItems, logo: SMPL.logo }, opts.anisotropy, opts.mobile);
    this.top.add(this.silk.mesh);

    SMPL_KNOBS.forEach((k, i) => {
      this.knobAngle[i] = potAngle(smplParams.of(k.id));
      this.placeKnob(i);
    });
    SMPL_KEYS.forEach((_, i) => this.placeKey(i));
    for (let i = 0; i < SMPL_PADS; i += 1) this.placePad(i);
    this.placePlay();
    this.defs = this.buildHotspots();
    this.syncLights();
    this.drawScreen(performance.now());
  }

  /* ---------- placement ---------- */

  private placeKnob(i: number): void {
    const p = smplKnobAt(SMPL_KNOBS[i].id);
    this.knobs.setMatrixAt(i, m4.compose(v3.set(p.x, 0, p.z), q.setFromAxisAngle(AXIS_Y, this.knobAngle[i]), s3.setScalar(SMPL.knobs.s)));
    this.knobs.instanceMatrix.needsUpdate = true;
  }

  private placeKey(i: number): void {
    const p = smplKeyAt(i);
    this.keys.setMatrixAt(i, m4.compose(v3.set(p.x, this.keyY[i], p.z), q0, s3.set(SMPL.keys.w, 1, SMPL.keys.d)));
    this.keys.instanceMatrix.needsUpdate = true;
  }

  private placePad(i: number): void {
    const p = smplPadAt(i);
    this.pads.setMatrixAt(i, m4.compose(v3.set(p.x, this.padY[i], p.z), q0, s3.set(SMPL.pads.size, SMPL.pads.h, SMPL.pads.size)));
    this.pads.instanceMatrix.needsUpdate = true;
  }

  private placePlay(): void {
    const P = SMPL.play;
    m4.compose(v3.set(P.x, this.playY, P.z), q0, s3.set(P.r, 1, P.r));
    this.play.setMatrixAt(0, m4);
    this.playLabel.setMatrixAt(0, m4);
    this.play.instanceMatrix.needsUpdate = true;
    this.playLabel.instanceMatrix.needsUpdate = true;
  }

  /* ---------- picking ---------- */

  private buildHotspots(): HotspotDef[] {
    const top = this.top;
    const out: HotspotDef[] = [];
    const r = DJ_KNOB.skirt.r * SMPL.knobs.s + 0.04;
    for (const k of SMPL_KNOBS) {
      const p = smplKnobAt(k.id);
      out.push({ id: smplKnobId(k.id), kind: 'smplknob', layer: top, shape: 'disc', x: p.x, z: p.z, hx: r, hz: r, y0: 0, y1: (DJ_KNOB.skirt.h + DJ_KNOB.h) * SMPL.knobs.s, enabled: true, smpl: k.id });
    }
    SMPL_KEYS.forEach((k, i) => {
      const p = smplKeyAt(i);
      out.push({ id: smplKeyId(k.kind), kind: 'smplkey', layer: top, shape: 'box', x: p.x, z: p.z, hx: SMPL.keys.w / 2, hz: SMPL.keys.d / 2, y0: 0, y1: DJ_KEY.h, enabled: true, smpl: k.kind });
    });
    for (let i = 0; i < SMPL_PADS; i += 1) {
      const p = smplPadAt(i);
      out.push({ id: smplPadId(i), kind: 'smplpad', layer: top, shape: 'box', x: p.x, z: p.z, hx: SMPL.pads.size / 2, hz: SMPL.pads.size / 2, y0: 0, y1: DJ_KEY.h * SMPL.pads.h, enabled: true, smpl: String(i) });
    }
    const P = SMPL.play;
    out.push({ id: SMPL_PLAY_ID, kind: 'smplkey', layer: top, shape: 'disc', x: P.x, z: P.z, hx: P.r, hz: P.r, y0: 0, y1: DJ_ROUND.h, enabled: true, smpl: 'play' });
    const S = SMPL.screen;
    out.push({ id: SMPL_SCREEN_ID, kind: 'smplscreen', layer: top, shape: 'box', x: S.x, z: S.z, hx: S.w / 2, hz: S.d / 2, y0: 0, y1: 0.03, enabled: true, smpl: 'screen' });
    return out.map((d) => ({ ...d, machine: 'smpl' as const }));
  }

  get hotspots(): readonly HotspotDef[] {
    return this.defs;
  }

  /** Le volume plein du bloc, sous le dessus incline (repere top). */
  occluders(): Occluder[] {
    const depth = DJ_BODY.front + DJ_BODY.feet;
    return [{ layer: this.top, min: [-SMPL_W / 2, -depth, -SMPL_D / 2], max: [SMPL_W / 2, 0, SMPL_D / 2], tag: 'smpl' }];
  }

  /** Le point (u, v : 0 a 1 sur l'ecran) d'un point du repere top, pour les gestes. */
  screenUv(x: number, z: number): { u: number; v: number } {
    const S = SMPL.screen;
    return { u: (x - (S.x - S.w / 2)) / S.w, v: (z - (S.z - S.d / 2)) / S.d };
  }

  /** L'instant du sample sous u (0 a 1 sur l'ecran). */
  timeAt(u: number): number {
    return this.screen.timeAt(u);
  }

  /* ---------- etats ---------- */

  /** Les touches et les pads allumes ; true si ca change. */
  private syncLights(): boolean {
    const s = smplState.get();
    let changed = false;
    const set = (attr: InstancedBufferAttribute, i: number, rgb: readonly number[]): void => {
      const a = attr.array as Float32Array;
      if (a[i * 3] === rgb[0] && a[i * 3 + 1] === rgb[1] && a[i * 3 + 2] === rgb[2]) return;
      a[i * 3] = rgb[0];
      a[i * 3 + 1] = rgb[1];
      a[i * 3 + 2] = rgb[2];
      attr.needsUpdate = true;
      changed = true;
    };
    SMPL_KEYS.forEach((k, i) => {
      const on =
        this.held.has(smplKeyId(k.kind)) || (k.kind === 'rev' && s.reverse) || (k.kind === 'loop' && s.loop) || (k.kind === 'rec' && s.recording) || (k.kind === 'mode' && s.mode === 'grain');
      set(this.keyEm, i, k.kind === 'rec' && s.recording ? DJ_GLOW.orange : on ? DJ_GLOW.orange : DJ_GLOW.dim);
    });
    const n = padCount();
    const pale = [DJ_GLOW.orange[0] * 0.22, DJ_GLOW.orange[1] * 0.22, DJ_GLOW.orange[2] * 0.22];
    for (let i = 0; i < SMPL_PADS; i += 1) {
      const sounds = s.pads.includes(i) || this.held.has(smplPadId(i));
      set(this.padEm, i, sounds ? DJ_GLOW.yellow : i < n ? pale : DJ_GLOW.off);
    }
    const paleYellow = [DJ_GLOW.yellow[0] * 0.18, DJ_GLOW.yellow[1] * 0.18, DJ_GLOW.yellow[2] * 0.18];
    set(this.playEm, 0, s.preview ? DJ_GLOW.yellow : s.sample ? paleYellow : DJ_GLOW.off);
    return changed;
  }

  private syncKnobs(): boolean {
    let moved = false;
    SMPL_KNOBS.forEach((k, i) => {
      const a = Math.fround(potAngle(smplParams.of(k.id)));
      if (this.knobAngle[i] === a) return;
      this.knobAngle[i] = a;
      this.placeKnob(i);
      moved = true;
    });
    return moved;
  }

  private drawScreen(now: number): boolean {
    const s = smplState.get();
    const rec = s.recording ? (now - this.recFrom) / 1000 : 0;
    return this.screen.draw(s, smplParams.get(), smplEngine.data()?.mono ?? null, rec);
  }

  private recFrom = 0;
  private wasRec = false;

  /** Une touche, un pad ou PLAY s'enfonce ou remonte (pointeur, jumeau, clavier). */
  pressKey(id: string, down: boolean): void {
    if (down) this.held.add(id);
    else this.held.delete(id);
    const k = SMPL_KEYS.findIndex((x) => smplKeyId(x.kind) === id);
    let moved = false;
    if (k >= 0) {
      this.keyY[k] = down ? -DJ_KEY.press : 0;
      this.placeKey(k);
      moved = true;
    }
    if (id.startsWith('smpl-pad-')) {
      const i = Number(id.slice(9)) - 1;
      if (i >= 0 && i < SMPL_PADS) {
        this.padY[i] = down ? -DJ_KEY.press : 0;
        this.placePad(i);
        moved = true;
      }
    }
    if (id === SMPL_PLAY_ID) {
      this.playY = down ? -DJ_KEY.press : 0;
      this.placePlay();
      moved = true;
    }
    const lit = this.syncLights();
    if (moved && this.keys.castShadow) this.opts.invalidate();
    else if (moved || lit) this.opts.repaint();
  }

  /**
   * L'animateur : les tetes de lecture tant que quelque chose joue (et
   * REC, son compteur) ; 'paint' tant que ca bouge.
   */
  step = (now: number): 'paint' | false => {
    if (!this.root.visible) return false;
    const live = smplEngine.live();
    let changed = false;
    const playing = live.voices.size + live.clouds.size > 0;
    if (playing || this.liveAt !== live.at) {
      this.liveAt = live.at;
      if (this.screen.setLive(live)) changed = true;
    }
    const s = smplState.get();
    if (s.recording && !this.wasRec) this.recFrom = now;
    this.wasRec = s.recording;
    if (s.recording && now - this.screenAt > 250) {
      this.screenAt = now;
      if (this.drawScreen(now)) changed = true;
    }
    return playing || s.recording || changed ? 'paint' : false;
  };

  /** Abonnements, poses par le Stage une fois tout le GL construit. */
  listen(): void {
    this.unsubs.push(
      smplState.subscribe(() => {
        const lit = this.syncLights();
        const drawn = this.drawScreen(performance.now());
        if (lit || drawn) this.opts.repaint();
      }),
      smplParams.subscribe(() => {
        const moved = this.syncKnobs();
        const drawn = this.drawScreen(performance.now());
        if (moved && this.knobs.castShadow) this.opts.invalidate();
        else if (moved || drawn) this.opts.repaint();
      }),
      smplEngine.subscribeLive(() => this.opts.repaint())
    );
    void whenFonts().then(() => this.redrawText());
  }

  /** Polices ou logos arrives : la serigraphie et l'ecran se redessinent. */
  redrawText(): void {
    this.silk.draw();
    this.screen.invalidate();
    this.drawScreen(performance.now());
    this.opts.repaint();
  }

  setHover(_id: string | null): boolean {
    return false;
  }

  info(): { knobs: number; keys: number; pads: number; screenDraws: number; silkDraws: number; heads: number } {
    return { knobs: SMPL_KNOBS.length, keys: SMPL_KEYS.length, pads: SMPL_PADS, screenDraws: this.screen.draws, silkDraws: this.silk.draws, heads: this.screen.heads.count };
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    this.body.geometry.dispose();
    this.bodyMat.dispose();
    this.brush.dispose();
    for (const m of [this.knobs, this.keys, this.pads, this.play, this.playLabel]) {
      m.geometry.dispose();
      m.dispose();
    }
    this.labelTex.dispose();
    for (const m of this.materials) m.dispose();
    this.screen.dispose();
    this.silk.dispose();
  }
}
