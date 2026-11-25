/**
 * La face du plugin, v27 (2026-11-17 ; la maquette v26 validee par Mika : "ok code et publie") :
 * - les petits knobs canneles en 3D dans la scene (FM, RATIO, OSC 1, OSC 2, NOISE, SUB, SUB WAVE ; DETUNE et SPREAD) :
 *   une prise noire a 30 cannelures et un moletage fin, un dessus plat un peu plus clair, un repere blanc du centre au bord.
 *   Ils tournent avec leur reglage ; les potards du MM-RYTM a leur place sont caches (voyager/knobs.ts FLUTED_DIALS), leurs
 *   zones de prise restent (le geste de toujours, la valeur sur l'ecran, l'arc de modulation : FaceModArcs.tsx) ;
 * - SUB OCT devient un levier 3D : une fente noire arrondie, une capsule chrome couchee a gauche (-1) ou a droite (-2) ;
 *   la zone de prise du poussoir d'avant reste (un clic bascule) ;
 * - DETUNE (STACK) et SPREAD (WIDE) dans la colonne OUTPUT, sous le logotype, relies par un trait (49.jpg) : des zones de
 *   prise de potards du MM-ARP (v:stack, v:wide) ;
 * - l'encart d'EDIT : les sections synthe de l'ancienne page SOUND (OSCILLATORS, OSC +, VOICE, FILTER, FILTER +, AMP,
 *   PERFORMANCE, OUTPUT) sur un panneau noir qui monte a la place des pads, en deux rangees, avec des petits knobs, des
 *   leviers et des touches 3D, leurs noms serigraphies ; chaque piece a sa zone de prise (un DialId z:ed:<id>, comme
 *   HELL) : glisser regle, un clic bascule un levier ou passe une touche au cran suivant (hellKnob.tsx faceDbl), la
 *   valeur s'ecrit sur l'ecran de la machine. Les notes de la suite vont a la page SEQ : le verre ne prend plus de geste.
 * - v46 : l'encart a trois pages, une bascule SYNTH | LFO | FX MOD a sa gauche (encartPage) : SYNTH (ce qui precede,
 *   resserre), LFO (les quatre LFO facon MOD, le potard k1 de la face), FX MOD (PHASER, FLANGER, CHORUS, PUMP).
 * - v50 (Mika : "C et SQ ok, go") : quatre pages, SYNTH | LFO | SQ | FX MOD, touches mates a LED (encart50.ts) : LFO = les
 *   quatre LFO generiques et la MOD MATRIX (option C), SQ = le sequenceur en petit ; FX MOD y gagne HELL WARP / SPIN (HELL
 *   v2) ou HELL LFO (l'ancien HELL). La section MOD quitte la face (voyager/params.ts, voyager/theme.ts).
 */

import { useEffect } from 'react';
import {
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  EquirectangularReflectionMapping,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Shape,
  SRGBColorSpace,
  Vector2,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Stage } from '../../scene/renderer';
import type { HotspotDef } from '../../scene/hit';
import { potAngle } from '../../scene/encoders';
import { registerDialSpec } from '../../scene/screen/menus/registry';
import { editor } from '../../state/editor';
import { FONT_DISPLAY, PORTRAIT, type EncId } from '../../theme';
import { FLUTED_DIALS } from '../../voyager/knobs';
import { paintLed } from '../../voyager/ledLens';
import { VIVID } from '../../voyager/vivid';
import { voyMsg } from '../../voyager/msg';
import { voyKnob, voyParams, voyValueText, type VoyKnobId } from '../../voyager/params';
import { VOY_SEQ } from '../../voyager/seqscreen';
import { voySilkExtraKnob } from '../../voyager/silk';
import { VOY_DS_PLACE, VOY_HELL_PLACE, VOY_KNOB, voyKnobPlace } from '../../voyager/theme';
import { RYTM_KNOB } from '../../voyager/rytmKnob';
import { extHead } from '../head';
import { arpExtra, extraParam, isExtra } from './extra';
import { look } from './look';
import { VKnobSet } from './vknob';
import { VKNOB_LIFT, attachVKnobs } from './vknobFace';
import { accent50, aimParamOf50, key50, LED_HALO_50, lfoPage50, sqPage50, sqSources, tabs50, tap50, TABS50, type Key50, type Page50 } from './encart50';
import { aimSourceName, modAim, modView } from './modRoutes';
import { modDestCodeOf } from './modTable';

voySilkExtraKnob('panel', 'DETUNE', VOY_DS_PLACE.detune.x, VOY_DS_PLACE.detune.labelZ);
voySilkExtraKnob('panel', 'SPREAD', VOY_DS_PLACE.spread.x, VOY_DS_PLACE.spread.labelZ);

/* ---------------- les environnements (reflets) ---------------- */

function equirect(draw: (g: CanvasRenderingContext2D) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  draw(c.getContext('2d')!);
  const t = new CanvasTexture(c);
  t.mapping = EquirectangularReflectionMapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}
/** Le noir des knobs : un studio sombre, une bande claire sous l'horizon (les flancs canneles en pente l'accrochent). */
const knobEnv = (): CanvasTexture =>
  equirect((g) => {
    const v = g.createLinearGradient(0, 0, 0, 512);
    v.addColorStop(0, '#2a2928');
    v.addColorStop(0.4, '#1a1918');
    v.addColorStop(0.55, '#3a3836');
    v.addColorStop(0.66, '#c4c1bc');
    v.addColorStop(0.74, '#3a3836');
    v.addColorStop(1, '#0a0a0a');
    g.fillStyle = v;
    g.fillRect(0, 0, 1024, 512);
  });
/** Le chrome : un ciel clair, une bande nette pres du zenith, un horizon noir, une lumiere a gauche. */
const chromeEnv = (): CanvasTexture =>
  equirect((g) => {
    const v = g.createLinearGradient(0, 0, 0, 512);
    v.addColorStop(0, '#eeede9');
    v.addColorStop(0.08, '#e2e0dc');
    v.addColorStop(0.13, '#c4c2be');
    v.addColorStop(0.2, '#9a9894');
    v.addColorStop(0.3, '#6a6866');
    v.addColorStop(0.4, '#3a3836');
    v.addColorStop(0.5, '#0a0a0a');
    v.addColorStop(0.6, '#1a1a1a');
    v.addColorStop(1, '#4a4846');
    g.fillStyle = v;
    g.fillRect(0, 0, 1024, 512);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 26, 1024, 12);
    for (const dx of [-1024, 0, 1024]) {
      const gr = g.createRadialGradient(dx, 110, 0, dx, 110, 150);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(dx - 150, -40, 300, 300);
    }
  });

/* ---------------- les geometries ---------------- */

function colored(g: BufferGeometry, hex: string): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  out.deleteAttribute('uv');
  const c = new Color(hex);
  const n = out.getAttribute('position').count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    a[3 * i] = c.r;
    a[3 * i + 1] = c.g;
    a[3 * i + 2] = c.b;
  }
  out.setAttribute('color', new Float32BufferAttribute(a, 3));
  return out;
}

/** Le petit knob cannele (unites du potard ; rayon 0.24 au pied, 0.2 de haut), son repere vers -z (comme les autres). */
function flutedGeometry(): BufferGeometry {
  const prof = [
    [0.152, 0.2],
    [0.168, 0.196],
    [0.182, 0.185],
    [0.21, 0.13],
    [0.23, 0.06],
    [0.24, 0.018],
    [0.24, 0],
  ].map(([r, y]) => new Vector2(r, y));
  const skirt = new LatheGeometry(prof, 240);
  const p = skirt.getAttribute('position');
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.175) continue;
    const a = Math.atan2(z, x);
    const w = Math.min(1, (r - 0.175) / 0.03);
    const k = 1 - w * (0.04 * (0.5 + 0.5 * Math.cos(a * 30)) + 0.006 * (0.5 + 0.5 * Math.cos(a * 120)));
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  skirt.computeVertexNormals();
  const top = new LatheGeometry([new Vector2(0.0001, 0.2), new Vector2(0.146, 0.2), new Vector2(0.154, 0.198)], 96);
  const mark = new BoxGeometry(0.018, 0.006, 0.142);
  mark.translate(0, 0.203, -0.077);
  const g = mergeGeometries([colored(skirt, '#1d1d1f'), colored(top, '#38383a'), colored(mark, '#f1ede5')], false);
  if (!g) throw new Error('faceMock : knob');
  return g;
}

function rounded(w: number, d: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + d - r);
  s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + d);
  s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
function roundedPath(w: number, d: number, r: number): Path {
  const p = new Path();
  const x = -w / 2;
  const y = -d / 2;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x + w, y + d - r);
  p.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  p.lineTo(x + r, y + d);
  p.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(x, y + r);
  p.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return p;
}

/**
 * Le levier (unites du levier : 0.6 x 0.27) : le boitier noir creuse d'une fente, son fond, la capsule chrome a gauche et
 * a droite (une seule se voit : set(right)). Construit une fois.
 */
interface Lever {
  group: Group;
  set: (right: boolean) => void;
  dispose: () => void;
}
function leverOf(mats: { body: MeshStandardMaterial; floor: MeshStandardMaterial; chrome: MeshStandardMaterial }): Lever {
  const grp = new Group();
  const sh = rounded(0.6, 0.27, 0.135);
  sh.holes.push(roundedPath(0.43, 0.18, 0.09));
  const body = new ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 4, curveSegments: 32 });
  body.rotateX(-Math.PI / 2);
  grp.add(new Mesh(body, mats.body));
  const floor = new CircleGeometry(1, 48);
  floor.scale(0.23, 0.1, 1);
  floor.rotateX(-Math.PI / 2);
  floor.translate(0, 0.004, 0);
  grp.add(new Mesh(floor, mats.floor));
  const cap = new CapsuleGeometry(0.08, 0.09, 12, 48);
  cap.rotateZ(Math.PI / 2);
  const l = new Mesh(cap, mats.chrome);
  const r = new Mesh(cap, mats.chrome);
  l.position.set(-0.085, 0.08, 0);
  r.position.set(0.085, 0.08, 0);
  l.castShadow = r.castShadow = true;
  grp.add(l, r);
  return {
    group: grp,
    set: (right) => {
      l.visible = !right;
      r.visible = right;
    },
    dispose: () => {
      body.dispose();
      floor.dispose();
      cap.dispose();
    },
  };
}

/* ---------------- l'encart d'EDIT ---------------- */

type Ctl = { k: 'knob' | 'lever' | 'keys'; id: string; name: string; steps?: readonly string[] };
const knob = (id: string, name: string): Ctl => ({ k: 'knob', id, name });
const lever = (id: string, name: string, steps: readonly string[]): Ctl => ({ k: 'lever', id, name, steps });
const keys = (id: string, name: string, steps: readonly string[]): Ctl => ({ k: 'keys', id, name, steps });
const ROWS: { title: string; ctls: Ctl[] }[][] = [
  [
    { title: 'OSCILLATORS', ctls: [knob('phase', 'PHASE'), knob('drift', 'DRIFT'), lever('sync', 'SYNC', ['OFF', 'ON'])] },
    { title: 'OSC +', ctls: [knob('xRing', 'RING MOD'), knob('xFold', 'FOLD'), knob('xNoiseColor', 'NOISE'), keys('xUnison', 'UNISON', ['OFF', '5', '7'])] },
    { title: 'VOICE', ctls: [keys('xVoiceMode', 'MODE', ['POLY', 'MONO', 'LEGATO']), knob('xPbRange', 'BEND')] },
    { title: 'FILTER', ctls: [knob('load', 'LOAD'), knob('space', 'SPACE'), knob('keyTrack', 'KEY TRACK'), lever('fpol', 'POLARITY', ['POS', 'NEG'])] },
  ],
  [
    { title: 'FILTER +', ctls: [knob('xHpf', 'HIGH PASS'), knob('xComb', 'COMB'), knob('xCombFb', 'COMB FB')] },
    { title: 'AMP', ctls: [knob('xFeedback', 'FEEDBACK'), keys('xAmpMode', 'AMP MODE', ['CLEAN', 'TRIODE', 'PENTODE', 'SAT'])] },
    { title: 'PERFORMANCE', ctls: [knob('accent', 'ACCENT'), knob('accFlt', 'ACC FILTER'), knob('chord', 'CHORD')] },
    { title: 'OUTPUT', ctls: [knob('width', 'WIDTH'), knob('monoLow', 'BASS MONO'), knob('glue', 'GLUE'), knob('duck', 'SIDECHAIN')] },
  ],
];
const CELL = { knob: 0.76, lever: 0.92 } as const;
const cellW = (c: Ctl): number => (c.k === 'keys' ? Math.max(0.9, (c.steps?.length ?? 3) * (c.steps!.some((s) => s.length > 4) ? 0.44 : 0.32)) : CELL[c.k]);
const GAP = 0.34;
const valOf = (id: string): number => (isExtra(id) ? arpExtra.of(id) : voyParams.of(id as VoyKnobId));
const setOf = (id: string, v: number): void => {
  if (isExtra(id)) arpExtra.set(id, v);
  else voyParams.set(id as VoyKnobId, v);
};
const defOf = (id: string): number => (isExtra(id) ? arpExtra.def(id) : voyParams.def(id as VoyKnobId));
const textOf = (id: string, v: number = valOf(id)): string => (isExtra(id) ? arpExtra.text(id, v) : voyValueText(id as VoyKnobId, v));
/** Les crans du reglage lui-meme (0 : continu). */
const stepsOf = (id: string): number => (isExtra(id) ? (extraParam(id)?.steps?.length ?? 0) : (voyKnob(id as VoyKnobId).steps?.length ?? 0));

/** Le DialId d'une piece de l'encart. */
export const ED = 'z:ed:';
const CTLS: Ctl[] = ROWS.flat().flatMap((f) => f.ctls);
for (const c of CTLS) {
  registerDialSpec(ED + c.id, {
    value: () => valOf(c.id),
    set: (v) => {
      const n = stepsOf(c.id);
      const x = Math.min(1, Math.max(0, v));
      setOf(c.id, n > 1 ? Math.round(x * (n - 1)) / (n - 1) : x);
      voyMsg.show(`${c.name} ${textOf(c.id)}`, 1800);
    },
    range: () => [0, 1] as const,
    steps: () => 0,
    text: (v) => textOf(c.id, v),
    unit: () => '',
    reset: () => defOf(c.id),
    say: (v) => `${c.name} ${textOf(c.id, v)}`,
  });
}


/* ---------------- l'encart d'EDIT : SYNTH | LFO | SQ | FX MOD (v46 ; v50 : quatre pages) ---------------- */

/**
 * v46 (2026-11-20, Mika : "les LFOS tous les LFOS quand on clic sur Edit !") : une bascule a gauche de l'encart (la page
 * montree allumee). v50 (Mika, 2026-11-23 : "C et SQ ok, go") : quatre touches mates a LED (encart50.ts TABS50) :
 * - SYNTH : les sections synthe d'avant ;
 * - LFO : les quatre LFO generiques et la MOD MATRIX (encart50.ts) ;
 * - SQ : le sequenceur de la page SEQ en petit (encart50.ts) ;
 * - FX MOD : PHASER, FLANGER, CHORUS, PUMP, et HELL WARP / SPIN (HELL v2) ou HELL LFO (l'ancien HELL, un projet d'avant).
 * La page est gardee entre deux ouvertures d'EDIT (pas entre deux fenetres) ; la premiere : LFO. Chaque piece a sa zone de
 * prise, active seulement sur sa page ; les noms des parametres hote ne changent pas.
 */
export type EncartPage = 'synth' | 'lfo' | 'sq' | 'fxmod';
const ENC_PAGES: readonly { id: EncartPage; name: string }[] = TABS50;
let encPage: EncartPage = 'lfo';
const encL = new Set<() => void>();
export const encartPage = {
  get: (): EncartPage => encPage,
  set(p: EncartPage): void {
    if (p === encPage) return;
    encPage = p;
    encL.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    encL.add(fn);
    return () => {
      encL.delete(fn);
    };
  },
};
/** Le DialId d'une touche de la bascule. */
const TAB_DIAL = (p: EncartPage): string => `${ED}@${p}`;
for (const p of ENC_PAGES)
  registerDialSpec(TAB_DIAL(p.id), {
    value: () => (encPage === p.id ? 1 : 0),
    set: () => undefined,
    range: () => [0, 1] as const,
    steps: () => 0,
    text: () => p.name,
    unit: () => '',
    reset: () => (encPage === p.id ? 1 : 0),
    say: () => `EDIT ${p.name}`,
  });

type LfoCtl = { k: 'pot' | 'lever'; id: string; name: string; big?: boolean; steps?: readonly string[]; say: string };
type LfoSec = { title: string; ctls: LfoCtl[]; sub?: LfoCtl[] };
const lpot = (sec: string, id: string, name: string, big = false): LfoCtl => ({ k: 'pot', id, name, big, say: `${sec} ${name}` });
const llev = (sec: string, id: string, name: string): LfoCtl => ({ k: 'lever', id, name, steps: extraParam(id)?.steps ?? ['OFF', 'ON'], say: `${sec} ${name}` });
/** Le LFO de l'ancien HELL (xHellV2 a OFF : un projet d'avant), ses cibles a lui. */
const HELL_LFO: LfoSec = { title: 'HELL LFO', ctls: [lpot('HELL LFO', 'xHellLfoRate', 'SPEED'), lpot('HELL LFO', 'xHellLfoShape', 'SHAPE'), lpot('HELL LFO', 'xHellLfoTarget', 'TARGET'), lpot('HELL LFO', 'xHellLfoAmt', 'DEPTH', true)], sub: [llev('HELL LFO', 'xHellLfoSync', 'SYNC'), llev('HELL LFO', 'xHellLfoStereo', 'STEREO')] };
/** HELL v2 (v46, xHellV2 a ON : les instances neuves, la banque) : WARP (la hauteur qui ondule) et SPIN (la piece qui tourne). */
const HELL_WARP: LfoSec = { title: 'HELL WARP', ctls: [lpot('HELL WARP', 'xHellWarpRate', 'SPEED'), lpot('HELL WARP', 'xHellWarpShape', 'SHAPE'), lpot('HELL WARP', 'xHellWarp', 'DEPTH', true)], sub: [lpot('HELL SPIN', 'xHellSpin', 'SPIN'), lpot('HELL SPIN', 'xHellSpinRate', 'SPIN RATE')] };
/** La page FX MOD : les modulations des effets, leurs vitesses et profondeurs (et ce qui les cale ou les ecarte). */
const FX_BASE: LfoSec[] = [
  { title: 'PHASER', ctls: [lpot('PHASER', 'xPhRate', 'SPEED'), lpot('PHASER', 'xPhDepth', 'DEPTH', true)], sub: [llev('PHASER', 'xPhSync', 'SYNC'), lpot('PHASER', 'xPhSpread', 'SPREAD')] },
  { title: 'FLANGER', ctls: [lpot('FLANGER', 'xFlRate', 'SPEED'), lpot('FLANGER', 'xFlDepth', 'DEPTH', true)], sub: [llev('FLANGER', 'xFlSync', 'SYNC'), lpot('FLANGER', 'xFlSpread', 'SPREAD')] },
  { title: 'CHORUS', ctls: [lpot('CHORUS', 'xChRate', 'SPEED'), lpot('CHORUS', 'xChDepth', 'DEPTH', true)] },
  { title: 'PUMP', ctls: [lpot('PUMP', 'xPumpRate', 'SPEED'), lpot('PUMP', 'xPumpDepth', 'DEPTH', true), lpot('PUMP', 'xPumpShape', 'RELEASE')] },
];
const FXMOD_SECS: LfoSec[] = [...FX_BASE, HELL_LFO];
const FXMOD_SECS_V2: LfoSec[] = [...FX_BASE, HELL_WARP];
const LFO_CTLS: LfoCtl[] = [...new Map([...FXMOD_SECS, ...FXMOD_SECS_V2].flatMap((s) => [...s.ctls, ...(s.sub ?? [])]).map((c) => [c.id, c])).values()];
/** Ce que l'encart montre : la page choisie ; FX MOD selon le moteur de HELL (fxmod2 : HELL v2). */
type EncView = EncartPage | 'fxmod2';
const encView = (): EncView => (encPage === 'fxmod' && valOf('xHellV2') >= 0.5 ? 'fxmod2' : encPage);
for (const c of LFO_CTLS) {
  registerDialSpec(ED + c.id, {
    value: () => valOf(c.id),
    set: (v) => {
      const n = stepsOf(c.id);
      const x = Math.min(1, Math.max(0, v));
      setOf(c.id, n > 1 ? Math.round(x * (n - 1)) / (n - 1) : x);
      voyMsg.show(`${c.say} ${textOf(c.id)}`, 1800);
    },
    range: () => [0, 1] as const,
    steps: () => 0,
    text: (v) => textOf(c.id, v),
    unit: () => '',
    reset: () => defOf(c.id),
    say: (v) => `${c.say} ${textOf(c.id, v)}`,
  });
}

/**
 * Le clic d'une piece de l'encart (hellKnob.tsx faceDbl) : une touche de la bascule montre sa page, un levier bascule,
 * une touche a crans passe au cran suivant, une fenetre de la matrice deroule son menu, le viseur arme l'assignation ; un
 * potard ne fait rien (le clic est pris). false : pas une piece de l'encart.
 */
export function encartTap(dial: string): boolean {
  if (!dial.startsWith(ED)) return false;
  const tab = ENC_PAGES.find((p) => TAB_DIAL(p.id) === dial);
  if (tab) {
    encartPage.set(tab.id);
    // une assignation en cours le reste (on va chercher la cible sur une autre page) : l'ecran le redit
    const r = modAim.route();
    voyMsg.show(r ? `CLICK A KNOB > ${aimSourceName(r)}` : `EDIT ${tab.name}`, r ? 3_600_000 : 1400);
    return true;
  }
  if (tap50(dial)) return true;
  const lc = LFO_CTLS.find((x) => ED + x.id === dial);
  if (lc) {
    if (lc.k === 'pot') return true;
    const n = Math.max(2, stepsOf(lc.id));
    const i = Math.round(valOf(lc.id) * (n - 1));
    setOf(lc.id, ((i + 1) % n) / (n - 1));
    voyMsg.show(`${lc.say} ${textOf(lc.id)}`, 1800);
    return true;
  }
  const c = CTLS.find((x) => ED + x.id === dial);
  if (!c) return false;
  if (c.k === 'knob') return true;
  const n = Math.max(2, stepsOf(c.id));
  const i = Math.round(valOf(c.id) * (n - 1));
  setOf(c.id, ((i + 1) % n) / (n - 1));
  voyMsg.show(`${c.name} ${textOf(c.id)}`, 1800);
  return true;
}

/**
 * v50 : un clic pendant une assignation au viseur (modRoutes.ts modAim) : le reglage du potard clique (la face, l'encart),
 * sa cible. Les pieces qui ne sont pas des potards (touches, leviers, fenetres, viseurs) gardent leur geste. true : pris.
 */
export function aimTap(dial: string): boolean {
  if (!modAim.on()) return false;
  let id: string | null = null;
  if (dial.startsWith('v:')) id = dial.slice(2);
  else if (dial === 'z:hell') id = 'xHellMix';
  else if (dial.startsWith(ED)) {
    const rest = dial.slice(ED.length);
    const ctl = CTLS.find((c) => c.id === rest) ?? LFO_CTLS.find((c) => c.id === rest);
    if (ctl) id = ctl.k === 'knob' || ctl.k === 'pot' ? rest : null;
    else id = aimParamOf50(dial);
  }
  if (id === null) return false;
  return modAim.pick(id);
}

/** Le petit knob cannele : son rayon au pied (unites du potard), sa hauteur, l'echelle de ceux de la face. */
export const FLUTED = { r: 0.24, h: 0.2, scale: 0.9 } as const;

/**
 * Ou dessiner l'arc de modulation d'un reglage hors des potards de la face (FaceModArcs.tsx), et ou poser l'anneau du
 * viseur (Encart50Overlay.tsx) : DETUNE, SPREAD, HELL, et les potards de l'encart tant que leur page est montree ; un
 * reglage peut avoir plusieurs places (FX MOD : deux mises en page selon HELL), la premiere vivante sert.
 */
export interface ArcPlace {
  layer: Group;
  x: number;
  z: number;
  y: number;
  R: number;
  live: () => boolean;
}
export const faceArcPlaces = new Map<string, ArcPlace[]>();
const addArcPlace = (id: string, p: ArcPlace): void => {
  const l = faceArcPlaces.get(id);
  if (l) l.push(p);
  else faceArcPlaces.set(id, [p]);
};
/** La place vivante d'un reglage (son index dans la liste, pour le cache des points), ou null. */
export function arcPlaceOf(id: string): { p: ArcPlace; i: number } | null {
  const l = faceArcPlaces.get(id);
  if (!l) return null;
  for (let i = 0; i < l.length; i += 1) if (l[i].live()) return { p: l[i], i };
  return null;
}

/** Une piece posee de l'encart (repere du plateau) : une piece synthe, un potard LFO (k1, son rayon), un levier LFO. */
type EncPlace = { k: 'syn'; c: Ctl; x: number; z: number } | { k: 'pot'; c: LfoCtl; x: number; z: number; R: number } | { k: 'lever'; c: LfoCtl; x: number; z: number; s: number };

/** La bascule : ses touches (repere du plateau), le trait qui la separe de la page. */
const encTabs = (): { x: number; z: number[]; sep: number } => tabs50();

/** Le panneau noir de l'encart (une page) : sa toile, ses aides de dessin, le trait de la bascule. */
function encPanel() {
  const gw = VOY_SEQ.w - 2 * VOY_SEQ.bezel;
  const gd = VOY_SEQ.d - 2 * VOY_SEQ.bezel;
  const W = 4096;
  const H = Math.round((W * gd) / gw);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const X0 = VOY_SEQ.x - gw / 2;
  const Z0 = VOY_SEQ.z - gd / 2;
  const px = (x: number): number => ((x - X0) / gw) * W;
  const py = (z: number): number => ((z - Z0) / gd) * H;
  const U = W / gw;
  // le panneau : un noir anodise, un rien plus clair en haut, son liseré
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a1a1b');
  bg.addColorStop(1, '#0f0f10');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i += 1) {
    g.fillStyle = `rgba(255,255,255,${(Math.random() * 0.025).toFixed(3)})`;
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  g.strokeStyle = 'rgba(255, 250, 240, 0.12)';
  g.lineWidth = 3;
  g.strokeRect(6, 6, W - 12, H - 12);
  const ink = 'rgba(238, 234, 226, 0.92)';
  const dim = 'rgba(238, 234, 226, 0.55)';
  const text = (s: string, x: number, z: number, cap: number, weight: number, col: string, spacing = 0.18): void => {
    g.font = `${weight} ${Math.round(cap * U * 1.38)}px ${FONT_DISPLAY}`;
    (g as unknown as { letterSpacing: string }).letterSpacing = `${(cap * U * spacing).toFixed(1)}px`;
    g.fillStyle = col;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(s, px(x), py(z));
  };
  const vline = (x: number, za: number, zb: number): void => {
    g.fillStyle = 'rgba(255, 250, 240, 0.14)';
    g.fillRect(px(x) - 2, py(za), 4, (zb - za) * U);
  };
  // la bascule : ses touches portent leur nom (encart50.ts key50) ; le trait
  const t = encTabs();
  vline(t.sep, Z0 + 0.12, Z0 + gd - 0.12);
  const finish = (): CanvasTexture => {
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  };
  return { g, gw, gd, X0, Z0, U, px, py, ink, dim, text, vline, finish, left: t.sep + 0.06, right: X0 + gw - 0.06 };
}

/**
 * La page SYNTH : les sections synthe d'avant, en deux rangees, a droite de la bascule ; resserrees (les cases et les
 * ecarts, pas les knobs) si elles ne tiennent pas.
 */
function encart(): { tex: CanvasTexture; place: EncPlace[]; scale: number; f: number } {
  const P = encPanel();
  const { text, Z0, ink, dim } = P;
  const scale = 0.72;
  const r = 0.24 * scale;
  const rows = [Z0 + 0.42, Z0 + 1.22];
  const place: EncPlace[] = [];
  const span = P.right - P.left;
  const widest = Math.max(...ROWS.map((row) => row.reduce((s, f) => s + f.ctls.reduce((t, c2) => t + cellW(c2), 0), 0) + GAP * (row.length - 1)));
  const f = Math.min(1, span / widest);
  ROWS.forEach((row, ri) => {
    const z = rows[ri];
    const total = (row.reduce((s, f2) => s + f2.ctls.reduce((t, c2) => t + cellW(c2), 0), 0) + GAP * (row.length - 1)) * f;
    let x = P.left + (span - total) / 2;
    row.forEach((sec, fi) => {
      const fw = sec.ctls.reduce((t, c2) => t + cellW(c2), 0) * f;
      text(sec.title, x + fw / 2, z - r - 0.16, 0.072, 700, ink, 0.24);
      let cx = x;
      for (const ct of sec.ctls) {
        const w = cellW(ct) * f;
        const mx = cx + w / 2;
        place.push({ k: 'syn', c: ct, x: mx, z });
        text(ct.name, mx, z + r + 0.1, 0.058, 600, ink, f < 0.97 ? 0.12 : 0.16);
        if (ct.k === 'lever' && ct.steps) {
          text(ct.steps[0], mx - 0.17, z + 0.18, 0.044, 600, dim, 0.1);
          text(ct.steps[1], mx + 0.17, z + 0.18, 0.044, 600, dim, 0.1);
        }
        if (ct.k === 'keys' && ct.steps) {
          const n = ct.steps.length;
          const step = Math.min(0.42, (w - 0.08) / n);
          ct.steps.forEach((s2, i) => text(s2, mx + (i - (n - 1) / 2) * step, z - 0.21, 0.042, 600, dim, 0.08));
        }
        cx += w;
      }
      if (fi < row.length - 1) {
        P.g.fillStyle = 'rgba(255, 250, 240, 0.14)';
        P.g.fillRect(P.px(x + fw + (GAP * f) / 2) - 2, P.py(z - r - 0.24), 4, (0.68 + r) * P.U);
      }
      x += fw + GAP * f;
    });
  });
  return { tex: P.finish(), place, scale, f };
}

/**
 * La page FX MOD (deux mises en page : l'ancien HELL, HELL v2) : une rangee de sections facon MOD, le titre au-dessus du
 * plus grand potard, chaque nom sous sa piece ; dessous, les reglages de plus de chaque section (potards plus petits, leviers).
 */
function encartMod(page: 'fxmod' | 'fxmod2'): { tex: CanvasTexture; place: EncPlace[] } {
  const P = encPanel();
  const { text, Z0, ink, dim } = P;
  const secs = page === 'fxmod' ? FXMOD_SECS : FXMOD_SECS_V2;
  const place: EncPlace[] = [];
  // les potards de la face (R : celui des potards de l'ancienne section MOD), un rien plus grand pour DEPTH
  const o = { r: 0.265, rb: 0.32, cs: 0.63, cb: 0.73 };
  const cw = (c: LfoCtl): number => (c.big ? o.cb : o.cs);
  const span = P.right - P.left;
  const widths = secs.map((s) => s.ctls.reduce((t, c) => t + cw(c), 0));
  const sum = widths.reduce((a, b) => a + b, 0);
  // l'ecart entre sections : celui de la maquette (0.27) au moins, plus quand la page est moins chargee
  const gap = Math.max(0.27, Math.min(1.1, (span - sum) / Math.max(1, secs.length - 1)));
  const total = sum + gap * (secs.length - 1);
  const z = Z0 + 0.53;
  const zs = Z0 + 1.24;
  let x = P.left + (span - total) / 2;
  secs.forEach((s, si) => {
    const fw = widths[si];
    text(s.title, x + fw / 2, z - o.rb - 0.13, 0.072, 700, ink, 0.24);
    let cx = x;
    for (const c of s.ctls) {
      const w = cw(c);
      const mx = cx + w / 2;
      const R = c.big ? o.rb : o.r;
      place.push({ k: 'pot', c, x: mx, z, R });
      text(c.name, mx, z + R + 0.095, 0.058, 600, ink, 0.16);
      cx += w;
    }
    // dessous : les leviers SYNC et STEREO, SPREAD, SPIN
    const sub = s.sub ?? [];
    const sw = 0.78;
    let sx = x + fw / 2 - (sub.length * sw) / 2;
    for (const c of sub) {
      const mx = sx + sw / 2;
      if (c.k === 'pot') {
        const R = c.big ? 0.2 : 0.17;
        place.push({ k: 'pot', c, x: mx, z: zs, R });
        text(c.name, mx, zs + R + 0.08, 0.05, 600, ink, 0.16);
      } else {
        place.push({ k: 'lever', c, x: mx, z: zs, s: 0.8 });
        text(c.steps![0], mx - 0.15, zs + 0.16, 0.04, 600, dim, 0.08);
        text(c.steps![1], mx + 0.15, zs + 0.16, 0.04, 600, dim, 0.08);
        text(c.name, mx, zs + 0.26, 0.05, 600, ink, 0.16);
      }
      sx += sw;
    }
    if (si < secs.length - 1) P.vline(x + fw + gap / 2, Z0 + 0.12, Z0 + P.gd - 0.12);
    x += fw + gap;
  });
  return { tex: P.finish(), place };
}

/* ---------------- les LED des touches a crans de la page SYNTH (2026-11-24) ---------------- */

/** Le rayon de la lentille (unites de la scene : celui des disques d'avant). */
const SYN_LED_R = 0.026;

/** Une LED de la page SYNTH sur sa toile carree (le halo compris) : eteinte (lit null) ou allumee a la couleur lit. */
function synLedTexture(lit: string | null): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const R = (c.width / 2 / LED_HALO_50.r1) * 0.98;
  paintLed(c.getContext('2d')!, c.width / 2, c.height / 2, R, lit, { ring: 1.16, halo: LED_HALO_50 });
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ---------------- dans la scene ---------------- */

export const FaceExtras: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  useEffect(() => {
    const rig = stage?.voy;
    if (!stage || !rig) return undefined;
    // la LED allumee de la page SYNTH reprend la couleur d'accent (SETTINGS) ; true si elle a change (pose plus bas)
    let ledRecolor = (): boolean => false;
    const kEnv = knobEnv();
    const cEnv = chromeEnv();
    const knobMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.12, envMap: kEnv, envMapIntensity: 0.9, side: DoubleSide });
    const geo = flutedGeometry();
    const mats = {
      body: new MeshStandardMaterial({ color: '#0d0d0e', roughness: 0.42, metalness: 0.1, envMap: kEnv, envMapIntensity: 0.6 }),
      floor: new MeshStandardMaterial({ color: '#030303', roughness: 0.9, metalness: 0 }),
      chrome: new MeshStandardMaterial({ color: '#f2f2f4', roughness: 0.1, metalness: 1, envMap: cEnv, envMapIntensity: 1.05 }),
    };
    const added: { parent: Group; obj: Mesh | Group }[] = [];
    const levers: Lever[] = [];
    const turns: (() => void)[] = [];
    const defs: HotspotDef[] = [];
    const disposers: (() => void)[] = [];
    // v43 (Mika : "remplace tous ceux que tu as faits noirs par celui-la") : les potards de la face sont ses PNG
    // (vknobFace.ts) ; les petits de la face (FM, RATIO, OSC 1..., DETUNE, SPREAD) : son petit knob (vknob.ts k3), meme
    // centre, meme rayon exterieur (celui du petit knob cannele d'avant). Ceux de la page SYNTH de l'encart d'EDIT ne
    // changent pas ; ses pages LFO et FX MOD : le potard de la face (k1) ; la matrice et SQ : le petit (k3).
    const offFace = attachVKnobs(stage);
    let nSmall = 0;
    const small = new VKnobSet('k3', FLUTED_DIALS.size + 2);
    const addSmall = (x: number, z: number, s: number, id: string): void => {
      const i = nSmall;
      nSmall += 1;
      small.place(i, x, VKNOB_LIFT, z, FLUTED.r * s);
      turns.push(() => small.setAngle(i, potAngle(valOf(id))));
    };
    rig.panel.add(...small.meshes);
    // 1. les petits knobs de la face (leurs zones de prise : celles des potards d'avant, vk-<id>)
    for (const id of FLUTED_DIALS) {
      const pl = voyKnobPlace(id);
      addSmall(pl.x, pl.z, FLUTED.scale, id);
    }
    // 2. DETUNE (stack) et SPREAD (wide) : deux potards du MM-ARP de plus sur la face
    for (const [id, pl] of [
      ['stack', VOY_DS_PLACE.detune],
      ['wide', VOY_DS_PLACE.spread],
    ] as const) {
      addSmall(pl.x, pl.z, pl.s, id);
      const r = Math.max(VOY_KNOB.touchR, FLUTED.r * pl.s);
      defs.push({ id: `vds-${id}`, kind: 'vknob', vknob: id, layer: rig.panel, shape: 'disc', x: pl.x, z: pl.z, hx: r, hz: r, y0: 0, y1: FLUTED.h * pl.s, enabled: true, machine: 'voy' });
      addArcPlace(id, { layer: rig.panel, x: pl.x, z: pl.z, y: 0.004, R: FLUTED.r * pl.s * 1.13, live: () => true });
    }
    // v50 : HELL (hellKnob.tsx) a son arc et son anneau de viseur comme les autres potards de la face
    addArcPlace('xHellMix', { layer: rig.panel, x: VOY_HELL_PLACE.x, z: VOY_HELL_PLACE.z, y: 0.004, R: RYTM_KNOB.R * VOY_HELL_PLACE.s * 1.13, live: () => true });
    // 3. SUB OCT : v43 (Mika : "tous les boutons, meme CHORUS ... SUB OCT") : plus de levier, sa touche-pilule revient
    //    (voyager/pads.ts), ses LED -1 / -2 restent
    // 4. l'encart d'EDIT : quatre pages (SYNTH | LFO | SQ | FX MOD, v50), chacune son panneau serigraphie et ses pieces 3D,
    //    enfants de l'ecran qui monte ; chaque piece sa zone de prise, active seulement sur sa page ; la bascule, toujours
    const sq = rig.seqScreen;
    const texs: Partial<Record<EncView, CanvasTexture>> = {};
    let panelMat: MeshStandardMaterial | null = null;
    const edDefs: { d: HotspotDef; page: EncView | null; live?: () => boolean }[] = [];
    const pageGroups: Partial<Record<EncView, Group>> = {};
    const tabKeys: Key50[] = [];
    const pages50: Partial<Record<EncView, Page50>> = {};
    const shownNow = (p: EncView): boolean => editor.get() === 'voy' && encView() === p;
    if (sq && !PORTRAIT) {
      const y = VOY_SEQ.h + 0.004;
      // 2026-11-24 (Mika : "quand on ne selectionne pas la diode est rouge eteinte.. peut-etre faire quelque chose de
      // transparent et quand on selectionne ca prend la couleur fondamentale choisie") : les LED des touches a crans de la
      // page SYNTH, plus de disques rouges : la lentille des LED du plugin (voyager/ledLens.ts), eteinte en verre clair et
      // neutre, allumee a la couleur d'accent (SETTINGS, en direct : ledRecolor) avec le halo des touches de la bascule
      const keyMat = new MeshStandardMaterial({ color: '#262524', roughness: 0.5, metalness: 0.05 });
      const keyGeo = new BoxGeometry(0.42, 0.07, 0.24);
      keyGeo.translate(0, 0.035, 0);
      const ledGeo = new PlaneGeometry(SYN_LED_R * 2 * LED_HALO_50.r1, SYN_LED_R * 2 * LED_HALO_50.r1);
      ledGeo.rotateX(-Math.PI / 2);
      const ledMat = (lit: string | null): MeshBasicMaterial => new MeshBasicMaterial({ map: synLedTexture(lit), transparent: true, depthWrite: false, toneMapped: false });
      const ledOff = ledMat(null);
      let ledAccent = accent50();
      const ledOn = ledMat(ledAccent);
      ledRecolor = (): boolean => {
        const a = accent50();
        if (a === ledAccent) return false;
        ledAccent = a;
        ledOn.map?.dispose();
        ledOn.map = synLedTexture(a);
        ledOn.needsUpdate = true;
        return true;
      };
      const pageGroup = (p: EncView): Group => {
        const grp = new Group();
        grp.name = `encart-${p}`;
        sq.group.add(grp);
        added.push({ parent: sq.group, obj: grp });
        pageGroups[p] = grp;
        return grp;
      };
      // la page SYNTH : les pieces d'avant
      const e = encart();
      texs.synth = e.tex;
      const gS = pageGroup('synth');
      for (const p of e.place) {
        if (p.k !== 'syn') continue;
        const id = p.c.id;
        let hx = 0.2;
        let hz = 0.2;
        let y1 = y + 0.1;
        if (p.c.k === 'knob') {
          const m = new Mesh(geo, knobMat);
          m.position.set(p.x, y, p.z);
          m.scale.setScalar(e.scale);
          m.castShadow = true;
          gS.add(m);
          turns.push(() => m.rotation.set(0, potAngle(valOf(id)), 0));
          hx = hz = Math.max(0.2, FLUTED.r * e.scale * 1.15);
          y1 = y + FLUTED.h * e.scale;
          // v50 : chaque potard continu de la page a son arc (et son anneau de viseur)
          addArcPlace(id, { layer: sq.group, x: p.x, z: p.z, y: y + 0.004, R: FLUTED.r * e.scale * 1.13, live: () => shownNow('synth') });
        } else if (p.c.k === 'lever') {
          const lv = leverOf(mats);
          lv.group.position.set(p.x, y, p.z);
          lv.group.scale.setScalar(0.9);
          gS.add(lv.group);
          levers.push(lv);
          turns.push(() => lv.set(valOf(id) >= 0.5));
          hx = 0.3;
          hz = 0.16;
          y1 = y + 0.17;
        } else {
          const n = p.c.steps?.length ?? 3;
          const k = new Mesh(keyGeo, keyMat);
          k.position.set(p.x, y, p.z + 0.05);
          k.castShadow = true;
          gS.add(k);
          const w = cellW(p.c) * e.f;
          const step = Math.min(0.42, (w - 0.08) / n);
          const leds: Mesh[] = [];
          for (let i = 0; i < n; i += 1) {
            const led = new Mesh(ledGeo, ledOff);
            led.position.set(p.x + (i - (n - 1) / 2) * step, y + 0.004, p.z - 0.12);
            gS.add(led);
            leds.push(led);
          }
          turns.push(() => {
            const idx = Math.max(0, Math.min(n - 1, Math.round(valOf(id) * (n - 1))));
            leds.forEach((l, i) => (l.material = i === idx ? ledOn : ledOff));
          });
          hx = Math.max(0.24, w / 2 - 0.04);
          hz = 0.24;
          y1 = y + 0.08;
        }
        edDefs.push({ d: { id: `ved-${id}`, kind: 'encoder', param: (ED + id) as EncId, layer: sq.group, shape: p.c.k === 'knob' ? 'disc' : 'box', x: p.x, z: p.z + (p.c.k === 'keys' ? -0.02 : 0), hx, hz, y0: 0, y1, enabled: false, machine: 'voy' }, page: 'synth' });
      }
      // la page FX MOD (deux : l'ancien HELL, HELL v2) : le potard de la face (k1, le PNG de Mika), les leviers ; les zones
      // de la page HELL v2 : ved-f2-<id> (les memes reglages sur les deux mises en page)
      for (const page of ['fxmod', 'fxmod2'] as const) {
        const hid = (id: string): string => (page === 'fxmod2' ? `ved-f2-${id}` : `ved-${id}`);
        const m = encartMod(page);
        texs[page] = m.tex;
        const grp = pageGroup(page);
        const pots = m.place.filter((p): p is Extract<EncPlace, { k: 'pot' }> => p.k === 'pot');
        const set = new VKnobSet('k1', pots.length);
        pots.forEach((p, i) => {
          set.place(i, p.x, y + VKNOB_LIFT, p.z, p.R);
          turns.push(() => set.setAngle(i, potAngle(valOf(p.c.id))));
          const r = Math.max(0.2, p.R * 1.1);
          edDefs.push({ d: { id: hid(p.c.id), kind: 'encoder', param: (ED + p.c.id) as EncId, layer: sq.group, shape: 'disc', x: p.x, z: p.z, hx: r, hz: r, y0: 0, y1: y + 0.1, enabled: false, machine: 'voy' }, page });
          if (stepsOf(p.c.id) < 2) addArcPlace(p.c.id, { layer: sq.group, x: p.x, z: p.z, y: y + 0.004, R: p.R * 1.13, live: () => shownNow(page) });
        });
        grp.add(...set.meshes);
        disposers.push(() => set.dispose());
        for (const p of m.place) {
          if (p.k !== 'lever') continue;
          const id = p.c.id;
          const lv = leverOf(mats);
          lv.group.position.set(p.x, y, p.z);
          lv.group.scale.setScalar(p.s);
          grp.add(lv.group);
          levers.push(lv);
          turns.push(() => lv.set(valOf(id) >= 0.5));
          edDefs.push({ d: { id: hid(id), kind: 'encoder', param: (ED + id) as EncId, layer: sq.group, shape: 'box', x: p.x, z: p.z, hx: 0.3 * (p.s / 0.9), hz: 0.16, y0: 0, y1: y + 0.17, enabled: false, machine: 'voy' }, page });
        }
      }
      // v50 : les pages LFO (les quatre LFO, la MOD MATRIX) et SQ (encart50.ts) : leurs toiles, leurs pieces, leurs zones
      for (const page of ['lfo', 'sq'] as const) {
        const pg = page === 'lfo' ? lfoPage50() : sqPage50(y);
        pages50[page] = pg;
        texs[page] = pg.tex;
        const grp = pageGroup(page);
        for (const kind of ['k1', 'k3'] as const) {
          const ks = pg.place.filter((p): p is Extract<typeof p, { k: 'k1' | 'k3' }> => p.k === kind);
          if (ks.length === 0) continue;
          const set = new VKnobSet(kind, ks.length);
          ks.forEach((p, i) => {
            let shown = true;
            set.place(i, p.x, y + VKNOB_LIFT, p.z, p.R);
            turns.push(() => {
              // une place sans ligne (la derniere page de la matrice) : le potard s'efface
              const want = p.show ? p.show() : true;
              if (want !== shown) {
                shown = want;
                set.place(i, p.x, y + VKNOB_LIFT, p.z, want ? p.R : 0);
              }
              set.setAngle(i, potAngle(p.v()));
            });
            for (const a of p.arcs ?? []) addArcPlace(a.id, { layer: sq.group, x: p.x, z: p.z, y: y + 0.004, R: p.R * 1.13, live: () => shownNow(page) && a.live() });
          });
          grp.add(...set.meshes);
          disposers.push(() => set.dispose());
        }
        for (const p of pg.place) {
          if (p.k === 'lever') {
            const lv = leverOf(mats);
            lv.group.position.set(p.x, y, p.z);
            lv.group.scale.setScalar(p.s);
            grp.add(lv.group);
            levers.push(lv);
            turns.push(() => lv.set(p.right()));
          } else if (p.k === 'key') {
            const mk = key50(p.w, p.d, p.label, p.cap);
            mk.mesh.position.set(p.x, y, p.z);
            grp.add(mk.mesh);
            turns.push(() => mk.set(p.on()));
            disposers.push(() => mk.dispose());
          }
        }
        for (const h of pg.hits)
          edDefs.push({
            d: { id: h.id, kind: 'encoder', param: h.dial as EncId, layer: sq.group, shape: h.shape, x: h.x, z: h.z, hx: h.hx, hz: h.hz, y0: 0, y1: y + 0.1, enabled: false, machine: 'voy' },
            page,
            live: h.live,
          });
        if (pg.head) {
          grp.add(...pg.head.meshes);
          disposers.push(() => pg.head?.dispose());
        }
      }
      // la bascule : quatre touches mates a LED (celle de la page montree allumee a la couleur d'accent)
      const mt = tabs50();
      ENC_PAGES.forEach((p, i) => {
        const mk = key50(mt.w, mt.d, p.name);
        mk.mesh.position.set(mt.x, y, mt.z[i]);
        sq.group.add(mk.mesh);
        added.push({ parent: sq.group, obj: mk.mesh });
        tabKeys.push(mk);
        disposers.push(() => mk.dispose());
        edDefs.push({ d: { id: `ved-@${p.id}`, kind: 'encoder', param: TAB_DIAL(p.id) as EncId, layer: sq.group, shape: 'box', x: mt.x, z: mt.z[i], hx: mt.w / 2 + 0.02, hz: mt.d / 2 + 0.03, y0: 0, y1: y + 0.08, enabled: false, machine: 'voy' }, page: null });
      });
      panelMat = new MeshStandardMaterial({ map: texs[encView()] ?? null, roughness: 0.78, metalness: 0.05 });
      sq.cover(panelMat);
      sq.inert = true;
      disposers.push(() => {
        keyGeo.dispose();
        ledGeo.dispose();
        keyMat.dispose();
        ledOn.map?.dispose();
        ledOff.map?.dispose();
        ledOn.dispose();
        ledOff.dispose();
      });
    }
    stage.hit.add([...defs, ...edDefs.map((x) => x.d)]);
    // les zones de l'encart ne prennent que tant qu'il est monte (EDIT), et seulement celles de la page montree (et
    // vivantes : une ligne de matrice vide, un pas hors de la suite ne prennent rien)
    const syncEdit = (): void => {
      const on = editor.get() === 'voy';
      const pg = encView();
      let ch = false;
      for (const { d, page, live } of edDefs) {
        const want = on && (page === null || page === pg) && (live ? live() : true);
        if (d.enabled !== want) {
          d.enabled = want;
          ch = true;
        }
      }
      if (ch) stage.hit.invalidate();
    };
    /** La page montree des pages v50 : sa toile se redessine si besoin, sa tete se pose ; true si quelque chose a change. */
    const refresh50 = (): boolean => {
      if (editor.get() !== 'voy') return false;
      const p = pages50[encView()];
      if (!p) return false;
      const a = p.redraw();
      const b = p.head ? p.head.update() : false;
      return a || b;
    };
    // la page montree : son panneau, ses pieces, sa touche allumee (la couleur d'accent du moment, SETTINGS)
    let shown: EncView | null = null;
    const showPage = (): void => {
      const pg = encView();
      shown = pg;
      const tab = encartPage.get();
      for (const [p, grp] of Object.entries(pageGroups)) if (grp) grp.visible = p === pg;
      refresh50();
      const tex = texs[pg];
      if (panelMat && tex && panelMat.map !== tex) panelMat.map = tex;
      tabKeys.forEach((k, i) => k.set(ENC_PAGES[i].id === tab));
      syncEdit();
      stage.invalidate();
    };
    showPage();
    // EDIT baisse : l'assignation en cours s'arrete ; EDIT monte : la page montree se remet a jour
    const onEdit = (): void => {
      if (editor.get() !== 'voy') modAim.cancel();
      syncEdit();
      if (refresh50()) stage.invalidate();
    };
    const offEd = editor.subscribe(onEdit);
    const offPage = encartPage.subscribe(showPage);
    // ?probe (les essais sans son, Chromium) : ou tombe une zone de prise a l'ecran, et ce qui est pris en (x, y)
    if (typeof location !== 'undefined' && location.search.includes('probe'))
      (window as unknown as { __mmProbe?: unknown }).__mmProbe = {
        at: (id: string) => {
          const v = stage.hit.list().find((h) => h.id === id);
          return v ? { x: v.cx, y: v.cy, enabled: v.enabled } : null;
        },
        pick: (x: number, y: number) => stage.hit.pick(x, y, false)?.id ?? null,
        ids: () => stage.hit.list().map((h) => h.id),
        params: () => ({ ...voyParams.get(), ...arpExtra.get() }),
        text: (id: string) => textOf(id),
        msg: () => voyMsg.get(),
        // v50 : les derniers messages de l'ecran (ce qui les a remplaces)
        msgLog: (() => {
          const log: { t: number; m: string | null }[] = [];
          voyMsg.subscribe(() => {
            log.push({ t: Math.round(performance.now()), m: voyMsg.get() });
            if (log.length > 40) log.shift();
          });
          return () => log.slice();
        })(),
        // v31 : la cadence du rendu (frames rendues, rAF, temps JS des rendus, DPR, taille du canevas)
        stats: () => ({ frames: stage.stats.frames, rafs: stage.stats.rafs, renderMs: stage.stats.renderMs, dpr: stage.stats.dpr, loop: stage.stats.loopActive }),
        stage: () => stage,
        // v53 : le niveau de vivacite de la face (voyager/vivid.ts : VIVID_LEVEL, ou ?vivid=)
        vivid: () => VIVID.level,
        // v46 : la page de l'encart d'EDIT (synth, lfo, sq, fxmod) sans passer par un clic (captures)
        encart: (p: EncartPage) => encartPage.set(p),
        // v50 : la matrice (les lignes de la page montree, sa page, l'assignation en cours), la toile redessinee
        e50: {
          rows: () => Array.from({ length: 8 }, (_, p) => modView.rowAt(p)?.key ?? null),
          page: (p: number) => modView.setPage(p),
          aim: () => modAim.key(),
          codeOf: (id: string) => modDestCodeOf(id),
          redraw: () => {
            refresh50();
            stage.invalidate();
          },
        },
      };
    const turn = (): void => {
      for (const t of turns) t();
      refresh50();
      // HELL V2 bascule (un preset, un projet) : FX MOD suit son moteur
      if (sq && shown !== null && shown !== encView()) showPage();
      else syncEdit();
      stage.invalidate();
    };
    turn();
    const off1 = voyParams.subscribe(turn);
    const off2 = arpExtra.subscribe(turn);
    // v50 : la matrice (sa page, l'assignation), SQ (ses pistes, sa suite, l'accord lu), la tete de SQ
    const off3 = modView.subscribe(turn);
    const offSq = sqSources.map((sub) => sub(turn));
    const offHead = extHead.onWake(() => {
      if (encView() === 'sq' && refresh50()) stage.invalidate();
    });
    // 2026-11-24 : la couleur d'accent change (SETTINGS, ACCENT COLOR) : toutes les LED allumees de l'encart la reprennent
    // en direct (celles de la page SYNTH, la touche de la page montree, les touches des pages (GATE...), la tete et la
    // toile de SQ : turn)
    let seenAccent = accent50();
    const offLook = look.subscribe(() => {
      const a = accent50();
      if (a === seenAccent) return;
      seenAccent = a;
      ledRecolor();
      const tab = encartPage.get();
      tabKeys.forEach((k, i) => k.set(ENC_PAGES[i].id === tab));
      turn();
    });
    return () => {
      off1();
      off2();
      off3();
      offSq.forEach((f) => f());
      offHead();
      offLook();
      offEd();
      offPage();
      offFace();
      modAim.cancel();
      rig.panel.remove(...small.meshes);
      small.dispose();
      for (const d of [...defs, ...edDefs.map((x) => x.d)]) d.enabled = false;
      stage.hit.invalidate();
      for (const a of added) a.parent.remove(a.obj);
      for (const l of levers) l.dispose();
      for (const d of disposers) d();
      if (sq) {
        sq.cover(null);
        sq.inert = false;
      }
      faceArcPlaces.clear();
      for (const t of Object.values(texs)) t?.dispose();
      panelMat?.dispose();
      geo.dispose();
      knobMat.dispose();
      kEnv.dispose();
      cEnv.dispose();
      mats.body.dispose();
      mats.floor.dispose();
      mats.chrome.dispose();
    };
  }, [stage]);
  return null;
};
