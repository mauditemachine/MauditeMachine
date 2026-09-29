/**
 * Zone B : le sequenceur (spec 5.3 et 7.5). Les 16 pas, RUN/STOP et CLEAR
 * sont UN InstancedMesh de cylindres plats (echelle par instance) ; les 16
 * LED au-dessus des pas, UN InstancedMesh de disques a couleur par
 * instance, non eclaires (la teinte affichee est le jeton exact).
 * LED, par priorite : pas en cours pendant la lecture yellowHi, survol
 * (pointeur fin) ledHover, pas programme ledSet (bone 40 %), sinon line.
 * Programme = les coups de l'instrument selectionne ; sans selection,
 * l'union des quatre, pour que le motif par defaut se voie des l'arrivee.
 * RUN/STOP est le seul element rouge ; il passe au jaune (emissif) pendant
 * la lecture. Le meme InstancedMesh porte les cinq LED des knobs de
 * navigation (instances 16 a 20, derriere chaque knob) : eteinte line,
 * allumee yellowHi pour la section ouverte ; pas de draw call de plus. Le
 * bouton OPEN de la zone D (sous l'ecran, dans son cadre jaune serigraphie)
 * est la 19e instance des boutons : graphiteHi comme CLEAR.
 * Le Stage ne rend une frame que si une couleur a change.
 */

import {
  CircleGeometry,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { INSTRUMENTS, STEP_COUNT, type Steps } from '../audio/pattern';
import { COLOR, LIT, NAV_KNOBS, NAV_ROW, RUN_GLOW, SEGMENTS, STEPS, TRANSPORT, stepX, type Inst } from '../theme';
import type { HotspotDef } from './hit';
import { withInstanceEmissive } from './materials';

export type LedTone = 'line' | 'ledSet' | 'ledHover' | 'yellowHi';

/** Instances des boutons : les 16 pas, puis RUN, CLEAR et OPEN. */
const RUN = STEP_COUNT;
const CLEAR = STEP_COUNT + 1;
const OPEN = STEP_COUNT + 2;
const BUTTON_COUNT = STEP_COUNT + 3;
/** LED des knobs de navigation : apres les 16 LED des pas. */
const KNOB_LED0 = STEP_COUNT;
const LED_COUNT = STEP_COUNT + NAV_KNOBS.length;

const LED_HEX: Readonly<Record<LedTone, number>> = {
  line: COLOR.line,
  ledSet: COLOR.ledSet,
  ledHover: COLOR.ledHover,
  yellowHi: COLOR.yellowHi,
};

const m4 = new Matrix4();
const col = new Color();

function buttonGeometry(segments: number): BufferGeometry {
  const g = new CylinderGeometry(1, 1, 1, segments);
  // Base a y 0 : l'echelle par instance donne rayon et hauteur
  g.translate(0, 0.5, 0);
  g.deleteAttribute('uv');
  return g;
}

function ledGeometry(): BufferGeometry {
  const g = new CircleGeometry(STEPS.ledR, SEGMENTS.led);
  // Disque couche, face vers le haut
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
  /** '1' = pas programme selon la regle 7.5 */
  programmed: string;
  instrument: Inst | null;
  /** LED des knobs de navigation, ordre TRACKS a CONTACT : true = allumee */
  knobLeds: boolean[];
}

export class Sequencer3D {
  readonly buttons: InstancedMesh;
  readonly leds: InstancedMesh;
  private buttonMat: MeshStandardMaterial;
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
  private knobLed: boolean[] = NAV_KNOBS.map(() => false);

  constructor(mobile: boolean) {
    const bGeo = buttonGeometry(mobile ? SEGMENTS.button.mobile : SEGMENTS.button.desktop);
    this.emissive = new InstancedBufferAttribute(new Float32Array(BUTTON_COUNT * 3), 3);
    this.emissive.setUsage(DynamicDrawUsage);
    bGeo.setAttribute('instanceEmissive', this.emissive);
    this.buttonMat = withInstanceEmissive(new MeshStandardMaterial({ roughness: 0.6, metalness: 0 }), false);
    this.buttonMat.name = 'button';
    this.buttons = new InstancedMesh(bGeo, this.buttonMat, BUTTON_COUNT);
    this.buttons.name = 'buttons';
    this.buttons.receiveShadow = true;

    for (let i = 0; i < STEP_COUNT; i += 1) {
      this.buttons.setMatrixAt(i, m4.makeScale(STEPS.r, STEPS.h, STEPS.r).setPosition(stepX(i), 0, STEPS.z));
      this.buttons.setColorAt(i, col.setRGB(LIT.step[0], LIT.step[1], LIT.step[2]));
    }
    const run = TRANSPORT.run;
    const clear = TRANSPORT.clear;
    const open = TRANSPORT.open;
    this.buttons.setMatrixAt(RUN, m4.makeScale(run.r, run.h, run.r).setPosition(run.x, 0, run.z));
    this.buttons.setMatrixAt(CLEAR, m4.makeScale(clear.r, clear.h, clear.r).setPosition(clear.x, 0, clear.z));
    this.buttons.setColorAt(CLEAR, col.setRGB(LIT.clear[0], LIT.clear[1], LIT.clear[2]));
    this.buttons.setMatrixAt(OPEN, m4.makeScale(open.r, open.h, open.r).setPosition(open.x, 0, open.z));
    this.buttons.setColorAt(OPEN, col.setRGB(LIT.clear[0], LIT.clear[1], LIT.clear[2]));
    this.paintRun();
    this.buttons.instanceMatrix.needsUpdate = true;
    this.buttons.instanceColor?.setUsage(DynamicDrawUsage);

    this.ledMat = new MeshBasicMaterial({ toneMapped: false });
    this.ledMat.name = 'led';
    this.leds = new InstancedMesh(ledGeometry(), this.ledMat, LED_COUNT);
    this.leds.name = 'leds';
    for (let i = 0; i < STEP_COUNT; i += 1) {
      this.leds.setMatrixAt(i, m4.makeTranslation(stepX(i), STEPS.ledY, STEPS.ledZ));
      this.leds.setColorAt(i, col.setHex(LED_HEX.line));
      this.ledTone.push('line');
    }
    NAV_KNOBS.forEach((k, j) => {
      this.leds.setMatrixAt(KNOB_LED0 + j, m4.makeTranslation(k.x, STEPS.ledY, NAV_ROW.ledZ));
      this.leds.setColorAt(KNOB_LED0 + j, col.setHex(LED_HEX.line));
    });
    this.leds.instanceMatrix.needsUpdate = true;
    this.leds.instanceColor?.setUsage(DynamicDrawUsage);
  }

  /** RUN : rouge a l'arret ; jaune et emissif pendant la lecture. */
  private paintRun(): void {
    const c = this.running ? LIT.runOn : LIT.run;
    this.buttons.setColorAt(RUN, col.setRGB(c[0], c[1], c[2]));
    const e = this.emissive.array as Float32Array;
    const g = this.running ? RUN_GLOW : [0, 0, 0];
    e[RUN * 3] = g[0];
    e[RUN * 3 + 1] = g[1];
    e[RUN * 3 + 2] = g[2];
    this.emissive.needsUpdate = true;
    if (this.buttons.instanceColor) this.buttons.instanceColor.needsUpdate = true;
  }

  private programmed(i: number): boolean {
    const s = this.steps;
    if (!s) return false;
    if (this.instrument) return s[this.instrument].charCodeAt(i) === 49;
    for (const k of INSTRUMENTS) if (s[k].charCodeAt(i) === 49) return true;
    return false;
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
            : this.programmed(i)
              ? 'ledSet'
              : 'line';
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

  /** LED du knob de navigation j (0 = TRACKS) ; true s'il faut une frame. */
  setKnobLed(j: number, on: boolean): boolean {
    if (j < 0 || j >= this.knobLed.length || this.knobLed[j] === on) return false;
    this.knobLed[j] = on;
    this.leds.setColorAt(KNOB_LED0 + j, col.setHex(on ? LED_HEX.yellowHi : LED_HEX.line));
    if (this.leds.instanceColor) this.leds.instanceColor.needsUpdate = true;
    return true;
  }

  /** Les 16 pas, RUN et CLEAR pour le picking : disques de leur rayon, base a y 0. */
  hotspots(layer: Object3D): HotspotDef[] {
    const defs: HotspotDef[] = [];
    for (let i = 0; i < STEP_COUNT; i += 1) {
      defs.push({
        id: `step-${i + 1}`,
        kind: 'step',
        layer,
        shape: 'disc',
        x: stepX(i),
        z: STEPS.z,
        hx: STEPS.r,
        hz: STEPS.r,
        y0: 0,
        y1: STEPS.h,
        enabled: true,
        index: i,
      });
    }
    for (const [id, t] of [
      ['run', TRANSPORT.run],
      ['clear', TRANSPORT.clear],
    ] as const) {
      defs.push({ id, kind: id, layer, shape: 'disc', x: t.x, z: t.z, hx: t.r, hz: t.r, y0: 0, y1: t.h, enabled: true });
    }
    return defs;
  }

  /** OPEN (zone D) pour le picking ; ajoute apres les knobs de navigation (ordre de tabulation, spec 6.1). */
  openHotspot(layer: Object3D): HotspotDef {
    const t = TRANSPORT.open;
    return { id: 'open', kind: 'open', layer, shape: 'disc', x: t.x, z: t.z, hx: t.r, hz: t.r, y0: 0, y1: t.h, enabled: true };
  }

  info(): SequencerInfo {
    let programmed = '';
    for (let i = 0; i < STEP_COUNT; i += 1) programmed += this.programmed(i) ? '1' : '0';
    return {
      leds: [...this.ledTone],
      run: this.running ? 'yellow' : 'red',
      playhead: this.playhead,
      hover: this.hover,
      programmed,
      instrument: this.instrument,
      knobLeds: [...this.knobLed],
    };
  }

  dispose(): void {
    this.buttons.geometry.dispose();
    this.buttonMat.dispose();
    this.buttons.dispose();
    this.leds.geometry.dispose();
    this.ledMat.dispose();
    this.leds.dispose();
  }
}
