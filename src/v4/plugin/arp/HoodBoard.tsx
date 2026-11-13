/**
 * Le capot du MM-ARP : une seule carte, noire (2026-11-12, Mika : "un PCB noir plus sobre et le meme genre d'interface ...
 * quand on clic sur Open la face avant se releve mais comme si il y avait une decoupe sur l'ecran" ; 2026-11-13 : "toujours
 * un trou comme ca ca vient s'emboiter a chaque fois dans le meme ecran ... je veux avoir qu'une seule page").
 *
 * - OPEN leve le capot 3D sans son ecran ni la carte verte du site (le bac vide dessous) ; l'ecran reste a sa place, au
 *   pixel ou il est capot ferme (LcdWindow : une image du canevas du LCD 3D, voyager/screen.ts, a chaque dessin), il
 *   continue de vivre (accords, tempo, notes) et montre le reglage qu'on touche (voyMsg, sa ligne du bas). La carte noire
 *   arrive quand le capot est monte. A la fermeture, le capot redescend sur l'ecran.
 * - Vernis noir mat, serigraphie blanche discrete, quelques pistes, peu de composants ; les pieces des TWEAKS du site
 *   (pcbui.tsx) : potards de precision, glissieres, rotatifs a crans nommes, afficheurs, cadres fins.
 * - Sept onglets (hoodPage.ts) : TWEAKS (ceux de l'ancienne carte verte, voyParams), SOUND, FX, MOD (LFO, matrice de 6
 *   lignes), STEPS (sequenceur par pas, 16 pas, 5 pistes, SWING), LIBRARY (banque d'usine, 40 presets, et DISK), MIDI
 *   (DRAG MIDI, MIDI LEARN). Les 65 reglages du VST3 seul (extra.ts) y sont tous. MIDI LEARN et CLOSE dans le bandeau.
 *
 * La carte vit dans un cadre de 1100 x 704 (la fenetre de base du VST3) mis a l'echelle de la fenetre (son rapport est
 * fixe : PluginEditor.cpp) ; l'ecran garde ainsi la place qu'il a sur la face.
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
import { HOOD_TABS, hoodPage, type HoodTab } from './hoodPage';
import { LIB_CATS, LIB_PRESETS, libCurrent, libLoad, libOfCat, libStep, libStore } from './library';
import { DiskPresets } from './DiskPresets';
import { DragMidi, MidiMap } from './HoodPanel';
import { arpMidi } from './midimap';
import { PcbDefs, PcbFrame, PcbKey, PcbKnob, PcbRotary, PcbSelect, PcbSwitch, setFullName } from './pcbui';
import { arpSteps, STEP_TRACKS, STEPS_N, type StepTrack } from './steps';
import './hood.css';

/** Le cadre de la page (la fenetre de base du VST3). */
const PAGE_W = 1100;
const PAGE_H = 704;
/** Le LCD capot ferme, dans ce cadre (mesure sur la face a 1100 x 704) : le cadre noir, puis le verre. */
const LCD_BEZEL = { x: 326, y: 384, w: 449, h: 185 };
const LCD_GLASS = { x: 338, y: 395, w: 425, h: 162 };
/** La zone des reglages : au-dessus de l'ecran, toute la largeur. */
const ZONE = { x: 24, w: 1052 };
const FRAME_GAP = 14;
/** Les touches du bandeau : celles de la face, en plus petit (le bandeau reste bas). */
const STRIP_KEY = { w: 44, h: 18 };

/* ---------------- les reglages, onglet par onglet ---------------- */

type Ctl =
  | { k: 'knob'; id: string; name: string; lo: string; hi: string; full?: string }
  | { k: 'sw'; id: string; name: string; full?: string }
  | { k: 'rot'; id: string; name: string; w: number; full?: string }
  | { k: 'sel'; id: string; name: string; w: number; full?: string };

interface FrameSpec {
  title: string;
  ctls: Ctl[];
  /** la LED du titre : l'effet agit */
  led?: () => boolean;
}

const knob = (id: string, name: string, lo: string, hi: string, full?: string): Ctl => ({ k: 'knob', id, name, lo, hi, full });
const sw = (id: string, name: string, full?: string): Ctl => ({ k: 'sw', id, name, full });
const rot = (id: string, name: string, w: number, full?: string): Ctl => ({ k: 'rot', id, name, w, full });
const sel = (id: string, name: string, w: number, full?: string): Ctl => ({ k: 'sel', id, name, w, full });

const X = (id: string): number => arpExtra.of(id);

const CELL_W = 80;
const cellW = (c: Ctl): number => (c.k === 'rot' ? c.w : c.k === 'sel' ? c.w + 48 : CELL_W);
const frameW = (f: FrameSpec): number => f.ctls.reduce((s, c) => s + cellW(c), 0) + 20;
const FRAME_H = 100;

const ROWS: Record<'tweaks' | 'sound' | 'fx' | 'mod', { y: number; frames: FrameSpec[] }[]> = {
  // Les TWEAKS de l'ancienne carte verte (voyager/params.ts, section tweak), dans ses groupes et ses bouts de course
  tweaks: [
    {
      y: 88,
      frames: [
        { title: 'OSCILLATORS', ctls: [knob('phase', 'PHASE', 'FREE', '360'), knob('drift', 'DRIFT', 'STABLE', 'LOOSE'), knob('stack', 'STACK', 'OFF', '30 CT'), sw('sync', 'SYNC')] },
        {
          title: 'OUTPUT',
          ctls: [knob('width', 'WIDTH', 'MONO', 'WIDE'), knob('wide', 'WIDE', 'OFF', 'FULL'), knob('monoLow', 'BASS MONO', 'OFF', '300 HZ'), knob('glue', 'GLUE', 'OFF', 'TIGHT'), knob('duck', 'SIDECHAIN', 'OFF', '-24 DB')],
        },
      ],
    },
    {
      y: 204,
      frames: [
        { title: 'PERFORMANCE', ctls: [knob('keyTrack', 'KEY TRACK', '0', 'FULL'), knob('accent', 'ACCENT', 'FLAT', 'HARD'), knob('accFlt', 'ACC FILTER', 'LEVEL', 'FILTER'), rot('chord', 'CHORD', 132)] },
        { title: 'FILTER', ctls: [knob('load', 'LOAD', 'CLEAN', 'HOT'), knob('space', 'SPACE', 'OFF', '1 OCT'), sw('fpol', 'POLARITY')] },
        { title: 'DELAY', ctls: [knob('dlyTime', 'DLY TIME', '1/8', '1/2'), knob('tape', 'TAPE', 'CLEAN', 'WORN')] },
      ],
    },
  ],
  sound: [
    {
      y: 30,
      frames: [
        {
          title: 'OSC +',
          ctls: [knob('xRing', 'RING MOD', 'OFF', 'FULL'), knob('xFold', 'FOLD', 'OFF', 'FULL', 'WAVEFOLD'), knob('xNoiseColor', 'NOISE', 'DARK', 'BRIGHT', 'NOISE COLOR'), rot('xUnison', 'UNISON', 96)],
        },
        { title: 'FILTER +', ctls: [knob('xHpf', 'HIGH PASS', 'OFF', '2K'), knob('xComb', 'COMB', 'OFF', 'FULL'), knob('xCombFb', 'COMB FB', 'NEG', 'POS')] },
        { title: 'AMP', ctls: [knob('xFeedback', 'FEEDBACK', 'OFF', 'FULL'), rot('xAmpMode', 'AMP MODE', 140)] },
      ],
    },
    {
      y: 146,
      frames: [
        { title: 'EQ', ctls: [knob('xEqLow', 'LOW', '-12', '+12', 'EQ LOW'), knob('xEqMid', 'MID', '-12', '+12', 'EQ MID'), knob('xEqHigh', 'HIGH', '-12', '+12', 'EQ HIGH'), knob('xEqAir', 'AIR BAND', '-10', '+10', 'EQ AIR BAND')] },
        { title: 'MASTER', ctls: [knob('xWarmth', 'WARMTH', 'OFF', 'FULL'), knob('xBass', 'BASS', '-6', '+6', 'MASTER BASS'), knob('xAir', 'AIR', '-6', '+6', 'MASTER AIR'), knob('xWidth', 'WIDTH', 'MONO', '200 %')] },
        { title: 'DISTORTION', led: () => X('xDist') > 0, ctls: [knob('xDist', 'AMOUNT', 'OFF', 'FULL', 'DISTORTION'), knob('xDistTone', 'TONE', 'DARK', 'BRIGHT', 'DIST TONE')] },
      ],
    },
    {
      y: 262,
      frames: [
        { title: 'VOICE', ctls: [rot('xVoiceMode', 'MODE', 136, 'VOICE MODE'), sel('xPbRange', 'BEND RANGE', 64)] },
        { title: 'ENGINE', ctls: [sw('xQuality', 'QUALITY')] },
      ],
    },
  ],
  fx: [
    {
      y: 88,
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
        { title: 'CRUSH', led: () => X('xCrushBits') > 0 || X('xCrushRate') > 0, ctls: [knob('xCrushBits', 'BITS', 'OFF', '4 BIT', 'BITCRUSH'), knob('xCrushRate', 'RATE', 'OFF', '2 KHZ', 'DOWNSAMPLE')] },
      ],
    },
    {
      y: 204,
      frames: [
        { title: 'PUMP', led: () => X('xPumpDepth') > 0, ctls: [knob('xPumpDepth', 'DEPTH', 'OFF', 'FULL', 'PUMP'), rot('xPumpRate', 'RATE', 96, 'PUMP RATE'), knob('xPumpShape', 'RELEASE', 'SHORT', 'LONG', 'PUMP RELEASE')] },
        { title: 'REVERB', ctls: [knob('xRevSize', 'SIZE', '0.6 S', '9.6 S', 'REVERB SIZE'), knob('xRevTone', 'TONE', 'DARK', 'BRIGHT', 'REVERB TONE'), knob('xRevPre', 'PRE DELAY', '0', '100 MS', 'REVERB PRE DELAY')] },
        { title: 'SPACE', ctls: [rot('xDlyMode', 'DELAY MODE', 128), knob('xShimmer', 'SHIMMER', 'OFF', 'FULL')] },
      ],
    },
  ],
  mod: [
    {
      y: 30,
      frames: [
        { title: 'LFO 1 +', ctls: [sel('xLfo1Dest2', 'TARGET 2', 96, 'LFO 1 TARGET 2'), knob('xLfo1Depth2', 'DEPTH 2', '0', 'FULL', 'LFO 1 DEPTH 2')] },
        {
          title: 'LFO 2',
          led: () => X('xLfo2Dest') > 0,
          ctls: [sel('xLfo2Rate', 'SPEED', 64, 'LFO 2 SPEED'), sel('xLfo2Shape', 'SHAPE', 56, 'LFO 2 SHAPE'), sel('xLfo2Dest', 'TARGET', 96, 'LFO 2 TARGET'), knob('xLfo2Depth', 'DEPTH', '0', 'FULL', 'LFO 2 DEPTH')],
        },
      ],
    },
  ],
};

/*
 * Les designateurs : les TWEAKS gardent ceux de la carte verte (RV5 a RV19, SW1 a SW3, dans l'ordre de VOY_TWEAKS), les
 * reglages du VST3 seul suivent (RV20, SW4...), dans l'ordre des onglets.
 */
const REFS: Record<string, string> = {};
{
  let rvT = 5;
  let swT = 1;
  for (const k of VOY_TWEAKS) REFS[k.id] = k.id === 'sync' || k.id === 'chord' || k.id === 'fpol' ? `SW${swT++}` : `RV${rvT++}`;
  let rv = 20;
  let swn = 4;
  const all = [...ROWS.sound, ...ROWS.fx, ...ROWS.mod].flatMap((r) => r.frames.flatMap((f) => f.ctls));
  for (const c of all) {
    REFS[c.id] = c.k === 'knob' ? `RV${rv++}` : `SW${swn++}`;
    setFullName(c.id, c.full ?? c.name);
  }
  for (let i = 1; i <= MATRIX_ROWS; i += 1) {
    setFullName(`xM${i}Src`, `MATRIX ${i} SOURCE`);
    setFullName(`xM${i}Dst`, `MATRIX ${i} DEST`);
    setFullName(`xM${i}Amt`, `MATRIX ${i} AMOUNT`);
    REFS[`xM${i}Amt`] = `RV${rv++}`;
  }
  REFS.xSwing = `RV${rv++}`;
  setFullName('xSwing', 'ARP SWING');
}

const useExtraAll = () => useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);

const CtlCell: React.FC<{ c: Ctl }> = ({ c }) => {
  const ref_ = REFS[c.id] ?? '';
  switch (c.k) {
    case 'knob':
      return <PcbKnob id={c.id} name={c.name} ref_={ref_} lo={c.lo} hi={c.hi} />;
    case 'sw':
      return <PcbSwitch id={c.id} name={c.name} ref_={ref_} />;
    case 'rot':
      return <PcbRotary id={c.id} name={c.name} ref_={ref_} w={c.w} />;
    default:
      return <PcbSelect id={c.id} name={c.name} ref_={ref_} w={c.w} cols={(extraParam(c.id)?.steps?.length ?? 0) > 10 ? 3 : 2} />;
  }
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
        return (
          <PcbFrame key={f.title} title={f.title} x={fx} y={y} w={frameW(f)} h={FRAME_H} led={f.led ? f.led() : undefined}>
            <div className="mm-p2-cells">
              {f.ctls.map((c) => (
                <CtlCell key={c.id} c={c} />
              ))}
            </div>
          </PcbFrame>
        );
      })}
    </>
  );
};

/* ---------------- MOD : la matrice ---------------- */

const MATRIX_W = 960;

const Matrix: React.FC = () => {
  const v = useExtraAll();
  const col = (c: number) =>
    Array.from({ length: 3 }, (_, r) => {
      const i = c * 3 + r + 1;
      const live = v[`xM${i}Src`] > 0 && v[`xM${i}Dst`] > 0 && Math.abs(v[`xM${i}Amt`] - 0.5) > 0.001;
      return (
        <div key={i} className="mm-p2-mx-row" style={{ top: 36 + r * 52 }}>
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
    <PcbFrame title="MOD MATRIX" x={ZONE.x + Math.round((ZONE.w - MATRIX_W) / 2)} y={146} w={MATRIX_W} h={196} className="mm-p2-mx">
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

/* ---------------- STEPS : le sequenceur par pas ---------------- */

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
    <PcbFrame title="STEP SEQUENCER" x={ZONE.x + Math.round((ZONE.w - STEPS_W) / 2)} y={30} w={STEPS_W} h={214} className="mm-p2-steps">
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
          <div key={t.id} className="mm-p2-st-row" style={{ top: 46 + r * 32 }}>
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

const StepsSide: React.FC = () => {
  const st = useSteps();
  return (
    <>
      <PcbFrame title="ARP" x={ZONE.x + Math.round((ZONE.w - STEPS_W) / 2)} y={262} w={100} h={FRAME_H}>
        <div className="mm-p2-cells">
          <PcbKnob id="xSwing" name="SWING" ref_={REFS.xSwing} lo="0" hi="FULL" />
        </div>
      </PcbFrame>
      <div className="mm-p2-st-help" style={{ left: ZONE.x + Math.round((ZONE.w - STEPS_W) / 2) + 124, top: 276 }}>
        <p>CLICK : NEXT VALUE · RIGHT CLICK : PREVIOUS · DRAG : PAINT THE ROW</p>
        <p>ONE STEP PER NOTE OF THE ARPEGGIO, THE LED FOLLOWS THE PLAYHEAD</p>
        <PcbKey className="mm-p2-init" name="INIT ALL ROWS" disabled={st === null || arpSteps.isDefault()} onClick={() => arpSteps.reset()} />
      </div>
    </>
  );
};

/* ---------------- LIBRARY : la banque d'usine ---------------- */

const LIB_W = 984;
/** DISK : a droite de l'ecran, sous la banque. */
const DISK_BOX = { x: 792, y: 396, w: 250, h: 226 };
const LIB_COL = (LIB_W - 20 - 3 * 14) / 4;

const Library: React.FC = () => {
  const cur = useSyncExternalStore(libStore.subscribe, libStore.get, libStore.get);
  const p = libCurrent();
  const x0 = ZONE.x + Math.round((ZONE.w - LIB_W) / 2);
  return (
    <>
      <PcbFrame title={`FACTORY BANK · ${LIB_PRESETS.length} SOUNDS`} x={x0} y={30} w={LIB_W} h={300} className="mm-p2-lib">
        {LIB_CATS.map((c, k) => {
          const list = libOfCat(c);
          return (
            <div key={c} className="mm-p2-lib-col" style={{ left: 10 + k * (LIB_COL + 14), width: LIB_COL }}>
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
      {/* DISK : les presets du dossier de l'utilisateur, a droite de l'ecran */}
      <PcbFrame title="DISK" x={DISK_BOX.x} y={DISK_BOX.y} w={DISK_BOX.w} h={DISK_BOX.h} className="mm-p2-panel">
        <DiskPresets />
      </PcbFrame>
      <div className="mm-p2-lib-now" style={{ left: x0, top: 340, width: LIB_W }} role="status" aria-live="polite">
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

/* ---------------- la carte ---------------- */

/** Le decor de la carte : trous de fixation, quelques pistes, un circuit, le cartouche. Rien de cliquable. */
const BoardArt: React.FC = () => (
  <svg className="mm-p2-art" width={PAGE_W} height={PAGE_H} viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} aria-hidden="true">
    <g className="mm-p2-trace">
      <path d="M326 470 H262 L240 448 V404 L222 386 H60" />
      <path d="M326 520 H286 L268 538 V546" />
      <path d="M560 573 V600 H596" />
      <path d="M40 640 H300 L314 626 H560" />
    </g>
    <g className="mm-p2-via">
      {[
        [60, 386],
        [268, 546],
        [560, 626],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.2" />
      ))}
    </g>
    {/* U7 : le processeur de l'extension, et deux resistances */}
    <g transform="translate(600 590)">
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
    <g transform="translate(736 594)">
      <rect x="0" y="0" width="16" height="8" rx="1" className="mm-p2-smd" />
      <rect x="0" y="0" width="3.5" height="8" className="mm-p2-pin" />
      <rect x="12.5" y="0" width="3.5" height="8" className="mm-p2-pin" />
      <text x="22" y="7" className="mm-p2-silk-ref">
        R21
      </text>
      <rect x="0" y="20" width="16" height="8" rx="1" className="mm-p2-smd" />
      <rect x="0" y="20" width="3.5" height="8" className="mm-p2-pin" />
      <rect x="12.5" y="20" width="3.5" height="8" className="mm-p2-pin" />
      <text x="22" y="27" className="mm-p2-silk-ref">
        R22
      </text>
    </g>
    {/* les trous de fixation */}
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
    {/* le nom de la carte, le cartouche */}
    <text x="52" y="438" className="mm-p2-silk-big">
      MAUDITE MACHINE
    </text>
    <g transform="translate(52 560)">
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
        REV 2.0 / 2026
      </text>
    </g>
    {/* D1 PWR : la LED de la carte, comme sur la verte */}
    <g transform="translate(980 638)">
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

/** L'ecran de la machine, vu par la decoupe : la copie du canevas du LCD 3D, a chaque dessin. */
const LcdWindow: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const out = ref.current;
    if (!out) return undefined;
    let raf = 0;
    let last = -1;
    let at = 0;
    // Une image, pas un canevas : un canevas recopie (drawImage) se compose de travers sous Chromium pendant que le capot
    // 3D bouge (un rectangle noir au-dessus de l'ecran). Au plus une copie toutes les 60 ms.
    const tick = (now: number): void => {
      raf = window.requestAnimationFrame(tick);
      const lcd = stage?.voy?.lcd;
      const src = lcd?.texture.image as HTMLCanvasElement | undefined;
      if (!lcd || !src || !src.width || lcd.info.draws === last || now - at < 60) return;
      last = lcd.info.draws;
      at = now;
      try {
        out.src = src.toDataURL('image/png');
      } catch {
        /* rien */
      }
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [stage]);
  return (
    <div className="mm-p2-lcd" style={{ left: LCD_BEZEL.x, top: LCD_BEZEL.y, width: LCD_BEZEL.w, height: LCD_BEZEL.h }} aria-hidden="true">
      <img ref={ref} alt="" className="mm-p2-lcd-glass" draggable={false} style={{ left: LCD_GLASS.x - LCD_BEZEL.x, top: LCD_GLASS.y - LCD_BEZEL.y, width: LCD_GLASS.w, height: LCD_GLASS.h }} />
    </div>
  );
};

/* ---------------- MIDI : DRAG MIDI, MIDI LEARN ---------------- */

const MIDI_DRAG_W = 300;
const MIDI_MAP_W = 640;

const MidiTab: React.FC = () => {
  const x0 = ZONE.x + Math.round((ZONE.w - MIDI_DRAG_W - FRAME_GAP - MIDI_MAP_W) / 2);
  return (
    <>
      <PcbFrame title="DRAG MIDI" x={x0} y={88} w={MIDI_DRAG_W} h={232} className="mm-p2-panel">
        <DragMidi />
        <p className="mm-p2-note">
          HOLD AND DRAG ONTO AN ABLETON TRACK
          <br />
          x1 x2 x4 : TIMES THE PROGRESSION
        </p>
      </PcbFrame>
      <PcbFrame title="MIDI LEARN" x={x0 + MIDI_DRAG_W + FRAME_GAP} y={88} w={MIDI_MAP_W} h={232} className="mm-p2-panel">
        <MidiMap />
      </PcbFrame>
    </>
  );
};

const TabBody: React.FC<{ tab: HoodTab }> = ({ tab }) => {
  if (tab === 'midi') return <MidiTab />;
  if (tab === 'steps')
    return (
      <>
        <Steps />
        <StepsSide />
      </>
    );
  if (tab === 'library') return <Library />;
  return (
    <>
      {ROWS[tab].map((r) => (
        <FrameRow key={r.y} y={r.y} frames={r.frames} />
      ))}
      {tab === 'mod' && <Matrix />}
    </>
  );
};

const useHood = () => useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
const useHoodPage = () => useSyncExternalStore(hoodPage.subscribe, hoodPage.get, hoodPage.get);
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
  const { tab } = useHoodPage();
  const midi = useArpMidi();
  const scale = useScale();
  // La decoupe : le capot 3D se leve sans son ecran (l'ecran reste en place, LcdWindow) et sans la carte verte du site
  // (sous le capot, le bac vide, puis la carte noire) ; il retrouve les deux, capot pose
  useEffect(() => {
    const voy = stage?.voy;
    if (!stage || !voy) return undefined;
    const hidden = [voy.lcd.glass, voy.lcd.bezel, voy.pcb.board, voy.pcb.parts];
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
            <div className="mm-p2-tab" key={tab} data-tab={tab}>
              <TabBody tab={tab} />
            </div>
          </div>
          <nav className="mm-p2-strip" aria-label="Hood pages">
            <PcbKey className="mm-p2-learn" aria-pressed={midi.learning} on={midi.learning} name="MIDI LEARN" w={STRIP_KEY.w} h={STRIP_KEY.h} onClick={() => arpBridge.learnMode(!midi.learning)} />
            <div className="mm-p2-tabs" role="tablist" aria-label="Hood sections">
              {HOOD_TABS.map((t) => (
                <PcbKey key={t.id} role="tab" aria-selected={t.id === tab} className="mm-p2-tabkey" on={t.id === tab} name={t.label} w={STRIP_KEY.w} h={STRIP_KEY.h} onClick={() => hoodPage.set({ tab: t.id })} />
              ))}
            </div>
            <PcbKey className="mm-p2-close" accent name="CLOSE" w={STRIP_KEY.w} h={STRIP_KEY.h} aria-label="Close the machine" onClick={() => openToggle(stage, 'voy')} />
          </nav>
        </div>
        <LcdWindow stage={stage} />
      </div>
    </div>
  );
};
