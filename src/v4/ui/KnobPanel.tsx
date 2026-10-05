/**
 * Les potards au telephone (2026-10-04, Mika : "je voudrais m'assurer que
 * ARP ainsi que toutes les autres machines fonctionnent correctement sur
 * mobile ; c'est super important d'avoir tous les boutons, mais aussi que
 * ce soit beau et design, et surtout accessible et pas tout petit ; nous
 * avons quand meme la place sur un ecran en entier"). Sur la machine 3D,
 * les potards du MM-ARP font 18 px a l'ecran d'un telephone, ceux du
 * MM-RYTM 28 px : la page KNOBS de chaque Dock (ui/Dock.tsx,
 * ui/VoyDock.tsx) les donne tous, en gros, ranges par section comme sur la
 * machine.
 *
 * - Un onglet par section (OSC 1, OSC 2, MIX, FILTER, FILTER EG, AMP EG,
 *   MOD, FX, ARP, TWEAKS ; GLOBAL FX, VOICE FX, MASTER, KICK, VOICES), retenu.
 * - Quatre potards par rangee, 60 px, leur nom au-dessus, leur valeur
 *   dessous ; l'arc orange dit ou il en est (depuis le centre pour TONE et
 *   STRETCH), les crans d'un selecteur sont marques.
 * - Glisser vers le haut (ou la droite) : la valeur monte, 150 px pour la
 *   course entiere, comme sur la machine ; un selecteur passe de cran en
 *   cran, une tape aussi ; deux tapes : sa valeur de depart.
 * - VOICE FX : la voix a regler d'abord (BD a PC), comme le pad sur la
 *   machine.
 * Memes actions et memes stores que la machine (actions.ts anyDial) : la
 * machine 3D tourne avec. Au clavier : role slider, fleches, Debut, Fin.
 */

import React, { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { anyDial, anyDialReset, anyDialValue, dialRange, dialReadout, dialSteps, dialValueText, subscribeDials, tuneVoice, type DialId } from '../actions';
import { INSTRUMENTS, pattern } from '../audio/pattern';
import type { Stage } from '../scene/renderer';
import type { MachineId } from '../state/focus';
import { POT_UI, TEMPO_UI } from '../theme';

interface Dial {
  id: DialId;
  label: string;
}

interface Group {
  id: string;
  label: string;
  dials: readonly Dial[];
  /** VOICE FX : la voix a choisir au-dessus */
  voices?: boolean;
}

const v = (id: string, label: string): Dial => ({ id: `v:${id}` as DialId, label });
const e = (id: string, label: string): Dial => ({ id: id as DialId, label });
const r = (id: string, label: string): Dial => ({ id: `r:${id}` as DialId, label });

const ARP_GROUPS: readonly Group[] = [
  { id: 'osc1', label: 'OSC 1', dials: [v('wave1', 'WAVE'), v('range1', 'RANGE'), v('semi1', 'SEMI'), v('fine1', 'FINE'), v('on1', 'ON'), v('osc1', 'LEVEL')] },
  { id: 'osc2', label: 'OSC 2', dials: [v('wave2', 'WAVE'), v('range2', 'RANGE'), v('semi2', 'SEMI'), v('fine2', 'FINE'), v('on2', 'ON'), v('osc2', 'LEVEL')] },
  { id: 'mix', label: 'MIX', dials: [v('noise', 'NOISE'), v('fm', 'FM'), v('ratio', 'RATIO'), v('volume', 'VOLUME')] },
  { id: 'filter', label: 'FILTER', dials: [v('cutoff', 'CUTOFF'), v('res', 'RES'), v('envAmt', 'ENV AMT'), v('fmode', 'MODE')] },
  { id: 'feg', label: 'FILTER EG', dials: [v('fA', 'ATTACK'), v('fD', 'DECAY'), v('fS', 'SUSTAIN'), v('fR', 'RELEASE')] },
  { id: 'aeg', label: 'AMP EG', dials: [v('aA', 'ATTACK'), v('aD', 'DECAY'), v('aS', 'SUSTAIN'), v('aR', 'RELEASE')] },
  { id: 'mod', label: 'MOD', dials: [v('lfoRate', 'SPEED'), v('lfoShape', 'SHAPE'), v('lfoDest', 'TARGET'), v('lfoAmt', 'DEPTH')] },
  { id: 'fx', label: 'FX', dials: [v('dist', 'OVERDRIVE'), v('chorus', 'CHORUS'), v('delay', 'DELAY'), v('reverb', 'REVERB')] },
  { id: 'arp', label: 'ARP', dials: [v('rate', 'RATE'), v('mode', 'MODE'), v('range', 'RANGE'), v('notes', 'NOTES'), v('gate', 'GATE'), v('octave', 'OCTAVE'), v('glide', 'GLIDE')] },
  { id: 'tweaks', label: 'TWEAKS', dials: [v('phase', 'PHASE'), v('drift', 'DRIFT'), v('width', 'WIDTH'), v('monoLow', 'BASS MONO'), v('keyTrack', 'KEY TRACK'), v('accent', 'ACCENT'), v('sync', 'SYNC'), v('duck', 'SIDECHAIN')] },
];

const RYTM_GROUPS: readonly Group[] = [
  { id: 'global', label: 'GLOBAL FX', dials: [e('swing', 'SWING'), e('stretch', 'STRETCH'), e('dist', 'DIST'), e('chorus', 'CHORUS'), e('delay', 'DELAY'), e('reverb', 'REVERB')] },
  {
    id: 'voice',
    label: 'VOICE FX',
    voices: true,
    dials: [e('vol', 'VOLUME'), e('tone', 'TONE'), e('vdecay', 'DECAY'), e('vdist', 'DIST'), e('vchorus', 'CHORUS'), e('vdelay', 'DELAY'), e('vreverb', 'REVERB')],
  },
  { id: 'main', label: 'MASTER', dials: [e('level', 'MASTER'), e('tempo', 'TEMPO')] },
  { id: 'kick', label: 'KICK', dials: [r('bd', 'SOUND'), r('tune', 'TUNE'), r('attack', 'ATTACK'), r('decay', 'DECAY'), r('drive', 'DRIVE')] },
  { id: 'kit', label: 'VOICES', dials: [r('sd', 'SNARE'), r('snappy', 'SNAPPY'), r('cp', 'CLAP'), r('gate', 'GATE'), r('hh', 'HATS'), r('tom', 'TOMS'), r('rs', 'RIM')] },
];

const TAB_KEY = 'mm.v4.knobtab.';

function readTab(m: string, groups: readonly Group[]): string {
  try {
    const t = window.localStorage.getItem(TAB_KEY + m);
    if (t && groups.some((g) => g.id === t)) return t;
  } catch {
    /* rien de retenu : la premiere section */
  }
  return groups[0].id;
}

/** Le cran du milieu d'un potard a zero au centre : la demi-largeur, en part de la course. */
const CENTER_DETENT = 0.02;

/** La geometrie du potard dessine : 270 deg, de sept heures et demie a quatre heures et demie. */
const SIZE = 64;
const C = SIZE / 2;
const R_ARC = 25;
const A0 = 135;
const SWEEP = 270;
const pt = (deg: number, rad: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [C + Math.cos(a) * rad, C + Math.sin(a) * rad];
};
const arc = (from: number, to: number, rad: number): string => {
  const [x0, y0] = pt(from, rad);
  const [x1, y1] = pt(to, rad);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const sweep = to >= from ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${rad} ${rad} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

/**
 * Ce qu'un gros potard sait de son reglage (2026-10-04) : sa valeur et ses
 * bornes, ses crans, sa valeur de depart, ce qu'il affiche. Les potards
 * des machines (DialId, plus bas) et ceux de la table du MM-DECKS
 * (dj/MixDock.tsx) passent par la.
 */
export interface KnobSpec {
  label: string;
  get(): number;
  set(v: number): void;
  reset(): number;
  range: readonly [number, number];
  /** 0 : continu */
  steps: number;
  /** zero au milieu : l'arc part du centre */
  bipolar: boolean;
  readout(): string;
  valueText(): string;
  subscribe(fn: () => void): () => void;
  /** TEMPO : au BPM entier */
  whole?: boolean;
}

/** Un potard : glisser, taper (cran suivant), deux tapes (valeur de depart), clavier. */
export const KnobView: React.FC<{ spec: KnobSpec }> = ({ spec }) => {
  const value = useSyncExternalStore(spec.subscribe, spec.get, spec.get);
  const [lo, hi] = spec.range;
  const steps = spec.steps;
  // Un selecteur (16 crans au plus) : ses crans marques, une tape passe au suivant ; au-dela (PITCH, 49) : un potard fin
  const detents = steps > 1 && steps <= 16;
  const k = hi > lo ? Math.min(1, Math.max(0, (value - lo) / (hi - lo))) : 0;
  const bipolar = spec.bipolar;
  const drag = useRef<{ y: number; x: number; k0: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);

  /** Une position 0 a 1 -> la valeur du potard (au cran pres pour un selecteur, au BPM pres pour TEMPO). */
  const setAt = (pos: number, detent = false): void => {
    let p = Math.min(1, Math.max(0, pos));
    if (steps > 1) p = Math.round(p * (steps - 1)) / (steps - 1);
    // Un potard a zero au centre : un cran au milieu pendant le glisser (2026-10-05, les EQ du mixer : 0 dB au milieu)
    else if (detent && bipolar && Math.abs(p - 0.5) < CENTER_DETENT) p = 0.5;
    let val = lo + p * (hi - lo);
    if (spec.whole) val = Math.round(val);
    else val = Math.round(val * 1000) / 1000;
    spec.set(val);
  };

  const onDown = (ev: React.PointerEvent<HTMLDivElement>): void => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    ev.stopPropagation();
    try {
      ev.currentTarget.setPointerCapture(ev.pointerId);
    } catch {
      /* pas de capture : le geste reste sur le potard tant qu'on y est */
    }
    drag.current = { y: ev.clientY, x: ev.clientX, k0: k, moved: false };
  };
  const onMove = (ev: React.PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d) return;
    const travel = d.y - ev.clientY + (ev.clientX - d.x);
    if (!d.moved && Math.abs(travel) < 4) return;
    d.moved = true;
    setAt(d.k0 + travel / POT_UI.pxRange, true);
  };
  const onUp = (): void => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    // Une tape : un selecteur passe au cran suivant (et reboucle) ; deux tapes : la valeur de depart
    if (detents) {
      const i = Math.round(k * (steps - 1));
      setAt(((i + 1) % steps) / (steps - 1));
      return;
    }
    const t = performance.now();
    if (t - lastTap.current <= TEMPO_UI.tapMs) {
      lastTap.current = 0;
      spec.set(spec.reset());
    } else lastTap.current = t;
  };
  const onKey = (ev: React.KeyboardEvent<HTMLDivElement>): void => {
    const step = steps > 1 ? 1 / (steps - 1) : ev.shiftKey ? 0.1 : spec.whole ? 1 / (hi - lo) : 0.01;
    let p = k;
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowRight') p += step;
    else if (ev.key === 'ArrowDown' || ev.key === 'ArrowLeft') p -= step;
    else if (ev.key === 'Home') p = 0;
    else if (ev.key === 'End') p = 1;
    else return;
    ev.preventDefault();
    setAt(p);
  };

  const at = A0 + k * SWEEP;
  const from = bipolar ? A0 + SWEEP / 2 : A0;
  const [px, py] = pt(at, 15);
  const [qx, qy] = pt(at, 7);
  return (
    <div
      className="v4-knob"
      role="slider"
      tabIndex={0}
      aria-label={spec.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(k * 100)}
      aria-valuetext={spec.readout()}
      data-steps={detents ? '1' : '0'}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onKeyDown={onKey}
    >
      <span className="v4-knob-label">{spec.label}</span>
      <svg className="v4-knob-dial" viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true">
        <path className="v4-knob-track" d={arc(A0, A0 + SWEEP, R_ARC)} />
        {Math.abs(at - from) > 0.5 && <path className="v4-knob-arc" d={from < at ? arc(from, at, R_ARC) : arc(at, from, R_ARC)} />}
        {detents &&
          Array.from({ length: steps }, (_, i) => {
            const [x0, y0] = pt(A0 + (i / (steps - 1)) * SWEEP, R_ARC + 3.5);
            const [x1, y1] = pt(A0 + (i / (steps - 1)) * SWEEP, R_ARC + 6.5);
            return <line key={i} className="v4-knob-tick" x1={x0} y1={y0} x2={x1} y2={y1} />;
          })}
        <circle className="v4-knob-cap" cx={C} cy={C} r={19} />
        <line className="v4-knob-mark" x1={qx} y1={qy} x2={px} y2={py} />
      </svg>
      <span className="v4-knob-value">{spec.valueText()}</span>
    </div>
  );
};

/** Un potard d'une machine (DialId) : les memes actions et stores que la machine. */
const BigKnob: React.FC<Dial> = ({ id, label }) => {
  const spec = useMemo<KnobSpec>(() => {
    const range = dialRange(id);
    return {
      label,
      get: () => anyDialValue(id),
      set: (v) => anyDial(id, v),
      reset: () => anyDialReset(id),
      range,
      steps: dialSteps(id),
      bipolar: range[0] < 0,
      readout: () => dialReadout(id),
      valueText: () => dialValueText(id),
      subscribe: subscribeDials,
      whole: id === 'tempo',
    };
  }, [id, label]);
  return <KnobView spec={spec} />;
};

interface Props {
  machine: 'mm808' | 'voy';
}

export const KnobPanel: React.FC<Props> = ({ machine }) => {
  const groups = machine === 'voy' ? ARP_GROUPS : RYTM_GROUPS;
  const [tab, setTab] = useState(() => readTab(machine, groups));
  const p = useSyncExternalStore(pattern.subscribe, pattern.get, pattern.get);
  const g = groups.find((x) => x.id === tab) ?? groups[0];
  const pick = (id: string): void => {
    setTab(id);
    try {
      window.localStorage.setItem(TAB_KEY + machine, id);
    } catch {
      /* stockage indisponible : la section vaut pour la visite */
    }
  };
  return (
    <div className="v4-knobs">
      <div className="v4-knobs-tabs" role="tablist" aria-label="Sections">
        {groups.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={x.id === g.id} className="v4-knobs-tab" onClick={() => pick(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      {g.voices && (
        <div className="v4-knobs-voices" role="group" aria-label="Voice to tune">
          {INSTRUMENTS.map((inst) => (
            <button key={inst} type="button" className="v4-knobs-voice" aria-pressed={p.instrument === inst} onClick={() => tuneVoice(inst)}>
              {inst}
            </button>
          ))}
        </div>
      )}
      <div className="v4-knobs-grid" role="tabpanel" aria-label={g.label}>
        {g.dials.map((d) => (
          <BigKnob key={d.id} id={d.id} label={d.label} />
        ))}
      </div>
    </div>
  );
};

/**
 * KNOBS ouvert : la machine remonte au-dessus du Dock (Stage.setInset, le
 * cadrage des editeurs), on voit ses potards tourner ; replie ou sur
 * l'autre page, elle reprend tout l'ecran.
 */
export function useDockInset(stage: Stage | null, machine: MachineId, active: boolean, ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!stage || !el || !active) return undefined;
    const apply = (): void => {
      const sw = document.querySelector('.v4-mswitch');
      const top = sw ? sw.getBoundingClientRect().bottom + 6 : 56;
      stage.setInset(machine, el.offsetHeight + 12, top);
    };
    apply();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      stage.setInset(machine, 0);
    };
  }, [stage, machine, active, ref]);
}

/** La page d'un Dock : la sienne (le sequenceur, les accords) ou les potards ; retenue. */
export type DockPage = 'main' | 'knobs';

export function useDockPage(key: string): [DockPage, (p: DockPage) => void] {
  const [page, set] = useState<DockPage>(() => {
    try {
      return window.localStorage.getItem(key) === 'knobs' ? 'knobs' : 'main';
    } catch {
      return 'main';
    }
  });
  const choose = (p: DockPage): void => {
    set(p);
    try {
      window.localStorage.setItem(key, p);
    } catch {
      /* stockage indisponible : la page vaut pour la visite */
    }
  };
  return [page, choose];
}

/** Les deux pages d'un Dock, en haut : la sienne, KNOBS. */
export const DockPages: React.FC<{ page: DockPage; onPage: (p: DockPage) => void; first: string }> = ({ page, onPage, first }) => (
  <div className="v4-dock-pages" role="tablist" aria-label="Dock page">
    <button type="button" role="tab" aria-selected={page === 'main'} className="v4-dock-page" onClick={() => onPage('main')}>
      {first}
    </button>
    <button type="button" role="tab" aria-selected={page === 'knobs'} className="v4-dock-page" onClick={() => onPage('knobs')}>
      KNOBS
    </button>
  </div>
);

export default KnobPanel;
