/**
 * Les touches de la face V.4.0 du MM-RYTM qui ne sont ni des touches de page
 * ni le transport (2026-10-27, Mika : "faceplate Octatrack x Digitakt ; les 10
 * grands pads disparaissent, EDIT et OPEN sont dans la rangee des
 * pictogrammes ; SCENE A, la fente du crossfader, SCENE B") : TRK, EDIT,
 * OPEN, SCENE A et SCENE B (theme.ts FACE_KEYS : la forme des touches de page,
 * 12 x 12 mm), leur pictogramme ou leur lettre imprime dessus
 * (scene/keyLabels.ts), et le capuchon du crossfader (theme.ts XFADE ; sa fente
 * est fusionnee au panneau, machine.ts). Le desktop seulement : le telephone
 * garde ses pads (phase 5).
 *
 * EDIT et OPEN gardent le role de leurs pads (renderer.ts) : EDIT s'allume en
 * entier, a l'orange, tant que l'editeur des patterns est ouvert ; OPEN est
 * l'action qui transforme la page, allume a l'orange machine fermee, et il
 * respire (theme.ts OPEN_BREATHE, breathe() appele par le Stage) ; capot ouvert,
 * son temoin a peine. Un appui les enfonce et les eclaire comme une touche de
 * page. TRK agit depuis la phase 2 (2026-10-27) : allumee tant qu'elle est
 * engagee (state/trk.ts), elle s'enfonce et s'eclaire au survol comme EDIT.
 * Les scenes et le crossfader restent visibles et inertes : ni lumiere, ni
 * appui, ni survol ; leur zone ne montre que leur infobulle (ui/Hotspots.tsx).
 * UN InstancedMesh pour les cinq touches, un pour leurs temoins (non
 * eclaires), un maillage pour leurs noms, un pour le capuchon.
 */

import { BoxGeometry, Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, type BufferGeometry, type Object3D } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLOR, FACE_KEY, FACE_KEYS, HOVER_LIGHT, KEYS, KEY_LABELS, KEY_LIT, KEY_LIT_LIGHT, LIT, MATERIAL, OPEN_BREATHE, PRESS_TINT, STEP_PRESS, XFADE, type FaceKeyId } from '../theme';
import type { HoldMode } from '../state/holdLatch';
import type { HotspotDef } from './hit';
import { KeyLabels, type KeyLabelAtlas } from './keyLabels';
import { paintLinear, paintSolid, withInstanceEmissive } from './materials';

const N = FACE_KEYS.length;
const EDIT = FACE_KEYS.findIndex((k) => k.id === 'edit');
const OPEN = FACE_KEYS.findIndex((k) => k.id === 'open');
const TRK = FACE_KEYS.findIndex((k) => k.id === 'trk');
/** Les touches qui agissent (s'enfoncent, s'eclairent au survol) : EDIT, OPEN, TRK depuis la phase 2 (2026-10-27). */
const LIVE = (i: number): boolean => i === EDIT || i === OPEN || i === TRK;
/** L'id de la zone de saisie (et du jumeau) de chaque touche : EDIT et OPEN gardent ceux de leurs pads. */
const HOTSPOT: Readonly<Record<FaceKeyId, string>> = { trk: 'trk', edit: 'pad-edit', open: 'pad-open', 'scene-a': 'scene-a', 'scene-b': 'scene-b' };
/** Le temoin d'OPEN capot ouvert : a peine (l'orangeDim du pad d'avant). */
const OPEN_DIM = 0.3;

const m4 = new Matrix4();
const col = new Color();
const WHITE = new Color(1, 1, 1);

function keyGeometry(mobile: boolean): BufferGeometry {
  const K = FACE_KEY;
  const g = new RoundedBoxGeometry(K.w, K.h, K.d, mobile ? KEYS.segments.mobile : KEYS.segments.desktop, K.radius);
  g.translate(0, K.h / 2, 0);
  g.deleteAttribute('uv');
  return g;
}

function ledGeometry(): BufferGeometry {
  const g = new PlaneGeometry(FACE_KEY.led.w, FACE_KEY.led.d);
  g.rotateX(-Math.PI / 2);
  g.deleteAttribute('uv');
  return g;
}

/** Le capuchon du crossfader : un pave charbon a coins arrondis, un trait os sur le dessus dans le sens de la profondeur. */
function capGeometry(): BufferGeometry {
  const C = XFADE.cap;
  const body = new RoundedBoxGeometry(C.w, C.h, C.d, 3, C.radius);
  body.translate(0, C.h / 2, 0);
  const b = body.toNonIndexed();
  body.dispose();
  b.deleteAttribute('uv');
  paintSolid(b, 'encoder');
  const markIdx = new BoxGeometry(C.mark.w, 0.004, C.mark.d);
  markIdx.translate(0, C.h + 0.001, 0);
  const mark = markIdx.toNonIndexed();
  markIdx.dispose();
  mark.deleteAttribute('uv');
  paintLinear(mark, LIT.mark);
  const g = mergeGeometries([b, mark], false);
  b.dispose();
  mark.dispose();
  if (!g) throw new Error('rytmFaceKeys: cap merge failed');
  return g;
}

/** z du temoin : sur le dessus, pres du bord arriere. */
const LED_Z = FACE_KEY.z - FACE_KEY.d / 2 + FACE_KEY.led.back;
const LED_Y = FACE_KEY.h + 0.002;

export interface RytmFaceKeysInfo {
  ids: FaceKeyId[];
  /** chaque touche allumee en entier (0 a 1) : EDIT ouvert, OPEN machine fermee */
  lit: number[];
  /** l'eclat du dessus d'une touche allumee (0 a 1) : OPEN machine fermee respire par lui (2026-10-27) */
  glow: number[];
  /** l'eclat de chaque temoin (0 a 1) */
  leds: number[];
  /** le nom de chaque touche en noir (sur une touche allumee) */
  dark: boolean[];
  open: boolean;
  editing: boolean;
  breathing: boolean;
  hover: FaceKeyId | null;
  /** TRK (2026-10-27) : off, held, latched, closing */
  trk: HoldMode;
}

export class RytmFaceKeys {
  readonly keys: InstancedMesh;
  readonly leds: InstancedMesh;
  readonly labels: KeyLabels;
  /** le capuchon du crossfader (inerte en phase 1, au milieu de sa course) */
  readonly cap: Mesh;
  private keyMat: MeshStandardMaterial;
  private ledMat: MeshBasicMaterial;
  private capMat: MeshStandardMaterial;
  private emissive: InstancedBufferAttribute;
  private press = new Float32Array(N);
  private fill = new Float32Array(N);
  private glow = new Float32Array(N);
  private level = new Float32Array(N);
  private hover = -1;
  private editing = false;
  private open = false;
  /** TRK (2026-10-27) : son etat (state/trk.ts) */
  private trk: HoldMode = 'off';
  /** la respiration d'OPEN machine fermee (1 : pleine) */
  private breath = 1;
  private off = new Color();
  private on = new Color();

  constructor(opts: { mobile: boolean; atlas: KeyLabelAtlas; castShadow: boolean }) {
    const g = keyGeometry(opts.mobile);
    this.emissive = new InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.emissive.setUsage(DynamicDrawUsage);
    g.setAttribute('instanceEmissive', this.emissive);
    this.keyMat = withInstanceEmissive(new MeshStandardMaterial({ ...MATERIAL.key }), false);
    this.keyMat.name = 'faceKey';
    this.keys = new InstancedMesh(g, this.keyMat, N);
    this.keys.name = 'faceKeys';
    this.keys.receiveShadow = true;
    FACE_KEYS.forEach((k, i) => this.keys.setMatrixAt(i, m4.makeTranslation(k.x, 0, FACE_KEY.z)));
    this.keys.instanceMatrix.setUsage(DynamicDrawUsage);
    this.keys.instanceMatrix.needsUpdate = true;

    this.off.setHex(COLOR.line);
    this.on.setHex(COLOR.ledSet);
    this.ledMat = new MeshBasicMaterial({ toneMapped: false });
    this.ledMat.name = 'faceKeyLed';
    this.leds = new InstancedMesh(ledGeometry(), this.ledMat, N);
    this.leds.name = 'faceKeyLeds';
    FACE_KEYS.forEach((k, i) => this.leds.setMatrixAt(i, m4.makeTranslation(k.x, LED_Y, LED_Z)));
    this.leds.instanceMatrix.setUsage(DynamicDrawUsage);
    this.leds.instanceMatrix.needsUpdate = true;

    const specs = FACE_KEYS.map((k) => KEY_LABELS.find((l) => l.id === k.id)).filter((l) => l !== undefined);
    this.labels = new KeyLabels(opts.atlas, specs, FACE_KEY.h, 'faceKey');

    this.capMat = new MeshStandardMaterial({ vertexColors: true, ...MATERIAL.encoder });
    this.capMat.name = 'xfadeCap';
    this.cap = new Mesh(capGeometry(), this.capMat);
    this.cap.name = 'xfadeCap';
    this.cap.position.set(XFADE.x, 0, XFADE.z);
    this.cap.castShadow = opts.castShadow;
    this.cap.receiveShadow = true;

    for (let i = 0; i < N; i += 1) this.refresh(i);
    this.keys.instanceColor?.setUsage(DynamicDrawUsage);
    this.leds.instanceColor?.setUsage(DynamicDrawUsage);
  }

  /** Les maillages a poser sur le plateau. */
  objects(): Object3D[] {
    return [this.keys, this.leds, this.labels.mesh, this.cap];
  }

  /**
   * La part allumee, l'eclat du dessus et le temoin de la touche i, selon son etat. OPEN machine fermee (la revue du
   * 2026-10-27) : le dessus reste a l'orange plein (fill 1 : la teinte de la machine claire ne palit plus en peche), seul
   * son eclat respire, de OPEN_BREATHE.faceMin (0.8) a 1 (a fill 0.45, il tombait sur le rouge de RUN/STOP au repos, sa voisine).
   */
  private state(i: number): { fill: number; glow: number; led: number } {
    if (i === EDIT) return this.editing ? { fill: 1, glow: 1, led: 1 } : { fill: 0, glow: 0, led: 0 };
    if (i === OPEN) {
      if (this.open) return { fill: 0, glow: 0, led: OPEN_DIM };
      const B = OPEN_BREATHE;
      const phase = (this.breath - B.min) / (1 - B.min);
      return { fill: 1, glow: B.faceMin + (1 - B.faceMin) * phase, led: this.breath };
    }
    // TRK engagee (tenue, gardee, en fermeture) : allumee en entier, son temoin plein
    if (i === TRK) return this.trk === 'off' ? { fill: 0, glow: 0, led: 0 } : { fill: 1, glow: 1, led: 1 };
    return { fill: 0, glow: 0, led: 0 };
  }

  /** Repeint la touche i : son dessus, son temoin, son nom. */
  private refresh(i: number): void {
    const s = this.state(i);
    this.fill[i] = s.fill;
    this.glow[i] = s.glow;
    this.level[i] = s.led;
    // Le dessus : sa teinte (la machine claire la tire vers l'orange de l'appui et de la touche allumee)
    const b = LIT.clear;
    col.setRGB(b[0], b[1], b[2]);
    const t = PRESS_TINT.rgb;
    const v = this.press[i];
    if (t && v > 0) col.setRGB(b[0] + (t[0] - b[0]) * v, b[1] + (t[1] - b[1]) * v, b[2] + (t[2] - b[2]) * v);
    const lt = KEY_LIT_LIGHT.tint?.orange;
    const f = s.fill;
    if (lt && f > 0) col.setRGB(col.r + (lt[0] - col.r) * f, col.g + (lt[1] - col.g) * f, col.b + (lt[2] - col.b) * f);
    this.keys.setColorAt(i, col);
    if (this.keys.instanceColor) this.keys.instanceColor.needsUpdate = true;
    // L'eclat : l'appui, la touche allumee, le survol
    const e = this.emissive.array as Float32Array;
    const g = KEY_LIT.glow.orange;
    const h = i === this.hover ? 1 : 0;
    for (let c = 0; c < 3; c += 1) e[i * 3 + c] = Math.max(STEP_PRESS.glow[c] * v, g[c] * KEY_LIT_LIGHT.glow * s.glow, HOVER_LIGHT.glow[c] * h);
    this.emissive.needsUpdate = true;
    // Le temoin : eteint, l'orange ; sur une touche allumee, tire vers le blanc (il reste l'accent)
    col.copy(this.off).lerp(this.on, s.led);
    if (f > 0) col.lerp(WHITE, KEY_LIT.ledWhite * f);
    this.leds.setColorAt(i, col);
    if (this.leds.instanceColor) this.leds.instanceColor.needsUpdate = true;
    this.labels.setLit(i, f > KEY_LIT.dark);
  }

  /** EDIT allume tant que l'editeur des patterns est ouvert ; true s'il faut une frame. */
  setEditing(on: boolean): boolean {
    if (on === this.editing) return false;
    this.editing = on;
    this.refresh(EDIT);
    return true;
  }

  /** TRK (2026-10-27) : allumee tant qu'elle est engagee ; true s'il faut une frame. */
  setTrk(mode: HoldMode): boolean {
    if (TRK < 0 || mode === this.trk) return false;
    const was = this.trk !== 'off';
    this.trk = mode;
    if (was === (mode !== 'off')) return false;
    this.refresh(TRK);
    return true;
  }

  /** Le capot ouvert (ou s'ouvrant) : OPEN a peine ; ferme, OPEN allume ; true s'il faut une frame. */
  setOpen(on: boolean): boolean {
    if (on === this.open) return false;
    this.open = on;
    this.refresh(OPEN);
    return true;
  }

  /** OPEN peut respirer : machine fermee. */
  get breathing(): boolean {
    return !this.open;
  }

  /** OPEN respire (OPEN_BREATHE) : sa lumiere suit une sinusoide, au centieme ; true si elle a change. */
  breathe(now: number): boolean {
    if (this.open) return false;
    const B = OPEN_BREATHE;
    const phase = Math.round((0.5 + 0.5 * Math.cos((2 * Math.PI * now) / B.periodMs)) * 100) / 100;
    const k = B.min + (1 - B.min) * phase;
    if (k === this.breath) return false;
    this.breath = k;
    this.refresh(OPEN);
    return true;
  }

  /** OPEN cesse de respirer : sa lumiere pleine ; true si elle a change. */
  stopBreath(): boolean {
    if (this.breath === 1) return false;
    this.breath = 1;
    this.refresh(OPEN);
    return true;
  }

  /** Le rang d'une touche par l'id de sa zone (pad-edit, pad-open, trk...), -1 aucune. */
  indexOf(hotspot: string): number {
    return FACE_KEYS.findIndex((k) => HOTSPOT[k.id] === hotspot);
  }

  /** Appui sur la touche i, v de 0 (repos) a 1 (enfoncee) : elle descend et s'eclaire (le Stage l'anime) ; EDIT, OPEN et TRK. */
  setPress(i: number, v: number, move: boolean): void {
    if (!LIVE(i)) return;
    this.press[i] = v;
    const dy = move ? -STEP_PRESS.depth * v : 0;
    this.keys.instanceMatrix.array[i * 16 + 13] = dy;
    this.keys.instanceMatrix.needsUpdate = true;
    this.leds.instanceMatrix.array[i * 16 + 13] = LED_Y + dy;
    this.leds.instanceMatrix.needsUpdate = true;
    this.labels.setDy(i, dy);
    this.refresh(i);
  }

  /** La touche sous la souris (l'id de sa zone, null aucune) : EDIT, OPEN et TRK s'eclairent un rien, les inertes non ; true s'il faut une frame. */
  setHover(id: string | null): boolean {
    const i = id === null ? -1 : this.indexOf(id);
    const k = i >= 0 && LIVE(i) ? i : -1;
    if (k === this.hover) return false;
    const was = this.hover;
    this.hover = k;
    if (was >= 0) this.refresh(was);
    if (k >= 0) this.refresh(k);
    return true;
  }

  /**
   * Les zones : trk (kind trk), pad-edit (edit), pad-open (open), scene-a et scene-b (scene, leur scene), xfade (toute la
   * fente et le capuchon). Les touches : leur pave ; EDIT et OPEN gardent les ids et les kinds de leurs pads (le MIDI
   * LEARN, les cartes INFOS, le focus du jumeau d'OPEN les lisent).
   */
  hotspots(layer: Object3D): HotspotDef[] {
    const K = FACE_KEY;
    const key = (id: FaceKeyId, x: number): HotspotDef => {
      const base = { id: HOTSPOT[id], layer, shape: 'box' as const, x, z: K.z, hx: K.w / 2, hz: K.d / 2, y0: 0, y1: K.h, enabled: true };
      if (id === 'edit') return { ...base, kind: 'edit' };
      if (id === 'open') return { ...base, kind: 'open' };
      if (id === 'trk') return { ...base, kind: 'trk' };
      return { ...base, kind: 'scene', scene: id === 'scene-a' ? 'a' : 'b' };
    };
    const x = (id: FaceKeyId): number => FACE_KEYS.find((k) => k.id === id)?.x ?? 0;
    return [
      key('trk', x('trk')),
      key('edit', x('edit')),
      key('open', x('open')),
      key('scene-a', x('scene-a')),
      { id: 'xfade', kind: 'xfade', layer, shape: 'box', x: XFADE.x, z: XFADE.z, hx: XFADE.slot.w / 2, hz: XFADE.cap.d / 2, y0: 0, y1: XFADE.cap.h, enabled: true },
      key('scene-b', x('scene-b')),
    ];
  }

  info(): RytmFaceKeysInfo {
    return {
      ids: FACE_KEYS.map((k) => k.id),
      lit: Array.from(this.fill, (v) => +v.toFixed(2)),
      glow: Array.from(this.glow, (v) => +v.toFixed(2)),
      leds: Array.from(this.level, (v) => +v.toFixed(2)),
      dark: this.labels.litState(),
      open: this.open,
      editing: this.editing,
      breathing: this.breathing,
      hover: this.hover >= 0 ? FACE_KEYS[this.hover].id : null,
      trk: this.trk,
    };
  }

  dispose(): void {
    this.keys.geometry.dispose();
    this.keyMat.dispose();
    this.keys.dispose();
    this.leds.geometry.dispose();
    this.ledMat.dispose();
    this.leds.dispose();
    this.labels.dispose();
    this.cap.geometry.dispose();
    this.capMat.dispose();
  }
}
