/**
 * Le MM-BASS en 3D (2026-10-07) : un bloc de la taille du MM-RYTM, fait des
 * pieces du MM-DECKS (dj/body.ts le coin, le dessus brosse, les vis, les
 * pieds, la connectique derriere ; dj/controls.ts les potards et les touches
 * en caoutchouc a LED ; dj/silk.ts la serigraphie), dispose d'apres
 * bass/theme.ts :
 * - l'ecran (bass/screen.ts) ;
 * - le grand CUTOFF en aluminium et les potards du son (aluminium, ACCENT
 *   en orange), le generateur en noir ;
 * - dix touches (RUN en or quand la basse joue, ACCENT et SLIDE allumes
 *   quand le pas choisi les a) ;
 * - seize pas : orange une note (plus vif accentuee), pale une liaison, or le
 *   pas qui joue, le pas choisi plus clair ;
 * - la serigraphie : l'en-tete, les noms, les familles (FILTER, VOICE en os,
 *   GENERATOR en orange), les filets entre les groupes de touches, le numero
 *   de chaque pas (1, 5, 9, 13 plus marques).
 * Tout dans le repere top (le dessus incline), x = 0 au centre du bloc.
 */

import { BufferGeometry, CylinderGeometry, DynamicDrawUsage, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3, type Texture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HotspotDef, Occluder } from '../scene/hit';
import { potAngle } from '../scene/encoders';
import { withRubberLed } from '../scene/materials';
import { makeBrushTexture, whenFonts } from '../scene/silk';
import { APPEARANCE, PORTRAIT } from '../theme';
import { pattern } from '../audio/pattern';
import { bezel, dc, partDj, power, rca, screw, usb, wedge } from '../dj/body';
import { DJ_GLOW, keyGeometry, knobGeometry } from '../dj/controls';
import { DjSilk, headTexts, type Bracket, type Line, type Text } from '../dj/silk';
import { DJ_BODY, DJ_KEY, DJ_KNOB, DJ_TILT, DJ_TOP_Y, DJ_UNIT } from '../dj/theme';
import { noteName } from './actions';
import { bassEngine } from './engine';
import { BASS_KNOBS, bassParams, type BassKnobId } from './params';
import { BassScreen } from './screen';
import { bassSeq, midiOf } from './seq';
import { BASS_STEPS, bassState } from './state';
import {
  BASS,
  BASS_D,
  BASS_FILTER,
  BASS_GEN,
  BASS_GROUPS,
  BASS_KEYS,
  BASS_KEY_GROUPS,
  BASS_KNOB_PLACES,
  BASS_VOICE,
  BASS_W,
  bassKeyAt,
  bassKnobAt,
  bassKnobTone,
  bassTrigAt,
  bassX,
  type BassKeyKind,
  type BassKnobTone,
} from './theme';

const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const v3 = new Vector3();
const q = new Quaternion();
const q0 = new Quaternion();
const s3 = new Vector3();

export interface BassRigOpts {
  mobile: boolean;
  anisotropy: number;
  repaint: () => void;
  invalidate: () => void;
}

/* ---------------- les ids des commandes ---------------- */

export const bassKnobId = (k: BassKnobId): string => `bass-knob-${k}`;
export const bassKeyId = (k: BassKeyKind): string => `bass-key-${k}`;
export const bassTrigId = (i: number): string => `bass-trig-${i + 1}`;

/* ---------------- le corps ---------------- */

/** Les coordonnees de la brosse (roughnessMap) : x et z, comme le dessus du MM-DECKS. */
function brushUv(g: BufferGeometry): void {
  const pos = g.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    uv[i * 2] = pos.getX(i);
    uv[i * 2 + 1] = pos.getZ(i);
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
}

/** Le bloc : le coin, le cadre de l'ecran, les vis, les pieds, la connectique derriere. */
function buildBody(mobile: boolean): BufferGeometry {
  const seg = mobile ? 12 : 16;
  const hw = BASS_W / 2;
  const hd = BASS_D / 2;
  const parts: BufferGeometry[] = [wedge(-hw, hw, BASS_D), bezel(BASS.screen.x, BASS.screen.z, BASS.screen.w, BASS.screen.d)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(...screw(sx * (hw - 0.26), sz * (hd - 0.26), seg));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const f = new CylinderGeometry(0.3, 0.3, DJ_BODY.feet, seg);
      f.translate(sx * (hw - 0.6), DJ_BODY.feet / 2, sz * (hd - 0.6));
      parts.push(partDj(f, 'rubber'));
    }
  }
  // Derriere : sorties, USB-C, alimentation (vu de derriere, la gauche est a +x), ramenees sur notre face arriere
  const y = 0.78;
  const C = PORTRAIT ? { rca: [3.0, 2.65], usb: 1.7, dc: -2.7, power: -3.3 } : { rca: [4.4, 4.05], usb: 3.0, dc: -4.2, power: -4.8 };
  const back = [...rca(C.rca[0], y, seg), ...rca(C.rca[1], y, seg), ...usb(C.usb, y), ...dc(C.dc, y, seg), ...power(C.power, y)];
  for (const b of back) b.translate(0, 0, (DJ_UNIT.d - BASS_D) / 2);
  parts.push(...back);
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!g) throw new Error('bass: body merge failed');
  brushUv(g);
  return g;
}

/* ---------------- la serigraphie ---------------- */

const knobLabelZ = (z: number, s: number): number => z - DJ_KNOB.skirt.r * s - 0.22 * Math.max(0.9, Math.min(s, 1.3));
/** Au telephone, les inscriptions un tiers plus grandes (le bloc se voit plus petit). */
const INK_K = PORTRAIT ? 1.3 : 1;

function silkItems(): { texts: Text[]; lines: Line[]; brackets: Bracket[] } {
  const texts: Text[] = headTexts('MM-BASS', 'BASSLINE GENERATOR / ACID / SUB', BASS_W, BASS.head.z, PORTRAIT ? 1.95 : 1.95);
  const lines: Line[] = [];
  const brackets: Bracket[] = [];
  const tick = (x: number, z: number, deg: number, r0: number, r1: number): void => {
    const a = (deg * Math.PI) / 180;
    lines.push([x + Math.cos(a) * r0, z - Math.sin(a) * r0, x + Math.cos(a) * r1, z - Math.sin(a) * r1]);
  };
  // Les potards : le nom au-dessus (orange pour le generateur) ; CUTOFF gradue de 0 a 10, les autres leurs butees ou leurs crans
  for (const p of BASS_KNOB_PLACES) {
    const def = BASS_KNOBS.find((k) => k.id === p.id);
    const r = DJ_KNOB.skirt.r * p.s;
    const hero = p.id === 'cutoff';
    const gen = BASS_GEN.includes(p.id);
    texts.push({ text: def?.label ?? p.id, x: p.x, z: knobLabelZ(p.z, p.s), cap: (hero ? 0.085 : 0.058) * INK_K, weight: 700, maxW: PORTRAIT ? 1.7 : 1.1, group: hero ? 'hero' : 'knob', ...(gen ? { ink: 'orange' as const, alpha: 1 } : {}) });
    if (hero) {
      for (let t = 0; t <= 10; t += 1) tick(p.x, p.z, 225 - t * 27, r + 0.05, r + (t % 5 === 0 ? 0.16 : 0.1));
    } else if (def?.steps) {
      for (let t = 0; t < def.steps; t += 1) tick(p.x, p.z, 225 - (t * 270) / (def.steps - 1), r + 0.03, r + 0.09);
    } else {
      for (const deg of [225, -45]) tick(p.x, p.z, deg, r + 0.03, r + 0.08);
    }
  }
  // Les familles : un crochet sous chaque rangee (desktop) ; au telephone, sous la derniere rangee de chaque famille
  const range = (ids: readonly BassKnobId[]): { x0: number; x1: number; z: number } => {
    const ps = ids.map(bassKnobAt);
    const r = (s: number): number => DJ_KNOB.skirt.r * s;
    return { x0: Math.min(...ps.map((p) => p.x - r(p.s))) - 0.06, x1: Math.max(...ps.map((p) => p.x + r(p.s))) + 0.06, z: Math.max(...ps.map((p) => p.z + r(p.s))) + 0.2 };
  };
  if (PORTRAIT) {
    const snd = range([...BASS_FILTER, ...BASS_VOICE]);
    brackets.push({ text: `${BASS_GROUPS.filter} / ${BASS_GROUPS.voice}`, ...snd });
    brackets.push({ text: BASS_GROUPS.gen, ...range(BASS_GEN), ink: 'orange' });
  } else {
    const f = range(BASS_FILTER.filter((id) => id !== 'cutoff'));
    // FILTER au-dessus de sa rangee (vers le haut), VOICE sous la sienne
    brackets.push({ text: BASS_GROUPS.filter, x0: f.x0, x1: f.x1, z: knobLabelZ(bassKnobAt('reso').z, 0.95) - 0.22, down: true });
    brackets.push({ text: BASS_GROUPS.voice, ...range(BASS_VOICE) });
    brackets.push({ text: BASS_GROUPS.gen, ...range(BASS_GEN), ink: 'orange' });
  }
  // Les touches : leur nom au-dessus (RUN en orange) ; un filet entre les groupes (desktop)
  const K = BASS.keys;
  BASS_KEYS.forEach((k, i) => {
    const p = bassKeyAt(i);
    texts.push({ text: k.label, x: p.x, z: p.z - K.d / 2 - 0.15, cap: 0.058 * INK_K, weight: 700, group: 'keys', maxW: K.w + 0.2, ...(k.kind === 'run' || k.kind === 'gen' ? { ink: 'orange' as const, alpha: 1 } : {}) });
  });
  if (!PORTRAIT) {
    for (const g of BASS_KEY_GROUPS) {
      const sep = (bassKeyAt(g - 1).x + bassKeyAt(g).x) / 2;
      const z = bassKeyAt(g).z;
      lines.push([sep, z - 0.3, sep, z + 0.2]);
    }
  }
  // Les pas : leur numero dessous (1, 5, 9, 13 plus marques), le crochet STEPS
  const T = BASS.trigs;
  for (let i = 0; i < BASS_STEPS; i += 1) {
    const p = bassTrigAt(i);
    texts.push({ text: String(i + 1), x: p.x, z: p.z + T.d / 2 + 0.13, cap: 0.058 * INK_K, weight: 700, alpha: i % 4 === 0 ? 1 : 0.5, group: 'trigs' });
  }
  const t0 = bassTrigAt(0).x - T.w / 2;
  const t1 = bassTrigAt(PORTRAIT ? 7 : 15).x + T.w / 2;
  if (PORTRAIT) brackets.push({ text: 'STEPS  /  TAP: NOTE, TIE, OFF', x0: t0, x1: t1, z: bassTrigAt(0).z - T.d / 2 - 0.2, down: true });
  else brackets.push({ text: 'STEPS  /  TAP: NOTE, TIE, OFF', x0: t0, x1: t1, z: bassTrigAt(0).z + T.d / 2 + 0.42 });
  return { texts, lines, brackets };
}

/* ---------------- le rig ---------------- */

export class BassRig {
  readonly root = new Group();
  readonly socle = new Group();
  readonly top = new Group();
  readonly screen: BassScreen;
  private body: Mesh;
  private bodyMat: MeshStandardMaterial;
  private brush: Texture;
  private knobs: InstancedMesh[];
  private knobSlot: { m: number; j: number }[];
  private keys: InstancedMesh;
  private trigs: InstancedMesh;
  private silk: DjSilk;
  private materials: MeshStandardMaterial[] = [];
  private keyEm: InstancedBufferAttribute;
  private trigEm: InstancedBufferAttribute;
  private knobAngle = new Float32Array(BASS_KNOBS.length);
  private keyY = new Float32Array(BASS_KEYS.length);
  private trigY = new Float32Array(BASS_STEPS);
  private defs: HotspotDef[];
  private unsubs: (() => void)[] = [];
  private held = new Set<string>();
  private stepAt = -1;
  private liveAt = 0;
  private glow = APPEARANCE.current === 'light' ? 1.6 : 1;

  constructor(private opts: BassRigOpts) {
    this.root.name = 'bassRoot';
    this.root.position.x = bassX();
    this.socle.name = 'bassSocle';
    this.top.name = 'bassTop';
    this.top.position.set(0, DJ_TOP_Y, 0);
    this.top.rotation.x = DJ_TILT;
    this.root.add(this.socle, this.top);

    const light = APPEARANCE.current === 'light';
    this.brush = makeBrushTexture();
    this.bodyMat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughnessMap: this.brush, roughness: light ? 0.55 : 0.68, metalness: light ? 0 : 0.22 });
    this.bodyMat.name = 'bassBody';
    this.body = new Mesh(buildBody(opts.mobile), this.bodyMat);
    this.body.name = 'bassBody';
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.socle.add(this.body);

    const std = (name: string, p: { roughness: number; metalness: number }, led = false): MeshStandardMaterial => {
      const m = new MeshStandardMaterial({ vertexColors: true, ...p });
      m.name = name;
      this.materials.push(m);
      return led ? withRubberLed(m) : m;
    };
    const tones: readonly BassKnobTone[] = ['knob', 'ring', 'hot'];
    const knobMat = std('bassKnob', { roughness: 0.42, metalness: 0.28 });
    const count = [0, 0, 0];
    this.knobSlot = BASS_KNOBS.map((k) => {
      const m = tones.indexOf(bassKnobTone(k.id));
      return { m, j: count[m]++ };
    });
    this.knobs = tones.map((t, i) => {
      const mesh = new InstancedMesh(knobGeometry(opts.mobile, t, t === 'ring' ? 'slit' : 'mark'), knobMat, Math.max(1, count[i]));
      mesh.name = `bassKnobs-${t}`;
      mesh.count = count[i];
      return mesh;
    });
    const kg = keyGeometry(opts.mobile);
    this.keyEm = new InstancedBufferAttribute(new Float32Array(BASS_KEYS.length * 3), 3);
    this.keyEm.setUsage(DynamicDrawUsage);
    kg.setAttribute('instanceEmissive', this.keyEm);
    this.keys = new InstancedMesh(kg, std('bassKey', { roughness: 0.9, metalness: 0 }, true), BASS_KEYS.length);
    this.keys.name = 'bassKeys';
    const tg = keyGeometry(opts.mobile);
    this.trigEm = new InstancedBufferAttribute(new Float32Array(BASS_STEPS * 3), 3);
    this.trigEm.setUsage(DynamicDrawUsage);
    tg.setAttribute('instanceEmissive', this.trigEm);
    this.trigs = new InstancedMesh(tg, std('bassTrig', { roughness: 0.85, metalness: 0 }, true), BASS_STEPS);
    this.trigs.name = 'bassTrigs';
    for (const m of [...this.knobs, this.keys, this.trigs]) {
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      m.castShadow = !opts.mobile;
      m.receiveShadow = true;
    }
    this.top.add(...this.knobs, this.keys, this.trigs);

    this.screen = new BassScreen(opts.anisotropy, opts.mobile);
    this.top.add(this.screen.mesh);
    this.silk = new DjSilk({ name: 'bassSilk', w: BASS_W, x: 0, items: silkItems, logo: BASS.logo, d: Math.max(BASS_D, DJ_UNIT.d) }, opts.anisotropy, opts.mobile);
    this.top.add(this.silk.mesh);

    BASS_KNOBS.forEach((k, i) => {
      this.knobAngle[i] = potAngle(bassParams.of(k.id));
      this.placeKnob(i);
    });
    BASS_KEYS.forEach((_, i) => this.placeKey(i));
    for (let i = 0; i < BASS_STEPS; i += 1) this.placeTrig(i);
    this.defs = this.buildHotspots();
    this.syncLights();
    this.drawScreen();
  }

  /* ---------- placement ---------- */

  private placeKnob(i: number): void {
    const p = bassKnobAt(BASS_KNOBS[i].id);
    const { m, j } = this.knobSlot[i];
    const mesh = this.knobs[m];
    const sy = p.id === 'cutoff' ? p.s * 0.82 : p.s;
    mesh.setMatrixAt(j, m4.compose(v3.set(p.x, 0, p.z), q.setFromAxisAngle(AXIS_Y, this.knobAngle[i]), s3.set(p.s, sy, p.s)));
    mesh.instanceMatrix.needsUpdate = true;
  }

  private placeKey(i: number): void {
    const p = bassKeyAt(i);
    this.keys.setMatrixAt(i, m4.compose(v3.set(p.x, this.keyY[i], p.z), q0, s3.set(BASS.keys.w, 1, BASS.keys.d)));
    this.keys.instanceMatrix.needsUpdate = true;
  }

  private placeTrig(i: number): void {
    const p = bassTrigAt(i);
    const T = BASS.trigs;
    this.trigs.setMatrixAt(i, m4.compose(v3.set(p.x, this.trigY[i], p.z), q0, s3.set(T.w, T.h, T.d)));
    this.trigs.instanceMatrix.needsUpdate = true;
  }

  /* ---------- picking ---------- */

  private buildHotspots(): HotspotDef[] {
    const top = this.top;
    const out: HotspotDef[] = [];
    for (const k of BASS_KNOBS) {
      const p = bassKnobAt(k.id);
      const r = DJ_KNOB.skirt.r * p.s + (p.id === 'cutoff' ? 0.04 : 0.07);
      out.push({ id: bassKnobId(k.id), kind: 'bassknob', layer: top, shape: 'disc', x: p.x, z: p.z, hx: r, hz: r, y0: 0, y1: (DJ_KNOB.skirt.h + DJ_KNOB.h) * p.s, enabled: true, bass: k.id });
    }
    BASS_KEYS.forEach((k, i) => {
      const p = bassKeyAt(i);
      out.push({ id: bassKeyId(k.kind), kind: 'basskey', layer: top, shape: 'box', x: p.x, z: p.z, hx: BASS.keys.w / 2, hz: BASS.keys.d / 2, y0: 0, y1: DJ_KEY.h, enabled: true, bass: k.kind });
    });
    const T = BASS.trigs;
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const p = bassTrigAt(i);
      out.push({ id: bassTrigId(i), kind: 'basstrig', layer: top, shape: 'box', x: p.x, z: p.z, hx: T.w / 2 + 0.04, hz: T.d / 2 + 0.04, y0: 0, y1: DJ_KEY.h * T.h, enabled: true, bass: String(i) });
    }
    return out.map((d) => ({ ...d, machine: 'bass' as const }));
  }

  get hotspots(): readonly HotspotDef[] {
    return this.defs;
  }

  occluders(): Occluder[] {
    const depth = DJ_BODY.front + DJ_BODY.feet;
    return [{ layer: this.top, min: [-BASS_W / 2, -depth, -BASS_D / 2], max: [BASS_W / 2, 0, BASS_D / 2], tag: 'bass' }];
  }

  /* ---------- etats ---------- */

  private syncLights(): boolean {
    const s = bassState.get();
    let changed = false;
    const g = this.glow;
    const set = (attr: InstancedBufferAttribute, i: number, c: readonly number[]): void => {
      const a = attr.array as Float32Array;
      const r = Math.fround(c[0] * g);
      const gr = Math.fround(c[1] * g);
      const b = Math.fround(c[2] * g);
      if (a[i * 3] === r && a[i * 3 + 1] === gr && a[i * 3 + 2] === b) return;
      a[i * 3] = r;
      a[i * 3 + 1] = gr;
      a[i * 3 + 2] = b;
      attr.needsUpdate = true;
      changed = true;
    };
    const scale = (rgb: readonly number[], k: number): number[] => [rgb[0] * k, rgb[1] * k, rgb[2] * k];
    const sel = s.steps[s.sel];
    BASS_KEYS.forEach((k, i) => {
      const held = this.held.has(bassKeyId(k.kind));
      if (k.kind === 'run') {
        set(this.keyEm, i, s.running || held ? DJ_GLOW.yellow : scale(DJ_GLOW.yellow, 0.18));
        return;
      }
      const on = held || (k.kind === 'accent' && sel.kind === 'note' && sel.acc) || (k.kind === 'slide' && sel.kind !== 'off' && sel.slide);
      set(this.keyEm, i, on ? DJ_GLOW.orange : DJ_GLOW.dim);
    });
    const at = this.stepAt;
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const st = s.steps[i];
      const held = this.held.has(bassTrigId(i));
      const base = st.kind === 'note' ? (st.acc ? DJ_GLOW.orange : scale(DJ_GLOW.orange, 0.5)) : st.kind === 'tie' ? scale(DJ_GLOW.orange, 0.2) : DJ_GLOW.dim;
      const lit = held || (i === at && st.kind !== 'off') ? DJ_GLOW.yellow : i === at ? scale(DJ_GLOW.yellow, 0.25) : i === s.sel ? scale(base[0] > 0.05 ? base : DJ_GLOW.orange, base[0] > 0.05 ? 1.45 : 0.12) : base;
      set(this.trigEm, i, lit);
    }
    return changed;
  }

  private syncKnobs(): boolean {
    let moved = false;
    BASS_KNOBS.forEach((k, i) => {
      const a = Math.fround(potAngle(bassParams.of(k.id)));
      if (this.knobAngle[i] === a) return;
      this.knobAngle[i] = a;
      this.placeKnob(i);
      moved = true;
    });
    return moved;
  }

  private drawScreen(): boolean {
    const s = bassState.get();
    const midis: (number | null)[] = [];
    let last: number | null = null;
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const st = s.steps[i];
      if (st.kind === 'note') last = midiOf(st);
      midis.push(st.kind === 'off' ? null : st.kind === 'note' ? last : last);
      if (st.kind === 'off') last = null;
    }
    const sel = s.steps[s.sel];
    const info = `STEP ${String(s.sel + 1).padStart(2, '0')}  ${sel.kind === 'off' ? 'OFF' : sel.kind === 'tie' ? 'TIE' : `${noteName(midiOf(sel))}${sel.acc ? '  ACC' : ''}${sel.slide ? '  SLIDE' : ''}`}`;
    const live = bassEngine.live();
    const sounding = live.gate || performance.now() - live.at < 120;
    return this.screen.draw(s, bassParams.get(), midis, pattern.get().bpm, { cut: sounding ? live.cut : 0, step: this.stepAt }, s.message, info);
  }

  pressKey(id: string, down: boolean): void {
    if (down) this.held.add(id);
    else this.held.delete(id);
    const k = BASS_KEYS.findIndex((x) => bassKeyId(x.kind) === id);
    let moved = false;
    if (k >= 0) {
      this.keyY[k] = down ? -DJ_KEY.press : 0;
      this.placeKey(k);
      moved = true;
    }
    if (id.startsWith('bass-trig-')) {
      const i = Number(id.slice(10)) - 1;
      if (i >= 0 && i < BASS_STEPS) {
        this.trigY[i] = down ? -DJ_KEY.press : 0;
        this.placeTrig(i);
        moved = true;
      }
    }
    const lit = this.syncLights();
    if (moved && this.keys.castShadow) this.opts.invalidate();
    else if (moved || lit) this.opts.repaint();
  }

  /** L'animateur : la tete de lecture et la coupure qui sonne ; 'paint' tant que la basse joue. */
  step = (): 'paint' | false => {
    if (!this.root.visible) return false;
    let changed = false;
    const at = bassSeq.running ? bassSeq.stepAt(bassSeq.now()) : -1;
    if (at !== this.stepAt) {
      this.stepAt = at;
      if (this.syncLights()) changed = true;
    }
    const live = bassEngine.live();
    if (live.at !== this.liveAt || changed) {
      this.liveAt = live.at;
      if (this.drawScreen()) changed = true;
    }
    return bassSeq.running || changed ? 'paint' : false;
  };

  listen(): void {
    this.unsubs.push(
      bassState.subscribe(() => {
        const lit = this.syncLights();
        const drawn = this.drawScreen();
        if (lit || drawn || bassState.get().running) this.opts.repaint();
      }),
      bassParams.subscribe(() => {
        const moved = this.syncKnobs();
        const drawn = this.drawScreen();
        if (moved && this.knobs[0].castShadow) this.opts.invalidate();
        else if (moved || drawn) this.opts.repaint();
      }),
      pattern.subscribe(() => {
        if (this.drawScreen()) this.opts.repaint();
      }),
      bassEngine.subscribeLive(() => this.opts.repaint())
    );
    void whenFonts().then(() => this.redrawText());
  }

  redrawText(): void {
    this.silk.draw();
    this.screen.invalidate();
    this.drawScreen();
    this.opts.repaint();
  }

  setHover(_id: string | null): boolean {
    return false;
  }

  info(): { knobs: number; keys: number; trigs: number; screenDraws: number; silkDraws: number } {
    return { knobs: BASS_KNOBS.length, keys: BASS_KEYS.length, trigs: BASS_STEPS, screenDraws: this.screen.draws, silkDraws: this.silk.draws };
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    this.body.geometry.dispose();
    this.bodyMat.dispose();
    this.brush.dispose();
    for (const m of [...this.knobs, this.keys, this.trigs]) {
      m.geometry.dispose();
      m.dispose();
    }
    for (const m of this.materials) m.dispose();
    this.screen.dispose();
    this.silk.dispose();
  }
}
