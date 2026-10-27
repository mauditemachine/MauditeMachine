/**
 * Les touches de la face V.4.0 du MM-RYTM qui ne sont ni des touches de page
 * ni le transport (2026-10-27, Mika : "faceplate Octatrack x Digitakt ; les 10
 * grands pads disparaissent, EDIT et OPEN sont dans la rangee des
 * pictogrammes ; SCENE A, la fente du crossfader, SCENE B") : TRK, EDIT,
 * OPEN, SCENE A et SCENE B (theme.ts FACE_KEYS : la forme des touches de page,
 * 12 x 12 mm), leur nom (V.4.2, 2026-10-27, facon Digitakt) ou leur lettre
 * imprime dessus (scene/keyLabels.ts), et le capuchon du crossfader (theme.ts XFADE ; sa fente
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

import { BoxGeometry, Color, DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Path, PlaneGeometry, Shape, ShapeGeometry, type BufferGeometry, type Object3D } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { APPEARANCE, COLOR, FACE_KEY, FACE_KEYS, HOVER_LIGHT, KEYS, KEY_LABELS, KEY_LIT, KEY_LIT_LIGHT, KEY_RELIEF, LIT, MATERIAL, OPEN_BREATHE, PRESS_TINT, RING_TONE, STEP_PRESS, XFADE, xfadeCapX, type FaceKeyId } from '../theme';
import { faceplateParts, fpU, rectCenter, RYTM_FACEPLATE } from '../rytm/faceplate';
import { keyCapGeometry, keySkirtGeometry } from './keyCap';
import type { HoldMode } from '../state/holdLatch';
import type { HotspotDef } from './hit';
import { KeyLabels, type KeyLabelAtlas } from './keyLabels';
import { paintLinear, paintSolid, withInstanceEmissive } from './materials';

const N = FACE_KEYS.length;
const EDIT = FACE_KEYS.findIndex((k) => k.id === 'edit');
const OPEN = FACE_KEYS.findIndex((k) => k.id === 'open');
const TRK = FACE_KEYS.findIndex((k) => k.id === 'trk');
const SCN_A = FACE_KEYS.findIndex((k) => k.id === 'scene-a');
const SCN_B = FACE_KEYS.findIndex((k) => k.id === 'scene-b');
/** Les touches qui agissent (s'enfoncent, s'eclairent au survol) : EDIT, OPEN, TRK, SCENE A et B depuis la phase 2 (2026-10-27). */
const LIVE = (i: number): boolean => i === EDIT || i === OPEN || i === TRK || i === SCN_A || i === SCN_B;
/** Le cadre d'une scene armee (2026-10-27) : 0.6 mm hors de la touche, un trait de 0.5 mm. */
const ARM_RING = { gap: fpU(0.6), line: fpU(0.5) } as const;
/** L'eclat du temoin d'une scene qui a des valeurs : 0.15 + 0.85 x ce qu'on en entend (1 - x pour A, x pour B). */
const SCENE_LED = { min: 0.15, span: 0.85 } as const;
/** TRK gardee (2026-10-27) : son temoin clignote entre plein et ce reste (le 0.12 de MUTE et SOLO en attente). */
const TRK_BLINK_LOW = 0.12;
/** L'id de la zone de saisie (et du jumeau) de chaque touche : EDIT et OPEN gardent ceux de leurs pads. */
const HOTSPOT: Readonly<Record<FaceKeyId, string>> = { trk: 'trk', edit: 'pad-edit', open: 'pad-open', 'scene-a': 'scene-a', 'scene-b': 'scene-b' };
/** Le temoin d'OPEN capot ouvert : a peine (l'orangeDim du pad d'avant). */
const OPEN_DIM = 0.3;

const m4 = new Matrix4();
const col = new Color();
const WHITE = new Color(1, 1, 1);

/** La touche de la face : en relief au desktop (V.4.2, scene/keyCap.ts : flancs, chanfrein, l'ombre du pied). */
function keyGeometry(mobile: boolean): BufferGeometry {
  const K = FACE_KEY;
  if (KEY_RELIEF.on) return keyCapGeometry(K.w, K.h, K.d, K.radius, K.bevel, KEY_RELIEF.seg, KEY_RELIEF.shade);
  const g = new RoundedBoxGeometry(K.w, K.h, K.d, mobile ? KEYS.segments.mobile : KEYS.segments.desktop, K.radius);
  g.translate(0, K.h / 2, 0);
  g.deleteAttribute('uv');
  return g;
}

/**
 * La jupe de toutes les touches de la face (V.4.2, 2026-10-27) : les douze de la rangee, SCENE A et B, les seize pas
 * (rytm/faceplate.ts faceplateParts) ; l'ombre douce a leur pied, un seul maillage, une seule fois.
 */
function skirtGeometry(): BufferGeometry {
  const keys = faceplateParts()
    .filter((p) => p.kind === 'button' || p.kind === 'scene' || p.kind === 'step')
    .map((p) => {
      const c = rectCenter(p.rect);
      const corner = p.kind === 'step' ? RYTM_FACEPLATE.steps.corner : RYTM_FACEPLATE.buttons.corner;
      return { x: c.x, z: c.z, w: fpU(p.rect.w), d: fpU(p.rect.h), radius: fpU(corner) };
    });
  const S = KEY_RELIEF.skirt;
  return keySkirtGeometry(keys, S.w, S.alpha[APPEARANCE.current === 'light' ? 'light' : 'dark'], S.y, KEY_RELIEF.seg);
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

/** Le cadre d'une scene armee : un rectangle arrondi autour de la touche, a plat sur le panneau (la recette de sequencer3d.ts). */
function armRingGeometry(): BufferGeometry {
  const K = FACE_KEY;
  const rr = (p: Shape | Path, hw: number, hd: number, r: number): void => {
    p.moveTo(-hw + r, -hd);
    p.lineTo(hw - r, -hd);
    p.quadraticCurveTo(hw, -hd, hw, -hd + r);
    p.lineTo(hw, hd - r);
    p.quadraticCurveTo(hw, hd, hw - r, hd);
    p.lineTo(-hw + r, hd);
    p.quadraticCurveTo(-hw, hd, -hw, hd - r);
    p.lineTo(-hw, -hd + r);
    p.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  };
  const g0 = ARM_RING.gap;
  const ln = ARM_RING.line;
  const outer = new Shape();
  rr(outer, K.w / 2 + g0 + ln, K.d / 2 + g0 + ln, K.radius + g0 + ln);
  const hole = new Path();
  rr(hole, K.w / 2 + g0, K.d / 2 + g0, K.radius + g0);
  outer.holes.push(hole);
  const g = new ShapeGeometry(outer, 6);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.004, 0);
  g.deleteAttribute('uv');
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
  /** la scene armee (2026-10-27) et comment (held, latched) */
  armed: 'a' | 'b' | null;
  armHow: 'held' | 'latched' | null;
  /** le cadre de la scene armee allume (le clignotement d'une scene gardee compris) */
  ringOn: boolean;
  /** le crossfader (0 cote A) et la position du capuchon (x) */
  x: number;
  capX: number;
  /** le capuchon eclaire par le survol (2026-10-27, P2-20) */
  capHover: boolean;
}

export class RytmFaceKeys {
  readonly keys: InstancedMesh;
  readonly leds: InstancedMesh;
  readonly labels: KeyLabels;
  /** le capuchon du crossfader (2026-10-27, P2-20 : il suit x, de A a gauche a B a droite) */
  readonly cap: Mesh;
  /** le cadre d'une scene armee (2026-10-27) : deux instances, A et B, a l'echelle 0 hors armement */
  readonly armRing: InstancedMesh;
  /** la jupe de toutes les touches de la face (V.4.2 : l'ombre a leur pied) */
  readonly skirt: Mesh;
  private skirtMat: MeshBasicMaterial;
  private ringMat: MeshBasicMaterial;
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
  /** la phase du clignotement de TRK gardee (1 : plein) */
  private trkBlink = 1;
  /** la respiration d'OPEN machine fermee (1 : pleine) */
  private breath = 1;
  /** la scene armee (2026-10-27), comment, la phase du clignotement de son cadre (gardee) */
  private armed: 'a' | 'b' | null = null;
  private armHow: 'held' | 'latched' | null = null;
  private armBlink = 1;
  /** l'eclat des temoins de SCENE A et B (0 : la scene est vide) */
  private sceneLed = { a: 0, b: 0 };
  private xNow = 0;
  /** le capuchon sous la souris (P2-20) */
  private capHot = false;
  private off = new Color();
  private on = new Color();

  constructor(opts: { mobile: boolean; atlas: KeyLabelAtlas; castShadow: boolean }) {
    const g = keyGeometry(opts.mobile);
    this.emissive = new InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.emissive.setUsage(DynamicDrawUsage);
    g.setAttribute('instanceEmissive', this.emissive);
    this.keyMat = withInstanceEmissive(new MeshStandardMaterial({ ...MATERIAL.key, vertexColors: KEY_RELIEF.on }), KEY_RELIEF.on);
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
    // A l'arrivee, x 0 : le bout de la scene A (2026-10-27, P2-20 ; au milieu de sa course en phase 1)
    this.cap.position.set(xfadeCapX(0), 0, XFADE.z);
    this.cap.castShadow = opts.castShadow;
    this.cap.receiveShadow = true;

    this.ringMat = new MeshBasicMaterial({ toneMapped: false, color: new Color(RING_TONE.scene.on) });
    this.ringMat.name = 'sceneArmRing';
    this.armRing = new InstancedMesh(armRingGeometry(), this.ringMat, 2);
    this.armRing.name = 'sceneArmRing';
    this.armRing.instanceMatrix.setUsage(DynamicDrawUsage);
    this.placeRings();

    // La jupe (V.4.2) : noire et transparente, par-dessus la face et sous les touches (rien ne s'ecrit dans la profondeur)
    this.skirtMat = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.skirtMat.name = 'keySkirt';
    this.skirt = new Mesh(skirtGeometry(), this.skirtMat);
    this.skirt.name = 'keySkirt';
    this.skirt.renderOrder = -1;

    for (let i = 0; i < N; i += 1) this.refresh(i);
    this.keys.instanceColor?.setUsage(DynamicDrawUsage);
    this.leds.instanceColor?.setUsage(DynamicDrawUsage);
  }

  /** Les maillages a poser sur le plateau. */
  objects(): Object3D[] {
    return [this.skirt, this.keys, this.leds, this.labels.mesh, this.cap, this.armRing];
  }

  /** Les deux cadres a leur touche, a l'echelle 0 sauf celui de la scene armee (allume, ou dans sa phase allumee). */
  private placeRings(): void {
    const on = this.ringOn;
    [SCN_A, SCN_B].forEach((i, j) => {
      const k = FACE_KEYS[i];
      const show = on && this.armed === (j === 0 ? 'a' : 'b');
      m4.makeScale(show ? 1 : 0, show ? 1 : 0, show ? 1 : 0);
      m4.setPosition(k ? k.x : 0, 0, FACE_KEY.z);
      this.armRing.setMatrixAt(j, m4);
    });
    this.armRing.instanceMatrix.needsUpdate = true;
  }

  private get ringOn(): boolean {
    return this.armed !== null && (this.armHow !== 'latched' || this.armBlink === 1);
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
    // TRK engagee (tenue, gardee, en fermeture) : allumee en entier ; son temoin fixe, il clignote quand elle est gardee
    if (i === TRK) return this.trk === 'off' ? { fill: 0, glow: 0, led: 0 } : { fill: 1, glow: 1, led: this.trk === 'latched' ? this.trkBlink : 1 };
    // SCENE A et B (2026-10-27) : allumees en entier tant qu'armees ; leur temoin dit qu'elles ont des valeurs et combien on
    // en entend (eteint : la scene est vide)
    if (i === SCN_A) return this.armed === 'a' ? { fill: 1, glow: 1, led: this.sceneLed.a } : { fill: 0, glow: 0, led: this.sceneLed.a };
    if (i === SCN_B) return this.armed === 'b' ? { fill: 1, glow: 1, led: this.sceneLed.b } : { fill: 0, glow: 0, led: this.sceneLed.b };
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
    this.trk = mode;
    this.trkBlink = 1;
    this.refresh(TRK);
    return true;
  }

  /** TRK gardee : son temoin clignote (periodMs allume, periodMs a peine) ; true si la phase a change. */
  blinkTrk(now: number, periodMs: number): boolean {
    if (this.trk !== 'latched') return false;
    const v = Math.floor(now / periodMs) % 2 === 0 ? 1 : TRK_BLINK_LOW;
    if (v === this.trkBlink) return false;
    this.trkBlink = v;
    this.refresh(TRK);
    return true;
  }

  /** TRK gardee : son temoin a besoin de la boucle. */
  get trkBlinking(): boolean {
    return this.trk === 'latched';
  }

  /** La scene armee (2026-10-27) et comment : sa touche allumee, son cadre (fixe tenue, clignotant gardee) ; true s'il faut une frame. */
  setScene(armed: 'a' | 'b' | null, how: 'held' | 'latched' | null): boolean {
    if (armed === this.armed && how === this.armHow) return false;
    this.armed = armed;
    this.armHow = how;
    this.armBlink = 1;
    this.placeRings();
    this.refresh(SCN_A);
    this.refresh(SCN_B);
    return true;
  }

  /** Les temoins des scenes : a, b ont-elles des valeurs, x le crossfader ; true s'il faut une frame. */
  setSceneLeds(a: boolean, b: boolean, x: number): boolean {
    this.xNow = x;
    const la = a ? SCENE_LED.min + SCENE_LED.span * (1 - x) : 0;
    const lb = b ? SCENE_LED.min + SCENE_LED.span * x : 0;
    if (la === this.sceneLed.a && lb === this.sceneLed.b) return false;
    this.sceneLed.a = la;
    this.sceneLed.b = lb;
    this.refresh(SCN_A);
    this.refresh(SCN_B);
    return true;
  }

  /** Le capuchon du crossfader a x (P2-20, 0 la scene A, 1 la scene B) ; true s'il faut une frame. */
  setXfade(x: number): boolean {
    const px = xfadeCapX(x);
    if (this.cap.position.x === px) return false;
    this.cap.position.x = px;
    return true;
  }

  /** Une scene gardee : son cadre clignote (periodMs allume, periodMs eteint) ; true si la phase a change. */
  blinkScene(now: number, periodMs: number): boolean {
    if (this.armHow !== 'latched') return false;
    const v = Math.floor(now / periodMs) % 2 === 0 ? 1 : 0;
    if (v === this.armBlink) return false;
    this.armBlink = v;
    this.placeRings();
    return true;
  }

  /** Une scene gardee : son cadre a besoin de la boucle. */
  get sceneBlinking(): boolean {
    return this.armHow === 'latched';
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
    const dy = move ? -KEY_RELIEF.key * v : 0;
    this.keys.instanceMatrix.array[i * 16 + 13] = dy;
    this.keys.instanceMatrix.needsUpdate = true;
    this.leds.instanceMatrix.array[i * 16 + 13] = LED_Y + dy;
    this.leds.instanceMatrix.needsUpdate = true;
    this.labels.setDy(i, dy);
    this.refresh(i);
  }

  /** La touche sous la souris (l'id de sa zone, null aucune) : EDIT, OPEN et TRK s'eclairent un rien, les inertes non ; true s'il faut une frame. */
  setHover(id: string | null): boolean {
    // Le capuchon du crossfader (P2-20) : un peu plus clair sous la souris, comme un potard
    const cap = id === 'xfade';
    let capChanged = false;
    if (cap !== this.capHot) {
      this.capHot = cap;
      this.capMat.color.setScalar(cap ? HOVER_LIGHT.knob : 1);
      capChanged = true;
    }
    const i = id === null ? -1 : this.indexOf(id);
    const k = i >= 0 && LIVE(i) ? i : -1;
    if (k === this.hover) return capChanged;
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
      armed: this.armed,
      armHow: this.armHow,
      ringOn: this.ringOn,
      x: this.xNow,
      capX: +this.cap.position.x.toFixed(6),
      capHover: this.capHot,
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
    this.armRing.geometry.dispose();
    this.ringMat.dispose();
    this.armRing.dispose();
    this.skirt.geometry.dispose();
    this.skirtMat.dispose();
  }
}
