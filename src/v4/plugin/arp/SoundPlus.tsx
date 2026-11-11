/**
 * Les potards et les commutateurs HTML de la face du plugin MM-ARP (2026-11-10 : SOUND+ ; refaits le 2026-11-11, Mika :
 * "j'aime ce type de knobs : capuchon metal brosse, jupe noire cannelee, graduations chiffrees 0 2 4 6 8 10, mais le
 * dessus plus fonce, pas trop" ; "pour le OPEN je veux ces knobs-la : bouton noir a index blanc, graduations chiffrees").
 * Deux dessins, un seul composant (Dial) :
 * - look 'metal' (la face avant : FrontModule.tsx) : le potard de la machine 3D, trait pour trait (voyager/knobs.ts :
 *   la jupe noire, le flanc cannele, le disque de metal brosse de voyager/skin.ts capTile, qui ne tourne pas, l'index
 *   blanc sur la couronne noire), pour que 3D et HTML ne se distinguent pas ;
 * - look 'black' (le panneau d'OPEN : HoodPanel.tsx) : le bouton noir cannele, son long index blanc.
 * Autour : onze traits, les chiffres pairs de 0 a 10 ; un reglage a zero au centre : -5 a +5 ; un reglage a crans : un
 * trait par cran et ses vraies valeurs (scaleOf). Dessous : le nom, puis la valeur lue.
 *
 * Deux sources de valeurs, memes gestes :
 * - XKnob, XSwitch : un reglage du VST3 seul (extra.ts, plugin/mm-arp/extra-params.json) ;
 * - VKnob, VSwitch : un TWEAK du site (voyager/params.ts voyParams, les 18 potards de la carte) ; le pont (bridge.ts)
 *   les envoie au C++ sous leurs ids du site, comme ceux de la machine 3D.
 * Le pont envoie tout seul mm_param et mm_gesture quand un store change (bridge.ts) ; mm_knobs les met a jour sans echo.
 *
 * Un potard : glisser vertical (Maj : fin), molette, double-clic = la valeur de depart, fleches (Maj : x10), Debut et
 * Fin. Un potard a crans montre le nom de son cran. En MIDI LEARN, un clic l'arme (il ne bouge pas : sa LED clignote).
 */

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { skinUrl } from '../../voyager/skin';
import { stepIndex, voyKnob, voyParams, voyValueText, type VoyKnobId } from '../../voyager/params';
import { arpBridge } from './bridge';
import { arpExtra, extraStepIndex, type ExtraParam } from './extra';
import { arpMidi } from './midimap';

/** La course d'un glisser (px) pour tout le potard. */
const DRAG_PX = 170;
/** Le cran du centre des potards a zero au centre, pendant le glisser. */
const CENTER_DETENT = 0.02;
/** La molette : ce deltaY fait un pas. */
const WHEEL_STEP = 40;

/** Les potards dont le centre est le son du site : gradues de -5 a +5. */
const BIPOLAR: ReadonlySet<string> = new Set(['xRevSize', 'xRevTone', 'xBass', 'xAir', 'xWidth', 'xNoiseColor', 'xCombFb', 'xFlFb', 'xEqLow', 'xEqMid', 'xEqHigh', 'xEqAir', 'xM1Amt', 'xM2Amt', 'xM3Amt', 'xM4Amt', 'xM5Amt', 'xM6Amt']);
/** Sous l'interrupteur QUALITY : le surechantillonnage de chaque position. */
const SWITCH_SUB: Record<string, readonly string[]> = { xQuality: ['x4 OVERSAMPLING', 'x8 OVERSAMPLING'], xUnison: ['STACK', '5 VOICES', '7 VOICES'] };
/** Au-dessus des LED d'un interrupteur dont les noms sont trop longs : un nom court par position (le nom entier : la valeur lue dessous). */
const SWITCH_SHORT: Record<string, readonly string[]> = { xAmpMode: ['CLN', 'TRI', 'PEN', 'SAT'] };

/**
 * Les noms ecrits autour d'un potard a crans, quand ceux du JSON sont trop longs pour tenir a leur trait ('' : le trait
 * seul). Sans entree : les noms du reglage s'ils sont courts (six crans au plus, quatre lettres), sinon le premier et le
 * dernier.
 */
const STEP_NAMES: Record<string, readonly string[]> = {
  xDlyMode: ['PING', 'ST', 'WIDE'],
  xLfo1Dest2: ['OFF', '', '', '', '', '', '', '', '', '', 'ENV'],
  xLfo2Dest: ['OFF', '', '', '', '', '', '', '', '', '', '', '', '', '', 'ENV'],
  xLfo2Rate: ['1/32', '', '1/16', '', '', '1/8', '', '', '1/4', '', '1', '', '', '8'],
  xLfo2Shape: ['SIN', 'TRI', 'SAW', 'RMP', 'SQR', 'S&H', 'RND'],
  xPbRange: ['1', '2', '3', '5', '7', '12', '24'],
  chord: ['BASIC', 'TRIAD', '7TH', '9TH', '11TH'],
};

/* ---------------- la geometrie des deux dessins ---------------- */

interface Geo {
  /** la boite SVG, le centre */
  w: number;
  h: number;
  cx: number;
  cy: number;
  /** la jupe, le flanc cannele, le dessus du capuchon, le disque de metal */
  skirt: number;
  flank: number;
  top: number;
  cap: number;
  flutes: number;
  depth: number;
  /** les traits (de r0 a r0 + len), les chiffres (a rt), leur corps */
  r0: number;
  len: number;
  rt: number;
  font: number;
  /** l'index : de m0 a m1, sa largeur */
  m0: number;
  m1: number;
  mw: number;
}

/** Le potard de la machine 3D (un petit : 0.9 x VOY_KNOB a 82 px par unite) : jupe 21 px, flanc 18.5, disque 13. */
const METAL: Geo = { w: 80, h: 66, cx: 40, cy: 37, skirt: 21, flank: 18.5, top: 16.2, cap: 13, flutes: 24, depth: 0.85, r0: 23.2, len: 3.9, rt: 32.4, font: 7, m0: 12.6, m1: 20.1, mw: 2.9 };
/** Le bouton noir du panneau d'OPEN : plus gros, dix cannelures larges, l'index du centre au bord. */
const BLACK: Geo = { w: 92, h: 76, cx: 46, cy: 43, skirt: 23, flank: 21.6, top: 15.4, cap: 0, flutes: 10, depth: 2.3, r0: 26, len: 4.6, rt: 37, font: 8, m0: 3.2, m1: 19.4, mw: 2.9 };

const A0 = -135;
const SWEEP = 270;

const pt = (g: Geo, deg: number, r: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [g.cx + r * Math.cos(a), g.cy + r * Math.sin(a)];
};

/** Le contour cannele du flanc : n creux autour du rayon r. */
function flutePath(g: Geo): string {
  const n = g.flutes * 12;
  let d = '';
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const k = Math.max(0, Math.cos((a * g.flutes) / 2)) ** 2;
    const r = g.flank - g.depth * k;
    d += `${i === 0 ? 'M' : 'L'}${(g.cx + r * Math.cos(a)).toFixed(2)} ${(g.cy + r * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
}
const FLUTES = { metal: flutePath(METAL), black: flutePath(BLACK) };

/** Les degrades des potards, une fois pour toute la face (references par id dans chaque potard). */
export const KnobDefs: React.FC = () => (
  <svg className="mm-arp-x-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="mmx-shadow">
        <stop offset="0.55" stopColor="#000" stopOpacity="0.85" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="mmx-skirt" x1="0.15" y1="0.1" x2="0.85" y2="0.9">
        <stop offset="0" stopColor="#1f1f21" />
        <stop offset="0.45" stopColor="#0c0c0d" />
        <stop offset="1" stopColor="#030303" />
      </linearGradient>
      <linearGradient id="mmx-flank" x1="0.2" y1="0.1" x2="0.8" y2="0.9">
        <stop offset="0" stopColor="#343436" />
        <stop offset="0.5" stopColor="#141415" />
        <stop offset="1" stopColor="#060606" />
      </linearGradient>
      <linearGradient id="mmx-top" x1="0.2" y1="0.1" x2="0.8" y2="0.9">
        <stop offset="0" stopColor="#2a2a2c" />
        <stop offset="1" stopColor="#0d0d0e" />
      </linearGradient>
      <radialGradient id="mmx-dome" cx="38%" cy="30%" r="80%">
        <stop offset="0" stopColor="#3a3a3d" />
        <stop offset="0.5" stopColor="#1a1a1c" />
        <stop offset="1" stopColor="#0a0a0b" />
      </radialGradient>
      <linearGradient id="mmx-rim" x1="0.15" y1="0.1" x2="0.85" y2="0.9">
        <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0.03" />
        <stop offset="1" stopColor="#000" stopOpacity="0.5" />
      </linearGradient>
    </defs>
  </svg>
);

/** Le potard dessine : l'ombre, la jupe, le flanc cannele, le dessus (le disque de metal, fixe), l'index qui tourne. */
const Cap: React.FC<{ g: Geo; look: 'metal' | 'black'; deg: number }> = ({ g, look, deg }) => {
  const [mx0, my0] = pt(g, 0, g.m0);
  const [mx1, my1] = pt(g, 0, g.m1);
  return (
    <g className="mm-arp-x-cap">
      <circle cx={g.cx + 0.6} cy={g.cy + 2.6} r={g.skirt + 5} fill="url(#mmx-shadow)" />
      <circle cx={g.cx} cy={g.cy} r={g.skirt} fill="url(#mmx-skirt)" />
      <circle cx={g.cx} cy={g.cy} r={g.skirt - 0.4} fill="none" stroke="url(#mmx-rim)" strokeWidth="0.8" />
      <path d={FLUTES[look]} fill="url(#mmx-flank)" />
      {look === 'metal' ? (
        <>
          <circle cx={g.cx} cy={g.cy} r={g.top} fill="url(#mmx-top)" />
          <image href={skinUrl('cap')} x={g.cx - g.cap} y={g.cy - g.cap} width={g.cap * 2} height={g.cap * 2} preserveAspectRatio="none" />
          <circle cx={g.cx} cy={g.cy} r={g.cap} fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth="0.7" />
        </>
      ) : (
        <>
          <circle cx={g.cx} cy={g.cy} r={g.top} fill="url(#mmx-dome)" />
          <circle cx={g.cx} cy={g.cy} r={g.top - 0.3} fill="none" stroke="url(#mmx-rim)" strokeWidth="0.7" />
        </>
      )}
      <circle className="mm-arp-x-top" cx={g.cx} cy={g.cy} r={g.skirt} fill="#fff" />
      <line className="mm-arp-x-index" x1={mx0} y1={my0} x2={mx1} y2={my1} stroke="#f4f2ee" strokeWidth={g.mw} strokeLinecap={look === 'metal' ? 'butt' : 'round'} transform={`rotate(${deg.toFixed(2)} ${g.cx} ${g.cy})`} />
    </g>
  );
};

/** Ce qui s'ecrit autour d'un potard : la place (0 a 1) et le texte de chaque trait ('' : un trait sans texte ; minor : un trait court). */
interface Mark {
  t: number;
  text: string;
  minor?: boolean;
  mid?: boolean;
}

function scaleOf(id: string, steps: readonly string[] | undefined, bipolar: boolean): Mark[] {
  const n = steps?.length ?? 0;
  if (n > 1 && steps) {
    const named = STEP_NAMES[id];
    const short = n <= 6 && steps.every((s) => s.length <= 4);
    return steps.map((s, i) => ({ t: i / (n - 1), text: named ? (named[i] ?? '') : short || i === 0 || i === n - 1 ? s : '' }));
  }
  const out: Mark[] = [];
  for (let i = 0; i <= 10; i += 1) {
    const v = i - 5;
    // De 0 a 10 : les pairs ecrits. A zero au centre : -5, -3, 0, +3, +5, le zero plus long
    const text = bipolar ? (v === 0 ? '0' : Math.abs(v) === 3 || Math.abs(v) === 5 ? `${v > 0 ? '+' : ''}${v}` : '') : i % 2 === 0 ? String(i) : '';
    out.push({ t: i / 10, text, minor: text === '', mid: bipolar && v === 0 });
  }
  return out;
}

const Scale: React.FC<{ g: Geo; marks: readonly Mark[] }> = ({ g, marks }) => (
  <g>
    {marks.map((m, i) => {
      const deg = A0 + SWEEP * m.t;
      const [x0, y0] = pt(g, deg, m.mid ? g.r0 - 1.2 : g.r0);
      const [x1, y1] = pt(g, deg, g.r0 + (m.minor ? g.len * 0.62 : g.len));
      const [tx, ty] = pt(g, deg, g.rt);
      // Un nom long s'ancre du cote du potard : il ne revient jamais sur le capuchon
      const long = m.text.length > 2;
      const anchor = !long || Math.abs(tx - g.cx) < 6 ? 'middle' : tx < g.cx ? 'end' : 'start';
      const dx = anchor === 'end' ? g.font * 0.55 : anchor === 'start' ? -g.font * 0.55 : 0;
      return (
        <React.Fragment key={i}>
          <line className={m.minor ? 'mm-arp-x-tick mm-arp-x-tick-minor' : 'mm-arp-x-tick'} x1={x0.toFixed(2)} y1={y0.toFixed(2)} x2={x1.toFixed(2)} y2={y1.toFixed(2)} />
          {m.text && (
            <text className="mm-arp-x-num" x={(tx + dx).toFixed(2)} y={(ty + g.font * 0.36).toFixed(2)} textAnchor={anchor} fontSize={long ? g.font * 0.88 : g.font}>
              {m.text}
            </text>
          )}
        </React.Fragment>
      );
    })}
  </g>
);

/* ---------------- le reglage touche en dernier ---------------- */

/**
 * Le reglage touche en dernier (survol, geste, molette, clavier) : l'afficheur du bandeau (Header.tsx) montre son nom et
 * sa valeur. active : le geste en cours ; null : rien depuis un moment.
 */
let touch: { id: string; active: boolean } | null = null;
let touchTimer = 0;
const touchListeners = new Set<() => void>();
const emitTouch = (): void => touchListeners.forEach((fn) => fn());
export const xTouch = {
  get: (): { id: string; active: boolean } | null => touch,
  /** hold : le geste continue (le nom reste tant qu'il dure) ; sinon le nom s'efface 1.6 s plus tard */
  set(id: string, hold: boolean): void {
    window.clearTimeout(touchTimer);
    if (!touch || touch.id !== id || touch.active !== hold) {
      touch = { id, active: hold };
      emitTouch();
    }
    if (!hold) touchTimer = window.setTimeout(() => xTouch.clear(id), 1600);
  },
  clear(id?: string): void {
    if (!touch || (id && touch.id !== id)) return;
    window.clearTimeout(touchTimer);
    touch = null;
    emitTouch();
  },
  subscribe(fn: () => void): () => void {
    touchListeners.add(fn);
    return () => {
      touchListeners.delete(fn);
    };
  },
};

const SECTION_NAME: Record<string, string> = {
  engine: 'Engine',
  lfo1: 'LFO 1',
  lfo2: 'LFO 2',
  reverb: 'Reverb',
  master: 'Master',
  seq: 'Sequencer',
  osc: 'Osc',
  filter: 'Filter',
  phaser: 'Phaser',
  flanger: 'Flanger',
  pump: 'Pump',
  crush: 'Crush',
  space: 'Space',
  matrix: 'Matrix',
  voice: 'Voice',
  amp: 'Amp',
  eq: 'EQ',
  dist: 'Distortion',
};
/** Les reglages qui portent deja le nom de leur bloc (la dose PHASER du bloc phaser...) : sans prefixe. */
const OWN_NAME: ReadonlySet<string> = new Set(['xSwing', 'xRing', 'xFold', 'xNoiseColor', 'xUnison', 'xHpf', 'xComb', 'xCombFb', 'xPhMix', 'xFlMix', 'xPumpDepth', 'xCrushBits', 'xCrushRate', 'xDlyMode', 'xShimmer', 'xVoiceMode', 'xPbRange', 'xAmpMode', 'xDist']);
export const ariaName = (p: ExtraParam): string => (OWN_NAME.has(p.id) ? p.label.charAt(0) + p.label.slice(1).toLowerCase() : `${SECTION_NAME[p.section]} ${p.label.toLowerCase()}`);
export const sectionPrefix = (p: ExtraParam): string => (p.section === 'engine' || OWN_NAME.has(p.id) ? '' : `${SECTION_NAME[p.section].toUpperCase()} `);

const useArpMidi = () => useSyncExternalStore(arpMidi.subscribe, arpMidi.get, arpMidi.get);

/* ---------------- le potard ---------------- */

export type KnobLook = 'metal' | 'black';

interface DialProps {
  id: string;
  look: KnobLook;
  value: number;
  def: number;
  steps?: readonly string[];
  bipolar?: boolean;
  label: string;
  text: string;
  aria: string;
  help?: string;
  set: (v: number) => void;
}

/** Un potard : le dessin, ses graduations chiffrees, son nom et sa valeur ; les gestes ; MIDI LEARN. */
const Dial: React.FC<DialProps> = ({ id, look, value: v, def, steps, bipolar = false, label, text, aria, help, set }) => {
  const midi = useArpMidi();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; raw: number; moved: boolean } | null>(null);
  const cur = useRef(v);
  cur.current = v;
  const n = steps?.length ?? 0;
  const armed = midi.learning && midi.armed === id;
  const g = look === 'metal' ? METAL : BLACK;

  // La molette (non passive : la page ne defile pas) : un cran, ou 1 % (Maj : 0.1 %)
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let acc = 0;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      if (arpMidi.get().learning) return;
      acc += e.deltaY;
      const ticks = Math.trunc(acc / WHEEL_STEP);
      if (ticks === 0) return;
      acc -= ticks * WHEEL_STEP;
      const step = n > 1 ? 1 / (n - 1) : e.shiftKey ? 0.001 : 0.01;
      set(cur.current - ticks * step);
      xTouch.set(id, false);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // set est stable pour un id donne (XKnob, VKnob)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, n]);

  const onDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.focus({ preventScroll: true });
    // MIDI LEARN : le clic arme le reglage, il ne bouge pas
    if (arpBridge.learnArm(id)) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pas de capture : le geste reste sur le potard tant qu'on y est */
    }
    drag.current = { y: e.clientY, raw: v, moved: false };
    xTouch.set(id, true);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (!d.moved && Math.abs(dy) < 3) return;
    d.moved = true;
    // Par increments : Maj en cours de geste affine sans saut
    d.raw = Math.min(1, Math.max(0, d.raw + (dy / DRAG_PX) * (e.shiftKey ? 0.25 : 1)));
    d.y = e.clientY;
    let t = d.raw;
    if (bipolar && !e.shiftKey && Math.abs(t - 0.5) < CENTER_DETENT) t = 0.5;
    set(t);
  };
  const onEnd = (): void => {
    if (!drag.current) return;
    drag.current = null;
    xTouch.set(id, false);
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const step = n > 1 ? 1 / (n - 1) : e.shiftKey ? 0.1 : 0.01;
    let t = v;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') t += step;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') t -= step;
    else if (e.key === 'Home') t = 0;
    else if (e.key === 'End') t = 1;
    else if (e.key === 'Delete' || e.key === 'Backspace') t = def;
    else return;
    e.preventDefault();
    e.stopPropagation();
    if (arpMidi.get().learning) return;
    set(t);
    xTouch.set(id, false);
  };

  const idx = n > 1 ? Math.max(0, Math.min(n - 1, Math.round(v * (n - 1)))) : 0;
  return (
    <div
      ref={ref}
      className="mm-arp-x"
      data-x={id}
      data-look={look}
      data-steps={n > 1 ? '1' : undefined}
      data-mm-learn={armed ? 'armed' : undefined}
      data-learning={midi.learning ? '1' : undefined}
      role="slider"
      tabIndex={0}
      title={help}
      aria-label={aria}
      aria-valuemin={0}
      aria-valuemax={n > 1 ? n - 1 : 100}
      aria-valuenow={n > 1 ? idx : Math.round(v * 100)}
      aria-valuetext={text}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      onLostPointerCapture={onEnd}
      onPointerEnter={() => xTouch.set(id, false)}
      onDoubleClick={() => {
        if (arpMidi.get().learning) return;
        set(def);
        xTouch.set(id, false);
      }}
      onKeyDown={onKey}
    >
      <svg className="mm-arp-x-dial" viewBox={`0 0 ${g.w} ${g.h}`} width={g.w} height={g.h} aria-hidden="true">
        <Scale g={g} marks={scaleOf(id, steps, bipolar)} />
        <Cap g={g} look={look} deg={A0 + v * SWEEP} />
      </svg>
      <span className="mm-arp-x-label">
        {armed && <span className="mm-arp-led" data-on="1" data-blink="1" aria-hidden="true" />}
        {label}
      </span>
      <span className="mm-arp-x-value">{text}</span>
    </div>
  );
};

/* ---------------- un reglage du VST3 seul (extra.ts) ---------------- */

export const useExtra = (id: string): number =>
  useSyncExternalStore(
    arpExtra.subscribe,
    () => arpExtra.of(id),
    () => arpExtra.of(id)
  );

/** Un potard d'un reglage du VST3 seul ; label : un autre nom (MIX pour la dose d'un effet titre a part). */
export const XKnob: React.FC<{ p: ExtraParam; look?: KnobLook; label?: string; aria?: string }> = ({ p, look = 'metal', label, aria }) => {
  const v = useExtra(p.id);
  return <Dial id={p.id} look={look} value={v} def={arpExtra.def(p.id)} steps={p.steps} bipolar={BIPOLAR.has(p.id)} label={label ?? p.label} text={arpExtra.text(p.id, v)} aria={aria ?? ariaName(p)} help={p.help} set={(t) => arpExtra.set(p.id, t)} />;
};

/* ---------------- un TWEAK du site (voyager/params.ts) ---------------- */

const useVoy = (id: VoyKnobId): number =>
  useSyncExternalStore(
    voyParams.subscribe,
    () => voyParams.of(id),
    () => voyParams.of(id)
  );

/** Un potard d'un TWEAK du site : la valeur de voyParams, le texte de l'ecran de la machine (voyValueText). */
export const VKnob: React.FC<{ id: VoyKnobId; look?: KnobLook }> = ({ id, look = 'black' }) => {
  const v = useVoy(id);
  const k = voyKnob(id);
  return <Dial id={id} look={look} value={v} def={voyParams.def(id)} steps={k.steps} label={k.label} text={voyValueText(id, v)} aria={k.aria} help={k.aria} set={(t) => voyParams.set(id, t)} />;
};

/* ---------------- les commutateurs : une touche de la machine, une LED par position ---------------- */

interface SwitchProps {
  id: string;
  steps: readonly string[];
  /** les noms ecrits au-dessus des LED, s'ils different des crans (trop longs) */
  names?: readonly string[];
  idx: number;
  label: string;
  sub?: string;
  aria: string;
  help?: string;
  pick: (i: number) => void;
}

/** La touche de CHORUS et de SUB OCT, ses LED au-dessus (une par position) ; chaque appui passe a la suivante. */
const Switch: React.FC<SwitchProps> = ({ id, steps, names, idx, label, sub, aria, help, pick }) => {
  const midi = useArpMidi();
  const last = Math.max(1, steps.length - 1);
  const armed = midi.learning && midi.armed === id;
  const go = (i: number): void => {
    if (arpBridge.learnArm(id)) return;
    pick(Math.min(last, Math.max(0, i)));
    xTouch.set(id, false);
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    let i = idx;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') i += 1;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') i -= 1;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = last;
    else return;
    e.preventDefault();
    e.stopPropagation();
    if (!arpMidi.get().learning) go(i);
  };
  return (
    <div className="mm-arp-x mm-arp-x-switch" data-x={id} data-n={steps.length} data-mm-learn={armed ? 'armed' : undefined} data-learning={midi.learning ? '1' : undefined} title={help} onPointerEnter={() => xTouch.set(id, false)}>
      <div className="mm-arp-x-sw" role="radiogroup" aria-label={aria} onKeyDown={onKey}>
        {steps.map((s, i) => (
          <button key={s} type="button" role="radio" aria-checked={i === idx} tabIndex={i === idx ? 0 : -1} className="mm-arp-x-sw-led" data-on={i === idx ? '1' : undefined} aria-label={names ? s : undefined} onClick={() => go(i)}>
            {names?.[i] ?? s}
            <span className="mm-arp-led" data-on={i === idx ? '1' : undefined} aria-hidden="true" />
          </button>
        ))}
      </div>
      <button type="button" className="mm-arp-k mm-arp-x-sw-key" tabIndex={-1} aria-hidden="true" onClick={() => go(idx >= last ? 0 : idx + 1)} />
      <span className="mm-arp-x-label">
        {armed && <span className="mm-arp-led" data-on="1" data-blink="1" aria-hidden="true" />}
        {label}
      </span>
      <span className="mm-arp-x-value">{sub ?? steps[idx]}</span>
    </div>
  );
};

/** QUALITY, UNISON : un reglage a crans du VST3 seul. */
export const XSwitch: React.FC<{ p: ExtraParam }> = ({ p }) => {
  const v = useExtra(p.id);
  const steps = p.steps ?? [];
  const idx = extraStepIndex(p.id, v);
  return <Switch id={p.id} steps={steps} names={SWITCH_SHORT[p.id]} idx={idx} label={p.label} sub={SWITCH_SUB[p.id]?.[idx] ?? (SWITCH_SHORT[p.id] ? steps[idx] : undefined)} aria={ariaName(p)} help={p.help} pick={(i) => arpExtra.set(p.id, i / Math.max(1, steps.length - 1))} />;
};

/** SYNC, POLARITY : un TWEAK a deux positions du site. */
export const VSwitch: React.FC<{ id: VoyKnobId }> = ({ id }) => {
  const v = useVoy(id);
  const k = voyKnob(id);
  const steps = k.steps ?? [];
  return <Switch id={id} steps={steps} idx={stepIndex(id, v)} label={k.label} aria={k.aria} help={k.aria} pick={(i) => voyParams.set(id, i / Math.max(1, steps.length - 1))} />;
};
