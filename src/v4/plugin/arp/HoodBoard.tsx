/**
 * Le capot du MM-ARP : une carte noire, pleine page (2026-11-13, Mika : "plus de trou pour l'ecran", "trop de menus dans
 * OPEN", "le look n'est pas beau, plus realiste").
 *
 * - OPEN leve le capot 3D (avec son ecran, comme au site) ; la carte noire arrive quand il est monte et couvre toute la
 *   fenetre : plus de decoupe, plus de copie de l'ecran de la face. Un petit afficheur dans le bandeau dit la page et le
 *   reglage touche (son nom, sa valeur).
 * - Trois pages (hoodPage.ts) : SOUND (les TWEAKS de la face et les reglages du son du VST3 seul), FX (le rack ; HELL sur
 *   sa sous-page) et SEQ (le sequenceur par pas, RANDOM, les LFO, la matrice). LIBRARY (+ DISK) et MIDI (DRAG MIDI, MIDI
 *   LEARN) : deux touches du bandeau, leur volet par-dessus la page.
 * - Les pieces (pcbui.tsx) : potards en relief, touches a crans facon CHORUS (LED au-dessus), afficheurs a crans ; tous
 *   les reglages a crans se reglent en glissant, cran par cran.
 * - Le double clic d'un potard de la face ouvre la page qui le detaille, son cadre clignote (hellKnob.tsx).
 *
 * La carte vit dans un cadre de 1100 x 704 (la fenetre de base du VST3) mis a l'echelle de la fenetre (son rapport est
 * fixe : PluginEditor.cpp).
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { openToggle } from '../../actions';
import type { Stage } from '../../scene/renderer';
import { voyExplode } from '../../state/explode';
import { arp, arpExternal } from '../../voyager/arp';
import { voyParams, VOY_TWEAKS } from '../../voyager/params';
import { seq } from '../../voyager/seq';
import { extHead } from '../head';
import { arpBridge } from './bridge';
import { arpExtra, extraParam, MATRIX_ROWS } from './extra';
import { HELL_PRESETS, hellCurrent, hellLoad } from './hell';
import { HOOD_TABS, hoodPage, type HoodTab } from './hoodPage';
import { hypnoNew, hypnoStyle, HYPNO_STYLES } from './hypno';
import { LIB_CATS, LIB_PRESETS, libCurrent, libLoad, libOfCat, libStep, libStore } from './library';
import { DiskPresets } from './DiskPresets';
import { DragMidi, MidiMap } from './HoodPanel';
import { arpMidi } from './midimap';
import { hoodLcd, PcbDefs, PcbFrame, PcbKey, PcbKnob, PcbSelect, PcbStep, setFullName } from './pcbui';
import { arpSteps, STEP_TRACKS, STEPS_N, type StepTrack } from './steps';
import './hood.css';

/** Le cadre de la page (la fenetre de base du VST3). */
const PAGE_W = 1100;
const PAGE_H = 704;
/** La zone des reglages : toute la largeur de la carte. */
const ZONE = { x: 24, w: 1052 };
const FRAME_GAP = 16;
/** Les touches du bandeau : celles de la face, en plus petit (le bandeau reste bas). */
const STRIP_KEY = { w: 44, h: 18 };

/* ---------------- les reglages, page par page ---------------- */

type Ctl =
  | { k: 'knob'; id: string; name: string; lo: string; hi: string; full?: string; big?: boolean }
  | { k: 'step'; id: string; name: string; full?: string }
  | { k: 'sel'; id: string; name: string; w: number; full?: string };

interface FrameSpec {
  title: string;
  ctls: Ctl[];
  /** la LED du titre : l'effet agit */
  led?: () => boolean;
}

const knob = (id: string, name: string, lo: string, hi: string, full?: string): Ctl => ({ k: 'knob', id, name, lo, hi, full });
const bigKnob = (id: string, name: string, lo: string, hi: string, full?: string): Ctl => ({ k: 'knob', id, name, lo, hi, full, big: true });
const step = (id: string, name: string, full?: string): Ctl => ({ k: 'step', id, name, full });
const sel = (id: string, name: string, w: number, full?: string): Ctl => ({ k: 'sel', id, name, w, full });

const X = (id: string): number => arpExtra.of(id);

const CELL_W = 76;
const stepsOf = (id: string): readonly string[] => extraParam(id)?.steps ?? VOY_TWEAKS.find((k) => k.id === id)?.steps ?? [];
/** La largeur d'une touche a crans : une LED par cran (une seule pour un ON / OFF). */
const stepW = (id: string): number => {
  const s = stepsOf(id);
  const n = s.length === 2 && s[0] === 'OFF' ? 1 : s.length;
  return Math.max(CELL_W, n * 34 + 12);
};
const cellW = (c: Ctl): number => (c.k === 'step' ? stepW(c.id) : c.k === 'sel' ? c.w + 24 : c.big ? 96 : CELL_W);
const frameW = (f: FrameSpec): number => f.ctls.reduce((s, c) => s + cellW(c), 0) + 20;
const FRAME_H = 106;

type GridPage = 'sound' | 'rack' | 'hell';

const ROWS: Record<GridPage, { y: number; frames: FrameSpec[] }[]> = {
  // SOUND : les TWEAKS de la face (voyager/params.ts, section tweak) et le son du VST3 seul, du generateur a la sortie
  sound: [
    {
      y: 34,
      frames: [
        { title: 'OSCILLATORS', ctls: [knob('phase', 'PHASE', 'FREE', '360'), knob('drift', 'DRIFT', 'STABLE', 'LOOSE'), knob('stack', 'STACK', 'OFF', '30 CT'), step('sync', 'SYNC')] },
        {
          title: 'OSC +',
          ctls: [knob('xRing', 'RING MOD', 'OFF', 'FULL'), knob('xFold', 'FOLD', 'OFF', 'FULL', 'WAVEFOLD'), knob('xNoiseColor', 'NOISE', 'DARK', 'BRIGHT', 'NOISE COLOR'), step('xUnison', 'UNISON')],
        },
        { title: 'VOICE', ctls: [step('xVoiceMode', 'MODE', 'VOICE MODE'), sel('xPbRange', 'BEND', 52, 'BEND RANGE')] },
      ],
    },
    {
      y: 164,
      frames: [
        { title: 'FILTER', ctls: [knob('load', 'LOAD', 'CLEAN', 'HOT'), knob('space', 'SPACE', 'OFF', '1 OCT'), knob('keyTrack', 'KEY TRACK', '0', 'FULL'), step('fpol', 'POLARITY')] },
        {
          title: 'FILTER +',
          led: () => X('xHpf') > 0 || X('xComb') > 0,
          ctls: [knob('xHpf', 'HIGH PASS', 'OFF', '2K'), knob('xComb', 'COMB', 'OFF', 'FULL'), knob('xCombFb', 'COMB FB', 'NEG', 'POS')],
        },
        { title: 'AMP', ctls: [knob('xFeedback', 'FEEDBACK', 'OFF', 'FULL'), step('xAmpMode', 'AMP MODE')] },
      ],
    },
    {
      y: 294,
      frames: [
        { title: 'PERFORMANCE', ctls: [knob('accent', 'ACCENT', 'FLAT', 'HARD'), knob('accFlt', 'ACC FILTER', 'LEVEL', 'FILTER'), sel('chord', 'CHORD', 60)] },
        {
          title: 'OUTPUT',
          ctls: [knob('width', 'WIDTH', 'MONO', 'WIDE'), knob('wide', 'WIDE', 'OFF', 'FULL'), knob('monoLow', 'BASS MONO', 'OFF', '300 HZ'), knob('glue', 'GLUE', 'OFF', 'TIGHT'), knob('duck', 'SIDECHAIN', 'OFF', '-24 DB')],
        },
        { title: 'DISTORTION', led: () => X('xDist') > 0, ctls: [knob('xDist', 'AMOUNT', 'OFF', 'FULL', 'DISTORTION'), knob('xDistTone', 'TONE', 'DARK', 'BRIGHT', 'DIST TONE')] },
      ],
    },
    {
      y: 424,
      frames: [
        { title: 'EQ', ctls: [knob('xEqLow', 'LOW', '-12', '+12', 'EQ LOW'), knob('xEqMid', 'MID', '-12', '+12', 'EQ MID'), knob('xEqHigh', 'HIGH', '-12', '+12', 'EQ HIGH'), knob('xEqAir', 'AIR BAND', '-10', '+10', 'EQ AIR BAND')] },
        { title: 'MASTER', ctls: [knob('xWarmth', 'WARMTH', 'OFF', 'FULL'), knob('xBass', 'BASS', '-6', '+6', 'MASTER BASS'), knob('xAir', 'AIR', '-6', '+6', 'MASTER AIR'), knob('xWidth', 'WIDTH', 'MONO', '200 %')] },
        { title: 'ENGINE', ctls: [step('xQuality', 'QUALITY')] },
      ],
    },
  ],
  // FX, le rack : le delay et la reverbe de la face et leurs reglages, puis les effets du VST3 seul
  rack: [
    {
      y: 84,
      frames: [
        { title: 'DELAY', ctls: [sel('dlyTime', 'TIME', 52, 'DLY TIME'), knob('tape', 'TAPE', 'CLEAN', 'WORN'), step('xDlyMode', 'MODE', 'DELAY MODE')] },
        { title: 'REVERB', ctls: [knob('xRevSize', 'SIZE', '0.6 S', '9.6 S', 'REVERB SIZE'), knob('xRevTone', 'TONE', 'DARK', 'BRIGHT', 'REVERB TONE'), knob('xRevPre', 'PRE DELAY', '0', '100 MS', 'REVERB PRE DELAY'), knob('xShimmer', 'SHIMMER', 'OFF', 'FULL')] },
      ],
    },
    {
      y: 214,
      frames: [
        {
          title: 'PHASER',
          led: () => X('xPhMix') > 0,
          ctls: [knob('xPhMix', 'MIX', 'OFF', 'FULL', 'PHASER'), knob('xPhRate', 'RATE', '.05', '8 HZ', 'PHASER RATE'), knob('xPhDepth', 'DEPTH', '0', 'FULL', 'PHASER DEPTH'), knob('xPhFb', 'FEEDBACK', '0', 'FULL', 'PHASER FEEDBACK')],
        },
        {
          title: 'FLANGER',
          led: () => X('xFlMix') > 0,
          ctls: [knob('xFlMix', 'MIX', 'OFF', 'FULL', 'FLANGER'), knob('xFlRate', 'RATE', '.03', '5 HZ', 'FLANGER RATE'), knob('xFlDepth', 'DEPTH', '0', 'FULL', 'FLANGER DEPTH'), knob('xFlFb', 'FEEDBACK', 'NEG', 'POS', 'FLANGER FEEDBACK')],
        },
      ],
    },
    {
      y: 344,
      frames: [
        { title: 'CRUSH', led: () => X('xCrushBits') > 0 || X('xCrushRate') > 0, ctls: [knob('xCrushBits', 'BITS', 'OFF', '4 BIT', 'BITCRUSH'), knob('xCrushRate', 'RATE', 'OFF', '2 KHZ', 'DOWNSAMPLE')] },
        { title: 'PUMP', led: () => X('xPumpDepth') > 0, ctls: [knob('xPumpDepth', 'DEPTH', 'OFF', 'FULL', 'PUMP'), step('xPumpRate', 'RATE', 'PUMP RATE'), knob('xPumpShape', 'RELEASE', 'SHORT', 'LONG', 'PUMP RELEASE')] },
        { title: 'HELL', led: () => X('xHellMix') > 0, ctls: [knob('xHellMix', 'MIX', 'OFF', 'FULL', 'HELL')] },
      ],
    },
  ],
  // FX, HELL : le delay au decaleur de Bode (plugin/mm-arp/dsp/Hell.h)
  hell: [
    {
      y: 84,
      frames: [
        { title: 'TIME', ctls: [sel('xHellSync', 'SYNC', 52, 'HELL TIME SYNC'), knob('xHellTime', 'TIME', '5 MS', '2 S', 'HELL TIME')] },
        { title: 'SHIFTER', ctls: [bigKnob('xHellShift', 'SHIFT', '-5K', '+5K', 'HELL SHIFT'), knob('xHellUpDown', 'UP / DOWN', 'DOWN', 'UP', 'HELL UP/DOWN'), knob('xHellSpread', 'SPREAD', '0', 'FULL', 'HELL SPREAD')] },
        { title: 'LOOP', ctls: [knob('xHellFb', 'FEEDBACK', '0', 'FULL', 'HELL FEEDBACK'), knob('xHellTone', 'TONE', 'LP', 'HP', 'HELL TONE')] },
        { title: 'LFO', ctls: [knob('xHellLfoRate', 'RATE', '.02', '10 HZ', 'HELL LFO RATE'), knob('xHellLfoDepth', 'DEPTH', '0', '400 HZ', 'HELL LFO DEPTH')] },
        { title: 'HELL', led: () => X('xHellMix') > 0, ctls: [bigKnob('xHellMix', 'MIX', 'OFF', 'FULL', 'HELL')] },
      ],
    },
  ],
};

/*
 * Les designateurs : les TWEAKS gardent ceux de la carte verte (RV5 a RV19, SW1 a SW3, dans l'ordre de VOY_TWEAKS), les
 * reglages du VST3 seul suivent (RV20, SW4...), dans l'ordre des pages.
 */
const REFS: Record<string, string> = {};
{
  let rvT = 5;
  let swT = 1;
  for (const k of VOY_TWEAKS) REFS[k.id] = k.id === 'sync' || k.id === 'chord' || k.id === 'fpol' ? `SW${swT++}` : `RV${rvT++}`;
  let rv = 20;
  let swn = 4;
  const all = [...ROWS.sound, ...ROWS.rack, ...ROWS.hell].flatMap((r) => r.frames.flatMap((f) => f.ctls)).filter((c) => !(c.id in REFS));
  for (const c of all) {
    REFS[c.id] = c.k === 'knob' ? `RV${rv++}` : `SW${swn++}`;
    setFullName(c.id, c.full ?? c.name);
  }
  for (const c of [...ROWS.sound, ...ROWS.rack, ...ROWS.hell].flatMap((r) => r.frames.flatMap((f) => f.ctls))) if (c.full) setFullName(c.id, c.full);
  for (let i = 1; i <= MATRIX_ROWS; i += 1) {
    setFullName(`xM${i}Src`, `MATRIX ${i} SOURCE`);
    setFullName(`xM${i}Dst`, `MATRIX ${i} DEST`);
    setFullName(`xM${i}Amt`, `MATRIX ${i} AMOUNT`);
    REFS[`xM${i}Amt`] = `RV${rv++}`;
  }
  for (const [id, n] of [
    ['xSwing', 'ARP SWING'],
    ['xLfo1Dest2', 'LFO 1 TARGET 2'],
    ['xLfo1Depth2', 'LFO 1 DEPTH 2'],
    ['xLfo2Rate', 'LFO 2 SPEED'],
    ['xLfo2Shape', 'LFO 2 SHAPE'],
    ['xLfo2Dest', 'LFO 2 TARGET'],
    ['xLfo2Depth', 'LFO 2 DEPTH'],
  ] as const) {
    setFullName(id, n);
    REFS[id] = id.includes('Depth') || id === 'xSwing' ? `RV${rv++}` : `SW${swn++}`;
  }
}

const useExtraAll = () => useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
const useHoodPage = () => useSyncExternalStore(hoodPage.subscribe, hoodPage.get, hoodPage.get);

const CtlCell: React.FC<{ c: Ctl }> = ({ c }) => {
  const ref_ = REFS[c.id] ?? '';
  switch (c.k) {
    case 'knob':
      return <PcbKnob id={c.id} name={c.name} ref_={ref_} lo={c.lo} hi={c.hi} big={c.big} />;
    case 'step':
      return <PcbStep id={c.id} name={c.name} ref_={ref_} w={stepW(c.id)} />;
    default:
      return <PcbSelect id={c.id} name={c.name} ref_={ref_} w={c.w} cols={stepsOf(c.id).length > 10 ? 3 : 2} />;
  }
};

/** Le cadre montre par le double clic de la face : il clignote une fois. */
function useFlash(title: string): boolean {
  const { focus, focusN } = useHoodPage();
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (focus !== title) return undefined;
    // apres l'arrivee de la carte (le capot monte, puis 300 ms de fondu : hood.css)
    const a = window.setTimeout(() => setOn(true), 950);
    const b = window.setTimeout(() => setOn(false), 950 + 1700);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
      setOn(false);
    };
  }, [focus, focusN, title]);
  return on;
}

const Frame: React.FC<{ f: FrameSpec; x: number; y: number }> = ({ f, x, y }) => {
  const flash = useFlash(f.title);
  return (
    <PcbFrame title={f.title} x={x} y={y} w={frameW(f)} h={FRAME_H} led={f.led ? f.led() : undefined} flash={flash}>
      <div className="mm-p2-cells">
        {f.ctls.map((c) => (
          <CtlCell key={c.id} c={c} />
        ))}
      </div>
    </PcbFrame>
  );
};

/** Une rangee de cadres, centree dans la zone. */
const FrameRow: React.FC<{ y: number; frames: FrameSpec[] }> = ({ y, frames }) => {
  useExtraAll();
  const total = frames.reduce((s, f) => s + frameW(f), 0) + FRAME_GAP * (frames.length - 1);
  let x = ZONE.x + Math.round((ZONE.w - total) / 2);
  return (
    <>
      {frames.map((f) => {
        const fx = x;
        x += frameW(f) + FRAME_GAP;
        return <Frame key={f.title} f={f} x={fx} y={y} />;
      })}
    </>
  );
};

const Grid: React.FC<{ page: GridPage }> = ({ page }) => (
  <>
    {ROWS[page].map((r) => (
      <FrameRow key={r.y} y={r.y} frames={r.frames} />
    ))}
  </>
);

/* ---------------- FX : la sous-page, HELL et ses presets ---------------- */

const FxSwitch: React.FC = () => {
  const { fx } = useHoodPage();
  return (
    <div className="mm-p2-sub" role="tablist" aria-label="FX pages">
      <PcbKey role="tab" aria-selected={fx === 'rack'} on={fx === 'rack'} name="RACK" w={40} h={14} onClick={() => hoodPage.set({ fx: 'rack' })} />
      <PcbKey role="tab" aria-selected={fx === 'hell'} on={fx === 'hell'} name="HELL" w={40} h={14} onClick={() => hoodPage.set({ fx: 'hell' })} />
    </div>
  );
};

const HELL_W = 1000;
const HellPresets: React.FC = () => {
  useExtraAll();
  const cur = hellCurrent();
  const flash = useFlash('HELL PRESETS');
  const x0 = ZONE.x + Math.round((ZONE.w - HELL_W) / 2);
  return (
    <PcbFrame title="HELL PRESETS" x={x0} y={216} w={HELL_W} h={150} className="mm-p2-hellp" flash={flash}>
      <div className="mm-p2-hellp-keys">
        {HELL_PRESETS.map((p) => (
          <PcbKey key={p.name} name={p.name} w={56} h={16} on={cur?.name === p.name} aria-pressed={cur?.name === p.name} title={p.desc} onClick={() => hellLoad(p)} />
        ))}
      </div>
      <p className="mm-p2-hellp-desc" role="status" aria-live="polite">
        <b>{cur ? cur.name : 'YOUR SETTING'}</b>
        <span>{cur ? cur.desc : 'A preset sets every HELL control except MIX (if HELL is off, it comes in at 35 %).'}</span>
      </p>
    </PcbFrame>
  );
};

/** Le chemin du signal de HELL, serigraphie (rien de cliquable). */
const HellDiagram: React.FC = () => {
  const x0 = ZONE.x + Math.round((ZONE.w - 640) / 2);
  return (
    <svg className="mm-p2-helld" style={{ left: x0, top: 392 }} width="640" height="96" viewBox="0 0 640 96" aria-hidden="true">
      <g className="mm-p2-helld-line">
        <path d="M20 30 H96" />
        <path d="M188 30 H236" />
        <path d="M352 30 H400" />
        <path d="M492 30 H620" />
        <path d="M446 46 V76 H142 V46" />
        <path d="M58 30 V8 H560 V30" />
      </g>
      <g className="mm-p2-helld-box">
        <rect x="96" y="14" width="92" height="32" rx="3" />
        <rect x="236" y="14" width="116" height="32" rx="3" />
        <rect x="400" y="14" width="92" height="32" rx="3" />
      </g>
      <g className="mm-p2-helld-text">
        <text x="142" y="34">DELAY</text>
        <text x="294" y="34">BODE SHIFT</text>
        <text x="446" y="34">TONE</text>
        <text x="294" y="90">FEEDBACK : EVERY REPEAT SHIFTS AGAIN</text>
        <text x="20" y="22" textAnchor="start">IN</text>
        <text x="620" y="22" textAnchor="end">OUT</text>
        <text x="309" y="5">DRY</text>
      </g>
    </svg>
  );
};

const FxPage: React.FC = () => {
  const { fx } = useHoodPage();
  return (
    <>
      <FxSwitch />
      {fx === 'hell' ? (
        <>
          <Grid page="hell" />
          <HellPresets />
          <HellDiagram />
        </>
      ) : (
        <Grid page="rack" />
      )}
    </>
  );
};

/* ---------------- SEQ : la matrice ---------------- */

const MATRIX_W = 960;

const Matrix: React.FC<{ y: number }> = ({ y }) => {
  const v = useExtraAll();
  const flash = useFlash('MOD MATRIX');
  const col = (c: number) =>
    Array.from({ length: 3 }, (_, r) => {
      const i = c * 3 + r + 1;
      const live = v[`xM${i}Src`] > 0 && v[`xM${i}Dst`] > 0 && Math.abs(v[`xM${i}Amt`] - 0.5) > 0.001;
      return (
        <div key={i} className="mm-p2-mx-row" style={{ top: 30 + r * 44 }}>
          <span className="mm-p2-mx-n">{i}</span>
          <i className="mm-p2-led" data-on={live ? '1' : undefined} aria-hidden="true" />
          <PcbSelect id={`xM${i}Src`} name="" ref_="" w={104} bare up={r > 0} cols={2} />
          <span className="mm-p2-mx-arrow" aria-hidden="true">
            →
          </span>
          <PcbSelect id={`xM${i}Dst`} name="" ref_="" w={112} bare up={r > 0} cols={3} />
          <PcbKnob id={`xM${i}Amt`} name="AMOUNT" ref_={REFS[`xM${i}Amt`]} lo="" hi="" small />
        </div>
      );
    });
  return (
    <PcbFrame title="MOD MATRIX" x={ZONE.x + Math.round((ZONE.w - MATRIX_W) / 2)} y={y} w={MATRIX_W} h={166} className="mm-p2-mx" flash={flash}>
      {[0, 1].map((c) => (
        <div key={c} className="mm-p2-mx-col" style={{ left: 14 + c * 474 }}>
          <span className="mm-p2-mx-head" style={{ left: 105 }}>
            SOURCE
          </span>
          <span className="mm-p2-mx-head" style={{ left: 283 }}>
            DESTINATION
          </span>
          <span className="mm-p2-mx-head" style={{ left: 412 }}>
            AMOUNT
          </span>
          {col(c)}
        </div>
      ))}
    </PcbFrame>
  );
};

/* ---------------- SEQ : le sequenceur par pas ---------------- */

const useSteps = () => useSyncExternalStore(arpSteps.subscribe, arpSteps.get, arpSteps.get);

/** La tete (mm_transport) : "pos|len" pendant la lecture, '' a l'arret. */
const headKey = (): string => {
  const h = arpExternal.headState;
  return h.playing && h.pos >= 0 ? `${h.pos}|${h.len}` : '';
};

/** La longueur de la suite a l'arret : celle d'EDIT, sinon celle du premier accord. */
const idleLen = (): number => {
  const s = seq.get();
  if (s.edit) return s.len;
  const chord = arp.get().prog[0];
  if (chord === undefined) return STEPS_N;
  return seq.steps(chord)?.length ?? STEPS_N;
};

/** Ce qu'un pas montre : un point a sa valeur de depart, sinon son nom court. */
const SHORT: Record<StepTrack, Record<number, string>> = {
  acc: { 0: 'SOFT', 2: 'ACC' },
  slide: { 1: 'ON' },
  gate: { 0: 'SHORT', 2: 'LONG', 3: 'TIE' },
  rat: { 2: 'x2', 3: 'x3', 4: 'x4' },
  prob: { 75: '75%', 50: '50%', 25: '25%', 0: '0%' },
};

const STEP_PITCH = 50;
const stepX = (i: number): number => 92 + i * STEP_PITCH + Math.floor(i / 4) * 8;
const STEPS_W = stepX(STEPS_N - 1) + 44 + 60;

const Steps: React.FC = () => {
  const st = useSteps();
  const hk = useSyncExternalStore(extHead.onWake, headKey, headKey);
  useSyncExternalStore(seq.subscribe, seq.get, seq.get);
  useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  useSyncExternalStore(arp.subscribe, arp.get, arp.get);
  const flash = useFlash('STEP SEQUENCER');
  const head = hk ? hk.split('|').map(Number) : null;
  const len = Math.max(1, head && head[1] > 0 ? head[1] : idleLen());
  const at = head ? head[0] % STEPS_N : -1;
  const grid = useRef<HTMLDivElement>(null);
  const paint = useRef<{ track: StepTrack; v: number; last: number } | null>(null);

  const cellOf = (el: Element | null): { track: StepTrack; i: number } | null => {
    const c = el?.closest<HTMLElement>('[data-st]');
    if (!c || !grid.current?.contains(c)) return null;
    return { track: c.dataset.st as StepTrack, i: Number(c.dataset.i) };
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    const c = cellOf(e.target as Element);
    if (!c) return;
    e.preventDefault();
    const v = arpSteps.next(c.track, c.i, e.button === 2 || e.shiftKey ? -1 : 1);
    arpSteps.set(c.track, c.i, v);
    paint.current = { track: c.track, v, last: c.i };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* rien */
    }
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const p = paint.current;
    if (!p) return;
    const c = cellOf(document.elementFromPoint(e.clientX, e.clientY));
    if (!c || c.track !== p.track || c.i === p.last) return;
    const d = c.i > p.last ? 1 : -1;
    for (let i = p.last + d; i !== c.i + d; i += d) arpSteps.set(p.track, i, p.v);
    p.last = c.i;
  };
  const onEnd = (): void => {
    paint.current = null;
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const c = cellOf(e.target as Element);
    if (!c) return;
    const t = STEP_TRACKS.findIndex((x) => x.id === c.track);
    let nt = t;
    let ni = c.i;
    if (e.key === 'Enter' || e.key === ' ') arpSteps.set(c.track, c.i, arpSteps.next(c.track, c.i, e.shiftKey ? -1 : 1));
    else if (e.key === 'Delete' || e.key === 'Backspace') arpSteps.set(c.track, c.i, STEP_TRACKS[t].def);
    else if (e.key === 'ArrowRight') ni = Math.min(STEPS_N - 1, c.i + 1);
    else if (e.key === 'ArrowLeft') ni = Math.max(0, c.i - 1);
    else if (e.key === 'ArrowDown') nt = Math.min(STEP_TRACKS.length - 1, t + 1);
    else if (e.key === 'ArrowUp') nt = Math.max(0, t - 1);
    else return;
    e.preventDefault();
    e.stopPropagation();
    if (nt !== t || ni !== c.i) grid.current?.querySelector<HTMLElement>(`[data-st="${STEP_TRACKS[nt].id}"][data-i="${ni}"]`)?.focus({ preventScroll: true });
  };

  return (
    <PcbFrame title="STEP SEQUENCER" x={ZONE.x + Math.round((ZONE.w - STEPS_W) / 2)} y={26} w={STEPS_W} h={204} className="mm-p2-steps" flash={flash}>
      <div className="mm-p2-st-heads" aria-hidden="true">
        {Array.from({ length: STEPS_N }, (_, i) => (
          <span key={i} className="mm-p2-st-head" style={{ left: stepX(i) }} data-off={i >= len ? '1' : undefined}>
            <b>{i + 1}</b>
            <i className="mm-p2-led" data-on={i === at ? '1' : undefined} />
          </span>
        ))}
      </div>
      <div ref={grid} className="mm-p2-st-grid" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd} onContextMenu={(e) => e.preventDefault()} onKeyDown={onKey}>
        {STEP_TRACKS.map((t, r) => (
          <div key={t.id} className="mm-p2-st-row" style={{ top: 44 + r * 31 }}>
            <span className="mm-p2-st-name">{t.label}</span>
            {st[t.id].map((v, i) => {
              const short = SHORT[t.id][v];
              return (
                <button
                  key={i}
                  type="button"
                  className="mm-p2-st-cell"
                  style={{ left: stepX(i) }}
                  data-st={t.id}
                  data-i={i}
                  data-set={short ? '1' : undefined}
                  data-off={i >= len ? '1' : undefined}
                  data-head={i === at ? '1' : undefined}
                  aria-label={`${t.label} step ${i + 1}: ${t.names[t.values.indexOf(v)] ?? v}`}
                >
                  {short ?? '·'}
                </button>
              );
            })}
            <PcbKey className="mm-p2-st-clr" style={{ left: stepX(STEPS_N - 1) + 56 }} w={24} h={11} name="CLR" disabled={arpSteps.isDefault(t.id)} onClick={() => arpSteps.reset(t.id)} aria-label={`Reset ${t.label}`} />
          </div>
        ))}
      </div>
    </PcbFrame>
  );
};

/** RANDOM : trois styles (hypno.ts), NEW SEQ tire une suite et ses pistes ; RANDOM de la face prend le meme style. */
const RandomBox: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const style = useSyncExternalStore(hypnoStyle.subscribe, hypnoStyle.get, hypnoStyle.get);
  const st = useSteps();
  const flash = useFlash('RANDOM');
  return (
    <PcbFrame title="RANDOM" x={x} y={y} w={300} h={FRAME_H} className="mm-p2-rnd" flash={flash}>
      <div className="mm-p2-rnd-keys" role="radiogroup" aria-label="Random style">
        {HYPNO_STYLES.map((s) => (
          <PcbKey key={s} role="radio" aria-checked={s === style} on={s === style} name={s} w={44} h={18} onClick={() => hypnoStyle.set(s)} />
        ))}
        <span className="mm-p2-rnd-sep" aria-hidden="true" />
        <PcbKey accent name="NEW SEQ" w={44} h={18} onClick={() => hypnoNew()} aria-label="New hypnotic sequence" />
      </div>
      <div className="mm-p2-rnd-foot">
        <span>SHORT LOOPS IN THE CHORD · THE FRONT RANDOM KEY USES THIS STYLE</span>
        <PcbKey className="mm-p2-init" name="INIT STEPS" w={24} h={11} disabled={st === null || arpSteps.isDefault()} onClick={() => arpSteps.reset()} />
      </div>
    </PcbFrame>
  );
};

const SEQ_ROW: FrameSpec[] = [
  { title: 'ARP', ctls: [knob('xSwing', 'SWING', '0', 'FULL')] },
  { title: 'LFO 1 +', ctls: [sel('xLfo1Dest2', 'TARGET 2', 88, 'LFO 1 TARGET 2'), knob('xLfo1Depth2', 'DEPTH 2', '0', 'FULL', 'LFO 1 DEPTH 2')] },
  {
    title: 'LFO 2',
    led: () => X('xLfo2Dest') > 0,
    ctls: [sel('xLfo2Rate', 'SPEED', 52, 'LFO 2 SPEED'), sel('xLfo2Shape', 'SHAPE', 48, 'LFO 2 SHAPE'), sel('xLfo2Dest', 'TARGET', 88, 'LFO 2 TARGET'), knob('xLfo2Depth', 'DEPTH', '0', 'FULL', 'LFO 2 DEPTH')],
  },
];

const SeqPage: React.FC = () => {
  useExtraAll();
  const y = 250;
  const rowW = SEQ_ROW.reduce((s, f) => s + frameW(f), 0) + FRAME_GAP * SEQ_ROW.length + 300;
  let x = ZONE.x + Math.round((ZONE.w - rowW) / 2);
  const rnd = x;
  x += 300 + FRAME_GAP;
  return (
    <>
      <Steps />
      <RandomBox x={rnd} y={y} />
      {SEQ_ROW.map((f) => {
        const fx = x;
        x += frameW(f) + FRAME_GAP;
        return <Frame key={f.title} f={f} x={fx} y={y} />;
      })}
      <Matrix y={y + FRAME_H + 22} />
    </>
  );
};

/* ---------------- les volets : LIBRARY, MIDI ---------------- */

const LIB_W = 1000;
const LIB_COL = (LIB_W - 20 - 3 * 14) / 4;

const LibraryPanel: React.FC = () => {
  const cur = useSyncExternalStore(libStore.subscribe, libStore.get, libStore.get);
  const p = libCurrent();
  const x0 = ZONE.x + Math.round((ZONE.w - LIB_W) / 2);
  return (
    <>
      <PcbFrame title={`FACTORY BANK · ${LIB_PRESETS.length} SOUNDS`} x={x0} y={30} w={LIB_W - 270} h={330} className="mm-p2-lib">
        {LIB_CATS.map((c, k) => {
          const list = libOfCat(c);
          const cw = (LIB_W - 270 - 20 - 3 * 12) / 4;
          return (
            <div key={c} className="mm-p2-lib-col" style={{ left: 10 + k * (cw + 12), width: cw }}>
              <p className="mm-p2-lib-cat">
                <span>{c}</span>
                <span>{list.length}</span>
              </p>
              <ul>
                {list.map((x) => (
                  <li key={x.name}>
                    <button type="button" className="mm-p2-lib-item" data-on={x.name === cur ? '1' : undefined} aria-current={x.name === cur ? 'true' : undefined} onClick={() => libLoad(x)}>
                      <span>{x.name}</span>
                      <span className="mm-p2-lib-bpm">{x.bpm}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </PcbFrame>
      <PcbFrame title="DISK" x={x0 + LIB_W - 254} y={30} w={254} h={330} className="mm-p2-panel">
        <DiskPresets />
      </PcbFrame>
      <div className="mm-p2-lib-now" style={{ left: x0, top: 376, width: LIB_W }} role="status" aria-live="polite">
        <p>
          <b>{p ? p.name : 'PICK A SOUND'}</b>
          <span>{p ? `${p.cat} · ${p.bpm} BPM · ${p.desc}` : 'It loads at once, UNDO brings your sound back. The tempo shown is the one it was made at.'}</span>
        </p>
        <span className="mm-p2-lib-nav">
          <PcbKey name="PREV" h={20} onClick={() => libStep(-1)} aria-label="Previous sound" />
          <PcbKey name="NEXT" h={20} onClick={() => libStep(1)} aria-label="Next sound" />
        </span>
      </div>
    </>
  );
};
void LIB_COL;

const MIDI_DRAG_W = 300;
const MIDI_MAP_W = 640;

const MidiPanel: React.FC = () => {
  const x0 = ZONE.x + Math.round((ZONE.w - MIDI_DRAG_W - FRAME_GAP - MIDI_MAP_W) / 2);
  return (
    <>
      <PcbFrame title="DRAG MIDI" x={x0} y={60} w={MIDI_DRAG_W} h={232} className="mm-p2-panel">
        <DragMidi />
        <p className="mm-p2-note">
          HOLD AND DRAG ONTO AN ABLETON TRACK
          <br />
          x1 x2 x4 : TIMES THE PROGRESSION
        </p>
      </PcbFrame>
      <PcbFrame title="MIDI LEARN" x={x0 + MIDI_DRAG_W + FRAME_GAP} y={60} w={MIDI_MAP_W} h={232} className="mm-p2-panel">
        <MidiMap />
      </PcbFrame>
    </>
  );
};

const Overlay: React.FC<{ which: 'library' | 'midi' }> = ({ which }) => (
  <div className="mm-p2-over" data-which={which} role="dialog" aria-label={which === 'library' ? 'Library' : 'MIDI'}>
    <div className="mm-p2-over-head">
      <span>{which === 'library' ? 'LIBRARY' : 'MIDI'}</span>
      <PcbKey name="BACK" w={32} h={14} accent onClick={() => hoodPage.set({ overlay: null })} aria-label="Back to the page" />
    </div>
    {which === 'library' ? <LibraryPanel /> : <MidiPanel />}
  </div>
);

/* ---------------- la carte ---------------- */

/** Le decor de la carte : trous de fixation, quelques pistes en bas, le cartouche. Rien de cliquable. */
const BoardArt: React.FC = () => (
  <svg className="mm-p2-art" width={PAGE_W} height={PAGE_H} viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} aria-hidden="true">
    <g className="mm-p2-trace">
      <path d="M300 600 H560 L574 586 H760" />
      <path d="M40 628 H262 L276 614 H300" />
    </g>
    <g className="mm-p2-via">
      {[
        [300, 600],
        [760, 586],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.2" />
      ))}
    </g>
    <g transform="translate(790 572)">
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={`a${i}`} x={6 + i * 9} y={-4} width="4" height="5" className="mm-p2-pin" />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={`b${i}`} x={6 + i * 9} y={37} width="4" height="5" className="mm-p2-pin" />
      ))}
      <rect x="0" y="0" width="62" height="38" rx="2" className="mm-p2-chip" />
      <circle cx="7" cy="7" r="2" className="mm-p2-chip-dot" />
      <text x="31" y="23" className="mm-p2-chip-text">
        MM-X2
      </text>
      <text x="74" y="22" className="mm-p2-silk-ref">
        U7
      </text>
    </g>
    {[
      [32, 30],
      [1068, 30],
      [32, 630],
      [1068, 630],
    ].map(([x, y]) => (
      <g key={`${x}-${y}`} transform={`translate(${x} ${y})`} className="mm-p2-hole">
        <circle r="10.5" className="mm-p2-hole-ring" />
        <circle r="7" className="mm-p2-hole-screw" />
        <path d="M-3.6 0 H3.6 M0 -3.6 V3.6" className="mm-p2-hole-cross" />
      </g>
    ))}
    <g transform="translate(60 568)">
      <rect x="0" y="0" width="236" height="50" rx="3" className="mm-p2-cart" />
      <text x="12" y="20" className="mm-p2-cart-name">
        MM-ARP
      </text>
      <text x="224" y="19" textAnchor="end" className="mm-p2-cart-tag">
        EXPANSION
      </text>
      <line x1="12" y1="28" x2="224" y2="28" className="mm-p2-cart-line" />
      <text x="12" y="41" className="mm-p2-cart-small">
        DIGITAL CONTROL
      </text>
      <text x="224" y="41" textAnchor="end" className="mm-p2-cart-small">
        REV 3.0 / 2026
      </text>
    </g>
    <g transform="translate(980 612)">
      <circle r="9" className="mm-p2-pwr-glow" />
      <circle r="4.2" className="mm-p2-pwr" />
      <text x="12" y="-1" className="mm-p2-silk-ref mm-p2-silk-ref-w">
        D1
      </text>
      <text x="12" y="9" className="mm-p2-silk-ref mm-p2-silk-ref-w">
        PWR
      </text>
    </g>
  </svg>
);

/** L'afficheur du bandeau : le reglage touche (nom, valeur), sinon la page. */
const PAGE_NAME: Record<HoodTab, string> = { sound: 'SOUND', fx: 'FX', seq: 'SEQ' };
const HoodLcd: React.FC = () => {
  const line = useSyncExternalStore(hoodLcd.subscribe, hoodLcd.get, hoodLcd.get);
  const { tab, fx, overlay } = useHoodPage();
  const page = overlay ? overlay.toUpperCase() : tab === 'fx' ? `FX · ${fx === 'hell' ? 'HELL' : 'RACK'}` : PAGE_NAME[tab];
  return (
    <div className="mm-p2-lcd" role="status" aria-live="polite">
      <span className="mm-p2-lcd-a">{line ? line.name : 'MM-ARP'}</span>
      <span className="mm-p2-lcd-b">{line ? line.value : page}</span>
    </div>
  );
};

const useHood = () => useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
const useArpMidi = () => useSyncExternalStore(arpMidi.subscribe, arpMidi.get, arpMidi.get);

/** L'echelle du cadre : la largeur de la fenetre sur 1100. */
function useScale(): number {
  const [s, setS] = useState(() => (typeof window === 'undefined' ? 1 : window.innerWidth / PAGE_W));
  useLayoutEffect(() => {
    const on = (): void => setS(window.innerWidth / PAGE_W);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return s;
}

/** Le capot : monte de l'ouverture a la fin de la fermeture. */
export const HoodBoard: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const hood = useHood();
  if (hood === 'closed') return null;
  return <HoodBody stage={stage} />;
};

const HoodBody: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const hood = useHood();
  const { tab, overlay } = useHoodPage();
  const midi = useArpMidi();
  const scale = useScale();
  // Le capot se leve avec son ecran ; sous lui, plus la carte verte du site (le bac vide, puis la carte noire)
  useEffect(() => {
    const voy = stage?.voy;
    if (!stage || !voy) return undefined;
    const hidden = [voy.pcb.board, voy.pcb.parts];
    hidden.forEach((o) => {
      o.visible = false;
    });
    stage.invalidate();
    return () => {
      hidden.forEach((o) => {
        o.visible = true;
      });
      stage.invalidate();
    };
  }, [stage]);
  // Le capot s'ouvre : la table des CC a jour (la liste des presets : DiskPresets, a son montage)
  useEffect(() => {
    arpBridge.midimapGet();
  }, []);
  return (
    <div className="mm-p2" style={{ position: 'fixed' }} data-phase={hood} aria-label="MM-ARP hood">
      <div className="mm-p2-page" style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})` }}>
        <PcbDefs />
        <div className="mm-p2-fade">
          <div className="mm-p2-board">
            <BoardArt />
            {overlay ? (
              <Overlay which={overlay} />
            ) : (
              <div className="mm-p2-tab" key={tab} data-tab={tab}>
                {tab === 'sound' ? <Grid page="sound" /> : tab === 'fx' ? <FxPage /> : <SeqPage />}
              </div>
            )}
          </div>
          <nav className="mm-p2-strip" aria-label="Hood pages">
            <div className="mm-p2-tools">
              <PcbKey on={overlay === 'library'} aria-pressed={overlay === 'library'} name="LIBRARY" w={STRIP_KEY.w} h={STRIP_KEY.h} onClick={() => hoodPage.set({ overlay: overlay === 'library' ? null : 'library' })} />
              <PcbKey on={overlay === 'midi'} aria-pressed={overlay === 'midi'} name="MIDI" w={STRIP_KEY.w} h={STRIP_KEY.h} onClick={() => hoodPage.set({ overlay: overlay === 'midi' ? null : 'midi' })} />
              <PcbKey className="mm-p2-learn" aria-pressed={midi.learning} on={midi.learning} name="LEARN" w={STRIP_KEY.w} h={STRIP_KEY.h} onClick={() => arpBridge.learnMode(!midi.learning)} aria-label="MIDI learn" />
            </div>
            <div className="mm-p2-tabs" role="tablist" aria-label="Hood pages">
              {HOOD_TABS.map((t) => (
                <PcbKey key={t.id} role="tab" aria-selected={t.id === tab && !overlay} className="mm-p2-tabkey" on={t.id === tab && !overlay} name={t.label} w={56} h={STRIP_KEY.h} onClick={() => hoodPage.set({ tab: t.id, overlay: null })} />
              ))}
            </div>
            <HoodLcd />
            <PcbKey className="mm-p2-close" accent name="CLOSE" w={STRIP_KEY.w} h={STRIP_KEY.h} aria-label="Close the machine" onClick={() => openToggle(stage, 'voy')} />
          </nav>
        </div>
      </div>
    </div>
  );
};
