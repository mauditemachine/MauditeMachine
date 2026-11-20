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
 * - Le clic d'un potard de la face ouvre la page qui le detaille, son cadre clignote (hellKnob.tsx).
 *
 * La carte vit dans un cadre de 1100 x 704 (la fenetre de base du VST3) mis a l'echelle de la fenetre (son rapport est
 * fixe : PluginEditor.cpp).
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { openToggle } from '../../actions';
import type { Stage } from '../../scene/renderer';
import { voyExplode } from '../../state/explode';
import { arpExternal } from '../../voyager/arp';
import { voyParams, VOY_TWEAKS } from '../../voyager/params';
import { arpBridge } from './bridge';
import { arpExtra, eqLaws, extraParam, MATRIX_ROWS } from './extra';
import { hoodPage, hoodPageStep, type HoodTab } from './hoodPage';
import { hypnoNew, hypnoStyle, HYPNO_STYLES } from './hypno';
import { LIB_CATS, LIB_PRESETS, libCurrent, libLoad, libOfCat, libStep, libStore } from './library';
import { DiskPresets } from './DiskPresets';
import { DragMidi, MidiMap } from './HoodPanel';
import { SkyPage } from './SkyPage';
import { HellPage } from './HellPage';
import { DistoPage } from './DistoPage';
import { DelayPage } from './DelayPage';
import { FX2 } from './fx2';
import { SkyPageA, SkyPageB } from './SkyPage2';
import { HellPageA, HellPageB } from './HellPage2';
import { arpSpec, SPEC_BINS } from './spec';
import { HoodLookButton } from './LookPanel';
import { HoodCpuMeter } from './CpuMeter';
import { arpMidi } from './midimap';
import { hoodLcd, PcbDefs, PcbFrame, PcbKey, PcbKnob, PcbRotary, PcbSelect, PcbStep, PcbToggle, registerVirtual, say, setFullName, SRC } from './pcbui';
import { arpSteps } from './steps';
import './hood.css';
import { NavKeys, SeqPage, SoundPage } from './pages2';

/** Le cadre de la page (la fenetre de base du VST3). */
const PAGE_W = 1100;
const PAGE_H = 704;
/** La zone des reglages : toute la largeur de la carte. */
export const ZONE = { x: 44, w: 1012 };
const FRAME_GAP = 22;
/** Les touches du bandeau : celles de la face, en plus petit (le bandeau reste bas). */
const STRIP_KEY = { w: 44, h: 16 };

/* ---------------- les reglages, page par page ---------------- */

export type Ctl =
  | { k: 'knob'; id: string; name: string; lo: string; hi: string; full?: string; big?: boolean; fine?: boolean }
  | { k: 'step'; id: string; name: string; full?: string }
  | { k: 'rot'; id: string; name: string; full?: string }
  | { k: 'sel'; id: string; name: string; w: number; full?: string };

export interface FrameSpec {
  title: string;
  ctls: Ctl[];
  /** la LED du titre : l'effet agit */
  led?: () => boolean;
}

export const knob = (id: string, name: string, lo: string, hi: string, full?: string): Ctl => ({ k: 'knob', id, name, lo, hi, full });
/** Le petit knob fin (2026-11-17) : un reglage secondaire ; les potards du MM-RYTM (knob) gardent les principaux. */
const fine = (id: string, name: string, full?: string): Ctl => ({ k: 'knob', id, name, lo: '', hi: '', full, fine: true });
const step = (id: string, name: string, full?: string): Ctl => ({ k: 'step', id, name, full });
const sel = (id: string, name: string, w: number, full?: string): Ctl => ({ k: 'sel', id, name, w, full });
const rot = (id: string, name: string, full?: string): Ctl => ({ k: 'rot', id, name, full });

export const X = (id: string): number => arpExtra.of(id);

const CELL_W = 80;
const ROT_W = 108;
const stepsOf = (id: string): readonly string[] => extraParam(id)?.steps ?? VOY_TWEAKS.find((k) => k.id === id)?.steps ?? [];
/** La largeur d'une touche a crans : une LED par cran (une seule pour un ON / OFF). */
const stepW = (id: string): number => {
  const s = stepsOf(id);
  // deux crans : le levier (PcbToggle)
  if (s.length === 2) return 84;
  return Math.max(CELL_W, s.length * 34 + 12);
};
const FINE_W = 56;
const cellW = (c: Ctl): number => (c.k === 'step' ? stepW(c.id) : c.k === 'rot' ? ROT_W : c.k === 'sel' ? c.w + 28 : c.big ? 104 : c.fine ? FINE_W : CELL_W);
export const frameW = (f: FrameSpec): number => f.ctls.reduce((s, c) => s + cellW(c), 0) + 20;
export const FRAME_H = 112;

type GridPage = 'sound';

const ROWS: Record<GridPage, { y: number; frames: FrameSpec[] }[]> = {
  // SOUND (2026-11-17, Mika : "le plus de choses possible sur une seule page") : les TWEAKS de la face, le son du VST3
  // seul et les effets du rack, du generateur a la sortie ; un potard du MM-RYTM pour le reglage principal de chaque
  // section, les petits knobs fins pour les secondaires, les leviers pour les deux crans, les touches au clic
  sound: [
    {
      y: 62,
      frames: [
        { title: 'OSCILLATORS', ctls: [fine('phase', 'PHASE'), knob('drift', 'DRIFT', 'STABLE', 'LOOSE'), fine('stack', 'STACK'), step('sync', 'SYNC')] },
        {
          title: 'OSC +',
          ctls: [knob('xRing', 'RING MOD', 'OFF', 'FULL'), fine('xFold', 'FOLD', 'WAVEFOLD'), fine('xNoiseColor', 'NOISE', 'NOISE COLOR'), step('xUnison', 'UNISON')],
        },
        { title: 'VOICE', ctls: [step('xVoiceMode', 'MODE', 'VOICE MODE'), rot('xPbRange', 'BEND', 'BEND RANGE')] },
      ],
    },
    {
      y: 179,
      frames: [
        { title: 'FILTER', ctls: [knob('load', 'LOAD', 'CLEAN', 'HOT'), fine('space', 'SPACE'), fine('keyTrack', 'KEY TRACK'), step('fpol', 'POLARITY')] },
        {
          title: 'FILTER +',
          led: () => X('xHpf') > 0 || X('xComb') > 0,
          ctls: [knob('xHpf', 'HIGH PASS', 'OFF', '2K'), fine('xComb', 'COMB'), fine('xCombFb', 'COMB FB')],
        },
        { title: 'AMP', ctls: [knob('xFeedback', 'FEEDBACK', 'OFF', 'FULL'), step('xAmpMode', 'AMP MODE')] },
      ],
    },
    {
      y: 296,
      frames: [
        { title: 'PERFORMANCE', ctls: [knob('accent', 'ACCENT', 'FLAT', 'HARD'), fine('accFlt', 'ACC FILTER'), rot('chord', 'CHORD')] },
        {
          title: 'OUTPUT',
          ctls: [knob('width', 'WIDTH', 'MONO', 'WIDE'), fine('wide', 'WIDE'), fine('monoLow', 'BASS MONO'), fine('glue', 'GLUE'), fine('duck', 'SIDECHAIN')],
        },
        { title: 'ENGINE', ctls: [step('xQuality', 'QUALITY')] },
      ],
    },
    {
      y: 413,
      frames: [
        { title: 'MASTER', ctls: [knob('xWarmth', 'WARMTH', 'OFF', 'FULL'), fine('xBass', 'BASS', 'MASTER BASS'), fine('xAir', 'AIR', 'MASTER AIR'), fine('xWidth', 'WIDTH', 'MASTER WIDTH')] },
        {
          title: 'PHASER',
          led: () => X('xPhMix') > 0,
          ctls: [knob('xPhMix', 'MIX', 'OFF', 'FULL', 'PHASER'), fine('xPhRate', 'RATE', 'PHASER RATE'), fine('xPhDepth', 'DEPTH', 'PHASER DEPTH'), fine('xPhFb', 'FEEDBACK', 'PHASER FEEDBACK')],
        },
      ],
    },
    {
      y: 530,
      frames: [
        {
          title: 'FLANGER',
          led: () => X('xFlMix') > 0,
          ctls: [knob('xFlMix', 'MIX', 'OFF', 'FULL', 'FLANGER'), fine('xFlRate', 'RATE', 'FLANGER RATE'), fine('xFlDepth', 'DEPTH', 'FLANGER DEPTH'), fine('xFlFb', 'FEEDBACK', 'FLANGER FEEDBACK')],
        },
        { title: 'CRUSH', led: () => X('xCrushBits') > 0 || X('xCrushRate') > 0, ctls: [knob('xCrushBits', 'BITS', 'OFF', '4 BIT', 'BITCRUSH'), fine('xCrushRate', 'RATE', 'DOWNSAMPLE')] },
        { title: 'PUMP', led: () => X('xPumpDepth') > 0, ctls: [knob('xPumpDepth', 'DEPTH', 'OFF', 'FULL', 'PUMP'), step('xPumpRate', 'RATE', 'PUMP RATE'), fine('xPumpShape', 'RELEASE', 'PUMP RELEASE')] },
        { title: 'HELL', led: () => X('xHellMix') > 0, ctls: [knob('xHellMix', 'MIX', 'OFF', 'FULL', 'HELL')] },
      ],
    },
  ],
};

/*
 * Les designateurs : les TWEAKS gardent ceux de la carte verte (RV5 a RV19, SW1 a SW3, dans l'ordre de VOY_TWEAKS), les
 * reglages du VST3 seul suivent (RV20, SW4...), dans l'ordre des pages.
 */
export const REFS: Record<string, string> = {};
{
  let rvT = 5;
  let swT = 1;
  for (const k of VOY_TWEAKS) REFS[k.id] = k.id === 'sync' || k.id === 'chord' || k.id === 'fpol' ? `SW${swT++}` : `RV${rvT++}`;
  let rv = 20;
  let swn = 4;
  const all = [...ROWS.sound].flatMap((r) => r.frames.flatMap((f) => f.ctls)).filter((c) => !(c.id in REFS));
  for (const c of all) {
    REFS[c.id] = c.k === 'knob' ? `RV${rv++}` : `SW${swn++}`;
    setFullName(c.id, c.full ?? c.name);
  }
  for (const c of [...ROWS.sound].flatMap((r) => r.frames.flatMap((f) => f.ctls))) if (c.full) setFullName(c.id, c.full);
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
  // OVERDRIVE s'appelle DISTO dans le VST3 (2026-11-17, Mika)
  setFullName('dist', 'DISTO');
  // la pedale DISTORTION est masquee (2026-11-17, v25) : plus nulle part ; la page DISTO a ses noms (DistoPage.tsx)
}

export const useExtraAll = () => useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
const useHoodPage = () => useSyncExternalStore(hoodPage.subscribe, hoodPage.get, hoodPage.get);

const CtlCell: React.FC<{ c: Ctl }> = ({ c }) => {
  const ref_ = REFS[c.id] ?? '';
  switch (c.k) {
    case 'knob':
      return <PcbKnob id={c.id} name={c.name} ref_={ref_} lo={c.lo} hi={c.hi} big={c.big} fine={c.fine} />;
    case 'step':
      return <PcbStep id={c.id} name={c.name} ref_={ref_} w={stepW(c.id)} />;
    case 'rot':
      return <PcbRotary id={c.id} name={c.name} ref_={ref_} w={ROT_W} />;
    default:
      return <PcbSelect id={c.id} name={c.name} ref_={ref_} w={c.w} cols={stepsOf(c.id).length > 10 ? 3 : 2} />;
  }
};

/** Le cadre montre par le clic d'un potard de la face : il clignote une fois. */
export function useFlash(title: string): boolean {
  const { focus, focusN } = useHoodPage();
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (focus !== title) return undefined;
    // apres l'arrivee de la carte (140 ms de fondu : hood.css)
    const a = window.setTimeout(() => setOn(true), 160);
    const b = window.setTimeout(() => setOn(false), 160 + 1700);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
      setOn(false);
    };
  }, [focus, focusN, title]);
  return on;
}

export const Frame: React.FC<{ f: FrameSpec; x: number; y: number; sep?: boolean }> = ({ f, x, y, sep }) => {
  const flash = useFlash(f.title);
  return (
    <PcbFrame title={f.title} x={x} y={y} w={frameW(f)} h={FRAME_H} led={f.led ? f.led() : undefined} flash={flash} sep={sep}>
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
      {frames.map((f, i) => {
        const fx = x;
        x += frameW(f) + FRAME_GAP;
        return <Frame key={f.title} f={f} x={fx} y={y} sep={i < frames.length - 1} />;
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

/* ---------------- FX : HELL (HellPage.tsx), REVERB (SkyPage.tsx) ---------------- */

/** HELL : la page facon Echobode ; le cadre HELL (MIX) clignote au clic du potard de la face. */
const HellHost: React.FC = () => {
  const h = useFlash('HELL');
  const d = useFlash('DELAY');
  const fl = (t: string): boolean => (t === 'HELL' ? h : t === 'HELL DELAY' ? d : false);
  // MAQUETTE v44 : ?fx2=A ou ?fx2=B (fx2.ts) : la page refaite ; sinon celle d'avant
  return FX2 === 'A' ? <HellPageA flash={fl} /> : FX2 === 'B' ? <HellPageB flash={fl} /> : <HellPage flash={fl} />;
};

/** REVERB : la reverbe facon BigSky (SkyPage.tsx) ; le cadre REVERB clignote au clic du potard de la face. */
const SkyHost: React.FC = () => {
  const rev = useFlash('REVERB');
  const typ = useFlash('TYPE');
  const fl = (t: string): boolean => (t === 'REVERB' ? rev : t === 'TYPE' ? typ : false);
  return FX2 === 'A' ? <SkyPageA flash={fl} /> : FX2 === 'B' ? <SkyPageB flash={fl} /> : <SkyPage flash={fl} />;
};

/** DISTO : la page facon Decapitator (DistoPage.tsx) ; le cadre DRIVE clignote au clic du potard DISTO de la face. */
const DistoHost: React.FC = () => {
  const d = useFlash('DRIVE');
  return <DistoPage flash={(t) => (t === 'DRIVE' ? d : false)} />;
};

const FxPage: React.FC = () => {
  const { fx } = useHoodPage();
  return (
    <>
      {fx === 'reverb' ? (
        <SkyHost />
      ) : fx === 'delay' ? (
        <DelayPage />
      ) : fx === 'disto' ? (
        <DistoHost />
      ) : (
        <HellHost />
      )}
    </>
  );
};

/* ---------------- SEQ : la matrice ---------------- */

const MATRIX_W = 960;

export const Matrix: React.FC<{ y: number }> = ({ y }) => {
  const v = useExtraAll();
  const flash = useFlash('MOD MATRIX');
  const col = (c: number) =>
    Array.from({ length: 3 }, (_, r) => {
      const i = c * 3 + r + 1;
      const live = v[`xM${i}Src`] > 0 && v[`xM${i}Dst`] > 0 && Math.abs(v[`xM${i}Amt`] - 0.5) > 0.001;
      return (
        <div key={i} className="mm-p2-mx-row" style={{ top: 40 + r * 42 }}>
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
    <PcbFrame title="MOD MATRIX" x={ZONE.x + Math.round((ZONE.w - MATRIX_W) / 2)} y={y} w={MATRIX_W} h={170} className="mm-p2-mx" flash={flash}>
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

export const useSteps = () => useSyncExternalStore(arpSteps.subscribe, arpSteps.get, arpSteps.get);

/** La tete (mm_transport) : "pos|len" pendant la lecture, '' a l'arret. */
export const headKey = (): string => {
  const h = arpExternal.headState;
  return h.playing && h.pos >= 0 ? `${h.pos}|${h.len}` : '';
};

/** RANDOM : trois styles (hypno.ts), NEW SEQ tire une suite et ses pistes ; RANDOM de la face prend le meme style. */
export const RND_W = 236;
export const RandomBox: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const style = useSyncExternalStore(hypnoStyle.subscribe, hypnoStyle.get, hypnoStyle.get);
  const st = useSteps();
  const flash = useFlash('RANDOM');
  return (
    <PcbFrame title="RANDOM" x={x} y={y} w={RND_W} h={FRAME_H} className="mm-p2-rnd" flash={flash} sep>
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

export const SEQ_ROW: FrameSpec[] = [
  { title: 'ARP', ctls: [knob('xSwing', 'SWING', '0', 'FULL')] },
  { title: 'LFO 1 +', ctls: [sel('xLfo1Dest2', 'TARGET 2', 80, 'LFO 1 TARGET 2'), knob('xLfo1Depth2', 'DEPTH 2', '0', 'FULL', 'LFO 1 DEPTH 2')] },
  {
    title: 'LFO 2',
    led: () => X('xLfo2Dest') > 0,
    ctls: [sel('xLfo2Rate', 'SPEED', 52, 'LFO 2 SPEED'), rot('xLfo2Shape', 'SHAPE', 'LFO 2 SHAPE'), sel('xLfo2Dest', 'TARGET', 80, 'LFO 2 TARGET'), knob('xLfo2Depth', 'DEPTH', '0', 'FULL', 'LFO 2 DEPTH')],
  },
];

/* ---------------- SEQ : la suite d'EDIT fusionnee au sequenceur par pas (v27) ---------------- */

/**
 * La piste NOTES (v27, la maquette v26 validee) : les notes de la suite d'EDIT, qui quittent l'encart de la face. CHORD :
 * l'accord dont on lit les notes (celui qui joue, sinon le premier de la progression ; un clic en choisit un, un second
 * le rend) ; FROM THE KNOBS / YOUR NOTES : d'ou viennent les notes ; STEPS - + : leur nombre ; CLR : retour aux notes des
 * potards. Une colonne : glisser de haut en bas choisit la note (le degre), la note ecrite dessous fait un silence ou le
 * rend. Les memes gestes que l'ecran d'avant (voyager/seqscreen.ts), la meme suite (voyager/seq.ts).
 */
let notesView: number | null = null;
const notesViewL = new Set<() => void>();
export const notesViewStore = {
  get: (): number | null => notesView,
  set(v: number | null): void {
    notesView = v;
    notesViewL.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    notesViewL.add(fn);
    return () => {
      notesViewL.delete(fn);
    };
  },
};

/* ---------------- SOUND (v27) : l'EQ parametrique, ENGINE, MASTER, le rack enrichi ---------------- */

const EQ_TYPES = extraParam('xQ1Type')?.steps ?? [];
/** La bande choisie de l'EQ (la page ; 1 a 6). */
let eqBand = 3;
const eqBandL = new Set<() => void>();
export const eqBandStore = {
  get: (): number => eqBand,
  set(b: number): void {
    eqBand = Math.max(1, Math.min(6, b));
    eqBandL.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    eqBandL.add(fn);
    return () => {
      eqBandL.delete(fn);
    };
  },
};
export const qid = (b: number, k: 'On' | 'Type' | 'Freq' | 'Gain' | 'Q' | 'Slope'): string => `xQ${b}${k}`;
interface EqB {
  on: boolean;
  type: string;
  f: number;
  g: number;
  q: number;
  slope: number;
}
const eqBandOf = (b: number): EqB => ({
  on: X(qid(b, 'On')) >= 0.5,
  type: EQ_TYPES[Math.round(X(qid(b, 'Type')) * (EQ_TYPES.length - 1))] ?? 'BELL',
  f: eqLaws.hz(X(qid(b, 'Freq'))),
  g: eqLaws.db(X(qid(b, 'Gain'))),
  q: eqLaws.q(X(qid(b, 'Q'))),
  slope: Math.round(X(qid(b, 'Slope')) * 2),
});

/** La reponse d'une bande (dB) a f Hz : le prototype analogique des SVF de ParamEq.cpp (HP / LP en cascade). */
function bandDb(b: EqB, f: number): number {
  const r = f / b.f;
  const r2 = r * r;
  const A = Math.pow(10, b.g / 40);
  const mag = (nr: number, ni: number, dr: number, di: number): number => 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
  const qs = (): number[] => (b.slope <= 0 ? [b.q] : b.slope === 1 ? [0.5412, 1.3066 * (b.q / 0.7071)] : [0.5098, 0.6013, 0.9, 2.5629 * (b.q / 0.7071)]);
  switch (b.type) {
    case 'HP':
      return qs().reduce((s, q) => s + mag(-r2, 0, 1 - r2, r / q), 0);
    case 'LP':
      return qs().reduce((s, q) => s + mag(1, 0, 1 - r2, r / q), 0);
    case 'BELL':
      return mag(1 - r2, (r * A) / b.q, 1 - r2, r / (A * b.q));
    case 'NOTCH':
      return mag(1 - r2, 0, 1 - r2, r / b.q);
    case 'LOW SHELF':
      return mag(A - r2, (Math.sqrt(A) * r) / b.q, 1 - r2 / A, r / (Math.sqrt(A) * b.q));
    case 'HIGH SHELF':
      return mag(1 - r2 * A, (Math.sqrt(A) * r) / b.q, 1 / A - r2, r / (Math.sqrt(A) * b.q));
    default:
      return 0;
  }
}

const useSpec = () => useSyncExternalStore(arpSpec.subscribe, arpSpec.get, arpSpec.get);

/**
 * L'ecran de l'EQ : la courbe (la somme des bandes allumees), l'analyseur du C++ (PRE ou POST, page ouverte seulement),
 * les six points : un clic choisit la bande, glisser regle FREQ (de gauche a droite) et GAIN (de haut en bas), Maj + glisser
 * (ou la molette) son Q, Alt : quatre fois plus fin (v46 ; Maj etait le reglage fin avant la v44).
 */
export const EqScreen: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  useExtraAll();
  const sel = useSyncExternalStore(eqBandStore.subscribe, eqBandStore.get, eqBandStore.get);
  const spec = useSpec();
  const hood = useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  const ana = Math.round(X('xQAna') * 2);
  // l'analyseur : seulement tant que cet ecran est la et le capot ouvert
  useEffect(() => {
    if (hood !== 'open' || ana === 0) return undefined;
    arpSpec.watch(1);
    return () => arpSpec.watch(-1);
  }, [hood, ana]);
  const fx = (f: number): number => 14 + (Math.log10(f / 20) / 3) * (w - 28);
  const fy = (db: number): number => h / 2 - (db / 18) * (h / 2 - 16);
  const bands = [1, 2, 3, 4, 5, 6].map(eqBandOf);
  const out = eqLaws.out(X('xQOut'));
  const pts: string[] = [];
  for (let i = 0; i <= 240; i += 1) {
    const f = 20 * Math.pow(1000, i / 240);
    let db = out;
    for (const b of bands) if (b.on) db += bandDb(b, f);
    pts.push(`${fx(f).toFixed(1)},${fy(Math.max(-18, Math.min(18, db))).toFixed(1)}`);
  }
  const anaPts: string[] = [];
  if (ana > 0 && spec.length === SPEC_BINS)
    spec.forEach((db, j) => {
      const f = 20 * Math.pow(1000, (j + 0.5) / SPEC_BINS);
      // -78 dBFS au pied de l'ecran, -6 dBFS en haut
      const y = h - 14 - (Math.max(0, Math.min(72, db + 78)) / 72) * (h - 30);
      anaPts.push(`${fx(f).toFixed(1)},${y.toFixed(1)}`);
    });
  const nodeY = (b: EqB): number => fy(b.type === 'HP' || b.type === 'LP' || b.type === 'NOTCH' ? 0 : b.g);
  // v44 (Mika : "avec la touche Shift je veux pouvoir changer le Q de chaque point") : Maj + glisser vertical (ou la
  // molette sur un point) regle le Q du point saisi ; sa valeur s'affiche a cote du point pendant le geste
  const drag = useRef<{ b: number; x: number; y: number; f: number; g: number; q: number; mode: 'fg' | 'q'; alt: boolean } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [qShow, setQShow] = useState(0);
  const qTimer = useRef(0);
  const showQ = (b: number, ms = 0): void => {
    window.clearTimeout(qTimer.current);
    setQShow(b);
    if (ms > 0) qTimer.current = window.setTimeout(() => setQShow(0), ms);
  };
  useEffect(() => () => window.clearTimeout(qTimer.current), []);
  const scale = (): number => {
    const el = svg.current;
    if (!el) return 1;
    return el.getBoundingClientRect().width / w || 1;
  };
  const anchor = (d: NonNullable<typeof drag.current>, e: { clientX: number; clientY: number; altKey: boolean }, mode: 'fg' | 'q'): void => {
    d.mode = mode;
    d.alt = e.altKey;
    d.x = e.clientX;
    d.y = e.clientY;
    d.f = X(qid(d.b, 'Freq'));
    d.g = X(qid(d.b, 'Gain'));
    d.q = X(qid(d.b, 'Q'));
  };
  const onNode = (b: number) => (e: React.PointerEvent<SVGGElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    eqBandStore.set(b);
    const d = { b, x: 0, y: 0, f: 0, g: 0, q: 0, mode: 'fg' as 'fg' | 'q', alt: false };
    anchor(d, e, e.shiftKey ? 'q' : 'fg');
    drag.current = d;
    if (e.shiftKey) {
      say(qid(b, 'Q'));
      showQ(b);
    }
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* rien */
    }
  };
  const onMove = (e: React.PointerEvent<SVGGElement>): void => {
    const d = drag.current;
    if (!d) return;
    const k = scale();
    // Maj ou Alt enfoncee ou relachee en cours de geste : on repart de la ou on en est (pas de saut)
    if (e.shiftKey !== (d.mode === 'q') || e.altKey !== d.alt) anchor(d, e, e.shiftKey ? 'q' : 'fg');
    // v46 : Alt, quatre fois plus fin (la frequence, le gain, le Q)
    const fine = d.alt ? 0.25 : 1;
    if (d.mode === 'q') {
      // 160 px (a l'echelle de l'ecran) pour toute la course ; vers le haut : plus de Q (plus etroit)
      SRC.set(qid(d.b, 'Q'), d.q - ((e.clientY - d.y) / k / 160) * fine);
      say(qid(d.b, 'Q'));
      showQ(d.b);
      return;
    }
    const dx = ((e.clientX - d.x) / k) * fine;
    const dy = ((e.clientY - d.y) / k) * fine;
    SRC.set(qid(d.b, 'Freq'), d.f + dx / (w - 28));
    say(qid(d.b, 'Freq'));
    const t = eqBandOf(d.b).type;
    if (t !== 'HP' && t !== 'LP' && t !== 'NOTCH') {
      SRC.set(qid(d.b, 'Gain'), d.g - (dy / (h / 2 - 16)) * 0.5);
      say(qid(d.b, 'Gain'));
    }
  };
  const onUp = (): void => {
    const d = drag.current;
    drag.current = null;
    if (d?.mode === 'q') showQ(d.b, 900);
  };
  // la molette sur un point (avec ou sans Maj) : son Q ; Maj + molette donne deltaX sur macOS, on prend les deux
  useEffect(() => {
    const el = svg.current;
    if (!el) return undefined;
    let acc = 0;
    const onWheel = (e: WheelEvent): void => {
      const node = (e.target as Element | null)?.closest?.('[data-b]');
      if (!node) return;
      e.preventDefault();
      const b = Number((node as HTMLElement | SVGElement).dataset.b);
      acc += e.deltaY || e.deltaX;
      const t = Math.trunc(acc / 40);
      if (t === 0) return;
      acc -= t * 40;
      eqBandStore.set(b);
      SRC.set(qid(b, 'Q'), X(qid(b, 'Q')) - t * 0.02);
      say(qid(b, 'Q'));
      showQ(b, 900);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  // le Q montre : une bulle a cote du point, la largeur de la bande (BELL, NOTCH) et la courbe de la bande seule
  const qb = qShow > 0 ? bands[qShow - 1] : null;
  const qOverlay = (() => {
    if (!qb || qShow < 1) return null;
    const x = fx(qb.f);
    const y = nodeY(qb);
    const own: string[] = [];
    for (let i = 0; i <= 160; i += 1) {
      const f = 20 * Math.pow(1000, i / 160);
      own.push(`${fx(f).toFixed(1)},${fy(Math.max(-18, Math.min(18, bandDb(qb, f)))).toFixed(1)}`);
    }
    const bw = qb.type === 'BELL' || qb.type === 'NOTCH' ? (2 * Math.asinh(1 / (2 * qb.q))) / Math.LN2 : 0;
    const x1 = bw > 0 ? Math.max(14, fx(qb.f / Math.pow(2, bw / 2))) : 0;
    const x2 = bw > 0 ? Math.min(w - 14, fx(qb.f * Math.pow(2, bw / 2))) : 0;
    const by = y > h - 52 ? y - 22 : y + 20;
    const label = `Q ${qb.q.toFixed(2)}`;
    const sub = bw > 0 ? `${bw.toFixed(2)} OCT` : qb.type === 'HP' || qb.type === 'LP' ? 'RESONANCE' : 'SLOPE';
    const bx = Math.max(40, Math.min(w - 40, x));
    const top = y < 44 ? y + 14 : y - 40;
    return (
      <g className="eq-q" pointerEvents="none">
        <polyline className="eq-q-own" points={own.join(' ')} />
        {bw > 0 && (
          <path className="eq-q-bw" d={`M${x1.toFixed(1)} ${by - 4}v8M${x1.toFixed(1)} ${by}H${x2.toFixed(1)}M${x2.toFixed(1)} ${by - 4}v8`} />
        )}
        <rect className="eq-q-tip" x={bx - 34} y={top} width={68} height={26} rx={3} />
        <text className="eq-q-val" x={bx} y={top + 12} textAnchor="middle">
          {label}
        </text>
        <text className="eq-q-sub" x={bx} y={top + 21} textAnchor="middle">
          {sub}
        </text>
      </g>
    );
  })();
  const sb = bands[sel - 1];
  const head = `${sel} · ${sb.type} · ${extraTextOf(qid(sel, 'Freq')).toUpperCase()}${sb.type === 'HP' || sb.type === 'LP' ? ` · ${[12, 24, 48][sb.slope]} DB/OCT` : sb.type === 'NOTCH' ? '' : ` · ${extraTextOf(qid(sel, 'Gain')).toUpperCase()}`} · Q ${sb.q.toFixed(2)}${sb.on ? '' : ' · OFF'}`;
  // l'ancien EQ 4 bandes d'un projet d'avant, encore actif (v27, OLD EQ) : dit dans l'en-tete de l'ecran, RESET a cote (v28)
  const oldEq = OLD_EQ.some((id) => Math.abs(X(id) - 0.5) > 0.0005);
  return (
    <div className="mm-dm-glass mm-eq-screen" style={{ width: w, height: h, position: 'relative' }}>
      {oldEq && (
        <div className="mm-eq-old">
          <span className="mm-eq-old-t">OLD EQ ON</span>
          <button type="button" className="mm-eq-old-k" onClick={() => OLD_EQ.forEach((id) => arpExtra.set(id, 0.5))} aria-label="Reset the old 4 band EQ of this project" title="The old 4 band EQ of this project is still on">
            RESET
          </button>
        </div>
      )}
      <svg ref={svg} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {[50, 100, 200, 500, 1000, 2000, 5000, 10000].map((f) => (
          <g key={f}>
            <path className="grid" d={`M${fx(f).toFixed(1)} 6V${h - 14}`} />
            <text x={fx(f)} y={h - 4} textAnchor="middle">
              {f >= 1000 ? `${f / 1000}K` : f}
            </text>
          </g>
        ))}
        {[-12, -6, 0, 6, 12].map((d) => (
          <g key={d}>
            <path className={d === 0 ? 'grid zero' : 'grid'} d={`M14 ${fy(d).toFixed(1)}H${w - 14}`} />
            <text x={w - 6} y={fy(d) + 3} textAnchor="end">
              {d > 0 ? `+${d}` : d}
            </text>
          </g>
        ))}
        {anaPts.length > 0 && <polygon className="ana" points={`${fx(20 * Math.pow(1000, 0.5 / SPEC_BINS)).toFixed(1)},${h - 14} ${anaPts.join(' ')} ${fx(20 * Math.pow(1000, (SPEC_BINS - 0.5) / SPEC_BINS)).toFixed(1)},${h - 14}`} />}
        <polyline className="eq-fill" points={`14,${fy(0)} ${pts.join(' ')} ${w - 14},${fy(0)}`} />
        <polyline className="main" points={pts.join(' ')} />
        {qOverlay}
        {bands.map((b, i) => (
          <g key={i} className="eq-node" data-b={i + 1} data-on={b.on ? '1' : undefined} data-sel={i + 1 === sel ? '1' : undefined} onPointerDown={onNode(i + 1)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{ cursor: 'grab' }}>
            <circle cx={fx(b.f)} cy={nodeY(b)} r={i + 1 === sel ? 9 : 7.5} />
            <text x={fx(b.f)} y={nodeY(b) + 3.2} textAnchor="middle">
              {i + 1}
            </text>
          </g>
        ))}
        <text x="16" y="15">
          PARAMETRIC EQ · 6 BANDS
        </text>
        <text x={w - 16} y="15" textAnchor="end" className="hot">
          {head}
        </text>
        <text x={w / 2} y="15" textAnchor="middle" className="dim">
          {ana === 0 ? 'ANALYZER OFF' : `ANALYZER ${ana === 1 ? 'PRE' : 'POST'}`}
        </text>
      </svg>
    </div>
  );
};

const extraTextOf = (id: string): string => SRC.text(id);
const OLD_EQ = ['xEqLow', 'xEqMid', 'xEqHigh', 'xEqAir'] as const;

/** BAND 1 a 6 (la LED : allumee), ON de la bande choisie. */
export const EqBandKeys: React.FC = () => {
  useExtraAll();
  const sel = useSyncExternalStore(eqBandStore.subscribe, eqBandStore.get, eqBandStore.get);
  const on = X(qid(sel, 'On')) >= 0.5;
  return (
    <div className="mm-eq-bands">
      <span className="mm-sq-lab">BAND</span>
      {[1, 2, 3, 4, 5, 6].map((b) => (
        <PcbKey key={b} name={`${b}`} cap={<span>{b}</span>} w={20} h={15} on={b === sel} className={X(qid(b, 'On')) >= 0.5 ? 'mm-eq-bon' : undefined} onClick={() => eqBandStore.set(b)} aria-label={`EQ band ${b}${X(qid(b, 'On')) >= 0.5 ? ', on' : ', off'}`} />
      ))}
      <span className="mm-eq-on">
        <span className="mm-sq-lab">{`BAND ${sel}`}</span>
        <PcbKey name="ON" cap={<span>{on ? 'ON' : 'OFF'}</span>} w={30} h={15} on={on} onClick={() => SRC.set(qid(sel, 'On'), on ? 0 : 1)} aria-label={`EQ band ${sel} ${on ? 'on' : 'off'}`} />
      </span>
    </div>
  );
};

/** CHORUS MODE (v27) : OFF, I, II (le potard CHORUS du site), I+II (xChBoth) ; une seule rotative. */
const CH_MODES = ['OFF', 'I', 'II', 'I+II'] as const;
registerVirtual('vChMode', {
  of: () => {
    const c = Math.round(voyParams.of('chorus') * 2);
    return (c > 0 && X('xChBoth') >= 0.5 ? 3 : c) / 3;
  },
  def: () => 1 / 3,
  set: (v) => {
    const m = Math.round(v * 3);
    voyParams.set('chorus', m === 0 ? 0 : m === 1 ? 0.5 : 1);
    arpExtra.set('xChBoth', m === 3 ? 1 : 0);
  },
  text: (v) => CH_MODES[Math.round(v * 3)],
  steps: CH_MODES,
  name: 'CHORUS MODE',
});

/* ---------------- les volets : LIBRARY, MIDI ---------------- */

const LIB_W = 1000;
const LIB_H = 380;
const LIB_COL = (LIB_W - 20 - 3 * 14) / 4;

const LibraryPanel: React.FC = () => {
  const cur = useSyncExternalStore(libStore.subscribe, libStore.get, libStore.get);
  const p = libCurrent();
  const x0 = ZONE.x + Math.round((ZONE.w - LIB_W) / 2);
  return (
    <>
      {/* v28 : 380 de haut (16 BASS dans une colonne : a 330, la derniere touchait la legende du dessous) */}
      <PcbFrame title={`FACTORY BANK · ${LIB_PRESETS.length} SOUNDS`} x={x0} y={70} w={LIB_W - 270} h={LIB_H} className="mm-p2-lib">
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
      <PcbFrame title="DISK" x={x0 + LIB_W - 254} y={70} w={254} h={LIB_H} className="mm-p2-panel">
        <DiskPresets />
      </PcbFrame>
      <div className="mm-p2-lib-now" style={{ left: x0, top: 70 + LIB_H + 16, width: LIB_W }} role="status" aria-live="polite">
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
      <PcbFrame title="DRAG MIDI" x={x0} y={84} w={MIDI_DRAG_W} h={232} className="mm-p2-panel">
        <DragMidi />
        <p className="mm-p2-note">
          HOLD AND DRAG ONTO AN ABLETON TRACK
          <br />
          x1 x2 x4 : TIMES THE PROGRESSION
        </p>
      </PcbFrame>
      <PcbFrame title="MIDI LEARN" x={x0 + MIDI_DRAG_W + FRAME_GAP} y={84} w={MIDI_MAP_W} h={232} className="mm-p2-panel">
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

/**
 * Le panneau : celui de la face (la meme laque, la meme serigraphie), ses joues de bois (l'image de celles de la face),
 * l'en-tete comme celui de la face (le wordmark, MM-ARP, la page a droite en petit, comme FIRMWARE). Un clic sur une joue
 * referme le capot, comme CLOSE ou Echap.
 */
const PAGE_LABEL: Record<HoodTab, string> = { sound: 'SOUND', fx: 'EFFECTS', seq: 'SEQUENCER' };
const Panel: React.FC<{ onClose: () => void; stage: Stage | null }> = ({ onClose, stage }) => {
  const { tab, fx, overlay } = useHoodPage();
  const page = overlay ? overlay.toUpperCase() : tab === 'fx' ? `EFFECTS / ${fx === 'hell' ? 'HELL' : fx === 'reverb' ? 'REVERB' : fx === 'delay' ? 'DELAY' : 'DISTO'}` : PAGE_LABEL[tab];
  return (
    <>
      <button type="button" className="mm-r-wood mm-r-wood-l" aria-label="Close the machine" title="Close" onClick={onClose} />
      <button type="button" className="mm-r-wood mm-r-wood-r" aria-label="Close the machine" title="Close" onClick={onClose} />
      <div className="mm-r-head">
        {/* Les logos en grand (2026-11-16, Mika) : un clic ramene a la face, comme CLOSE, Echap ou la croix */}
        <button type="button" className="mm-r-logo" aria-label="Back to the front panel" title="Back to the front panel" onClick={onClose}>
          <span className="mm-r-word" />
          <span className="mm-r-model">MM-ARP</span>
        </button>
        <NavKeys onClose={onClose} />
        {/* v31 : le compteur CPU de cette instance, avant SETTINGS et la croix */}
        <HoodCpuMeter stage={stage} />
        {/* Les reglages d'aspect (2026-11-16) : le cuir, la lumiere du panneau */}
        <HoodLookButton />
        {/* La croix : une petite touche de la face, la croix serigraphiee dessus */}
        <button type="button" className="mm-key mm-r-x" aria-label="Close the machine" title="Close" onClick={onClose}>
          <span className="mm-key-cap" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 2 L8 8 M8 2 L2 8" />
            </svg>
          </span>
        </button>
      </div>
    </>
  );
};

/** L'afficheur du bandeau : le reglage touche (nom, valeur), sinon la page. */
const PAGE_NAME: Record<HoodTab, string> = { sound: 'SOUND', fx: 'FX', seq: 'SEQ' };
const HoodLcd: React.FC = () => {
  const line = useSyncExternalStore(hoodLcd.subscribe, hoodLcd.get, hoodLcd.get);
  const { tab, fx, overlay } = useHoodPage();
  const page = overlay ? overlay.toUpperCase() : tab === 'fx' ? `FX · ${fx === 'hell' ? 'HELL' : fx === 'reverb' ? 'REVERB' : fx === 'delay' ? 'DELAY' : 'DISTO'}` : PAGE_NAME[tab];
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

/**
 * La bascule face <-> OPEN (v28, Mika : "la bascule doit etre rapide mais encore avec l'animation") : la carte arrive et
 * repart en CARD_MS (hood.css mm-p2-open / mm-p2-close), quel que soit le declencheur (OPEN, CLOSE, la croix, Echap, le
 * logo, le re-clic de la page montree, le clic d'un potard de la face) et meme si le capot 3D se pose d'un coup (mouvement
 * reduit) : la carte reste montee le temps de son depart.
 */
export const CARD_MS = 220;

/** Le capot : monte de l'ouverture a la fin de la fermeture (et de l'animation de depart de la carte). */
export const HoodBoard: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const hood = useHood();
  const shown = useRef(false);
  const [, force] = useState(0);
  if (hood === 'opening' || hood === 'open') shown.current = true;
  useEffect(() => {
    if (hood !== 'closing' && hood !== 'closed') return undefined;
    if (!shown.current) return undefined;
    const t = window.setTimeout(() => {
      if (voyExplode.get() !== 'closed' && voyExplode.get() !== 'closing') return;
      shown.current = false;
      force((n) => n + 1);
    }, CARD_MS + 30);
    return () => window.clearTimeout(t);
  }, [hood]);
  if (hood === 'closed' && !shown.current) return null;
  return <HoodBody stage={stage} leaving={hood === 'closing' || hood === 'closed'} />;
};

const HoodBody: React.FC<{ stage: Stage | null; leaving: boolean }> = ({ stage, leaving }) => {
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
  // Les fleches gauche / droite du clavier : la page d'avant, la suivante (2026-11-16), quand rien ne les prend (un
  // potard, une touche a crans, une fenetre, le sequenceur : ils les gardent pour eux)
  useEffect(() => {
    const owns = (t: EventTarget | null): boolean => {
      const n = t instanceof Element ? t : null;
      return !!n?.closest('[role="slider"], .mm-p2-win, .mm-p2-st-grid, .mm-p2-menu, input, textarea, [contenteditable="true"]');
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (owns(e.target) || owns(document.activeElement)) return;
      e.preventDefault();
      e.stopPropagation();
      hoodPageStep(e.key === 'ArrowRight' ? 1 : -1, true);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  return (
    <div className="mm-p2" style={{ position: 'fixed' }} data-phase={leaving ? 'closing' : hood} aria-label="MM-ARP hood">
      <div className="mm-p2-page" style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})` }}>
        <PcbDefs />
        <div className="mm-p2-fade">
          <div className="mm-p2-board">
            <Panel onClose={() => openToggle(stage, 'voy')} stage={stage} />
            {overlay ? (
              <Overlay which={overlay} />
            ) : (
              <div className="mm-p2-tab" key={tab} data-tab={tab}>
                {tab === 'sound' ? <SoundPage /> : tab === 'fx' ? <FxPage /> : <SeqPage />}
              </div>
            )}
          </div>
          <nav className="mm-p2-strip" aria-label="Hood pages">
            <div className="mm-p2-tools">
              <PcbKey on={overlay === 'library'} aria-pressed={overlay === 'library'} name="LIBRARY" w={STRIP_KEY.w} h={STRIP_KEY.h} onClick={() => hoodPage.set({ overlay: overlay === 'library' ? null : 'library' })} />
              <PcbKey on={overlay === 'midi'} aria-pressed={overlay === 'midi'} name="MIDI" w={STRIP_KEY.w} h={STRIP_KEY.h} onClick={() => hoodPage.set({ overlay: overlay === 'midi' ? null : 'midi' })} />
              <PcbKey className="mm-p2-learn" aria-pressed={midi.learning} on={midi.learning} name="LEARN" w={STRIP_KEY.w} h={STRIP_KEY.h} onClick={() => arpBridge.learnMode(!midi.learning)} aria-label="MIDI learn" />
            </div>
            <HoodLcd />
            <PcbKey className="mm-p2-close" accent name="CLOSE" w={STRIP_KEY.w} h={STRIP_KEY.h} aria-label="Close the machine" onClick={() => openToggle(stage, 'voy')} />
          </nav>
        </div>
      </div>
    </div>
  );
};
