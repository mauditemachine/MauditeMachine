/**
 * Le MM-SMPL en 3D (2026-10-04 ; facon Elektron Tonverk depuis le
 * 2026-10-05) : un bloc large et peu profond de la famille du MM-DECKS (le
 * coin, le dessus brosse, les vis, les pieds, la connectique derriere),
 * fait de ses pieces (dj/body.ts, dj/controls.ts, dj/silk.ts). Refait le
 * 2026-10-05 (Mika : "fais un gros effort, c'est bof le design, les trois
 * boutons trop gros et les autres trop petits") :
 * - l'ecran au milieu du haut (smpl/screen.ts) et ses tetes de lecture ;
 * - a sa gauche LEVEL et PITCH, en aluminium, gradues (ceux qu'on tient en
 *   jouant) ; a sa droite dix encodeurs de meme taille, deux rangees :
 *   SAMPLE en haut, GRAIN dessous (leur nom en orange) ;
 * - douze touches de fonction en caoutchouc a LED dedans
 *   (scene/materials.ts withRubberLed) : REC, PLAY, STOP | FILE, SLICES,
 *   MODE, REV, LOOP | RANDOM, CLEAR, EDIT, SAVE (PLAY en or quand il joue ;
 *   les modes pris en orange) ;
 * - seize trigs en deux rangees de huit, du meme caoutchouc : orange pale
 *   quand ils ont une slice, or quand ils sonnent ; en EDIT, les pas de la
 *   sequence (orange : un pas plein, or : la tete de lecture) ;
 * - la serigraphie : l'en-tete, les noms, les filets entre les groupes, le
 *   numero de chaque trig (1, 5, 9, 13 plus marques).
 * Tout dans le repere top (le dessus incline), x = 0 au centre du bloc.
 *
 * OPEN (2026-10-05, Mika : "le bouton INFO doit etre a l'interieur OPEN de
 * la machine SMPL") : le dessus est un capot (top : la dalle, l'ecran et
 * son cadre, les vis, toutes les commandes) pose sur le coin descendu de
 * son epaisseur. OPEN le souleve comme celui du MM-ARP (scene/explode.ts,
 * smplExplode) ; dans le bac (inner, le repere du fond), la carte du
 * MM-RYTM sort et sa plaque (scene/tweakplate.ts, sans reglage) porte INFO
 * et CLOSE (ui/SmplInfo.tsx, ui/HoodClose.tsx : des touches du DOM).
 */

import { BufferGeometry, CylinderGeometry, DynamicDrawUsage, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3, type Texture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { reserve } from '../audio/sched';
import type { HotspotDef, Occluder } from '../scene/hit';
import { potAngle } from '../scene/encoders';
import { Explode, type ExplodeCfg, type ExplodeInfo } from '../scene/explode';
import { withRubberLed } from '../scene/materials';
import { Pcb } from '../scene/pcb';
import { makeBrushTexture, whenFonts } from '../scene/silk';
import { TweakPlate } from '../scene/tweakplate';
import { smplExplode } from '../state/explode';
import { APPEARANCE, PCB_TURN, PORTRAIT } from '../theme';
import { TOP_M, bezel, dc, lidSlab, partDj, power, rca, screw, usb, wedge } from '../dj/body';
import { DJ_GLOW, keyGeometry, knobGeometry } from '../dj/controls';
import { DjSilk, headTexts, type Bracket, type Line, type Text } from '../dj/silk';
import { DJ_BODY, DJ_KEY, DJ_KNOB, DJ_TILT, DJ_TOP_Y, DJ_UNIT } from '../dj/theme';
import { smplEngine } from './engine';
import { SMPL_KNOBS, smplParams, type SmplKnobId } from './params';
import { SmplScreen } from './screen';
import { SMPL_PADS } from './slices';
import { smplSeq } from './seq';
import { padCount, smplState } from './state';
import {
  SMPL,
  SMPL_D,
  SMPL_EXPLODE,
  SMPL_GRID,
  SMPL_KEY_GROUPS,
  SMPL_KEYS,
  SMPL_LID,
  SMPL_PCB_Y,
  SMPL_PERF_PLACED,
  SMPL_PLATE,
  SMPL_PLATE_TITLE,
  SMPL_ROW_NAMES,
  SMPL_W,
  smplKeyAt,
  smplKnobAt,
  smplKnobTone,
  smplPadAt,
  smplX,
  type SmplKeyKind,
  type SmplKnobTone,
} from './theme';

const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const v3 = new Vector3();
const q = new Quaternion();
const q0 = new Quaternion();
const s3 = new Vector3();

export interface SmplRigOpts {
  mobile: boolean;
  anisotropy: number;
  /** mouvement reduit : OPEN pose son etat final sans animation */
  reduced: () => boolean;
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

/** Le bac : le coin descendu de l'epaisseur du capot (son fond sombre), les pieds, la connectique derriere. */
function buildBody(mobile: boolean): BufferGeometry {
  const seg = mobile ? 12 : 16;
  const hw = SMPL_W / 2;
  const hd = SMPL_D / 2;
  const parts: BufferGeometry[] = [wedge(-hw, hw, SMPL_D, SMPL_LID.t, 'body')];
  // Quatre pieds
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const f = new CylinderGeometry(0.3, 0.3, DJ_BODY.feet, seg);
      f.translate(sx * (hw - 0.6), DJ_BODY.feet / 2, sz * (hd - 0.6));
      parts.push(partDj(f, 'rubber'));
    }
  }
  // Derriere : sorties RCA, USB-C, alimentation et interrupteur (vu de derriere, la gauche est a +x),
  // poses par dj/body.ts sur la face arriere d'un bloc du MM-DECKS : ramenes sur la notre, moins profonde
  const y = 0.78;
  // Au telephone, le bloc est plus etroit (8.6) : la connectique se resserre
  const C = PORTRAIT ? { rca: [3.2, 2.85], usb: 1.9, dc: -2.9, power: -3.5 } : { rca: [4.2, 3.85], usb: 2.8, dc: -4.0, power: -4.6 };
  const back = [...rca(C.rca[0], y, seg), ...rca(C.rca[1], y, seg), ...usb(C.usb, y), ...dc(C.dc, y, seg), ...power(C.power, y)];
  for (const b of back) b.translate(0, 0, (DJ_UNIT.d - SMPL_D) / 2);
  parts.push(...back);
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!g) throw new Error('smpl: body merge failed');
  brushUv(g);
  return g;
}

/**
 * Le capot (repere top) : la dalle du dessus, le cadre de l'ecran et les
 * quatre vis des coins, poses par dj/body.ts dans le repere du bloc et
 * ramenes dans celui du capot.
 */
function buildLid(mobile: boolean): BufferGeometry {
  const seg = mobile ? 12 : 16;
  const hw = SMPL_W / 2;
  const hd = SMPL_D / 2;
  const onTop: BufferGeometry[] = [bezel(SMPL.screen.x, SMPL.screen.z, SMPL.screen.w, SMPL.screen.d)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) onTop.push(...screw(sx * (hw - 0.26), sz * (hd - 0.26), seg));
  const inv = TOP_M.clone().invert();
  for (const p of onTop) p.applyMatrix4(inv);
  const parts = [lidSlab(SMPL_W, SMPL_D / Math.cos(DJ_TILT), SMPL_LID.t), ...onTop];
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!g) throw new Error('smpl: lid merge failed');
  brushUv(g);
  return g;
}

/** La zone de la carte degagee sous la plaque (repere de la carte, tournee en portrait). */
function plateClear(): { x0: number; x1: number; z0: number; z1: number } {
  const P = SMPL_PLATE;
  const hx = (PORTRAIT ? P.d : P.w) / 2 + 0.3;
  const hz = (PORTRAIT ? P.w : P.d) / 2 + 0.3;
  return { x0: P.cx - hx, x1: P.cx + hx, z0: P.cz - hz, z1: P.cz + hz };
}

/* ---------------- la serigraphie ---------------- */

/**
 * Le nom d'un potard, au-dessus de lui : assez loin pour que son capuchon ne
 * le cache pas, vu de face (plus haut est le potard, plus loin).
 */
const knobLabelZ = (z: number, s: number, sy: number): number => z - DJ_KNOB.skirt.r * s - 0.23 * sy;

/** Au telephone, les inscriptions un tiers plus grandes (le bloc se voit plus petit). */
const INK_K = PORTRAIT ? 1.32 : 1;

function silkItems(): { texts: Text[]; lines: Line[]; brackets: Bracket[] } {
  const texts: Text[] = headTexts('MM-SMPL', 'SAMPLER / SLICER / GRANULAR', SMPL_W, SMPL.head.z, 1.95);
  const lines: Line[] = [];
  const brackets: Bracket[] = [];
  // Les touches de fonction : leur nom au-dessus ; un filet entre les groupes (transport, son, sequence)
  const K = SMPL.keys;
  SMPL_KEYS.forEach((k, i) => {
    const p = smplKeyAt(i);
    texts.push({ text: k.label, x: p.x, z: p.z - K.d / 2 - 0.15, cap: 0.058 * INK_K, weight: 700, group: 'keys', maxW: K.w + 0.12, ...(k.kind === 'play' ? { ink: 'orange' as const, alpha: 1 } : {}) });
  });
  // Les filets entre les groupes (une seule rangee : desktop)
  if (!PORTRAIT) {
    for (const g of SMPL_KEY_GROUPS) {
      const sep = (smplKeyAt(g - 1).x + smplKeyAt(g).x) / 2;
      lines.push([sep, K.z - 0.32, sep, K.z + 0.2]);
    }
  }
  // Les potards : le nom au-dessus ; LEVEL et PITCH gradues de 0 a 10 (0, 5 et 10 plus longs), les autres leurs butees
  const tick = (x: number, z: number, deg: number, r0: number, r1: number): void => {
    const a = (deg * Math.PI) / 180;
    lines.push([x + Math.cos(a) * r0, z - Math.sin(a) * r0, x + Math.cos(a) * r1, z - Math.sin(a) * r1]);
  };
  for (const id of [...SMPL_PERF_PLACED, ...SMPL_GRID.flat()]) {
    const p = smplKnobAt(id);
    const def = SMPL_KNOBS.find((k) => k.id === id);
    const r = DJ_KNOB.skirt.r * p.s;
    texts.push({ text: def?.label ?? id, x: p.x, z: knobLabelZ(p.z, p.s, p.sy), cap: (p.hero ? 0.066 : 0.056) * INK_K, weight: 700, maxW: PORTRAIT ? 1.6 : 0.86, group: p.hero ? 'hero' : 'knob' });
    if (p.hero) {
      for (let t = 0; t <= 10; t += 1) tick(p.x, p.z, 225 - t * 27, r + 0.04, r + (t % 5 === 0 ? 0.12 : 0.075));
    } else {
      for (const deg of def?.bipolar ? [225, 90, -45] : [225, -45]) tick(p.x, p.z, deg, r + 0.03, r + 0.08);
    }
  }
  // Les pages de la grille, en orange : SAMPLE au-dessus de sa rangee, GRAIN sous la sienne (desktop ; au
  // telephone la grille est en trois rangees serrees sous l'ecran)
  const G = SMPL.knobs.grid;
  const gr = DJ_KNOB.skirt.r * G.s;
  const gx0 = G.xs[0] - gr - 0.06;
  const gx1 = G.xs[G.xs.length - 1] + gr + 0.06;
  if (!PORTRAIT) {
    brackets.push({ text: SMPL_ROW_NAMES[0], x0: gx0, x1: gx1, z: knobLabelZ(G.zs[0], G.s, G.s) - 0.24, down: true, ink: 'orange' });
    brackets.push({ text: SMPL_ROW_NAMES[1], x0: gx0, x1: gx1, z: G.zs[1] + gr + 0.2, ink: 'orange' });
  }
  // Les trigs : leur numero dessous (1, 5, 9, 13 plus marques), le crochet sous le bloc
  const T = SMPL.trigs;
  for (let i = 0; i < SMPL_PADS; i += 1) {
    const p = smplPadAt(i);
    texts.push({ text: String(i + 1), x: p.x, z: p.z + T.d / 2 + 0.13, cap: 0.058 * INK_K, weight: 700, alpha: i % 4 === 0 ? 1 : 0.5, group: 'trigs' });
  }
  const t0 = smplPadAt(0).x - T.w / 2;
  const t1 = smplPadAt(7).x + T.w / 2;
  brackets.push({ text: 'SLICES  /  EDIT: STEPS', x0: t0, x1: t1, z: T.zs[1] + T.d / 2 + 0.42 });
  return { texts, lines, brackets };
}

/* ---------------- le rig ---------------- */

export class SmplRig {
  readonly root = new Group();
  readonly socle = new Group();
  /** le capot : la dalle et tout ce qui est dessus ; OPEN le souleve */
  readonly top = new Group();
  /** le fond du bac (le repere top ferme, il ne bouge pas) : la carte y sort */
  readonly inner = new Group();
  readonly pcbGroup = new Group();
  readonly pcb: Pcb;
  /** la plaque de l'interieur : INFO et CLOSE s'y posent (son repere top) */
  readonly plate: TweakPlate;
  readonly explode: Explode;
  readonly screen: SmplScreen;
  private body: Mesh;
  private lid: Mesh;
  private explodeGoal = false;
  private detach: () => void = () => undefined;
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
    this.inner.name = 'smplInner';
    this.inner.position.set(0, DJ_TOP_Y, 0);
    this.inner.rotation.x = DJ_TILT;
    this.pcbGroup.name = 'smplPcbGroup';
    this.pcbGroup.position.y = SMPL_PCB_Y;
    this.pcbGroup.rotation.y = PCB_TURN;
    this.pcbGroup.visible = false;
    this.inner.add(this.pcbGroup);
    this.root.add(this.socle, this.inner, this.top);

    const light = APPEARANCE.current === 'light';
    this.brush = makeBrushTexture();
    this.bodyMat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughnessMap: this.brush, roughness: light ? 0.55 : 0.68, metalness: light ? 0 : 0.22 });
    this.bodyMat.name = 'smplBody';
    this.body = new Mesh(buildBody(opts.mobile), this.bodyMat);
    this.body.name = 'smplBody';
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.socle.add(this.body);
    this.lid = new Mesh(buildLid(opts.mobile), this.bodyMat);
    this.lid.name = 'smplLid';
    this.lid.castShadow = true;
    this.lid.receiveShadow = true;
    this.top.add(this.lid);

    // L'interieur : la carte (celle du MM-RYTM, degagee sous la plaque) et sa plaque, sans reglage
    this.pcb = new Pcb(opts.mobile, opts.anisotropy, { model: 'MM-SMPL R1.0', variant: 'voy', chips: false, clear: plateClear() });
    this.pcbGroup.add(this.pcb.board, this.pcb.parts);
    const T = SMPL_PLATE_TITLE;
    this.plate = new TweakPlate(
      {
        name: 'smplPlate',
        dims: SMPL_PLATE,
        items: [],
        title: { x: T.x, z: T.z, w: T.w, head: 'MM-SMPL', sub: 'SAMPLER / SLICER / GRANULAR', model: 'R1.0  VRSTL 2026' },
        cellW: SMPL_PLATE.w - 0.4,
      },
      { mobile: opts.mobile, anisotropy: opts.anisotropy }
    );
    this.pcb.parts.add(this.plate.group);
    const cfg: ExplodeCfg = { ...SMPL_EXPLODE, plateauY: DJ_TOP_Y, pcbY: SMPL_PCB_Y, tilt: DJ_TILT };
    this.explode = new Explode({ plateau: this.top, pcb: this.pcbGroup, parts: this.pcb.parts }, (open) => smplExplode.settle(open), cfg);

    const std = (name: string, p: { roughness: number; metalness: number }, led = false): MeshStandardMaterial => {
      const m = new MeshStandardMaterial({ vertexColors: true, ...p });
      m.name = name;
      this.materials.push(m);
      return led ? withRubberLed(m) : m;
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
    this.silk = new DjSilk({ name: 'smplSilk', w: SMPL_W, x: 0, items: silkItems, logo: SMPL.logo, d: Math.max(SMPL_D, DJ_UNIT.d) }, opts.anisotropy, opts.mobile);
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

  /** Les volumes pleins : le bac sous son fond (repere du fond), le capot (le sien, il se souleve). */
  occluders(): Occluder[] {
    const depth = DJ_BODY.front + DJ_BODY.feet;
    const t = SMPL_LID.t;
    return [
      { layer: this.inner, min: [-SMPL_W / 2, -depth, -SMPL_D / 2], max: [SMPL_W / 2, -t, SMPL_D / 2], tag: 'smpl' },
      { layer: this.top, min: [-SMPL_W / 2, -t, -SMPL_D / 2], max: [SMPL_W / 2, 0, SMPL_D / 2], tag: 'smpl' },
    ];
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
    const q = smplSeq.get();
    let changed = false;
    // Sur le caoutchouc clair (Light), la LED pousse plus fort pour se lire autant
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
    const paleYellow = scale(DJ_GLOW.yellow, 0.18);
    SMPL_KEYS.forEach((k, i) => {
      const held = this.held.has(smplKeyId(k.kind));
      // PLAY : or quand il joue (la sequence ou la region), pale quand il y a un sample ; les modes pris en orange
      if (k.kind === 'play') {
        set(this.keyEm, i, s.preview || q.running || held ? DJ_GLOW.yellow : s.sample ? paleYellow : DJ_GLOW.dim);
        return;
      }
      const on = held || (k.kind === 'rev' && s.reverse) || (k.kind === 'loop' && s.loop) || (k.kind === 'rec' && s.recording) || (k.kind === 'mode' && s.mode === 'grain') || (k.kind === 'edit' && q.edit);
      set(this.keyEm, i, on ? DJ_GLOW.orange : DJ_GLOW.dim);
    });
    const n = padCount();
    const pale = scale(DJ_GLOW.orange, 0.22);
    const at = this.seqAt;
    if (q.edit) {
      // EDIT : les pas ; plein en orange, la tete de lecture en or (pale sur un pas vide)
      for (let i = 0; i < SMPL_PADS; i += 1) {
        const full = q.steps[i] !== null;
        const held = this.held.has(smplPadId(i));
        set(this.padEm, i, held || (i === at && full) ? DJ_GLOW.yellow : i === at ? paleYellow : full ? DJ_GLOW.orange : DJ_GLOW.dim);
      }
    } else {
      // Les slices ; celle que la sequence joue s'allume comme un pad frappe
      const playing = at >= 0 ? smplSeq.sliceOf(q.steps[at]) : null;
      for (let i = 0; i < SMPL_PADS; i += 1) {
        const sounds = s.pads.includes(i) || this.held.has(smplPadId(i)) || playing === i;
        set(this.padEm, i, sounds ? DJ_GLOW.yellow : i < n ? pale : DJ_GLOW.off);
      }
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
    return this.screen.draw(s, smplParams.get(), smplEngine.data()?.mono ?? null, rec, smplSeq.get());
  }

  private recFrom = 0;
  private wasRec = false;
  /** le pas de la sequence sous la tete de lecture (-1 a l'arret) */
  private seqAt = -1;
  /** le gain des LED (Light : plus fort, le caoutchouc est clair) */
  private glow = APPEARANCE.current === 'light' ? 1.6 : 1;

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
    // La sequence : la tete de lecture sur les trigs et sur la bande des pas de l'ecran
    const q = smplSeq.get();
    const at = q.running ? smplSeq.stepAt(smplSeq.now()) : -1;
    if (at !== this.seqAt) {
      this.seqAt = at;
      if (this.syncLights()) changed = true;
      if (this.screen.setStep(at)) changed = true;
    }
    return playing || s.recording || q.running || changed ? 'paint' : false;
  };

  /* ---------- OPEN ---------- */

  private syncExplode = (): void => {
    this.applyExplode(false);
  };

  /**
   * Le capot (store smplExplode) : opening ou closing lance l'animation
   * (l'etat final a la frame suivante en mouvement reduit), open et closed
   * sont poses par l'animation (settle) ; instant : l'etat pose tout de
   * suite (le rig arrive).
   */
  private applyExplode(instant: boolean): void {
    const s = smplExplode.get();
    const goal = s === 'opening' || s === 'open';
    if (instant) {
      this.explodeGoal = goal;
      if (goal) this.pcb.prepare();
      this.explode.snap(goal);
      if (s === 'opening' || s === 'closing') smplExplode.settle(goal);
      this.opts.invalidate();
      return;
    }
    if (goal === this.explodeGoal) return;
    this.explodeGoal = goal;
    // Le capot s'ouvre : la musique est programmee d'avance, la carte prend ses textures (premiere fois)
    if (goal) {
      reserve(1.2);
      this.pcb.prepare();
    }
    if (s === 'opening' || s === 'closing') this.explode.start(goal, performance.now(), this.opts.reduced());
    else this.explode.snap(goal);
    this.opts.invalidate();
  }

  /** Le capot qui s'ouvre ou se ferme ; true tant qu'il bouge. */
  stepExplode = (now: number): boolean => this.explode.update(now);

  /** Abonnements, poses par le Stage une fois tout le GL construit. */
  listen(): void {
    this.unsubs.push(smplExplode.subscribe(this.syncExplode));
    this.applyExplode(true);
    this.detach = smplExplode.attach();
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
      smplEngine.subscribeLive(() => this.opts.repaint()),
      smplSeq.subscribe(() => {
        const lit = this.syncLights();
        const drawn = this.drawScreen(performance.now());
        // La sequence part : l'animateur doit tourner (la tete de lecture), meme si rien n'a change a l'image
        if (lit || drawn || smplSeq.get().running) this.opts.repaint();
      })
    );
    void whenFonts().then(() => this.redrawText());
  }

  /** Polices ou logos arrives : la serigraphie et l'ecran se redessinent. */
  redrawText(): void {
    this.silk.draw();
    this.pcb.redraw();
    this.plate.draw();
    this.screen.invalidate();
    this.drawScreen(performance.now());
    this.opts.repaint();
  }

  setHover(_id: string | null): boolean {
    return false;
  }

  info(): { knobs: number; keys: number; pads: number; screenDraws: number; silkDraws: number; heads: number; explode: ExplodeInfo } {
    return { knobs: SMPL_KNOBS.length, keys: SMPL_KEYS.length, pads: SMPL_PADS, screenDraws: this.screen.draws, silkDraws: this.silk.draws, heads: this.screen.heads.count, explode: this.explode.info() };
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    this.detach();
    this.body.geometry.dispose();
    this.lid.geometry.dispose();
    this.pcb.dispose();
    this.plate.dispose();
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
