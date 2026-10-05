/**
 * Le MM-SMPL en 3D (2026-10-04 ; facon Elektron Tonverk depuis le
 * 2026-10-05) : un bloc large et peu profond de la famille du MM-DECKS (le
 * coin, le dessus brosse, les vis, les pieds, la connectique derriere),
 * fait de ses pieces (dj/body.ts, dj/controls.ts, dj/silk.ts) :
 * - l'ecran en haut a gauche (smpl/screen.ts) et ses tetes de lecture ;
 * - douze encodeurs a sa droite, en trois rangees nommees en orange ;
 * - onze touches de fonction en caoutchouc (PLAY en or quand il joue ; REC,
 *   MODE, REV, LOOP en orange quand ils sont pris) ;
 * - seize touches de trig en ligne : orange pale quand elles ont une
 *   slice, or quand elles sonnent ;
 * - la serigraphie : l'en-tete, les noms, les filets entre les groupes, le
 *   numero de chaque trig, les reperes 1, 5, 9, 13.
 * Tout dans le repere top (le dessus incline), x = 0 au centre du bloc.
 */

import { BufferGeometry, CylinderGeometry, DynamicDrawUsage, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3, type Texture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HotspotDef, Occluder } from '../scene/hit';
import { potAngle } from '../scene/encoders';
import { withInstanceEmissive } from '../scene/materials';
import { makeBrushTexture, whenFonts } from '../scene/silk';
import { APPEARANCE } from '../theme';
import { bezel, dc, partDj, power, rca, screw, usb, wedge } from '../dj/body';
import { DJ_GLOW, keyGeometry, knobGeometry } from '../dj/controls';
import { DjSilk, headTexts, type Bracket, type Line, type Text } from '../dj/silk';
import { DJ_BODY, DJ_KEY, DJ_KNOB, DJ_TILT, DJ_TOP_Y, DJ_UNIT } from '../dj/theme';
import { smplEngine } from './engine';
import { SMPL_KNOBS, smplParams, type SmplKnobId } from './params';
import { SmplScreen } from './screen';
import { SMPL_PADS } from './slices';
import { padCount, smplState } from './state';
import { SMPL, SMPL_D, SMPL_KEY_GROUPS, SMPL_KEYS, SMPL_PAGES, SMPL_ROW_NAMES, SMPL_W, smplKeyAt, smplKnobAt, smplKnobTone, smplPadAt, smplX, type SmplKeyKind, type SmplKnobTone } from './theme';

const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const v3 = new Vector3();
const q = new Quaternion();
const q0 = new Quaternion();
const s3 = new Vector3();

export interface SmplRigOpts {
  mobile: boolean;
  anisotropy: number;
  repaint: () => void;
  invalidate: () => void;
}

/* ---------------- les ids des commandes ---------------- */

export const smplKnobId = (k: SmplKnobId): string => `smpl-knob-${k}`;
export const smplKeyId = (k: SmplKeyKind): string => `smpl-key-${k}`;
export const smplPadId = (i: number): string => `smpl-pad-${i + 1}`;
export const SMPL_PLAY_ID = smplKeyId('play');
export const SMPL_SCREEN_ID = 'smpl-screen';

/* ---------------- le corps ---------------- */

function buildBody(mobile: boolean): BufferGeometry {
  const seg = mobile ? 12 : 16;
  const hw = SMPL_W / 2;
  const hd = SMPL_D / 2;
  const parts: BufferGeometry[] = [wedge(-hw, hw, SMPL_D)];
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
  // Derriere : sorties RCA, USB-C, alimentation et interrupteur (vu de derriere, la gauche est a +x),
  // poses par dj/body.ts sur la face arriere d'un bloc du MM-DECKS : ramenes sur la notre, moins profonde
  const y = 0.78;
  const back = [...rca(4.2, y, seg), ...rca(3.85, y, seg), ...usb(2.8, y), ...dc(-4.0, y, seg), ...power(-4.6, y)];
  for (const b of back) b.translate(0, 0, (DJ_UNIT.d - SMPL_D) / 2);
  parts.push(...back);
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

/**
 * Le nom d'un potard, au-dessus de lui : assez loin pour que son capuchon ne
 * le cache pas, vu de face (plus haut est le potard, plus loin).
 */
const knobLabelZ = (z: number, s: number, sy: number): number => z - DJ_KNOB.skirt.r * s - 0.23 * sy;

function silkItems(): { texts: Text[]; lines: Line[]; brackets: Bracket[] } {
  const texts: Text[] = headTexts('MM-SMPL', 'SAMPLER / SLICER / GRANULAR', SMPL_W, SMPL.head.z, 1.95);
  const lines: Line[] = [];
  const brackets: Bracket[] = [];
  // Les touches de fonction : leur nom au-dessus ; un filet entre les groupes (transport, sources, le reste)
  const K = SMPL.keys;
  SMPL_KEYS.forEach((k, i) => {
    const p = smplKeyAt(i);
    texts.push({ text: k.label, x: p.x, z: p.z - K.d / 2 - 0.15, cap: 0.058, weight: 700, group: 'keys', maxW: 0.8, ...(k.kind === 'play' ? { ink: 'orange' as const, alpha: 1 } : {}) });
  });
  for (const g of SMPL_KEY_GROUPS) {
    const sep = (smplKeyAt(g - 1).x + smplKeyAt(g).x) / 2;
    lines.push([sep, K.z - 0.32, sep, K.z + 0.2]);
  }
  // Les potards : le nom au-dessus ; les gros gradues de 0 a 10 (0, 5 et 10 plus longs), les petits leurs butees ;
  // chaque page dans son crochet, son nom en orange (les pages d'une Elektron)
  const tick = (x: number, z: number, deg: number, r0: number, r1: number): void => {
    const a = (deg * Math.PI) / 180;
    lines.push([x + Math.cos(a) * r0, z - Math.sin(a) * r0, x + Math.cos(a) * r1, z - Math.sin(a) * r1]);
  };
  const N = SMPL.knobs;
  SMPL_PAGES.forEach((pg, c) => {
    for (const id of [pg.hero, ...pg.small]) {
      const p = smplKnobAt(id);
      const def = SMPL_KNOBS.find((k) => k.id === id);
      const r = DJ_KNOB.skirt.r * p.s;
      texts.push({ text: def?.label ?? id, x: p.x, z: knobLabelZ(p.z, p.s, p.sy), cap: p.hero ? 0.074 : 0.052, weight: p.hero ? 700 : undefined, maxW: p.hero ? 1.2 : 0.5, group: p.hero ? 'hero' : 'knob' });
      if (p.hero) {
        for (let t = 0; t <= 10; t += 1) {
          const major = t % 5 === 0;
          tick(p.x, p.z, 225 - t * 27, r + 0.04, r + (major ? 0.13 : 0.08));
        }
      } else {
        for (const deg of def?.bipolar ? [225, 90, -45] : [225, -45]) tick(p.x, p.z, deg, r + 0.03, r + 0.08);
      }
    }
    const half = N.small.dx + DJ_KNOB.skirt.r * N.small.s + 0.06;
    brackets.push({ text: SMPL_ROW_NAMES[c], x0: N.cols[c] - half, x1: N.cols[c] + half, z: N.head, down: true, ink: 'orange' });
  });
  // Les trigs : leur numero dessous, un repere au-dessus de chaque groupe de quatre (1, 5, 9, 13), le crochet
  const T = SMPL.trigs;
  for (let i = 0; i < SMPL_PADS; i += 1) {
    const p = smplPadAt(i);
    texts.push({ text: String(i + 1), x: p.x, z: p.z + T.d / 2 + 0.13, cap: 0.058, weight: 700, alpha: i % 4 === 0 ? 1 : 0.55, group: 'trigs' });
  }
  for (let g = 0; g < SMPL_PADS / 4; g += 1) {
    const a = smplPadAt(g * 4);
    const b = smplPadAt(g * 4 + 3);
    const z = T.z - T.d / 2 - 0.13;
    lines.push([a.x - T.w / 2, z, b.x + T.w / 2, z]);
  }
  brackets.push({ text: 'SLICES', x0: smplPadAt(0).x - T.w / 2, x1: smplPadAt(SMPL_PADS - 1).x + T.w / 2, z: T.z + T.d / 2 + 0.42 });
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
  /** les potards, par capuchon (noirs, aluminium, orange) : trois draw calls */
  private knobs: InstancedMesh[];
  private knobSlot: { m: number; j: number }[];
  private keys: InstancedMesh;
  private pads: InstancedMesh;
  private silk: DjSilk;
  private materials: MeshStandardMaterial[] = [];
  private keyEm: InstancedBufferAttribute;
  private padEm: InstancedBufferAttribute;
  private knobAngle = new Float32Array(SMPL_KNOBS.length);
  private keyY = new Float32Array(SMPL_KEYS.length);
  private padY = new Float32Array(SMPL_PADS);
  private defs: HotspotDef[];
  private unsubs: (() => void)[] = [];
  private held = new Set<string>();
  private screenAt = 0;
  private liveAt = -1;

  constructor(private opts: SmplRigOpts) {
    this.root.name = 'smplRoot';
    this.root.position.x = smplX();
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
    const tones: readonly SmplKnobTone[] = ['knob', 'ring', 'hot'];
    const knobMat = std('smplKnob', { roughness: 0.42, metalness: 0.28 });
    const count = [0, 0, 0];
    this.knobSlot = SMPL_KNOBS.map((k) => {
      const m = tones.indexOf(smplKnobTone(k.id));
      return { m, j: count[m]++ };
    });
    this.knobs = tones.map((t, i) => {
      const mesh = new InstancedMesh(knobGeometry(opts.mobile, t, t === 'ring' ? 'slit' : 'mark'), knobMat, Math.max(1, count[i]));
      mesh.name = `smplKnobs-${t}`;
      mesh.count = count[i];
      return mesh;
    });
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
    for (const m of [...this.knobs, this.keys, this.pads]) {
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      m.castShadow = !opts.mobile;
      m.receiveShadow = true;
    }
    this.top.add(...this.knobs, this.keys, this.pads);

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
    this.defs = this.buildHotspots();
    this.syncLights();
    this.drawScreen(performance.now());
  }

  /* ---------- placement ---------- */

  private placeKnob(i: number): void {
    const p = smplKnobAt(SMPL_KNOBS[i].id);
    const { m, j } = this.knobSlot[i];
    const mesh = this.knobs[m];
    mesh.setMatrixAt(j, m4.compose(v3.set(p.x, 0, p.z), q.setFromAxisAngle(AXIS_Y, this.knobAngle[i]), s3.set(p.s, p.sy, p.s)));
    mesh.instanceMatrix.needsUpdate = true;
  }

  private placeKey(i: number): void {
    const p = smplKeyAt(i);
    this.keys.setMatrixAt(i, m4.compose(v3.set(p.x, this.keyY[i], p.z), q0, s3.set(SMPL.keys.w, 1, SMPL.keys.d)));
    this.keys.instanceMatrix.needsUpdate = true;
  }

  private placePad(i: number): void {
    const p = smplPadAt(i);
    const T = SMPL.trigs;
    this.pads.setMatrixAt(i, m4.compose(v3.set(p.x, this.padY[i], p.z), q0, s3.set(T.w, T.h, T.d)));
    this.pads.instanceMatrix.needsUpdate = true;
  }

  /* ---------- picking ---------- */

  private buildHotspots(): HotspotDef[] {
    const top = this.top;
    const out: HotspotDef[] = [];
    for (const k of SMPL_KNOBS) {
      const p = smplKnobAt(k.id);
      // Les petits : une cible un peu plus large que le capuchon (8 px de plus a l'arrivee)
      const r = DJ_KNOB.skirt.r * p.s + (p.hero ? 0.04 : 0.07);
      out.push({ id: smplKnobId(k.id), kind: 'smplknob', layer: top, shape: 'disc', x: p.x, z: p.z, hx: r, hz: r, y0: 0, y1: (DJ_KNOB.skirt.h + DJ_KNOB.h) * p.sy, enabled: true, smpl: k.id });
    }
    SMPL_KEYS.forEach((k, i) => {
      const p = smplKeyAt(i);
      out.push({ id: smplKeyId(k.kind), kind: 'smplkey', layer: top, shape: 'box', x: p.x, z: p.z, hx: SMPL.keys.w / 2, hz: SMPL.keys.d / 2, y0: 0, y1: DJ_KEY.h, enabled: true, smpl: k.kind });
    });
    const T = SMPL.trigs;
    for (let i = 0; i < SMPL_PADS; i += 1) {
      const p = smplPadAt(i);
      out.push({ id: smplPadId(i), kind: 'smplpad', layer: top, shape: 'box', x: p.x, z: p.z, hx: T.w / 2 + 0.04, hz: T.d / 2 + 0.04, y0: 0, y1: DJ_KEY.h * T.h, enabled: true, smpl: String(i) });
    }
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
    const paleYellow = [DJ_GLOW.yellow[0] * 0.18, DJ_GLOW.yellow[1] * 0.18, DJ_GLOW.yellow[2] * 0.18];
    SMPL_KEYS.forEach((k, i) => {
      const held = this.held.has(smplKeyId(k.kind));
      // PLAY : or quand il joue, pale quand il y a un sample ; les modes pris en orange
      if (k.kind === 'play') {
        set(this.keyEm, i, s.preview || held ? DJ_GLOW.yellow : s.sample ? paleYellow : DJ_GLOW.dim);
        return;
      }
      const on = held || (k.kind === 'rev' && s.reverse) || (k.kind === 'loop' && s.loop) || (k.kind === 'rec' && s.recording) || (k.kind === 'mode' && s.mode === 'grain');
      set(this.keyEm, i, on ? DJ_GLOW.orange : DJ_GLOW.dim);
    });
    const n = padCount();
    const pale = [DJ_GLOW.orange[0] * 0.22, DJ_GLOW.orange[1] * 0.22, DJ_GLOW.orange[2] * 0.22];
    for (let i = 0; i < SMPL_PADS; i += 1) {
      const sounds = s.pads.includes(i) || this.held.has(smplPadId(i));
      set(this.padEm, i, sounds ? DJ_GLOW.yellow : i < n ? pale : DJ_GLOW.off);
    }
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
        if (moved && this.knobs[0].castShadow) this.opts.invalidate();
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
    for (const m of [...this.knobs, this.keys, this.pads]) {
      m.geometry.dispose();
      m.dispose();
    }
    for (const m of this.materials) m.dispose();
    this.screen.dispose();
    this.silk.dispose();
  }
}
