/**
 * Le sequenceur (spec 7.5 et 20.3.6) : les 16 touches trig etroites du bas
 * du panneau, RUN/STOP et CLEAR (les deux boutons carres sous les
 * encodeurs) sont UN InstancedMesh de 18 boites a coins arrondis (echelle
 * par instance) ; les 16 LED au-dessus des touches, UN InstancedMesh de
 * petits rectangles a couleur par instance, non eclaires (la teinte
 * affichee est le jeton exact).
 * LED, par priorite : pas en cours pendant la lecture yellowHi, survol
 * (pointeur fin) ledHover, pas programme ledSet, sinon line. Programme =
 * les coups de l'instrument selectionne ; sans selection, l'union des
 * quatre, pour que le motif par defaut se voie des l'arrivee. RUN/STOP est
 * le seul element rouge ; il passe au jaune (emissif) pendant la lecture.
 * Le Stage ne rend une frame que si une couleur a change.
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
import { INSTRUMENTS, STEP_COUNT, velocity, type Steps } from '../audio/pattern';
import { COLOR, KEYS, LIT, MATERIAL, MUTE_GLOW, RUN_GLOW, STEP_PRESS, TRANSPORT, keyX, type Inst } from '../theme';
import type { HotspotDef } from './hit';
import { withInstanceEmissive } from './materials';

export type LedTone = 'line' | 'ledSet' | 'ledMid' | 'ledLow' | 'ledHover' | 'yellowHi';

/** Instances des touches : les 16 trig, puis RUN, CLEAR, MUTE et SOLO. */
const RUN = STEP_COUNT;
const CLEAR = STEP_COUNT + 1;
const MUTE = STEP_COUNT + 2;
const SOLO = STEP_COUNT + 3;
const KEY_COUNT = STEP_COUNT + 4;

const LED_HEX: Readonly<Record<LedTone, number>> = {
  line: COLOR.line,
  ledSet: COLOR.ledSet,
  ledMid: COLOR.ledMid,
  ledLow: COLOR.ledLow,
  ledHover: COLOR.ledHover,
  yellowHi: COLOR.yellowHi,
};

/** Couleur de LED par velocite : vide, fort, moyen, doux. */
const LED_BY_VEL: readonly LedTone[] = ['line', 'ledSet', 'ledMid', 'ledLow'];

const m4 = new Matrix4();
const col = new Color();

/** Touche trig : boite a coins arrondis (un segment : 108 triangles), base a y 0. */
function keyGeometry(): BufferGeometry {
  const g = new RoundedBoxGeometry(KEYS.w, KEYS.h, KEYS.d, 1, KEYS.radius);
  g.translate(0, KEYS.h / 2, 0);
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
  /** couleur de chaque LED, pas 1 a 16 */
  leds: LedTone[];
  run: 'red' | 'yellow';
  playhead: number;
  hover: number;
  /** velocite de chaque pas selon la regle 7.5 (0 vide, 1 fort, 2 moyen, 3 doux) */
  programmed: string;
  instrument: Inst | null;
}

export class Sequencer3D {
  readonly keys: InstancedMesh;
  readonly leds: InstancedMesh;
  private keyMat: MeshStandardMaterial;
  private ledMat: MeshBasicMaterial;
  private emissive: InstancedBufferAttribute;
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

  constructor() {
    const kGeo = keyGeometry();
    this.emissive = new InstancedBufferAttribute(new Float32Array(KEY_COUNT * 3), 3);
    this.emissive.setUsage(DynamicDrawUsage);
    kGeo.setAttribute('instanceEmissive', this.emissive);
    this.keyMat = withInstanceEmissive(new MeshStandardMaterial({ ...MATERIAL.key }), false);
    this.keyMat.name = 'key';
    this.keys = new InstancedMesh(kGeo, this.keyMat, KEY_COUNT);
    this.keys.name = 'keys';
    this.keys.receiveShadow = true;

    for (let i = 0; i < STEP_COUNT; i += 1) {
      this.keys.setMatrixAt(i, m4.makeTranslation(keyX(i), 0, KEYS.z));
      this.keys.setColorAt(i, col.setRGB(LIT.key[0], LIT.key[1], LIT.key[2]));
    }
    // RUN et CLEAR : la meme boite, carree par l'echelle
    const sx = TRANSPORT.size / KEYS.w;
    const sy = TRANSPORT.h / KEYS.h;
    const sz = TRANSPORT.size / KEYS.d;
    this.keys.setMatrixAt(RUN, m4.makeScale(sx, sy, sz).setPosition(TRANSPORT.run.x, 0, TRANSPORT.z));
    this.keys.setMatrixAt(CLEAR, m4.makeScale(sx, sy, sz).setPosition(TRANSPORT.clear.x, 0, TRANSPORT.z));
    this.keys.setColorAt(CLEAR, col.setRGB(LIT.clear[0], LIT.clear[1], LIT.clear[2]));
    this.keys.setMatrixAt(MUTE, m4.makeScale(sx, sy, sz).setPosition(TRANSPORT.mute.x, 0, TRANSPORT.z));
    this.keys.setMatrixAt(SOLO, m4.makeScale(sx, sy, sz).setPosition(TRANSPORT.solo.x, 0, TRANSPORT.z));
    this.paintVoiceKey(MUTE, false);
    this.paintVoiceKey(SOLO, false);
    this.paintRun();
    this.keys.instanceMatrix.needsUpdate = true;
    this.keys.instanceColor?.setUsage(DynamicDrawUsage);

    this.ledMat = new MeshBasicMaterial({ toneMapped: false });
    this.ledMat.name = 'led';
    this.leds = new InstancedMesh(ledGeometry(), this.ledMat, STEP_COUNT);
    this.leds.name = 'leds';
    for (let i = 0; i < STEP_COUNT; i += 1) {
      this.leds.setMatrixAt(i, m4.makeTranslation(keyX(i), KEYS.ledY, KEYS.ledZ));
      this.leds.setColorAt(i, col.setHex(LED_HEX.line));
      this.ledTone.push('line');
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
    this.keys.setColorAt(k, col.setRGB(c[0], c[1], c[2]));
    const e = this.emissive.array as Float32Array;
    const g = on ? (k === MUTE ? MUTE_GLOW : RUN_GLOW) : [0, 0, 0];
    e[k * 3] = g[0];
    e[k * 3 + 1] = g[1];
    e[k * 3 + 2] = g[2];
    this.emissive.needsUpdate = true;
    if (this.keys.instanceColor) this.keys.instanceColor.needsUpdate = true;
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
    const c = this.running ? LIT.runOn : LIT.run;
    this.keys.setColorAt(RUN, col.setRGB(c[0], c[1], c[2]));
    const e = this.emissive.array as Float32Array;
    const g = this.running ? RUN_GLOW : [0, 0, 0];
    e[RUN * 3] = g[0];
    e[RUN * 3 + 1] = g[1];
    e[RUN * 3 + 2] = g[2];
    this.emissive.needsUpdate = true;
    if (this.keys.instanceColor) this.keys.instanceColor.needsUpdate = true;
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
    if (i < 0 || i >= STEP_COUNT) return;
    this.keys.instanceMatrix.array[i * 16 + 13] = move ? -STEP_PRESS.depth * v : 0;
    this.keys.instanceMatrix.needsUpdate = true;
    const e = this.emissive.array as Float32Array;
    e[i * 3] = STEP_PRESS.glow[0] * v;
    e[i * 3 + 1] = STEP_PRESS.glow[1] * v;
    e[i * 3 + 2] = STEP_PRESS.glow[2] * v;
    this.emissive.needsUpdate = true;
  }

  /** Recolore les LED selon la regle 7.5 ; true si une couleur a change. */
  private refresh(): boolean {
    let changed = false;
    for (let i = 0; i < STEP_COUNT; i += 1) {
      const tone: LedTone =
        i === this.playhead || i === this.introLed
          ? 'yellowHi'
          : i === this.hover
            ? 'ledHover'
            : LED_BY_VEL[this.programmed(i)];
      if (tone === this.ledTone[i]) continue;
      this.ledTone[i] = tone;
      this.leds.setColorAt(i, col.setHex(LED_HEX[tone]));
      changed = true;
    }
    if (changed && this.leds.instanceColor) this.leds.instanceColor.needsUpdate = true;
    return changed;
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
    return defs;
  }

  info(): SequencerInfo {
    let programmed = '';
    for (let i = 0; i < STEP_COUNT; i += 1) programmed += String(this.programmed(i));
    return {
      leds: [...this.ledTone],
      run: this.running ? 'yellow' : 'red',
      playhead: this.playhead,
      hover: this.hover,
      programmed,
      instrument: this.instrument,
    };
  }

  dispose(): void {
    this.keys.geometry.dispose();
    this.keyMat.dispose();
    this.keys.dispose();
    this.leds.geometry.dispose();
    this.ledMat.dispose();
    this.leds.dispose();
  }
}
