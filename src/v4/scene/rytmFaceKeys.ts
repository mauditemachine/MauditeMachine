/**
 * La rangee de touches de la face du MM-RYTM au desktop (V.5.0, 2026-10-29, l'etape D1 de la MM-RYTM facon Digitakt,
 * docs/v4/digitakt-d1-spec.md) : les quatorze touches FUNC TRK PTN REC PLAY STOP TRIG SRC FLTR AMP FX MOD YES NO (theme.ts
 * FACE_KEYS, rytm/faceplate.ts buttons), SCENE A et SCENE B, le capuchon du crossfader (theme.ts XFADE ; sa fente est
 * fusionnee au panneau, machine.ts), le cadre de la scene armee, l'ombre au pied de toutes les touches de la face et la
 * zone du logo M (OPEN, sans temoin : une lueur au survol). Le telephone garde ses pads, ses touches de page
 * (scene/rytmPageKeys.ts) et son transport (scene/sequencer3d.ts).
 *
 * Les couleurs de la Digitakt (theme.ts DT_HEX, KEY_LIT d*) : FUNC a son capuchon orange en permanence (legende noire),
 * son temoin blanc tenu, clignotant gardee ; une touche de page s'allume en rouge sur la page affichee (son temoin a peine
 * en vue HOME) ; REC rouge en mode ecriture ; PLAY vert en lecture, vert clignotant en pause ; STOP, YES et NO un eclair
 * blanc a l'appui ; TRK rouge tenue ou gardee (clignote gardee) ; PTN rouge tant que la grille des patterns ou KIT est
 * ouverte ; SCENE A et B en bleu, armees (la touche et son cadre), leur temoin suit ce qu'on en entend. Une touche allumee
 * a son dessus a la couleur de son temoin (KEY_LIT), son nom au noir ; le temoin reste l'accent, tire vers le blanc.
 * UN InstancedMesh pour les seize touches (SCENE A et B a l'echelle de leurs 12 mm), un pour leurs temoins (non eclaires),
 * un maillage pour leurs noms, un pour le capuchon, un pour les cadres, un pour l'ombre, un pour la lueur du logo.
 */

import { BoxGeometry, Color, DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Path, PlaneGeometry, Shape, ShapeGeometry, type BufferGeometry, type Object3D } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { APPEARANCE, COLOR, DT_HEX, DT_PAGE_KEYS, FACE_KEY, FACE_KEYS, HOVER_LIGHT, KEYS, KEY_LABELS, KEY_LIT, KEY_LIT_LIGHT, KEY_RELIEF, LIT, MATERIAL, PRESS_TINT, RING_TONE, SCENE_KEY, STEP_PRESS, XFADE, xfadeCapX, type DtTone, type FaceKeyId, type KeyLitTone } from '../theme';
import { faceplateParts, fpU, fpX, fpZ, rectCenter, RYTM_FACEPLATE } from '../rytm/faceplate';
import { keyCapGeometry, keySkirtGeometry } from './keyCap';
import type { HoldMode } from '../state/holdLatch';
import type { FuncMode } from '../state/func';
import type { HotspotDef, HotspotKind } from './hit';
import { KeyLabels, type KeyLabelAtlas } from './keyLabels';
import { paintLinear, paintSolid, withInstanceEmissive } from './materials';

const N = FACE_KEYS.length;
const at = (id: FaceKeyId): number => FACE_KEYS.findIndex((k) => k.id === id);
const FUNC = at('func');
const TRK = at('trk');
const PTN = at('ptn');
const REC = at('rec');
const PLAY = at('play');
const STOP = at('stop');
const YES = at('yes');
const NO = at('no');
const SCN_A = at('scene-a');
const SCN_B = at('scene-b');
/** Le rang des touches de page et leur page (theme.ts DT_PAGE_KEYS : TRIG, SRC la page voice, FLTR, AMP la page env, FX, MOD). */
const PAGE_KEYS = DT_PAGE_KEYS.map((p) => ({ page: p.id as string, i: at(p.btn) }));
const pageAt = (i: number): string | null => PAGE_KEYS.find((p) => p.i === i)?.page ?? null;
/** Les touches a un eclair blanc a l'appui (STOP, YES, NO). */
const FLASHED: ReadonlySet<number> = new Set([STOP, YES, NO]);

/** Le cadre d'une scene armee (2026-10-27) : 0.6 mm hors de la touche, un trait de 0.5 mm. */
const ARM_RING = { gap: fpU(0.6), line: fpU(0.5) } as const;
/** L'eclat du temoin d'une scene qui a des valeurs : 0.15 + 0.85 x ce qu'on en entend (1 - x pour A, x pour B). */
const SCENE_LED = { min: 0.15, span: 0.85 } as const;
/** Un temoin qui clignote (TRK gardee, FUNC gardee, PLAY en pause) : plein, puis ce reste. */
const BLINK_LOW = 0.12;
/** Le temoin de la page affichee en vue HOME : a peine, un rouge faible (le 0.32 d'avant). */
const HOME_LEVEL = 0.32;
/** Le capuchon orange de FUNC (V.5.0) : son eclat au repos, et engagee (tenue ou gardee). */
const FUNC_GLOW = { rest: 0.55, on: 1 } as const;
/** La lueur du logo M au survol (V.5.0) : son opacite, sa marge autour du logo. */
const LOGO_GLOW = { opacity: 0.16, pad: fpU(0.8) } as const;
/** SCENE A et B : leur echelle en x et en z, de la touche de la rangee (10.4 x 12) a leurs 12 x 12. */
const SCENE_SX = SCENE_KEY.w / FACE_KEY.w;
const SCENE_SZ = SCENE_KEY.d / FACE_KEY.d;

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
 * La jupe de toutes les touches de la face (V.4.2, 2026-10-27) : les quatorze de la rangee, SCENE A et B, les seize pas
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

/** Un rectangle arrondi (la recette de sequencer3d.ts), centre, hw et hd ses demi-cotes. */
function roundRect(p: Shape | Path, hw: number, hd: number, r: number): void {
  p.moveTo(-hw + r, -hd);
  p.lineTo(hw - r, -hd);
  p.quadraticCurveTo(hw, -hd, hw, -hd + r);
  p.lineTo(hw, hd - r);
  p.quadraticCurveTo(hw, hd, hw - r, hd);
  p.lineTo(-hw + r, hd);
  p.quadraticCurveTo(-hw, hd, -hw, hd - r);
  p.lineTo(-hw, -hd + r);
  p.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
}

/** Le cadre d'une scene armee : un rectangle arrondi autour de la touche (12 x 12), a plat sur le panneau. */
function armRingGeometry(): BufferGeometry {
  const K = SCENE_KEY;
  const r0 = FACE_KEY.radius;
  const g0 = ARM_RING.gap;
  const ln = ARM_RING.line;
  const outer = new Shape();
  roundRect(outer, K.w / 2 + g0 + ln, K.d / 2 + g0 + ln, r0 + g0 + ln);
  const hole = new Path();
  roundRect(hole, K.w / 2 + g0, K.d / 2 + g0, r0 + g0);
  outer.holes.push(hole);
  const g = new ShapeGeometry(outer, 6);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.004, 0);
  g.deleteAttribute('uv');
  return g;
}

/** La lueur du logo M (V.5.0) : un rectangle arrondi plein sur sa zone, a plat, juste au-dessus de la serigraphie. */
function logoGlowGeometry(): BufferGeometry {
  const r = RYTM_FACEPLATE.open.rect;
  const P = LOGO_GLOW.pad;
  const s = new Shape();
  roundRect(s, fpU(r.w) / 2 + P, fpU(r.h) / 2 + P, fpU(1.6));
  const g = new ShapeGeometry(s, 6);
  g.rotateX(-Math.PI / 2);
  g.translate(fpX(r.x + r.w / 2), 0.003, fpZ(r.y + r.h / 2));
  g.deleteAttribute('uv');
  return g;
}

/** z du temoin : sur le dessus, pres du bord arriere. */
const LED_Z = FACE_KEY.z - FACE_KEY.d / 2 + FACE_KEY.led.back;
const LED_Y = FACE_KEY.h + 0.002;

/** L'etat de PLAY (V.5.0) : a l'arret, en lecture, en pause (PLAY reprend au pas de la pause). */
export type PlayState = 'stop' | 'run' | 'pause';

/** Ce que montre une touche : la part allumee de son dessus et sa teinte, son eclat, son temoin et sa couleur. */
interface Look {
  fill: number;
  tone: KeyLitTone;
  glow: number;
  led: number;
  ledTone: DtTone;
}

export interface RytmFaceKeysInfo {
  ids: FaceKeyId[];
  /** chaque touche allumee en entier (0 a 1) */
  lit: number[];
  /** la teinte de chaque touche allumee (KEY_LIT : dred, dgreen, dwhite, dblue, dorange) */
  tones: KeyLitTone[];
  /** l'eclat du dessus d'une touche allumee (0 a 1) */
  glow: number[];
  /** l'eclat de chaque temoin (0 a 1) et sa couleur (DT_HEX : red, green, white, blue) */
  leds: number[];
  ledTones: DtTone[];
  /** le nom de chaque touche en noir (sur une touche allumee) */
  dark: boolean[];
  func: FuncMode;
  rec: boolean;
  play: PlayState;
  page: string | null;
  home: boolean;
  editing: boolean;
  hover: FaceKeyId | null;
  /** le logo M sous la souris (sa lueur) */
  logoHover: boolean;
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
  /** la lueur du logo M au survol (V.5.0) */
  readonly logo: Mesh;
  private skirtMat: MeshBasicMaterial;
  private ringMat: MeshBasicMaterial;
  private keyMat: MeshStandardMaterial;
  private ledMat: MeshBasicMaterial;
  private capMat: MeshStandardMaterial;
  private logoMat: MeshBasicMaterial;
  private emissive: InstancedBufferAttribute;
  private press = new Float32Array(N);
  private flashV = new Float32Array(N);
  private fill = new Float32Array(N);
  private glow = new Float32Array(N);
  private level = new Float32Array(N);
  private tone: KeyLitTone[] = new Array<KeyLitTone>(N).fill('dred');
  private ledTone: DtTone[] = new Array<DtTone>(N).fill('red');
  private hover = -1;
  private logoHot = false;
  private editing = false;
  private func: FuncMode = 'off';
  private rec = false;
  private play: PlayState = 'stop';
  private page: string | null = null;
  private home = false;
  /** TRK (2026-10-27) : son etat (state/trk.ts) */
  private trk: HoldMode = 'off';
  /** la phase du clignotement des temoins (1 : plein ; TRK et FUNC gardees, PLAY en pause) */
  private blinkOn = true;
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
  private ledColors = new Map<DtTone, Color>();

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
    FACE_KEYS.forEach((k, i) => this.keys.setMatrixAt(i, this.keyMatrix(i, k.x, 0, FACE_KEY.z)));
    this.keys.instanceMatrix.setUsage(DynamicDrawUsage);
    this.keys.instanceMatrix.needsUpdate = true;

    this.off.setHex(COLOR.line);
    this.ledMat = new MeshBasicMaterial({ toneMapped: false });
    this.ledMat.name = 'faceKeyLed';
    this.leds = new InstancedMesh(ledGeometry(), this.ledMat, N);
    this.leds.name = 'faceKeyLeds';
    FACE_KEYS.forEach((k, i) => this.leds.setMatrixAt(i, this.keyMatrix(i, k.x, LED_Y, LED_Z)));
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

    // La lueur du logo M (V.5.0) : l'orange de FUNC, tres doux, seulement au survol
    this.logoMat = new MeshBasicMaterial({ color: new Color(DT_HEX.orange), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.logoMat.name = 'logoGlow';
    this.logo = new Mesh(logoGlowGeometry(), this.logoMat);
    this.logo.name = 'logoGlow';
    this.logo.visible = false;

    for (let i = 0; i < N; i += 1) this.refresh(i);
    this.keys.instanceColor?.setUsage(DynamicDrawUsage);
    this.leds.instanceColor?.setUsage(DynamicDrawUsage);
  }

  /** La matrice de l'instance i (SCENE A et B : a l'echelle de leurs 12 x 12) a x, y, z. */
  private keyMatrix(i: number, x: number, y: number, z: number): Matrix4 {
    if (i === SCN_A || i === SCN_B) return m4.makeScale(SCENE_SX, 1, SCENE_SZ).setPosition(x, y, z);
    return m4.makeTranslation(x, y, z);
  }

  /** Les maillages a poser sur le plateau. */
  objects(): Object3D[] {
    return [this.skirt, this.keys, this.leds, this.labels.mesh, this.cap, this.armRing, this.logo];
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

  /** La phase du clignotement : plein, ou ce reste. */
  private get blinkLevel(): number {
    return this.blinkOn ? 1 : BLINK_LOW;
  }

  /** Ce que montre la touche i, selon l'etat de la machine (la langue des couleurs de la Digitakt). */
  private look(i: number): Look {
    const none: Look = { fill: 0, tone: 'dred', glow: 0, led: 0, ledTone: 'red' };
    if (i === FUNC) {
      // Le capuchon orange en permanence ; son temoin blanc : tenue, plein ; gardee (une tape, deux), il clignote
      const on = this.func !== 'off';
      return { fill: 1, tone: 'dorange', glow: on ? FUNC_GLOW.on : FUNC_GLOW.rest, led: this.func === 'held' ? 1 : on ? this.blinkLevel : 0, ledTone: 'white' };
    }
    if (i === TRK) return this.trk === 'off' ? none : { fill: 1, tone: 'dred', glow: 1, led: this.trk === 'latched' ? this.blinkLevel : 1, ledTone: 'red' };
    if (i === PTN) return this.editing ? { fill: 1, tone: 'dred', glow: 1, led: 1, ledTone: 'red' } : none;
    if (i === REC) return this.rec ? { fill: 1, tone: 'dred', glow: 1, led: 1, ledTone: 'red' } : none;
    if (i === PLAY) {
      if (this.play === 'run') return { fill: 1, tone: 'dgreen', glow: 1, led: 1, ledTone: 'green' };
      if (this.play === 'pause') {
        const b = this.blinkOn ? 1 : 0;
        return { fill: b, tone: 'dgreen', glow: b, led: this.blinkLevel, ledTone: 'green' };
      }
      return { ...none, ledTone: 'green' };
    }
    if (FLASHED.has(i)) {
      const f = this.flashV[i];
      return { fill: f, tone: 'dwhite', glow: f, led: f, ledTone: 'white' };
    }
    const pg = pageAt(i);
    if (pg) {
      if (this.page !== pg) return none;
      return this.home ? { ...none, led: HOME_LEVEL } : { fill: 1, tone: 'dred', glow: 1, led: 1, ledTone: 'red' };
    }
    // SCENE A et B (2026-10-27) : allumees en entier tant qu'armees ; leur temoin dit qu'elles ont des valeurs et combien on
    // en entend (eteint : la scene est vide) ; le bleu des scenes depuis V.5.0
    if (i === SCN_A) return { fill: this.armed === 'a' ? 1 : 0, tone: 'dblue', glow: this.armed === 'a' ? 1 : 0, led: this.sceneLed.a, ledTone: 'blue' };
    if (i === SCN_B) return { fill: this.armed === 'b' ? 1 : 0, tone: 'dblue', glow: this.armed === 'b' ? 1 : 0, led: this.sceneLed.b, ledTone: 'blue' };
    return none;
  }

  /** La couleur d'un temoin allume (DT_HEX, relue : l'apparence peut changer). */
  private ledColor(t: DtTone): Color {
    let c = this.ledColors.get(t);
    if (!c) {
      c = new Color(DT_HEX[t]);
      this.ledColors.set(t, c);
    }
    return c;
  }

  /** Repeint la touche i : son dessus, son temoin, son nom. */
  private refresh(i: number): void {
    const s = this.look(i);
    this.fill[i] = s.fill;
    this.glow[i] = s.glow;
    this.level[i] = s.led;
    this.tone[i] = s.tone;
    this.ledTone[i] = s.ledTone;
    // Le dessus : sa teinte (la machine claire la tire vers la couleur de l'appui et de la touche allumee)
    const b = LIT.clear;
    col.setRGB(b[0], b[1], b[2]);
    const t = PRESS_TINT.rgb;
    const v = this.press[i];
    if (t && v > 0) col.setRGB(b[0] + (t[0] - b[0]) * v, b[1] + (t[1] - b[1]) * v, b[2] + (t[2] - b[2]) * v);
    const lt = KEY_LIT_LIGHT.tint?.[s.tone];
    const f = s.fill;
    if (lt && f > 0) col.setRGB(col.r + (lt[0] - col.r) * f, col.g + (lt[1] - col.g) * f, col.b + (lt[2] - col.b) * f);
    this.keys.setColorAt(i, col);
    if (this.keys.instanceColor) this.keys.instanceColor.needsUpdate = true;
    // L'eclat : l'appui, la touche allumee, le survol
    const e = this.emissive.array as Float32Array;
    const g = KEY_LIT.glow[s.tone];
    const h = i === this.hover ? 1 : 0;
    for (let c = 0; c < 3; c += 1) e[i * 3 + c] = Math.max(STEP_PRESS.glow[c] * v, g[c] * KEY_LIT_LIGHT.glow * s.glow, HOVER_LIGHT.glow[c] * h);
    this.emissive.needsUpdate = true;
    // Le temoin : eteint, une fente ; allume, sa couleur ; sur une touche allumee, tire vers le blanc (il reste l'accent)
    col.copy(this.off).lerp(this.ledColor(s.ledTone), s.led);
    if (f > 0) col.lerp(WHITE, KEY_LIT.ledWhite * f);
    this.leds.setColorAt(i, col);
    if (this.leds.instanceColor) this.leds.instanceColor.needsUpdate = true;
    this.labels.setLit(i, f > KEY_LIT.dark);
  }

  /** FUNC (V.5.0, state/func.ts) : off, tenue, gardee pour une touche, gardee ; true s'il faut une frame. */
  setFunc(mode: FuncMode): boolean {
    if (FUNC < 0 || mode === this.func) return false;
    this.func = mode;
    this.refresh(FUNC);
    return true;
  }

  /** PTN allumee tant que la grille des patterns (EDIT) ou KIT (les presets) est ouverte ; true s'il faut une frame. */
  setEditing(on: boolean): boolean {
    if (on === this.editing) return false;
    this.editing = on;
    this.refresh(PTN);
    return true;
  }

  /** REC (V.5.0, state/dtFace.ts) : rouge en mode ecriture ; true s'il faut une frame. */
  setRec(on: boolean): boolean {
    if (on === this.rec) return false;
    this.rec = on;
    this.refresh(REC);
    return true;
  }

  /** PLAY (V.5.0) : vert en lecture, vert clignotant en pause ; true s'il faut une frame. */
  setPlay(p: PlayState): boolean {
    if (p === this.play) return false;
    this.play = p;
    this.refresh(PLAY);
    return true;
  }

  /** La page affichee (rytm/pages.ts RytmPageId) et la vue : sa touche s'allume en rouge (a peine en HOME) ; true s'il faut une frame. */
  setPage(page: string | null, home: boolean): boolean {
    if (page === this.page && home === this.home) return false;
    this.page = page;
    this.home = home;
    for (const p of PAGE_KEYS) if (p.i >= 0) this.refresh(p.i);
    return true;
  }

  /** L'eclair blanc d'une touche (STOP, YES, NO), v de 1 (l'appui) a 0 (le Stage l'anime). */
  setFlash(hotspot: string, v: number): void {
    const i = this.indexOf(hotspot);
    if (i < 0 || !FLASHED.has(i)) return;
    this.flashV[i] = Math.max(0, Math.min(1, v));
    this.refresh(i);
  }

  /** TRK (2026-10-27) : allumee tant qu'elle est engagee ; true s'il faut une frame. */
  setTrk(mode: HoldMode): boolean {
    if (TRK < 0 || mode === this.trk) return false;
    this.trk = mode;
    this.refresh(TRK);
    return true;
  }

  /** Un temoin clignote-t-il (TRK gardee, FUNC gardee, PLAY en pause, une scene gardee) : il a besoin de la boucle. */
  get blinking(): boolean {
    return this.trk === 'latched' || this.func === 'once' || this.func === 'locked' || this.play === 'pause' || this.armHow === 'latched';
  }

  /** Le clignotement (periodMs allume, periodMs a peine) des temoins et du cadre d'une scene gardee ; true si la phase a change. */
  blink(now: number, periodMs: number): boolean {
    if (!this.blinking) return false;
    const on = Math.floor(now / periodMs) % 2 === 0;
    let changed = false;
    if (on !== this.blinkOn) {
      this.blinkOn = on;
      for (const i of [TRK, FUNC, PLAY]) if (i >= 0) this.refresh(i);
      changed = true;
    }
    if (this.armHow === 'latched') {
      const v = on ? 1 : 0;
      if (v !== this.armBlink) {
        this.armBlink = v;
        this.placeRings();
        changed = true;
      }
    }
    return changed;
  }

  /** TRK gardee : son temoin a besoin de la boucle (l'API d'avant V.5.0, lue par le Stage). */
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

  /** Une scene gardee : son cadre a besoin de la boucle (l'API d'avant V.5.0). */
  get sceneBlinking(): boolean {
    return this.armHow === 'latched';
  }

  /** Le capot ouvert : depuis V.5.0 le logo M l'ouvre, sans temoin ; rien a peindre. */
  setOpen(_on: boolean): boolean {
    return false;
  }

  /** OPEN ne respire plus au desktop (V.5.0 : le logo M, sans temoin). */
  get breathing(): boolean {
    return false;
  }

  breathe(_now: number): boolean {
    return false;
  }

  stopBreath(): boolean {
    return false;
  }

  /** Le rang d'une touche par l'id de sa zone (pad-edit, run, pkey-voice, trk...), -1 aucune. */
  indexOf(hotspot: string): number {
    return FACE_KEYS.findIndex((k) => k.hotspot === hotspot);
  }

  /** Appui sur la touche i, v de 0 (repos) a 1 (enfoncee) : elle descend et s'eclaire (le Stage l'anime). */
  setPress(i: number, v: number, move: boolean): void {
    if (i < 0 || i >= N) return;
    this.press[i] = v;
    const dy = move ? -KEY_RELIEF.key * v : 0;
    this.keys.instanceMatrix.array[i * 16 + 13] = dy;
    this.keys.instanceMatrix.needsUpdate = true;
    this.leds.instanceMatrix.array[i * 16 + 13] = LED_Y + dy;
    this.leds.instanceMatrix.needsUpdate = true;
    this.labels.setDy(i, dy);
    this.refresh(i);
  }

  /** La commande sous la souris (l'id de sa zone, null aucune) : une touche s'eclaire un rien, le logo luit ; true s'il faut une frame. */
  setHover(id: string | null): boolean {
    // Le capuchon du crossfader (P2-20) : un peu plus clair sous la souris, comme un potard
    const cap = id === 'xfade';
    let changed = false;
    if (cap !== this.capHot) {
      this.capHot = cap;
      this.capMat.color.setScalar(cap ? HOVER_LIGHT.knob : 1);
      changed = true;
    }
    // Le logo M (V.5.0) : sa lueur
    const logo = id === RYTM_FACEPLATE.open.hotspot;
    if (logo !== this.logoHot) {
      this.logoHot = logo;
      this.logo.visible = logo;
      this.logoMat.opacity = logo ? LOGO_GLOW.opacity : 0;
      changed = true;
    }
    const k = id === null ? -1 : this.indexOf(id);
    if (k === this.hover) return changed;
    const was = this.hover;
    this.hover = k;
    if (was >= 0) this.refresh(was);
    if (k >= 0) this.refresh(k);
    return true;
  }

  /**
   * Les zones : chaque touche par l'id de sa zone (rytm/faceplate.ts hotspot ; les ids gardes : trk, pad-edit, run,
   * pkey-voice...), son kind (func, trk, edit, rec, run, stop, pkey et sa page, yes, no, scene et sa scene) ; xfade (toute
   * la fente et le capuchon) ; pad-open (kind open), le logo M. Dans l'ordre de la rangee.
   */
  hotspots(layer: Object3D): HotspotDef[] {
    const K = FACE_KEY;
    const KIND: Readonly<Partial<Record<FaceKeyId, HotspotKind>>> = { func: 'func', trk: 'trk', ptn: 'edit', rec: 'rec', play: 'run', stop: 'stop', yes: 'yes', no: 'no' };
    const out: HotspotDef[] = [];
    FACE_KEYS.forEach((k, i) => {
      const scene = k.id === 'scene-a' ? 'a' : k.id === 'scene-b' ? 'b' : null;
      const base = { id: k.hotspot, layer, shape: 'box' as const, x: k.x, z: K.z, hx: (scene ? SCENE_KEY.w : K.w) / 2, hz: (scene ? SCENE_KEY.d : K.d) / 2, y0: 0, y1: K.h, enabled: true };
      if (scene) {
        // Le crossfader entre SCENE A et SCENE B, dans l'ordre de lecture
        if (scene === 'b') out.push({ id: 'xfade', kind: 'xfade', layer, shape: 'box', x: XFADE.x, z: XFADE.z, hx: XFADE.slot.w / 2, hz: XFADE.cap.d / 2, y0: 0, y1: XFADE.cap.h, enabled: true });
        out.push({ ...base, kind: 'scene', scene });
        return;
      }
      const pg = pageAt(i);
      if (pg) {
        out.push({ ...base, kind: 'pkey', rpage: pg });
        return;
      }
      out.push({ ...base, kind: KIND[k.id] ?? 'trk' });
    });
    // Le logo M (V.5.0) : OPEN, sur toute sa zone, a plat sur la face
    const r = RYTM_FACEPLATE.open.rect;
    out.push({ id: RYTM_FACEPLATE.open.hotspot, kind: 'open', layer, shape: 'box', x: fpX(r.x + r.w / 2), z: fpZ(r.y + r.h / 2), hx: fpU(r.w) / 2, hz: fpU(r.h) / 2, y0: 0, y1: 0.01, enabled: true });
    return out;
  }

  info(): RytmFaceKeysInfo {
    return {
      ids: FACE_KEYS.map((k) => k.id),
      lit: Array.from(this.fill, (v) => +v.toFixed(2)),
      tones: [...this.tone],
      glow: Array.from(this.glow, (v) => +v.toFixed(2)),
      leds: Array.from(this.level, (v) => +v.toFixed(2)),
      ledTones: [...this.ledTone],
      dark: this.labels.litState(),
      func: this.func,
      rec: this.rec,
      play: this.play,
      page: this.page,
      home: this.home,
      editing: this.editing,
      hover: this.hover >= 0 ? FACE_KEYS[this.hover].id : null,
      logoHover: this.logoHot,
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
    this.logo.geometry.dispose();
    this.logoMat.dispose();
  }
}
