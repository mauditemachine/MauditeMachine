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
 * UN InstancedMesh pour les quatorze touches de la rangee, un pour SCENE A et B (leur touche a elles, 12 x 12 : la revue de
 * D1, R9, l'echelle de la touche de 10.4 etirait le chanfrein, les coins et le temoin), un pour les seize temoins (non
 * eclaires, tous a la taille de la rangee), un maillage pour leurs noms, un pour le capuchon, un pour les cadres, un pour
 * l'ombre, un pour la lueur du logo.
 *
 * La face DT2 (V.6.0, 2026-10-30, ?face=dt2, docs/v4/dt2/dt2-master-spec.md 2.2 a 2.4, la lane B3) : les 25 touches de la
 * Digitakt II a leur place (theme.ts FACE_KEYS : x, z, w, d par touche), UN InstancedMesh par classe de touches (P 12 x 11,
 * L 22 x 11, G la touche PAGE 26 x 11 : la lecon R9, une geometrie par taille), un z par touche (le temoin et le nom
 * aussi) ; plus de scenes ni de crossfader (cahier 1.3) ; les 8 LED de page dans leur fenetre en creux (setPatternPages) ;
 * les looks de 2.4 pour les touches nouvelles (setKeyboard, setSong, setMenu, setPerform, setFill, setBank, setRecMode,
 * setPageLocks ; un eclair blanc a l'appui de toute touche, flashFaceKey). Les zones des onze touches nouvelles vivent dans
 * le registre scene/zones/face60.ts ; ici les touches de la V.5.3 (leurs ids gardes) et le logo M. Sans le drapeau, le
 * chemin de la V.5.3, au pixel pres.
 */

import { BoxGeometry, CircleGeometry, Color, DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Path, PlaneGeometry, Shape, ShapeGeometry, type BufferGeometry, type Object3D } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { APPEARANCE, COLOR, KEYS_LIGHT, PLUGIN, DT2_FACE, DT_HEX, DT_HEX_DARK, DT_PAGE_KEYS, FACE_KEY, FACE_KEY_CLASS, FACE_KEYS, FP_OPEN, GAIN, HOVER_LIGHT, KEYS, KEY_LABELS, KEY_LIT, KEY_LIT_LIGHT, KEY_RELIEF, LIT, MATERIAL, PAGE_LED_TONE, PAGE_LEDS, PRESS_TINT, RING_TONE, SCENE_KEY, STEP_PRESS, XFADE, xfadeCapX, type DtTone, type FaceKeyClass, type FaceKeyId, type KeyLitTone } from '../theme';
import { DT2_FACEPLATE, dt2FaceplateParts, faceplateParts, fpU, fpX, fpZ, rectCenter, RYTM_FACEPLATE } from '../rytm/faceplate';
import { keyCapGeometry, keySkirtGeometry } from './keyCap';
import type { HoldMode } from '../state/holdLatch';
import type { FuncMode } from '../state/func';
import type { LedIntensity } from '../state/dtFace';
import type { HotspotDef, HotspotKind } from './hit';
import { KeyLabels, type KeyLabelAtlas } from './keyLabels';
import { paintLinear, paintSolid, withInstanceEmissive } from './materials';

const N = FACE_KEYS.length;
const at = (id: FaceKeyId): number => FACE_KEYS.findIndex((k) => k.id === id);
const FUNC = at('func');
// Le plugin (2026-11-10, Mika : le rouge et le jaune orange) : PLAY et MUTE au jaune orange, le vert de la DT2 sur le site
const GO_TONE: KeyLitTone = PLUGIN ? 'dorange' : 'dgreen';
const GO_LED: DtTone = PLUGIN ? 'orange' : 'green';
const TRK = at('trk');
const PTN = at('ptn');
const REC = at('rec');
const PLAY = at('play');
const STOP = at('stop');
const YES = at('yes');
const NO = at('no');
const SCN_A = at('scene-a');
const SCN_B = at('scene-b');
/** La face DT2 (V.6.0) : ses touches nouvelles (-1 sur la face de la V.5.3). */
const KBD = at('kbd');
const MUTE = at('mute');
const SOLO = at('solo');
const OPEN = at('open');
const PRESET = at('preset');
const SETTINGS = at('settings');
const SOUNDS = at('sounds');
const TEMPO = at('tempo');
const PTNPAGE = at('ptnpage');
const ARROWS: readonly number[] = (['up', 'down', 'left', 'right'] as const).map(at).filter((i) => i >= 0);
/** Les scenes et le crossfader sont-ils sur la face ? */
const HAS_SCENES = SCN_A >= 0 && SCN_B >= 0;
/** Le rang des touches de page et leur page (theme.ts DT_PAGE_KEYS : TRIG, SRC la page voice, FLTR, AMP la page env, FX, MOD). */
const PAGE_KEYS = DT_PAGE_KEYS.map((p) => ({ page: p.id as string, i: at(p.btn) }));
const pageAt = (i: number): string | null => PAGE_KEYS.find((p) => p.i === i)?.page ?? null;
/** Les touches a un eclair blanc a l'appui (STOP, YES, NO ; la face DT2 : les fleches aussi, cahier 2.4). */
const FLASHED: ReadonlySet<number> = new Set([STOP, YES, NO, ...ARROWS].filter((i) => i >= 0));
/** Les menus d'une touche de la face DT2 (cahier 2.4 : rouge tant que le menu ou la liste est ouvert). */
export type FaceMenu = 'preset' | 'settings' | 'sounds' | 'tempo';
const MENU_KEY: Readonly<Record<FaceMenu, number>> = { preset: PRESET, settings: SETTINGS, sounds: SOUNDS, tempo: TEMPO };
/** REC sur la face DT2 (cahier 2.4) : GRID rouge fixe, LIVE rouge clignotant, STEP rouge double clignotement, euclidien bleu. */
export type RecMode = 'off' | 'grid' | 'live' | 'step' | 'euclid';

/** Le cadre d'une scene armee (2026-10-27) : 0.6 mm hors de la touche, un trait de 0.5 mm. */
const ARM_RING = { gap: fpU(0.6), line: fpU(0.5) } as const;
/** L'eclat du temoin d'une scene qui a des valeurs : 0.15 + 0.85 x ce qu'on en entend (1 - x pour A, x pour B). */
const SCENE_LED = { min: 0.15, span: 0.85 } as const;
/** Un temoin qui clignote (TRK gardee, FUNC gardee, PLAY en pause) : plein, puis ce reste. */
const BLINK_LOW = 0.12;
/** Le double clignotement de la face DT2 (cahier 2.4) : deux eclairs de flashMs toutes les periodMs. */
const DOUBLE_BLINK = { periodMs: 600, flashMs: 80 } as const;
/** Le temoin de la page affichee en vue HOME : a peine, un rouge faible (le 0.32 d'avant). */
const HOME_LEVEL = 0.32;
/** Le capuchon orange de FUNC (V.5.0) : son eclat au repos, et engagee (tenue ou gardee). */
const FUNC_GLOW = { rest: 0.55, on: 1 } as const;
/**
 * Le temoin d'une touche allumee sur la machine creme (la revue de D1, R1) : eteint, une lentille sombre (la fente claire du
 * panneau semblait allumee sur le capuchon orange de FUNC) ; blanc, de la vraie lumiere blanche (l'encre sombre de la creme
 * grisait FUNC tenue). Comme la machine noire : eteint sombre, allume clair.
 */
const LED_LIT_KEY_LIGHT = { off: 0x5e5248 } as const;
/** La lueur du logo M au survol (V.5.0) : son opacite, sa marge autour du logo. */
const LOGO_GLOW = { opacity: 0.16, pad: fpU(0.8) } as const;
/** SCENE A et B : leur place dans le maillage de leurs touches (0, 1), -1 pour une touche de la rangee. */
const sceneSlot = (i: number): number => (i === SCN_A ? 0 : i === SCN_B ? 1 : -1);

/**
 * Les maillages des touches et la place de chaque touche dans le sien. La V.5.3 : celui de la rangee porte les seize (SCENE
 * A et B a l'echelle 0), celui des scenes les deux scenes ; la face DT2 : un maillage par classe (P, L, G).
 */
const CLASSES: readonly FaceKeyClass[] = DT2_FACE ? (['P', 'L', 'G', 'A', 'scene'] as const).filter((c) => FACE_KEYS.some((k) => k.cls === c)) : ['row', 'scene'];
/** La touche i : son maillage (le rang dans CLASSES) et son instance dans ce maillage. */
const SLOT: readonly { m: number; j: number }[] = FACE_KEYS.map((k, i) => {
  if (!DT2_FACE) return sceneSlot(i) >= 0 ? { m: 1, j: sceneSlot(i) } : { m: 0, j: i };
  const m = CLASSES.indexOf(k.cls);
  return { m, j: FACE_KEYS.slice(0, i).filter((o) => o.cls === k.cls).length };
});
/** Le nombre d'instances de chaque maillage (la V.5.3 : la rangee en a seize, les scenes deux). */
const COUNT: readonly number[] = DT2_FACE ? CLASSES.map((c) => FACE_KEYS.filter((k) => k.cls === c).length) : [N, 2];

const m4 = new Matrix4();
const col = new Color();
const WHITE = new Color(1, 1, 1);

/** La touche de la face, w x d (la rangee ; SCENE A et B : SCENE_KEY) : en relief au desktop (V.4.2, scene/keyCap.ts : flancs, chanfrein, l'ombre du pied). */
function keyGeometry(mobile: boolean, w: number = FACE_KEY.w, d: number = FACE_KEY.d): BufferGeometry {
  const K = FACE_KEY;
  if (KEY_RELIEF.on) return keyCapGeometry(w, K.h, d, K.radius, K.bevel, KEY_RELIEF.seg, KEY_RELIEF.shade);
  const g = new RoundedBoxGeometry(w, K.h, d, mobile ? KEYS.segments.mobile : KEYS.segments.desktop, K.radius);
  g.translate(0, K.h / 2, 0);
  g.deleteAttribute('uv');
  return g;
}

/** La taille de la touche d'une classe (la rangee : FACE_KEY ; les scenes : SCENE_KEY ; la face DT2 : FACE_KEY_CLASS). */
const classSize = (c: FaceKeyClass): { w: number; d: number } => (c === 'row' ? FACE_KEY : c === 'scene' ? SCENE_KEY : FACE_KEY_CLASS[c]);

/**
 * La jupe de toutes les touches de la face (V.4.2, 2026-10-27) : les quatorze de la rangee, SCENE A et B, les seize pas
 * (rytm/faceplate.ts faceplateParts ; la face DT2 : ses 25 touches et ses 16 pas, dt2FaceplateParts) ; l'ombre douce a
 * leur pied, un seul maillage, une seule fois.
 */
function skirtGeometry(): BufferGeometry {
  const parts = DT2_FACE
    ? dt2FaceplateParts().map((p) => ({ kind: p.kind === 'button' || p.kind === 'scene' ? ('button' as const) : p.kind === 'step' ? ('step' as const) : null, rect: p.rect }))
    : faceplateParts().map((p) => ({ kind: p.kind === 'button' || p.kind === 'scene' ? ('button' as const) : p.kind === 'step' ? ('step' as const) : null, rect: p.rect }));
  const corner = (k: 'button' | 'step'): number => (k === 'step' ? (DT2_FACE ? DT2_FACEPLATE.steps.corner : RYTM_FACEPLATE.steps.corner) : DT2_FACE ? DT2_FACEPLATE.buttons.corner : RYTM_FACEPLATE.buttons.corner);
  const keys = parts
    .filter((p): p is { kind: 'button' | 'step'; rect: typeof p.rect } => p.kind !== null)
    .map((p) => {
      const c = rectCenter(p.rect);
      return { x: c.x, z: c.z, w: fpU(p.rect.w), d: fpU(p.rect.h), radius: fpU(corner(p.kind)) };
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
  const r = FP_OPEN.rect;
  const P = LOGO_GLOW.pad;
  const s = new Shape();
  roundRect(s, fpU(r.w) / 2 + P, fpU(r.h) / 2 + P, fpU(1.6));
  const g = new ShapeGeometry(s, 6);
  g.rotateX(-Math.PI / 2);
  g.translate(fpX(r.x + r.w / 2), 0.003, fpZ(r.y + r.h / 2));
  g.deleteAttribute('uv');
  return g;
}

/**
 * La fenetre des LED de page (V.6.0, la face DT2, cahier 2.3 : "une fenetre sombre en creux, pas un simple trait") : une
 * plaque a coins arrondis du noir du verre (oled, comme le cadre de l'ecran), a peine au-dessus du panneau.
 */
function ledWindowGeometry(): BufferGeometry {
  const W = PAGE_LEDS?.window;
  const s = new Shape();
  if (W) roundRect(s, W.w / 2, W.d / 2, W.r);
  const g = new ShapeGeometry(s, 6);
  g.rotateX(-Math.PI / 2);
  if (W) g.translate(W.x, PAGE_LED_Y.window, W.z);
  g.deleteAttribute('uv');
  const out = g.toNonIndexed();
  g.dispose();
  paintSolid(out, 'oled', GAIN.parts);
  return out;
}

/** La hauteur de la fenetre des LED de page et de leurs pastilles au-dessus du panneau (la serigraphie est a 0.004). */
const PAGE_LED_Y = { window: 0.005, led: 0.0065 } as const;

/** z du temoin : sur le dessus, pres du bord arriere (la V.5.3 : le z de la rangee ; la face DT2 : celui de chaque touche). */
const LED_Z = FACE_KEY.z - FACE_KEY.d / 2 + FACE_KEY.led.back;
const ledZ = (i: number): number => (DT2_FACE ? FACE_KEYS[i].z - FACE_KEYS[i].d / 2 + FACE_KEY.led.back : LED_Z);
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

/**
 * PERSONALIZE (V.6.0, cahier dt2 3.11 ; branche a la relecture de la V.6.0) : LED INTENSITY regle l'eclat des temoins, des
 * touches allumees et des 8 LED de page ; LED BACKLIGHT OFF eteint le dessus des touches (le temoin seul s'allume ; FUNC
 * garde son capuchon orange, c'est sa couleur et non une lumiere). L'appui et le survol ne changent pas (ils repondent a la
 * main).
 */
const LED_SCALE: Readonly<Record<LedIntensity, number>> = { low: 0.4, mid: 0.7, max: 1 };

/** Les 8 LED de page (V.6.0, la face DT2, cahier 2.4) : ce qu'elles montrent. */
export interface PageLedsInfo {
  /** les pages que compte le pattern (1 a 8), la page editee et celle qui joue (0 a 7, -1 aucune) */
  count: number;
  shown: number;
  playing: number;
  /** l'eclat de chaque LED (0 a 1), dans l'ordre 1 a 8 (1 a 4 en haut) */
  levels: number[];
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
  /**
   * La face DT2 (V.6.0, ?face=dt2) : dt2 (false sur la face de la V.5.3, les champs suivants y sont a leur repos), la
   * classe de chaque touche, sa place (x, z en unites du plateau), l'etat montre des touches nouvelles, les 8 LED de page.
   */
  dt2: boolean;
  classes: FaceKeyClass[];
  places: { x: number; z: number }[];
  keyboard: boolean;
  menu: FaceMenu | null;
  perform: boolean;
  fill: 'off' | 'on' | 'armed';
  bank: boolean;
  recMode: RecMode;
  pageLocks: string[];
  pageLeds: PageLedsInfo | null;
  /** PERSONALIZE (V.6.0) : l'eclat des LED (LED INTENSITY : 0,4, 0,7, 1) et le retroeclairage des touches */
  ledScale: number;
  backlight: boolean;
}

export class RytmFaceKeys {
  /** les touches de la rangee (la V.5.3) ; la face DT2 : celles de la premiere classe (P) */
  readonly keys: InstancedMesh;
  /** SCENE A et B (la revue de D1, R9) : leur touche de 12 x 12 ; leurs instances de keys restent a l'echelle 0 ; null sur la face DT2 */
  readonly sceneKeys: InstancedMesh | null;
  /** un maillage par classe de touches (la V.5.3 : keys et sceneKeys ; la face DT2 : P, L, G) */
  readonly classMeshes: readonly InstancedMesh[];
  readonly leds: InstancedMesh;
  readonly labels: KeyLabels;
  /** le capuchon du crossfader (2026-10-27, P2-20 : il suit x, de A a gauche a B a droite) ; null sur la face DT2 */
  readonly cap: Mesh | null;
  /** le cadre d'une scene armee (2026-10-27) : deux instances, A et B, a l'echelle 0 hors armement ; null sur la face DT2 */
  readonly armRing: InstancedMesh | null;
  /** la jupe de toutes les touches de la face (V.4.2 : l'ombre a leur pied) */
  readonly skirt: Mesh;
  /** la lueur du logo M au survol (V.5.0) */
  readonly logo: Mesh;
  /** la face DT2 : la fenetre des LED de page et ses huit LED ; null sur la face de la V.5.3 */
  readonly pageWindow: Mesh | null;
  readonly pageLeds: InstancedMesh | null;
  private skirtMat: MeshBasicMaterial;
  private ringMat: MeshBasicMaterial | null;
  private keyMat: MeshStandardMaterial;
  private ledMat: MeshBasicMaterial;
  private capMat: MeshStandardMaterial | null;
  private logoMat: MeshBasicMaterial;
  private windowMat: MeshStandardMaterial | null = null;
  private pageLedMat: MeshBasicMaterial | null = null;
  /** l'eclat de l'instance de chaque maillage de touches */
  private emissives: InstancedBufferAttribute[];
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
  /** LIVE REC (V.5.3) : la LED de ● clignote */
  private live = false;
  private play: PlayState = 'stop';
  private page: string | null = null;
  private home = false;
  /** TRK (2026-10-27) : son etat (state/trk.ts) */
  private trk: HoldMode = 'off';
  /** la phase du clignotement des temoins (1 : plein ; TRK et FUNC gardees, PLAY en pause) */
  private blinkOn = true;
  /** la face DT2 : la phase du double clignotement (STEP REC, cahier 2.4) */
  private doubleOn = false;
  /** la scene armee (2026-10-27), comment, la phase du clignotement de son cadre (gardee) */
  private armed: 'a' | 'b' | null = null;
  private armHow: 'held' | 'latched' | null = null;
  private armBlink = 1;
  /** l'eclat des temoins de SCENE A et B (0 : la scene est vide) */
  private sceneLed = { a: 0, b: 0 };
  private xNow = 0;
  /** le capuchon sous la souris (P2-20) */
  private capHot = false;
  /** La face DT2 (cahier 2.4) : ce que montrent les touches nouvelles, REC et la touche PAGE. */
  private keyboard = false;
  private muteMode = false;
  private soloMode = false;
  private openState = false;
  private menu: FaceMenu | null = null;
  private perform = false;
  private fillMode: 'off' | 'on' | 'armed' = 'off';
  private bank = false;
  private recMode: RecMode = 'off';
  private pageLocks: ReadonlySet<string> = new Set();
  /** les 8 LED de page : les pages du pattern, la page editee, celle qui joue (16 pas en 6.0 : LED 1 pleine) */
  private pages = { count: 1, shown: 0, playing: -1 };
  private pageLevel = new Float32Array(8);
  /** PERSONALIZE (V.6.0) : LED INTENSITY (LED_SCALE) et LED BACKLIGHT */
  private ledScale = 1;
  private backlight = true;
  private off = new Color();
  private offLit = new Color(LED_LIT_KEY_LIGHT.off);
  private ledColors = new Map<DtTone, Color>();

  constructor(opts: { mobile: boolean; atlas: KeyLabelAtlas; castShadow: boolean }) {
    this.emissives = CLASSES.map((_, m) => {
      const e = new InstancedBufferAttribute(new Float32Array(COUNT[m] * 3), 3);
      e.setUsage(DynamicDrawUsage);
      return e;
    });
    const g = keyGeometry(opts.mobile, classSize(CLASSES[0]).w, classSize(CLASSES[0]).d);
    g.setAttribute('instanceEmissive', this.emissives[0]);
    this.keyMat = withInstanceEmissive(new MeshStandardMaterial({ ...MATERIAL.key, vertexColors: KEY_RELIEF.on }), KEY_RELIEF.on);
    this.keyMat.name = 'faceKey';
    this.keys = new InstancedMesh(g, this.keyMat, COUNT[0]);
    this.keys.name = 'faceKeys';
    this.keys.receiveShadow = true;
    const meshes: InstancedMesh[] = [this.keys];
    if (!DT2_FACE) {
      FACE_KEYS.forEach((k, i) => this.keys.setMatrixAt(i, this.keyMatrix(i, k.x, 0, FACE_KEY.z)));
      this.keys.instanceMatrix.setUsage(DynamicDrawUsage);
      this.keys.instanceMatrix.needsUpdate = true;
      const sg = keyGeometry(opts.mobile, SCENE_KEY.w, SCENE_KEY.d);
      sg.setAttribute('instanceEmissive', this.emissives[1]);
      this.sceneKeys = new InstancedMesh(sg, this.keyMat, 2);
      this.sceneKeys.name = 'sceneKeys';
      this.sceneKeys.receiveShadow = true;
      [SCN_A, SCN_B].forEach((i, j) => this.sceneKeys?.setMatrixAt(j, m4.makeTranslation(FACE_KEYS[i]?.x ?? 0, 0, FACE_KEY.z)));
      this.sceneKeys.instanceMatrix.setUsage(DynamicDrawUsage);
      this.sceneKeys.instanceMatrix.needsUpdate = true;
      meshes.push(this.sceneKeys);
    } else {
      // La face DT2 : une geometrie par classe (P, L, G), chaque touche a sa place (x, z) dans le maillage de sa classe
      this.sceneKeys = null;
      for (let m = 1; m < CLASSES.length; m += 1) {
        const s = classSize(CLASSES[m]);
        const cg = keyGeometry(opts.mobile, s.w, s.d);
        cg.setAttribute('instanceEmissive', this.emissives[m]);
        const mesh = new InstancedMesh(cg, this.keyMat, COUNT[m]);
        mesh.name = `faceKeys${CLASSES[m]}`;
        mesh.receiveShadow = true;
        meshes.push(mesh);
      }
      this.keys.name = `faceKeys${CLASSES[0]}`;
      FACE_KEYS.forEach((k, i) => meshes[SLOT[i].m].setMatrixAt(SLOT[i].j, m4.makeTranslation(k.x, 0, k.z)));
      for (const mesh of meshes) {
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    this.classMeshes = meshes;

    this.off.setHex(COLOR.line);
    this.ledMat = new MeshBasicMaterial({ toneMapped: false });
    this.ledMat.name = 'faceKeyLed';
    this.leds = new InstancedMesh(ledGeometry(), this.ledMat, N);
    this.leds.name = 'faceKeyLeds';
    FACE_KEYS.forEach((k, i) => this.leds.setMatrixAt(i, m4.makeTranslation(k.x, LED_Y, ledZ(i))));
    this.leds.instanceMatrix.setUsage(DynamicDrawUsage);
    this.leds.instanceMatrix.needsUpdate = true;

    const specs = FACE_KEYS.map((k) => KEY_LABELS.find((l) => l.id === k.id)).filter((l) => l !== undefined);
    this.labels = new KeyLabels(opts.atlas, specs, FACE_KEY.h, 'faceKey');

    if (HAS_SCENES) {
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
    } else {
      this.capMat = null;
      this.cap = null;
      this.ringMat = null;
      this.armRing = null;
    }

    // La jupe (V.4.2) : noire et transparente, par-dessus la face et sous les touches (rien ne s'ecrit dans la profondeur)
    this.skirtMat = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.skirtMat.name = 'keySkirt';
    this.skirt = new Mesh(skirtGeometry(), this.skirtMat);
    this.skirt.name = 'keySkirt';
    this.skirt.renderOrder = -1;

    // La lueur du logo M (V.5.0) : neutre (la revue de D1, R8 : l'orange n'est qu'a FUNC), le blanc de la machine noire, l'encre
    // de la creme ; tres douce, seulement au survol
    this.logoMat = new MeshBasicMaterial({ color: new Color(DT_HEX.white), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.logoMat.name = 'logoGlow';
    this.logo = new Mesh(logoGlowGeometry(), this.logoMat);
    this.logo.name = 'logoGlow';
    this.logo.visible = false;

    // Les 8 LED de page (la face DT2) : la fenetre du noir du verre, huit pastilles non eclairees
    if (PAGE_LEDS) {
      this.windowMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      this.windowMat.name = 'pageLedWindow';
      this.pageWindow = new Mesh(ledWindowGeometry(), this.windowMat);
      this.pageWindow.name = 'pageLedWindow';
      this.pageWindow.receiveShadow = true;
      const dg = new CircleGeometry(PAGE_LEDS.r, 24);
      dg.rotateX(-Math.PI / 2);
      dg.deleteAttribute('uv');
      this.pageLedMat = new MeshBasicMaterial({ toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      this.pageLedMat.name = 'pageLeds';
      this.pageLeds = new InstancedMesh(dg, this.pageLedMat, PAGE_LEDS.leds.length);
      this.pageLeds.name = 'pageLeds';
      PAGE_LEDS.leds.forEach((p, k) => this.pageLeds?.setMatrixAt(k, m4.makeTranslation(p.x, PAGE_LED_Y.led, p.z)));
      this.pageLeds.instanceMatrix.needsUpdate = true;
      this.paintPageLeds();
      this.pageLeds.instanceColor?.setUsage(DynamicDrawUsage);
    } else {
      this.pageWindow = null;
      this.pageLeds = null;
    }

    for (let i = 0; i < N; i += 1) this.refresh(i);
    for (const mesh of this.classMeshes) mesh.instanceColor?.setUsage(DynamicDrawUsage);
    this.leds.instanceColor?.setUsage(DynamicDrawUsage);
  }

  /** La matrice de l'instance i de keys a x, y, z (SCENE A et B : a l'echelle 0, sceneKeys les dessine). */
  private keyMatrix(i: number, x: number, y: number, z: number): Matrix4 {
    if (sceneSlot(i) >= 0) return m4.makeScale(0, 0, 0).setPosition(x, y, z);
    return m4.makeTranslation(x, y, z);
  }

  /** Les maillages a poser sur le plateau. */
  objects(): Object3D[] {
    if (!DT2_FACE) return [this.skirt, this.keys, ...(this.sceneKeys ? [this.sceneKeys] : []), this.leds, this.labels.mesh, ...(this.cap ? [this.cap] : []), ...(this.armRing ? [this.armRing] : []), this.logo];
    return [this.skirt, ...this.classMeshes, this.leds, this.labels.mesh, ...(this.cap ? [this.cap] : []), ...(this.armRing ? [this.armRing] : []), this.logo, ...(this.pageWindow ? [this.pageWindow] : []), ...(this.pageLeds ? [this.pageLeds] : [])];
  }

  /** Les deux cadres a leur touche, a l'echelle 0 sauf celui de la scene armee (allume, ou dans sa phase allumee). */
  private placeRings(): void {
    const ring = this.armRing;
    if (!ring) return;
    const on = this.ringOn;
    [SCN_A, SCN_B].forEach((i, j) => {
      const k = FACE_KEYS[i];
      const show = on && this.armed === (j === 0 ? 'a' : 'b');
      m4.makeScale(show ? 1 : 0, show ? 1 : 0, show ? 1 : 0);
      m4.setPosition(k ? k.x : 0, 0, k ? k.z : FACE_KEY.z);
      ring.setMatrixAt(j, m4);
    });
    ring.instanceMatrix.needsUpdate = true;
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
    const red: Look = { fill: 1, tone: 'dred', glow: 1, led: 1, ledTone: 'red' };
    if (i === FUNC) {
      // Le capuchon orange en permanence ; son temoin blanc : tenue, plein ; gardee (une tape, deux), il clignote
      const on = this.func !== 'off';
      return { fill: 1, tone: 'dorange', glow: on ? FUNC_GLOW.on : FUNC_GLOW.rest, led: this.func === 'held' ? 1 : on ? this.blinkLevel : 0, ledTone: 'white' };
    }
    if (i === TRK) return this.trk === 'off' ? none : { fill: 1, tone: 'dred', glow: 1, led: this.trk === 'latched' ? this.blinkLevel : 1, ledTone: 'red' };
    if (i === PTN) {
      // La face DT2 (cahier 2.4) : la vue BANK, rouge clignotant
      if (DT2_FACE && this.bank) return { ...red, led: this.blinkLevel };
      return this.editing ? { fill: 1, tone: 'dred', glow: 1, led: 1, ledTone: 'red' } : none;
    }
    if (i === REC) {
      // La face DT2 (cahier 2.4) : GRID rouge fixe, LIVE clignotant, STEP double clignotement, euclidien bleu
      if (DT2_FACE && this.recMode !== 'off') {
        if (this.recMode === 'euclid') return { fill: 1, tone: 'dblue', glow: 1, led: 1, ledTone: 'blue' };
        if (this.recMode === 'live') return { ...red, led: this.blinkLevel };
        if (this.recMode === 'step') return { ...red, led: this.doubleOn ? 1 : BLINK_LOW };
        return red;
      }
      if (!this.rec) return none;
      // LIVE REC (V.5.3) : rouge clignotant, comme la Digitakt
      return this.live ? { fill: 1, tone: 'dred', glow: 1, led: this.blinkLevel, ledTone: 'red' } : { fill: 1, tone: 'dred', glow: 1, led: 1, ledTone: 'red' };
    }
    if (i === PLAY) {
      if (this.play === 'run') return { fill: 1, tone: GO_TONE, glow: 1, led: 1, ledTone: GO_LED };
      if (this.play === 'pause') {
        const b = this.blinkOn ? 1 : 0;
        return { fill: b, tone: GO_TONE, glow: b, led: this.blinkLevel, ledTone: GO_LED };
      }
      return { ...none, ledTone: GO_LED };
    }
    if (FLASHED.has(i)) {
      const f = this.flashV[i];
      return { fill: f, tone: 'dwhite', glow: f, led: f, ledTone: 'white' };
    }
    // La face DT2 : un eclair blanc a l'appui de toute autre touche (TEMPO a chaque tape de TAP, cahier 2.4), par-dessus son etat
    const fl = DT2_FACE ? this.flashV[i] : 0;
    if (fl > 0) return { fill: fl, tone: 'dwhite', glow: fl, led: fl, ledTone: 'white' };
    const pg = pageAt(i);
    if (pg) {
      // La face DT2 (cahier 2.4) : un trig tenu allume en rouge les touches des pages qui portent ses verrous
      if (DT2_FACE && this.pageLocks.size > 0) return this.pageLocks.has(pg) ? red : none;
      if (this.page !== pg) return none;
      return this.home ? { ...none, led: HOME_LEVEL } : { fill: 1, tone: 'dred', glow: 1, led: 1, ledTone: 'red' };
    }
    // SCENE A et B (2026-10-27) : allumees en entier tant qu'armees ; leur temoin dit qu'elles ont des valeurs et combien on
    // en entend (eteint : la scene est vide) ; le bleu des scenes depuis V.5.0
    if (i === SCN_A) return { fill: this.armed === 'a' ? 1 : 0, tone: 'dblue', glow: this.armed === 'a' ? 1 : 0, led: this.sceneLed.a, ledTone: 'blue' };
    if (i === SCN_B) return { fill: this.armed === 'b' ? 1 : 0, tone: 'dblue', glow: this.armed === 'b' ? 1 : 0, led: this.sceneLed.b, ledTone: 'blue' };
    // La face DT2 (cahier 2.4) : KEYBOARD en mode clavier, SONG en SONG (clignote en SONG EDIT), PRESET/KIT, SETTINGS,
    // SOUNDS et TEMPO leur menu ouvert (PRESET/KIT orange en PERFORM KIT), PAGE en FILL (clignote en attente d'un cycle)
    if (i === KBD) return this.keyboard ? red : none;
    if (i === MUTE) return this.muteMode ? { fill: 1, tone: GO_TONE, glow: 1, led: 1, ledTone: GO_LED } : none;
    if (i === SOLO) return this.soloMode ? { fill: 1, tone: 'dblue', glow: 1, led: 1, ledTone: 'blue' } : none;
    if (i === OPEN) return this.openState ? { fill: 1, tone: 'dorange', glow: 1, led: 1, ledTone: 'orange' } : none;
    if (i === PRESET && this.perform) return { fill: 1, tone: 'dorange', glow: 1, led: 1, ledTone: 'orange' };
    if (this.menu !== null && i === MENU_KEY[this.menu]) return red;
    if (i === PTNPAGE) return this.fillMode === 'off' ? none : this.fillMode === 'armed' ? { ...red, led: this.blinkLevel } : red;
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

  /** Ce que la touche i montre une fois PERSONALIZE applique (LED INTENSITY, LED BACKLIGHT). */
  private personal(i: number, s: Look): Look {
    if (this.ledScale === 1 && this.backlight) return s;
    const k = this.ledScale;
    // FUNC : son capuchon orange (son dessus et sa lueur en noir) reste tel quel, seul son temoin suit LED INTENSITY
    if (i === FUNC) return { ...s, led: s.led * k };
    return { ...s, fill: this.backlight ? s.fill : 0, glow: this.backlight ? s.glow * k : 0, led: s.led * k };
  }

  /**
   * PERSONALIZE (V.6.0, la relecture : LED INTENSITY et LED BACKLIGHT ne changeaient aucune lueur) : toutes les touches et
   * les 8 LED de page se repeignent ; true s'il faut une frame.
   */
  setPersonal(p: { readonly led: LedIntensity; readonly backlight: boolean }): boolean {
    const k = LED_SCALE[p.led] ?? 1;
    if (k === this.ledScale && p.backlight === this.backlight) return false;
    this.ledScale = k;
    this.backlight = p.backlight;
    for (let i = 0; i < N; i += 1) this.refresh(i);
    this.paintPageLeds();
    return true;
  }

  /** Repeint la touche i : son dessus, son temoin, son nom. */
  private refresh(i: number): void {
    if (i < 0 || i >= N) return;
    const s = this.personal(i, this.look(i));
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
    // SCENE A et B dans leur maillage (R9), les autres dans celui de la rangee ; la face DT2 : le maillage de sa classe
    const sl = SLOT[i];
    const mesh = this.classMeshes[sl.m];
    const slot = sl.j;
    mesh.setColorAt(slot, col);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // L'eclat : l'appui, la touche allumee, le survol
    const em = this.emissives[sl.m];
    const e = em.array as Float32Array;
    const g = KEY_LIT.glow[s.tone];
    const h = i === this.hover ? 1 : 0;
    for (let c = 0; c < 3; c += 1) e[slot * 3 + c] = Math.max(STEP_PRESS.glow[c] * v, g[c] * KEY_LIT_LIGHT.glow * s.glow, HOVER_LIGHT.glow[c] * h);
    em.needsUpdate = true;
    // Le temoin : eteint, une fente, jamais tiree vers le blanc (la revue de D1, R1 : FUNC au repos semblait allumee) ; allume,
    // sa couleur, et sur une touche allumee tiree vers le blanc a la mesure de son eclat (il reste l'accent, la phase basse d'un
    // clignotement reste basse) ; sur la creme, une touche allumee a une lentille sombre eteinte et du vrai blanc allume
    // (LED_LIT_KEY_LIGHT : l'encre sombre du blanc de la creme grisait FUNC tenue), sans tirage vers le blanc
    const light = KEYS_LIGHT.on && f > 0;
    col.copy(light ? this.offLit : this.off).lerp(light && s.ledTone === 'white' ? WHITE : this.ledColor(s.ledTone), s.led);
    if (f > 0 && s.led > 0 && !(s.ledTone === 'white' && KEYS_LIGHT.on)) col.lerp(WHITE, KEY_LIT.ledWhite * f * s.led);
    this.leds.setColorAt(i, col);
    if (this.leds.instanceColor) this.leds.instanceColor.needsUpdate = true;
    this.labels.setLit(i, f > KEY_LIT.dark);
  }

  /** FUNC (V.5.0, state/func.ts) : off, tenue, gardee pour une touche, gardee ; true s'il faut une frame. */
  setFunc(mode: FuncMode): boolean {
    if (FUNC < 0 || mode === this.func) return false;
    this.func = mode;
    this.labels.setFuncMode(mode !== 'off');
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

  /** REC (V.5.0, state/dtFace.ts) : rouge en mode ecriture ; LIVE REC (V.5.3) : rouge clignotant ; true s'il faut une frame. */
  setRec(on: boolean, live = false): boolean {
    if (on === this.rec && live === this.live) return false;
    this.rec = on;
    this.live = live;
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

  /**
   * L'eclair blanc d'une touche, v de 1 (l'appui) a 0 (le Stage l'anime) : STOP, YES et NO ; la face DT2 : toute touche (les
   * fleches, TEMPO a chaque tape de TAP, cahier 2.4).
   */
  setFlash(hotspot: string, v: number): void {
    const i = this.indexOf(hotspot);
    if (i < 0 || (!DT2_FACE && !FLASHED.has(i))) return;
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

  /* ---------- la face DT2 (V.6.0, cahier 2.4) : les etats des touches nouvelles, que les lanes B4 et B5 posent ---------- */

  /** KEYBOARD : rouge en mode clavier ; true s'il faut une frame (false sur la face de la V.5.3). */
  setKeyboard(on: boolean): boolean {
    if (KBD < 0 || on === this.keyboard) return false;
    this.keyboard = on;
    this.refresh(KBD);
    return true;
  }

  /** MUTE : vert en mode mute ; true s'il faut une frame. */
  setMuteMode(on: boolean): boolean {
    if (MUTE < 0 || on === this.muteMode) return false;
    this.muteMode = on;
    this.refresh(MUTE);
    return true;
  }

  /** SOLO : bleu en mode solo ; true s'il faut une frame. */
  setSoloMode(on: boolean): boolean {
    if (SOLO < 0 || on === this.soloMode) return false;
    this.soloMode = on;
    this.refresh(SOLO);
    return true;
  }

  /** OPEN : orange quand le capot est ouvert ; true s'il faut une frame. */
  setOpenState(on: boolean): boolean {
    if (OPEN < 0 || on === this.openState) return false;
    this.openState = on;
    this.refresh(OPEN);
    return true;
  }

  /** Le menu ouvert par sa touche (PRESET/KIT, SETTINGS, SOUNDS, TEMPO), null aucun : sa touche rouge ; true s'il faut une frame. */
  setMenu(menu: FaceMenu | null): boolean {
    if (!DT2_FACE || menu === this.menu) return false;
    const was = this.menu;
    this.menu = menu;
    if (was) this.refresh(MENU_KEY[was]);
    if (menu) this.refresh(MENU_KEY[menu]);
    return true;
  }

  /** PERFORM KIT (6.2) : PRESET/KIT orange ; true s'il faut une frame. */
  setPerform(on: boolean): boolean {
    if (PRESET < 0 || on === this.perform) return false;
    this.perform = on;
    this.refresh(PRESET);
    return true;
  }

  /** PAGE et FILL : rouge actif (tenu ou verrouille), rouge clignotant en attente d'un cycle ; true s'il faut une frame. */
  setFill(mode: 'off' | 'on' | 'armed'): boolean {
    if (PTNPAGE < 0 || mode === this.fillMode) return false;
    this.fillMode = mode;
    this.refresh(PTNPAGE);
    return true;
  }

  /** PTN en vue BANK : rouge clignotant ; true s'il faut une frame. */
  setBank(on: boolean): boolean {
    if (!DT2_FACE || PTN < 0 || on === this.bank) return false;
    this.bank = on;
    this.refresh(PTN);
    return true;
  }

  /** REC : off, GRID (fixe), LIVE (clignotant), STEP (double clignotement), euclidien (bleu) ; true s'il faut une frame. */
  setRecMode(mode: RecMode): boolean {
    if (!DT2_FACE || REC < 0 || mode === this.recMode) return false;
    this.recMode = mode;
    this.refresh(REC);
    return true;
  }

  /** Un trig tenu en GRID REC : les pages qui portent ses verrous (leurs touches rouges, les autres eteintes) ; [] : la page affichee. */
  setPageLocks(pages: readonly string[]): boolean {
    if (!DT2_FACE) return false;
    const next = new Set(pages);
    if (next.size === this.pageLocks.size && [...next].every((p) => this.pageLocks.has(p))) return false;
    this.pageLocks = next;
    for (const p of PAGE_KEYS) if (p.i >= 0) this.refresh(p.i);
    return true;
  }

  /**
   * Les 8 LED de page (cahier 2.4) : count pages comptees par le pattern (allumees faible), shown la page editee (pleine),
   * playing la page qui joue (clignotante quand ce n'est pas l'editee ; -1 aucune) ; eteintes au-dela. 16 pas (6.0) :
   * (1, 0, -1), la LED 1 pleine. true s'il faut une frame.
   */
  setPatternPages(count: number, shown: number, playing = -1): boolean {
    if (!this.pageLeds) return false;
    const c = Math.max(1, Math.min(8, Math.round(count)));
    if (c === this.pages.count && shown === this.pages.shown && playing === this.pages.playing) return false;
    this.pages = { count: c, shown, playing };
    return this.paintPageLeds();
  }

  /** L'eclat de la LED de page k (0 a 7). */
  private pageLedLevel(k: number): number {
    const P = this.pages;
    if (k >= P.count) return 0;
    if (k === P.shown) return 1;
    if (k === P.playing) return this.blinkOn ? 1 : PAGE_LED_TONE.blinkLow;
    return PAGE_LED_TONE.faint;
  }

  /** Peint les 8 LED de page ; true si l'une a change. */
  private paintPageLeds(): boolean {
    const leds = this.pageLeds;
    if (!leds) return false;
    const offHex = APPEARANCE.current === 'light' ? PAGE_LED_TONE.offLight : PAGE_LED_TONE.off;
    const off = new Color(offHex);
    const on = new Color(DT_HEX_DARK.red);
    let changed = false;
    // Le premier dessin les peint toutes (three cree instanceColor au premier setColorAt, rempli de blanc)
    const first = !this.pagesPainted;
    for (let k = 0; k < leds.count; k += 1) {
      const lv = this.pageLedLevel(k) * this.ledScale;
      if (!first && Math.abs(this.pageLevel[k] - lv) < 1e-4) continue;
      this.pageLevel[k] = lv;
      leds.setColorAt(k, col.copy(off).lerp(on, lv));
      changed = true;
    }
    this.pagesPainted = true;
    if (changed && leds.instanceColor) leds.instanceColor.needsUpdate = true;
    return changed;
  }

  /** Les 8 LED de page ont-elles ete peintes une premiere fois. */
  private pagesPainted = false;

  /** Un temoin clignote-t-il (TRK gardee, FUNC gardee, PLAY en pause, une scene gardee) : il a besoin de la boucle. */
  get blinking(): boolean {
    const v53 = this.trk === 'latched' || this.func === 'once' || this.func === 'locked' || this.play === 'pause' || this.armHow === 'latched' || (this.rec && this.live);
    if (!DT2_FACE) return v53;
    // La face DT2 : la vue BANK, LIVE et STEP REC, un FILL en attente, la page qui joue (hors celle qu'on edite)
    const P = this.pages;
    return v53 || this.bank || this.recMode === 'live' || this.recMode === 'step' || this.fillMode === 'armed' || (P.playing >= 0 && P.playing !== P.shown && P.playing < P.count);
  }

  /** Le clignotement (periodMs allume, periodMs a peine) des temoins et du cadre d'une scene gardee ; true si la phase a change. */
  blink(now: number, periodMs: number): boolean {
    if (!this.blinking) return false;
    const on = Math.floor(now / periodMs) % 2 === 0;
    let changed = false;
    if (on !== this.blinkOn) {
      this.blinkOn = on;
      for (const i of [TRK, FUNC, PLAY, REC]) if (i >= 0) this.refresh(i);
      if (DT2_FACE) {
        for (const i of [PTN, PTNPAGE]) if (i >= 0) this.refresh(i);
        this.paintPageLeds();
      }
      changed = true;
    }
    // Le double clignotement de STEP REC (la face DT2) : deux eclairs de 80 ms toutes les 600 ms
    if (DT2_FACE && this.recMode === 'step') {
      const t = now % DOUBLE_BLINK.periodMs;
      const d = t < DOUBLE_BLINK.flashMs || (t >= 2 * DOUBLE_BLINK.flashMs && t < 3 * DOUBLE_BLINK.flashMs);
      if (d !== this.doubleOn) {
        this.doubleOn = d;
        this.refresh(REC);
        changed = true;
      }
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
    // La face DT2 : plus de scenes sur la face (cahier 1.3), leur page MIXER les montre
    if (!HAS_SCENES) return false;
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
    if (!HAS_SCENES) return false;
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
    if (!this.cap) return false;
    const px = xfadeCapX(x);
    if (this.cap.position.x === px) return false;
    this.cap.position.x = px;
    return true;
  }

  /** Une scene gardee : son cadre a besoin de la boucle (l'API d'avant V.5.0). */
  get sceneBlinking(): boolean {
    return this.armHow === 'latched';
  }

  /** Le capot ouvert : sur DT2_FACE la touche OPEN s'allume en orange. */
  setOpen(on: boolean): boolean {
    return this.setOpenState(on);
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
    const sl = SLOT[i];
    const mesh = this.classMeshes[sl.m];
    mesh.instanceMatrix.array[sl.j * 16 + 13] = dy;
    mesh.instanceMatrix.needsUpdate = true;
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
      this.capMat?.color.setScalar(cap ? HOVER_LIGHT.knob : 1);
      changed = true;
    }
    // Le logo M (V.5.0) : sa lueur
    const logo = id === FP_OPEN.hotspot;
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
   * la fente et le capuchon) ; pad-open (kind open), le logo M. Dans l'ordre de la rangee. La face DT2 : ses touches de la
   * V.5.3 a leur place (leurs ids et leurs kinds gardes), puis le logo M ; les onze nouvelles sont au registre
   * scene/zones/face60.ts.
   */
  hotspots(layer: Object3D): HotspotDef[] {
    const K = FACE_KEY;
    const KIND: Readonly<Partial<Record<FaceKeyId, HotspotKind>>> = { func: 'func', trk: 'trk', ptn: 'edit', rec: 'rec', play: 'run', stop: 'stop', yes: 'yes', no: 'no', open: 'open' };
    const out: HotspotDef[] = [];
    FACE_KEYS.forEach((k, i) => {
      const scene = k.id === 'scene-a' ? 'a' : k.id === 'scene-b' ? 'b' : null;
      const pg = pageAt(i);
      // La face DT2 : les touches qui ont deja leur kind (et les scenes), les nouvelles : scene/zones/face60.ts
      if (DT2_FACE && !scene && !pg && KIND[k.id] === undefined) return;
      const base = DT2_FACE
        ? { id: k.hotspot, layer, shape: 'box' as const, x: k.x, z: k.z, hx: k.w / 2, hz: k.d / 2, y0: 0, y1: K.h, enabled: true }
        : { id: k.hotspot, layer, shape: 'box' as const, x: k.x, z: K.z, hx: (scene ? SCENE_KEY.w : K.w) / 2, hz: (scene ? SCENE_KEY.d : K.d) / 2, y0: 0, y1: K.h, enabled: true };
      if (scene) {
        // Le crossfader entre SCENE A et SCENE B, dans l'ordre de lecture
        if (scene === 'b') out.push({ id: 'xfade', kind: 'xfade', layer, shape: 'box', x: XFADE.x, z: XFADE.z, hx: XFADE.slot.w / 2, hz: XFADE.cap.d / 2, y0: 0, y1: XFADE.cap.h, enabled: true });
        out.push({ ...base, kind: 'scene', scene });
        return;
      }
      if (pg) {
        out.push({ ...base, kind: 'pkey', rpage: pg });
        return;
      }
      out.push({ ...base, kind: KIND[k.id] ?? 'trk' });
    });
    // Le logo M (V.5.0) : OPEN, sur toute sa zone, a plat sur la face (sur DT2_FACE, la touche OPEN l'a deja emis)
    if (!DT2_FACE) {
      const r = FP_OPEN.rect;
      out.push({ id: FP_OPEN.hotspot, kind: 'open', layer, shape: 'box', x: fpX(r.x + r.w / 2), z: fpZ(r.y + r.h / 2), hx: fpU(r.w) / 2, hz: fpU(r.h) / 2, y0: 0, y1: 0.01, enabled: true });
    }
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
      capX: this.cap ? +this.cap.position.x.toFixed(6) : 0,
      capHover: this.capHot,
      dt2: DT2_FACE,
      classes: FACE_KEYS.map((k) => k.cls),
      places: FACE_KEYS.map((k) => ({ x: +k.x.toFixed(4), z: +k.z.toFixed(4) })),
      keyboard: this.keyboard,
      menu: this.menu,
      perform: this.perform,
      fill: this.fillMode,
      bank: this.bank,
      recMode: this.recMode,
      pageLocks: [...this.pageLocks],
      pageLeds: this.pageLeds ? { ...this.pages, levels: Array.from(this.pageLevel, (v) => +v.toFixed(2)) } : null,
      ledScale: this.ledScale,
      backlight: this.backlight,
    };
  }

  dispose(): void {
    for (const mesh of this.classMeshes) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.keyMat.dispose();
    this.leds.geometry.dispose();
    this.ledMat.dispose();
    this.leds.dispose();
    this.labels.dispose();
    this.cap?.geometry.dispose();
    this.capMat?.dispose();
    this.armRing?.geometry.dispose();
    this.ringMat?.dispose();
    this.armRing?.dispose();
    this.skirt.geometry.dispose();
    this.skirtMat.dispose();
    this.logo.geometry.dispose();
    this.logoMat.dispose();
    this.pageWindow?.geometry.dispose();
    this.windowMat?.dispose();
    this.pageLeds?.geometry.dispose();
    this.pageLedMat?.dispose();
    this.pageLeds?.dispose();
  }
}
