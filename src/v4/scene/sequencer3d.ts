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
 * RUN/STOP est le seul element rouge ; il passe au jaune (emissif) pendant
 * la lecture. Le Stage ne rend une frame que si un trait a change.
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
import { COLOR, KEYS, LIT, MATERIAL, MUTE_GLOW, RUN_GLOW, STEP_PRESS, TRANSPORT, keyX, type Inst } from '../theme';
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

function ledGeometry(): BufferGeometry {
  const g = new PlaneGeometry(KEYS.ledW, KEYS.ledD);
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
  run: 'red' | 'yellow';
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
  private keyMat: MeshStandardMaterial;
  private ledMat: MeshBasicMaterial;
  private emissive: InstancedBufferAttribute;
  private btnEmissive: InstancedBufferAttribute;
  /** teinte de chaque trait, index pas x BARS + trait */
  private ledTone: LedTone[] = [];
  private steps: Steps | null = null;
  private instrument: Inst | null = null;
  private hover = -1;
  private playhead = -1;
  /** LED du test de l'intro (spec 7.4), -1 hors intro */
  private introLed = -1;
  private running = false;
  private muteOn = false;
  private soloOn = false;

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
    const T = TRANSPORT;
    for (const [k, x] of [
      [RUN, T.run.x],
      [CLEAR, T.clear.x],
      [MUTE, T.mute.x],
      [SOLO, T.solo.x],
      [RANDOM, T.random.x],
    ] as const) {
      this.buttons.setMatrixAt(k - STEP_COUNT, m4.makeTranslation(x, 0, T.z));
      this.buttons.setColorAt(k - STEP_COUNT, col.setRGB(LIT.clear[0], LIT.clear[1], LIT.clear[2]));
    }
    this.paintVoiceKey(MUTE, false);
    this.paintVoiceKey(SOLO, false);
    this.paintRun();
    this.buttons.instanceMatrix.needsUpdate = true;
    this.buttons.instanceColor?.setUsage(DynamicDrawUsage);

    this.ledMat = new MeshBasicMaterial({ toneMapped: false });
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

  /**
   * MUTE et SOLO (2026-10-01) : graphite eteints ; allumes, MUTE en orange
   * (la voix selectionnee est coupee), SOLO en jaune (un solo est en cours).
   */
  private paintVoiceKey(k: number, on: boolean): void {
    const c = on ? (k === MUTE ? LIT.muteOn : LIT.runOn) : LIT.clear;
    this.paintButton(k, c, on ? (k === MUTE ? MUTE_GLOW : RUN_GLOW) : [0, 0, 0]);
  }

  /** Teinte et eclat d'un bouton du transport. */
  private paintButton(k: number, c: readonly number[], g: readonly number[]): void {
    const i = k - STEP_COUNT;
    this.buttons.setColorAt(i, col.setRGB(c[0], c[1], c[2]));
    const e = this.btnEmissive.array as Float32Array;
    e[i * 3] = g[0];
    e[i * 3 + 1] = g[1];
    e[i * 3 + 2] = g[2];
    this.btnEmissive.needsUpdate = true;
    if (this.buttons.instanceColor) this.buttons.instanceColor.needsUpdate = true;
  }

  /** Allume MUTE et SOLO ; true s'il faut une frame. */
  setVoiceKeys(muteOn: boolean, soloOn: boolean): boolean {
    if (muteOn === this.muteOn && soloOn === this.soloOn) return false;
    this.muteOn = muteOn;
    this.soloOn = soloOn;
    this.paintVoiceKey(MUTE, muteOn);
    this.paintVoiceKey(SOLO, soloOn);
    return true;
  }

  /** RUN : rouge a l'arret ; jaune et emissif pendant la lecture. */
  private paintRun(): void {
    this.paintButton(RUN, this.running ? LIT.runOn : LIT.run, this.running ? RUN_GLOW : [0, 0, 0]);
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
    // Les 16 pas et RANDOM
    if (i < 0 || (i >= STEP_COUNT && i !== RANDOM)) return;
    const btn = i >= STEP_COUNT;
    const mesh = btn ? this.buttons : this.keys;
    const attr = btn ? this.btnEmissive : this.emissive;
    const j = btn ? i - STEP_COUNT : i;
    mesh.instanceMatrix.array[j * 16 + 13] = move ? -STEP_PRESS.depth * v : 0;
    mesh.instanceMatrix.needsUpdate = true;
    const e = attr.array as Float32Array;
    e[j * 3] = STEP_PRESS.glow[0] * v;
    e[j * 3 + 1] = STEP_PRESS.glow[1] * v;
    e[j * 3 + 2] = STEP_PRESS.glow[2] * v;
    attr.needsUpdate = true;
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

  setRunning(on: boolean): boolean {
    if (on === this.running) return false;
    this.running = on;
    this.paintRun();
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
      run: this.running ? 'yellow' : 'red',
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
    this.ledMat.dispose();
    this.leds.dispose();
  }
}
