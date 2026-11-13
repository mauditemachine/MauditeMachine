/**
 * Les pieces de la carte noire du capot (HoodBoard.tsx). Refaites le 2026-11-13 (Mika : "le look d'OPEN n'est pas beau,
 * plus realiste : knobs avec relief, ombre, jupe crantee comme ceux de la face avant ; pour les reglages a peu de choix,
 * des petits boutons poussoirs 3D avec LED, ou le style du bouton CHORUS de la face" ; "les selecteurs a positions doivent
 * se regler au mouvement de souris, cran par cran, pas au clic").
 *
 * - PcbKnob : le potard de la face, en relief (ombre portee, jupe crantee, capuchon cannele, reflet fixe, trait blanc) ;
 *   une LED a cote de son nom s'allume quand le reglage colore le son (loin de son neutre : FILTER +, les doses d'effets,
 *   l'EQ...) : eteinte, le reglage ne fait rien. Un reglage sans effet tant qu'un autre est a zero (COMB FB sans COMB,
 *   RATE d'un phaser coupe) est grise.
 * - PcbStep : deux a quatre crans : la touche noire rectangulaire de CHORUS, ses LED et leurs noms au-dessus. Elle se
 *   regle en glissant verticalement, cran par cran (vers le haut : le cran suivant), a la molette, aux fleches ; un clic
 *   sans glisser ne change rien, sauf une touche a deux crans (ON / OFF) : un poussoir, un clic bascule.
 * - PcbSelect : plus de quatre crans (CHORD, BEND, les vitesses, la matrice) : un petit afficheur ; glisser verticalement
 *   passe d'un cran a l'autre, un clic sans glisser deroule la liste (le choix se fait dans la liste).
 * - PcbKey : la touche de la face (bandeau, banque, DRAG MIDI).
 *
 * Deux sources, memes pieces : un reglage du VST3 seul (extra.ts, arpExtra) ou un TWEAK du site (voyager/params.ts,
 * voyParams). Le reglage touche s'ecrit sur l'afficheur du bandeau (hoodLcd, et voyMsg pour l'ecran de la face).
 * Potard : glisser vertical (Maj : fin), molette, double-clic = la valeur de depart, fleches (Maj : x10), Debut, Fin,
 * Suppr. En MIDI LEARN, un clic arme le reglage (arpBridge.learnArm) sans le bouger.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { voyMsg } from '../../voyager/msg';
import { arpBridge } from './bridge';
import { voyKnob, voyParams, voyReadout, voyValueText, VOY_KNOB_IDS, type VoyKnobId } from '../../voyager/params';
import { arpExtra, extraParam, isExtra } from './extra';
import { arpMidi } from './midimap';

/* ---------------- la source d'un reglage ---------------- */

const isVoy = (id: string): id is VoyKnobId => !isExtra(id) && (VOY_KNOB_IDS as readonly string[]).includes(id);

/** La valeur, la valeur de depart, le texte, les crans d'un reglage, ou qu'il vive. */
export const SRC = {
  of: (id: string): number => (isVoy(id) ? voyParams.of(id) : arpExtra.of(id)),
  def: (id: string): number => (isVoy(id) ? voyParams.def(id) : arpExtra.def(id)),
  set: (id: string, v: number): void => {
    if (isVoy(id)) voyParams.set(id, Math.min(1, Math.max(0, v)));
    else arpExtra.set(id, v);
  },
  text: (id: string, v: number = SRC.of(id)): string => (isVoy(id) ? voyValueText(id, v) : arpExtra.text(id, v)),
  steps: (id: string): readonly string[] => (isVoy(id) ? (voyKnob(id).steps ?? []) : (extraParam(id)?.steps ?? [])),
  subscribe: (id: string) => (isVoy(id) ? voyParams.subscribe : arpExtra.subscribe),
};

/** L'index du cran d'une valeur. */
const stepOf = (id: string, v: number): number => {
  const n = SRC.steps(id).length;
  return n < 2 ? 0 : Math.max(0, Math.min(n - 1, Math.round(v * (n - 1))));
};

/* ---------------- ce qui colore le son ---------------- */

/**
 * Les reglages ajoutes dont la LED dit "agit" (loin de leur neutre, le depart du JSON, qui rend le son d'avant). Les
 * autres (vitesses, profondeurs d'un effet coupe...) n'ont pas de LED : seuls ils ne changent rien.
 */
const COLOURS: ReadonlySet<string> = new Set([
  'xRing', 'xFold', 'xNoiseColor', 'xHpf', 'xComb', 'xFeedback', 'xEqLow', 'xEqMid', 'xEqHigh', 'xEqAir', 'xWarmth', 'xBass', 'xAir', 'xWidth',
  'xDist', 'xPhMix', 'xFlMix', 'xCrushBits', 'xCrushRate', 'xPumpDepth', 'xShimmer', 'xHellMix', 'xSwing', 'xLfo1Depth2', 'xLfo2Depth',
]);
/** Sans effet tant que leur maitre est a zero : grises. */
const MASTER_OF: Readonly<Record<string, string>> = {
  xCombFb: 'xComb',
  xDistTone: 'xDist',
  xPhRate: 'xPhMix', xPhDepth: 'xPhMix', xPhFb: 'xPhMix',
  xFlRate: 'xFlMix', xFlDepth: 'xFlMix', xFlFb: 'xFlMix',
  xPumpRate: 'xPumpDepth', xPumpShape: 'xPumpDepth',
  xHellSync: 'xHellMix', xHellTime: 'xHellMix', xHellFb: 'xHellMix', xHellShift: 'xHellMix', xHellUpDown: 'xHellMix', xHellSpread: 'xHellMix',
  xHellLfoRate: 'xHellMix', xHellLfoDepth: 'xHellMix', xHellTone: 'xHellMix',
};
const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.0005;
/** La LED d'un reglage : null s'il n'en a pas, sinon allumee quand il colore le son. */
export const colours = (id: string, v: number): boolean | null => (COLOURS.has(id) ? !near(v, SRC.def(id)) : null);
/** Grise : son maitre est a zero (COMB FB sans COMB). */
export const inert = (id: string): boolean => {
  // TIME de HELL ne sert qu'en FREE
  if (id === 'xHellTime' && SRC.of('xHellSync') > 0) return true;
  const m = MASTER_OF[id];
  return m !== undefined && SRC.of(m) <= 0;
};

/* ---------------- ce qui est touche ---------------- */

let touched: string | null = null;
let touchTimer = 0;
const touchListeners = new Set<() => void>();
const emitTouch = (): void => touchListeners.forEach((fn) => fn());

/** Le reglage touche (survol, geste) : sa valeur remplace son designateur ; elle s'efface 1.4 s apres. */
export const pcbTouch = {
  get: (): string | null => touched,
  set(id: string, hold = false): void {
    window.clearTimeout(touchTimer);
    if (touched !== id) {
      touched = id;
      emitTouch();
    }
    if (!hold) touchTimer = window.setTimeout(() => pcbTouch.clear(id), 1400);
  },
  clear(id?: string): void {
    if (touched === null || (id && touched !== id)) return;
    window.clearTimeout(touchTimer);
    touched = null;
    emitTouch();
  },
  subscribe(fn: () => void): () => void {
    touchListeners.add(fn);
    return () => {
      touchListeners.delete(fn);
    };
  },
};

const useTouched = (id: string): boolean => useSyncExternalStore(pcbTouch.subscribe, () => pcbTouch.get() === id);
const useValue = (id: string): number => useSyncExternalStore(SRC.subscribe(id), () => SRC.of(id));
const useInert = (id: string): boolean => useSyncExternalStore(arpExtra.subscribe, () => inert(id));
const useArmed = (id: string): boolean => useSyncExternalStore(arpMidi.subscribe, () => arpMidi.get().learning && arpMidi.get().armed === id);
const learning = (): boolean => arpMidi.get().learning;

/** Le nom complet d'un reglage, pour l'afficheur (PHASER RATE, MATRIX 3 DEST...). */
const FULL: Record<string, string> = {};
export const setFullName = (id: string, name: string): void => {
  FULL[id] = name;
};
export const fullName = (id: string): string => FULL[id] ?? (isVoy(id) ? voyKnob(id).label : extraParam(id)?.label) ?? id;

/* ---------------- l'afficheur du bandeau ---------------- */

let lcdLine: { name: string; value: string } | null = null;
let lcdTimer = 0;
const lcdListeners = new Set<() => void>();
/** Ce que montre l'afficheur du bandeau (HoodBoard.tsx HoodLcd) : le reglage touche, 2.4 s ; null : le nom de la page. */
export const hoodLcd = {
  get: (): { name: string; value: string } | null => lcdLine,
  show(name: string, value: string, ms = 2400): void {
    window.clearTimeout(lcdTimer);
    lcdLine = { name, value };
    lcdListeners.forEach((fn) => fn());
    lcdTimer = window.setTimeout(() => {
      lcdLine = null;
      lcdListeners.forEach((fn) => fn());
    }, ms);
  },
  subscribe(fn: () => void): () => void {
    lcdListeners.add(fn);
    return () => {
      lcdListeners.delete(fn);
    };
  },
};

/** Le reglage sur l'afficheur du bandeau et sur l'ecran de la machine : son nom et sa valeur. */
export function say(id: string): void {
  hoodLcd.show(fullName(id), SRC.text(id));
  voyMsg.show(isVoy(id) ? voyReadout(id, voyParams.of(id)) : `${fullName(id)} ${SRC.text(id)}`, 2400);
}

function setValue(id: string, v: number, hold = false): void {
  SRC.set(id, v);
  pcbTouch.set(id, hold);
  say(id);
}

/** Un clic en MIDI LEARN : le reglage s'arme chez le C++ (il ne bouge pas). */
function tryLearn(id: string): boolean {
  if (!learning()) return false;
  arpBridge.learnArm(id);
  voyMsg.show(`MIDI LEARN ${fullName(id)}`, 1800);
  hoodLcd.show('MIDI LEARN', fullName(id), 1800);
  return true;
}

/** La molette sur un element (non passive : rien ne defile). */
function useWheel(ref: React.RefObject<Element | null>, onTicks: (ticks: number, fine: boolean) => void): void {
  const fn = useRef(onTicks);
  fn.current = onTicks;
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let acc = 0;
    const onWheel = (e: Event): void => {
      const w = e as WheelEvent;
      w.preventDefault();
      if (learning()) return;
      acc += w.deltaY;
      const t = Math.trunc(acc / 40);
      if (t === 0) return;
      acc -= t * 40;
      fn.current(-t, w.shiftKey);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref]);
}

/** L'echelle de la page a l'ecran (le cadre de 1100 x 704 mis a la taille de la fenetre). */
const pageScale = (el: HTMLElement | null): number => (el ? el.getBoundingClientRect().height / (el.offsetHeight || 1) || 1 : 1);

/* ---------------- le dessin ---------------- */

/** Les degrades et l'ombre communs (une fois par page). */
export const PcbDefs: React.FC = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <defs>
      {/* la jupe : de l'acier noirci, eclaire d'en haut a gauche */}
      <linearGradient id="mm-k-skirt" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor="#3b3b3c" />
        <stop offset="0.45" stopColor="#1a1a1b" />
        <stop offset="1" stopColor="#060606" />
      </linearGradient>
      {/* le flanc du capuchon */}
      <linearGradient id="mm-k-side" x1="0.25" y1="0" x2="0.75" y2="1">
        <stop offset="0" stopColor="#4a4a4b" />
        <stop offset="0.35" stopColor="#1c1c1d" />
        <stop offset="1" stopColor="#030303" />
      </linearGradient>
      {/* le dessus du capuchon, un peu bombe */}
      <radialGradient id="mm-k-top" cx="40%" cy="32%" r="75%">
        <stop offset="0" stopColor="#353536" />
        <stop offset="0.6" stopColor="#161617" />
        <stop offset="1" stopColor="#0a0a0a" />
      </radialGradient>
      <radialGradient id="mm-k-gloss" cx="38%" cy="26%" r="40%">
        <stop offset="0" stopColor="rgba(255,255,255,0.22)" />
        <stop offset="1" stopColor="rgba(255,255,255,0)" />
      </radialGradient>
      <filter id="mm-k-shadow" x="-40%" y="-40%" width="180%" height="190%">
        <feGaussianBlur stdDeviation="2.2" />
      </filter>
      {/* la touche noire de CHORUS */}
      <linearGradient id="mm-s-cap" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2a2928" />
        <stop offset="0.5" stopColor="#171615" />
        <stop offset="1" stopColor="#0c0b0b" />
      </linearGradient>
    </defs>
  </svg>
);

const DEG = Math.PI / 180;
const SWEEP = 135;
const KNOB_TICKS = Array.from({ length: 11 }, (_, i) => -SWEEP + (i * 2 * SWEEP) / 10);
const FLUTES = Array.from({ length: 24 }, (_, i) => i * 15);
const KNURL = Array.from({ length: 60 }, (_, i) => i * 6);

/**
 * Le potard en relief : ombre portee, jupe crantee, flanc et dessus du capuchon, 24 cannelures, le trait blanc ; la
 * lumiere ne tourne pas avec lui (reflets fixes), les cannelures et le trait tournent. size : le diametre de la jupe.
 */
export const KnobSvg: React.FC<{ angle: number; size?: number; ticks?: boolean }> = ({ angle, size = 46, ticks = true }) => {
  const V = 30;
  return (
    <svg className="mm-p2-knob-svg" width={size + 14} height={size + 14} viewBox={`${-V} ${-V} ${2 * V} ${2 * V}`} aria-hidden="true">
      {ticks &&
        KNOB_TICKS.map((a) => {
          const s = Math.sin(a * DEG);
          const c = -Math.cos(a * DEG);
          return <line key={a} x1={s * 25} y1={c * 25} x2={s * 28} y2={c * 28} className="mm-p2-tick" />;
        })}
      {/* l'ombre portee, decalee vers le bas */}
      <ellipse cx="1" cy="4" rx="21" ry="20.5" fill="rgba(0,0,0,0.75)" filter="url(#mm-k-shadow)" />
      {/* la jupe et son crantage */}
      <circle r="22" fill="url(#mm-k-skirt)" />
      <g transform={`rotate(${angle})`}>
        {KNURL.map((a) => (
          <line key={a} x1="0" y1="-19.6" x2="0" y2="-21.7" transform={`rotate(${a})`} stroke="rgba(0,0,0,0.75)" strokeWidth="1.1" />
        ))}
      </g>
      <circle r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
      {/* le flanc du capuchon */}
      <circle r="17.6" fill="#020202" />
      <circle r="17.2" fill="url(#mm-k-side)" />
      <g transform={`rotate(${angle})`}>
        {FLUTES.map((a) => (
          <line key={a} x1="0" y1="-13.6" x2="0" y2="-17" transform={`rotate(${a})`} stroke="rgba(0,0,0,0.7)" strokeWidth="1.6" strokeLinecap="round" />
        ))}
      </g>
      {/* le dessus, son reflet fixe, le trait */}
      <circle r="13.4" fill="url(#mm-k-top)" />
      <circle r="13.4" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
      <circle r="13.4" fill="url(#mm-k-gloss)" />
      <g transform={`rotate(${angle})`}>
        <line x1="0" y1="-3" x2="0" y2="-16.4" stroke="rgba(0,0,0,0.6)" strokeWidth="3.4" strokeLinecap="round" />
        <line x1="0" y1="-3.4" x2="0" y2="-16" stroke="#f4f1ea" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  );
};

/* ---------------- le potard ---------------- */

export interface CellProps {
  id: string;
  /** le nom serigraphie au-dessus */
  name: string;
  /** le designateur (RV20, SW4...) */
  ref_: string;
}

export const PcbKnob: React.FC<CellProps & { lo: string; hi: string; small?: boolean; big?: boolean }> = ({ id, name, ref_, lo, hi, small, big }) => {
  const v = useValue(id);
  const on = useTouched(id);
  const armed = useArmed(id);
  const dim = useInert(id);
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; v: number; pid: number } | null>(null);
  const led = colours(id, v);

  useWheel(el, (t, fine) => setValue(id, SRC.of(id) + t * (fine ? 0.005 : 0.02)));

  const onDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    el.current?.focus({ preventScroll: true });
    if (tryLearn(id)) return;
    // Alt / Cmd / Ctrl + clic : la valeur de depart (comme sur la face)
    if (e.altKey || e.metaKey || e.ctrlKey) {
      setValue(id, SRC.def(id));
      return;
    }
    drag.current = { y: e.clientY, v: SRC.of(id), pid: e.pointerId };
    pcbTouch.set(id, true);
    say(id);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* rien */
    }
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pid) return;
    // 160 px (a l'echelle de la page) pour toute la course ; Maj : quatre fois plus fin
    const dv = ((d.y - e.clientY) / pageScale(el.current) / 160) * (e.shiftKey ? 0.25 : 1);
    setValue(id, d.v + dv, true);
  };
  const onUp = (): void => {
    if (!drag.current) return;
    drag.current = null;
    pcbTouch.set(id, false);
  };
  const onKey = (e: React.KeyboardEvent): void => {
    const cur = SRC.of(id);
    const big_ = e.shiftKey ? 0.1 : 0.01;
    let next: number;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = cur + big_;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = cur - big_;
    else if (e.key === 'PageUp') next = cur + 0.1;
    else if (e.key === 'PageDown') next = cur - 0.1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 1;
    else if (e.key === 'Delete' || e.key === 'Backspace') next = SRC.def(id);
    else return;
    e.preventDefault();
    e.stopPropagation();
    if (!learning()) setValue(id, next);
  };
  const size = small ? 30 : big ? 54 : 40;

  return (
    <div className="mm-p2-cell mm-p2-knob" data-small={small ? '1' : undefined} data-big={big ? '1' : undefined} data-inert={dim ? '1' : undefined} data-x={id}>
      {!small && (
        <span className="mm-p2-name">
          {name}
          {led !== null && <i className="mm-p2-led mm-p2-name-led" data-on={led ? '1' : undefined} aria-hidden="true" />}
        </span>
      )}
      <div
        ref={el}
        className="mm-p2-knob-hit"
        role="slider"
        tabIndex={0}
        aria-label={fullName(id)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v * 100)}
        aria-valuetext={SRC.text(id, v)}
        data-armed={armed ? '1' : undefined}
        style={small ? { width: size + 14, height: size + 14, top: -2 } : { width: size + 14, height: size + 14, marginLeft: -(size + 14) / 2 }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
        onDoubleClick={() => !learning() && setValue(id, SRC.def(id))}
        onPointerEnter={() => pcbTouch.set(id)}
        onKeyDown={onKey}
      >
        <KnobSvg angle={-SWEEP + v * 2 * SWEEP} size={size} ticks={!small} />
      </div>
      {!small && (
        <span className="mm-p2-ends" aria-hidden="true">
          <span>{lo}</span>
          <span>{hi}</span>
        </span>
      )}
      {small ? (
        <span className="mm-p2-val" data-on={on ? '1' : undefined}>
          {SRC.text(id, v)}
        </span>
      ) : (
        <span className="mm-p2-ref" data-on={on ? '1' : undefined}>
          {on ? SRC.text(id, v) : ref_}
        </span>
      )}
    </div>
  );
};

/* ---------------- les reglages a crans ---------------- */

function useStepped(id: string): { idx: number; steps: readonly string[]; last: number; pick: (i: number, hold?: boolean) => void } {
  const v = useValue(id);
  const steps = SRC.steps(id);
  const last = Math.max(1, steps.length - 1);
  const idx = stepOf(id, v);
  const pick = (i: number, hold = false): void => setValue(id, Math.min(last, Math.max(0, i)) / last, hold);
  return { idx, steps, last, pick };
}

function steppedKey(e: React.KeyboardEvent, id: string, idx: number, last: number, pick: (i: number) => void): void {
  let i = idx;
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') i = idx + 1;
  else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') i = idx - 1;
  else if (e.key === 'Home') i = 0;
  else if (e.key === 'End') i = last;
  else if (e.key === 'Delete' || e.key === 'Backspace') i = stepOf(id, SRC.def(id));
  else return;
  e.preventDefault();
  e.stopPropagation();
  if (!learning()) pick(i);
}

/** Les pixels (a l'echelle de la page) d'un cran, en glissant. */
const STEP_PX = 14;

/**
 * Le glisser cran par cran d'un reglage a crans : vers le haut le cran suivant, vers le bas le precedent, sans boucler.
 * click : un appui relache sans avoir bouge (rien par defaut).
 */
function useStepDrag(id: string, idx: number, last: number, pick: (i: number, hold?: boolean) => void, click?: () => void) {
  const drag = useRef<{ y: number; i0: number; pid: number; moved: boolean } | null>(null);
  const [held, setHeld] = useState(false);
  const onPointerDown = (e: React.PointerEvent<HTMLElement>): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    if (tryLearn(id)) return;
    if (e.altKey || e.metaKey || e.ctrlKey) {
      pick(stepOf(id, SRC.def(id)));
      return;
    }
    drag.current = { y: e.clientY, i0: idx, pid: e.pointerId, moved: false };
    setHeld(true);
    pcbTouch.set(id, true);
    say(id);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* rien */
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>): void => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pid) return;
    const dy = (d.y - e.clientY) / pageScale(e.currentTarget);
    if (Math.abs(dy) >= 3) d.moved = true;
    const i = Math.max(0, Math.min(last, d.i0 + Math.trunc(dy / STEP_PX)));
    if (i !== stepOf(id, SRC.of(id))) pick(i, true);
  };
  const end = (): void => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setHeld(false);
    pcbTouch.set(id, false);
    if (!d.moved) click?.();
  };
  return { held, onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onLostPointerCapture: end };
}

/**
 * La touche a crans (deux a quatre), dessinee comme CHORUS sur la face : la touche noire rectangulaire en relief, une
 * LED par cran au-dessus (un ON / OFF : une seule, ON), leurs noms au-dessus des LED. Le cran choisi : sa LED allumee.
 */
export const PcbStep: React.FC<CellProps & { w?: number }> = ({ id, name, ref_, w }) => {
  const { idx, steps, last, pick } = useStepped(id);
  const armed = useArmed(id);
  const on = useTouched(id);
  const dim = useInert(id);
  const el = useRef<HTMLButtonElement>(null);
  useWheel(el, (t) => pick(stepOf(id, SRC.of(id)) + t));
  const onOff = steps.length === 2 && steps[0] === 'OFF';
  const toggle = steps.length === 2 ? () => pick(idx >= last ? 0 : 1) : undefined;
  const g = useStepDrag(id, idx, last, pick, toggle);
  const leds = onOff ? [{ text: steps[1], i: 1 }] : steps.map((text, i) => ({ text, i }));
  const width = w ?? Math.max(80, leds.length * 30 + 16);
  return (
    <div className="mm-p2-cell mm-p2-step" data-x={id} data-inert={dim ? '1' : undefined} style={{ width }}>
      <span className="mm-p2-name">{name}</span>
      <span className="mm-p2-step-leds" aria-hidden="true">
        {leds.map((l) => (
          <span key={l.text} className="mm-p2-step-led">
            <b>{l.text}</b>
            <i className="mm-p2-led" data-on={idx === l.i ? '1' : undefined} />
          </span>
        ))}
      </span>
      <button
        ref={el}
        type="button"
        className="mm-p2-step-key"
        role="slider"
        aria-label={`${fullName(id)}: ${steps[idx]}`}
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={idx}
        aria-valuetext={steps[idx]}
        data-armed={armed ? '1' : undefined}
        data-held={g.held ? '1' : undefined}
        data-toggle={toggle ? '1' : undefined}
        onPointerDown={g.onPointerDown}
        onPointerMove={g.onPointerMove}
        onPointerUp={g.onPointerUp}
        onPointerCancel={g.onPointerCancel}
        onLostPointerCapture={g.onLostPointerCapture}
        onPointerEnter={() => pcbTouch.set(id)}
        onKeyDown={(e) => {
          if (toggle && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            if (!learning()) toggle();
            return;
          }
          steppedKey(e, id, idx, last, pick);
        }}
      >
        <span className="mm-p2-step-cap" />
      </button>
      <span className="mm-p2-ref" data-on={on ? '1' : undefined}>
        {on ? steps[idx] : ref_}
      </span>
    </div>
  );
};

/**
 * L'afficheur a crans (plus de quatre crans) : le nom du cran dans une petite fenetre. Glisser verticalement : cran par
 * cran ; un clic sans glisser deroule toute la liste. Molette, fleches, Debut, Fin.
 */
export const PcbSelect: React.FC<CellProps & { w?: number; bare?: boolean; up?: boolean; cols?: number }> = ({ id, name, ref_, w = 112, bare, up, cols = 2 }) => {
  const { idx, steps, last, pick } = useStepped(id);
  const armed = useArmed(id);
  const on = useTouched(id);
  const dim = useInert(id);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLButtonElement>(null);
  useWheel(face, (t) => pick(stepOf(id, SRC.of(id)) + t));
  const g = useStepDrag(id, idx, last, pick, () => setOpen((o) => !o));

  useEffect(() => {
    if (!open) return undefined;
    const away = (e: PointerEvent): void => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  }, [open]);

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (!open) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((o) => !o);
      return;
    }
    steppedKey(e, id, idx, last, pick);
  };
  const rows = Math.ceil(steps.length / cols);

  const body = (
    <div ref={box} className="mm-p2-selbox" data-armed={armed ? '1' : undefined} onKeyDown={onKey} onPointerEnter={() => pcbTouch.set(id)}>
      <button
        ref={face}
        type="button"
        className="mm-p2-win"
        style={{ width: w }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${fullName(id)}: ${steps[idx]}`}
        data-off={idx === 0 && steps[0] === 'OFF' ? '1' : undefined}
        data-held={g.held ? '1' : undefined}
        onPointerDown={g.onPointerDown}
        onPointerMove={g.onPointerMove}
        onPointerUp={g.onPointerUp}
        onPointerCancel={g.onPointerCancel}
        onLostPointerCapture={g.onLostPointerCapture}
      >
        <span className="mm-p2-win-arrows" aria-hidden="true" />
        {SRC.text(id)}
      </button>
      {open && (
        <ul className="mm-p2-menu" role="listbox" aria-label={fullName(id)} data-up={up ? '1' : undefined} style={{ gridTemplateRows: `repeat(${rows}, auto)` }}>
          {steps.map((s, i) => (
            <li key={s} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={i === idx}
                data-on={i === idx ? '1' : undefined}
                onClick={() => {
                  pick(i);
                  setOpen(false);
                  face.current?.focus({ preventScroll: true });
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  if (bare) return body;
  return (
    <div className="mm-p2-cell mm-p2-sel" data-x={id} data-inert={dim ? '1' : undefined} style={{ width: w + 24 }}>
      <span className="mm-p2-name">{name}</span>
      {body}
      <span className="mm-p2-ref" data-on={on ? '1' : undefined}>
        {on ? `${idx + 1} / ${steps.length}` : ref_}
      </span>
    </div>
  );
};

/* ---------------- le cadre d'un groupe ---------------- */

export const PcbFrame: React.FC<{ title: string; x: number; y: number; w?: number; h?: number; children: React.ReactNode; className?: string; led?: boolean; flash?: boolean }> = ({ title, x, y, w, h, children, className, led, flash }) => (
  <section className={`mm-p2-frame${className ? ` ${className}` : ''}`} data-flash={flash ? '1' : undefined} style={{ left: x, top: y, width: w, height: h }} aria-label={title}>
    <span className="mm-p2-frame-title">
      {title}
      {led !== undefined && <i className="mm-p2-led" data-on={led ? '1' : undefined} aria-hidden="true" />}
    </span>
    {children}
  </section>
);

/* ---------------- la touche ---------------- */

/**
 * La touche de la face avant (CLEAR, RANDOM, EDIT, PRESET, OPEN de la machine 3D, voyager/pads.ts) redessinee en HTML :
 * un capuchon carre sombre en relief, son nom ecrit dessous en petites capitales. Allumee (on) : le capuchon en jaune
 * canard ; accent : le nom en jaune. w, h : la taille du capuchon (px du cadre de 1100 x 704).
 */
export type PcbKeyProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'name'> & {
  name: React.ReactNode;
  on?: boolean;
  accent?: boolean;
  w?: number;
  h?: number;
  /** ce qui est grave sur le capuchon (la poignee de DRAG MIDI, une fleche) */
  cap?: React.ReactNode;
};

export const PcbKey = React.forwardRef<HTMLButtonElement, PcbKeyProps>(({ name, on, accent, w = 44, h = 26, cap, className, style, ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    {...rest}
    className={`mm-key${className ? ` ${className}` : ''}`}
    data-on={on ? '1' : undefined}
    data-accent={accent ? '1' : undefined}
    style={{ ...style, ['--kw' as string]: `${w}px`, ['--kh' as string]: `${h}px` }}
  >
    <span className="mm-key-cap" aria-hidden="true">
      {cap}
    </span>
    <span className="mm-key-name">{name}</span>
  </button>
));
PcbKey.displayName = 'PcbKey';
