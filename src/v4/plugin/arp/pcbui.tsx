/**
 * Les pieces de la carte noire du capot (HoodBoard.tsx), dessinees comme les TWEAKS de la carte verte du site
 * (scene/tweakplate.ts) : le potard de precision (capuchon noir moletee, son trait blanc, sa rondelle d'aluminium, l'arc
 * de graduations), le commutateur a glissiere, le selecteur rotatif et ses crans ecrits autour, et, pour un reglage a
 * crans trop nombreux pour un rotatif lisible, un petit afficheur entre deux touches. Serigraphie : le nom au-dessus,
 * les bouts de course dessous, le designateur (RV20, SW4...) tout en bas ; un cadre fin par groupe, son titre dans
 * l'encoche.
 *
 * Deux sources, memes pieces (2026-11-13) : un reglage du VST3 seul (extra.ts, arpExtra) ou un TWEAK du site
 * (voyager/params.ts, voyParams : les potards de l'ancienne carte verte). Le pont (bridge.ts) envoie mm_param et
 * mm_gesture pour l'un comme pour l'autre, aux memes ids. Le reglage touche s'ecrit sur l'ecran de la machine (voyMsg : la ligne du bas du LCD, qu'on
 * voit par la decoupe du capot) et, en orange, a la place du designateur.
 *
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
const SRC = {
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
const useArmed = (id: string): boolean => useSyncExternalStore(arpMidi.subscribe, () => arpMidi.get().learning && arpMidi.get().armed === id);
const learning = (): boolean => arpMidi.get().learning;

/** Le nom complet d'un reglage, pour l'ecran (PHASER RATE, MATRIX 3 DEST...). */
const FULL: Record<string, string> = {};
export const setFullName = (id: string, name: string): void => {
  FULL[id] = name;
};
export const fullName = (id: string): string => FULL[id] ?? (isVoy(id) ? voyKnob(id).label : extraParam(id)?.label) ?? id;

/** Le reglage sur l'ecran de la machine : son nom et sa valeur. */
function say(id: string): void {
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

/* ---------------- le dessin ---------------- */

/** Les degrades communs (une fois par page). */
export const PcbDefs: React.FC = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <defs>
      <radialGradient id="mm-p2-washer" cx="50%" cy="38%" r="62%">
        <stop offset="0" stopColor="#d2d2cf" />
        <stop offset="0.6" stopColor="#9a9a97" />
        <stop offset="1" stopColor="#5d5d5b" />
      </radialGradient>
      <radialGradient id="mm-p2-cap" cx="45%" cy="32%" r="70%">
        <stop offset="0" stopColor="#3a3a3a" />
        <stop offset="0.55" stopColor="#151515" />
        <stop offset="1" stopColor="#050505" />
      </radialGradient>
    </defs>
  </svg>
);

const DEG = Math.PI / 180;

/** Le capuchon, sa rondelle et son trait ; ticks : les graduations (angles en degres, 0 en haut). */
const KnobSvg: React.FC<{ angle: number; ticks: readonly number[]; size?: number; lit?: number }> = ({ angle, ticks, size = 46, lit }) => (
  <svg className="mm-p2-knob-svg" width={size} height={size} viewBox="-23 -23 46 46" aria-hidden="true">
    {ticks.map((a, i) => {
      const s = Math.sin(a * DEG);
      const c = -Math.cos(a * DEG);
      return <line key={a} x1={s * 19.2} y1={c * 19.2} x2={s * 22} y2={c * 22} className="mm-p2-tick" data-lit={i === lit ? '1' : undefined} />;
    })}
    <circle r="16.2" fill="url(#mm-p2-washer)" />
    <circle r="16.2" fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="0.6" />
    <circle r="13.1" fill="#070707" />
    <circle r="12.7" fill="url(#mm-p2-cap)" />
    <circle r="12.1" fill="none" stroke="#2b2b2b" strokeWidth="1.1" strokeDasharray="0.85 0.85" />
    <g transform={`rotate(${angle})`}>
      <line x1="0" y1="-3.4" x2="0" y2="-10.6" stroke="#f3f0e9" strokeWidth="2.1" strokeLinecap="round" />
    </g>
  </svg>
);

const SWEEP = 135;
const KNOB_TICKS = Array.from({ length: 11 }, (_, i) => -SWEEP + (i * 2 * SWEEP) / 10);

/* ---------------- le potard ---------------- */

export interface CellProps {
  id: string;
  /** le nom serigraphie au-dessus */
  name: string;
  /** le designateur (RV20, SW4...) */
  ref_: string;
}

export const PcbKnob: React.FC<CellProps & { lo: string; hi: string; small?: boolean }> = ({ id, name, ref_, lo, hi, small }) => {
  const v = useValue(id);
  const on = useTouched(id);
  const armed = useArmed(id);
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; v: number; pid: number } | null>(null);

  useWheel(el, (t, fine) => setValue(id, SRC.of(id) + t * (fine ? 0.005 : 0.02)));

  const onDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    el.current?.focus({ preventScroll: true });
    if (tryLearn(id)) return;
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
    const scale = el.current ? el.current.getBoundingClientRect().width / el.current.offsetWidth || 1 : 1;
    const dv = ((d.y - e.clientY) / scale / 160) * (e.shiftKey ? 0.25 : 1);
    setValue(id, d.v + dv, true);
  };
  const onUp = (): void => {
    if (!drag.current) return;
    drag.current = null;
    pcbTouch.set(id, false);
  };
  const onKey = (e: React.KeyboardEvent): void => {
    const cur = SRC.of(id);
    const big = e.shiftKey ? 0.1 : 0.01;
    let next: number;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = cur + big;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = cur - big;
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

  return (
    <div className="mm-p2-cell mm-p2-knob" data-small={small ? '1' : undefined} data-x={id}>
      {!small && <span className="mm-p2-name">{name}</span>}
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
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
        onDoubleClick={() => !learning() && setValue(id, SRC.def(id))}
        onPointerEnter={() => pcbTouch.set(id)}
        onKeyDown={onKey}
      >
        <KnobSvg angle={-SWEEP + v * 2 * SWEEP} ticks={KNOB_TICKS} size={small ? 38 : 46} />
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

function useStepped(id: string): { idx: number; steps: readonly string[]; last: number; pick: (i: number) => void } {
  const v = useValue(id);
  const steps = SRC.steps(id);
  const last = Math.max(1, steps.length - 1);
  const idx = stepOf(id, v);
  const pick = (i: number): void => setValue(id, Math.min(last, Math.max(0, i)) / last);
  return { idx, steps, last, pick };
}

function steppedKey(e: React.KeyboardEvent, id: string, idx: number, last: number, pick: (i: number) => void, wrap = false): void {
  let i = idx;
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') i = wrap && idx >= last ? 0 : idx + 1;
  else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') i = wrap && idx <= 0 ? last : idx - 1;
  else if (e.key === 'Home') i = 0;
  else if (e.key === 'End') i = last;
  else if (e.key === 'Delete' || e.key === 'Backspace') i = stepOf(id, SRC.def(id));
  else return;
  e.preventDefault();
  e.stopPropagation();
  if (!learning()) pick(i);
}

/** Le commutateur a glissiere (deux crans) : les deux noms au-dessus, le cran choisi en orange. */
export const PcbSwitch: React.FC<CellProps> = ({ id, name, ref_ }) => {
  const { idx, steps, last, pick } = useStepped(id);
  const armed = useArmed(id);
  const on = useTouched(id);
  return (
    <div className="mm-p2-cell mm-p2-sw" data-x={id}>
      <span className="mm-p2-name">{name}</span>
      <span className="mm-p2-sw-pos">
        {steps.map((s, i) => (
          <button key={s} type="button" tabIndex={-1} data-on={i === idx ? '1' : undefined} onClick={() => !tryLearn(id) && pick(i)}>
            {s}
          </button>
        ))}
      </span>
      <button
        type="button"
        className="mm-p2-sw-body"
        role="switch"
        aria-checked={idx === last}
        aria-label={`${fullName(id)}: ${steps[idx]}`}
        data-armed={armed ? '1' : undefined}
        data-idx={idx}
        onClick={() => !tryLearn(id) && pick(idx >= last ? 0 : idx + 1)}
        onPointerEnter={() => pcbTouch.set(id)}
        onKeyDown={(e) => steppedKey(e, id, idx, last, pick)}
      >
        <span className="mm-p2-sw-slot">
          <span className="mm-p2-sw-knob" style={{ left: idx === 0 ? 2 : undefined, right: idx === last ? 2 : undefined }} />
        </span>
      </button>
      <span className="mm-p2-ref" data-on={on ? '1' : undefined}>
        {ref_}
      </span>
    </div>
  );
};

/** Le selecteur rotatif (trois ou quatre crans) : les noms autour du capuchon, le cran choisi en orange. */
export const PcbRotary: React.FC<CellProps & { w: number }> = ({ id, name, ref_, w }) => {
  const { idx, steps, last, pick } = useStepped(id);
  const armed = useArmed(id);
  const on = useTouched(id);
  const el = useRef<HTMLButtonElement>(null);
  useWheel(el, (t) => pick(stepOf(id, SRC.of(id)) + t));
  const n = steps.length;
  const spread = n <= 3 ? 180 : 240;
  const angles = steps.map((_, i) => -spread / 2 + (i * spread) / Math.max(1, n - 1));
  const R = 27;
  return (
    <div className="mm-p2-cell mm-p2-rot" data-x={id} style={{ width: w }}>
      <span className="mm-p2-name">{name}</span>
      <div className="mm-p2-rot-body">
        <button
          ref={el}
          type="button"
          className="mm-p2-knob-hit mm-p2-rot-hit"
          aria-label={`${fullName(id)}: ${steps[idx]}`}
          data-armed={armed ? '1' : undefined}
          onClick={() => !tryLearn(id) && pick(idx >= last ? 0 : idx + 1)}
          onContextMenu={(e) => {
            e.preventDefault();
            if (!tryLearn(id)) pick(idx <= 0 ? last : idx - 1);
          }}
          onPointerEnter={() => pcbTouch.set(id)}
          onKeyDown={(e) => steppedKey(e, id, idx, last, pick, true)}
        >
          <KnobSvg angle={angles[idx] ?? 0} ticks={angles} size={40} lit={idx} />
        </button>
        {steps.map((s, i) => {
          const a = angles[i] * DEG;
          const x = Math.sin(a) * R;
          const y = -Math.cos(a) * R;
          const side = Math.abs(x) < 4 ? 'c' : x < 0 ? 'l' : 'r';
          return (
            <button
              key={s}
              type="button"
              tabIndex={-1}
              className="mm-p2-rot-pos"
              data-side={side}
              data-on={i === idx ? '1' : undefined}
              style={{ left: `calc(50% + ${x.toFixed(1)}px)`, top: 20 + y }}
              onClick={() => !tryLearn(id) && pick(i)}
            >
              {s}
            </button>
          );
        })}
      </div>
      <span className="mm-p2-ref" data-on={on ? '1' : undefined}>
        {ref_}
      </span>
    </div>
  );
};

/**
 * L'afficheur a crans (plus de quatre crans) : le nom du cran dans une petite fenetre, une touche de chaque cote (le cran
 * d'avant, celui d'apres, en boucle) ; un clic sur la fenetre deroule toute la liste. Molette, fleches, Debut, Fin.
 */
export const PcbSelect: React.FC<CellProps & { w?: number; bare?: boolean; up?: boolean; cols?: number }> = ({ id, name, ref_, w = 112, bare, up, cols = 2 }) => {
  const { idx, steps, last, pick } = useStepped(id);
  const armed = useArmed(id);
  const on = useTouched(id);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLButtonElement>(null);
  useWheel(face, (t) => pick(stepOf(id, SRC.of(id)) + t));

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
    steppedKey(e, id, idx, last, pick, true);
  };
  const rows = Math.ceil(steps.length / cols);

  const body = (
    <div ref={box} className="mm-p2-selbox" data-armed={armed ? '1' : undefined} onKeyDown={onKey} onPointerEnter={() => pcbTouch.set(id)}>
      <button type="button" className="mm-p2-tact" tabIndex={-1} aria-label={`${fullName(id)}: previous`} onClick={() => !tryLearn(id) && pick(idx <= 0 ? last : idx - 1)}>
        <span className="mm-p2-tact-cap" />
        <span className="mm-p2-tact-glyph" aria-hidden="true">
          ◀
        </span>
      </button>
      <button
        ref={face}
        type="button"
        className="mm-p2-win"
        style={{ width: w }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${fullName(id)}: ${steps[idx]}`}
        data-off={idx === 0 && steps[0] === 'OFF' ? '1' : undefined}
        onClick={() => !tryLearn(id) && setOpen((o) => !o)}
      >
        {SRC.text(id)}
      </button>
      <button type="button" className="mm-p2-tact" tabIndex={-1} aria-label={`${fullName(id)}: next`} onClick={() => !tryLearn(id) && pick(idx >= last ? 0 : idx + 1)}>
        <span className="mm-p2-tact-cap" />
        <span className="mm-p2-tact-glyph" aria-hidden="true">
          ▶
        </span>
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
    <div className="mm-p2-cell mm-p2-sel" data-x={id} style={{ width: w + 48 }}>
      <span className="mm-p2-name">{name}</span>
      {body}
      <span className="mm-p2-ref" data-on={on ? '1' : undefined}>
        {on ? `${idx + 1} / ${steps.length}` : ref_}
      </span>
    </div>
  );
};

/* ---------------- le cadre d'un groupe ---------------- */

export const PcbFrame: React.FC<{ title: string; x: number; y: number; w?: number; h?: number; children: React.ReactNode; className?: string; led?: boolean }> = ({ title, x, y, w, h, children, className, led }) => (
  <section className={`mm-p2-frame${className ? ` ${className}` : ''}`} style={{ left: x, top: y, width: w, height: h }} aria-label={title}>
    <span className="mm-p2-frame-title">
      {title}
      {led !== undefined && <i className="mm-p2-led" data-on={led ? '1' : undefined} aria-hidden="true" />}
    </span>
    {children}
  </section>
);

/* ---------------- la touche ---------------- */

/**
 * La touche de la face avant (CLEAR, RANDOM, EDIT, PRESET, OPEN de la machine 3D, voyager/pads.ts) redessinee en HTML
 * (2026-11-13, Mika : "les boutons doivent refleter aussi l'interface principale au lieu d'etre des cercles avec une
 * ecriture dessus") : un capuchon carre sombre en relief, son nom ecrit dessous en petites capitales. Allumee (on) : le
 * capuchon en jaune canard, comme la touche OPEN de la face s'allume capot ouvert ; accent : le nom en jaune (PRESET,
 * OPEN). w, h : la taille du capuchon (px du cadre de 1100 x 704).
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
