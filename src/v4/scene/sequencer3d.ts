/**
 * Le sequenceur (spec 7.5 et 20.3.6) : les 16 touches trig etroites du bas
 * du panneau, RUN/STOP, CLEAR, MUTE, SOLO et RANDOM (boutons carres) sont
 * UN InstancedMesh de boites a coins arrondis (echelle par instance).
 *
 * Velocite (2026-10-19, Mika : "je veux que les boutons soient allumes au
 * complet sur le step quand la velocite est a 127 ; les trois barres
 * au-dessus, ca casse le design") : plus de traits au-dessus des touches ; un
 * pas mis allume tout le dessus de sa touche, l'orange des touches allumees
 * (theme.ts KEY_LIT, la teinte de KEY_LIT_LIGHT sur la machine claire), plein
 * a la velocite la plus forte (127 a l'ecran) et de moins en moins jusqu'a la
 * plus douce (STEP_LIT.ramp, neuf niveaux qui se distinguent ; la teinte de la
 * machine claire suit STEP_LIT.lightRamp, reguliere) ; un pas vide
 * reste eteint. La tete de lecture (et le test de l'intro) ajoute un blanc
 * chaud a son pas (un pas vide s'eclaire a peine) ; la souris eclaire a peine
 * le pas survole. Glisser un pas tenu change sa velocite : sa touche suit.
 * Programme = les coups de l'instrument selectionne ; sans selection, le
 * plus fort des cinq, pour que le motif par defaut se voie des l'arrivee.
 * RUN/STOP est le seul element rouge. Temoins du transport (2026-10-01,
 * maillage btnLeds) : un fin trait sur le dessus de chaque bouton, allume
 * pour RUN/STOP en lecture, MUTE et SOLO actifs, un eclair a chaque appui
 * (le seul signe de CLEAR et RANDOM). Le Stage ne rend une frame que si un
 * trait a change.
 *
 * Les verrous (2026-10-08, l'etape R2 des parameter locks) : depuis le
 * 2026-10-19 un pas qui a des verrous (la voix choisie) porte une marque sur
 * le dessus, pres du bord arriere (KEYS.lockMark : claire sur une touche
 * eteinte, sombre sur une touche allumee ; un pas vide verrouille garde aussi
 * une lueur a peine) ; le pas en LOCK clignote en jaune clair (comme le trig
 * tenu d'une Elektron). Rien en EDIT (les pas y sont les patterns : le courant
 * plein, celui qui attend, la chaine, un pattern plein, de plus en plus
 * faibles, STEP_LIT.edit).
 *
 * Le transport depuis le 2026-10-18 (Mika : "je veux la meme forme de boutons
 * pour les boutons RUN/STOP CLEAR etc. ; ecrit directement sur le bouton ; et
 * quand c'est selectionne que ce soit plus voyant") : des touches plates de la
 * forme des touches de page (theme.ts TRANSPORT : 1.0 x 0.38, leur temoin),
 * leur nom imprime dessus (scene/keyLabels.ts, cinq quads qui s'enfoncent avec
 * elles) ; une touche active s'allume en entier (theme.ts KEY_LIT) : RUN/STOP
 * pendant la lecture (son rouge, plus chaud), MUTE (rouge) tant que des voix
 * sont coupees, SOLO (bleu) arme ou tant que des voix sont en solo
 * (state/voices.ts lit), CLEAR et RANDOM (orange) le temps de leur eclair ;
 * son nom passe au noir, son temoin reste l'accent, plus clair.
 */

import {
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Path,
  Shape,
  ShapeGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { INSTRUMENTS, STEP_COUNT, velocity, type Steps } from '../audio/pattern';
import { BTN_LED, COLOR, HOVER_LIGHT, INK, KEYS, KEY_LABELS, KEY_LIT, KEY_LIT_LIGHT, LIT, MATERIAL, PRESS_TINT, STEP_LIT, STEP_PRESS, TRANSPORT, keyDz, keyX, type Inst, type KeyLitTone } from '../theme';
import type { HotspotDef } from './hit';
import { KeyLabels, type KeyLabelAtlas } from './keyLabels';
import { withInstanceEmissive } from './materials';

/** EDIT du MM-RYTM : le pattern courant, celui qui attend, la chaine, les emplacements pleins. */
export interface PatternView {
  cur: number;
  next: number;
  chain: readonly number[];
  filled: readonly boolean[];
}

/**
 * Index des touches : les 16 trig (maillage keys), puis RUN, CLEAR, MUTE,
 * SOLO et RANDOM (maillage buttons, 2026-10-01 : des carres de 0.8 a leur
 * propre geometrie, coins reguliers).
 */
const RUN = STEP_COUNT;
const CLEAR = STEP_COUNT + 1;
const MUTE = STEP_COUNT + 2;
const SOLO = STEP_COUNT + 3;
export const RANDOM = STEP_COUNT + 4;
const BUTTON_COUNT = 5;

/** Les boutons du transport par nom (appui anime, renderer.pressButton). */
export type TransportButton = 'run' | 'clear' | 'mute' | 'solo' | 'random';
export const BUTTON_INDEX: Readonly<Record<TransportButton, number>> = { run: RUN, clear: CLEAR, mute: MUTE, solo: SOLO, random: RANDOM };
/** x de chaque bouton, dans l'ordre des index (RUN, CLEAR, MUTE, SOLO, RANDOM). */
const BUTTON_X = [TRANSPORT.run.x, TRANSPORT.clear.x, TRANSPORT.mute.x, TRANSPORT.solo.x, TRANSPORT.random.x] as const;
/** Les ids des boutons, dans l'ordre des index (leurs noms, KEY_LABELS). */
const BUTTON_IDS = ['run', 'clear', 'mute', 'solo', 'random'] as const;
/** La couleur de chaque bouton allume en entier (2026-10-18, theme.ts KEY_LIT), dans l'ordre des index. */
const BUTTON_TONE: readonly KeyLitTone[] = ['run', 'orange', 'red', 'blue', 'orange'];
/** z du temoin : sur le dessus, pres du bord arriere (celui des touches de page depuis le 2026-10-18). */
const BTN_LED_Z = TRANSPORT.z - TRANSPORT.d / 2 + TRANSPORT.led.back;
/** Le blanc vers lequel tire le temoin d'une touche allumee (il ne se perd pas dans sa couleur). */
const WHITE = new Color(1, 1, 1);

/** La hauteur de la marque des verrous, un soupcon au-dessus du dessus de la touche (et du cadre des temps). */
const MARK_Y = KEYS.h + 0.004;
/** z de la marque des verrous du pas i : pres du bord arriere de sa touche (portrait : sa rangee la decale). */
const markZ = (i: number): number => KEYS.z + keyDz(i) - KEYS.d / 2 + KEYS.lockMark.back;
/** Au-dela de cette part de l'orange, la marque des verrous passe au sombre (elle se lit sur la touche allumee). */
const MARK_DARK_AT = 0.45;

const m4 = new Matrix4();
const col = new Color();

/** Touche trig : boite a coins arrondis (trois segments : 588 triangles ; deux sur mobile : 300), base a y 0. */
function keyGeometry(mobile: boolean): BufferGeometry {
  const g = new RoundedBoxGeometry(KEYS.w, KEYS.h, KEYS.d, mobile ? KEYS.segments.mobile : KEYS.segments.desktop, KEYS.radius);
  g.translate(0, KEYS.h / 2, 0);
  g.deleteAttribute('uv');
  return g;
}

/** Bouton du transport : la touche plate des touches de page depuis le 2026-10-18 (un carre de 0.8 avant), base a y 0. */
function buttonGeometry(mobile: boolean): BufferGeometry {
  const T = TRANSPORT;
  const g = new RoundedBoxGeometry(T.w, T.h, T.d, mobile ? KEYS.segments.mobile : KEYS.segments.desktop, T.radius);
  g.translate(0, T.h / 2, 0);
  g.deleteAttribute('uv');
  return g;
}

/**
 * Le cadre des temps (2026-10-05, Mika, une photo de la Digitakt II : "on
 * remarque que les steps ont des strokes, 1 5 9 13") : un filet carre a
 * coins arrondis, imprime sur le dessus des touches 1, 5, 9 et 13.
 */
function frameGeometry(): BufferGeometry {
  const F = KEYS.frame;
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
  const ow = KEYS.w / 2 - F.inset;
  const od = KEYS.d / 2 - F.inset;
  const outer = new Shape();
  rr(outer, ow, od, 0.04);
  const hole = new Path();
  rr(hole, ow - F.line, od - F.line, 0.03);
  outer.holes.push(hole);
  const g = new ShapeGeometry(outer, 6);
  g.rotateX(-Math.PI / 2);
  g.translate(0, KEYS.h + 0.003, 0);
  g.deleteAttribute('uv');
  return g;
}

/** Les touches qui portent le cadre des temps. */
const FRAMED = [0, 4, 8, 12] as const;

function ledGeometry(w: number, d: number): BufferGeometry {
  const g = new PlaneGeometry(w, d);
  // Rectangle couche, face vers le haut
  g.rotateX(-Math.PI / 2);
  g.deleteAttribute('uv');
  return g;
}

export interface SequencerInfo {
  /** la part de l'orange du dessus de chaque pas (0 eteint a 1 plein, 2026-10-19), pas 1 a 16 */
  lit: number[];
  /** l'emissif lineaire du dessus de chaque pas (r, g, b), la tete de lecture, le survol, le LOCK et l'appui compris */
  glow: number[][];
  /** la marque des verrous de chaque pas : 1 montree (claire), 2 montree sombre (sur une touche allumee), 0 cachee */
  marks: string;
  run: boolean;
  /** eclat du temoin de chaque bouton (0 a 1) : RUN, CLEAR, MUTE, SOLO, RANDOM */
  buttonLeds: number[];
  /** chaque bouton allume en entier (0 a 1, 2026-10-18), meme ordre */
  buttonLit: number[];
  /** son nom en noir (sur une touche allumee), meme ordre */
  buttonDark: boolean[];
  playhead: number;
  hover: number;
  /** les verrous (2026-10-08) : les pas qui en ont (masque), le pas en LOCK, sa phase */
  lockMask: number;
  lockStep: number;
  lockBlink: boolean;
  /** velocite de chaque pas (0 vide a 9 la plus forte, 127 a l'ecran) */
  programmed: string;
  instrument: Inst | null;
}

export class Sequencer3D {
  readonly keys: InstancedMesh;
  readonly buttons: InstancedMesh;
  /** la marque des verrous sur chaque pas (2026-10-19 ; cachee hors des pas verrouilles) */
  readonly lockMarks: InstancedMesh;
  private markMat: MeshBasicMaterial;
  /** l'etat de la marque de chaque pas : 0 cachee, 1 claire, 2 sombre */
  private markState = new Uint8Array(STEP_COUNT);
  private markLight = new Color();
  private markDark = new Color();
  /** la part de l'orange de chaque pas au dernier calcul (refresh) */
  private litPart = new Float32Array(STEP_COUNT);
  /** le cadre des temps sur les touches 1, 5, 9, 13 */
  readonly frames: InstancedMesh;
  private frameMat: MeshBasicMaterial;
  /** les temoins du transport, un trait par bouton */
  readonly btnLeds: InstancedMesh;
  private keyMat: MeshStandardMaterial;
  private ledMat: MeshBasicMaterial;
  private emissive: InstancedBufferAttribute;
  private btnEmissive: InstancedBufferAttribute;
  /** appui en cours de chaque bouton (0 a 1) */
  private btnPress = new Float32Array(BUTTON_COUNT);
  /** temoins : etat tenu (RUN qui joue, MUTE, SOLO) et eclair d'appui (0 a 1) */
  /** L'eclat tenu de chaque temoin, 0 a 1 (2026-10-09 : MUTE et SOLO a peine allumes quand des voix restent coupees) */
  private btnLatch = new Float32Array(BUTTON_COUNT);
  private btnFlash = new Float32Array(BUTTON_COUNT);
  /** MUTE et SOLO allumes en entier tant qu'ils agissent (2026-10-18, voices.lit), leur temoin clignote a part */
  private btnMode = new Float32Array(BUTTON_COUNT);
  /** les noms sur les boutons (2026-10-18), dans l'ordre des index */
  readonly labels: KeyLabels;
  private btnLedOff = new Color();
  private btnLedOn = new Color();
  /** RUN est rouge : son temoin passe au jaune (l'orange s'y perdait) */
  private runLedOn = new Color();
  /** MUTE et SOLO (2026-10-07) : le rouge et le bleu de leurs pads */
  private muteLedOn = new Color(0xff2a1f);
  private soloLedOn = new Color(0x5b9bff);
  /** teinte propre de chaque bouton (l'appui la tire vers PRESS_TINT en mode clair) */
  private btnColor = new Float32Array(BUTTON_COUNT * 3);
  private steps: Steps | null = null;
  private instrument: Inst | null = null;
  private hover = -1;
  /** le bouton du transport sous la souris (son rang, 0 RUN), -1 aucun (2026-10-22) */
  private btnHover = -1;
  private playhead = -1;
  /** LED du test de l'intro (spec 7.4), -1 hors intro */
  private introLed = -1;
  private running = false;
  /** EDIT (2026-10-05) : les steps sont les seize patterns (state/patterns.ts) ; null : le motif */
  private patView: PatternView | null = null;
  /** les verrous (2026-10-08) : les pas qui en ont (bit i), le pas en LOCK (-1), sa phase de clignotement */
  private lockMask = 0;
  private lockStep = -1;
  private lockBlink = false;
  /** l'appui en cours de chaque pas (0 a 1), pour composer sa lueur avec celle des verrous */
  private keyPress = new Float32Array(STEP_COUNT);

  constructor(opts: { mobile: boolean; atlas: KeyLabelAtlas }) {
    const kGeo = keyGeometry(opts.mobile);
    this.emissive = new InstancedBufferAttribute(new Float32Array(STEP_COUNT * 3), 3);
    this.emissive.setUsage(DynamicDrawUsage);
    kGeo.setAttribute('instanceEmissive', this.emissive);
    this.keyMat = withInstanceEmissive(new MeshStandardMaterial({ ...MATERIAL.key }), false);
    this.keyMat.name = 'key';
    this.keys = new InstancedMesh(kGeo, this.keyMat, STEP_COUNT);
    this.keys.name = 'keys';
    this.keys.receiveShadow = true;
    for (let i = 0; i < STEP_COUNT; i += 1) {
      this.keys.setMatrixAt(i, m4.makeTranslation(keyX(i), 0, KEYS.z + keyDz(i)));
      this.keys.setColorAt(i, col.setRGB(LIT.key[0], LIT.key[1], LIT.key[2]));
    }
    this.keys.instanceMatrix.needsUpdate = true;
    this.keys.instanceColor?.setUsage(DynamicDrawUsage);

    // Le cadre des temps : la serigraphie, a peine moins vive que les numeros
    this.frameMat = new MeshBasicMaterial({ color: new Color(`rgb(${INK.silk.join(', ')})`), transparent: true, opacity: 0.62, side: DoubleSide, depthWrite: false });
    this.frameMat.name = 'keyFrames';
    this.frames = new InstancedMesh(frameGeometry(), this.frameMat, FRAMED.length);
    this.frames.name = 'keyFrames';
    FRAMED.forEach((i, j) => this.frames.setMatrixAt(j, m4.makeTranslation(keyX(i), 0, KEYS.z + keyDz(i))));
    this.frames.instanceMatrix.setUsage(DynamicDrawUsage);
    this.frames.instanceMatrix.needsUpdate = true;

    // Transport : RUN, CLEAR, MUTE, SOLO, RANDOM (meme materiau, sa geometrie)
    const bGeo = buttonGeometry(opts.mobile);
    this.btnEmissive = new InstancedBufferAttribute(new Float32Array(BUTTON_COUNT * 3), 3);
    this.btnEmissive.setUsage(DynamicDrawUsage);
    bGeo.setAttribute('instanceEmissive', this.btnEmissive);
    this.buttons = new InstancedMesh(bGeo, this.keyMat, BUTTON_COUNT);
    this.buttons.name = 'buttons';
    this.buttons.receiveShadow = true;
    for (let j = 0; j < BUTTON_COUNT; j += 1) {
      this.buttons.setMatrixAt(j, m4.makeTranslation(BUTTON_X[j], 0, TRANSPORT.z));
      // Chaque bouton passe par paintButton : sa teinte est gardee pour l'appui
      this.paintButton(j + STEP_COUNT, j + STEP_COUNT === RUN ? LIT.run : LIT.clear);
    }
    this.buttons.instanceMatrix.needsUpdate = true;
    this.buttons.instanceColor?.setUsage(DynamicDrawUsage);

    this.ledMat = new MeshBasicMaterial({ toneMapped: false });

    // Temoins : eteints, une fente (line) ; allumes, l'orange des pas mis (RUN : jaune)
    this.btnLedOff.setHex(COLOR.line);
    this.btnLedOn.setHex(COLOR.ledSet);
    this.runLedOn.setHex(COLOR.yellowHi);
    this.btnLeds = new InstancedMesh(ledGeometry(TRANSPORT.led.w, TRANSPORT.led.d), this.ledMat, BUTTON_COUNT);
    this.btnLeds.name = 'btnLeds';
    for (let j = 0; j < BUTTON_COUNT; j += 1) {
      this.btnLeds.setMatrixAt(j, m4.makeTranslation(BUTTON_X[j], TRANSPORT.h + BTN_LED.y, BTN_LED_Z));
      this.paintButtonLed(j);
    }
    this.btnLeds.instanceMatrix.needsUpdate = true;
    this.btnLeds.instanceColor?.setUsage(DynamicDrawUsage);
    // Les noms des boutons, dans l'ordre des index
    const specs = BUTTON_IDS.map((id) => KEY_LABELS.find((l) => l.id === id)).filter((l) => l !== undefined);
    this.labels = new KeyLabels(opts.atlas, specs, TRANSPORT.h, 'transport');

    this.ledMat.name = 'led';

    // La marque des verrous (2026-10-19) : un trait non eclaire sur le dessus de chaque pas, cache tant que le pas n'a pas
    // de verrou ; clair (le jaune des LED, l'orange sur la machine claire) ou sombre sur une touche allumee
    this.markLight.setHex(KEY_LIT_LIGHT.tint ? COLOR.ledSet : COLOR.yellowHi);
    this.markDark.setRGB(0.012, 0.011, 0.01);
    this.markMat = new MeshBasicMaterial({ toneMapped: false });
    this.markMat.name = 'lockMark';
    this.lockMarks = new InstancedMesh(ledGeometry(KEYS.lockMark.w, KEYS.lockMark.d), this.markMat, STEP_COUNT);
    this.lockMarks.name = 'lockMarks';
    for (let i = 0; i < STEP_COUNT; i += 1) {
      this.lockMarks.setMatrixAt(i, m4.makeScale(0, 0, 0));
      this.lockMarks.setColorAt(i, this.markLight);
    }
    this.lockMarks.instanceMatrix.setUsage(DynamicDrawUsage);
    this.lockMarks.instanceMatrix.needsUpdate = true;
    this.lockMarks.instanceColor?.setUsage(DynamicDrawUsage);
    // Au depart : la teinte de chaque pas (la machine claire teinte les touches allumees)
    for (let i = 0; i < STEP_COUNT; i += 1) this.writeKeyColor(i);
  }

  /** Teinte d'un bouton du transport (l'appui en cours s'y ajoute). */
  private paintButton(k: number, c: readonly number[]): void {
    const i = k - STEP_COUNT;
    this.btnColor.set([c[0], c[1], c[2]], i * 3);
    this.writeButtonColor(i);
    this.writeButtonGlow(i);
  }

  /** La teinte affichee du bouton j : la sienne, l'appui (machine claire), la touche allumee (machine claire, KEY_LIT_LIGHT). */
  private writeButtonColor(j: number): void {
    const c = this.pressedColor(this.btnColor.subarray(j * 3, j * 3 + 3), this.btnPress[j]);
    const lt = KEY_LIT_LIGHT.tint?.[BUTTON_TONE[j]];
    const f = this.litLevel(j);
    if (lt && f > 0) c.setRGB(c.r + (lt[0] - c.r) * f, c.g + (lt[1] - c.g) * f, c.b + (lt[2] - c.b) * f);
    this.buttons.setColorAt(j, c);
    if (this.buttons.instanceColor) this.buttons.instanceColor.needsUpdate = true;
  }

  /** Eclat du temoin j : allume si son etat tient, sinon son eclair d'appui. */
  private ledLevel(j: number): number {
    return Math.max(this.btnLatch[j], this.btnFlash[j]);
  }

  /**
   * Le bouton j allume en entier (2026-10-18), 0 a 1 : RUN/STOP tant que la
   * lecture tient, MUTE et SOLO tant qu'ils agissent (des voix coupees, le solo
   * arme ou des voix en solo ; leur temoin dit le detail), CLEAR et RANDOM le
   * temps de leur eclair.
   */
  private litLevel(j: number): number {
    const k = j + STEP_COUNT;
    if (k === RUN) return this.btnLatch[j];
    if (k === MUTE || k === SOLO) return this.btnMode[j];
    return this.btnFlash[j];
  }

  /** Le dessus, le temoin et le nom du bouton j suivent son allumage. */
  private paintLit(j: number): void {
    this.writeButtonGlow(j);
    if (KEY_LIT_LIGHT.tint) this.writeButtonColor(j);
    this.labels.setLit(j, this.litLevel(j) > KEY_LIT.dark);
  }

  private paintButtonLed(j: number): void {
    const k = j + STEP_COUNT;
    const on = k === RUN ? this.runLedOn : k === MUTE ? this.muteLedOn : k === SOLO ? this.soloLedOn : this.btnLedOn;
    col.copy(this.btnLedOff).lerp(on, this.ledLevel(j));
    // Sur une touche allumee, le temoin tire vers le blanc : il reste l'accent
    const f = this.labels ? this.litLevel(j) : 0;
    if (f > 0) col.lerp(WHITE, KEY_LIT.ledWhite * f);
    this.btnLeds.setColorAt(j, col);
    if (this.btnLeds.instanceColor) this.btnLeds.instanceColor.needsUpdate = true;
  }

  /** Etat tenu du temoin du bouton k ; true s'il a change. */
  private latch(k: number, on: boolean | number): boolean {
    const j = k - STEP_COUNT;
    const v = typeof on === 'number' ? Math.max(0, Math.min(1, on)) : on ? 1 : 0;
    if (Math.abs(this.btnLatch[j] - v) < 1e-3) return false;
    this.btnLatch[j] = v;
    this.paintButtonLed(j);
    if (k === RUN) this.paintLit(j);
    return true;
  }

  /** MUTE ou SOLO allume en entier (2026-10-18) : il agit ; true s'il a change. */
  private mode(k: number, on: number): boolean {
    const j = k - STEP_COUNT;
    const v = Math.max(0, Math.min(1, on));
    if (Math.abs(this.btnMode[j] - v) < 1e-3) return false;
    this.btnMode[j] = v;
    this.paintButtonLed(j);
    this.paintLit(j);
    return true;
  }

  /** Eclair d'appui du temoin d'un bouton, v de 1 (appui) a 0 (le Stage l'anime) ; CLEAR et RANDOM s'allument avec. */
  setButtonFlash(b: TransportButton, v: number): void {
    const j = BUTTON_INDEX[b] - STEP_COUNT;
    this.btnFlash[j] = v;
    this.paintButtonLed(j);
    if (b === 'clear' || b === 'random') this.paintLit(j);
  }

  /** Teinte affichee : la sienne, tiree vers l'orange de l'appui en mode clair. */
  private pressedColor(c: ArrayLike<number>, v: number): Color {
    const t = PRESS_TINT.rgb;
    if (!t || v <= 0) return col.setRGB(c[0], c[1], c[2]);
    return col.setRGB(c[0] + (t[0] - c[0]) * v, c[1] + (t[1] - c[1]) * v, c[2] + (t[2] - c[2]) * v);
  }

  /** Eclat d'un bouton : celui de l'appui, ou celui de la touche allumee s'il est plus fort (2026-10-18). */
  private writeButtonGlow(i: number): void {
    const e = this.btnEmissive.array as Float32Array;
    const v = this.btnPress[i];
    // Avant la construction des noms (la teinte de depart), aucun bouton n'est allume
    const f = this.labels ? this.litLevel(i) : 0;
    const g = KEY_LIT.glow[BUTTON_TONE[i]];
    const h = i === this.btnHover ? 1 : 0;
    for (let c = 0; c < 3; c += 1) e[i * 3 + c] = Math.max(STEP_PRESS.glow[c] * v, g[c] * KEY_LIT_LIGHT.glow * f, HOVER_LIGHT.glow[c] * h);
    this.btnEmissive.needsUpdate = true;
  }

  /**
   * Le bouton du transport sous la souris (2026-10-22, HOVER_LIGHT) : son id (run, clear, mute, solo, random), null
   * aucun ; true s'il faut une frame.
   */
  setButtonHover(id: string | null): boolean {
    const j = id === 'run' ? RUN : id === 'clear' ? CLEAR : id === 'mute' ? MUTE : id === 'solo' ? SOLO : id === 'random' ? RANDOM : -1;
    const k = j < 0 ? -1 : j - STEP_COUNT;
    if (k === this.btnHover) return false;
    const was = this.btnHover;
    this.btnHover = k;
    if (was >= 0) this.writeButtonGlow(was);
    if (k >= 0) this.writeButtonGlow(k);
    return true;
  }

  /** Temoins de MUTE (voix coupee) et SOLO (solo en cours) ; true s'il faut une frame. */
  /** MUTE et SOLO : leur eclat, 0 a 1 (2026-10-09 : clignotant en attente d'une voix, fixe en MULTI, a peine sinon). */
  /** Et la touche allumee en entier tant qu'elle agit (muteMode, soloMode : 0 ou 1, voices.lit, 2026-10-18). */
  setVoiceKeys(muteOn: boolean | number, soloOn: boolean | number, muteMode = 0, soloMode = 0): boolean {
    const a = this.latch(MUTE, muteOn);
    const b = this.latch(SOLO, soloOn);
    const c = this.mode(MUTE, muteMode);
    const d = this.mode(SOLO, soloMode);
    return a || b || c || d;
  }

  /** Velocite du pas i (0 vide a 9 fort, 2026-10-04) ; sans selection, la plus forte des voix. */
  private programmed(i: number): number {
    const s = this.steps;
    if (!s) return 0;
    if (this.instrument) return velocity(s, this.instrument, i);
    let best = 0;
    for (const k of INSTRUMENTS) {
      const v = velocity(s, k, i);
      if (v > best) best = v;
    }
    return best;
  }

  /**
   * Appui sur le pas i (2026-10-01), v de 0 (repos) a 1 (enfonce) : la
   * touche descend de STEP_PRESS.depth (pas en reduced motion) et
   * s'eclaire. Le Stage l'anime (pressStep).
   */
  setKeyPress(i: number, v: number, move: boolean): void {
    // Les 16 pas et les 5 boutons du transport (2026-10-01 : tous s'enfoncent)
    if (i < 0 || i >= STEP_COUNT + BUTTON_COUNT) return;
    const btn = i >= STEP_COUNT;
    const mesh = btn ? this.buttons : this.keys;
    const j = btn ? i - STEP_COUNT : i;
    const dy = move ? -STEP_PRESS.depth * v : 0;
    mesh.instanceMatrix.array[j * 16 + 13] = dy;
    mesh.instanceMatrix.needsUpdate = true;
    // Le cadre des temps descend avec sa touche
    const f = btn ? -1 : FRAMED.indexOf(j as (typeof FRAMED)[number]);
    if (f >= 0) {
      this.frames.instanceMatrix.array[f * 16 + 13] = dy;
      this.frames.instanceMatrix.needsUpdate = true;
    }
    if (btn) {
      // Le temoin et le nom (2026-10-18) descendent avec leur bouton
      this.btnLeds.instanceMatrix.array[j * 16 + 13] = TRANSPORT.h + BTN_LED.y + dy;
      this.btnLeds.instanceMatrix.needsUpdate = true;
      this.labels.setDy(j, dy);
      this.btnPress[j] = v;
      this.writeButtonGlow(j);
      if (PRESS_TINT.rgb) this.writeButtonColor(j);
      return;
    }
    this.keyPress[j] = v;
    // La marque des verrous descend avec sa touche (2026-10-19)
    this.keyDy[j] = dy;
    if (this.markState[j] !== 0) this.placeMark(j);
    if (PRESS_TINT.rgb) this.writeKeyColor(j);
    this.writeKeyGlow(j);
    this.emissive.needsUpdate = true;
  }

  /** L'enfoncement de chaque pas (la marque des verrous le suit). */
  private keyDy = new Float32Array(STEP_COUNT);

  /**
   * La part de l'orange du dessus du pas i (2026-10-19) : sa velocite
   * (STEP_LIT.ramp, 0 vide) ; EDIT : le pattern courant plein, celui qui attend
   * la mesure, ceux de la chaine, un pattern plein.
   */
  private litOf(i: number): number {
    const v = this.patView;
    if (v) {
      const E = STEP_LIT.edit;
      if (i === v.cur) return E.cur;
      if (i === v.next) return E.next;
      if (v.chain.length > 1 && v.chain.includes(i)) return E.chain;
      return v.filled[i] ? E.filled : 0;
    }
    return STEP_LIT.ramp[this.programmed(i)] ?? 0;
  }

  /**
   * L'emissif du dessus du pas j : l'orange de sa velocite (KEY_LIT.glow.orange
   * a sa part, a l'echelle de KEY_LIT_LIGHT sur la machine claire), plus le
   * blanc chaud de la tete de lecture ; au moins la lueur du survol, celle d'un
   * pas vide verrouille, du pas en LOCK qui clignote, de l'appui.
   */
  /** Le pas j est-il sous la tete de lecture (ou le test de l'intro) ? Jamais dans EDIT. */
  private isHead(j: number): boolean {
    return !this.patView && (j === this.playhead || j === this.introLed);
  }

  private writeKeyGlow(j: number): void {
    const e = this.emissive.array as Float32Array;
    const f = this.litPart[j];
    const o = KEY_LIT.glow.orange;
    const k = KEY_LIT_LIGHT.glow;
    const head = this.isHead(j);
    const add = head ? (f > 0 ? STEP_LIT.head : STEP_LIT.headEmpty) : null;
    const locked = !this.patView && ((this.lockMask >> j) & 1) === 1;
    const floor = !this.patView && j === this.lockStep ? (this.lockBlink ? STEP_LIT.lock : STEP_LIT.lockDim) : locked && f === 0 ? STEP_LIT.locks : j === this.hover && f === 0 ? STEP_LIT.hover : null;
    for (let c = 0; c < 3; c += 1) {
      const lit = o[c] * k * f + (add ? add[c] * k : 0);
      e[j * 3 + c] = Math.max(lit, floor ? floor[c] * k : 0, STEP_PRESS.glow[c] * this.keyPress[j]);
    }
  }

  /**
   * La teinte du pas j : la sienne, l'appui (machine claire), l'orange de la
   * touche allumee (machine claire, KEY_LIT_LIGHT ; un pas a la part de sa
   * velocite dans STEP_LIT.lightRamp, un pattern d'EDIT part de
   * STEP_LIT.lightFloor), la tete de lecture en jaune chaud (machine claire).
   */
  private writeKeyColor(j: number): void {
    const c = this.pressedColor(LIT.key, this.keyPress[j]);
    const lt = KEY_LIT_LIGHT.tint?.orange;
    const f = this.litPart[j];
    // Hors EDIT (relecture du 2026-10-19) : la rampe reguliere de la machine claire (STEP_LIT.lightRamp) ; EDIT : la part du pattern
    const tf = f <= 0 ? 0 : this.patView ? STEP_LIT.lightFloor + (1 - STEP_LIT.lightFloor) * f : (STEP_LIT.lightRamp[this.programmed(j)] ?? 0);
    if (lt && tf > 0) c.setRGB(c.r + (lt[0] - c.r) * tf, c.g + (lt[1] - c.g) * tf, c.b + (lt[2] - c.b) * tf);
    if (lt && this.isHead(j)) {
      const h = STEP_LIT.headLight;
      const m = STEP_LIT.headLightMix;
      c.setRGB(c.r + (h[0] - c.r) * m, c.g + (h[1] - c.g) * m, c.b + (h[2] - c.b) * m);
    }
    this.keys.setColorAt(j, c);
    if (this.keys.instanceColor) this.keys.instanceColor.needsUpdate = true;
  }

  /** La marque des verrous du pas j a sa place (son enfoncement compris), ou cachee. */
  private placeMark(j: number): void {
    if (this.markState[j] === 0) this.lockMarks.setMatrixAt(j, m4.makeScale(0, 0, 0));
    else this.lockMarks.setMatrixAt(j, m4.makeTranslation(keyX(j), MARK_Y + this.keyDy[j], markZ(j)));
    this.lockMarks.instanceMatrix.needsUpdate = true;
  }

  /**
   * Les verrous sur les touches (2026-10-08) : mask, les pas qui en ont ;
   * step, le pas en LOCK (-1 aucun) ; blink, la phase de son clignotement.
   * true s'il faut une frame.
   */
  setLocks(mask: number, step: number, blink: boolean): boolean {
    if (mask === this.lockMask && step === this.lockStep && blink === this.lockBlink) return false;
    this.lockMask = mask;
    this.lockStep = step;
    this.lockBlink = blink;
    this.refresh(true);
    return true;
  }

  /**
   * Rallume les seize pas (2026-10-19) : la part de l'orange, l'emissif, la
   * teinte, la marque des verrous ; true si un pas a change (force : tous
   * reecrits, la tete, le survol ou le LOCK ont bouge).
   */
  private refresh(force = false): boolean {
    let changed = force;
    let marks = false;
    for (let i = 0; i < STEP_COUNT; i += 1) {
      const f = this.litOf(i);
      const part = f !== this.litPart[i];
      if (part) {
        this.litPart[i] = f;
        changed = true;
      }
      // La machine claire : la teinte suit aussi la tete de lecture (force)
      if (KEY_LIT_LIGHT.tint && (part || force)) this.writeKeyColor(i);
      const locked = !this.patView && ((this.lockMask >> i) & 1) === 1;
      // Sombre sur une touche allumee, et sur le pas en LOCK quand il s'allume en jaune
      const bright = f >= MARK_DARK_AT || (i === this.lockStep && this.lockBlink);
      const m = locked ? (bright ? 2 : 1) : 0;
      if (m !== this.markState[i]) {
        const was = this.markState[i];
        this.markState[i] = m;
        if (m !== 0) this.lockMarks.setColorAt(i, m === 2 ? this.markDark : this.markLight);
        if ((m === 0) !== (was === 0)) this.placeMark(i);
        marks = true;
      }
    }
    if (changed) {
      for (let i = 0; i < STEP_COUNT; i += 1) this.writeKeyGlow(i);
      this.emissive.needsUpdate = true;
    }
    if (marks && this.lockMarks.instanceColor) this.lockMarks.instanceColor.needsUpdate = true;
    return changed || marks;
  }

  /** Motif et instrument selectionne (store pattern.ts) ; true s'il faut une frame. */
  setPattern(steps: Steps, instrument: Inst | null): boolean {
    this.steps = steps;
    this.instrument = instrument;
    return this.refresh();
  }

  /** EDIT : la vue des patterns (null : le motif) ; true s'il faut une frame. */
  setPatternView(v: PatternView | null): boolean {
    const a = this.patView;
    if (!a && !v) return false;
    if (a && v && a.cur === v.cur && a.next === v.next && a.chain.join() === v.chain.join() && a.filled.join() === v.filled.join()) return false;
    this.patView = v;
    return this.refresh(true);
  }

  /** Pas survole (pointeur fin), -1 sinon. */
  setHover(i: number): boolean {
    if (i === this.hover) return false;
    this.hover = i;
    return this.refresh(true);
  }

  /** Pas sous la tete de lecture, -1 a l'arret. */
  setPlayhead(i: number): boolean {
    if (i === this.playhead) return false;
    this.playhead = i;
    return this.refresh(true);
  }

  /** Test des LED pendant l'intro : un pas s'eclaire comme sous la tete de lecture, -1 a la fin. */
  setIntroLed(i: number): boolean {
    if (i === this.introLed) return false;
    this.introLed = i;
    return this.refresh(true);
  }

  /** RUN/STOP : son temoin reste allume pendant la lecture ; true s'il faut une frame. */
  setRunning(on: boolean): boolean {
    if (on === this.running) return false;
    this.running = on;
    this.latch(RUN, on);
    return true;
  }

  /** Les 16 touches trig, RUN et CLEAR pour le picking : leurs boites, base a y 0. */
  hotspots(layer: Object3D): HotspotDef[] {
    const defs: HotspotDef[] = [];
    for (let i = 0; i < STEP_COUNT; i += 1) {
      defs.push({
        id: `step-${i + 1}`,
        kind: 'step',
        layer,
        shape: 'box',
        x: keyX(i),
        z: KEYS.z + keyDz(i),
        hx: KEYS.w / 2,
        hz: KEYS.d / 2,
        y0: 0,
        y1: KEYS.h,
        enabled: true,
        index: i,
      });
    }
    // Les touches du transport (2026-10-18 : la forme des touches de page) ; au telephone leur zone deborde devant et
    // derriere elles (TRANSPORT.hitD, environ 40 px au doigt)
    const hx = TRANSPORT.w / 2;
    const hz = TRANSPORT.hitD / 2;
    for (const [id, x] of [
      ['run', TRANSPORT.run.x],
      ['clear', TRANSPORT.clear.x],
      ['mute', TRANSPORT.mute.x],
      ['solo', TRANSPORT.solo.x],
    ] as const) {
      defs.push({ id, kind: id, layer, shape: 'box', x, z: TRANSPORT.z, hx, hz, y0: 0, y1: TRANSPORT.h, enabled: true });
    }
    defs.push({ id: 'random', kind: 'random', layer, shape: 'box', x: TRANSPORT.random.x, z: TRANSPORT.z, hx, hz, y0: 0, y1: TRANSPORT.h, enabled: true });
    return defs;
  }

  info(): SequencerInfo {
    let programmed = '';
    let marks = '';
    const e = this.emissive.array as Float32Array;
    const glow: number[][] = [];
    for (let i = 0; i < STEP_COUNT; i += 1) {
      programmed += String(this.programmed(i));
      marks += String(this.markState[i]);
      glow.push([e[i * 3], e[i * 3 + 1], e[i * 3 + 2]].map((x) => +x.toFixed(4)));
    }
    return {
      lit: Array.from(this.litPart, (v) => +v.toFixed(3)),
      glow,
      marks,
      run: this.running,
      buttonLeds: Array.from({ length: BUTTON_COUNT }, (_, j) => Math.round(this.ledLevel(j) * 100) / 100),
      buttonLit: Array.from({ length: BUTTON_COUNT }, (_, j) => Math.round(this.litLevel(j) * 100) / 100),
      buttonDark: this.labels.litState(),
      playhead: this.playhead,
      hover: this.hover,
      lockMask: this.lockMask,
      lockStep: this.lockStep,
      lockBlink: this.lockBlink,
      programmed,
      instrument: this.instrument,
    };
  }

  dispose(): void {
    this.keys.geometry.dispose();
    this.buttons.geometry.dispose();
    this.keyMat.dispose();
    this.keys.dispose();
    this.buttons.dispose();
    this.btnLeds.geometry.dispose();
    this.ledMat.dispose();
    this.btnLeds.dispose();
    this.lockMarks.geometry.dispose();
    this.markMat.dispose();
    this.lockMarks.dispose();
    this.frames.geometry.dispose();
    this.frameMat.dispose();
    this.frames.dispose();
    this.labels.dispose();
  }
}
