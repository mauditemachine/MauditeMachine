/**
 * Les pieces du capot du MM-ARP (HoodBoard.tsx), habillees comme la face avant (2026-11-16, Mika : "la face avant a un
 * look Moog retro, les pages OPEN font VST moderne ; on doit croire que c'est un deuxieme panneau du meme synthe").
 *
 * - PcbKnob : LE potard de la face : son image rendue par la scene elle-meme (retro/knob.png : le potard HELL de la face
 *   sans son repere, sous la lumiere de la machine, plugin/arp/hellKnob.tsx ?knobshot), et son repere blanc dessine
 *   par-dessus, qui tourne autour du centre du capuchon (KNOB_IMG). Son nom dessous, serigraphie comme la face ; ses
 *   bouts de course en petit de part et d'autre. Un reglage sans effet tant qu'un autre est a zero (COMB FB sans COMB)
 *   est grise.
 * - PcbStep (deux a quatre crans) : la touche de CHORUS de la face (retro/key.png), une LED rouge-orange par cran
 *   au-dessus, leurs noms au-dessus des LED. Glisser vertical, cran par cran ; un clic sans glisser ne change rien,
 *   sauf une touche a deux crans (ON / OFF) : un poussoir, un clic bascule.
 * - PcbRotary (cinq a sept crans) : le petit commutateur rotatif de la face (MODE du filtre), ses crans ecrits autour ;
 *   glisser vertical, cran par cran.
 * - PcbSelect (plus de sept crans) : une fenetre de verre noir, comme l'ecran de la face ; glisser vertical, cran par
 *   cran ; un clic sans glisser deroule la liste.
 * - PcbKey : la touche noire de la face, sa LED rouge-orange au-dessus quand elle est allumee.
 *
 * Deux sources, memes pieces : un reglage du VST3 seul (extra.ts, arpExtra) ou un TWEAK du site (voyager/params.ts,
 * voyParams). Le reglage touche s'ecrit dans la fenetre du bandeau (hoodLcd) et sur l'ecran de la face (voyMsg).
 * Potard : glisser vertical (Maj : fin), molette, double-clic ou Alt / Cmd / Ctrl + clic = la valeur de depart, fleches
 * (Maj : x10), Debut, Fin, Suppr. En MIDI LEARN, un clic arme le reglage (arpBridge.learnArm) sans le bouger.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { voyMsg } from '../../voyager/msg';
import { arpBridge } from './bridge';
import { voyKnob, voyParams, voyReadout, voyValueText, VOY_KNOB_IDS, type VoyKnobId } from '../../voyager/params';
import { arpExtra, extraParam, isExtra } from './extra';
import { arpMidi } from './midimap';
import { arpMod, MOD_HEAD, MOD_ORANGE, modArcPaths } from './modview';
import { skyLabel, skySteps, skyTypeIndex } from './skyModel';

/* ---------------- la source d'un reglage ---------------- */

const isVoy = (id: string): id is VoyKnobId => !isExtra(id) && (VOY_KNOB_IDS as readonly string[]).includes(id);

/**
 * Un reglage vu par une page sans etre un parametre (2026-11-17 : HELL, DELAY qui suit SYNC, le levier SYNC ; hell.ts) :
 * il lit et ecrit des reglages du VST3 seul (arpExtra). Pas de MIDI LEARN (l'hote ne le connait pas).
 */
export interface VirtualSrc {
  of: () => number;
  def: () => number;
  set: (v: number) => void;
  text: (v: number) => string;
  steps?: readonly string[];
  name?: string;
}
const VIRT = new Map<string, VirtualSrc>();
export const registerVirtual = (id: string, v: VirtualSrc): void => {
  VIRT.set(id, v);
};
const virt = (id: string): VirtualSrc | undefined => VIRT.get(id);

/** La valeur, la valeur de depart, le texte, les crans d'un reglage, ou qu'il vive. */
export const SRC = {
  of: (id: string): number => virt(id)?.of() ?? (isVoy(id) ? voyParams.of(id) : arpExtra.of(id)),
  def: (id: string): number => virt(id)?.def() ?? (isVoy(id) ? voyParams.def(id) : arpExtra.def(id)),
  set: (id: string, v: number): void => {
    const vs = virt(id);
    if (vs) vs.set(Math.min(1, Math.max(0, v)));
    else if (isVoy(id)) voyParams.set(id, Math.min(1, Math.max(0, v)));
    else arpExtra.set(id, v);
  },
  text: (id: string, v: number = SRC.of(id)): string => virt(id)?.text(v) ?? (isVoy(id) ? voyValueText(id, v) : arpExtra.text(id, v)),
  // les places de la reverbe facon BigSky : leurs crans sont ceux de la machine du moment (skyModel.ts)
  steps: (id: string): readonly string[] =>
    virt(id) ? (virt(id)?.steps ?? []) : isVoy(id) ? (voyKnob(id).steps ?? []) : (skySteps(skyTypeIndex(arpExtra.of('xSkyType')), id) ?? extraParam(id)?.steps ?? []),
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
export const fullName = (id: string): string => {
  const vn = VIRT.get(id)?.name;
  if (vn) return vn;
  // la reverbe facon BigSky : le nom depend de la machine (DECAY, TIME ou SIZE ; PRE-DELAY ou FEEDBACK ; ses places)
  const sky = id.startsWith('xSky') ? skyLabel(skyTypeIndex(arpExtra.of('xSkyType')), id) : null;
  if (sky) return `REVERB ${sky}`;
  return FULL[id] ?? (isVoy(id) ? voyKnob(id).label : extraParam(id)?.label) ?? id;
};

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
  voyMsg.show(isVoy(id) ? voyReadout(id, voyParams.of(id)).replace(/^OVERDRIVE/, 'DISTO') : `${fullName(id)} ${SRC.text(id)}`, 2400);
}

function setValue(id: string, v: number, hold = false): void {
  SRC.set(id, v);
  pcbTouch.set(id, hold);
  say(id);
}

/** Un clic en MIDI LEARN : le reglage s'arme chez le C++ (il ne bouge pas). */
function tryLearn(id: string): boolean {
  if (!learning()) return false;
  // un reglage virtuel (hell.ts) : rien a apprendre, le geste est simplement avale
  if (VIRT.has(id)) return true;
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

/** Plus rien a definir une fois par page (gardee pour HoodBoard). */
export const PcbDefs: React.FC = () => null;

const DEG = Math.PI / 180;
const SWEEP = 135;

/**
 * L'image du potard de la face (retro/knob.png, 260 px pour 52 px de page) : le potard du MM-RYTM (voyager/rytmKnob.ts :
 * la base, la prise a six lobes, le capuchon de metal brosse) sans son repere, vu exactement de dessus (2026-11-16, Mika :
 * "on dirait qu'ils sont deformes sur le bas" : l'image d'avant venait de la camera inclinee de la face, capuchon
 * decentre). Rendu par three.js, camera orthographique dans l'axe du potard, la boite = la base + 4 % : base, prise et
 * capuchon concentriques autour de (cx, cy). Le repere part du bord du capuchon (r0 : 0.62 de la base) et passe sur la
 * prise jusqu'a r1 (pres du bout des lobes), large de w ; le capuchon (retro/knob-cap.png) repasse par-dessus son pied.
 */
export const KNOB_IMG = { box: 52, cx: 26, cy: 26, r0: 15.2, r1: 22, w: 3 } as const;

/** Le potard de la face : son image, son repere a l'angle (degres, 0 en haut), son capuchon. k : l'echelle. */
export const RetroKnob: React.FC<{ angle: number; k?: number }> = ({ angle, k = 1 }) => {
  const K = KNOB_IMG;
  return (
    <span className="mm-r-knob" style={{ width: K.box * k, height: K.box * k }} aria-hidden="true">
      <span className="mm-r-knob-img" />
      <span className="mm-r-knob-axis" style={{ left: K.cx * k, top: K.cy * k, transform: `rotate(${angle}deg)` }}>
        <span className="mm-r-knob-mark" style={{ left: (-K.w * k) / 2, top: -K.r1 * k, width: K.w * k, height: (K.r1 - K.r0) * k }} />
      </span>
      <span className="mm-r-knob-cap" />
    </span>
  );
};

/**
 * Le petit knob fin (2026-11-17, Mika : le petit knob AMT de la matrice de Legend HZ) : une prise noire cannelee vue de
 * dessus (retro/fine-knob.png, rendue par three.js : son chanfrein, son vernis, ses reflets), un repere blanc fin qui part
 * du centre, une couronne de graduations blanches fines autour (onze, 0 / 5 / 10 plus longues). Pour les reglages
 * secondaires ; les potards du MM-RYTM restent pour les principaux.
 */
export const FINE_KNOB = { box: 44, r: 13, t0: 16, t1: 19, m0: 4, m1: 11.6, w: 1.7 } as const;
const FINE_TICKS = Array.from({ length: 11 }, (_, i) => {
  const a = ((-SWEEP + (2 * SWEEP * i) / 10) * Math.PI) / 180;
  const c = FINE_KNOB.box / 2;
  const t1 = i % 5 === 0 ? FINE_KNOB.t1 + 1.2 : FINE_KNOB.t1;
  return { x1: c + Math.sin(a) * FINE_KNOB.t0, y1: c - Math.cos(a) * FINE_KNOB.t0, x2: c + Math.sin(a) * t1, y2: c - Math.cos(a) * t1, major: i % 5 === 0 };
});
export const FineKnob: React.FC<{ angle: number }> = ({ angle }) => {
  const F = FINE_KNOB;
  const c = F.box / 2;
  const img = F.r * 2 * 1.12;
  return (
    <span className="mm-fk" style={{ width: F.box, height: F.box }} aria-hidden="true">
      <svg className="mm-fk-ticks" width={F.box} height={F.box} viewBox={`0 0 ${F.box} ${F.box}`}>
        {FINE_TICKS.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} data-major={t.major ? '1' : undefined} />
        ))}
      </svg>
      <span className="mm-fk-img" style={{ left: c - img / 2, top: c - img / 2, width: img, height: img }} />
      <span className="mm-fk-axis" style={{ left: c, top: c, transform: `rotate(${angle}deg)` }}>
        <span className="mm-fk-mark" style={{ left: -F.w / 2, top: -F.m1, width: F.w, height: F.m1 - F.m0 }} />
      </span>
    </span>
  );
};

/**
 * L'arc lumineux d'un potard d'OPEN module (modview.ts, la maquette A) : autour du pied du potard de l'image, sur ses
 * 270 degres ; rien quand il n'est pas module.
 */
const KnobModArc: React.FC<{ id: string; k: number; fine?: boolean }> = ({ id, k, fine }) => {
  const m = useSyncExternalStore(arpMod.subscribe, () => arpMod.of(id));
  if (!m) return null;
  const box = (fine ? FINE_KNOB.box : KNOB_IMG.box) * k;
  const cx = (fine ? FINE_KNOB.box / 2 : 26) * k;
  const cy = cx;
  const R = (fine ? FINE_KNOB.t1 + 2.5 : 27) * k;
  const at = (v: number): readonly [number, number] => {
    const a = ((-SWEEP + 2 * SWEEP * Math.min(1, Math.max(0, v))) * Math.PI) / 180;
    return [cx + Math.sin(a) * R, cy - Math.cos(a) * R];
  };
  const a = modArcPaths(m, at, 3);
  return (
    <svg className="mm-mod-arc" data-id={id} width={box} height={box} viewBox={`0 0 ${box} ${box}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden="true">
      <path d={a.range} stroke={MOD_ORANGE} strokeOpacity={0.22} strokeWidth={3} fill="none" strokeLinecap="round" />
      {a.trail.map((s, i) => (
        <path key={i} d={s.d} stroke={MOD_ORANGE} strokeOpacity={s.o} strokeWidth={3.2} fill="none" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 2px rgba(255,106,42,0.8))' }} />
      ))}
      <circle cx={a.head[0]} cy={a.head[1]} r={2.4} fill={MOD_HEAD} style={{ filter: 'drop-shadow(0 0 2.5px rgba(255,160,100,0.9))' }} />
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

export const PcbKnob: React.FC<CellProps & { lo: string; hi: string; small?: boolean; big?: boolean; fine?: boolean; hero?: number }> = ({ id, name, ref_, lo, hi, small, big, fine, hero }) => {
  const v = useValue(id);
  const on = useTouched(id);
  const armed = useArmed(id);
  const dim = useInert(id);
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; v: number; pid: number } | null>(null);

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
  // le petit knob fin (FineKnob) : les reglages secondaires et la matrice (small)
  const thin = fine || small;
  // hero : un potard en vedette (le FREQUENCY SHIFTER de HELL), a cette echelle
  const k = hero ?? (big ? 1.3 : 1);
  const box = thin ? FINE_KNOB.box : KNOB_IMG.box * k;

  return (
    <div className="mm-p2-cell mm-p2-knob" data-small={small ? '1' : undefined} data-big={big ? '1' : undefined} data-fine={fine ? '1' : undefined} data-hero={hero ? '1' : undefined} data-inert={dim ? '1' : undefined} data-x={id}>
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
        style={small ? { width: box, height: box } : { width: box, height: box, marginLeft: -box / 2 }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
        onDoubleClick={() => !learning() && setValue(id, SRC.def(id))}
        onPointerEnter={() => pcbTouch.set(id)}
        onKeyDown={onKey}
      >
        {thin ? <FineKnob angle={-SWEEP + v * 2 * SWEEP} /> : <RetroKnob angle={-SWEEP + v * 2 * SWEEP} k={k} />}
        <KnobModArc id={id} k={thin ? 1 : k} fine={thin} />
      </div>
      {!thin && (
        <span className="mm-p2-ends" aria-hidden="true">
          <span>{lo}</span>
          <span>{hi}</span>
        </span>
      )}
      {!small && (
        <span className="mm-p2-name">
          {name}
        </span>
      )}
      {small ? (
        <span className="mm-p2-val" data-on={on ? '1' : undefined}>
          {SRC.text(id, v)}
        </span>
      ) : (
        <span className="mm-p2-ref" data-on={on ? '1' : undefined}>
          {on ? SRC.text(id, v) : ''}
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
 * La touche a crans (trois ou quatre crans, 2026-11-17, Mika : "pas comme un knob") : la touche noire de la face, une LED
 * par cran au-dessus, leurs noms au-dessus des LED. Un clic passe au cran suivant, en boucle (la LED suit, la touche
 * s'enfonce) ; un clic sur un nom ou une LED choisit ce cran. Plus de glisser ni de molette : rien ne change par erreur
 * (un appui qui bouge de plus de 4 px ne fait rien). Fleches, Debut, Fin, Suppr au clavier. Deux crans : le levier
 * (PcbToggle).
 */
export const PcbStep: React.FC<CellProps & { w?: number }> = (props) => {
  const steps = SRC.steps(props.id);
  return steps.length === 2 ? <PcbToggle {...props} /> : <PcbStepKeys {...props} />;
};

/** Un appui sans glisser (moins de 4 px a l'echelle de la page) : click() au lacher. */
function useClickOnly(id: string, click: () => void) {
  const down = useRef<{ x: number; y: number; pid: number; moved: boolean } | null>(null);
  const [held, setHeld] = useState(false);
  const end = (fire: boolean): void => {
    const d = down.current;
    if (!d) return;
    down.current = null;
    setHeld(false);
    pcbTouch.set(id, false);
    if (fire && !d.moved && !learning()) click();
  };
  return {
    held,
    onPointerDown: (e: React.PointerEvent<HTMLElement>): void => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.focus({ preventScroll: true });
      if (tryLearn(id)) return;
      if (e.altKey || e.metaKey || e.ctrlKey) {
        setValue(id, SRC.def(id));
        return;
      }
      down.current = { x: e.clientX, y: e.clientY, pid: e.pointerId, moved: false };
      setHeld(true);
      pcbTouch.set(id, true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* rien */
      }
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>): void => {
      const d = down.current;
      if (!d || d.pid !== e.pointerId) return;
      const k = pageScale(e.currentTarget);
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) / k > 4) {
        d.moved = true;
        setHeld(false);
      }
    },
    onPointerUp: (): void => end(true),
    onPointerCancel: (): void => end(false),
    onLostPointerCapture: (): void => end(false),
  };
}

const PcbStepKeys: React.FC<CellProps & { w?: number }> = ({ id, name, w }) => {
  const { idx, steps, last, pick } = useStepped(id);
  const armed = useArmed(id);
  const on = useTouched(id);
  const dim = useInert(id);
  const next = (): void => pick(idx >= last ? 0 : idx + 1);
  const g = useClickOnly(id, next);
  const width = w ?? Math.max(80, steps.length * 30 + 16);
  const choose = (i: number) => (e: React.MouseEvent): void => {
    e.preventDefault();
    if (tryLearn(id) || learning()) return;
    pick(i);
  };
  return (
    <div className="mm-p2-cell mm-p2-step" data-x={id} data-inert={dim ? '1' : undefined} style={{ width }}>
      <span className="mm-p2-name">{name}</span>
      <span className="mm-p2-step-leds">
        {steps.map((text, i) => (
          <span key={text} className="mm-p2-step-led" data-pick="1" onClick={choose(i)} title={text}>
            <b>{text}</b>
            <i className="mm-p2-led" data-on={idx === i ? '1' : undefined} />
          </span>
        ))}
      </span>
      <button
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
        onPointerDown={g.onPointerDown}
        onPointerMove={g.onPointerMove}
        onPointerUp={g.onPointerUp}
        onPointerCancel={g.onPointerCancel}
        onLostPointerCapture={g.onLostPointerCapture}
        onPointerEnter={() => pcbTouch.set(id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!learning()) next();
            return;
          }
          steppedKey(e, id, idx, last, pick);
        }}
      >
        <span className="mm-p2-step-cap" />
      </button>
      <span className="mm-p2-ref" data-on={on ? '1' : undefined}>
        {on ? steps[idx] : ''}
      </span>
    </div>
  );
};

/**
 * Le levier (deux crans, 2026-11-17, Mika : "l'interrupteur a levier metal") : un boitier noir horizontal, un levier
 * chrome qui glisse a gauche ou a droite (retro/toggle-body.png, toggle-lever.png : rendus par three.js, vus de dessus),
 * une LED ronde a cote, allumee sur le cran de droite (ON, NEG, HQ...), les deux crans ecrits dessous. Un clic bascule ;
 * un clic sur un nom choisit ce cran ; Espace, Entree, fleches.
 */
export const PcbToggle: React.FC<CellProps & { w?: number }> = ({ id, name, w }) => {
  const { idx, steps, pick } = useStepped(id);
  const armed = useArmed(id);
  const on = useTouched(id);
  const dim = useInert(id);
  const flip = (): void => pick(idx >= 1 ? 0 : 1);
  const g = useClickOnly(id, flip);
  const right = idx >= 1;
  const choose = (i: number) => (e: React.MouseEvent): void => {
    e.preventDefault();
    if (tryLearn(id) || learning()) return;
    pick(i);
  };
  return (
    <div className="mm-p2-cell mm-p2-tog" data-x={id} data-inert={dim ? '1' : undefined} style={{ width: w ?? 84 }}>
      <button
        type="button"
        className="mm-p2-tog-sw"
        role="switch"
        aria-checked={right}
        aria-label={`${fullName(id)}: ${steps[idx]}`}
        data-on={right ? '1' : undefined}
        data-armed={armed ? '1' : undefined}
        data-held={g.held ? '1' : undefined}
        onPointerDown={g.onPointerDown}
        onPointerMove={g.onPointerMove}
        onPointerUp={g.onPointerUp}
        onPointerCancel={g.onPointerCancel}
        onLostPointerCapture={g.onLostPointerCapture}
        onPointerEnter={() => pcbTouch.set(id)}
        onKeyDown={(e) => {
          if (learning()) return;
          if (e.key === 'Enter' || e.key === ' ') flip();
          else if (e.key === 'Home') pick(0);
          else if (e.key === 'End') pick(1);
          else return;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <span className="mm-p2-tog-body" aria-hidden="true" />
        <span className="mm-p2-tog-lever" aria-hidden="true" />
      </button>
      <i className="mm-p2-led mm-p2-tog-led" data-on={right ? '1' : undefined} aria-hidden="true" />
      <span className="mm-p2-tog-names">
        <b data-on={!right ? '1' : undefined} onClick={choose(0)}>
          {steps[0]}
        </b>
        <b data-on={right ? '1' : undefined} onClick={choose(1)}>
          {steps[1]}
        </b>
      </span>
      <span className="mm-p2-name">{name}</span>
      <span className="mm-p2-ref" data-on={on ? '1' : undefined}>
        {on ? steps[idx] : ''}
      </span>
    </div>
  );
};

/**
 * Le commutateur rotatif de la face (MODE du filtre : un petit potard, ses crans ecrits autour, un trait par cran) pour
 * cinq a sept crans. Glisser vertical, cran par cran ; molette, fleches.
 */
export const PcbRotary: React.FC<CellProps & { w?: number }> = ({ id, name, w = 108 }) => {
  const { idx, steps, last, pick } = useStepped(id);
  const armed = useArmed(id);
  const on = useTouched(id);
  const dim = useInert(id);
  const el = useRef<HTMLDivElement>(null);
  useWheel(el, (t) => pick(stepOf(id, SRC.of(id)) + t));
  const g = useStepDrag(id, idx, last, pick);
  const n = steps.length;
  const spread = n <= 3 ? 110 : n <= 5 ? 150 : 210;
  const angles = steps.map((_, i) => -spread / 2 + (i * spread) / Math.max(1, n - 1));
  const k = 0.74;
  const box = KNOB_IMG.box * k;
  // le centre des crans : le pied du potard (sous le centre du capuchon de l'image)
  const cx = w / 2;
  const cy = 12 + box / 2 + 1;
  const R = box / 2 + 9;
  return (
    <div className="mm-p2-cell mm-p2-rot" data-x={id} data-inert={dim ? '1' : undefined} style={{ width: w }}>
      <svg className="mm-p2-rot-ticks" width={w} height={70} aria-hidden="true">
        {angles.map((a, i) => (
          <line key={i} x1={cx + Math.sin(a * DEG) * (R - 6)} y1={cy - Math.cos(a * DEG) * (R - 6)} x2={cx + Math.sin(a * DEG) * (R - 2)} y2={cy - Math.cos(a * DEG) * (R - 2)} data-on={i === idx ? '1' : undefined} />
        ))}
      </svg>
      {steps.map((s, i) => {
        const a = angles[i] * DEG;
        const x = cx + Math.sin(a) * (R + 3);
        const y = cy - Math.cos(a) * (R + 3);
        const side = Math.abs(x - cx) < 4 ? 'c' : x < cx ? 'l' : 'r';
        return (
          <span key={s} className="mm-p2-rot-pos" data-side={side} data-on={i === idx ? '1' : undefined} style={{ left: x, top: y }} aria-hidden="true">
            {s}
          </span>
        );
      })}
      <div
        ref={el}
        className="mm-p2-knob-hit mm-p2-rot-hit"
        role="slider"
        tabIndex={0}
        aria-label={`${fullName(id)}: ${steps[idx]}`}
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={idx}
        aria-valuetext={steps[idx]}
        data-armed={armed ? '1' : undefined}
        style={{ width: box, height: box, left: cx - box / 2, marginLeft: 0, top: 12 }}
        onPointerDown={g.onPointerDown}
        onPointerMove={g.onPointerMove}
        onPointerUp={g.onPointerUp}
        onPointerCancel={g.onPointerCancel}
        onLostPointerCapture={g.onLostPointerCapture}
        onPointerEnter={() => pcbTouch.set(id)}
        onKeyDown={(e) => steppedKey(e, id, idx, last, pick)}
      >
        <RetroKnob angle={angles[idx] ?? 0} k={k} />
      </div>
      <span className="mm-p2-name">{name}</span>
      <span className="mm-p2-ref" data-on={on ? '1' : undefined}>
        {on ? steps[idx] : ''}
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
        {on ? `${idx + 1} / ${steps.length}` : ''}
      </span>
    </div>
  );
};

/* ---------------- le cadre d'un groupe ---------------- */

export const PcbFrame: React.FC<{ title: string; x: number; y: number; w?: number; h?: number; children: React.ReactNode; className?: string; led?: boolean; flash?: boolean; sep?: boolean }> = ({ title, x, y, w, h, children, className, led, flash, sep }) => (
  <section className={`mm-p2-frame${className ? ` ${className}` : ''}`} data-flash={flash ? '1' : undefined} data-sep={sep ? '1' : undefined} style={{ left: x, top: y, width: w, height: h }} aria-label={title}>
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
    {on !== undefined && <i className="mm-key-led" data-on={on ? '1' : undefined} aria-hidden="true" />}
    <span className="mm-key-cap" aria-hidden="true">
      {cap}
    </span>
    <span className="mm-key-name">{name}</span>
  </button>
));
PcbKey.displayName = 'PcbKey';
