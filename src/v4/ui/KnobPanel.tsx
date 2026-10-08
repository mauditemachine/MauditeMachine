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
 *
 * MM-RYTM depuis le 2026-10-08 (la refonte facon Digitakt, Mika : "les
 * valeurs de knobs sont a l'ecran, de 0 a 127 ; que ce soit super
 * responsive en mobile et utilisable") : l'onglet PAGES (son id reste
 * 'voice', l'onglet retenu ne se perd pas) a les six touches de page (la
 * page allumee, encore : HOME), la voix, et les huit potards de page en
 * 2 x 4 comme sous l'ecran (A B C D, E F G H), chacun ce que son bloc regle
 * sur la page affichee, sa valeur de 0 a 127 et son unite ; MASTER garde
 * MASTER et TEMPO. GLOBAL FX, KICK et VOICES sont partis : tout est sur les
 * pages.
 *
 * Le LOCK (2026-10-08, l'etape R2 des parameter locks) : un pas en LOCK (une
 * tenue sur la machine, ou sur le Dock), les potards de page reglent ses
 * verrous ; un verrou pose se montre en negatif (comme a l'ecran), la valeur
 * de la voix en retrait, GLOBAL et NO LOCK a peine ; deux tapes retirent un
 * verrou. La rangee des voix laisse la place a la barre du LOCK : le pas, ses
 * verrous, CLEAR (ses verrous) et EXIT.
 */

import React, { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import {
  anyDial,
  anyDialReset,
  anyDialValue,
  dialNudge,
  dialRange,
  dialReadout,
  dialSteps,
  dialUnit,
  dialValueText,
  lockSummary,
  pageKnobReset,
  rytmLockClear,
  rytmLockToggle,
  rytmPageKey,
  subscribeDials,
  tuneVoice,
  type DialId,
} from '../actions';
import { rytmLock } from '../state/rytmLock';
import { rytmInfos } from '../state/rytmInfos';
import { INSTRUMENTS, pattern } from '../audio/pattern';
import { stageNow } from '../midi/targets';
import { pageSlots } from '../rytm/pages';
import { slotBlock } from '../rytm/pageView';
import { v127 } from '../rytm/values';
import type { Stage } from '../scene/renderer';
import type { MachineId } from '../state/focus';
import { rytmPage } from '../state/rytmPage';
import { PAGE_KNOB_IDS, PAGE_KNOB_LETTERS, POT_UI, RYTM_PAGE_KEYS, TEMPO_UI } from '../theme';

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
  /** PAGES du MM-RYTM (2026-10-08) : les touches de page au-dessus, les potards de page */
  pages?: boolean;
}

const v = (id: string, label: string): Dial => ({ id: `v:${id}` as DialId, label });
const e = (id: string, label: string): Dial => ({ id: id as DialId, label });

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
  { id: 'tweaks', label: 'TWEAKS', dials: [v('phase', 'PHASE'), v('drift', 'DRIFT'), v('width', 'WIDTH'), v('monoLow', 'BASS MONO'), v('keyTrack', 'KEY TRACK'), v('accent', 'ACCENT'), v('sync', 'SYNC'), v('duck', 'SIDECHAIN'), v('chord', 'CHORD')] },
];

/** PAGES (id 'voice', celui de l'ancien VOICE FX : l'onglet retenu reste valable) et MASTER. */
const RYTM_GROUPS: readonly Group[] = [
  { id: 'voice', label: 'PAGES', voices: true, pages: true, dials: PAGE_KNOB_IDS.map((_, k) => e(`p:${k}`, PAGE_KNOB_LETTERS[k])) },
  { id: 'main', label: 'MASTER', dials: [e('level', 'MASTER'), e('tempo', 'TEMPO')] },
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
 * des machines (DialId, plus bas) passent par la.
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
  /** la ligne d'unite sous la valeur (216 MS, -3.2 DB) */
  unit?(): string;
  /** la lettre du potard (un potard de page du MM-RYTM : A a H) */
  letter?: string;
  /** les fleches : n crans de 1 sur 127 (un potard de page) */
  nudge?(n: number): void;
  /** un reglage a venir : grise, il le dit a l'ecran */
  soon?: boolean;
  /**
   * le nombre de l'ecran du MM-RYTM pour les lecteurs d'ecran (0 a 127, -64
   * a +63 a zero au centre ; 2026-10-08) au lieu du pour cent
   */
  scale127?: boolean;
  /** false : une tape ne passe pas au cran suivant (TRIG VEL : un niveau, pas un selecteur) */
  selector?: boolean;
  /** l'etiquette du bloc (la voix, ALL, NO BD) au bout de la ligne d'unite, comme a l'ecran */
  tag?: string;
  /** deux tapes : cette action au lieu de la valeur de depart (un potard de page en LOCK : son verrou s'en va) */
  onReset?(): void;
  /** en LOCK (2026-10-08) : locked (en negatif), base, global, nolock ; absent hors LOCK */
  lockState?: string;
  /** sa couche ne s'entend pas (R3, revue) : en retrait, comme le bloc de l'ecran */
  quiet?: boolean;
  /**
   * INFOS du MM-RYTM (R4, 2026-10-08) : pris, il montre sa carte (true : INFOS
   * allume) ; une tape ne fait alors que la montrer, un glisser le tourne
   */
  info?(): boolean;
}

/** Un potard : glisser, taper (cran suivant), deux tapes (valeur de depart), clavier. */
export const KnobView: React.FC<{ spec: KnobSpec; compact?: boolean }> = ({ spec, compact = false }) => {
  const value = useSyncExternalStore(spec.subscribe, spec.get, spec.get);
  const [lo, hi] = spec.range;
  const steps = spec.steps;
  // Un selecteur (16 crans au plus) : ses crans marques, une tape passe au suivant ; au-dela (PITCH, 49) : un potard fin
  const detents = steps > 1 && steps <= 16;
  // TRIG VEL (2026-10-08) : des crans, mais une tape ne doit pas poser de note
  // En LOCK (revue de R2) : une tape ne pose pas le cran suivant en verrou (SAMPLE, GATE) ; deux tapes l'enlevent
  const tapNext = detents && spec.selector !== false && !spec.lockState;
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
    spec.info?.();
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
    // INFOS du MM-RYTM allume (R4) : la tape montre sa carte, rien de plus
    if (spec.info?.()) return;
    // Une tape : un selecteur passe au cran suivant (et reboucle) ; deux tapes : la valeur de depart
    if (tapNext) {
      const i = Math.round(k * (steps - 1));
      setAt(((i + 1) % steps) / (steps - 1));
      return;
    }
    const t = performance.now();
    if (t - lastTap.current <= TEMPO_UI.tapMs) {
      lastTap.current = 0;
      if (spec.onReset) spec.onReset();
      else spec.set(spec.reset());
    } else lastTap.current = t;
  };
  const onKey = (ev: React.KeyboardEvent<HTMLDivElement>): void => {
    // Un potard de page (2026-10-08) : 1 sur 127 le cran (Maj : 10), Debut et Fin aux butees
    if (spec.nudge && (ev.key === 'ArrowUp' || ev.key === 'ArrowRight' || ev.key === 'ArrowDown' || ev.key === 'ArrowLeft')) {
      ev.preventDefault();
      spec.nudge((ev.key === 'ArrowUp' || ev.key === 'ArrowRight' ? 1 : -1) * (ev.shiftKey ? 10 : 1));
      return;
    }
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
      className={compact ? 'v4-knob v4-knob-page' : 'v4-knob'}
      data-soon={spec.soon ? '1' : undefined}
      data-lock={spec.lockState}
      data-quiet={spec.quiet ? '1' : undefined}
      role="slider"
      tabIndex={0}
      aria-label={spec.letter ? `Knob ${spec.letter}, ${spec.tag ? `${spec.tag} ` : ''}${spec.label}${spec.soon ? ', coming soon' : ''}` : spec.label}
      aria-valuemin={spec.scale127 ? (bipolar ? -64 : 0) : 0}
      aria-valuemax={spec.scale127 ? (bipolar ? 63 : 127) : 100}
      aria-valuenow={spec.scale127 ? v127(k, bipolar) : Math.round(k * 100)}
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
      <span className="v4-knob-label">
        {spec.letter && <span className="v4-knob-letter">{spec.letter}</span>}
        {spec.label}
      </span>
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
      {spec.unit && (
        <span className="v4-knob-unit">
          {spec.unit() || (spec.tag ? '' : '\u00a0')}
          {spec.tag && <span className="v4-knob-tag">{spec.tag}</span>}
        </span>
      )}
    </div>
  );
};

/**
 * Un potard de page du MM-RYTM (2026-10-08) : ce que son bloc regle sur la
 * page affichee, pour la voix choisie (sa course, ses crans et son nom
 * changent avec la page) ; un bloc vide, une case vide (la grille garde la
 * place des potards de la machine) ; un reglage a venir, grise.
 */
const PageKnob: React.FC<{ k: number }> = ({ k }) => {
  const rp = useSyncExternalStore(rytmPage.subscribe, rytmPage.get, rytmPage.get);
  const p = useSyncExternalStore(pattern.subscribe, pattern.get, pattern.get);
  // Le LOCK (2026-10-08) : le bloc de l'ecran pour ce pas (verrouille, la valeur de la voix, GLOBAL, NO LOCK)
  const lk = useSyncExternalStore(rytmLock.subscribe, rytmLock.get, rytmLock.get);
  const slot = pageSlots(rp.page, p.instrument)[k];
  const letter = PAGE_KNOB_LETTERS[k];
  const block = slot && slot.label ? slotBlock(slot, k, p.instrument, rp.sel, false, lk.step >= 0 ? { kind: 'lock', step: lk.step } : null) : null;
  // Le meme bloc que l'ecran : son etiquette (la voix sur la rangee du haut de FX, ALL ou NO BD dessous ; en LOCK GLOBAL, NO LOCK ;
  // R3, 2026-10-08 : sa couche muette, SYN OFF ou SMP OFF, comme le bloc en retrait de l'ecran)
  // (revue de R3 : BOTH en retrait, la voix muette, SILENT ; le potard en retrait comme le bloc)
  // MACHINE dit deja SYNTH OFF sur sa ligne d'unite : pas d'etiquette en double
  const quietTag = slot?.target === 'l:mach' ? '' : slot?.both ? 'SILENT' : slot?.layer === 'synth' ? 'SYN OFF' : 'SMP OFF';
  const tag = block ? (block.quiet ? quietTag : block.tag) : '';
  if (!slot || !slot.label) {
    return (
      <div className="v4-knob v4-knob-page v4-knob-empty" aria-hidden="true">
        <span className="v4-knob-label">
          <span className="v4-knob-letter">{letter}</span>
        </span>
      </div>
    );
  }
  const id = `p:${k}` as DialId;
  const range = dialRange(id);
  const spec: KnobSpec = {
    label: slot.label,
    letter,
    get: () => anyDialValue(id),
    set: (v) => anyDial(id, v),
    reset: () => anyDialReset(id),
    range,
    steps: dialSteps(id),
    bipolar: range[0] < 0,
    readout: () => dialReadout(id),
    valueText: () => dialValueText(id),
    unit: () => (slot.target === null ? 'SOON' : dialUnit(id)),
    nudge: (n) => dialNudge(id, n),
    subscribe: subscribeDials,
    soon: slot.target === null,
    scale127: true,
    selector: slot.target !== 'step:vel',
    tag,
    onReset: () => pageKnobReset(k),
    info: () => rytmInfos.dock(`penc-${k}`),
    lockState: block && block.lock !== 'none' ? block.lock : undefined,
    quiet: !!block?.quiet && (!block.lock || block.lock === 'none' || block.lock === 'base'),
  };
  return <KnobView spec={spec} compact />;
};

/**
 * La barre du LOCK (2026-10-08) a la place des voix : le pas et ses verrous
 * (toutes pages) et la double tape qui en enleve un, CLR LOCKS (ses verrous,
 * ses coups restent) et EXIT.
 */
const LockBar: React.FC = () => {
  const lk = useSyncExternalStore(rytmLock.subscribe, rytmLock.get, rytmLock.get);
  const p = useSyncExternalStore(pattern.subscribe, pattern.get, pattern.get);
  const n = lk.step + 1;
  const names = lockSummary(lk.step);
  return (
    <div className="v4-knobs-lockbar" role="group" aria-label={`Lock mode on step ${n}`}>
      <span className="v4-knobs-lock" aria-live="polite">
        <span className="v4-knobs-lock-pill">LOCK {n < 10 ? `0${n}` : n}</span>
        {/* Ce que le pas a, puis comment l'enlever (revue de R2 : la double tape ne se devinait pas) */}
        <span className="v4-knobs-lock-text">
          <span className="v4-knobs-lock-what">{p.instrument ?? ''} {names.length > 0 ? names.join(' ') : 'TURN A KNOB'}</span>
          <span className="v4-knobs-lock-tip">2X ON A KNOB: UNLOCK</span>
        </span>
      </span>
      {/* CLR LOCKS (revue de R2) : CLEAR seul se lisait comme effacer le pattern */}
      <button type="button" className="v4-knobs-lockkey" aria-label={`Clear the locks of step ${n}`} onClick={() => rytmLockClear()}>
        CLR LOCKS
      </button>
      <button type="button" className="v4-knobs-lockkey" aria-label="Leave lock mode" onClick={() => rytmLockToggle(lk.step)}>
        EXIT
      </button>
    </div>
  );
};

/** Les six touches de page (2026-10-08) : comme sur la machine, la page allumee pressee encore : HOME. */
const PageKeys: React.FC = () => {
  const rp = useSyncExternalStore(rytmPage.subscribe, rytmPage.get, rytmPage.get);
  return (
    <div className="v4-knobs-pages" role="group" aria-label="Pages, the lit one again: home screen">
      {RYTM_PAGE_KEYS.map((pk) => {
        const on = rp.page === pk.id;
        return (
          <button
            key={pk.id}
            type="button"
            className="v4-knobs-page"
            data-lit={on ? (rp.view === 'page' ? '1' : 'dim') : '0'}
            aria-pressed={on && rp.view === 'page'}
            aria-label={`${pk.label} page${on ? (rp.view === 'page' ? ', shown, press again for home' : ', press for the page view') : ''}`}
            onClick={() => (rytmInfos.dock(`pkey-${pk.id}`) ? rytmPage.setPage(pk.id) : rytmPageKey(pk.id, stageNow()))}
          >
            {pk.label}
          </button>
        );
      })}
    </div>
  );
};

/** INFOS du MM-RYTM (R4) : la jumelle sur la face de MASTER et TEMPO (la page MASTER du Dock). */
const RYTM_BIG_INFO: Partial<Record<string, string>> = { level: 'enc-level', tempo: 'enc-tempo' };

/** Un potard d'une machine (DialId) : les memes actions et stores que la machine. */
const BigKnob: React.FC<Dial & { machine?: 'mm808' | 'voy' }> = ({ id, label, machine }) => {
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
      ...(machine === 'mm808' && RYTM_BIG_INFO[id] ? { info: () => rytmInfos.dock(RYTM_BIG_INFO[id] ?? '') } : {}),
    };
  }, [id, label, machine]);
  return <KnobView spec={spec} />;
};

interface Props {
  machine: 'mm808' | 'voy';
}

export const KnobPanel: React.FC<Props> = ({ machine }) => {
  const groups = machine === 'voy' ? ARP_GROUPS : RYTM_GROUPS;
  const [tab, setTab] = useState(() => readTab(machine, groups));
  const p = useSyncExternalStore(pattern.subscribe, pattern.get, pattern.get);
  const locking = useSyncExternalStore(rytmLock.subscribe, () => rytmLock.get().step >= 0, () => false) && machine === 'mm808';
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
    <div className="v4-knobs" data-pages={g.pages ? '1' : undefined} data-rytm={machine === 'mm808' ? '1' : undefined}>
      <div className="v4-knobs-tabs" role="tablist" aria-label="Sections">
        {groups.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={x.id === g.id} className="v4-knobs-tab" onClick={() => pick(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      {g.pages && <PageKeys />}
      {g.pages && locking && <LockBar />}
      {g.voices && !(g.pages && locking) && (
        <div className="v4-knobs-voices" role="group" aria-label="Voice to tune">
          {INSTRUMENTS.map((inst) => (
            <button
              key={inst}
              type="button"
              className="v4-knobs-voice"
              aria-pressed={p.instrument === inst}
              onClick={() => {
                // INFOS du MM-RYTM (R4) : la carte de la voix, choisie quand meme (la navigation), jamais deselectionnee
                if (!(machine === 'mm808' && rytmInfos.dock(`pad-${inst}`))) tuneVoice(inst);
                else if (p.instrument !== inst) tuneVoice(inst);
              }}
            >
              {inst}
            </button>
          ))}
        </div>
      )}
      <div className="v4-knobs-grid" role="tabpanel" aria-label={g.label}>
        {g.pages ? PAGE_KNOB_IDS.map((pk, k) => <PageKnob key={pk} k={k} />) : g.dials.map((d) => <BigKnob key={d.id} id={d.id} label={d.label} machine={machine} />)}
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

/** Les deux pages d'un Dock, en haut : la sienne, KNOBS ; extra : une touche au bout (INFOS du MM-RYTM, R4). */
export const DockPages: React.FC<{ page: DockPage; onPage: (p: DockPage) => void; first: string; extra?: React.ReactNode }> = ({ page, onPage, first, extra }) => (
  <div className="v4-dock-pages" role="tablist" aria-label="Dock page">
    <button type="button" role="tab" aria-selected={page === 'main'} className="v4-dock-page" onClick={() => onPage('main')}>
      {first}
    </button>
    <button type="button" role="tab" aria-selected={page === 'knobs'} className="v4-dock-page" onClick={() => onPage('knobs')}>
      KNOBS
    </button>
    {extra}
  </div>
);

export default KnobPanel;
