/**
 * Le MM-BASS en 3D (2026-10-07) : un bloc de la taille du MM-RYTM, fait des
 * pieces du MM-DECKS (dj/body.ts le coin, le dessus brosse, les pieds, la
 * connectique derriere ; le dessus a la forme de celui du MM-RYTM, coins
 * arrondis, sans vis ; dj/controls.ts les potards et les touches
 * en caoutchouc a LED ; dj/silk.ts la serigraphie), dispose d'apres
 * bass/theme.ts :
 * - l'ecran (bass/screen.ts) ;
 * - le grand CUTOFF en aluminium et les potards du son (aluminium, ACCENT
 *   en orange), le generateur en noir ;
 * - dix touches (RUN en or quand la basse joue, ACCENT et SLIDE allumes
 *   quand le pas choisi les a) ;
 * - seize pas : orange une note (plus vif accentuee), pale une liaison, or le
 *   pas qui joue, le pas choisi plus clair ; en EDIT (2026-10-07) les seize
 *   patterns : le courant vif, la chaine a demi, celui qui attend en or, un
 *   plein a peine ;
 * - seize boutons LOCK au-dessus des pas (2026-10-07) : orange pale si le pas
 *   a des verrous, or celui qu'on regle ;
 * - l'ecran se touche pour les presets (state/presetMode.ts, comme ceux du
 *   MM-RYTM et du MM-ARP) ;
 * - la serigraphie : l'en-tete, les noms, les familles (FILTER, VOICE en os,
 *   GENERATOR en orange), les filets entre les groupes de touches, le numero
 *   de chaque pas (1, 5, 9, 13 plus marques).
 * Tout dans le repere top (le dessus incline), x = 0 au centre du bloc.
 *
 * La refonte facon Monark et Elektron (2026-10-08, Mika : "MM-BASS est un
 * peu complexe ; quelque chose d'intuitif, pour qu'on ne cherche pas les
 * choses ; un bouton OPEN ; un bouton EDIT, je n'en vois pas") :
 * - la face par sections, dans l'ordre du signal (bass/theme.ts
 *   BASS_SECTIONS) : GENERATOR a cote de l'ecran (STYLE, DENSITY, GEN,
 *   MUTATE), puis OSC | FILTER | ENVELOPE | ACCENT / SLIDE | OUTPUT ; EDIT et
 *   OPEN en haut a droite, plus grands, noms et LED orange ;
 * - le capot (top) : la dalle, l'ecran, toutes les commandes, pose sur le
 *   coin descendu de son epaisseur ; OPEN le souleve (scene/explode.ts,
 *   bassExplode) ; dans le bac (inner, le repere du fond), la carte du
 *   MM-RYTM sort, sa plaque TWEAKS (bass/tweaks.ts) porte les reglages fins,
 *   INFOS et CLOSE (des touches du DOM, ui/HoodClose.tsx, bass/InfosKey) ;
 * - LOCK se voit : le pas qu'on regle clignote en or, une LED orange
 *   s'allume a cote de chaque potard verrouille sur ce pas, l'ecran montre
 *   la grille des verrous ; un potard qu'on tourne s'affiche en grand un
 *   instant (l'echo des Elektron).
 */

import { BufferGeometry, Color, CylinderGeometry, DynamicDrawUsage, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3, type Texture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { reserve } from '../audio/sched';
import type { HotspotDef, Occluder } from '../scene/hit';
import { potAngle } from '../scene/encoders';
import { Explode, type ExplodeCfg, type ExplodeInfo } from '../scene/explode';
import { withRubberLed } from '../scene/materials';
import { Pcb } from '../scene/pcb';
import { makeBrushTexture, whenFonts } from '../scene/silk';
import { bassExplode } from '../state/explode';
import { APPEARANCE, HEX, PCB_TURN, PORTRAIT } from '../theme';
import { pattern } from '../audio/pattern';
import { editor } from '../state/editor';
import { presetMode, type PresetKey } from '../state/presetMode';
import { presets } from '../state/presets';
import { TOP_M, bezel, dc, partDj, power, rca, roundSlab, usb, wedge } from '../dj/body';
import { DJ_GLOW, keyGeometry, knobGeometry } from '../dj/controls';
import { DjSilk, headTexts, type Bracket, type Line, type Text } from '../dj/silk';
import { DJ_BEZEL, DJ_BODY, DJ_KEY, DJ_KNOB, DJ_TILT, DJ_TOP_Y, DJ_UNIT } from '../dj/theme';
import { bassKnobValue, noteName } from './actions';
import { BASS_SLOTS, bassPatterns } from './patterns';
import { bassEngine } from './engine';
import { BASS_FACE_KNOBS as BASS_KNOBS, BASS_PLATE_KNOBS, bassParams, bassValueText, type BassKnobId } from './params';
import { BassTweaks } from './tweaks';
import { bassInfos } from '../state/bassInfos';
import { BassScreen } from './screen';
import { bassSeq, midiOf } from './seq';
import { BASS_LOCKABLE, BASS_STEPS, bassState, isLockable, type BassLockId } from './state';
import type { BassLockCell } from './screen';

/** L'echo d'un potard a l'ecran (2026-10-08) : le temps qu'il reste. */
const ECHO_MS = 1200;
/** LOCK : la periode du clignotement du pas regle (ms) et la part allumee. */
const BLINK = { period: 760, on: 0.62 } as const;

/** Les noms courts des verrous, sur la ligne du bas de l'ecran. */
const LOCK_SHORT: Readonly<Record<BassLockId, string>> = { cutoff: 'CUT', reso: 'RES', envmod: 'ENV', decay: 'DEC', accent: 'ACC', wave: 'WAVE', sub: 'SUB', drive: 'DRV', glide: 'GLD', volume: 'VOL', length: 'LEN' };
import {
  BASS,
  BASS_D,
  BASS_EXPLODE,
  BASS_KEYS,
  BASS_KEY_SEPS,
  BASS_KNOB_PLACES,
  BASS_LID,
  BASS_PCB_Y,
  BASS_SECTIONS,
  BASS_W,
  bassKeyAt,
  bassKnobAt,
  bassLockAt,
  bassKnobTone,
  bassPlateClear,
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
  /** mouvement reduit : OPEN pose son etat final sans animation */
  reduced: () => boolean;
  repaint: () => void;
  invalidate: () => void;
  /** des zones ont change (l'ecran des presets, le capot) : le picking se refait */
  hitChanged: () => void;
}

/* ---------------- les ids des commandes ---------------- */

export const bassKnobId = (k: BassKnobId): string => `bass-knob-${k}`;
export const bassKeyId = (k: BassKeyKind): string => `bass-key-${k}`;
export const bassTrigId = (i: number): string => `bass-trig-${i + 1}`;
export const bassLockId = (i: number): string => `bass-lock-${i + 1}`;
export const bassLcdId = (k: PresetKey): string => `bass-lcd-${k}`;

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

/**
 * Le dessus (2026-10-07, Mika : "MM-BASS devrait avoir la meme forme de
 * boitier que MM-RYTM, un peu arrondi sur les bordures mais pas trop") : la
 * dalle du MM-RYTM, coins arrondis (0.2, plus le biseau de 0.1), 0.14
 * d'epaisseur, posee sur le coin ; plus de vis (le MM-RYTM n'en a pas).
 * Depuis le 2026-10-08 c'est le capot (buildLid) : OPEN le souleve.
 */
const SLAB = { t: BASS_LID.t, r: 0.2, bevel: 0.1 } as const;

/** Le bac : le coin descendu de l'epaisseur du capot (son fond sombre), les pieds, la connectique derriere. */
function buildBody(mobile: boolean): BufferGeometry {
  const seg = mobile ? 12 : 16;
  const hw = BASS_W / 2;
  const hd = BASS_D / 2;
  const parts: BufferGeometry[] = [wedge(-hw, hw, BASS_D, SLAB.t, 'body')];
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

/** Le capot (repere top) : la dalle arrondie et le cadre de l'ecran, poses par dj/body.ts dans le repere du bloc et ramenes dans celui du capot. */
function buildLid(): BufferGeometry {
  const slope = BASS_D / Math.cos(DJ_TILT);
  const parts = [roundSlab(BASS_W, slope, SLAB.t, SLAB.r, SLAB.bevel), bezel(BASS.screen.x, BASS.screen.z, BASS.screen.w, BASS.screen.d)];
  const inv = TOP_M.clone().invert();
  for (const p of parts) p.applyMatrix4(inv);
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!g) throw new Error('bass: lid merge failed');
  brushUv(g);
  return g;
}

/** Les potards qu'un pas peut verrouiller, sur la face : une LED a cote de chacun (LOCK). */
const LOCK_KNOBS: readonly BassKnobId[] = BASS_KNOBS.map((k) => k.id).filter((id) => isLockable(id));
/** La LED d'un potard : a sa droite, a mi-hauteur. */
const lockDotAt = (id: BassKnobId): { x: number; z: number } => {
  const p = bassKnobAt(id);
  return { x: p.x + DJ_KNOB.skirt.r * p.s + (PORTRAIT ? 0.11 : 0.09), z: p.z };
};
const DOT_OFF = new Color(APPEARANCE.current === 'light' ? '#3a3631' : '#1a1816');
const DOT_DIM = new Color(APPEARANCE.current === 'light' ? '#7a5a40' : '#4a2a14');
const DOT_ON = new Color(HEX.orange).multiplyScalar(1.25);

/* ---------------- la serigraphie ---------------- */

const knobLabelZ = (z: number, s: number): number => z - DJ_KNOB.skirt.r * s - 0.22 * Math.max(0.9, Math.min(s, 1.3));
/** Au telephone, les inscriptions un tiers plus grandes (le bloc se voit plus petit). */
const INK_K = PORTRAIT ? 1.3 : 1;

function silkItems(): { texts: Text[]; lines: Line[]; brackets: Bracket[] } {
  const texts: Text[] = headTexts('MM-BASS', 'MONO BASS SYNTH', BASS_W, BASS.head.z, 1.95);
  // Le firmware, a gauche du logotype (2026-10-07, Mika : "V1 sur BASS", comme V3 sur le MM-RYTM ; V2 la refonte du 2026-10-08)
  texts.push({ text: 'FIRMWARE V.2.0 / 2026', x: BASS_W / 2 - (PORTRAIT ? 1.0 : 1.05), z: BASS.head.z + 0.035, cap: PORTRAIT ? 0.058 : 0.065, align: 'right', alpha: 0.45 });
  const lines: Line[] = [];
  const brackets: Bracket[] = [];
  const tick = (x: number, z: number, deg: number, r0: number, r1: number): void => {
    const a = (deg * Math.PI) / 180;
    lines.push([x + Math.cos(a) * r0, z - Math.sin(a) * r0, x + Math.cos(a) * r1, z - Math.sin(a) * r1]);
  };
  // Les potards : le nom au-dessus (orange pour le generateur) ; CUTOFF gradue de 0 a 10, les autres leurs butees ou leurs crans
  const genIds = BASS_SECTIONS[0].ids;
  for (const p of BASS_KNOB_PLACES) {
    const def = BASS_KNOBS.find((k) => k.id === p.id);
    const r = DJ_KNOB.skirt.r * p.s;
    const hero = p.id === 'cutoff' || p.id === 'style';
    const gen = genIds.includes(p.id);
    texts.push({ text: def?.label ?? p.id, x: p.x, z: knobLabelZ(p.z, p.s), cap: (hero ? 0.075 : 0.058) * INK_K, weight: 700, maxW: PORTRAIT ? 1.7 : 1.1, group: hero ? 'hero' : 'knob', ...(gen ? { ink: 'orange' as const, alpha: 1 } : {}) });
    if (p.id === 'cutoff') {
      for (let t = 0; t <= 10; t += 1) tick(p.x, p.z, 225 - t * 27, r + 0.05, r + (t % 5 === 0 ? 0.16 : 0.1));
    } else if (def?.steps) {
      for (let t = 0; t < def.steps; t += 1) tick(p.x, p.z, 225 - (t * 270) / (def.steps - 1), r + 0.03, r + 0.09);
    } else {
      for (const deg of [225, -45]) tick(p.x, p.z, deg, r + 0.03, r + 0.08);
    }
  }
  // Les sections (2026-10-08, l'ordre du signal) : desktop un crochet au-dessus des noms, comme les sections d'un
  // Minimoog ; au telephone un crochet sous chaque rangee (une rangee peut en porter deux)
  const K = (s: number): number => DJ_KNOB.skirt.r * s;
  // Desktop : les sections du son a la meme hauteur (au-dessus du plus haut des noms de la rangee)
  const soundIds = BASS_SECTIONS.slice(1).flatMap((g) => g.ids);
  const soundTop = Math.min(...soundIds.map((id) => knobLabelZ(bassKnobAt(id).z, bassKnobAt(id).s))) - 0.22;
  for (const g of BASS_SECTIONS) {
    const ps = g.ids.map(bassKnobAt);
    // Le generateur prend aussi ses touches GEN et MUTATE
    const keys = g.name === 'GENERATOR' ? BASS_KEYS.filter((k) => k.kind === 'gen' || k.kind === 'mutate') : [];
    const x0 = Math.min(...ps.map((p) => p.x - K(p.s)), ...keys.map((k) => k.x - k.w / 2)) - 0.06;
    const x1 = Math.max(...ps.map((p) => p.x + K(p.s)), ...keys.map((k) => k.x + k.w / 2)) + 0.06;
    const ink = g.ink ? { ink: g.ink } : {};
    if (PORTRAIT) brackets.push({ text: g.name, x0, x1, z: Math.max(...ps.map((p) => p.z + K(p.s)), ...keys.map((k) => k.z + k.d / 2)) + 0.2, ...ink });
    else brackets.push({ text: g.name, x0, x1, z: g.name === 'GENERATOR' ? Math.min(...ps.map((p) => knobLabelZ(p.z, p.s))) - 0.24 : soundTop, down: true, ...ink });
  }
  // Les touches : leur nom au-dessus (RUN, EDIT, OPEN, GEN en orange) ; un filet entre les groupes de la rangee de jeu (desktop)
  for (const k of BASS_KEYS) {
    const big = k.kind === 'edit' || k.kind === 'open';
    texts.push({ text: k.label, x: k.x, z: k.z - k.d / 2 - 0.15, cap: (big ? 0.072 : 0.058) * INK_K, weight: 700, group: 'keys', maxW: k.w + 0.2, ...(k.orange ? { ink: 'orange' as const, alpha: 1 } : {}) });
  }
  for (const [a, b] of BASS_KEY_SEPS) {
    const ka = BASS_KEYS.find((k) => k.kind === a);
    const kb = BASS_KEYS.find((k) => k.kind === b);
    if (!ka || !kb) continue;
    const sep = (ka.x + ka.w / 2 + kb.x - kb.w / 2) / 2;
    lines.push([sep, ka.z - 0.3, sep, ka.z + 0.2]);
  }
  // Les pas : leur numero dessous (1, 5, 9, 13 plus marques), LOCK au-dessus des boutons, le crochet qui dit les gestes
  const T = BASS.trigs;
  for (let i = 0; i < BASS_STEPS; i += 1) {
    const p = bassTrigAt(i);
    texts.push({ text: String(i + 1), x: p.x, z: p.z + T.d / 2 + 0.13, cap: 0.058 * INK_K, weight: 700, alpha: i % 4 === 0 ? 1 : 0.5, group: 'trigs' });
  }
  const t0 = bassTrigAt(PORTRAIT ? 8 : 0).x - T.w / 2;
  const t1 = bassTrigAt(15).x + T.w / 2;
  brackets.push({
    text: PORTRAIT ? 'LOCK OR HOLD A STEP + KNOB: THAT STEP  /  TAP: NOTE, TIE, OFF' : 'LOCK (OR HOLD A STEP) + TURN A KNOB: THAT STEP ONLY  /  TAP A STEP: NOTE, TIE, OFF',
    x0: t0,
    x1: t1,
    z: bassTrigAt(15).z + T.d / 2 + 0.42,
  });
  return { texts, lines, brackets };
}

/* ---------------- le rig ---------------- */

export class BassRig {
  readonly root = new Group();
  readonly socle = new Group();
  /** le capot : la dalle et tout ce qui est dessus ; OPEN le souleve */
  readonly top = new Group();
  /** le fond du bac (le repere top ferme, il ne bouge pas) : la carte y sort */
  readonly inner = new Group();
  readonly pcbGroup = new Group();
  readonly pcb: Pcb;
  /** la plaque TWEAKS sous le capot : les reglages fins, INFOS et CLOSE s'y posent (son repere top) */
  readonly tweaks: BassTweaks;
  readonly explode: Explode;
  readonly screen: BassScreen;
  private body: Mesh;
  private lid: Mesh;
  private bodyMat: MeshStandardMaterial;
  private brush: Texture;
  private knobs: InstancedMesh[];
  private knobSlot: { m: number; j: number }[];
  private keys: InstancedMesh;
  private trigs: InstancedMesh;
  private locks: InstancedMesh;
  /** LOCK : une LED a cote de chaque potard verrouillable (allumee s'il a un verrou sur le pas qu'on regle) */
  private dots: InstancedMesh;
  private dotMat: MeshBasicMaterial;
  private dotOn: Int8Array;
  private silk: DjSilk;
  private materials: MeshStandardMaterial[] = [];
  private keyEm: InstancedBufferAttribute;
  private trigEm: InstancedBufferAttribute;
  private lockEm: InstancedBufferAttribute;
  private knobAngle = new Float32Array(BASS_KNOBS.length);
  private keyY = new Float32Array(BASS_KEYS.length);
  private trigY = new Float32Array(BASS_STEPS);
  private lockY = new Float32Array(BASS_STEPS);
  private lcdDefs: HotspotDef[] = [];
  private tweakDefs: HotspotDef[] = [];
  private defs: HotspotDef[];
  private unsubs: (() => void)[] = [];
  private held = new Set<string>();
  private stepAt = -1;
  private liveAt = 0;
  private glow = APPEARANCE.current === 'light' ? 1.6 : 1;
  private explodeGoal = false;
  private detach: () => void = () => undefined;
  /** LOCK : le pas regle clignote (allume ou non a cette image) */
  private blink = true;
  /** l'echo du potard tourne : son minuteur de fin */
  private echoTimer = 0;

  constructor(private opts: BassRigOpts) {
    this.root.name = 'bassRoot';
    this.root.position.x = bassX();
    this.socle.name = 'bassSocle';
    this.top.name = 'bassTop';
    this.top.position.set(0, DJ_TOP_Y, 0);
    this.top.rotation.x = DJ_TILT;
    this.inner.name = 'bassInner';
    this.inner.position.set(0, DJ_TOP_Y, 0);
    this.inner.rotation.x = DJ_TILT;
    this.pcbGroup.name = 'bassPcbGroup';
    this.pcbGroup.position.y = BASS_PCB_Y;
    this.pcbGroup.rotation.y = PCB_TURN;
    this.pcbGroup.visible = false;
    this.inner.add(this.pcbGroup);
    this.root.add(this.socle, this.inner, this.top);

    const light = APPEARANCE.current === 'light';
    this.brush = makeBrushTexture();
    this.bodyMat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughnessMap: this.brush, roughness: light ? 0.55 : 0.68, metalness: light ? 0 : 0.22 });
    this.bodyMat.name = 'bassBody';
    this.body = new Mesh(buildBody(opts.mobile), this.bodyMat);
    this.body.name = 'bassBody';
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.socle.add(this.body);
    this.lid = new Mesh(buildLid(), this.bodyMat);
    this.lid.name = 'bassLid';
    this.lid.castShadow = true;
    this.lid.receiveShadow = true;
    this.top.add(this.lid);

    // L'interieur : la carte (celle du MM-RYTM, degagee sous la plaque) et la plaque TWEAKS
    this.pcb = new Pcb(opts.mobile, opts.anisotropy, { model: 'MM-BASS R2.0', variant: 'voy', chips: false, clear: bassPlateClear() });
    this.pcbGroup.add(this.pcb.board, this.pcb.parts);
    this.tweaks = new BassTweaks({ mobile: opts.mobile, anisotropy: opts.anisotropy });
    this.pcb.parts.add(this.tweaks.group);
    const cfg: ExplodeCfg = { ...BASS_EXPLODE, plateauY: DJ_TOP_Y, pcbY: BASS_PCB_Y, tilt: DJ_TILT };
    this.explode = new Explode({ plateau: this.top, pcb: this.pcbGroup, parts: this.pcb.parts }, (open) => bassExplode.settle(open), cfg);

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
    const lg = keyGeometry(opts.mobile);
    this.lockEm = new InstancedBufferAttribute(new Float32Array(BASS_STEPS * 3), 3);
    this.lockEm.setUsage(DynamicDrawUsage);
    lg.setAttribute('instanceEmissive', this.lockEm);
    this.locks = new InstancedMesh(lg, std('bassLock', { roughness: 0.88, metalness: 0 }, true), BASS_STEPS);
    this.locks.name = 'bassLocks';
    for (const m of [...this.knobs, this.keys, this.trigs, this.locks]) {
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      m.castShadow = !opts.mobile;
      m.receiveShadow = true;
    }
    // Les LED des verrous : de petites pastilles qui eclairent par elles-memes
    const dg = new CylinderGeometry(0.045, 0.045, 0.02, opts.mobile ? 10 : 14);
    dg.translate(0, 0.01, 0);
    this.dotMat = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.dotMat.name = 'bassLockDot';
    this.dots = new InstancedMesh(dg, this.dotMat, Math.max(1, LOCK_KNOBS.length));
    this.dots.name = 'bassLockDots';
    this.dotOn = new Int8Array(LOCK_KNOBS.length).fill(-1);
    LOCK_KNOBS.forEach((id, i) => {
      const p = lockDotAt(id);
      this.dots.setMatrixAt(i, m4.compose(v3.set(p.x, 0, p.z), q0, s3.set(1, 1, 1)));
      this.dots.setColorAt(i, DOT_OFF);
    });
    this.top.add(...this.knobs, this.keys, this.trigs, this.locks, this.dots);

    this.screen = new BassScreen(opts.anisotropy, opts.mobile);
    this.top.add(this.screen.mesh);
    this.silk = new DjSilk({ name: 'bassSilk', w: BASS_W, x: 0, items: silkItems, logo: BASS.logo, d: Math.max(BASS_D, DJ_UNIT.d) }, opts.anisotropy, opts.mobile);
    this.top.add(this.silk.mesh);

    BASS_KNOBS.forEach((k, i) => {
      this.knobAngle[i] = potAngle(bassKnobValue(k.id));
      this.placeKnob(i);
    });
    BASS_KEYS.forEach((_, i) => this.placeKey(i));
    for (let i = 0; i < BASS_STEPS; i += 1) {
      this.placeTrig(i);
      this.placeLock(i);
    }
    this.tweaks.sync(bassKnobValue);
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
    this.keys.setMatrixAt(i, m4.compose(v3.set(p.x, this.keyY[i], p.z), q0, s3.set(p.w, 1, p.d)));
    this.keys.instanceMatrix.needsUpdate = true;
  }

  private placeTrig(i: number): void {
    const p = bassTrigAt(i);
    const T = BASS.trigs;
    this.trigs.setMatrixAt(i, m4.compose(v3.set(p.x, this.trigY[i], p.z), q0, s3.set(T.w, T.h, T.d)));
    this.trigs.instanceMatrix.needsUpdate = true;
  }

  private placeLock(i: number): void {
    const p = bassLockAt(i);
    const Lk = BASS.locks;
    this.locks.setMatrixAt(i, m4.compose(v3.set(p.x, this.lockY[i], p.z), q0, s3.set(Lk.w, Lk.h, Lk.d)));
    this.locks.instanceMatrix.needsUpdate = true;
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
    for (const k of BASS_KEYS) out.push({ id: bassKeyId(k.kind), kind: 'basskey', layer: top, shape: 'box', x: k.x, z: k.z, hx: k.w / 2, hz: k.d / 2, y0: 0, y1: DJ_KEY.h, enabled: true, bass: k.kind });
    const T = BASS.trigs;
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const p = bassTrigAt(i);
      out.push({ id: bassTrigId(i), kind: 'basstrig', layer: top, shape: 'box', x: p.x, z: p.z, hx: T.w / 2 + 0.04, hz: T.d / 2 + 0.04, y0: 0, y1: DJ_KEY.h * T.h, enabled: true, bass: String(i) });
    }
    const Lk = BASS.locks;
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const p = bassLockAt(i);
      out.push({ id: bassLockId(i), kind: 'basslock', layer: top, shape: 'box', x: p.x, z: p.z, hx: Lk.w / 2 + 0.04, hz: Lk.d / 2 + 0.06, y0: 0, y1: DJ_KEY.h * Lk.h, enabled: true, bass: String(i) });
    }
    // L'ecran : le toucher ouvre les presets ; en mode presets, le haut a gauche et a droite (precedent,
    // suivant), la bande du bas en quatre touches (SAVE NAME DEL EXIT), comme les ecrans du MM-RYTM et du MM-ARP
    const S = BASS.screen;
    const band = 0.74;
    const box = (key: PresetKey, u0: number, u1: number, v0: number, v1: number): HotspotDef => ({
      id: bassLcdId(key),
      kind: 'basslcd',
      lcd: key,
      layer: top,
      shape: 'box',
      x: S.x - S.w / 2 + ((u0 + u1) / 2) * S.w,
      z: S.z - S.d / 2 + ((v0 + v1) / 2) * S.d,
      hx: ((u1 - u0) / 2) * S.w,
      hz: ((v1 - v0) / 2) * S.d,
      y0: DJ_BEZEL.h - 0.005,
      y1: DJ_BEZEL.h + 0.03,
      enabled: key === 'open',
    });
    const lcd = [box('open', 0, 1, 0, 1), box('prev', 0, 0.5, 0, band), box('next', 0.5, 1, 0, band), ...(['save', 'name', 'del', 'exit'] as const).map((k, i) => box(k, i / 4, (i + 1) / 4, band, 1))];
    // La plaque sous le capot : ses potards, vivants capot ouvert (syncHood)
    const all = [...out, ...lcd, ...this.tweaks.hotspots()].map((d) => ({ ...d, machine: 'bass' as const }));
    this.lcdDefs = all.filter((d) => d.kind === 'basslcd');
    this.tweakDefs = all.filter((d) => d.id.startsWith('bass-tw-'));
    return all;
  }

  /** Le mode presets : les touches de l'ecran suivent ; true si ca change. */
  private syncPresetKeys(): boolean {
    const on = presetMode.on('bass');
    let changed = false;
    for (const d of this.lcdDefs) {
      const want = d.lcd === 'open' ? !on : on;
      if (d.enabled !== want) {
        d.enabled = want;
        changed = true;
      }
    }
    return changed;
  }

  /** Le capot : les potards de la plaque repondent ouvert, et pendant l'ouverture des que le capot les a decouverts ; true si ca change. */
  private syncHood(): boolean {
    const s = bassExplode.get();
    const live = s === 'open' || (s === 'opening' && this.explode.p.plateau >= 0.6);
    let changed = false;
    for (const d of this.tweakDefs) {
      if (d.enabled === live) continue;
      d.enabled = live;
      changed = true;
    }
    return changed;
  }

  get hotspots(): readonly HotspotDef[] {
    return this.defs;
  }

  /** Les volumes pleins : le bac sous son fond (repere du fond), le capot (le sien, il se souleve). */
  occluders(): Occluder[] {
    const depth = DJ_BODY.front + DJ_BODY.feet;
    const t = BASS_LID.t;
    return [
      { layer: this.inner, min: [-BASS_W / 2, -depth, -BASS_D / 2], max: [BASS_W / 2, -t, BASS_D / 2], tag: 'bass' },
      { layer: this.top, min: [-BASS_W / 2, -t, -BASS_D / 2], max: [BASS_W / 2, 0, BASS_D / 2], tag: 'bass' },
    ];
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
    const editing = editor.get() === 'bass';
    BASS_KEYS.forEach((k, i) => {
      const held = this.held.has(bassKeyId(k.kind));
      if (k.kind === 'run') {
        set(this.keyEm, i, s.running || held ? DJ_GLOW.yellow : scale(DJ_GLOW.yellow, 0.18));
        return;
      }
      const hood = bassExplode.get();
      const on = held || (k.kind === 'edit' && editing) || (k.kind === 'open' && (hood === 'opening' || hood === 'open')) || (k.kind === 'accent' && sel.kind === 'note' && sel.acc) || (k.kind === 'slide' && sel.kind !== 'off' && sel.slide);
      // EDIT, OPEN et GEN : toujours un peu allumes (on les voit tout de suite), vifs quand ils sont pris
      const idle = k.kind === 'edit' || k.kind === 'open' || k.kind === 'gen' ? scale(DJ_GLOW.orange, 0.16) : DJ_GLOW.dim;
      set(this.keyEm, i, on ? DJ_GLOW.orange : idle);
    });
    // Les LOCK : pale si le pas a des verrous, or celui qu'on regle (il clignote) ; eteints en EDIT
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const held = this.held.has(bassLockId(i));
      const has = !!s.steps[i].locks;
      set(this.lockEm, i, held || s.lock === i ? DJ_GLOW.yellow : editing ? scale(DJ_GLOW.dim, 0.5) : has ? scale(DJ_GLOW.orange, 0.45) : DJ_GLOW.dim);
    }
    if (editing) {
      // EDIT : les seize patterns
      const p = bassPatterns.get();
      for (let i = 0; i < BASS_SLOTS; i += 1) {
        const held = this.held.has(bassTrigId(i));
        const lit = held || i === p.next ? DJ_GLOW.yellow : i === p.cur ? DJ_GLOW.orange : p.chain.length > 1 && p.chain.includes(i) ? scale(DJ_GLOW.orange, 0.5) : bassPatterns.filled(i) ? scale(DJ_GLOW.orange, 0.2) : DJ_GLOW.dim;
        set(this.trigEm, i, lit);
      }
      return changed;
    }
    const at = this.stepAt;
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const st = s.steps[i];
      const held = this.held.has(bassTrigId(i));
      const base = st.kind === 'note' ? (st.acc ? DJ_GLOW.orange : scale(DJ_GLOW.orange, 0.5)) : st.kind === 'tie' ? scale(DJ_GLOW.orange, 0.2) : DJ_GLOW.dim;
      // LOCK : le pas qu'on regle clignote en or (comme les trigs verrouilles d'une Elektron)
      const locking = s.lock === i;
      const lit = held || (i === at && st.kind !== 'off') ? DJ_GLOW.yellow : locking ? scale(DJ_GLOW.yellow, this.blink ? 1 : 0.3) : i === at ? scale(DJ_GLOW.yellow, 0.25) : i === s.sel ? scale(base[0] > 0.05 ? base : DJ_GLOW.orange, base[0] > 0.05 ? 1.45 : 0.12) : base;
      set(this.trigEm, i, lit);
    }
    if (this.syncDots()) changed = true;
    return changed;
  }

  /** Les LED des potards : en LOCK, allumees pour les verrous du pas regle, a peine pour les autres ; eteintes sinon. */
  private syncDots(): boolean {
    const s = bassState.get();
    const locks = s.lock >= 0 ? s.steps[s.lock]?.locks : undefined;
    let changed = false;
    LOCK_KNOBS.forEach((id, i) => {
      const want = s.lock < 0 ? 0 : isLockable(id) && locks?.[id] !== undefined ? 2 : 1;
      if (this.dotOn[i] === want) return;
      this.dotOn[i] = want;
      this.dots.setColorAt(i, want === 2 ? DOT_ON : want === 1 ? DOT_DIM : DOT_OFF);
      changed = true;
    });
    if (changed && this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
    return changed;
  }

  private syncKnobs(): boolean {
    let moved = false;
    BASS_KNOBS.forEach((k, i) => {
      const a = Math.fround(potAngle(bassKnobValue(k.id)));
      if (this.knobAngle[i] === a) return;
      this.knobAngle[i] = a;
      this.placeKnob(i);
      moved = true;
    });
    // La plaque : ses potards suivent aussi (LENGTH en LOCK : le verrou du pas)
    if (this.tweaks.sync(bassKnobValue)) moved = true;
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
    const pv = presetMode.view('bass');
    const p = bassPatterns.get();
    const edit = editor.get() === 'bass' ? { cur: p.cur, next: p.next, chain: p.chain, filled: Array.from({ length: BASS_SLOTS }, (_, i) => bassPatterns.filled(i)) } : null;
    const locks = s.lock >= 0 ? s.steps[s.lock]?.locks : undefined;
    let lock = null;
    if (s.lock >= 0) {
      const ls = s.steps[s.lock];
      const what = ls.kind === 'off' ? 'EMPTY' : ls.kind === 'tie' ? 'TIE' : `${noteName(midiOf(ls))}${ls.acc ? ' ACC' : ''}${ls.slide ? ' SLD' : ''}`;
      const cells: BassLockCell[] = BASS_LOCKABLE.map((id) => ({ id, label: LOCK_SHORT[id], value: bassValueText(id, locks?.[id] ?? bassParams.of(id)), locked: locks?.[id] !== undefined }));
      lock = { step: s.lock, items: BASS_LOCKABLE.filter((id) => locks?.[id] !== undefined).map((id) => `${LOCK_SHORT[id]} ${bassValueText(id, locks?.[id] ?? 0)}`), head: `LOCK ${String(s.lock + 1).padStart(2, '0')}  ${what}`, cells };
    }
    // L'echo du potard qu'on vient de tourner (1.2 s), facon Elektron ; puis la page revient
    const t = s.touched;
    const left = t ? ECHO_MS - (performance.now() - t.at) : 0;
    window.clearTimeout(this.echoTimer);
    let knob = null;
    if (t && left > 0) {
      knob = { id: t.id, v: bassKnobValue(t.id), locked: s.lock >= 0 && isLockable(t.id) && locks?.[t.id] !== undefined };
      this.echoTimer = window.setTimeout(() => {
        if (this.drawScreen()) this.opts.repaint();
      }, left + 16);
    }
    return this.screen.draw(s, bassParams.get(), midis, pattern.get().bpm, { cut: sounding ? live.cut : 0, step: this.stepAt }, s.message, info, { edit, lock, presets: pv, knob });
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
    if (id.startsWith('bass-lock-')) {
      const i = Number(id.slice(10)) - 1;
      if (i >= 0 && i < BASS_STEPS) {
        this.lockY[i] = down ? -DJ_KEY.press * 0.8 : 0;
        this.placeLock(i);
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
    // LOCK : le pas regle clignote (une image de plus tant qu'on regle)
    const locking = bassState.get().lock >= 0;
    const blink = !locking || performance.now() % BLINK.period < BLINK.period * BLINK.on;
    if (at !== this.stepAt || blink !== this.blink) {
      this.stepAt = at;
      this.blink = blink;
      if (this.syncLights()) changed = true;
    }
    const live = bassEngine.live();
    if (live.at !== this.liveAt || changed) {
      this.liveAt = live.at;
      if (this.drawScreen()) changed = true;
    }
    return bassSeq.running || locking || changed ? 'paint' : false;
  };

  /* ---------- OPEN ---------- */

  private syncExplode = (): void => {
    this.applyExplode(false);
    const lit = this.syncLights();
    if (this.syncHood()) this.opts.hitChanged();
    if (lit) this.opts.repaint();
  };

  /**
   * Le capot (store bassExplode) : opening ou closing lance l'animation
   * (l'etat final a la frame suivante en mouvement reduit), open et closed
   * sont poses par l'animation (settle) ; instant : l'etat pose tout de
   * suite (le rig arrive).
   */
  private applyExplode(instant: boolean): void {
    const s = bassExplode.get();
    const goal = s === 'opening' || s === 'open';
    if (instant) {
      this.explodeGoal = goal;
      if (goal) this.pcb.prepare();
      this.explode.snap(goal);
      if (s === 'opening' || s === 'closing') bassExplode.settle(goal);
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

  /** Le capot qui s'ouvre ou se ferme ; true tant qu'il bouge (les potards de la plaque s'allument en chemin). */
  stepExplode = (now: number): boolean => {
    const moving = this.explode.update(now);
    if (this.syncHood()) this.opts.hitChanged();
    return moving;
  };

  listen(): void {
    this.unsubs.push(bassExplode.subscribe(this.syncExplode));
    this.applyExplode(true);
    if (this.syncHood()) this.opts.hitChanged();
    this.detach = bassExplode.attach();
    this.unsubs.push(
      bassState.subscribe(() => {
        const lit = this.syncLights();
        const moved = this.syncKnobs();
        const drawn = this.drawScreen();
        if (moved && this.knobs[0].castShadow) this.opts.invalidate();
        else if (lit || moved || drawn || bassState.get().running) this.opts.repaint();
      }),
      bassPatterns.subscribe(() => {
        const lit = this.syncLights();
        if (this.drawScreen() || lit) this.opts.repaint();
      }),
      editor.subscribe(() => {
        const lit = this.syncLights();
        if (this.drawScreen() || lit) this.opts.repaint();
      }),
      presetMode.subscribe(() => {
        if (this.syncPresetKeys()) this.opts.hitChanged();
        if (this.drawScreen()) this.opts.repaint();
      }),
      presets.subscribe(() => {
        if (this.drawScreen()) this.opts.repaint();
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
    this.pcb.redraw();
    this.tweaks.draw();
    this.screen.invalidate();
    this.drawScreen();
    this.opts.repaint();
  }

  /** Le survol : INFOS (2026-10-08) montre la carte de la commande survolee. */
  setHover(id: string | null): boolean {
    bassInfos.hover(id && id.startsWith('bass-') ? id : null);
    return false;
  }

  info(): { knobs: number; plate: number; keys: number; trigs: number; locks: number; screenDraws: number; silkDraws: number; explode: ExplodeInfo } {
    return { knobs: BASS_KNOBS.length, plate: BASS_PLATE_KNOBS.length, keys: BASS_KEYS.length, trigs: BASS_STEPS, locks: BASS_STEPS, screenDraws: this.screen.draws, silkDraws: this.silk.draws, explode: this.explode.info() };
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    this.detach();
    window.clearTimeout(this.echoTimer);
    this.body.geometry.dispose();
    this.lid.geometry.dispose();
    this.pcb.dispose();
    this.tweaks.dispose();
    this.dots.geometry.dispose();
    this.dots.dispose();
    this.dotMat.dispose();
    this.bodyMat.dispose();
    this.brush.dispose();
    for (const m of [...this.knobs, this.keys, this.trigs, this.locks]) {
      m.geometry.dispose();
      m.dispose();
    }
    for (const m of this.materials) m.dispose();
    this.screen.dispose();
    this.silk.dispose();
  }
}
