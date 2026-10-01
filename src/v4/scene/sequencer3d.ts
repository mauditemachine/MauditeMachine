/**
 * Le sequenceur (spec 7.5 et 20.3.6) : les 16 touches trig etroites du bas
 * du panneau, RUN/STOP, CLEAR, MUTE, SOLO et RANDOM (boutons carres) sont
 * UN InstancedMesh de boites a coins arrondis (echelle par instance) ; les
 * traits de velocite au-dessus des touches, UN InstancedMesh de petits
 * rectangles a couleur par instance, non eclaires (la teinte affichee est
 * le jeton exact).
 *
 * Velocite (2026-10-01) : trois traits par pas, empiles vers l'arriere,
 * la LED du bas comprise. Fort : trois traits ledSet, moyen deux, doux un ;
 * un pas vide ne garde que la LED du bas, eteinte (line), les deux autres
 * disparaissent. Le compte se lit quel que soit l'etat : pendant la lecture
 * les traits du pas en cours passent en yellowHi (la LED du bas seule sur
 * un pas vide) ; le survol (pointeur fin) n'eclaire que la LED du bas d'un
 * pas vide, en ledHover. Avant, la LED unique changeait de teinte selon la
 * velocite et le survol la recouvrait : on ne voyait plus ce qu'on venait
 * de poser.
 * Programme = les coups de l'instrument selectionne ; sans selection, le
 * plus fort des cinq, pour que le motif par defaut se voie des l'arrivee.
 * RUN/STOP est le seul element rouge. Temoins du transport (2026-10-01,
 * maillage btnLeds) : un fin trait sur le dessus de chaque bouton, allume
 * pour RUN/STOP en lecture, MUTE et SOLO actifs, un eclair a chaque appui
 * (le seul signe de CLEAR et RANDOM). Le Stage ne rend une frame que si un
 * trait a change.
 */

import {
  Color,
  DynamicDrawUsage,
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
import { INSTRUMENTS, STEP_COUNT, VEL_BARS, velocity, type Steps } from '../audio/pattern';
import { BTN_LED, COLOR, KEYS, LIT, MATERIAL, PRESS_TINT, STEP_PRESS, TRANSPORT, keyX, type Inst } from '../theme';
import type { HotspotDef } from './hit';
import { withInstanceEmissive } from './materials';

/** Teinte d'un trait ; 'none' : trait cache (au-dessus de la LED du bas, pas assez fort). */
export type LedTone = 'line' | 'ledSet' | 'ledHover' | 'yellowHi' | 'none';

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
/** z du temoin : sur le dessus, pres du bord arriere. */
const BTN_LED_Z = TRANSPORT.z - TRANSPORT.size / 2 + BTN_LED.back;

const BARS = KEYS.velBars;

/** Teintes des traits, lues a la construction (l'apparence claire change line et ledHover). */
let LED_HEX: Readonly<Record<Exclude<LedTone, 'none'>, number>> = { line: 0, ledSet: 0, ledHover: 0, yellowHi: 0 };

/** z du trait b d'un pas (0 : la LED du bas). */
const barZ = (b: number): number => KEYS.ledZ - KEYS.velPitch * b;

const m4 = new Matrix4();
const col = new Color();

/** Touche trig : boite a coins arrondis (trois segments : 588 triangles ; deux sur mobile : 300), base a y 0. */
function keyGeometry(mobile: boolean): BufferGeometry {
  const g = new RoundedBoxGeometry(KEYS.w, KEYS.h, KEYS.d, mobile ? KEYS.segments.mobile : KEYS.segments.desktop, KEYS.radius);
  g.translate(0, KEYS.h / 2, 0);
  g.deleteAttribute('uv');
  return g;
}

/** Bouton carre du transport (2026-10-01), memes arrondis que les touches, base a y 0. */
function buttonGeometry(mobile: boolean): BufferGeometry {
  const T = TRANSPORT;
  const g = new RoundedBoxGeometry(T.size, T.h, T.size, mobile ? KEYS.segments.mobile : KEYS.segments.desktop, T.radius);
  g.translate(0, T.h / 2, 0);
  g.deleteAttribute('uv');
  return g;
}

function ledGeometry(w: number = KEYS.ledW, d: number = KEYS.ledD): BufferGeometry {
  const g = new PlaneGeometry(w, d);
  // Rectangle couche, face vers le haut
  g.rotateX(-Math.PI / 2);
  g.deleteAttribute('uv');
  return g;
}

export interface SequencerInfo {
  /** couleur de la LED du bas de chaque pas, pas 1 a 16 */
  leds: LedTone[];
  /** traits allumes de chaque pas (0 a 3), pas 1 a 16 */
  bars: string;
  /** teinte de chaque trait, pas par pas, du bas vers le haut */
  barTones: LedTone[][];
  run: boolean;
  /** eclat du temoin de chaque bouton (0 a 1) : RUN, CLEAR, MUTE, SOLO, RANDOM */
  buttonLeds: number[];
  playhead: number;
  hover: number;
  /** velocite de chaque pas selon la regle 7.5 (0 vide, 1 fort, 2 moyen, 3 doux) */
  programmed: string;
  instrument: Inst | null;
}

export class Sequencer3D {
  readonly keys: InstancedMesh;
  readonly buttons: InstancedMesh;
  readonly leds: InstancedMesh;
  /** les temoins du transport, un trait par bouton */
  readonly btnLeds: InstancedMesh;
  private keyMat: MeshStandardMaterial;
  private ledMat: MeshBasicMaterial;
  private emissive: InstancedBufferAttribute;
  private btnEmissive: InstancedBufferAttribute;
  /** appui en cours de chaque bouton (0 a 1) */
  private btnPress = new Float32Array(BUTTON_COUNT);
  /** temoins : etat tenu (RUN qui joue, MUTE, SOLO) et eclair d'appui (0 a 1) */
  private btnLatch = new Uint8Array(BUTTON_COUNT);
  private btnFlash = new Float32Array(BUTTON_COUNT);
  private btnLedOff = new Color();
  private btnLedOn = new Color();
  /** RUN est rouge : son temoin passe au jaune (l'orange s'y perdait) */
  private runLedOn = new Color();
  /** teinte propre de chaque bouton (l'appui la tire vers PRESS_TINT en mode clair) */
  private btnColor = new Float32Array(BUTTON_COUNT * 3);
  /** teinte de chaque trait, index pas x BARS + trait */
  private ledTone: LedTone[] = [];
  private steps: Steps | null = null;
  private instrument: Inst | null = null;
  private hover = -1;
  private playhead = -1;
  /** LED du test de l'intro (spec 7.4), -1 hors intro */
  private introLed = -1;
  private running = false;

  constructor(opts: { mobile: boolean } = { mobile: false }) {
    LED_HEX = { line: COLOR.line, ledSet: COLOR.ledSet, ledHover: COLOR.ledHover, yellowHi: COLOR.yellowHi };
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
      this.keys.setMatrixAt(i, m4.makeTranslation(keyX(i), 0, KEYS.z));
      this.keys.setColorAt(i, col.setRGB(LIT.key[0], LIT.key[1], LIT.key[2]));
    }
    this.keys.instanceMatrix.needsUpdate = true;
    this.keys.instanceColor?.setUsage(DynamicDrawUsage);

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
    this.btnLeds = new InstancedMesh(ledGeometry(BTN_LED.w, BTN_LED.d), this.ledMat, BUTTON_COUNT);
    this.btnLeds.name = 'btnLeds';
    for (let j = 0; j < BUTTON_COUNT; j += 1) {
      this.btnLeds.setMatrixAt(j, m4.makeTranslation(BUTTON_X[j], TRANSPORT.h + BTN_LED.y, BTN_LED_Z));
      this.paintButtonLed(j);
    }
    this.btnLeds.instanceMatrix.needsUpdate = true;
    this.btnLeds.instanceColor?.setUsage(DynamicDrawUsage);

    this.ledMat.name = 'led';
    this.leds = new InstancedMesh(ledGeometry(), this.ledMat, STEP_COUNT * BARS);
    this.leds.name = 'leds';
    for (let i = 0; i < STEP_COUNT; i += 1) {
      for (let b = 0; b < BARS; b += 1) {
        const k = i * BARS + b;
        // Au repos : la LED du bas eteinte, les traits du dessus caches
        this.leds.setMatrixAt(k, b === 0 ? m4.makeTranslation(keyX(i), KEYS.ledY, barZ(b)) : m4.makeScale(0, 0, 0));
        this.leds.setColorAt(k, col.setHex(LED_HEX.line));
        this.ledTone.push(b === 0 ? 'line' : 'none');
      }
    }
    this.leds.instanceMatrix.needsUpdate = true;
    this.leds.instanceColor?.setUsage(DynamicDrawUsage);
  }

  /** Teinte d'un bouton du transport (l'appui en cours s'y ajoute). */
  private paintButton(k: number, c: readonly number[]): void {
    const i = k - STEP_COUNT;
    this.btnColor.set([c[0], c[1], c[2]], i * 3);
    this.buttons.setColorAt(i, this.pressedColor(c, this.btnPress[i]));
    this.writeButtonGlow(i);
    if (this.buttons.instanceColor) this.buttons.instanceColor.needsUpdate = true;
  }

  /** Eclat du temoin j : allume si son etat tient, sinon son eclair d'appui. */
  private ledLevel(j: number): number {
    return this.btnLatch[j] ? 1 : this.btnFlash[j];
  }

  private paintButtonLed(j: number): void {
    const on = j + STEP_COUNT === RUN ? this.runLedOn : this.btnLedOn;
    this.btnLeds.setColorAt(j, col.copy(this.btnLedOff).lerp(on, this.ledLevel(j)));
    if (this.btnLeds.instanceColor) this.btnLeds.instanceColor.needsUpdate = true;
  }

  /** Etat tenu du temoin du bouton k ; true s'il a change. */
  private latch(k: number, on: boolean): boolean {
    const j = k - STEP_COUNT;
    if (Boolean(this.btnLatch[j]) === on) return false;
    this.btnLatch[j] = on ? 1 : 0;
    this.paintButtonLed(j);
    return true;
  }

  /** Eclair d'appui du temoin d'un bouton, v de 1 (appui) a 0 (le Stage l'anime). */
  setButtonFlash(b: TransportButton, v: number): void {
    const j = BUTTON_INDEX[b] - STEP_COUNT;
    this.btnFlash[j] = v;
    this.paintButtonLed(j);
  }

  /** Teinte affichee : la sienne, tiree vers l'orange de l'appui en mode clair. */
  private pressedColor(c: ArrayLike<number>, v: number): Color {
    const t = PRESS_TINT.rgb;
    if (!t || v <= 0) return col.setRGB(c[0], c[1], c[2]);
    return col.setRGB(c[0] + (t[0] - c[0]) * v, c[1] + (t[1] - c[1]) * v, c[2] + (t[2] - c[2]) * v);
  }

  /** Eclat d'un bouton : celui de l'appui. */
  private writeButtonGlow(i: number): void {
    const e = this.btnEmissive.array as Float32Array;
    const v = this.btnPress[i];
    for (let c = 0; c < 3; c += 1) e[i * 3 + c] = STEP_PRESS.glow[c] * v;
    this.btnEmissive.needsUpdate = true;
  }

  /** Temoins de MUTE (voix coupee) et SOLO (solo en cours) ; true s'il faut une frame. */
  setVoiceKeys(muteOn: boolean, soloOn: boolean): boolean {
    const a = this.latch(MUTE, muteOn);
    const b = this.latch(SOLO, soloOn);
    return a || b;
  }

  /** Velocite du pas i (0 vide, 1 fort, 2 moyen, 3 doux) ; sans selection, la plus forte des voix. */
  private programmed(i: number): number {
    const s = this.steps;
    if (!s) return 0;
    if (this.instrument) return velocity(s, this.instrument, i);
    let best = 0;
    for (const k of INSTRUMENTS) {
      const v = velocity(s, k, i);
      if (v > 0 && (best === 0 || v < best)) best = v;
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
    if (btn) {
      // Le temoin descend avec son bouton
      this.btnLeds.instanceMatrix.array[j * 16 + 13] = TRANSPORT.h + BTN_LED.y + dy;
      this.btnLeds.instanceMatrix.needsUpdate = true;
      this.btnPress[j] = v;
      this.writeButtonGlow(j);
      if (PRESS_TINT.rgb) {
        this.buttons.setColorAt(j, this.pressedColor(this.btnColor.subarray(j * 3, j * 3 + 3), v));
        if (this.buttons.instanceColor) this.buttons.instanceColor.needsUpdate = true;
      }
      return;
    }
    if (PRESS_TINT.rgb) {
      this.keys.setColorAt(j, this.pressedColor(LIT.key, v));
      if (this.keys.instanceColor) this.keys.instanceColor.needsUpdate = true;
    }
    const e = this.emissive.array as Float32Array;
    e[j * 3] = STEP_PRESS.glow[0] * v;
    e[j * 3 + 1] = STEP_PRESS.glow[1] * v;
    e[j * 3 + 2] = STEP_PRESS.glow[2] * v;
    this.emissive.needsUpdate = true;
  }

  /** Teinte du trait b du pas i (regle de l'en-tete). */
  private barTone(i: number, b: number): LedTone {
    const n = VEL_BARS[this.programmed(i)];
    const head = i === this.playhead || i === this.introLed;
    if (b < n) return head ? 'yellowHi' : 'ledSet';
    if (b > 0) return 'none';
    return head ? 'yellowHi' : i === this.hover ? 'ledHover' : 'line';
  }

  /** Recolore les traits ; true si un trait a change. */
  private refresh(): boolean {
    let colors = false;
    let shapes = false;
    for (let i = 0; i < STEP_COUNT; i += 1) {
      for (let b = 0; b < BARS; b += 1) {
        const k = i * BARS + b;
        const tone = this.barTone(i, b);
        const was = this.ledTone[k];
        if (tone === was) continue;
        this.ledTone[k] = tone;
        if ((tone === 'none') !== (was === 'none')) {
          this.leds.setMatrixAt(k, tone === 'none' ? m4.makeScale(0, 0, 0) : m4.makeTranslation(keyX(i), KEYS.ledY, barZ(b)));
          shapes = true;
        }
        if (tone !== 'none') {
          this.leds.setColorAt(k, col.setHex(LED_HEX[tone]));
          colors = true;
        }
      }
    }
    if (colors && this.leds.instanceColor) this.leds.instanceColor.needsUpdate = true;
    if (shapes) this.leds.instanceMatrix.needsUpdate = true;
    return colors || shapes;
  }

  /** Motif et instrument selectionne (store pattern.ts) ; true s'il faut une frame. */
  setPattern(steps: Steps, instrument: Inst | null): boolean {
    this.steps = steps;
    this.instrument = instrument;
    return this.refresh();
  }

  /** Pas survole (pointeur fin), -1 sinon. */
  setHover(i: number): boolean {
    if (i === this.hover) return false;
    this.hover = i;
    return this.refresh();
  }

  /** Pas sous la tete de lecture, -1 a l'arret. */
  setPlayhead(i: number): boolean {
    if (i === this.playhead) return false;
    this.playhead = i;
    return this.refresh();
  }

  /** Test des LED pendant l'intro : une LED yellowHi, -1 a la fin. */
  setIntroLed(i: number): boolean {
    if (i === this.introLed) return false;
    this.introLed = i;
    return this.refresh();
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
        z: KEYS.z,
        hx: KEYS.w / 2,
        hz: KEYS.d / 2,
        y0: 0,
        y1: KEYS.h,
        enabled: true,
        index: i,
      });
    }
    const h = TRANSPORT.size / 2;
    for (const [id, x] of [
      ['run', TRANSPORT.run.x],
      ['clear', TRANSPORT.clear.x],
      ['mute', TRANSPORT.mute.x],
      ['solo', TRANSPORT.solo.x],
    ] as const) {
      defs.push({ id, kind: id, layer, shape: 'box', x, z: TRANSPORT.z, hx: h, hz: h, y0: 0, y1: TRANSPORT.h, enabled: true });
    }
    defs.push({ id: 'random', kind: 'random', layer, shape: 'box', x: TRANSPORT.random.x, z: TRANSPORT.z, hx: h, hz: h, y0: 0, y1: TRANSPORT.h, enabled: true });
    return defs;
  }

  info(): SequencerInfo {
    let programmed = '';
    let bars = '';
    const barTones: LedTone[][] = [];
    for (let i = 0; i < STEP_COUNT; i += 1) {
      programmed += String(this.programmed(i));
      bars += String(VEL_BARS[this.programmed(i)]);
      barTones.push(this.ledTone.slice(i * BARS, i * BARS + BARS));
    }
    return {
      leds: barTones.map((t) => t[0]),
      bars,
      barTones,
      run: this.running,
      buttonLeds: Array.from({ length: BUTTON_COUNT }, (_, j) => Math.round(this.ledLevel(j) * 100) / 100),
      playhead: this.playhead,
      hover: this.hover,
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
    this.leds.geometry.dispose();
    this.btnLeds.geometry.dispose();
    this.ledMat.dispose();
    this.leds.dispose();
    this.btnLeds.dispose();
  }
}
